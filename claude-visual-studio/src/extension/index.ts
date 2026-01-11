/**
 * Extension Entry Point - Claude Visual Studio
 *
 * This extension provides:
 * - Development server for serving local files
 * - MCP Bridge for Claude Code integration
 * - Backend dev server management (npm run dev, etc.)
 */

import * as vscode from 'vscode';
import { MCPBridge } from './mcp/MCPBridge';
import { ServerManager } from './server/ServerManager';
import { devServerRunner, type ServerLogEntry } from './server/DevServerRunner';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Extension-wide state
let mcpBridge: MCPBridge | undefined;
let serverManager: ServerManager | undefined;
let externalChromeProcess: ChildProcess | undefined;
let externalChromePort: number | undefined;

// Extension Host log capture
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

// Store extension logs for retrieval
const extensionLogs: Array<{ type: string; message: string; timestamp: number }> = [];
const MAX_EXTENSION_LOGS = 500;
const TRIM_BATCH_SIZE = 100; // Trim in batches for better performance

function captureExtensionLog(type: string, args: unknown[]): void {
  const message = args.map(arg => {
    if (typeof arg === 'string') return arg;
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }).join(' ');

  const logEntry = {
    type,
    message,
    timestamp: Date.now(),
  };

  // Store log
  extensionLogs.push(logEntry);

  // Use batch trimming instead of per-item shift() for better O(n) performance
  // Instead of shifting one at a time (O(n) per operation), we batch trim
  if (extensionLogs.length > MAX_EXTENSION_LOGS + TRIM_BATCH_SIZE) {
    // Remove oldest entries in one operation
    extensionLogs.splice(0, extensionLogs.length - MAX_EXTENSION_LOGS);
  }
}

// Install console interceptors
function installConsoleInterceptors(): void {
  const interceptorMarker = Symbol.for('claude-vs-interceptors');

  if ((console as any)[interceptorMarker]) {
    originalConsole.log('[ExtensionLogs] Interceptors already installed');
    return;
  }

  try {
    console.log = (...args: unknown[]) => {
      originalConsole.log(...args);
      captureExtensionLog('log', args);
    };
    console.error = (...args: unknown[]) => {
      originalConsole.error(...args);
      captureExtensionLog('error', args);
    };
    console.warn = (...args: unknown[]) => {
      originalConsole.warn(...args);
      captureExtensionLog('warn', args);
    };
    console.info = (...args: unknown[]) => {
      originalConsole.info(...args);
      captureExtensionLog('info', args);
    };
    console.debug = (...args: unknown[]) => {
      originalConsole.debug(...args);
      captureExtensionLog('debug', args);
    };

    (console as any)[interceptorMarker] = true;
    originalConsole.log('[ExtensionLogs] Console interceptors installed successfully');
  } catch (error) {
    originalConsole.error('[ExtensionLogs] Failed to install interceptors:', error);
  }
}

// Get extension logs for MCP
function getExtensionLogs(filter?: string, limit?: number): { logs: typeof extensionLogs; total: number } {
  let logs = extensionLogs;
  if (filter && filter !== 'all') {
    logs = logs.filter(log => log.type === filter);
  }
  const total = logs.length;
  if (limit && limit > 0) {
    logs = logs.slice(-limit);
  }
  return { logs, total };
}

function clearExtensionLogs(): void {
  extensionLogs.length = 0;
}

// Store the actual server port
let actualServerPort: number = 3333;

/**
 * Extension activation function
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  installConsoleInterceptors();

  console.log('Claude Visual Studio extension is now active');

  try {
    // Initialize development server
    await initializeServer(context.extensionPath);

    // Initialize MCP Bridge for Claude Code integration
    await initializeMCPBridge();

    // Register commands
    registerCommands(context);

    if (context.extensionMode === vscode.ExtensionMode.Development) {
      vscode.window.showInformationMessage('Claude Visual Studio: Development mode active');
    }

    console.log('Claude Visual Studio extension activated successfully');
  } catch (error) {
    console.error('Failed to activate Claude Visual Studio extension:', error);
    vscode.window.showErrorMessage(
      `Failed to activate Claude Visual Studio: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Extension deactivation function
 */
export function deactivate(): void {
  console.log('Claude Visual Studio extension is being deactivated');

  try {
    cleanupResources();
    console.log('Claude Visual Studio extension deactivated successfully');
  } catch (error) {
    console.error('Error during deactivation:', error);
  }
}

