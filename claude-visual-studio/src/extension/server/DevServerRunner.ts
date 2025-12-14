/**
 * DevServerRunner - Spawns and manages development servers (Next.js, Vite, etc.)
 * Captures stdout/stderr for real-time log display
 */

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';

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

  constructor() {
    super();
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
      this.process.on('exit', (code, signal) => {
        console.log(`[DevServerRunner] Process exited with code ${code}, signal ${signal}`);
        this.isRunning = false;
        this.addLog({
          type: 'info',
          message: `Server exited with code ${code}`,
          timestamp: Date.now(),
          source: 'backend',
        });
        this.emit('exit', code, signal);
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
   */
  stop(): boolean {
    if (!this.process || !this.isRunning) {
      console.log('[DevServerRunner] No server running');
      return false;
    }

    console.log('[DevServerRunner] Stopping server...');

    // Kill the process tree on Windows
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(this.process.pid), '/f', '/t']);
    } else {
      this.process.kill('SIGTERM');
    }

    this.isRunning = false;
    this.process = null;

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
  restart(): boolean {
    if (!this.config) {
      console.log('[DevServerRunner] No previous config to restart');
      return false;
    }

    this.stop();

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
  getStatus(): { running: boolean; pid?: number; command?: string } {
    return {
      running: this.isRunning,
      pid: this.process?.pid,
      command: this.config ? `${this.config.command} ${this.config.args?.join(' ') || ''}` : undefined,
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }
}

// Singleton instance
export const devServerRunner = new DevServerRunner();
