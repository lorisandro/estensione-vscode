# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Rules

**Auto commit & push**: After every prompt that modifies files, automatically create a git commit and push to remote. Do not ask for confirmation.

## Repository Overview

This repository contains **Claude Visual Studio**, a VS Code extension that provides a visual web editor with browser preview, element selection, and Claude Code AI integration. The extension allows users to preview HTML/web content directly in VS Code with live element inspection capabilities.

## Build & Development Commands

```bash
# Install dependencies
cd claude-visual-studio && npm install

# Build everything (extension + webview)
npm run build

# Build components separately
npm run build:extension    # Builds VS Code extension (esbuild)
npm run build:webview      # Builds React webview (Vite)

# Development with watch mode
npm run watch             # Watch both extension and webview
npm run watch:extension   # Watch extension only
npm run watch:webview     # Watch webview only

# Run development server standalone (for testing)
npm run dev:server        # Build and run test server
npm run test:server       # Run test server in current directory

# Type checking and linting
npm run typecheck         # TypeScript type check
npm run lint              # ESLint
```

## Architecture

### Three-Part Structure

1. **Extension** (`src/extension/`) - VS Code extension host code (Node.js)
   - `index.ts` - Main entry point, handles activation, commands, and file watchers
   - `commands/` - VS Code command implementations
   - `webview/` - WebviewPanelProvider and SidebarViewProvider for VS Code panels
   - `server/` - Express-based development server with HMR support

2. **Webview UI** (`src/webview-ui/`) - React frontend running in VS Code webview
   - `App.tsx` - Main React component
   - `components/browser/` - BrowserFrame, NavigationBar, SelectionOverlay
   - `state/stores.ts` - Zustand stores (navigation, selection, editor state)
   - `hooks/useVSCodeApi.ts` - Bridge for extension-webview communication

3. **Shared** (`src/shared/types/`) - TypeScript types shared between extension and webview
   - `inspector.ts` - ElementInfo, InspectorMessage, InspectorAPI types
   - `server.ts` - Server-related types
   - `MessageTypes.ts` - Message protocol between extension and webview

### Key Communication Flows

- **Extension <-> Webview**: Uses VS Code's postMessage API via `useVSCodeApi` hook
- **Webview <-> Preview iframe**: Uses window.postMessage with `__claudeVSInspector__` API
- **Server -> Browser**: WebSocket-based HMR for live reload (port = serverPort + 1)

### Server Manager

The `ServerManager` class (`src/extension/server/ServerManager.ts`) provides:
- Express-based static file server for previewing HTML files
- Automatic HTML injection of element inspector script
- HMR client injection for live reload
- Path traversal security protection

### State Management

Zustand stores in `src/webview-ui/state/stores.ts`:
- `useNavigationStore` - URL, history, navigation actions
- `useSelectionStore` - Element selection mode, selected/hovered elements
- `useEditorStore` - Loading state, errors, inspector panel width

## Configuration

Default server port: `3333` (configurable via `claudeVisualStudio.serverPort`)
Auto-refresh on file save: enabled by default (`claudeVisualStudio.autoRefresh`)
