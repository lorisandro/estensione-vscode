/**
 * OpenPreviewCommand - Command handler for opening the visual preview
 *
 * This command is triggered when the user wants to open the visual editor
 * preview panel. It handles file detection, URL generation, and panel creation.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { WebviewPanelProvider } from '../webview/WebviewPanelProvider';

export class OpenPreviewCommand {
  private readonly webviewProvider: WebviewPanelProvider;

  constructor(webviewProvider: WebviewPanelProvider) {
    this.webviewProvider = webviewProvider;
  }

  /**
   * Execute the open preview command
   * Always opens the browser panel - user can navigate manually via URL bar
   */
  public async execute(_uri?: vscode.Uri): Promise<void> {
    try {
      // Always open the browser panel without a specific file
      // This gives users control to navigate where they want
      await this.openBrowserOnly();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open preview: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      console.error('Error in OpenPreviewCommand:', error);
    }
  }

  /**
   * Open just the browser panel without a specific file
   */
  private async openBrowserOnly(): Promise<void> {
    const config = vscode.workspace.getConfiguration('claudeVisualStudio');
    const serverPort = config.get<number>('serverPort', 3333);

    // Create or reveal the webview panel
    await this.webviewProvider.createWebviewPanel(vscode.ViewColumn.Beside);

    // Send navigation to localhost
    await this.webviewProvider.postMessage({
      type: 'requestNavigate',
      payload: {
        url: `http://localhost:${serverPort}`,
        filePath: '',
      },
    });
  }

  /**
   * Open the preview panel for a specific file
   */
  private async openPreview(fileUri: vscode.Uri): Promise<void> {
    // Create or reveal the webview panel
    const panel = await this.webviewProvider.createWebviewPanel(vscode.ViewColumn.Beside);

    // Get the preview URL
    const previewUrl = await this.getPreviewUrl(fileUri);

    // Send navigation message to webview
    await this.webviewProvider.postMessage({
      type: 'requestNavigate',
      payload: {
        url: previewUrl,
        filePath: fileUri.fsPath,
      },
    });

    // Show info message
    vscode.window.showInformationMessage(
      `Preview opened for: ${path.basename(fileUri.fsPath)}`
    );
  }

  /**
   * Get the active editor's URI
   */
  private getActiveEditorUri(): vscode.Uri | undefined {
    const editor = vscode.window.activeTextEditor;
    return editor?.document.uri;
  }

  /**
   * Check if a file is previewable
   */
  private isPreviewableFile(uri: vscode.Uri): boolean {
    const ext = path.extname(uri.fsPath).toLowerCase();
    const supportedExtensions = ['.html', '.htm', '.js', '.jsx', '.ts', '.tsx'];
    return supportedExtensions.includes(ext);
  }

  /**
   * Generate the preview URL for a file
   */
  private async getPreviewUrl(fileUri: vscode.Uri): Promise<string> {
    const config = vscode.workspace.getConfiguration('claudeVisualStudio');
    const serverPort = config.get<number>('serverPort', 3333);
    const ext = path.extname(fileUri.fsPath).toLowerCase();

    // For HTML files, try to serve directly
    if (ext === '.html' || ext === '.htm') {
      return this.getHtmlPreviewUrl(fileUri, serverPort);
    }

    // For JS/TS files, check if there's an associated HTML file
    const associatedHtml = await this.findAssociatedHtmlFile(fileUri);
    if (associatedHtml) {
      return this.getHtmlPreviewUrl(associatedHtml, serverPort);
    }

    // Default: try to find index.html in the workspace
    const indexHtml = await this.findIndexHtml();
    if (indexHtml) {
      return this.getHtmlPreviewUrl(indexHtml, serverPort);
    }

    // Fallback: return localhost URL
    return `http://localhost:${serverPort}`;
  }

  /**
   * Get the preview URL for an HTML file
   */
  private getHtmlPreviewUrl(htmlUri: vscode.Uri, port: number): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(htmlUri);

    if (workspaceFolder) {
      // Calculate relative path from workspace root
      const relativePath = path.relative(workspaceFolder.uri.fsPath, htmlUri.fsPath);
      return `http://localhost:${port}/${relativePath.replace(/\\/g, '/')}`;
    }

    // Fallback: use filename
    return `http://localhost:${port}/${path.basename(htmlUri.fsPath)}`;
  }

  /**
   * Find an associated HTML file for a JS/TS file
   */
  private async findAssociatedHtmlFile(fileUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const dir = path.dirname(fileUri.fsPath);
    const baseName = path.basename(fileUri.fsPath, path.extname(fileUri.fsPath));

    // Look for HTML file with same base name
    const possibleNames = [
      `${baseName}.html`,
      `${baseName}.htm`,
      'index.html',
      'index.htm',
    ];

    for (const name of possibleNames) {
      const htmlPath = path.join(dir, name);
      try {
        const htmlUri = vscode.Uri.file(htmlPath);
        await vscode.workspace.fs.stat(htmlUri);
        return htmlUri;
      } catch {
        // File doesn't exist, continue
      }
    }

    return undefined;
  }

  /**
   * Find index.html in the workspace
   */
  private async findIndexHtml(): Promise<vscode.Uri | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }

    // Search for index.html in common locations
    const commonPaths = [
      'index.html',
      'public/index.html',
      'src/index.html',
      'dist/index.html',
      'build/index.html',
    ];

    for (const folder of workspaceFolders) {
      for (const relativePath of commonPaths) {
        const indexPath = path.join(folder.uri.fsPath, relativePath);
        try {
          const indexUri = vscode.Uri.file(indexPath);
          await vscode.workspace.fs.stat(indexUri);
          return indexUri;
        } catch {
          // File doesn't exist, continue
        }
      }
    }

    // Try searching with glob pattern
    try {
      const files = await vscode.workspace.findFiles('**/index.html', '**/node_modules/**', 1);
      if (files.length > 0) {
        return files[0];
      }
    } catch (error) {
      console.error('Error searching for index.html:', error);
    }

    return undefined;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    // Currently no resources to dispose
  }
}
