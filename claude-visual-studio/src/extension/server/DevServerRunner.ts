/**
 * DevServerRunner - Spawns and manages development servers (Next.js, Vite, etc.)
 * Captures stdout/stderr for real-time log display
 */

import { ChildProcess, spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as net from 'net';

export interface ServerLogEntry {
  type: 'stdout' | 'stderr' | 'info' | 'error';
  message: string;
  timestamp: number;
  source: 'backend';
}

interface DevServerConfig {
  command: string;
  args?: string[];
  cwd: string;
  env?: Record<string, string>;
}

export class DevServerRunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private logs: ServerLogEntry[] = [];
  private maxLogs = 1000;
  private isRunning = false;
  private config: DevServerConfig | null = null;
  // Track ports that should be monitored (common dev server ports)
  private monitoredPorts: number[] = [3000, 3001, 5173, 5174, 8080, 8000];
  // Store detected active ports
  private activePorts: number[] = [];

  constructor() {
    super();
  }

  /**
   * Check if a port is in use using netstat (more reliable on Windows)
   * The net.createServer approach can miss servers listening on 0.0.0.0 or IPv6
   */
  private async isPortInUse(port: number): Promise<boolean> {
    if (process.platform === 'win32') {
      try {
        const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
          encoding: 'utf-8',
          windowsHide: true,
          timeout: 5000,
        });
        return result.trim().length > 0;
      } catch {
        // No process found on this port (findstr returns error when no match)
        return false;
      }
    } else {
      // Unix: use lsof or ss
      try {
        const result = execSync(`lsof -i :${port} -sTCP:LISTEN -t 2>/dev/null || ss -tlnp "sport = :${port}" 2>/dev/null | grep LISTEN`, {
          encoding: 'utf-8',
          timeout: 5000,
        });
        return result.trim().length > 0;
      } catch {
        return false;
      }
    }
  }

  /**
   * Find which monitored ports are currently in use
   */
  private async findActivePorts(): Promise<number[]> {
    const activePorts: number[] = [];
    for (const port of this.monitoredPorts) {
      if (await this.isPortInUse(port)) {
        activePorts.push(port);
      }
    }
    return activePorts;
  }

  /**
   * Kill processes on specific ports (Windows)
   */
  private killProcessesOnPorts(ports: number[]): void {
    if (process.platform !== 'win32' || ports.length === 0) return;

    for (const port of ports) {
      try {
        // Find PID using netstat
        const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
          encoding: 'utf-8',
          windowsHide: true,
        });

        const lines = result.trim().split('\n');
        const pids = new Set<string>();

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid) && pid !== '0') {
            pids.add(pid);
          }
        }

        for (const pid of pids) {
          console.log(`[DevServerRunner] Killing process ${pid} on port ${port}`);
          try {
            execSync(`taskkill /F /PID ${pid}`, { windowsHide: true });
          } catch {
            // Process might already be dead
          }
        }
      } catch {
        // No process found on this port
      }
    }
  }

  /**
   * Start a development server
   */
  start(config: DevServerConfig): boolean {
    if (this.isRunning) {
      console.log('[DevServerRunner] Server already running, stopping first...');
      this.stop();
    }

    this.config = config;
    const { command, args = [], cwd, env } = config;

    console.log(`[DevServerRunner] Starting: ${command} ${args.join(' ')} in ${cwd}`);

    try {
      // Determine shell based on platform
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? true : '/bin/sh';

      this.process = spawn(command, args, {
        cwd,
        shell,
        env: { ...process.env, ...env, FORCE_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.isRunning = true;

      // Capture stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        const message = this.stripAnsi(data.toString());
        this.addLog({
          type: 'stdout',
          message,
          timestamp: Date.now(),
          source: 'backend',
        });
      });

      // Capture stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const message = this.stripAnsi(data.toString());
        this.addLog({
          type: 'stderr',
          message,
          timestamp: Date.now(),
          source: 'backend',
        });
      });

      // Handle process exit
      this.process.on('exit', async (code, signal) => {
        console.log(`[DevServerRunner] Parent process exited with code ${code}, signal ${signal}`);

        // For package managers (npm, pnpm, yarn) the parent exits but child servers keep running
        // Wait a moment then check if dev servers are still active on monitored ports
        setTimeout(async () => {
          const activePorts = await this.findActivePorts();

          if (activePorts.length > 0) {
            // Server is still running (child process took over)
            console.log(`[DevServerRunner] Dev server still active on ports: ${activePorts.join(', ')}`);
            this.activePorts = activePorts;
            this.isRunning = true; // Keep marked as running
            this.addLog({
              type: 'info',
              message: `Dev server running on port(s): ${activePorts.join(', ')}`,
              timestamp: Date.now(),
              source: 'backend',
            });
          } else {
            // Server actually stopped
            this.isRunning = false;
            this.activePorts = [];
            this.addLog({
              type: 'info',
              message: `Server exited with code ${code}`,
              timestamp: Date.now(),
              source: 'backend',
            });
            this.emit('exit', code, signal);
          }
        }, 2000); // Wait 2s for child processes to start listening
      });

      // Handle process error
      this.process.on('error', (error) => {
        console.error('[DevServerRunner] Process error:', error);
        this.isRunning = false;
        this.addLog({
          type: 'error',
          message: `Server error: ${error.message}`,
          timestamp: Date.now(),
          source: 'backend',
        });
        this.emit('error', error);
      });

      this.addLog({
        type: 'info',
        message: `Started: ${command} ${args.join(' ')}`,
        timestamp: Date.now(),
        source: 'backend',
      });

      return true;
    } catch (error) {
      console.error('[DevServerRunner] Failed to start:', error);
      this.addLog({
        type: 'error',
        message: `Failed to start server: ${(error as Error).message}`,
        timestamp: Date.now(),
        source: 'backend',
      });
      return false;
    }
  }

  /**
   * Start with common presets
   */
  startPreset(preset: 'nextjs' | 'vite' | 'react' | 'custom', cwd: string, customCommand?: string): boolean {
    const presets: Record<string, { command: string; args: string[] }> = {
      nextjs: { command: 'npm', args: ['run', 'dev'] },
      vite: { command: 'npm', args: ['run', 'dev'] },
      react: { command: 'npm', args: ['start'] },
      custom: { command: customCommand || 'npm', args: ['run', 'dev'] },
    };

    const { command, args } = presets[preset] || presets.nextjs;

    return this.start({
      command,
      args,
      cwd,
    });
  }

  /**
   * Stop the running server
   * NOTE: Only stops processes that were started by this extension (via this.process.pid)
   * Does NOT kill external processes on monitored ports to avoid interfering with user's servers
   */
  async stop(): Promise<boolean> {
    // Only stop if we have a process we started
    if (!this.process?.pid) {
      console.log('[DevServerRunner] No process to stop (no PID tracked)');
      this.isRunning = false;
      this.activePorts = [];
      return false;
    }

    console.log(`[DevServerRunner] Stopping process PID ${this.process.pid}...`);

    // Kill ONLY the process that this extension started
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /F /T /PID ${this.process.pid}`, { windowsHide: true });
      } catch {
        // Process might already be dead
      }
    } else {
      this.process.kill('SIGTERM');
    }

    // DO NOT call killProcessesOnPorts() - this would kill user's external servers!
    // The old code was terminating ANY process on ports 3000, 3001, etc.
    // which could shut down the user's own Next.js/Vite servers

    this.isRunning = false;
    this.process = null;
    this.activePorts = [];

    this.addLog({
      type: 'info',
      message: 'Server stopped',
      timestamp: Date.now(),
      source: 'backend',
    });

    return true;
  }

  /**
   * Restart the server
   */
  async restart(): Promise<boolean> {
    if (!this.config) {
      console.log('[DevServerRunner] No previous config to restart');
      return false;
    }

    await this.stop();

    // Small delay before restart
    setTimeout(() => {
      if (this.config) {
        this.start(this.config);
      }
    }, 1000);

    return true;
  }

  /**
   * Add a log entry
   */
  private addLog(entry: ServerLogEntry): void {
    // Split multiline messages
    const lines = entry.message.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const logEntry: ServerLogEntry = {
        ...entry,
        message: line,
      };

      this.logs.push(logEntry);

      // Emit for real-time updates
      this.emit('log', logEntry);
    }

    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Strip ANSI escape codes from string
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(filter?: 'all' | 'stdout' | 'stderr' | 'info' | 'error', limit = 100): {
    logs: ServerLogEntry[];
    total: number;
    truncated: boolean;
  } {
    let filteredLogs = this.logs;

    if (filter && filter !== 'all') {
      filteredLogs = this.logs.filter((log) => log.type === filter);
    }

    const total = filteredLogs.length;
    const truncated = total > limit;
    const logs = filteredLogs.slice(-limit);

    return { logs, total, truncated };
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    console.log('[DevServerRunner] Logs cleared');
  }

  /**
   * Check if server is running
   */
  getStatus(): { running: boolean; pid?: number; command?: string; ports?: number[] } {
    return {
      running: this.isRunning,
      pid: this.process?.pid,
      command: this.config ? `${this.config.command} ${this.config.args?.join(' ') || ''}` : undefined,
      ports: this.activePorts.length > 0 ? this.activePorts : undefined,
    };
  }

  /**
   * Refresh the running status by checking ports
   * Useful to call periodically to detect if servers died
   */
  async refreshStatus(): Promise<{ running: boolean; ports: number[] }> {
    const activePorts = await this.findActivePorts();

    if (activePorts.length > 0) {
      this.isRunning = true;
      this.activePorts = activePorts;
    } else if (this.isRunning && !this.process?.pid) {
      // Was running but no ports active anymore
      this.isRunning = false;
      this.activePorts = [];
    }

    return { running: this.isRunning, ports: this.activePorts };
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }
}

// Singleton instance
export const devServerRunner = new DevServerRunner();
