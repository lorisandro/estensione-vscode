# Claude Visual Studio - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VS Code Extension                           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Extension Host (Node.js)                   │  │
│  │                                                               │  │
│  │  ┌─────────────────┐        ┌──────────────────┐           │  │
│  │  │  ServerManager  │        │    HMRBridge     │           │  │
│  │  │                 │        │                  │           │  │
│  │  │  • HTTP Server  │        │  • WebSocket     │           │  │
│  │  │  • MIME types   │        │  • File watcher  │           │  │
│  │  │  • Injection    │        │  • Broadcasting  │           │  │
│  │  └────────┬────────┘        └────────┬─────────┘           │  │
│  │           │                          │                      │  │
│  │           │ :3333                    │ :3334                │  │
│  └───────────┼──────────────────────────┼──────────────────────┘  │
│              │                          │                         │
└──────────────┼──────────────────────────┼─────────────────────────┘
               │                          │
               │ HTTP                     │ WebSocket
               │                          │
┌──────────────┼──────────────────────────┼─────────────────────────┐
│              ▼                          ▼                         │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                    Webview Panel (Browser)                 │   │
│  │                                                            │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │            React Application                      │    │   │
│  │  │                                                   │    │   │
│  │  │  • NavigationBar  • BrowserFrame                 │    │   │
│  │  │  • ElementInspector                              │    │   │
│  │  │  • State Management (Zustand)                    │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                            │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │            Preview IFrame                         │    │   │
│  │  │                                                   │    │   │
│  │  │  ┌────────────────────────────────────────┐     │    │   │
│  │  │  │     User's Web Application             │     │    │   │
│  │  │  │     (HTML, CSS, JS, React, Vue, etc.)  │     │    │   │
│  │  │  └────────────────────────────────────────┘     │    │   │
│  │  │                                                   │    │   │
│  │  │  ┌────────────────────────────────────────┐     │    │   │
│  │  │  │     Element Inspector Script           │     │    │   │
│  │  │  │     • Mouse hover detection            │     │    │   │
│  │  │  │     • Element highlighting             │     │    │   │
│  │  │  │     • Info extraction                  │     │    │   │
│  │  │  │     • postMessage to parent            │     │    │   │
│  │  │  └────────────────────────────────────────┘     │    │   │
│  │  │                                                   │    │   │
│  │  │  ┌────────────────────────────────────────┐     │    │   │
│  │  │  │     HMR Client Script                  │     │    │   │
│  │  │  │     • WebSocket connection             │     │    │   │
│  │  │  │     • Auto reconnect                   │     │    │   │
│  │  │  │     • Reload on file changes           │     │    │   │
│  │  │  └────────────────────────────────────────┘     │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └───────────────────────────────────────────────────────────┘   │
│                        Browser Window                            │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Element Selection Flow

```
User Hovers Over Element
         │
         ▼
┌────────────────────────┐
│  element-inspector.ts  │
│  (In Preview IFrame)   │
│                        │
│  • Detect mousemove    │
│  • Get element info    │
│  • Highlight element   │
└───────────┬────────────┘
            │
            │ postMessage
            ▼
┌────────────────────────┐
│   BrowserFrame.tsx     │
│   (React Component)    │
│                        │
│  • Receive message     │
│  • Parse element info  │
└───────────┬────────────┘
            │
            │ setState
            ▼
┌────────────────────────┐
│ useSelectionStore      │
│ (Zustand State)        │
│                        │
│  • Store element data  │
└───────────┬────────────┘
            │
            │ subscribe
            ▼
┌────────────────────────┐
│  ElementInspector.tsx  │
│  (React Component)     │
│                        │
│  • Display info        │
│  • Show styles         │
│  • Show attributes     │
└────────────────────────┘
```

### 2. Hot Module Replacement Flow

