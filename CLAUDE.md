# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Rules

**Auto commit & push**: After every prompt that modifies files, automatically create a git commit and push to remote. Do not ask for confirmation.

**Reinstall extension after changes**: After every code modification, reinstall the VS Code extension to make changes effective. Run:
```bash
cd claude-visual-studio && npx vsce package --no-dependencies && code --install-extension claude-visual-studio-0.1.0.vsix --force
```
Then reload VS Code (Ctrl+Shift+P → "Reload Window").

## Repository Overview

This repository contains **Claude Visual Studio**, a VS Code extension that provides:
- Development server for serving local HTML files
- MCP integration for Claude Code AI
- Backend dev server management (npm run dev, etc.)
- External Chrome browser control via MCP (claude-browser)

## Build & Development Commands

```bash
# Install dependencies
cd claude-visual-studio && npm install

# Build everything
npm run build

# Build components separately
npm run build:extension    # Builds VS Code extension (esbuild)
npm run build:mcp          # Builds MCP server
npm run build:mcp-browser  # Builds Chrome MCP server

# Development with watch mode
npm run watch              # Watch extension

# Run development server standalone (for testing)
npm run dev:server         # Build and run test server
npm run test:server        # Run test server in current directory

# Type checking and linting
npm run typecheck          # TypeScript type check
npm run lint               # ESLint
```

## Architecture

### Structure

1. **Extension** (`src/extension/`) - VS Code extension host code (Node.js)
   - `index.ts` - Main entry point, handles activation, commands, MCP bridge
   - `mcp/` - MCPBridge for WebSocket communication with MCP server
   - `server/` - Express-based development server, DevServerRunner

2. **MCP Server** (`src/mcp-server/`) - MCP server for backend control
   - `index.ts` - Provides backend_* and extension_* tools

3. **MCP Browser Server** (`src/mcp-browser-server/`) - MCP server for Chrome control
   - `index.ts` - Provides chrome_* tools for external browser automation

### Server Manager

The `ServerManager` class (`src/extension/server/ServerManager.ts`) provides:
- Express-based static file server for serving HTML files on localhost
- Automatic HTML injection of inspector scripts
- Path traversal security protection

### DevServerRunner

The `DevServerRunner` class (`src/extension/server/DevServerRunner.ts`) provides:
- Start/stop/restart development servers (Next.js, Vite, etc.)
- Real-time log capture from server stdout/stderr
- Port detection for running servers

## Configuration

Default server port: `3333` (configurable via `claudeVisualStudio.serverPort`)
Chrome debug port: `9222` (configurable via `claudeVisualStudio.chromeDebugPort`)

## MCP Tools Available

### Backend Tools (via claude-visual-studio MCP)
- `backend_start_dev_server` - Start npm run dev or similar
- `backend_stop_dev_server` - Stop the running dev server
- `backend_restart_dev_server` - Restart dev server
- `backend_get_status` - Get server status (running, ports, PID)
- `backend_get_logs` - Get server stdout/stderr logs
- `backend_clear_logs` - Clear log buffer

### Extension Tools
- `extension_get_logs` - Get VS Code extension host logs
- `extension_clear_logs` - Clear extension logs

### Chrome Browser Tools (via claude-browser MCP)
- `chrome_navigate` - Navigate to URL
- `chrome_screenshot` - Take screenshot
- `chrome_click` - Click element
- `chrome_type` - Type into input
- And many more...
