#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import WebSocket from 'ws';

// WebSocket connection to VS Code extension
let wsConnection: WebSocket | null = null;
let pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
let requestId = 0;

const WS_PORT = 3334; // Port for communication with VS Code extension

// Connect to VS Code extension
function connectToExtension(): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}`);

    ws.on('open', () => {
      console.error('[MCP] Connected to VS Code extension');
      wsConnection = ws;
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
      console.error('[MCP] WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.error('[MCP] Disconnected from VS Code extension');
      wsConnection = null;
    });
  });
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
