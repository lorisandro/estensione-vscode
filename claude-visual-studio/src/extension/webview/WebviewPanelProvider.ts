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
  TextContentChangedMessage,
  InlineStyleChangedMessage,
} from '../../shared/types/MessageTypes';
import { HtmlSourceMapper } from '../utils/HtmlSourceMapper';

export class WebviewPanelProvider {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private state: WebviewState = {};
  private readonly context: vscode.ExtensionContext;
  private pendingRequests: Map<string, (result: any) => void> = new Map();
  private requestId = 0;
  private pendingTerminalMessage: string | null = null;

  // Current source file path for Page Builder text editing
  private currentSourceFilePath: string | null = null;

  // Callback called when webview becomes ready
  public onWebviewReady: (() => void) | undefined;

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
        // Call callback to notify extension
        if (this.onWebviewReady) {
          this.onWebviewReady();
        }
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

      // Handle send-to-claude button click
      case 'send-to-claude':
        this.sendPendingMessageToTerminal();
        break;

      // Handle apply-drag-changes from webview
      case 'apply-drag-changes':
        await this.handleApplyDragChanges(message as any);
        break;

      // Handle apply-css-to-claude from Elementor sidebar
      case 'apply-css-to-claude':
        await this.handleApplyCssToClaudeCode(message as any);
        break;

      // Text Edit Mode (Page Builder) messages
      case 'edit-mode-started':
        console.log('[PageBuilder] Edit mode started:', (message as any).payload?.selector);
        break;

      case 'edit-mode-ended':
        console.log('[PageBuilder] Edit mode ended:', (message as any).payload?.selector, 'saved:', (message as any).payload?.saved);
        break;

      case 'text-content-changed':
        await this.handleTextContentChanged(message as any);
        break;

      case 'inline-style-changed':
        await this.handleInlineStyleChanged(message as any);
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

      // Store formatted output for Claude Code terminal (sent on demand via button)
      this.pendingTerminalMessage = [
        `[ELEMENTO SELEZIONATO]`,
        `Elemento: <${el.tag}>${el.id ? ` id="${el.id}"` : ''}${el.classes.length > 0 ? ` class="${el.classes.slice(0, 3).join(' ')}"` : ''}`,
        sizeStr ? `Dimensioni: ${sizeStr}` : null,
        cleanedText ? `Testo: "${cleanedText}${el.textContent && el.textContent.length > 150 ? '...' : ''}"` : null,
        `Selector: ${el.selector || selectorStr}`,
      ].filter(Boolean).join('\n');

