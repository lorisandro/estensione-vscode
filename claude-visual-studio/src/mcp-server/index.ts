#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import WebSocket from 'ws';

import * as fs from 'fs';
import * as path from 'path';

// WebSocket connection to VS Code extension
let wsConnection: WebSocket | null = null;
let pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void; timestamp: number }> = new Map();
let requestId = 0;
let connectedPort: number | null = null;
let isReconnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;
const MAX_PENDING_REQUESTS = 100; // Prevent memory leaks from accumulated requests
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Clean up stale pending requests to prevent memory leaks
 */
function cleanupStalePendingRequests(): void {
  const now = Date.now();
  for (const [id, request] of pendingRequests.entries()) {
    if (now - request.timestamp > REQUEST_TIMEOUT_MS * 2) {
      // Request is very old, clean it up
      request.reject(new Error('Request expired (cleanup)'));
      pendingRequests.delete(id);
    }
  }

  // If still too many requests, reject oldest ones
  if (pendingRequests.size > MAX_PENDING_REQUESTS) {
    const entries = Array.from(pendingRequests.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, pendingRequests.size - MAX_PENDING_REQUESTS);
    for (const [id, request] of toRemove) {
      request.reject(new Error('Request queue overflow'));
      pendingRequests.delete(id);
    }
  }
}

const WS_BASE_PORT = 3334;
const MAX_PORT_ATTEMPTS = 10;
const PORT_FILE_NAME = '.vscode/.claude-visual-studio-port';

/**
 * Try to read the MCP port from the workspace file
 */
function readPortFromWorkspace(): number | null {
  try {
    const cwd = process.cwd();
    const portFilePath = path.join(cwd, PORT_FILE_NAME);

    if (fs.existsSync(portFilePath)) {
      const content = fs.readFileSync(portFilePath, 'utf-8');
      const data = JSON.parse(content);

      const maxAge = 60 * 60 * 1000; // 1 hour
      if (Date.now() - data.timestamp < maxAge) {
        console.error(`[MCP] Found port ${data.port} in workspace file`);
        return data.port;
      } else {
        console.error('[MCP] Port file is too old, ignoring');
      }
    }
  } catch (error) {
    console.error('[MCP] Could not read port from workspace:', error);
  }
  return null;
}