```
User Saves File
         │
         ▼
┌────────────────────────┐
│     File System        │
│                        │
│  • File modified       │
└───────────┬────────────┘
            │
            │ fs event
            ▼
┌────────────────────────┐
│    HMRBridge.ts        │
│    (Chokidar)          │
│                        │
│  • Detect change       │
│  • Debounce (300ms)    │
└───────────┬────────────┘
            │
            │ WebSocket
            ▼
┌────────────────────────┐
│   HMR Client Script    │
│   (In Preview IFrame)  │
│                        │
│  • Receive message     │
│  • Parse file path     │
└───────────┬────────────┘
            │
            │ window.location.reload()
            ▼
┌────────────────────────┐
│    Preview Reloads     │
│                        │
│  • Fresh content       │
│  • Scripts re-injected │
└────────────────────────┘
```

### 3. Server Request Flow

```
Browser Requests File
         │
         ▼
┌────────────────────────┐
│   ServerManager.ts     │
│   (Express Server)     │
│                        │
│  • Parse URL           │
│  • Validate path       │
└───────────┬────────────┘
            │
            │ resolveFilePath()
            ▼
┌────────────────────────┐
│   File System          │
│                        │
│  • Check existence     │
│  • Check security      │
│  • Read file           │
└───────────┬────────────┘
            │
            │ file content
            ▼
┌────────────────────────┐
│   ServerManager.ts     │
│                        │
│  • Detect MIME type    │
│  • Inject scripts?     │
│  • Set headers         │
└───────────┬────────────┘
            │
            │ HTTP Response
            ▼
┌────────────────────────┐
│   Browser              │
│                        │
│  • Render HTML         │
│  • Execute scripts     │
└────────────────────────┘
```

## Component Responsibilities

### Extension Components

#### ServerManager (src/extension/server/ServerManager.ts)
- **Responsibility**: Serve static files via HTTP
- **Input**: Port number, root path
- **Output**: HTTP responses with proper MIME types
- **Key Features**:
  - 30+ MIME type mappings
  - HTML script injection
  - Path traversal protection
  - CORS headers

#### HMRBridge (src/extension/server/HMRBridge.ts)
- **Responsibility**: Watch files and notify clients
- **Input**: Watch patterns, root path
- **Output**: WebSocket messages on file changes
- **Key Features**:
  - Chokidar file watcher
  - WebSocket server
  - Client connection management
  - Debounced file changes

### Injected Scripts

#### element-inspector.ts (src/injected-scripts/element-inspector.ts)
- **Responsibility**: Enable element selection in preview
- **Input**: Mouse events, keyboard events
- **Output**: postMessage with element info
- **Key Features**:
  - Hover detection
  - Visual highlighting
  - Info extraction (30+ properties)
  - XPath/CSS selector generation

#### HMR Client (Injected inline)
- **Responsibility**: Auto-reload on file changes
- **Input**: WebSocket messages
- **Output**: Page reload
- **Key Features**:
  - WebSocket connection
  - Auto reconnection
  - Message handling

### React Components

#### BrowserFrame (src/webview-ui/components/browser/BrowserFrame.tsx)
- **Responsibility**: Host preview iframe
- **Input**: URL from navigation
- **Output**: Rendered preview
- **Key Features**:
  - IFrame management
  - postMessage handling
  - Loading states

#### ElementInspector (src/webview-ui/components/ElementInspector.tsx)
- **Responsibility**: Display element information
- **Input**: Selected element from state
- **Output**: Formatted display
- **Key Features**:
  - Styles display
  - Attributes display
  - Position info

#### NavigationBar (src/webview-ui/components/browser/NavigationBar.tsx)
- **Responsibility**: Browser-like navigation
- **Input**: User interactions
- **Output**: URL changes
- **Key Features**:
  - Back/forward buttons
  - URL input
  - Refresh button
  - Selection toggle

## State Management

### Zustand Stores

```typescript
// Navigation State
useNavigationStore {
  url: string
  history: string[]
  historyIndex: number
  canGoBack: boolean
  canGoForward: boolean
}

// Selection State
useSelectionStore {
  isSelectionMode: boolean
  hoveredElement: ElementInfo | null
  selectedElement: ElementInfo | null
}

// Editor State
useEditorStore {
  isLoading: boolean
  error: string | null
  inspectorWidth: number
}
```

