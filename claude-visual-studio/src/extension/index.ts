/**
 * Extension Entry Point - Claude Visual Studio
 *
 * This is the main entry point for the VSCode extension. It handles:
 * - Extension activation and deactivation
 * - Command registration
 * - Service initialization
 * - Event listener setup
 */

import * as vscode from 'vscode';
import { WebviewPanelProvider } from './webview/WebviewPanelProvider';
import { SidebarViewProvider } from './webview/SidebarViewProvider';
import { OpenPreviewCommand } from './commands/OpenPreviewCommand';
import { MCPBridge } from './mcp/MCPBridge';
import { ServerManager } from './server/ServerManager';
import { devServerRunner, type ServerLogEntry } from './server/DevServerRunner';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Extension-wide state
let webviewProvider: WebviewPanelProvider | undefined;
let sidebarProvider: SidebarViewProvider | undefined;
let openPreviewCommand: OpenPreviewCommand | undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined;
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
  if (extensionLogs.length > MAX_EXTENSION_LOGS) {
    extensionLogs.shift();
  }

  // Send to webview if available AND visible (avoid spam when panel is closed)
  if (webviewProvider && webviewProvider.isVisible()) {
    webviewProvider.postMessage({
      type: 'extensionLog',
      payload: logEntry,
    });
  }
}

