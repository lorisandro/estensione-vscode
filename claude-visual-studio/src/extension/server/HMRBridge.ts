import * as http from 'http';
import WebSocket, { WebSocketServer, RawData } from 'ws';
import { watch, FSWatcher } from 'chokidar';
import * as path from 'path';

interface HMRBridgeConfig {
  port: number;
  rootPath: string;
  watchPatterns?: string[];
}

interface HMRMessage {
  type: 'file-changed' | 'connected' | 'error';
  file?: string;
  timestamp?: number;
  error?: string;
}

export class HMRBridge {
  private wss: WebSocketServer | null = null;
  private server: http.Server | null = null;
  private watcher: FSWatcher | null = null;
  private config: HMRBridgeConfig | null = null;
  private clients: Set<WebSocket> = new Set();

  // Default patterns to watch
  private readonly DEFAULT_WATCH_PATTERNS = [
    '**/*.html',
    '**/*.htm',
    '**/*.css',
    '**/*.js',
    '**/*.jsx',
    '**/*.ts',
    '**/*.tsx',
    '**/*.json',
    '**/*.svg',
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
  ];

  // Patterns to ignore
  private readonly IGNORE_PATTERNS = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/coverage/**',
    '**/.cache/**',
  ];

  /**
   * Start the HMR WebSocket server and file watcher
   */
  async start(config: HMRBridgeConfig): Promise<void> {
    if (this.server) {
      throw new Error('HMR Bridge is already running. Call stop() first.');
    }

    this.config = config;

    // Create HTTP server for WebSocket
    this.server = http.createServer();

    // Create WebSocket server
    this.wss = new WebSocketServer({ server: this.server });

    // Setup WebSocket handlers
    this.setupWebSocketHandlers();

    // Setup file watcher
    this.setupFileWatcher();

    // Start listening
    return new Promise((resolve, reject) => {
      this.server!.listen(config.port, () => {
        console.log(`[HMRBridge] WebSocket server started on port ${config.port}`);
        resolve();
      });

      this.server!.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${config.port} is already in use for HMR`));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Stop the HMR server and file watcher
   */
  async stop(): Promise<void> {
    // Close all client connections
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server shutting down');
      }
    });
    this.clients.clear();

    // Close file watcher
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // Close WebSocket server
    if (this.wss) {
      return new Promise((resolve, reject) => {
        this.wss!.close((error) => {
          if (error) {
            reject(error);
          } else {
            this.wss = null;
            resolve();
          }
        });
      });
    }

    // Close HTTP server
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server!.close((error) => {
          if (error) {
            reject(error);
          } else {
            console.log('[HMRBridge] Server stopped');
            this.server = null;
            this.config = null;
            resolve();
          }
        });
      });
    }
  }

  /**
   * Check if HMR bridge is currently running
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Manually trigger a reload for all connected clients
   */
  triggerReload(fileName?: string): void {
    this.broadcastMessage({
      type: 'file-changed',
      file: fileName,
      timestamp: Date.now(),
    });
  }

  /**
   * Setup WebSocket connection handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
      console.log(`[HMRBridge] Client connected: ${clientId}`);

      // Add to clients set
      this.clients.add(ws);

      // Send welcome message
      this.sendMessage(ws, {
        type: 'connected',
        timestamp: Date.now(),
      });

      // Handle messages from client
      ws.on('message', (data: RawData) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('[HMRBridge] Received message from client:', message);

          // Handle ping/pong for keep-alive
          if (message.type === 'ping') {
            this.sendMessage(ws, { type: 'connected', timestamp: Date.now() });
          }
        } catch (error) {
          console.error('[HMRBridge] Error parsing message:', error);
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[HMRBridge] WebSocket error for ${clientId}:`, error);
      });

      // Handle disconnection
      ws.on('close', (code, reason) => {
        console.log(`[HMRBridge] Client disconnected: ${clientId} (code: ${code}, reason: ${reason})`);
        this.clients.delete(ws);
      });
    });

    // Handle server errors
    this.wss.on('error', (error) => {
      console.error('[HMRBridge] WebSocket server error:', error);
    });
  }

  /**
   * Setup file system watcher
   */
  private setupFileWatcher(): void {
    if (!this.config) return;

    const watchPatterns = this.config.watchPatterns || this.DEFAULT_WATCH_PATTERNS;
    const watchPaths = watchPatterns.map(pattern =>
      path.join(this.config!.rootPath, pattern)
    );

    console.log('[HMRBridge] Watching patterns:', watchPatterns);

    this.watcher = watch(watchPaths, {
      ignored: this.IGNORE_PATTERNS,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    // Handle file changes
    this.watcher.on('change', (filePath: string) => {
      const relativePath = path.relative(this.config!.rootPath, filePath);
      console.log(`[HMRBridge] File changed: ${relativePath}`);

      this.broadcastMessage({
        type: 'file-changed',
        file: relativePath,
        timestamp: Date.now(),
      });
    });

    // Handle file additions
    this.watcher.on('add', (filePath: string) => {
      const relativePath = path.relative(this.config!.rootPath, filePath);
      console.log(`[HMRBridge] File added: ${relativePath}`);

      this.broadcastMessage({
        type: 'file-changed',
        file: relativePath,
        timestamp: Date.now(),
      });
    });

    // Handle file deletions
    this.watcher.on('unlink', (filePath: string) => {
      const relativePath = path.relative(this.config!.rootPath, filePath);
      console.log(`[HMRBridge] File deleted: ${relativePath}`);

      this.broadcastMessage({
        type: 'file-changed',
        file: relativePath,
        timestamp: Date.now(),
      });
    });

    // Handle watcher errors
    this.watcher.on('error', (error) => {
      console.error('[HMRBridge] File watcher error:', error);
    });

    // Watcher ready
    this.watcher.on('ready', () => {
      console.log('[HMRBridge] File watcher ready');
    });
  }

  /**
   * Send message to a specific client
   */
  private sendMessage(ws: WebSocket, message: HMRMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[HMRBridge] Error sending message:', error);
      }
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcastMessage(message: HMRMessage): void {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('[HMRBridge] Error broadcasting message:', error);
        }
      }
    });

    console.log(`[HMRBridge] Broadcasted message to ${this.clients.size} client(s)`);
  }
}