## Message Protocol

### Inspector Messages (postMessage)

```typescript
interface InspectorMessage {
  source: 'claude-vs-inspector'
  type: 'element-hover' | 'element-select' | 'inspector-ready' | 'selection-mode-changed'
  data?: ElementInfo | boolean
  timestamp: number
}
```

### HMR Messages (WebSocket)

```typescript
interface HMRMessage {
  type: 'file-changed' | 'connected' | 'ping'
  file?: string
  timestamp: number
}
```

## Security Model

### Path Traversal Protection

```typescript
// ServerManager validates all paths
const normalizedPath = path.normalize(filePath);
const normalizedRoot = path.normalize(rootPath);

if (!normalizedPath.startsWith(normalizedRoot)) {
  // Reject request
}
```

### CORS Configuration

```typescript
// Allow webview access
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
```

### Script Injection

```typescript
// Only inject trusted scripts
const inspectorScript = `
  <script src="http://localhost:${port}/__claude-vs__/element-inspector.js"></script>
`;
```

## File Organization

```
claude-visual-studio/
│
├── src/
│   ├── extension/              # Extension host (Node.js)
│   │   ├── server/
│   │   │   ├── ServerManager.ts    # HTTP server
│   │   │   ├── HMRBridge.ts        # WebSocket HMR
│   │   │   ├── index.ts            # Exports
│   │   │   ├── example-usage.ts    # Integration example
│   │   │   ├── test-server.ts      # Standalone test
│   │   │   └── README.md           # Documentation
│   │   └── index.ts                # Extension entry
│   │
│   ├── webview-ui/             # Webview (React)
│   │   ├── components/
│   │   │   ├── browser/
│   │   │   │   ├── BrowserFrame.tsx
│   │   │   │   ├── NavigationBar.tsx
│   │   │   │   └── SelectionOverlay.tsx
│   │   │   └── ElementInspector.tsx
│   │   ├── state/
│   │   │   └── stores.ts           # Zustand stores
│   │   ├── hooks/
│   │   │   └── useVSCodeApi.ts     # VS Code API
│   │   ├── main.tsx                # Entry point
│   │   └── App.tsx                 # Main layout
│   │
│   ├── injected-scripts/       # Client-side injection
│   │   └── element-inspector.ts    # Element selection
│   │
│   └── shared/                 # Shared code
│       └── types/
│           ├── inspector.ts        # Inspector types
│           ├── server.ts           # Server types
│           └── index.ts            # Exports
│
├── dist/                       # Compiled output
│   ├── extension/
│   │   └── index.js
│   └── webview/
│       ├── index.html
│       └── assets/
│
├── test-page.html              # Test/demo page
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript config
├── vite.config.ts              # Vite config
│
└── Documentation
    ├── QUICK-START.md          # Quick start guide
    ├── DEV-SERVER-SETUP.md     # Server setup guide
    ├── FILE-SUMMARY.md         # File overview
    └── ARCHITECTURE.md         # This file
```

## Technology Stack

- **Extension Host**: Node.js, TypeScript, Express, ws, chokidar
- **Webview**: React, TypeScript, Zustand, Vite
- **Build**: esbuild (extension), Vite (webview)
- **Runtime**: VS Code Extension API

## Performance Considerations

1. **File Watching**: Debounced 300ms to prevent excessive reloads
2. **WebSocket**: Efficient JSON protocol, keep-alive ping/pong
3. **React**: Zustand for minimal re-renders
4. **Static Files**: Streamed directly, no caching overhead
5. **Element Overlay**: CSS transitions, GPU-accelerated

## Future Enhancements

- [ ] Screenshot capture
- [ ] Element editing from inspector
- [ ] AI-powered suggestions
- [ ] Custom overlay styles
- [ ] Multi-device preview
- [ ] Network request monitoring
- [ ] Console log display
- [ ] Breakpoint debugging

---

**Last Updated**: 2025-12-12
**Version**: 0.1.0