// Install console interceptors
function installConsoleInterceptors(): void {
  // Store a reference to check if interceptors are installed
  const interceptorMarker = Symbol.for('claude-vs-interceptors');

  // Check if already installed (to avoid double interception)
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

    // Mark as installed
    (console as any)[interceptorMarker] = true;

    // Test that interception works by logging immediately
    originalConsole.log('[ExtensionLogs] Console interceptors installed successfully');

    // This log should be captured by our new interceptor
    console.log('[ExtensionLogs] Verification: interceptors are active');
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

/**
 * Extension activation function
 * Called when the extension is activated (first command execution or activation event)
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Install console interceptors early to capture all extension logs
  installConsoleInterceptors();

  console.log('Claude Visual Studio extension is now active');

  try {
    // Initialize services
    await initializeServices(context);

    // Register commands
    registerCommands(context);

    // Set up file watchers
    setupFileWatchers(context);

    // Set up configuration change listeners
    setupConfigurationListeners(context);

    // Show activation message
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
 * Called when the extension is deactivated
 */
export function deactivate(): void {
  console.log('Claude Visual Studio extension is being deactivated');

  try {
    // Clean up resources
    cleanupResources();
    console.log('Claude Visual Studio extension deactivated successfully');
  } catch (error) {
    console.error('Error during deactivation:', error);
  }
}

/**
 * Initialize extension services
 */
async function initializeServices(context: vscode.ExtensionContext): Promise<void> {
  // Initialize webview provider
  webviewProvider = new WebviewPanelProvider(context);

  // Set callback to send server config when webview becomes ready
  webviewProvider.onWebviewReady = () => {
    sendServerConfigToWebview();
  };

  // Initialize sidebar provider
  sidebarProvider = new SidebarViewProvider(context);

  // Register sidebar view provider
  const sidebarDisposable = vscode.window.registerWebviewViewProvider(
    SidebarViewProvider.viewType,
    sidebarProvider
  );
  context.subscriptions.push(sidebarDisposable);

  // Register webview panel serializer for state restoration on VS Code restart
  const serializerDisposable = vscode.window.registerWebviewPanelSerializer(
    'claudeVisualStudio',
    new ClaudeVisualStudioSerializer(context, webviewProvider)
  );
  context.subscriptions.push(serializerDisposable);

  // Initialize commands
  openPreviewCommand = new OpenPreviewCommand(webviewProvider);

  // Initialize development server
  await initializeServer(context.extensionPath);

  // Initialize MCP Bridge for Claude Code integration
  await initializeMCPBridge();

  console.log('Services initialized');
}

// Store the actual server port (may differ from configured if port was in use)
let actualServerPort: number = 3333;

/**
 * Initialize the development server for serving preview content
 * @param extensionPath Path to the extension folder
 */
async function initializeServer(extensionPath: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('claudeVisualStudio');
  const serverPort = config.get<number>('serverPort', 3333);

  // Get workspace folder as root path
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const rootPath = workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  serverManager = new ServerManager();

  // Connect callback to track served HTML files for Page Builder text editing
  serverManager.onHtmlFileServed = (filePath: string) => {
    if (webviewProvider) {
      webviewProvider.setCurrentSourceFilePath(filePath);
      console.log('[PageBuilder] Source file tracked:', filePath);
    }
  };

  try {
    // Pass extensionPath to enable finding injected scripts
    // start() now returns the actual port used (may differ if configured port was in use)
    actualServerPort = await serverManager.start(serverPort, rootPath, undefined, extensionPath);
    console.log(`[Server] Development server started on port ${actualServerPort}`);
  } catch (error) {
    // Log but don't fail activation
    console.warn(`[Server] Could not start server:`, error);
  }
}

/**
 * Send server config to webview when it becomes ready
 */
function sendServerConfigToWebview(): void {
  if (webviewProvider && actualServerPort) {
    webviewProvider.postMessage({
      type: 'configUpdate',
      payload: {
        serverPort: actualServerPort,
        serverBaseUrl: `http://localhost:${actualServerPort}`,
      },
    });
    console.log(`[Server] Sent config to webview: port ${actualServerPort}`);
  }
}

/**
 * Helper function to create a timeout-protected request to the webview
 * Properly handles cleanup to prevent memory leaks
 */
function createWebviewRequest<T>(
  command: string,
  params: Record<string, unknown>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!webviewProvider) {
      reject(new Error('Webview not initialized. Open Visual Preview first (Ctrl+Alt+B).'));
      return;
    }

    if (!webviewProvider.isVisible()) {
      reject(new Error('Visual Preview panel is not visible. Please open it first (Ctrl+Alt+B or click the Claude Visual Studio icon in the sidebar).'));
      return;
    }

    let isSettled = false;
    const timeoutId = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        reject(new Error(`MCP request '${command}' timed out after ${timeoutMs}ms. Make sure the page is loaded in Visual Preview.`));
      }
    }, timeoutMs);

    webviewProvider.requestFromWebview(command, params, (result) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timeoutId);

        // Check if the result contains an error from webview disposal
        if (result && typeof result === 'object' && 'error' in result) {
          reject(new Error(result.error as string));
        } else {
          resolve(result as T);
        }
      }
    });
  });
}

/**
 * Initialize MCP Bridge for browser control
 */
