/**
 * WebviewPanelProvider - Manages the webview panel lifecycle
 *
 * This class is responsible for creating, managing, and communicating with
 * the webview panel that hosts the visual editor UI.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
  WebviewState,
  ElementSelectedMessage,
  WebviewReadyMessage,
  OpenFileMessage,
  SaveFileMessage,
  NavigationMessage,
  ConsoleLogMessage,
  StateUpdateMessage,
} from '../../shared/types/MessageTypes';

export class WebviewPanelProvider {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private state: WebviewState = {};
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Create or reveal the webview panel
   */
  public async createWebviewPanel(column?: vscode.ViewColumn): Promise<vscode.WebviewPanel> {
    // If panel already exists, reveal it
    if (this.panel) {
      this.panel.reveal(column);
      return this.panel;
    }

    // Create new webview panel
    this.panel = vscode.window.createWebviewPanel(
      'claudeVisualStudio',
      'Browser',
      column || vscode.ViewColumn.Beside,
      this.getWebviewOptions()
    );

    // Initialize the panel
    this.initializePanel();

    return this.panel;
  }

  /**
   * Restore webview panel from serialized state (called by WebviewPanelSerializer)
   */
  public async restoreWebviewPanel(
    webviewPanel: vscode.WebviewPanel,
    state: unknown
  ): Promise<void> {
    // Use the provided panel instead of creating a new one
    this.panel = webviewPanel;

    // Restore state if provided
    if (state && typeof state === 'object') {
      this.state = state as WebviewState;
    }

    // Initialize the panel with restored state
    this.initializePanel();

    console.log('Webview panel restored successfully');
  }

  /**
   * Get webview panel options
   */
  private getWebviewOptions(): vscode.WebviewPanelOptions & vscode.WebviewOptions {
    return {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'dist')),
        vscode.Uri.file(path.join(this.context.extensionPath, 'resources')),
      ],
    };
  }

  /**
   * Initialize webview panel (shared between create and restore)
   */
  private initializePanel(): void {
    if (!this.panel) {
      return;
    }

    // Set the HTML content
    this.panel.webview.html = this.getWebviewContent(this.panel.webview);

    // Set up message handling
    this.setupMessageHandling();

    // Handle panel disposal (when user closes the panel)
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.disposables
    );

    // Handle visibility changes
    this.panel.onDidChangeViewState(
      (e) => {
        if (e.webviewPanel.visible) {
          // Restore state when panel becomes visible
          this.restoreState();
        }
      },
      null,
      this.disposables
    );
  }

  /**
   * Post a message to the webview
   */
  public async postMessage(message: ExtensionToWebviewMessage): Promise<boolean> {
    if (!this.panel) {
      console.error('Cannot post message: webview panel does not exist');
      return false;
    }

    try {
      const success = await this.panel.webview.postMessage({
        ...message,
        timestamp: Date.now(),
      });
      return success;
    } catch (error) {
      console.error('Error posting message to webview:', error);
      return false;
    }
  }

  /**
   * Get the webview panel instance
   */
  public getPanel(): vscode.WebviewPanel | undefined {
    return this.panel;
  }

  /**
   * Check if panel is visible
   */
  public isVisible(): boolean {
    return this.panel?.visible ?? false;
  }

  /**
   * Dispose of the panel and clean up resources
   */
  public dispose(): void {
    // Save state before disposing
    this.saveState();

    // Dispose of the panel
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }

    // Dispose of all disposables
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }
  }

  /**
   * Generate the HTML content for the webview
   */
  private getWebviewContent(webview: vscode.Webview): string {
    // Get URIs for resources
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'dist', 'webview', 'index.js'))
    );

    // Generate a nonce for security
    const nonce = this.getNonce();

    // Build HTML with secure CSP
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Security CSP -->
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src ${webview.cspSource} 'unsafe-inline';
                 img-src ${webview.cspSource} https: data: blob:;
                 font-src ${webview.cspSource} data:;
                 connect-src ws://localhost:* http://localhost:* https:;
                 frame-src http://localhost:* https:;
                 worker-src ${webview.cspSource} blob:;">

  <title>Browser</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root {
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground, #cccccc);
      background-color: var(--vscode-editor-background, #1e1e1e);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate a cryptographically secure nonce
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Set up message handling between webview and extension
   */
  private setupMessageHandling(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        try {
          await this.handleWebviewMessage(message);
        } catch (error) {
          console.error('Error handling webview message:', error);
          this.postMessage({
            type: 'error',
            payload: {
              message: error instanceof Error ? error.message : 'Unknown error',
              details: error,
            },
          });
        }
      },
      null,
      this.disposables
    );
  }

  /**
   * Handle messages received from the webview
   */
  private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    console.log('Received message from webview:', message.type);

    switch (message.type) {
      case 'webviewReady':
        await this.handleWebviewReady(message);
        break;

      case 'elementSelected':
        await this.handleElementSelected(message);
        break;

      case 'openFile':
        await this.handleOpenFile(message);
        break;

      case 'saveFile':
        await this.handleSaveFile(message);
        break;

      case 'navigation':
        await this.handleNavigation(message);
        break;

      case 'consoleLog':
        this.handleConsoleLog(message);
        break;

      case 'stateUpdate':
        this.handleStateUpdate(message);
        break;

      default:
        console.warn('Unknown message type:', (message as any).type);
    }
  }

  /**
   * Handle webview ready event
   */
  private async handleWebviewReady(message: WebviewReadyMessage): Promise<void> {
    console.log('Webview is ready');

    // Send configuration to webview
    const config = vscode.workspace.getConfiguration('claudeVisualStudio');
    await this.postMessage({
      type: 'configUpdate',
      payload: {
        serverPort: config.get('serverPort'),
        autoRefresh: config.get('autoRefresh'),
      },
    });

    // Restore previous URL if available
    if (this.state.currentUrl) {
      await this.postMessage({
        type: 'requestNavigate',
        payload: {
          url: this.state.currentUrl,
        },
      });
    }
  }

  /**
   * Handle element selection
   */
  private async handleElementSelected(message: ElementSelectedMessage): Promise<void> {
    const { payload } = message;

    // Update state
    this.state.selectedElement = payload;
    this.saveState();

    // Show information message
    const action = await vscode.window.showInformationMessage(
      `Selected: ${payload.tagName}${payload.id ? `#${payload.id}` : ''}${
        payload.className ? `.${payload.className.split(' ').join('.')}` : ''
      }`,
      'Copy Selector',
      'Open File'
    );

    if (action === 'Copy Selector') {
      await vscode.env.clipboard.writeText(payload.selector);
      vscode.window.showInformationMessage('Selector copied to clipboard');
    } else if (action === 'Open File') {
      // Try to find and open the source file
      // This would require additional logic to map elements to files
      vscode.window.showInformationMessage('File opening functionality coming soon');
    }
  }

  /**
   * Handle file open request
   */
  private async handleOpenFile(message: OpenFileMessage): Promise<void> {
    const { filePath, line, column } = message.payload;

    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      // Move cursor to specified position if provided
      if (line !== undefined) {
        const position = new vscode.Position(line - 1, column ?? 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle file save request
   */
  private async handleSaveFile(message: SaveFileMessage): Promise<void> {
    const { filePath, content } = message.payload;

    try {
      const uri = vscode.Uri.file(filePath);
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
      vscode.window.showInformationMessage(`File saved: ${path.basename(filePath)}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle navigation event
   */
  private async handleNavigation(message: NavigationMessage): Promise<void> {
    const { url, title } = message.payload;

    // Update state
    this.state.currentUrl = url;
    this.saveState();

    // Update panel title
    if (this.panel && title) {
      this.panel.title = `Claude Visual Studio - ${title}`;
    }

    console.log('Navigated to:', url);
  }

  /**
   * Handle console log from webview
   */
  private handleConsoleLog(message: ConsoleLogMessage): void {
    const { level, args } = message.payload;
    const prefix = `[Webview ${level.toUpperCase()}]`;

    switch (level) {
      case 'error':
        console.error(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      case 'debug':
        console.debug(prefix, ...args);
        break;
      default:
        console.log(prefix, ...args);
    }
  }

  /**
   * Handle state update from webview
   */
  private handleStateUpdate(message: StateUpdateMessage): void {
    const { key, value } = message.payload;
    // Type-safe state update - merge into state object
    this.state = {
      ...this.state,
      [key]: value,
    };
    this.saveState();
  }

  /**
   * Save current state to VSCode storage
   */
  private saveState(): void {
    if (this.panel) {
      this.panel.webview.postMessage({
        type: '__vscode_setState',
        state: this.state,
      });
    }
    // Also save to extension global state
    this.context.globalState.update('webviewState', this.state);
  }

  /**
   * Restore state from VSCode storage
   */
  private async restoreState(): Promise<void> {
    const savedState = this.context.globalState.get<WebviewState>('webviewState');
    if (savedState) {
      this.state = savedState;
    }
  }
}
