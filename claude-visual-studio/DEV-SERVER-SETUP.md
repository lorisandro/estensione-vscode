# Claude Visual Studio - Development Server Setup

This document describes the local development server infrastructure created for the Claude Visual Studio extension.

## 📁 Created Files

### Core Server Files

1. **`src/extension/server/ServerManager.ts`** (310 lines)
   - Express-based HTTP server
   - Static file serving with MIME type detection
   - Automatic HTML script injection
   - Path traversal protection
   - CORS configuration for webview

2. **`src/extension/server/HMRBridge.ts`** (296 lines)
   - WebSocket server for Hot Module Replacement
   - File system watcher using chokidar
   - Client connection management
   - Broadcast system for file changes
   - Automatic reconnection support

3. **`src/injected-scripts/element-inspector.ts`** (450 lines)
   - Client-side element selection script
   - Mouse hover detection and highlighting
   - Element information extraction
   - CSS selector and XPath generation
   - postMessage communication with parent

### Supporting Files

4. **`src/extension/server/index.ts`**
   - Module exports for easy importing

5. **`src/extension/server/example-usage.ts`** (219 lines)
   - Complete integration example
   - DevServerController class
   - VS Code command implementations
   - Auto-reload on file save

6. **`src/extension/server/test-server.ts`** (99 lines)
   - Standalone test script
   - Can run without VS Code
   - Graceful shutdown handling

### Type Definitions

7. **`src/shared/types/inspector.ts`**
   - ElementInfo interface
   - InspectorMessage interface
   - InspectorAPI interface
   - Global type declarations

8. **`src/shared/types/server.ts`**
   - ServerConfig interface
   - HMRBridgeConfig interface
   - HMRMessage interface
   - ServerStatus interface

9. **`src/shared/types/index.ts`**
   - Central exports for all types

### Documentation

10. **`src/extension/server/README.md`**
    - Component documentation
    - Usage examples
    - API reference
    - Security considerations

### Test Files

11. **`test-page.html`**
    - Interactive demo page
    - Inspector controls
    - Status monitoring
    - Visual examples

12. **`DEV-SERVER-SETUP.md`** (this file)

## 🚀 Quick Start

### Option 1: Run Standalone Test Server

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run test server (serves current directory)
node dist/extension/server/test-server.js

# Or serve specific directory
node dist/extension/server/test-server.js ./path/to/your/project
```

Then open http://localhost:3333 in your browser.

### Option 2: Integrate into Extension

```typescript
import { ServerManager, HMRBridge } from './server';

const serverManager = new ServerManager();
const hmrBridge = new HMRBridge();

// Start servers
await serverManager.start(3333, workspacePath, 3334);
await hmrBridge.start({
  port: 3334,
  rootPath: workspacePath,
});

// Stop servers
await hmrBridge.stop();
await serverManager.stop();
```

See `src/extension/server/example-usage.ts` for complete integration example.

## 🎯 Features

### ServerManager Features

- ✅ Static file serving from any directory
- ✅ Automatic MIME type detection (30+ types)
- ✅ HTML script injection for element inspector
- ✅ HMR client script injection
- ✅ CORS headers for webview access
- ✅ Path traversal security protection
- ✅ Directory index.html fallback
- ✅ Comprehensive error handling

### HMRBridge Features

- ✅ WebSocket server for real-time updates
- ✅ File system watching with chokidar
- ✅ Debounced file changes (300ms stability)
- ✅ Client connection management
- ✅ Broadcast to all connected clients
- ✅ Automatic reconnection support
- ✅ Ping/pong keep-alive
- ✅ Graceful shutdown

### Element Inspector Features

- ✅ Mouse hover element detection
- ✅ Visual element highlighting
- ✅ Click to select elements
- ✅ Extract comprehensive element info:
  - Tag name, ID, classes
  - All attributes
  - Computed styles
  - Inline styles
  - Bounding rectangle
  - XPath
  - CSS selector
  - Parent/children count
- ✅ Toggle selection mode (Escape key)
- ✅ postMessage communication
- ✅ Global API for external control

## 🔌 API Reference

### ServerManager

```typescript
class ServerManager {
  // Start server
  async start(port: number, rootPath: string, hmrScriptPort?: number): Promise<void>

  // Stop server
  async stop(): Promise<void>

  // Check if running
  isRunning(): boolean

  // Get configuration
  getConfig(): ServerConfig | null
}
```

### HMRBridge

```typescript
class HMRBridge {
  // Start WebSocket server
  async start(config: HMRBridgeConfig): Promise<void>

  // Stop WebSocket server
  async stop(): Promise<void>

  // Check if running
  isRunning(): boolean

  // Get connected client count
  getClientCount(): number