      console.log(`[Claude VS] Element selected: ${selectorStr}`);
    } catch (err) {
      console.error('[Claude VS] Failed to write element info:', err);
    }
  }

  /**
   * Send the pending element selection message to Claude Code terminal
   */
  private sendPendingMessageToTerminal(): void {
    if (!this.pendingTerminalMessage) {
      console.log('[Claude VS] No element selected to send');
      return;
    }

    const terminal = vscode.window.activeTerminal;
    if (terminal) {
      terminal.sendText(this.pendingTerminalMessage);
      console.log('[Claude VS] Sent element to Claude Code terminal');
    } else {
      console.log('[Claude VS] No active terminal found');
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

  // ===========================================
  // PAGE BUILDER TEXT EDITING HANDLERS
  // ===========================================

  /**
   * Set the current source file path for text editing
   */
  public setCurrentSourceFilePath(filePath: string | null): void {
    this.currentSourceFilePath = filePath;
    console.log('[PageBuilder] Source file path set:', filePath);
  }

  /**
   * Get the current source file path
   */
  public getCurrentSourceFilePath(): string | null {
    return this.currentSourceFilePath;
  }

  /**
   * Handle text content change from Page Builder
   * Updates the source HTML file with the new text
   */
  private async handleTextContentChanged(message: {
    type: 'text-content-changed';
    payload: {
      selector: string;
      xpath: string;
      oldText: string;
      newText: string;
    };
  }): Promise<void> {
    const { selector, xpath, oldText, newText } = message.payload;

    console.log('[PageBuilder] Text content changed:', selector);
    console.log('[PageBuilder] Old text:', oldText.substring(0, 50));
    console.log('[PageBuilder] New text:', newText.substring(0, 50));

    // If we have a direct source file path, use it
    if (this.currentSourceFilePath) {
      await this.updateTextInFile(this.currentSourceFilePath, selector, xpath, oldText, newText);
      return;
    }

    // No direct source file - search in workspace for the text
    console.log('[PageBuilder] No source file path, searching in workspace...');

    const matchingFiles = await this.findFilesContainingText(oldText);

    if (matchingFiles.length === 0) {
      console.warn('[PageBuilder] Text not found in any source file');
      vscode.window.showWarningMessage(
        `Could not find "${oldText.substring(0, 30)}..." in any source file. The text might be dynamically generated.`
      );
      return;
    }

    let targetFile: string;

    if (matchingFiles.length === 1) {
      // Only one file contains this text - use it
      targetFile = matchingFiles[0];
      console.log('[PageBuilder] Found text in single file:', targetFile);
    } else {
      // Multiple files contain this text - let user choose
      console.log('[PageBuilder] Found text in multiple files:', matchingFiles.length);
      const picked = await vscode.window.showQuickPick(
        matchingFiles.map(f => ({
          label: path.basename(f),
          description: vscode.workspace.asRelativePath(f),
          filePath: f
        })),
        {
          placeHolder: `Select the file to update (${matchingFiles.length} files contain this text)`,
          title: 'Multiple files found'
        }
      );

      if (!picked) {
        console.log('[PageBuilder] User cancelled file selection');
        return;
      }
      targetFile = picked.filePath;
    }

    await this.updateTextInSourceFile(targetFile, oldText, newText);
  }

  /**
   * Find files in workspace containing the specified text
   */
  private async findFilesContainingText(text: string): Promise<string[]> {
    const matchingFiles: string[] = [];

    // Search in common source file types
    const patterns = [
      '**/*.tsx',
      '**/*.jsx',
      '**/*.ts',
      '**/*.js',
      '**/*.html',
      '**/*.htm',
      '**/*.vue',
      '**/*.svelte'
    ];

    // Exclude common non-source directories
    const excludePattern = '{**/node_modules/**,**/.next/**,**/dist/**,**/build/**,**/.git/**}';

    for (const pattern of patterns) {
      const files = await vscode.workspace.findFiles(pattern, excludePattern, 100);

      for (const file of files) {
        try {
          const content = await vscode.workspace.fs.readFile(file);
          const textContent = new TextDecoder().decode(content);

          // Check if file contains the exact text
          if (textContent.includes(text)) {
            matchingFiles.push(file.fsPath);
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }

    return matchingFiles;
  }

  /**
   * Update text directly in a source file (for JSX/TSX/JS files)
   */
  private async updateTextInSourceFile(filePath: string, oldText: string, newText: string): Promise<void> {
    try {
      const fileUri = vscode.Uri.file(filePath);
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      const content = new TextDecoder().decode(fileContent);

      // Find all occurrences of the text
      const occurrences = this.findAllOccurrences(content, oldText);

      if (occurrences.length === 0) {
        console.warn('[PageBuilder] Text not found in file');
        vscode.window.showWarningMessage('Text not found in file. It may have been modified.');
        return;
      }

      let selectedIndex: number;

      if (occurrences.length === 1) {
        // Only one occurrence - use it directly
        selectedIndex = occurrences[0].index;
        console.log('[PageBuilder] Single occurrence found at index:', selectedIndex);
      } else {
        // Multiple occurrences - let user choose which one
        console.log('[PageBuilder] Multiple occurrences found:', occurrences.length);

        const lines = content.split('\n');
        const items = occurrences.map((occ, i) => {
          // Find line number and context
          let charCount = 0;
          let lineNum = 0;
          for (let j = 0; j < lines.length; j++) {
            if (charCount + lines[j].length >= occ.index) {
              lineNum = j + 1;
              break;
            }
            charCount += lines[j].length + 1; // +1 for newline
          }

          const contextLine = lines[lineNum - 1] || '';
          const trimmedContext = contextLine.trim().substring(0, 80);

          return {
            label: `Line ${lineNum}: ${trimmedContext}${contextLine.length > 80 ? '...' : ''}`,
            description: `Occurrence ${i + 1} of ${occurrences.length}`,
            index: occ.index,
            lineNum
          };
        });

        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: `Select which occurrence to replace (${occurrences.length} found)`,
          title: `Replace "${oldText.substring(0, 30)}${oldText.length > 30 ? '...' : ''}"`
        });

        if (!picked) {
          console.log('[PageBuilder] User cancelled occurrence selection');
          return;
        }
        selectedIndex = picked.index;
      }

      // Replace only the selected occurrence
      const updatedContent =
        content.substring(0, selectedIndex) +
        newText +
        content.substring(selectedIndex + oldText.length);

      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(fileUri, encoder.encode(updatedContent));

      console.log('[PageBuilder] Text updated in file:', path.basename(filePath));
      vscode.window.setStatusBarMessage(`Text updated in ${path.basename(filePath)}`, 3000);

      // Show the file to the user and highlight the change
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });

      // Calculate position and select the new text
      const pos = doc.positionAt(selectedIndex);
      const endPos = doc.positionAt(selectedIndex + newText.length);
      editor.selection = new vscode.Selection(pos, endPos);
      editor.revealRange(new vscode.Range(pos, endPos), vscode.TextEditorRevealType.InCenter);

    } catch (error) {
      console.error('[PageBuilder] Error updating source file:', error);
      vscode.window.showErrorMessage(
        `Failed to update file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find all occurrences of a text in content
   */
  private findAllOccurrences(content: string, text: string): Array<{ index: number }> {
    const occurrences: Array<{ index: number }> = [];
    let startIndex = 0;

    while (true) {
      const index = content.indexOf(text, startIndex);
      if (index === -1) break;
      occurrences.push({ index });
      startIndex = index + 1;
    }

    return occurrences;
  }

  /**
   * Update text in an HTML file using HtmlSourceMapper
   */
  private async updateTextInFile(
    filePath: string,
    selector: string,
    xpath: string,
    oldText: string,
    newText: string
  ): Promise<void> {
    try {
      // Read the current file content
      const fileUri = vscode.Uri.file(filePath);
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      const htmlContent = new TextDecoder().decode(fileContent);

      // Use HtmlSourceMapper to update the text content
      const updatedContent = HtmlSourceMapper.updateTextContent(
        htmlContent,
        selector,
        xpath,
        oldText,
        newText
      );

      if (updatedContent) {
        // Write the updated content back to the file
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(fileUri, encoder.encode(updatedContent));

        console.log('[PageBuilder] Text updated in file:', path.basename(filePath));
        vscode.window.setStatusBarMessage(`Text updated in ${path.basename(filePath)}`, 3000);
      } else {
        console.warn('[PageBuilder] Could not find element in source file');
        vscode.window.showWarningMessage('Could not find element in source file. Manual update may be required.');
      }
    } catch (error) {
      console.error('[PageBuilder] Error updating text:', error);
      vscode.window.showErrorMessage(
        `Failed to update text: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle inline style change from Page Builder
   * Updates the source HTML file with the new style
   */
  private async handleInlineStyleChanged(message: {
    type: 'inline-style-changed';
    payload: {
      selector: string;
      xpath: string;
      property: string;
      value: string;
    };
  }): Promise<void> {
    const { selector, xpath, property, value } = message.payload;

    console.log('[PageBuilder] Inline style changed:', selector, property, '=', value);

    if (!this.currentSourceFilePath) {
      console.warn('[PageBuilder] No source file path set, cannot update file');
      return;
    }

    try {
      // Read the current file content
      const fileUri = vscode.Uri.file(this.currentSourceFilePath);
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      const htmlContent = new TextDecoder().decode(fileContent);

      // Use HtmlSourceMapper to update the inline style
      const updatedContent = HtmlSourceMapper.updateInlineStyle(
        htmlContent,
        selector,
        xpath,
        property,
        value
      );

      if (updatedContent) {
        // Write the updated content back to the file
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(fileUri, encoder.encode(updatedContent));

        console.log('[PageBuilder] Style updated in file:', path.basename(this.currentSourceFilePath));
        vscode.window.setStatusBarMessage(`Style updated: ${property}`, 2000);
      } else {
        console.warn('[PageBuilder] Could not find element for style update');
      }
    } catch (error) {
      console.error('[PageBuilder] Error updating style:', error);
      vscode.window.showErrorMessage(
        `Failed to update style: ${error instanceof Error ? error.message : 'Unknown error'}`
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
        changeType?: 'move' | 'move-into' | 'resize';
        originalPosition?: { x: number; y: number };
        newPosition?: { x: number; y: number };
        originalWidth?: number;
        originalHeight?: number;
        newWidth?: number;
        newHeight?: number;
        action?: 'move' | 'move-into';
        targetSelector?: string;
        containerSelector?: string;
        position?: 'before' | 'after';
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

    // Separate resize and move changes
    const resizeChanges = changes.filter(c => c.changeType === 'resize');
    const moveChanges = changes.filter(c => c.changeType !== 'resize');

    // Write changes to file
    const outputPath = path.join(workspaceFolders[0].uri.fsPath, '.claude-visual-changes.json');
    const changeData = {
      timestamp: new Date().toISOString(),
      changesCount: changes.length,
      resizeChanges: resizeChanges.map((change, index) => ({
        index: index + 1,
        selector: change.elementSelector,
        type: 'resize',
        from: `${change.originalWidth}x${change.originalHeight}`,
        to: `${change.newWidth}x${change.newHeight}`,
      })),
      moveChanges: moveChanges.map((change, index) => ({
        index: index + 1,
        selector: change.elementSelector,
        type: change.changeType || 'move',
        from: change.originalPosition ? `left: ${change.originalPosition.x}px, top: ${change.originalPosition.y}px` : null,
        to: change.newPosition ? `left: ${change.newPosition.x}px, top: ${change.newPosition.y}px` : null,
      })),
    };

    try {
      fs.writeFileSync(outputPath, JSON.stringify(changeData, null, 2), 'utf-8');

      // Create formatted output for Claude Code terminal
      const cssInstructions: string[] = [];

      // Generate CSS for resize changes
      resizeChanges.forEach((change, i) => {
        cssInstructions.push([
          `/* Resize ${i + 1} */`,
          `${change.elementSelector} {`,
          `  width: ${change.newWidth}px;`,
          `  height: ${change.newHeight}px;`,
          `}`,
        ].join('\n'));
      });

      // Generate CSS for move changes
      moveChanges.forEach((change, i) => {
        if (change.newPosition) {
          cssInstructions.push([
            `/* Move ${i + 1} */`,
            `${change.elementSelector} {`,
            `  position: relative;`,
            `  left: ${Math.round(change.newPosition.x)}px;`,
            `  top: ${Math.round(change.newPosition.y)}px;`,
            `}`,
          ].join('\n'));
        }
      });

      // Build terminal output
      const outputLines: string[] = [
        ``,
        `=== VISUAL CHANGES APPLIED ===`,
        ``,
        `User has visually modified ${changes.length} element(s) in the browser preview.`,
      ];

      if (resizeChanges.length > 0) {
        outputLines.push(`- ${resizeChanges.length} resize operation(s)`);
      }
      if (moveChanges.length > 0) {
        outputLines.push(`- ${moveChanges.length} move operation(s)`);
      }

      outputLines.push(
        ``,
        `Please apply the following CSS changes to the source files:`,
        ``,
        `--- CSS TO ADD/MODIFY ---`,
        ``,
        cssInstructions.join('\n\n'),
        ``,
        `--- DETAILS ---`,
      );

      // Add resize details
      resizeChanges.forEach((change, i) => {
        const widthDiff = (change.newWidth || 0) - (change.originalWidth || 0);
        const heightDiff = (change.newHeight || 0) - (change.originalHeight || 0);
        outputLines.push(
          `${i + 1}. ${change.elementSelector}: resized from ${change.originalWidth}x${change.originalHeight} to ${change.newWidth}x${change.newHeight} (${widthDiff > 0 ? '+' : ''}${widthDiff}w, ${heightDiff > 0 ? '+' : ''}${heightDiff}h)`
        );
      });

      // Add move details
      moveChanges.forEach((change, i) => {
        if (change.originalPosition && change.newPosition) {
          const deltaX = Math.round(change.newPosition.x - change.originalPosition.x);
          const deltaY = Math.round(change.newPosition.y - change.originalPosition.y);
          outputLines.push(
            `${resizeChanges.length + i + 1}. ${change.elementSelector}: moved ${deltaX > 0 ? '+' : ''}${deltaX}px horizontal, ${deltaY > 0 ? '+' : ''}${deltaY}px vertical`
          );
        }
      });

      outputLines.push(
        ``,
        `Full details saved to: .claude-visual-changes.json`,
        ``
      );

      const terminalOutput = outputLines.join('\n');

      // Send directly to active terminal (Claude Code)
      const terminal = vscode.window.activeTerminal;
      if (terminal) {
        terminal.sendText(terminalOutput);
      }

      // Also show VS Code notification
      const changeTypes = [];
      if (resizeChanges.length > 0) changeTypes.push(`${resizeChanges.length} resize`);
      if (moveChanges.length > 0) changeTypes.push(`${moveChanges.length} move`);

      vscode.window.showInformationMessage(
        `${changeTypes.join(', ')} change(s) applied. CSS instructions sent to terminal.`
      );

      console.log(`[Claude VS] Visual changes applied: ${changes.length} (${resizeChanges.length} resize, ${moveChanges.length} move)`);
    } catch (err) {
      console.error('[Claude VS] Failed to write visual changes:', err);
    }
  }

  /**
   * Handle CSS changes from Elementor sidebar
   * Sends formatted instructions to Claude Code terminal
   */
  private async handleApplyCssToClaudeCode(message: {
    type: 'apply-css-to-claude';
    payload: {
      changes: Array<{
        elementSelector: string;
        elementTagName: string;
        property: string;
        originalValue: string;
        newValue: string;
      }>;
      prompt: string;
    };
  }): Promise<void> {
    const { changes, prompt } = message.payload;

    if (!changes || changes.length === 0) {
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('No workspace folder open.');
      return;
    }

    // Write changes to file for reference
    const outputPath = path.join(workspaceFolders[0].uri.fsPath, '.claude-css-changes.json');
    const changeData = {
      timestamp: new Date().toISOString(),
      changesCount: changes.length,
      changes: changes.map((change, index) => ({
        index: index + 1,
        selector: change.elementSelector,
        tag: change.elementTagName,
        property: change.property,
        from: change.originalValue || 'unset',
        to: change.newValue,
      })),
    };

    try {
      fs.writeFileSync(outputPath, JSON.stringify(changeData, null, 2), 'utf-8');

      // Group changes by element for cleaner CSS output
      const changesBySelector: Record<string, Array<{ property: string; value: string }>> = {};
      for (const change of changes) {
        if (!changesBySelector[change.elementSelector]) {
          changesBySelector[change.elementSelector] = [];
        }
        changesBySelector[change.elementSelector].push({
          property: change.property,
          value: change.newValue,
        });
      }

      // Create CSS-formatted output
      const cssOutput = Object.entries(changesBySelector).map(([selector, props]) => {
        const cssProps = props.map(p => `  ${p.property}: ${p.value};`).join('\n');
        return `${selector} {\n${cssProps}\n}`;
      }).join('\n\n');

      // Create formatted terminal output
      const terminalOutput = [
        ``,
        `=== CSS STYLE CHANGES FROM VISUAL EDITOR ===`,
        ``,
        `The user has visually edited ${changes.length} CSS propert${changes.length === 1 ? 'y' : 'ies'} using the Elementor panel.`,
        `Please apply these changes to the appropriate CSS/HTML file:`,
        ``,
        `--- CSS TO APPLY ---`,
        ``,
        cssOutput,
        ``,
        `--- CHANGE DETAILS ---`,
        ...changes.map((change, i) =>
          `${i + 1}. ${change.elementTagName} (${change.elementSelector}): ${change.property}: ${change.originalValue || 'unset'} -> ${change.newValue}`
        ),
        ``,
        `Full details saved to: .claude-css-changes.json`,
        ``,
        `Please find the element(s) in the source files and update the styles accordingly.`,
        ``,
      ].join('\n');

      // Send to active terminal (Claude Code)
      const terminal = vscode.window.activeTerminal;
      if (terminal) {
        terminal.sendText(terminalOutput);
        console.log('[Claude VS] CSS changes sent to Claude Code terminal');
      } else {
        // No active terminal - show message to user
        vscode.window.showWarningMessage(
          'No active terminal found. Please open Claude Code and try again.',
          'Copy to Clipboard'
        ).then(action => {
          if (action === 'Copy to Clipboard') {
            vscode.env.clipboard.writeText(terminalOutput);
            vscode.window.showInformationMessage('CSS changes copied to clipboard');
          }
        });
      }

      // Show success notification
      vscode.window.showInformationMessage(
        `${changes.length} CSS change(s) sent to Claude Code.`
      );

      console.log(`[Claude VS] CSS changes applied: ${changes.length}`);
    } catch (err) {
      console.error('[Claude VS] Failed to send CSS changes:', err);
      vscode.window.showErrorMessage('Failed to send CSS changes to Claude Code.');
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
