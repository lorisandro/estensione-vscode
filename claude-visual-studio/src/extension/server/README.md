# Development Server Module

This module provides a local development server infrastructure for the Claude Visual Studio extension.

## Components

### 1. ServerManager
Express-based HTTP server that:
- Serves static files from any directory
- Automatically injects element inspector script into HTML files
- Provides proper MIME type handling
- Includes CORS headers for webview compatibility
- Handles special routes for extension scripts

### 2. HMRBridge
WebSocket server for Hot Module Replacement that:
- Watches files for changes using chokidar
- Broadcasts file change events to connected clients
- Handles WebSocket connection lifecycle
- Provides automatic reconnection logic

### 3. element-inspector.ts
Client-side script that enables element selection:
- Detects mouse hover and click events
- Highlights elements with overlay
- Extracts detailed element information (styles, attributes, position)
- Sends data to parent window via postMessage
- Toggles selection mode via global API

## Usage Example

```typescript
import { ServerManager, HMRBridge } from './server';
import * as vscode from 'vscode';
import * as path from 'path';

// Initialize servers
const serverManager = new ServerManager();
const hmrBridge = new HMRBridge();

async function startDevServer(workspaceFolder: string) {
  try {
    // Get configuration
    const config = vscode.workspace.getConfiguration('claudeVisualStudio');
    const port = config.get<number>('serverPort', 3333);
    const hmrPort = port + 1;

    // Start HTTP server
    await serverManager.start(port, workspaceFolder, hmrPort);
    console.log(`Server running at http://localhost:${port}`);

    // Start HMR WebSocket server
    await hmrBridge.start({
      port: hmrPort,
      rootPath: workspaceFolder,
      watchPatterns: ['**/*.html', '**/*.css', '**/*.js'],
    });
    console.log(`HMR WebSocket running on port ${hmrPort}`);

    return { port, hmrPort };
  } catch (error) {
    console.error('Failed to start servers:', error);
    throw error;
  }
}

async function stopDevServer() {
  try {
    await hmrBridge.stop();
    await serverManager.stop();
    console.log('Servers stopped');
  } catch (error) {
    console.error('Error stopping servers:', error);
  }
}

// Usage in extension activation
export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (workspaceFolder) {
    const { port, hmrPort } = await startDevServer(workspaceFolder);

    // Register cleanup
    context.subscriptions.push({
      dispose: stopDevServer,
    });

    // Open preview in webview
    // The preview will automatically connect to HMR and load the inspector
  }
}
```

## Element Inspector API

The element inspector script exposes a global API:

```javascript
// In the preview iframe
window.__claudeVSInspector__.setSelectionMode(true);  // Enable selection
window.__claudeVSInspector__.setSelectionMode(false); // Disable selection
window.__claudeVSInspector__.isSelectionMode();       // Check if enabled
window.__claudeVSInspector__.getSelectedElement();    // Get selected element info
```

## Message Protocol

### Inspector → Parent (postMessage)

```typescript
{
  source: 'claude-vs-inspector',
  type: 'element-hover' | 'element-select' | 'inspector-ready' | 'selection-mode-changed',
  data?: ElementInfo | boolean,
  timestamp: number
}
```

### HMR WebSocket Messages

```typescript
// Server → Client
{
  type: 'file-changed' | 'connected',
  file?: string,
  timestamp: number
}

// Client → Server (ping/keep-alive)
{
  type: 'ping',
  timestamp: number
}
```

## File Structure

```
src/extension/server/
├── ServerManager.ts      # HTTP server with static file serving
├── HMRBridge.ts         # WebSocket server for HMR
├── index.ts             # Module exports
└── README.md            # This file

src/injected-scripts/
└── element-inspector.ts # Client-side inspector script
```

## Configuration

Server settings can be configured via VS Code settings:

```json
{
  "claudeVisualStudio.serverPort": 3333,
  "claudeVisualStudio.autoRefresh": true
}
```

## Security Considerations

1. **Path Traversal Protection**: ServerManager validates all file paths to prevent directory traversal attacks
2. **CORS**: Configured for webview access only
3. **Script Injection**: Only injects trusted scripts from the extension
4. **WebSocket**: Only accepts connections from localhost

## Error Handling

Both servers provide comprehensive error handling:
- Port already in use detection
- File not found handling
- WebSocket connection errors
- File watcher errors
- Graceful shutdown

## Performance

- **File Watching**: Debounced with 300ms stability threshold
- **WebSocket**: Efficient binary message protocol
- **Static Files**: Streamed directly from disk
- **Overlay**: GPU-accelerated CSS transitions
