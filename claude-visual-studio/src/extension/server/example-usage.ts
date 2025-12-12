/**
 * Example usage of ServerManager and HMRBridge
 *
 * This file demonstrates how to integrate the development server
 * into a VS Code extension.
 */

import * as vscode from 'vscode';
import { ServerManager } from './ServerManager';
import { HMRBridge } from './HMRBridge';
import * as path from 'path';

export class DevServerController {
  private serverManager: ServerManager;
  private hmrBridge: HMRBridge;
  private currentPort: number | null = null;
  private currentHMRPort: number | null = null;

  constructor() {
    this.serverManager = new ServerManager();
    this.hmrBridge = new HMRBridge();
  }

  /**
   * Start the development server for a workspace folder
   */
  async start(workspacePath: string): Promise<{ port: number; hmrPort: number }> {
    // Check if already running
    if (this.serverManager.isRunning()) {
      throw new Error('Server is already running');
    }

    // Get port from configuration
    const config = vscode.workspace.getConfiguration('claudeVisualStudio');
    const port = config.get<number>('serverPort', 3333);
    const hmrPort = port + 1;

    try {
      // Start HTTP server
      await this.serverManager.start(port, workspacePath, hmrPort);

      // Start HMR WebSocket server
      await this.hmrBridge.start({
        port: hmrPort,
        rootPath: workspacePath,
        // Optional: customize watch patterns
        watchPatterns: [
          '**/*.html',
          '**/*.htm',
          '**/*.css',
          '**/*.js',
          '**/*.jsx',
          '**/*.ts',
          '**/*.tsx',
        ],
      });

      this.currentPort = port;
      this.currentHMRPort = hmrPort;

      vscode.window.showInformationMessage(
        `Development server started at http://localhost:${port}`
      );

      return { port, hmrPort };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to start server: ${message}`);
      throw error;
    }
  }

  /**
   * Stop the development server
   */
  async stop(): Promise<void> {
    try {
      await this.hmrBridge.stop();
      await this.serverManager.stop();

      this.currentPort = null;
      this.currentHMRPort = null;

      vscode.window.showInformationMessage('Development server stopped');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to stop server: ${message}`);
      throw error;
    }
  }

  /**
   * Restart the server
   */
  async restart(workspacePath: string): Promise<void> {
    if (this.serverManager.isRunning()) {
      await this.stop();
    }
    await this.start(workspacePath);
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.serverManager.isRunning();
  }

  /**
   * Get server status
   */
  getStatus(): {
    running: boolean;
    port: number | null;
    hmrPort: number | null;
    clientCount: number;
  } {
    return {
      running: this.serverManager.isRunning(),
      port: this.currentPort,
      hmrPort: this.currentHMRPort,
      clientCount: this.hmrBridge.getClientCount(),
    };
  }

  /**
   * Manually trigger a reload for all connected clients
   */
  triggerReload(fileName?: string): void {
    this.hmrBridge.triggerReload(fileName);
  }

  /**
   * Get server URL
   */
  getServerURL(relativePath?: string): string | null {
    if (!this.currentPort) {
      return null;
    }

    const base = `http://localhost:${this.currentPort}`;
    return relativePath ? `${base}/${relativePath}` : base;
  }
}

/**
 * Example integration in extension.ts
 */
export function exampleActivation(context: vscode.ExtensionContext) {
  const devServer = new DevServerController();

  // Command: Start server
  const startCommand = vscode.commands.registerCommand(
    'claudeVisualStudio.startServer',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      try {
        await devServer.start(workspaceFolder.uri.fsPath);
      } catch (error) {
        console.error('Failed to start server:', error);
      }
    }
  );

  // Command: Stop server
  const stopCommand = vscode.commands.registerCommand(
    'claudeVisualStudio.stopServer',
    async () => {
      try {
        await devServer.stop();
      } catch (error) {
        console.error('Failed to stop server:', error);
      }
    }
  );

  // Command: Restart server
  const restartCommand = vscode.commands.registerCommand(
    'claudeVisualStudio.restartServer',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      try {
        await devServer.restart(workspaceFolder.uri.fsPath);
      } catch (error) {
        console.error('Failed to restart server:', error);
      }
    }
  );

  // Command: Show server status
  const statusCommand = vscode.commands.registerCommand(
    'claudeVisualStudio.serverStatus',
    () => {
      const status = devServer.getStatus();

      if (status.running) {
        vscode.window.showInformationMessage(
          `Server running on port ${status.port}, ` +
          `HMR on port ${status.hmrPort}, ` +
          `${status.clientCount} client(s) connected`
        );
      } else {
        vscode.window.showInformationMessage('Server is not running');
      }
    }
  );

  // Auto-reload on file save (if enabled in config)
  const onSaveListener = vscode.workspace.onDidSaveTextDocument((document) => {
    const config = vscode.workspace.getConfiguration('claudeVisualStudio');
    const autoRefresh = config.get<boolean>('autoRefresh', true);

    if (autoRefresh && devServer.isRunning()) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const relativePath = path.relative(
          workspaceFolder.uri.fsPath,
          document.uri.fsPath
        );
        devServer.triggerReload(relativePath);
      }
    }
  });

  // Register disposables
  context.subscriptions.push(
    startCommand,
    stopCommand,
    restartCommand,
    statusCommand,
    onSaveListener,
    {
      dispose: async () => {
        if (devServer.isRunning()) {
          await devServer.stop();
        }
      },
    }
  );

  return devServer;
}
