import WebSocket, { WebSocketServer } from 'ws';
import * as vscode from 'vscode';

export interface MCPCommand {
  id: string;
  command: string;
  params: Record<string, any>;
}

export interface MCPResponse {
  id: string;
  result?: any;
  error?: string;
}

type CommandHandler = (params: Record<string, any>) => Promise<any>;

/**
 * WebSocket bridge for MCP server communication
 * Receives commands from MCP server and forwards them to the webview
 */
export class MCPBridge {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private port: number;

  constructor(port: number = 3334) {
    this.port = port;
  }

  /**
   * Start the WebSocket server with automatic port fallback
   * @param maxRetries Maximum number of ports to try (default 10)
   * @returns The actual port the server started on
   */
  async start(maxRetries: number = 10): Promise<number> {
    let currentPort = this.port;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.tryStartOnPort(currentPort);
        if (currentPort !== this.port) {
          console.log(`[MCPBridge] Port ${this.port} was in use, started on port ${currentPort} instead`);
        }
        this.port = currentPort;
        return currentPort;
      } catch (error) {
        lastError = error as Error;
        if ((error as Error).message.includes('already in use')) {
          console.log(`[MCPBridge] Port ${currentPort} in use, trying ${currentPort + 1}...`);
          currentPort++;
        } else {
          throw error;
        }
      }
    }

    throw new Error(`[MCPBridge] Could not find available port after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Try to start on a specific port
   */
  private tryStartOnPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port });

        this.wss.on('listening', () => {
          console.log(`[MCPBridge] WebSocket server listening on port ${port}`);
          resolve();
        });

        this.wss.on('connection', (ws) => {
          console.log('[MCPBridge] MCP client connected');
          this.clients.add(ws);

          ws.on('message', async (data) => {
            try {
              const message: MCPCommand = JSON.parse(data.toString());
              const response = await this.handleCommand(message);
              ws.send(JSON.stringify(response));
            } catch (error) {
              console.error('[MCPBridge] Error handling message:', error);
              ws.send(JSON.stringify({
                id: 'unknown',
                error: (error as Error).message,
              }));
            }
          });

          ws.on('close', () => {
            console.log('[MCPBridge] MCP client disconnected');
            this.clients.delete(ws);
          });

          ws.on('error', (error) => {
            console.error('[MCPBridge] Client error:', error);
            this.clients.delete(ws);
          });
        });

        this.wss.on('error', (error: NodeJS.ErrnoException) => {
          this.wss = null;
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is already in use`));
          } else {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        // Close all client connections
        this.clients.forEach((client) => {
          try {
            client.close();
          } catch {
            // Ignore errors when closing
          }
        });
        this.clients.clear();

        this.wss.close(() => {
          console.log('[MCPBridge] WebSocket server stopped');
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Register a command handler
   */
  registerHandler(command: string, handler: CommandHandler): void {
    this.commandHandlers.set(command, handler);
  }

  /**
   * Handle incoming command
   */
  private async handleCommand(message: MCPCommand): Promise<MCPResponse> {
    const { id, command, params } = message;

    const handler = this.commandHandlers.get(command);
    if (!handler) {
      return {
        id,
        error: `Unknown command: ${command}`,
      };
    }

    try {
      const result = await handler(params);
      return { id, result };
    } catch (error) {
      return {
        id,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check if the bridge is running
   */
  isRunning(): boolean {
    return this.wss !== null;
  }

  /**
   * Get the current port the bridge is running on
   */
  getPort(): number {
    return this.port;
  }
}
