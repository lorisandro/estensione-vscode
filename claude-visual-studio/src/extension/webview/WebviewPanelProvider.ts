/**
 * WebviewPanelProvider - Manages the webview panel lifecycle
 *
 * This class is responsible for creating, managing, and communicating with
 * the webview panel that hosts the visual editor UI.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
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
  private pendingRequests: Map<string, (result: any) => void> = new Map();
  private requestId = 0;

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

    // Create new webview panel with browser icon
    this.panel = vscode.window.createWebviewPanel(
      'claudeVisualStudio',
      'Browser',
      column || vscode.ViewColumn.Beside,
      this.getWebviewOptions()
    );

    // Set the browser icon for the tab
    this.panel.iconPath = {
      light: vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'browser-light.svg')),
      dark: vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'browser-dark.svg')),
    };

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

    // Update webview options to ensure fresh content
    this.panel.webview.options = this.getWebviewOptions();

    // Initialize the panel with restored state (this sets new HTML)
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
   * Get the currently selected element info
   */
  public getSelectedElement(): any {
    return this.state.selectedElement || null;
  }

  /**
   * Send a request to the webview and wait for response
   * Used by MCP bridge to execute commands in the browser
   */
  public requestFromWebview(
    command: string,
    params: Record<string, any>,
    callback: (result: any) => void
  ): void {
    if (!this.panel) {
      console.log('[MCP] requestFromWebview: panel not available');
      callback({ error: 'Webview not available' });
      return;
    }

    const id = `mcp_${++this.requestId}`;
    this.pendingRequests.set(id, callback);

    console.log('[MCP] Sending mcpRequest to webview:', command, id);
    this.panel.webview.postMessage({
      type: 'mcpRequest',
      payload: {
        id,
        command,
        params,
      },
    });
  }

  /**
   * Force recreate the webview panel (useful for development)
   */
  public async forceRecreate(column?: vscode.ViewColumn): Promise<vscode.WebviewPanel> {
    // Close existing panel if any
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }

    // Create new panel
    return this.createWebviewPanel(column);
  }

  /**
   * Dispose of the panel and clean up resources
   */
  public dispose(): void {
    // Save state before disposing
    this.saveState();

    // Clean up pending MCP requests - reject all with disposal error
    for (const [id, callback] of this.pendingRequests.entries()) {
      callback({ error: 'Webview disposed' });
    }
    this.pendingRequests.clear();

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
    // Get URIs for resources with cache buster
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'dist', 'webview', 'index.js'))
    );
    const cacheBuster = Date.now();

    // Generate a nonce for security
    const nonce = this.getNonce();

    // Build HTML with secure CSP using nonce (per VS Code security best practices)
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Security CSP with nonce-based script execution -->
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}';
                 img-src ${webview.cspSource} https: data: blob:;
                 font-src ${webview.cspSource} data:;
                 connect-src ws://localhost:* http://localhost:* https:;
                 frame-src http://localhost:* https:;
                 worker-src ${webview.cspSource} blob:;">

  <title>Browser</title>
  <style nonce="${nonce}">
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
  <script nonce="${nonce}" type="module" src="${scriptUri}?v=${cacheBuster}"></script>
</body>
</html>`;
  }

  /**
   * Generate a cryptographically secure nonce using Node.js crypto
   */
  private getNonce(): string {
    return crypto.randomBytes(16).toString('base64');
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

      case 'mcpResponse':
        this.handleMCPResponse(message as any);
        break;

      // Handle toggle-selection from webview toolbar
      case 'toggle-selection':
        console.log('Selection mode toggled:', (message as any).payload?.enabled);
        break;

      // Handle navigate message from webview
      case 'navigate':
        console.log('Navigate requested:', (message as any).payload?.url);
        break;

      // Handle webview-ready (kebab-case variant)
      case 'webview-ready':
        console.log('Webview ready (kebab-case)');
        break;

      // Handle refresh message
      case 'refresh':
        console.log('Refresh requested');
        break;

      // Handle screenshot request
      case 'screenshot':
        console.log('Screenshot requested');
        break;

      // Handle element-selected from iframe inspector
      case 'element-selected':
        const inspectorPayload = (message as any).payload || (message as any).data;
        if (inspectorPayload) {
          await this.writeElementToFile(inspectorPayload);
        }
        break;

      default:
        console.warn('Unknown message type:', (message as any).type);
    }
  }

  /**
   * Handle MCP response from webview
   */
  private handleMCPResponse(message: { type: 'mcpResponse'; payload: { id: string; result: any } }): void {
    console.log('[MCP] Received mcpResponse:', message.payload.id, message.payload.result);
    const { id, result } = message.payload;
    const callback = this.pendingRequests.get(id);
    if (callback) {
      console.log('[MCP] Found callback for:', id);
      this.pendingRequests.delete(id);
      callback(result);
    } else {
      console.log('[MCP] No callback found for:', id);
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
   * Write element info to file and send to terminal for Claude Code to see
   */
  private async writeElementToFile(elementInfo: any): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const outputPath = path.join(workspaceFolders[0].uri.fsPath, '.claude-selected-element.json');

    // Normalize element data from different sources (inspector vs webview)
    const elementData = {
      timestamp: new Date().toISOString(),
      element: {
        tag: elementInfo.tagName || elementInfo.tag || 'unknown',
        id: elementInfo.id || null,
        classes: elementInfo.classes || (elementInfo.className ? elementInfo.className.split(' ').filter((c: string) => c) : []),
        selector: elementInfo.selector || null,
        xpath: elementInfo.xpath || null,
        textContent: elementInfo.textContent ? elementInfo.textContent.substring(0, 200) : null,
        attributes: elementInfo.attributes || {},
        boundingBox: elementInfo.boundingBox || elementInfo.rect || null,
        computedStyles: elementInfo.computedStyles || (elementInfo.styles?.computed) || null,
        parent: elementInfo.parent || null,
        children: elementInfo.children || 0,
      }
    };

    try {
      fs.writeFileSync(outputPath, JSON.stringify(elementData, null, 2), 'utf-8');

      // Build a formatted message for the terminal
      const el = elementData.element;
      const selectorStr = `${el.tag}${el.id ? '#' + el.id : ''}${el.classes.length > 0 ? '.' + el.classes.join('.') : ''}`;

      // Create formatted output for Claude Code terminal
      const terminalMessage = [
        `[SELECTED ELEMENT]`,
        `Tag: ${el.tag}`,
        el.id ? `ID: ${el.id}` : null,
        el.classes.length > 0 ? `Classes: ${el.classes.join(', ')}` : null,
        el.selector ? `Selector: ${el.selector}` : null,
        el.textContent ? `Text: "${el.textContent.substring(0, 100)}${el.textContent.length > 100 ? '...' : ''}"` : null,
        el.boundingBox ? `Size: ${Math.round(el.boundingBox.width)}x${Math.round(el.boundingBox.height)}px` : null,
      ].filter(Boolean).join('\n');

      // Send to active terminal (where Claude Code is running)
      const activeTerminal = vscode.window.activeTerminal;
      if (activeTerminal) {
        activeTerminal.sendText(terminalMessage, true);
      }

      console.log(`[Claude VS] Element selected: ${selectorStr}`);
    } catch (err) {
      console.error('[Claude VS] Failed to write element info:', err);
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

    // Write element info to file for Claude Code to read
    await this.writeElementToFile(payload);

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
