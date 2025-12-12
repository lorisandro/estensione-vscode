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
import * as http from 'http';
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

      // Handle screenshot request (legacy - full page)
      case 'screenshot':
        console.log('Screenshot requested');
        break;

      // Handle area screenshot capture
      case 'capture-screenshot-area':
        await this.handleCaptureScreenshotArea(message as any);
        break;

      // Handle open DevTools request
      case 'openDevTools':
        console.log('Opening Developer Tools');
        vscode.commands.executeCommand('workbench.action.webview.openDeveloperTools');
        break;

      // Handle element-selected from iframe inspector
      case 'element-selected':
        const inspectorPayload = (message as any).payload || (message as any).data;
        if (inspectorPayload) {
          await this.writeElementToFile(inspectorPayload);
        }
        break;

      // Handle apply-drag-changes from webview
      case 'apply-drag-changes':
        await this.handleApplyDragChanges(message as any);
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
   * Write element info to file and send to Claude Code via SSE
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

      // Build a formatted message
      const el = elementData.element;
      const selectorStr = `${el.tag}${el.id ? '#' + el.id : ''}${el.classes.length > 0 ? '.' + el.classes.join('.') : ''}`;

      // Clean text content: filter out CSS, scripts, and non-visible content
      const cleanTextContent = (text: string | undefined): string | null => {
        if (!text) return null;
        const trimmed = text.trim();
        // Skip if it looks like CSS or JavaScript
        if (trimmed.startsWith('.') && trimmed.includes('{')) return null;
        if (trimmed.startsWith('function') || trimmed.startsWith('var ') || trimmed.startsWith('const ')) return null;
        if (trimmed.includes('margin:') || trimmed.includes('padding:') || trimmed.includes('display:')) return null;
        // Get only meaningful text, limit to 150 chars
        const cleaned = trimmed.replace(/\s+/g, ' ').substring(0, 150);
        return cleaned.length > 0 ? cleaned : null;
      };

      const cleanedText = cleanTextContent(el.textContent);

      // Build element descriptor (e.g., "button#submit.btn.primary")
      const elementDescriptor = selectorStr;

      // Build size string
      const sizeStr = el.boundingBox
        ? `${Math.round(el.boundingBox.width)}x${Math.round(el.boundingBox.height)}px`
        : null;

      // Create formatted output for Claude Code terminal
      const terminalLines = [
        `[ELEMENTO SELEZIONATO]`,
        `Elemento: <${el.tag}>${el.id ? ` id="${el.id}"` : ''}${el.classes.length > 0 ? ` class="${el.classes.slice(0, 3).join(' ')}"` : ''}`,
        sizeStr ? `Dimensioni: ${sizeStr}` : null,
        cleanedText ? `Testo: "${cleanedText}${el.textContent && el.textContent.length > 150 ? '...' : ''}"` : null,
        `Selector: ${el.selector || selectorStr}`,
      ].filter(Boolean).join('\n');

      // Send directly to active terminal (Claude Code)
      const terminal = vscode.window.activeTerminal;
      if (terminal) {
        terminal.sendText(terminalLines);
      }

      console.log(`[Claude VS] Element selected: ${selectorStr}`);
    } catch (err) {
      console.error('[Claude VS] Failed to write element info:', err);
    }
  }

  /**
   * Get Claude Code SSE port from lock file
   */
  private getClaudeCodeSSEPort(): string | null {
    try {
      const homeDir = process.env.USERPROFILE || process.env.HOME || '';
      const ideLockDir = path.join(homeDir, '.claude', 'ide');

      if (!fs.existsSync(ideLockDir)) {
        return null;
      }

      // Find lock files - the filename is the port number
      const files = fs.readdirSync(ideLockDir);
      const lockFile = files.find(f => f.endsWith('.lock'));

      if (lockFile) {
        // Extract port from filename (e.g., "15791.lock" -> "15791")
        const port = lockFile.replace('.lock', '');
        console.log(`[Claude VS] Found Claude Code SSE port: ${port}`);
        return port;
      }
    } catch (err) {
      console.log('[Claude VS] Could not find Claude Code SSE port');
    }
    return null;
  }

  /**
   * Send message to Claude Code via SSE
   */
  private sendToClaudeCode(port: string, message: string): void {
    const data = JSON.stringify({
      type: 'user_message',
      content: message,
    });

    const options = {
      hostname: 'localhost',
      port: parseInt(port),
      path: '/message',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = http.request(options, (res) => {
      console.log(`[Claude VS] SSE response: ${res.statusCode}`);
    });

    req.on('error', (err) => {
      console.log(`[Claude VS] SSE not available: ${err.message}`);
    });

    req.write(data);
    req.end();
  }

  /**
   * Handle area screenshot capture
   */
  private async handleCaptureScreenshotArea(message: {
    type: 'capture-screenshot-area';
    payload: {
      x: number;
      y: number;
      width: number;
      height: number;
      imageData?: string | null;
    };
  }): Promise<void> {
    const { payload } = message;
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open. Cannot save screenshot.');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const imgFolder = path.join(workspaceRoot, 'img');

    // Create img folder if it doesn't exist
    if (!fs.existsSync(imgFolder)) {
      fs.mkdirSync(imgFolder, { recursive: true });
    }

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
    const filename = `screenshot_${timestamp}_${payload.width}x${payload.height}.png`;
    const filePath = path.join(imgFolder, filename);

    try {
      if (payload.imageData) {
        // Remove data URL prefix if present
        const base64Data = payload.imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Save the image
        fs.writeFileSync(filePath, imageBuffer);
        console.log(`[Claude VS] Screenshot saved: ${filePath}`);
      } else {
        // No image data - create a placeholder file with metadata
        const metadataContent = JSON.stringify({
          type: 'screenshot_area',
          timestamp: new Date().toISOString(),
          area: {
            x: payload.x,
            y: payload.y,
            width: payload.width,
            height: payload.height,
          },
          note: 'Image capture not available - coordinates saved',
        }, null, 2);

        const metadataPath = filePath.replace('.png', '.json');
        fs.writeFileSync(metadataPath, metadataContent);
        console.log(`[Claude VS] Screenshot metadata saved: ${metadataPath}`);
      }

      // Get relative path for display
      const relativePath = path.relative(workspaceRoot, filePath);

      // Create formatted output for Claude Code terminal
      const terminalLines = [
        `[SCREENSHOT CATTURATO]`,
        `File: ${relativePath}`,
        `Dimensioni: ${payload.width}x${payload.height}px`,
        `Area: x=${payload.x}, y=${payload.y}`,
        payload.imageData ? `Percorso completo: ${filePath}` : `Nota: Solo metadati salvati (immagine non disponibile)`,
      ].join('\n');

      // Send directly to active terminal (Claude Code)
      const terminal = vscode.window.activeTerminal;
      if (terminal) {
        terminal.sendText(terminalLines);
      }

      // Show success message with option to open the file
      const action = await vscode.window.showInformationMessage(
        `Screenshot saved: ${relativePath}`,
        'Open File',
        'Open Folder'
      );

      if (action === 'Open File') {
        if (payload.imageData) {
          // Open the image in VS Code
          const uri = vscode.Uri.file(filePath);
          await vscode.commands.executeCommand('vscode.open', uri);
        }
      } else if (action === 'Open Folder') {
        const folderUri = vscode.Uri.file(imgFolder);
        await vscode.commands.executeCommand('revealFileInOS', folderUri);
      }
    } catch (error) {
      console.error('[Claude VS] Failed to save screenshot:', error);
      vscode.window.showErrorMessage(
        `Failed to save screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
   * Handle apply drag changes from webview
   * Writes changes to file and sends to Claude Code terminal
   */
  private async handleApplyDragChanges(message: {
    type: 'apply-drag-changes';
    payload: {
      changes: Array<{
        elementSelector: string;
        originalPosition: { x: number; y: number };
        newPosition: { x: number; y: number };
      }>;
    };
  }): Promise<void> {
    const { changes } = message.payload;

    if (!changes || changes.length === 0) {
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    // Write changes to file
    const outputPath = path.join(workspaceFolders[0].uri.fsPath, '.claude-drag-changes.json');
    const changeData = {
      timestamp: new Date().toISOString(),
      changesCount: changes.length,
      changes: changes.map((change, index) => ({
        index: index + 1,
        selector: change.elementSelector,
        from: `left: ${change.originalPosition.x}px, top: ${change.originalPosition.y}px`,
        to: `left: ${change.newPosition.x}px, top: ${change.newPosition.y}px`,
        deltaX: change.newPosition.x - change.originalPosition.x,
        deltaY: change.newPosition.y - change.originalPosition.y,
      })),
    };

    try {
      fs.writeFileSync(outputPath, JSON.stringify(changeData, null, 2), 'utf-8');

      // Create formatted output for Claude Code terminal with clear CSS instructions
      const cssInstructions = changes.map((change, i) => {
        const deltaX = Math.round(change.newPosition.x - change.originalPosition.x);
        const deltaY = Math.round(change.newPosition.y - change.originalPosition.y);
        return [
          `/* Modifica ${i + 1} */`,
          `${change.elementSelector} {`,
          `  position: relative;`,
          `  left: ${Math.round(change.newPosition.x)}px;`,
          `  top: ${Math.round(change.newPosition.y)}px;`,
          `}`,
        ].join('\n');
      }).join('\n\n');

      const terminalOutput = [
        ``,
        `=== DRAG & DROP CHANGES APPLIED ===`,
        ``,
        `User has visually repositioned ${changes.length} element(s) in the browser preview.`,
        `Please apply the following CSS changes to the source files:`,
        ``,
        `--- CSS TO ADD/MODIFY ---`,
        ``,
        cssInstructions,
        ``,
        `--- DETAILS ---`,
        ...changes.map((change, i) => {
          const deltaX = Math.round(change.newPosition.x - change.originalPosition.x);
          const deltaY = Math.round(change.newPosition.y - change.originalPosition.y);
          return `${i + 1}. ${change.elementSelector}: moved ${deltaX > 0 ? '+' : ''}${deltaX}px horizontal, ${deltaY > 0 ? '+' : ''}${deltaY}px vertical`;
        }),
        ``,
        `Full details saved to: .claude-drag-changes.json`,
        ``,
      ].join('\n');

      // Send directly to active terminal (Claude Code)
      const terminal = vscode.window.activeTerminal;
      if (terminal) {
        terminal.sendText(terminalOutput);
      }

      // Also show VS Code notification
      vscode.window.showInformationMessage(
        `${changes.length} drag change(s) applied. CSS instructions sent to terminal.`
      );

      console.log(`[Claude VS] Drag changes applied: ${changes.length}`);
    } catch (err) {
      console.error('[Claude VS] Failed to write drag changes:', err);
    }
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