async function initializeMCPBridge(): Promise<void> {
  // MCP bridge port = actual server port + 1
  const mcpPort = actualServerPort + 1;

  mcpBridge = new MCPBridge(mcpPort);

  // Register command handlers using the helper function for proper cleanup
  mcpBridge.registerHandler('navigate', async (params) => {
    if (!webviewProvider) throw new Error('Webview not initialized');
    await webviewProvider.postMessage({
      type: 'navigate',
      payload: { url: params.url },
    });
    return { success: true };
  });

  mcpBridge.registerHandler('getUrl', async () => {
    return createWebviewRequest('getUrl', {}, 5000);
  });

  mcpBridge.registerHandler('getHtml', async (params) => {
    return createWebviewRequest('getHtml', params, 10000);
  });

  mcpBridge.registerHandler('getText', async (params) => {
    return createWebviewRequest('getText', params, 10000);
  });

  mcpBridge.registerHandler('screenshot', async () => {
    return createWebviewRequest('screenshot', {}, 10000);
  });

  mcpBridge.registerHandler('click', async (params) => {
    return createWebviewRequest('click', params, 5000);
  });

  mcpBridge.registerHandler('type', async (params) => {
    return createWebviewRequest('type', params, 5000);
  });

  mcpBridge.registerHandler('refresh', async () => {
    if (!webviewProvider) throw new Error('Webview not initialized');
    await webviewProvider.postMessage({
      type: 'refreshPreview',
      payload: { preserveScroll: false },
    });
    return { success: true };
  });

  mcpBridge.registerHandler('back', async () => {
    if (!webviewProvider) throw new Error('Webview not initialized');
    await webviewProvider.postMessage({
      type: 'navigate',
      payload: { action: 'back' },
    });
    return { success: true };
  });

  mcpBridge.registerHandler('forward', async () => {
    if (!webviewProvider) throw new Error('Webview not initialized');
    await webviewProvider.postMessage({
      type: 'navigate',
      payload: { action: 'forward' },
    });
    return { success: true };
  });

  mcpBridge.registerHandler('getElements', async (params) => {
    return createWebviewRequest('getElements', params, 10000);
  });

  mcpBridge.registerHandler('getSelectedElement', async () => {
    if (!webviewProvider) throw new Error('Webview not initialized');
    const element = webviewProvider.getSelectedElement();
    return { element };
  });

  mcpBridge.registerHandler('openBrowser', async () => {
    console.log('[MCP] openBrowser handler called');
    try {
      // Execute the VS Code command to open the preview panel
      await vscode.commands.executeCommand('claudeVisualStudio.openPreview');
      console.log('[MCP] openPreview command executed');
      // Wait a bit for the panel to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Check if panel is now visible
      const isVisible = webviewProvider?.isVisible() ?? false;
      console.log('[MCP] Panel visible after open:', isVisible);
      return { success: true, panelVisible: isVisible };
    } catch (error) {
      console.error('[MCP] openBrowser error:', error);
      throw error;
    }
  });

  // Console logs handlers (browser logs are handled via webview postMessage)
  mcpBridge.registerHandler('getConsoleLogs', async (params) => {
    return createWebviewRequest('getConsoleLogs', params, 10000);
  });

  mcpBridge.registerHandler('clearConsoleLogs', async () => {
    return createWebviewRequest('clearConsoleLogs', {}, 5000);
  });

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
    // Refresh status by checking ports before returning
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

  // Listen for backend logs and send to webview in real-time (only if visible)
  devServerRunner.on('log', (logEntry: ServerLogEntry) => {
    if (webviewProvider && webviewProvider.isVisible()) {
      webviewProvider.postMessage({
        type: 'backendLog',
        payload: logEntry,
      });
    }
  });

  // Start the bridge
  try {
    const actualMcpPort = await mcpBridge.start();
    console.log(`[MCP] Bridge started on port ${actualMcpPort}`);

    // Save port to workspace file so MCP server can find it
    await saveMcpPortToWorkspace(actualMcpPort);
  } catch (error) {
    console.error('[MCP] Failed to start bridge:', error);
  }
}

/**
 * Save MCP port to a file in the workspace so the MCP server can find it
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
    // Create .vscode directory if it doesn't exist
    try {
      await vscode.workspace.fs.stat(vscodeDir);
    } catch {
      await vscode.workspace.fs.createDirectory(vscodeDir);
    }

    // Write port to file
    const content = Buffer.from(JSON.stringify({ port, timestamp: Date.now() }));
    await vscode.workspace.fs.writeFile(portFile, content);
    console.log(`[MCP] Saved port ${port} to ${portFile.fsPath}`);
  } catch (error) {
    console.error('[MCP] Failed to save port file:', error);
  }
}

/**
 * Webview Panel Serializer - Restores webview state when VS Code restarts
 */