/**
 * Initialize the development server
 */
async function initializeServer(extensionPath: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('claudeVisualStudio');
  const serverPort = config.get<number>('serverPort', 3333);

  const workspaceFolders = vscode.workspace.workspaceFolders;
  const rootPath = workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  serverManager = new ServerManager();

  try {
    actualServerPort = await serverManager.start(serverPort, rootPath, undefined, extensionPath);
    console.log(`[Server] Development server started on port ${actualServerPort}`);
  } catch (error) {
    console.warn(`[Server] Could not start server:`, error);
  }
}

/**
 * Initialize MCP Bridge for backend control
 */
async function initializeMCPBridge(): Promise<void> {
  const mcpPort = actualServerPort + 1;

  mcpBridge = new MCPBridge(mcpPort);

  // Backend dev server handlers
  mcpBridge.registerHandler('startDevServer', async (params) => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const cwd = params.cwd || workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const command = params.command || 'npm';
    const args = params.args || ['run', 'dev'];

    const success = devServerRunner.start({ command, args, cwd });
    return { success, message: success ? `Started ${command} ${args.join(' ')}` : 'Failed to start server' };
  });

  mcpBridge.registerHandler('stopDevServer', async () => {
    const success = await devServerRunner.stop();
    return { success, message: success ? 'Server stopped' : 'No server running' };
  });

  mcpBridge.registerHandler('restartDevServer', async () => {
    const success = await devServerRunner.restart();
    return { success, message: success ? 'Server restarting...' : 'No previous server config' };
  });

  mcpBridge.registerHandler('getDevServerStatus', async () => {
    await devServerRunner.refreshStatus();
    return devServerRunner.getStatus();
  });

  mcpBridge.registerHandler('getBackendLogs', async (params) => {
    const filter = params.filter || 'all';
    const limit = params.limit || 100;
    return devServerRunner.getLogs(filter, limit);
  });

  mcpBridge.registerHandler('clearBackendLogs', async () => {
    devServerRunner.clearLogs();
    return { success: true, message: 'Backend logs cleared' };
  });

  mcpBridge.registerHandler('stopExternalServer', async (params) => {
    const ports = params.ports || [3000, 3001, 5173, 5174, 8080, 8000];
    const stoppedPorts: number[] = [];

    for (const port of ports) {
      try {
        if (process.platform === 'win32') {
          const { execSync } = await import('child_process');
          const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
            encoding: 'utf-8',
            windowsHide: true,
          });

          const lines = result.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && /^\d+$/.test(pid) && pid !== '0') {
              try {
                execSync(`taskkill /F /PID ${pid}`, { windowsHide: true });
                stoppedPorts.push(port);
                console.log(`[MCP] Killed process ${pid} on port ${port}`);
              } catch {
                // Process might already be dead
              }
            }
          }
        } else {
          const { execSync } = await import('child_process');
          execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`);
          stoppedPorts.push(port);
        }
      } catch {
        // No process on this port
      }
    }

    if (stoppedPorts.length > 0) {
      return { success: true, message: `Stopped processes on port(s): ${stoppedPorts.join(', ')}. Now use backend_start_dev_server to restart with log capture.` };
    } else {
      return { success: true, message: 'No external servers found on the specified ports.' };
    }
  });

  // Extension Host log handlers
  mcpBridge.registerHandler('getExtensionLogs', async (params) => {
    const filter = params.filter || 'all';
    const limit = params.limit || 100;
    return getExtensionLogs(filter, limit);
  });

  mcpBridge.registerHandler('clearExtensionLogs', async () => {
    clearExtensionLogs();
    return { success: true, message: 'Extension logs cleared' };
  });

  // External Chrome browser handlers
  mcpBridge.registerHandler('openExternalChrome', async () => {
    console.log('[MCP] openExternalChrome handler called');
    const result = await launchExternalChrome();
    return result;
  });

  mcpBridge.registerHandler('getExternalChromeStatus', async () => {
    return getExternalChromeStatus();
  });

  mcpBridge.registerHandler('stopExternalChrome', async () => {
    const success = stopExternalChrome();
    return { success, message: success ? 'Chrome stopped' : 'No Chrome running' };
  });

  // Start the bridge
  try {
    const actualMcpPort = await mcpBridge.start();
    console.log(`[MCP] Bridge started on port ${actualMcpPort}`);
    await saveMcpPortToWorkspace(actualMcpPort);
  } catch (error) {
    console.error('[MCP] Failed to start bridge:', error);
  }
}

/**
 * Save MCP port to workspace file
 */
async function saveMcpPortToWorkspace(port: number): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    console.log('[MCP] No workspace folder, skipping port file save');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const vscodeDir = vscode.Uri.file(`${workspaceRoot}/.vscode`);
  const portFile = vscode.Uri.file(`${workspaceRoot}/.vscode/.claude-visual-studio-port`);

  try {
    try {
      await vscode.workspace.fs.stat(vscodeDir);
    } catch {
      await vscode.workspace.fs.createDirectory(vscodeDir);
    }

    const content = Buffer.from(JSON.stringify({ port, timestamp: Date.now() }));
    await vscode.workspace.fs.writeFile(portFile, content);
    console.log(`[MCP] Saved port ${port} to ${portFile.fsPath}`);
  } catch (error) {
    console.error('[MCP] Failed to save port file:', error);
  }
}

/**
 * Register extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Command: Open Settings
  const openSettingsDisposable = vscode.commands.registerCommand(
    'claudeVisualStudio.openSettings',
    async () => {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'claudeVisualStudio'
      );
    }
  );

  // Command: Reload Extension
  const reloadExtensionDisposable = vscode.commands.registerCommand(
    'claudeVisualStudio.reloadExtension',
    async () => {
      const answer = await vscode.window.showInformationMessage(
        'Reload VS Code to apply extension updates?',
        'Reload',
        'Cancel'
      );
      if (answer === 'Reload') {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    }
  );

  context.subscriptions.push(
    openSettingsDisposable,
    reloadExtensionDisposable
  );

  console.log('Commands registered');
}

/**
 * Find Chrome executable path
 */
function findChromePath(): string | undefined {
  const config = vscode.workspace.getConfiguration('claudeVisualStudio');
  const customPath = config.get<string>('chromePath', '');

  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const platform = process.platform;

  const chromePaths: { [key: string]: string[] } = {
    win32: [
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES'] + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ],
  };

  const paths = chromePaths[platform] || [];

  for (const chromePath of paths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  return undefined;
}

/**
 * Launch external Chrome with remote debugging
 */
async function launchExternalChrome(): Promise<{ success: boolean; port?: number; error?: string }> {
  if (externalChromeProcess && !externalChromeProcess.killed) {
    return {
      success: true,
      port: externalChromePort,
    };
  }

  const chromePath = findChromePath();
  if (!chromePath) {
    const error = 'Chrome not found. Please install Chrome or set a custom path in settings.';
    vscode.window.showErrorMessage(error);
    return { success: false, error };
  }

  const config = vscode.workspace.getConfiguration('claudeVisualStudio');
  const debugPort = config.get<number>('chromeDebugPort', 9222);

  const userDataDir = path.join(
    process.env.TEMP || process.env.TMPDIR || '/tmp',
    `claude-vs-chrome-${Date.now()}`
  );

  const args = [
    `--remote-debugging-port=${debugPort}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];

  try {
    console.log(`[ExternalChrome] Launching Chrome from: ${chromePath}`);
    console.log(`[ExternalChrome] Debug port: ${debugPort}`);

    const isWindows = process.platform === 'win32';

    externalChromeProcess = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore',
      shell: isWindows,
      windowsHide: false,
    });

    externalChromePort = debugPort;

    externalChromeProcess.on('error', (err) => {
      console.error('[ExternalChrome] Failed to start:', err);
      externalChromeProcess = undefined;
      externalChromePort = undefined;
    });

    externalChromeProcess.on('exit', (code) => {
      console.log(`[ExternalChrome] Chrome exited with code: ${code}`);
      externalChromeProcess = undefined;
      externalChromePort = undefined;
    });

    externalChromeProcess.unref();

    // Wait for Chrome to start
    console.log('[ExternalChrome] Waiting for Chrome to start...');
    let chromeReady = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const http = require('http');
        const checkResponse = await new Promise<boolean>((resolve) => {
          const req = http.get(`http://127.0.0.1:${debugPort}/json/version`, (res: any) => {
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
          req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
          });
        });
        if (checkResponse) {
          console.log(`[ExternalChrome] Chrome ready on port ${debugPort}`);
          chromeReady = true;
          break;
        }
      } catch {
        // Continue waiting
      }
    }

    if (!chromeReady) {
      console.warn('[ExternalChrome] Chrome may not be ready, but continuing...');
    }

    await saveChromeDebugPortToWorkspace(debugPort);

    vscode.window.showInformationMessage(
      `Chrome opened with remote debugging on port ${debugPort}. ` +
      `Claude Code can now control this browser via MCP.`
    );

    return { success: true, port: debugPort };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ExternalChrome] Error launching Chrome:', error);
    vscode.window.showErrorMessage(`Failed to launch Chrome: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Save Chrome debug port to workspace file
 */
async function saveChromeDebugPortToWorkspace(port: number): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    console.log('[ExternalChrome] No workspace folder, skipping port file save');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const vscodeDir = vscode.Uri.file(`${workspaceRoot}/.vscode`);
  const portFile = vscode.Uri.file(`${workspaceRoot}/.vscode/.claude-chrome-debug-port`);

  try {
    try {
      await vscode.workspace.fs.stat(vscodeDir);
    } catch {
      await vscode.workspace.fs.createDirectory(vscodeDir);
    }

    const content = Buffer.from(JSON.stringify({
      port,
      timestamp: Date.now(),
      wsEndpoint: `ws://localhost:${port}`,
      httpEndpoint: `http://localhost:${port}`,
    }));
    await vscode.workspace.fs.writeFile(portFile, content);
    console.log(`[ExternalChrome] Saved debug port ${port} to ${portFile.fsPath}`);

    await saveMcpBrowserConfig(workspaceRoot);
  } catch (error) {
    console.error('[ExternalChrome] Failed to save port file:', error);
  }
}

