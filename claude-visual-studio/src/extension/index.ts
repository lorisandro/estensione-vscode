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

// Extension-wide state
let webviewProvider: WebviewPanelProvider | undefined;
let sidebarProvider: SidebarViewProvider | undefined;
let openPreviewCommand: OpenPreviewCommand | undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined;

/**
 * Extension activation function
 * Called when the extension is activated (first command execution or activation event)
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
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

  // Initialize sidebar provider
  sidebarProvider = new SidebarViewProvider(context);

  // Register sidebar view provider
  const sidebarDisposable = vscode.window.registerWebviewViewProvider(
    SidebarViewProvider.viewType,
    sidebarProvider
  );
  context.subscriptions.push(sidebarDisposable);

  // Initialize commands
  openPreviewCommand = new OpenPreviewCommand(webviewProvider);

  console.log('Services initialized');
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

  // Register disposables
  context.subscriptions.push(
    openPreviewDisposable,
    toggleSelectionDisposable,
    refreshPreviewDisposable
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

  // Handle file changes
  fileWatcher.onDidChange(async (uri) => {
    if (webviewProvider?.isVisible()) {
      console.log('File changed, refreshing preview:', uri.fsPath);
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
 * Clean up extension resources
 */
function cleanupResources(): void {
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