  // Manually trigger reload
  triggerReload(fileName?: string): void
}
```

### Element Inspector (Client-side)

```javascript
// Global API (injected into preview iframe)
window.__claudeVSInspector__ = {
  setSelectionMode: (enabled: boolean) => void,
  getSelectedElement: () => ElementInfo | null,
  isSelectionMode: () => boolean
}
```

## 📡 Message Protocols

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

// Client → Server
{
  type: 'ping',
  timestamp: number
}
```

## 🔒 Security

1. **Path Traversal Protection**: All file paths are validated to ensure they stay within the root directory
2. **CORS**: Configured with `Access-Control-Allow-Origin: *` for webview compatibility
3. **Script Injection**: Only trusted scripts from the extension are injected
4. **WebSocket**: Only accepts connections from localhost
5. **Error Handling**: Comprehensive error handling prevents information leakage

## 📊 Performance

- **File Watching**: Debounced with 300ms stability threshold to prevent excessive reloads
- **WebSocket**: Efficient JSON message protocol
- **Static Files**: Streamed directly from disk (no caching overhead)
- **Element Overlay**: GPU-accelerated CSS transitions
- **Message Throttling**: Built-in to prevent message flooding

## 🧪 Testing

### Test the Server

```bash
# Open test page
npm run build
node dist/extension/server/test-server.js
# Then visit http://localhost:3333/test-page.html
```

### Test Element Inspector

1. Open test page in browser
2. Click "Toggle Selection Mode"
3. Hover over elements to see highlighting
4. Click elements to select them
5. Check browser console for element data
6. Press Escape to exit selection mode

### Test HMR

1. Start test server
2. Open test page
3. Edit test-page.html
4. Save the file
5. Browser should auto-reload

## 🔧 Configuration

VS Code settings (add to package.json):

```json
{
  "claudeVisualStudio.serverPort": {
    "type": "number",
    "default": 3333,
    "description": "Port for the local preview server"
  },
  "claudeVisualStudio.autoRefresh": {
    "type": "boolean",
    "default": true,
    "description": "Auto-refresh preview on file save"
  }
}
```

## 📦 Dependencies

Already included in package.json:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.16.0",
    "chokidar": "^3.5.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/ws": "^8.5.10",
    "@types/node": "^20.10.0"
  }
}
```

## 🎨 Architecture

```
┌─────────────────────────────────────────────────────┐
│                  VS Code Extension                  │
│                                                     │
│  ┌──────────────┐         ┌──────────────┐        │
│  │ ServerManager│◄────────┤DevServerCtrl │        │
│  └──────┬───────┘         └──────────────┘        │
│         │                                           │
│  ┌──────▼───────┐                                  │
│  │  HMRBridge   │                                  │
│  └──────────────┘                                  │
└─────────────────────────────────────────────────────┘
         │                    │
         │ HTTP               │ WebSocket
         │ :3333              │ :3334
         ▼                    ▼
┌─────────────────────────────────────────────────────┐
│                Browser Preview                      │
│                                                     │
│  ┌────────────────────────────────────────────┐   │
│  │          Preview IFrame                    │   │
│  │                                            │   │
│  │  ┌──────────────────────────────────┐    │   │
│  │  │   Element Inspector Script       │    │   │
│  │  │   - Hover detection              │    │   │
│  │  │   - Element selection            │    │   │
│  │  │   - Info extraction              │    │   │
│  │  └──────────────────────────────────┘    │   │
│  │                                            │   │
│  │  ┌──────────────────────────────────┐    │   │
│  │  │   HMR Client Script              │    │   │
│  │  │   - WebSocket connection         │    │   │
│  │  │   - Auto reconnect               │    │   │
│  │  │   - Reload on changes            │    │   │
│  │  └──────────────────────────────────┘    │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## 🐛 Troubleshooting

### Port Already in Use

```
Error: Port 3333 is already in use
```

**Solution**: Change the port in VS Code settings or stop the process using that port.

### Inspector Not Loading

**Check**:
1. Browser console for errors
2. Network tab for failed script loads
3. Server logs for file serving errors

**Solution**: Ensure the server is running and the path is correct.

### HMR Not Working

**Check**:
1. WebSocket connection status in browser console
2. File watcher is active (check server logs)
3. File is in watched patterns

**Solution**: Verify WebSocket port is accessible and not blocked by firewall.

## 📝 Notes

- The element inspector script is automatically injected into all HTML responses
- HMR client script is also injected and configured automatically
- Both scripts are loaded asynchronously to not block page rendering
- The server can serve any static web project (React, Vue, vanilla HTML, etc.)
- File watching ignores common directories (node_modules, .git, dist, build)
- All TypeScript files are written with strict type safety

## 🎓 Next Steps

1. Integrate into main extension.ts
2. Create webview panel for preview
3. Add sidebar for element inspector results
4. Implement code editing from selected elements
5. Add screenshot capture functionality
6. Integrate with Claude Code AI

---

**Created**: 2025-12-12
**Extension**: Claude Visual Studio
**Author**: Claude Opus 4.5