class ClaudeVisualStudioSerializer implements vscode.WebviewPanelSerializer {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly provider: WebviewPanelProvider
  ) {}

  async deserializeWebviewPanel(
    webviewPanel: vscode.WebviewPanel,
    state: unknown
  ): Promise<void> {
    console.log('Deserializing webview panel with state:', state);

    // Restore the webview panel through the provider
    await this.provider.restoreWebviewPanel(webviewPanel, state);
  }
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  if (!webviewProvider) {
    throw new Error('WebviewProvider not initialized');
  }

  // Command: Open Preview
  const openPreviewDisposable = vscode.commands.registerCommand(
    'claudeVisualStudio.openPreview',
    async (uri?: vscode.Uri) => {
      try {
        await openPreviewCommand?.execute(uri);
      } catch (error) {
        console.error('Error executing openPreview command:', error);
        vscode.window.showErrorMessage(
          `Failed to open preview: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );

  // Command: Toggle Selection Mode
  const toggleSelectionDisposable = vscode.commands.registerCommand(
    'claudeVisualStudio.toggleSelection',
    async () => {
      try {
        await handleToggleSelection();
      } catch (error) {
        console.error('Error executing toggleSelection command:', error);
        vscode.window.showErrorMessage(
          `Failed to toggle selection: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );

  // Command: Refresh Preview
  const refreshPreviewDisposable = vscode.commands.registerCommand(
    'claudeVisualStudio.refreshPreview',
    async () => {
      try {
        await handleRefreshPreview();
      } catch (error) {
        console.error('Error executing refreshPreview command:', error);
        vscode.window.showErrorMessage(
          `Failed to refresh preview: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );

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

  // Command: Force Recreate Panel (for development)
  const forceRecreateDisposable = vscode.commands.registerCommand(
    'claudeVisualStudio.forceRecreate',
    async () => {
      try {
        await webviewProvider?.forceRecreate();
        vscode.window.showInformationMessage('Panel recreated successfully');
      } catch (error) {
        console.error('Error recreating panel:', error);
        vscode.window.showErrorMessage(
          `Failed to recreate panel: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
  context.subscriptions.push(forceRecreateDisposable);

  // Command: Reload Extension (reloads VS Code window)
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

  // Command: Open External Chrome (MCP)
  const openExternalBrowserDisposable = vscode.commands.registerCommand(
    'claudeVisualStudio.openExternalBrowser',
    async () => {
      try {
        const result = await launchExternalChrome();
        if (!result.success) {
          vscode.window.showErrorMessage(result.error || 'Failed to launch Chrome');
        }
      } catch (error) {
        console.error('Error executing openExternalBrowser command:', error);
        vscode.window.showErrorMessage(
          `Failed to open external browser: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );

  // Register disposables
  context.subscriptions.push(
    openPreviewDisposable,
    toggleSelectionDisposable,
    refreshPreviewDisposable,
    openSettingsDisposable,
    reloadExtensionDisposable,
    openExternalBrowserDisposable
  );

  console.log('Commands registered');
}

/**
 * Set up file watchers for auto-refresh functionality
 */
function setupFileWatchers(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('claudeVisualStudio');
  const autoRefresh = config.get<boolean>('autoRefresh', true);

  if (!autoRefresh) {
    console.log('Auto-refresh is disabled');
    return;
  }

  // Watch for changes in HTML, CSS, and JS files
  fileWatcher = vscode.workspace.createFileSystemWatcher(
    '**/*.{html,htm,css,js,jsx,ts,tsx}',
    false,
    false,
    false
  );

  // Patterns to exclude from file watching (build outputs, dependencies, etc.)
  const excludePatterns = [
    /[/\\]\.next[/\\]/,           // Next.js build output
    /[/\\]node_modules[/\\]/,     // Dependencies
    /[/\\]dist[/\\]/,             // Build output
    /[/\\]\.git[/\\]/,            // Git internals
    /[/\\]\.turbo[/\\]/,          // Turbo cache
    /[/\\]\.cache[/\\]/,          // Various caches
    /[/\\]out[/\\]/,              // Common build output
    /[/\\]build[/\\]/,            // Common build output
    /\.d\.ts$/,                   // Type declaration files
    /\.map$/,                     // Source maps
  ];

  // Handle file changes
  fileWatcher.onDidChange(async (uri) => {
    // Skip excluded paths
    const filePath = uri.fsPath;
    const shouldExclude = excludePatterns.some(pattern => pattern.test(filePath));

    if (shouldExclude) {
      // Silently ignore changes in excluded paths
      return;
    }

    if (webviewProvider?.isVisible()) {
      console.log('File changed, refreshing preview:', filePath);
      await webviewProvider.postMessage({
        type: 'refreshPreview',
        payload: { preserveScroll: true },
      });
    }
  });

  // Handle file creation
  fileWatcher.onDidCreate(async (uri) => {
    console.log('File created:', uri.fsPath);
  });

  // Handle file deletion
  fileWatcher.onDidDelete(async (uri) => {
    console.log('File deleted:', uri.fsPath);
  });

  context.subscriptions.push(fileWatcher);
  console.log('File watchers set up');
}

/**
 * Set up configuration change listeners
 */
function setupConfigurationListeners(context: vscode.ExtensionContext): void {
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (e.affectsConfiguration('claudeVisualStudio')) {
      console.log('Configuration changed');

      const config = vscode.workspace.getConfiguration('claudeVisualStudio');

      // Send updated configuration to webview
      if (webviewProvider?.isVisible()) {
        await webviewProvider.postMessage({
          type: 'configUpdate',
          payload: {
            serverPort: config.get('serverPort'),
            autoRefresh: config.get('autoRefresh'),
          },
        });
      }

      // Re-setup file watchers if autoRefresh setting changed
      if (e.affectsConfiguration('claudeVisualStudio.autoRefresh')) {
        fileWatcher?.dispose();
        setupFileWatchers(context);
      }
    }
  });

  context.subscriptions.push(configChangeDisposable);
  console.log('Configuration listeners set up');
}

/**
 * Handle toggle selection command
 */
async function handleToggleSelection(): Promise<void> {
  if (!webviewProvider) {
    vscode.window.showWarningMessage('Please open the preview first');
    return;
  }

  if (!webviewProvider.isVisible()) {
    vscode.window.showWarningMessage('Preview is not visible');
    return;
  }

  // Toggle selection mode (we'll track this in the webview)
  const success = await webviewProvider.postMessage({
    type: 'toggleSelectionMode',
    payload: { enabled: true }, // The webview will toggle based on current state
  });

  if (success) {
    vscode.window.showInformationMessage('Element selection mode toggled');
  }
}

/**
 * Handle refresh preview command
 */
async function handleRefreshPreview(): Promise<void> {
  if (!webviewProvider) {
    vscode.window.showWarningMessage('Please open the preview first');
    return;
  }

  if (!webviewProvider.isVisible()) {
    vscode.window.showWarningMessage('Preview is not visible');
    return;
  }

  const success = await webviewProvider.postMessage({
    type: 'refreshPreview',
    payload: { preserveScroll: false },
  });

  if (success) {
    vscode.window.showInformationMessage('Preview refreshed');
  }
}

/**
 * Find Chrome executable path based on operating system
 */
function findChromePath(): string | undefined {
  const config = vscode.workspace.getConfiguration('claudeVisualStudio');
  const customPath = config.get<string>('chromePath', '');

  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const platform = process.platform;

  // Common Chrome paths by platform
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
 * Launch external Chrome with remote debugging enabled
 * This browser is accessible to all Claude Code terminals via MCP
 */
async function launchExternalChrome(): Promise<{ success: boolean; port?: number; error?: string }> {
  // Check if Chrome is already running
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

  // Create a temporary user data directory for the debug session
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

    externalChromeProcess = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore',
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

    // Don't hold the parent process
    externalChromeProcess.unref();

    // Wait a bit for Chrome to start
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Save the debug port info to workspace for Claude Code to find
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
 * Save Chrome debug port to workspace file for Claude Code MCP to find
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
    // Create .vscode directory if it doesn't exist
    try {
      await vscode.workspace.fs.stat(vscodeDir);
    } catch {
      await vscode.workspace.fs.createDirectory(vscodeDir);
    }

    // Write port info to file
    const content = Buffer.from(JSON.stringify({
      port,
      timestamp: Date.now(),
      wsEndpoint: `ws://localhost:${port}`,
      httpEndpoint: `http://localhost:${port}`,
    }));
    await vscode.workspace.fs.writeFile(portFile, content);
    console.log(`[ExternalChrome] Saved debug port ${port} to ${portFile.fsPath}`);

    // Also save MCP server configuration for Claude Code
    await saveMcpBrowserConfig(workspaceRoot);
  } catch (error) {
    console.error('[ExternalChrome] Failed to save port file:', error);
  }
}

/**
 * Save MCP browser server configuration for Claude Code
 */
async function saveMcpBrowserConfig(workspaceRoot: string): Promise<void> {
  // Find the extension path to get the MCP server location
  const extensionPath = path.dirname(path.dirname(__dirname));
  const mcpServerPath = path.join(extensionPath, 'dist', 'mcp-browser-server', 'index.js');

  // Create the MCP configuration
  const mcpConfig = {
    mcpServers: {
      'claude-browser': {
        command: 'node',
        args: [mcpServerPath],
        cwd: workspaceRoot,
      },
    },
  };

  // Save to .vscode/mcp-browser.json for reference
  const mcpConfigFile = vscode.Uri.file(`${workspaceRoot}/.vscode/mcp-browser-config.json`);
  const configContent = Buffer.from(JSON.stringify(mcpConfig, null, 2));
  await vscode.workspace.fs.writeFile(mcpConfigFile, configContent);

  console.log(`[ExternalChrome] Saved MCP config to ${mcpConfigFile.fsPath}`);

  // Show instructions to the user
  const action = await vscode.window.showInformationMessage(
    'Chrome MCP server ready! Add it to Claude Code to control the browser from any terminal.',
    'Add to Claude Code',
    'Copy Config',
    'Later'
  );

  if (action === 'Add to Claude Code') {
    // Run the command to add MCP server to Claude Code
    const terminal = vscode.window.createTerminal('Claude Code MCP Setup');
    terminal.show();
    terminal.sendText(`claude mcp add claude-browser -- node "${mcpServerPath}"`);
  } else if (action === 'Copy Config') {
    const configText = `claude mcp add claude-browser -- node "${mcpServerPath}"`;
    await vscode.env.clipboard.writeText(configText);
    vscode.window.showInformationMessage('MCP command copied to clipboard!');
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
  // Stop external Chrome browser
  stopExternalChrome();

  // Stop development server
  if (serverManager) {
    serverManager.stop();
    serverManager = undefined;
  }

  // Stop MCP bridge
  if (mcpBridge) {
    mcpBridge.stop();
    mcpBridge = undefined;
  }

  // Dispose webview provider
  if (webviewProvider) {
    webviewProvider.dispose();
    webviewProvider = undefined;
  }

  // Clear sidebar provider reference
  sidebarProvider = undefined;

  // Dispose commands
  if (openPreviewCommand) {
    openPreviewCommand.dispose();
    openPreviewCommand = undefined;
  }

  // Dispose file watcher
  if (fileWatcher) {
    fileWatcher.dispose();
    fileWatcher = undefined;
  }

  console.log('Resources cleaned up');
}

// Export services for testing
export function getWebviewProvider(): WebviewPanelProvider | undefined {
  return webviewProvider;
}

export function getOpenPreviewCommand(): OpenPreviewCommand | undefined {
  return openPreviewCommand;
}
