/**
 * SidebarViewProvider - Provides the sidebar webview
 *
 * This shows in the activity bar and provides quick access
 * to open the main preview panel
 */

import * as vscode from 'vscode';
import * as path from 'path';

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudeVisualStudio.welcome';

  private view?: vscode.WebviewView;
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'dist')),
      ],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Handle messages from the sidebar webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'openPreview':
          await vscode.commands.executeCommand('claudeVisualStudio.openPreview');
          break;
        case 'openSettings':
          await vscode.commands.executeCommand('workbench.action.openSettings', 'claudeVisualStudio');
          break;
      }
    });
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}';">
  <title>Claude Visual Studio</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      padding: 16px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
    }
    h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--vscode-sideBarTitle-foreground);
    }
    p {
      font-size: 12px;
      line-height: 1.5;
      margin-bottom: 16px;
      color: var(--vscode-descriptionForeground);
    }
    .btn {
      display: block;
      width: 100%;
      padding: 8px 12px;
      margin-bottom: 8px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      text-align: center;
      transition: background-color 0.1s;
    }
    .btn-primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    .features {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .feature-icon {
      margin-right: 8px;
      flex-shrink: 0;
    }
    .shortcuts {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
    }
    .shortcut {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 11px;
    }
    .shortcut-key {
      background-color: var(--vscode-keybindingLabel-background);
      border: 1px solid var(--vscode-keybindingLabel-border);
      border-radius: 3px;
      padding: 2px 6px;
      font-family: monospace;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <h2>Claude Visual Studio</h2>
  <p>Visual web editor with browser preview, element selection, and AI integration.</p>

  <button class="btn btn-primary" id="openPreviewBtn">
    Open Visual Preview
  </button>
  <button class="btn btn-secondary" id="settingsBtn">
    Settings
  </button>

  <div class="features">
    <h2>Features</h2>
    <div class="feature-item">
      <span class="feature-icon">&#x1F310;</span>
      <span>Live browser preview in VSCode</span>
    </div>
    <div class="feature-item">
      <span class="feature-icon">&#x1F50D;</span>
      <span>Click to select any element</span>
    </div>
    <div class="feature-item">
      <span class="feature-icon">&#x1F4DD;</span>
      <span>Edit styles visually</span>
    </div>
    <div class="feature-item">
      <span class="feature-icon">&#x1F916;</span>
      <span>Claude Code AI integration</span>
    </div>
  </div>

  <div class="shortcuts">
    <h2>Keyboard Shortcuts</h2>
    <div class="shortcut">
      <span>Open Preview</span>
      <span class="shortcut-key">Ctrl+Shift+V</span>
    </div>
    <div class="shortcut">
      <span>Toggle Selection</span>
      <span class="shortcut-key">Ctrl+Shift+S</span>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('openPreviewBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'openPreview' });
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'openSettings' });
    });
  </script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