/**
 * Save MCP browser server configuration
 */
async function saveMcpBrowserConfig(workspaceRoot: string): Promise<void> {
  const extensionPath = path.dirname(path.dirname(__dirname));
  const mcpServerPath = path.join(extensionPath, 'dist', 'mcp-browser-server', 'index.js');

  const mcpConfig = {
    mcpServers: {
      'claude-browser': {
        command: 'node',
        args: [mcpServerPath],
        cwd: workspaceRoot,
      },
    },
  };

  const mcpConfigFile = vscode.Uri.file(`${workspaceRoot}/.vscode/mcp-browser-config.json`);
  const configContent = Buffer.from(JSON.stringify(mcpConfig, null, 2));
  await vscode.workspace.fs.writeFile(mcpConfigFile, configContent);

  console.log(`[ExternalChrome] Saved MCP config to ${mcpConfigFile.fsPath}`);

  const addCommand = `claude mcp add claude-browser -s user -- node "${mcpServerPath}"`;

  try {
    const { exec } = require('child_process');
    exec(addCommand, (error: Error | null, stdout: string, stderr: string) => {
      if (error) {
        console.log('[ExternalChrome] MCP add result:', stderr || error.message);
        vscode.window.showInformationMessage(
          'Chrome browser ready! Use chrome_* tools (e.g., chrome_navigate, chrome_screenshot) to control it.',
          'OK'
        );
      } else {
        console.log('[ExternalChrome] MCP server added globally');
        vscode.window.showInformationMessage(
          'Chrome browser ready and MCP configured! Use chrome_* tools in any Claude Code terminal.',
          'OK'
        );
      }
    });
  } catch (error) {
    const action = await vscode.window.showInformationMessage(
      'Chrome browser ready! Copy command to add MCP server manually.',
      'Copy Command',
      'Later'
    );
    if (action === 'Copy Command') {
      await vscode.env.clipboard.writeText(addCommand);
      vscode.window.showInformationMessage('Command copied to clipboard!');
    }
  }
}

/**
 * Get external Chrome status
 */
function getExternalChromeStatus(): { running: boolean; port?: number } {
  return {
    running: externalChromeProcess !== undefined && !externalChromeProcess.killed,
    port: externalChromePort,
  };
}

/**
 * Stop external Chrome browser
 */
function stopExternalChrome(): boolean {
  if (externalChromeProcess && !externalChromeProcess.killed) {
    externalChromeProcess.kill();
    externalChromeProcess = undefined;
    externalChromePort = undefined;
    console.log('[ExternalChrome] Chrome stopped');
    return true;
  }
  return false;
}

/**
 * Clean up extension resources
 */
function cleanupResources(): void {
  stopExternalChrome();

  if (serverManager) {
    serverManager.stop();
    serverManager = undefined;
  }

  if (mcpBridge) {
    mcpBridge.stop();
    mcpBridge = undefined;
  }

  console.log('Resources cleaned up');
}