// Try to connect to a specific port
function tryConnectToPort(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Connection timeout on port ${port}`));
    }, 2000);

    ws.on('open', () => {
      clearTimeout(timeout);
      console.error(`[MCP] Connected to VS Code extension on port ${port}`);
      wsConnection = ws;
      connectedPort = port;
      resolve();
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        const pending = pendingRequests.get(message.id);
        if (pending) {
          if (message.error) {
            pending.reject(new Error(message.error));
          } else {
            pending.resolve(message.result);
          }
          pendingRequests.delete(message.id);
        }
      } catch (error) {
        console.error('[MCP] Error parsing message:', error);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', () => {
      console.error('[MCP] Disconnected from VS Code extension');
      wsConnection = null;

      if (!isReconnecting && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        isReconnecting = true;
        reconnectAttempts++;
        console.error(`[MCP] Attempting auto-reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${RECONNECT_DELAY_MS}ms...`);

        setTimeout(async () => {
          isReconnecting = false;
          connectedPort = null;
          try {
            await connectToExtension();
            reconnectAttempts = 0;
            console.error('[MCP] Auto-reconnect successful');
          } catch (error) {
            console.error('[MCP] Auto-reconnect failed:', (error as Error).message);
          }
        }, RECONNECT_DELAY_MS);
      } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[MCP] Max reconnect attempts reached. Will retry on next command.');
        reconnectAttempts = 0;
        connectedPort = null;
      }
    });
  });
}

// Connect to VS Code extension
async function connectToExtension(): Promise<void> {
  if (connectedPort) {
    try {
      await tryConnectToPort(connectedPort);
      return;
    } catch {
      // Try other ports
    }
  }

  const workspacePort = readPortFromWorkspace();
  if (workspacePort) {
    try {
      await tryConnectToPort(workspacePort);
      console.error(`[MCP] Connected using workspace port file`);
      return;
    } catch {
      console.error(`[MCP] Workspace port ${workspacePort} failed, trying other ports...`);
    }
  }

  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    const port = WS_BASE_PORT + i;
    try {
      await tryConnectToPort(port);
      return;
    } catch {
      // Continue to next port
    }
  }

  throw new Error(`Could not connect to VS Code extension on ports ${WS_BASE_PORT}-${WS_BASE_PORT + MAX_PORT_ATTEMPTS - 1}. Make sure the extension is running.`);
}

// Send command to VS Code extension
async function sendCommand(command: string, params: Record<string, any> = {}): Promise<any> {
  if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
    try {
      await connectToExtension();
    } catch {
      throw new Error('Not connected to VS Code extension. Make sure the extension is running.');
    }
  }

  // Clean up stale requests before adding new one
  cleanupStalePendingRequests();

  const id = `req_${++requestId}`;
  const timestamp = Date.now();

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, timestamp });

    wsConnection!.send(JSON.stringify({
      id,
      command,
      params,
    }));

    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, REQUEST_TIMEOUT_MS);
  });
}

// Create MCP server
const server = new Server(
  {
    name: 'claude-visual-studio',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'backend_start_dev_server',
        description: 'Start a development server (Next.js, Vite, etc.) and capture its logs in real-time. The server output will be available via backend_get_logs.',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Command to run. Default is "npm".',
            },
            args: {
              type: 'array',
              items: { type: 'string' },
              description: 'Arguments for the command. Default is ["run", "dev"].',
            },
            cwd: {
              type: 'string',
              description: 'Working directory. Default is the workspace root.',
            },
          },
        },
      },
      {
        name: 'backend_stop_dev_server',
        description: 'Stop the running development server.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'backend_restart_dev_server',
        description: 'Restart the development server with the same configuration.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'backend_get_status',
        description: 'Get the status of the development server (running, pid, command).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'backend_get_logs',
        description: 'Get logs from the development server (stdout/stderr). Use this to see Next.js, Vite, or other server output in real-time.',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Filter logs by type: "all", "stdout", "stderr", "info", "error". Default is "all".',
              enum: ['all', 'stdout', 'stderr', 'info', 'error'],
            },
            limit: {
              type: 'number',
              description: 'Maximum number of logs to return. Default is 100.',
            },
          },
        },
      },
      {
        name: 'backend_clear_logs',
        description: 'Clear the backend server logs buffer.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'backend_stop_external_server',
        description: 'Stop a dev server that was started externally (not via this extension). This kills processes on common dev ports (3000, 3001, 5173, etc.) so you can restart with backend_start_dev_server to capture logs.',
        inputSchema: {
          type: 'object',
          properties: {
            ports: {
              type: 'array',
              items: { type: 'number' },
              description: 'Specific ports to stop. Default: [3000, 3001, 5173, 5174, 8080, 8000]',
            },
          },
        },
      },
      {
        name: 'extension_get_logs',
        description: 'Get logs from the VS Code Extension Host. This captures console.log, console.error, etc. from the extension itself, useful for debugging extension behavior.',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Filter logs by type: "all", "log", "error", "warn", "info", "debug". Default is "all".',
              enum: ['all', 'log', 'error', 'warn', 'info', 'debug'],
            },
            limit: {
              type: 'number',
              description: 'Maximum number of logs to return. Default is 100.',
            },
          },
        },
      },
      {
        name: 'extension_clear_logs',
        description: 'Clear the extension host logs buffer.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'backend_start_dev_server':
        result = await sendCommand('startDevServer', {
          command: args?.command,
          args: args?.args,
          cwd: args?.cwd,
        });
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: result.message || 'Dev server started. Use backend_get_logs to see output.' }] };

      case 'backend_stop_dev_server':
        result = await sendCommand('stopDevServer');
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: result.message || 'Dev server stopped.' }] };

      case 'backend_restart_dev_server':
        result = await sendCommand('restartDevServer');
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: result.message || 'Dev server restarting...' }] };

      case 'backend_get_status':
        result = await sendCommand('getDevServerStatus');
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        let statusText: string;
        if (result.running) {
          const parts: string[] = ['Server running'];
          if (result.pid) {
            parts.push(`PID: ${result.pid}`);
          }
          if (result.ports && result.ports.length > 0) {
            parts.push(`Ports: ${result.ports.join(', ')}`);
          }
          if (result.command) {
            parts.push(`Command: ${result.command}`);
          }
          statusText = parts.join('\n');
        } else {
          statusText = 'No server running';
        }
        return { content: [{ type: 'text', text: statusText }] };

      case 'backend_get_logs':
        result = await sendCommand('getBackendLogs', {
          filter: args?.filter || 'all',
          limit: args?.limit || 100,
        });
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        const backendLogs = result.logs || [];
        if (backendLogs.length === 0) {
          // Check if server is running externally
          const statusResult = await sendCommand('getDevServerStatus');
          if (statusResult.running && statusResult.ports && statusResult.ports.length > 0) {
            return { content: [{ type: 'text', text: `Server detected on port(s) ${statusResult.ports.join(', ')} but logs not captured.\n\nThe server was started externally (not via this extension).\nTo capture logs, use backend_stop_external_server to stop it, then backend_start_dev_server to restart with log capture.\n\nAll terminals will then see the logs.` }] };
          }
          return { content: [{ type: 'text', text: 'No backend logs captured. Start a dev server with backend_start_dev_server to capture logs.\n\nAll terminals connected to VS Code will see the same logs.' }] };
        }
        const formattedBackendLogs = backendLogs.map((log: any) => {
          const time = new Date(log.timestamp).toISOString().split('T')[1].slice(0, 12);
          const prefix = `[${time}] [${log.type.toUpperCase()}]`;
          return `${prefix} ${log.message}`;
        }).join('\n');
        const backendSummary = result.truncated
          ? `Showing ${backendLogs.length} of ${result.total} logs (truncated)\n\n`
          : `${backendLogs.length} log(s)\n\n`;
        return { content: [{ type: 'text', text: backendSummary + formattedBackendLogs }] };

      case 'backend_clear_logs':
        result = await sendCommand('clearBackendLogs');
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: 'Backend logs cleared.' }] };

      case 'backend_stop_external_server':
        result = await sendCommand('stopExternalServer', {
          ports: args?.ports || [3000, 3001, 5173, 5174, 8080, 8000],
        });
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: result.message || 'External server stopped. Now use backend_start_dev_server to restart with log capture.' }] };

      case 'extension_get_logs':
        result = await sendCommand('getExtensionLogs', {
          filter: args?.filter || 'all',
          limit: args?.limit || 100,
        });
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        const extensionLogs = result.logs || [];
        if (extensionLogs.length === 0) {
          return { content: [{ type: 'text', text: 'No extension host logs captured.' }] };
        }
        const formattedExtensionLogs = extensionLogs.map((log: any) => {
          const time = new Date(log.timestamp).toISOString().split('T')[1].slice(0, 12);
          const prefix = `[${time}] [${log.type.toUpperCase()}]`;
          return `${prefix} ${log.message}`;
        }).join('\n');
        const extensionSummary = `${extensionLogs.length} log(s) (total: ${result.total})\n\n`;
        return { content: [{ type: 'text', text: extensionSummary + formattedExtensionLogs }] };

      case 'extension_clear_logs':
        result = await sendCommand('clearExtensionLogs');
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: 'Extension host logs cleared.' }] };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  try {
    await connectToExtension();
  } catch {
    console.error('[MCP] Could not connect to VS Code extension initially. Will retry on first command.');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Dev server control MCP running');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
