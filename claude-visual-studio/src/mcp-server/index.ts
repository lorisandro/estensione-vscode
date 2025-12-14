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
let pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
let requestId = 0;
let connectedPort: number | null = null;

const WS_BASE_PORT = 3334; // Starting port for communication with VS Code extension
const MAX_PORT_ATTEMPTS = 10; // Try up to 10 ports
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

      // Check if port file is not too old (max 1 hour)
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
      connectedPort = null;
    });
  });
}

// Connect to VS Code extension, trying multiple ports
async function connectToExtension(): Promise<void> {
  // If we were previously connected, try that port first
  if (connectedPort) {
    try {
      await tryConnectToPort(connectedPort);
      return;
    } catch {
      // Try other ports
    }
  }

  // Try to read port from workspace file first (most reliable)
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

  // Try ports starting from base port
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

// Send command to VS Code extension and wait for response
async function sendCommand(command: string, params: Record<string, any> = {}): Promise<any> {
  if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
    // Try to reconnect
    try {
      await connectToExtension();
    } catch {
      throw new Error('Not connected to VS Code extension. Make sure the extension is running.');
    }
  }

  const id = `req_${++requestId}`;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });

    wsConnection!.send(JSON.stringify({
      id,
      command,
      params,
    }));

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}

// Create MCP server
const server = new Server(
  {
    name: 'claude-visual-studio-browser',
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
        name: 'browser_navigate',
        description: 'Navigate the browser to a URL',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to navigate to',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'browser_get_url',
        description: 'Get the current URL of the browser',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_get_html',
        description: 'Get the HTML content of the current page',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'Optional CSS selector to get HTML of specific element',
            },
          },
        },
      },
      {
        name: 'browser_get_text',
        description: 'Get the visible text content of the current page',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'Optional CSS selector to get text of specific element',
            },
          },
        },
      },
      {
        name: 'browser_screenshot',
        description: 'Take a screenshot of the current page (returns base64 encoded image)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_click',
        description: 'Click on an element in the page',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector of the element to click',
            },
          },
          required: ['selector'],
        },
      },
      {
        name: 'browser_type',
        description: 'Type text into an input field',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector of the input element',
            },
            text: {
              type: 'string',
              description: 'Text to type',
            },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'browser_refresh',
        description: 'Refresh the current page',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_back',
        description: 'Go back in browser history',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_forward',
        description: 'Go forward in browser history',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_get_elements',
        description: 'Get a list of elements matching a selector with their properties',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector to find elements',
            },
          },
          required: ['selector'],
        },
      },
      {
        name: 'browser_get_selected_element',
        description: 'Get the currently selected element in selection mode. Returns element info including tag, id, classes, selector, xpath, attributes, bounding box, and computed styles.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_open',
        description: 'Open the Visual Preview panel in VS Code. Use this if the browser is not visible.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_get_console_logs',
        description: 'Get console logs from the browser preview. Captures console.log, console.error, console.warn, console.info, console.debug, uncaught errors, and unhandled promise rejections from the previewed page.',
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
        name: 'browser_clear_console_logs',
        description: 'Clear the console logs buffer in the browser preview.',
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
      case 'browser_navigate':
        result = await sendCommand('navigate', { url: args?.url });
        return { content: [{ type: 'text', text: `Navigated to: ${args?.url}` }] };

      case 'browser_get_url':
        result = await sendCommand('getUrl');
        return { content: [{ type: 'text', text: `Current URL: ${result.url}` }] };

      case 'browser_get_html':
        result = await sendCommand('getHtml', { selector: args?.selector });
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: result.html || '' }] };

      case 'browser_get_text':
        result = await sendCommand('getText', { selector: args?.selector });
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: result.text || '' }] };

      case 'browser_screenshot':
        result = await sendCommand('screenshot');
        // Return image if screenshot was captured successfully
        if (result.screenshot) {
          return {
            content: [
              {
                type: 'image',
                data: result.screenshot,
                mimeType: 'image/png',
              },
            ],
          };
        } else if (result.error) {
          return { content: [{ type: 'text', text: `Screenshot error: ${result.error}` }], isError: true };
        } else {
          return { content: [{ type: 'text', text: result.text || 'Screenshot not available' }] };
        }

      case 'browser_click':
        result = await sendCommand('click', { selector: args?.selector });
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `Clicked element: ${args?.selector}` }] };

      case 'browser_type':
        result = await sendCommand('type', { selector: args?.selector, text: args?.text });
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `Typed "${args?.text}" into ${args?.selector}` }] };

      case 'browser_refresh':
        result = await sendCommand('refresh');
        return { content: [{ type: 'text', text: 'Page refreshed' }] };

      case 'browser_back':
        result = await sendCommand('back');
        return { content: [{ type: 'text', text: 'Navigated back' }] };

      case 'browser_forward':
        result = await sendCommand('forward');
        return { content: [{ type: 'text', text: 'Navigated forward' }] };

      case 'browser_get_elements':
        result = await sendCommand('getElements', { selector: args?.selector });
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.elements || [], null, 2) }] };

      case 'browser_get_selected_element':
        result = await sendCommand('getSelectedElement');
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        if (!result.element) {
          return { content: [{ type: 'text', text: 'No element currently selected. Use selection mode to select an element first.' }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.element, null, 2) }] };

      case 'browser_open':
        result = await sendCommand('openBrowser');
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: 'Visual Preview panel opened. You can now navigate to a URL.' }] };

      case 'browser_get_console_logs':
        result = await sendCommand('getConsoleLogs', {
          filter: args?.filter || 'all',
          limit: args?.limit || 100,
        });
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        // Format logs for readability
        const logs = result.logs || [];
        if (logs.length === 0) {
          return { content: [{ type: 'text', text: 'No console logs captured.' }] };
        }
        const formattedLogs = logs.map((log: any) => {
          const time = new Date(log.timestamp).toISOString().split('T')[1].slice(0, 12);
          const prefix = `[${time}] [${log.type.toUpperCase()}]`;
          return `${prefix} ${log.message}${log.stack ? '\n' + log.stack : ''}`;
        }).join('\n\n');
        const summary = result.truncated
          ? `Showing ${logs.length} of ${result.total} logs (truncated)\n\n`
          : `${logs.length} log(s)\n\n`;
        return { content: [{ type: 'text', text: summary + formattedLogs }] };

      case 'browser_clear_console_logs':
        result = await sendCommand('clearConsoleLogs');
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: 'Console logs cleared.' }] };

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
  // Try to connect to VS Code extension
  try {
    await connectToExtension();
  } catch {
    console.error('[MCP] Could not connect to VS Code extension initially. Will retry on first command.');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Browser control server running');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
