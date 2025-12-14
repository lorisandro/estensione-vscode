import express from 'express';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { URL } from 'url';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

interface ServerConfig {
  port: number;
  rootPath: string;
  hmrScriptPort?: number;
  extensionPath?: string;
}

export class ServerManager {
  private app: express.Express | null = null;
  private server: http.Server | null = null;
  private config: ServerConfig | null = null;

  // Track the last proxied origin for relative URL resolution
  private lastProxiedOrigin: string | null = null;

  private readonly MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.jsx': 'application/javascript',
    '.ts': 'application/javascript', // Served as JS for preview
    '.tsx': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.webp': 'image/webp',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.txt': 'text/plain',
    '.xml': 'application/xml',
  };

  /**
   * Start the development server with automatic port fallback
   * @param port Port number to listen on
   * @param rootPath Root directory to serve files from
   * @param hmrScriptPort Optional WebSocket port for HMR client script
   * @param extensionPath Optional path to the extension folder (for finding injected scripts)
   * @param maxRetries Maximum number of ports to try (default 10)
   * @returns The actual port the server started on
   */
  async start(port: number, rootPath: string, hmrScriptPort?: number, extensionPath?: string, maxRetries: number = 10): Promise<number> {
    if (this.server) {
      throw new Error('Server is already running. Call stop() first.');
    }

    let currentPort = port;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.tryStartOnPort(currentPort, rootPath, hmrScriptPort, extensionPath);
        if (currentPort !== port) {
          console.log(`[ServerManager] Port ${port} was in use, started on port ${currentPort} instead`);
        }
        return currentPort;
      } catch (error) {
        lastError = error as Error;
        if ((error as Error).message.includes('already in use')) {
          console.log(`[ServerManager] Port ${currentPort} in use, trying ${currentPort + 1}...`);
          currentPort++;
        } else {
          throw error;
        }
      }
    }

    throw new Error(`Could not find available port after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Try to start server on a specific port
   */
  private async tryStartOnPort(port: number, rootPath: string, hmrScriptPort?: number, extensionPath?: string): Promise<void> {
    this.config = { port, rootPath, hmrScriptPort, extensionPath };
    this.app = express();

    // Configure Express middleware
    this.setupMiddleware();

    // Setup routes
    this.setupRoutes();

    // Start listening
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app!.listen(port, () => {
          console.log(`[ServerManager] Server started on port ${port}, serving ${rootPath}`);
          resolve();
        });

        this.server.on('error', (error: NodeJS.ErrnoException) => {
          this.server = null;
          this.app = null;
          this.config = null;
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
   * Stop the development server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          reject(error);
        } else {
          console.log('[ServerManager] Server stopped');
          this.server = null;
          this.app = null;
          this.config = null;
          resolve();
        }
      });
    });
  }

  /**
   * Check if server is currently running
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get the current port the server is running on
   */
  getPort(): number | null {
    return this.config?.port ?? null;
  }

  /**
   * Get current server configuration
   */
  getConfig(): ServerConfig | null {
    return this.config;
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    if (!this.app) return;

    // CORS headers for webview - restricted to localhost for security
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      const allowedOrigins = [
        'vscode-webview://',
        `http://localhost:${this.config?.port}`,
        `http://127.0.0.1:${this.config?.port}`,
      ];

      // Allow VS Code webview origins (they start with vscode-webview://)
      if (origin && (origin.startsWith('vscode-webview://') || allowedOrigins.includes(origin))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        // Fallback for localhost development
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3333');
      }

      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }

      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[ServerManager] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup server routes
   */
  private setupRoutes(): void {
    if (!this.app || !this.config) return;

    // Proxy route for external URLs (to bypass X-Frame-Options)
    this.app.get('/__claude-vs__/proxy', async (req, res) => {
      const targetUrl = req.query.url as string;

      if (!targetUrl) {
        res.status(400).send('Missing url parameter');
        return;
      }

      try {
        const parsedUrl = new URL(targetUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        // Save the origin for resolving relative URLs (like /_next/...)
        this.lastProxiedOrigin = `${parsedUrl.protocol}//${parsedUrl.host}`;

        const proxyReq = httpModule.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'identity', // Don't request compression for simplicity
              'Host': parsedUrl.host,
            },
          },
          (proxyRes) => {
            // Handle redirects - use absolute URL for iframe compatibility
            if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
              const redirectUrl = new URL(proxyRes.headers.location, targetUrl).href;
              const absoluteProxyUrl = `http://localhost:${this.config!.port}/__claude-vs__/proxy?url=${encodeURIComponent(redirectUrl)}`;
              res.redirect(absoluteProxyUrl);
              return;
            }

            // Copy headers but remove frame-blocking ones
            const headers = { ...proxyRes.headers };
            delete headers['x-frame-options'];
            delete headers['content-security-policy'];
            delete headers['content-security-policy-report-only'];

            // Don't set any CSP - let the content load freely in iframe
            // VS Code webviews use special schemes that CSP wildcards don't cover

            // Set CORS headers
            headers['access-control-allow-origin'] = '*';

            res.status(proxyRes.statusCode || 200);

            // Set headers
            Object.entries(headers).forEach(([key, value]) => {
              if (value && key !== 'transfer-encoding' && key !== 'content-encoding') {
                res.setHeader(key, value as string);
              }
            });

            // Collect response body
            const chunks: Buffer[] = [];
            proxyRes.on('data', (chunk) => chunks.push(chunk));
            proxyRes.on('end', () => {
              let body = Buffer.concat(chunks);

              // For HTML content, rewrite relative URLs to use proxy
              const contentType = proxyRes.headers['content-type'] || '';
              if (contentType.includes('text/html')) {
                const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
                let html = body.toString('utf-8');

                // Rewrite relative URLs in href and src attributes
                html = this.rewriteHtmlUrls(html, baseUrl, this.config!.port);

                // Inject element inspector script for selection mode
                html = this.injectInspectorScript(html);

                // Inject MCP bridge script for parent-iframe communication
                html = this.injectMCPBridgeScript(html);

                res.send(html);
              } else {
                res.send(body);
              }
            });
          }
        );

        proxyReq.on('error', (error) => {
          console.error('[ServerManager] Proxy error:', error);
          // Create an error page with MCP bridge so commands don't timeout
          const errorHtml = this.createErrorPage(
            `Failed to load ${targetUrl}`,
            error.message,
            targetUrl
          );
          res.status(502).send(errorHtml);
        });

        proxyReq.end();
      } catch (error) {
        console.error('[ServerManager] Proxy error:', error);
        // Create an error page with MCP bridge so commands don't timeout
        const errorHtml = this.createErrorPage(
          `Failed to load ${targetUrl}`,
          (error as Error).message,
          targetUrl
        );
        res.status(500).send(errorHtml);
      }
    });

    // Special route for element inspector script
    this.app.get('/__claude-vs__/element-inspector.js', async (req, res) => {
      try {
        // Build possible paths for the element inspector script
        const possiblePaths: string[] = [];

        // If extensionPath is provided, use it as the primary source
        if (this.config?.extensionPath) {
          possiblePaths.push(
            path.join(this.config.extensionPath, 'dist/injected-scripts/element-inspector.js'),
            path.join(this.config.extensionPath, 'src/injected-scripts/element-inspector.js')
          );
        }

        // Fallback to __dirname-based paths (may work in some configurations)
        possiblePaths.push(
          path.join(__dirname, '../injected-scripts/element-inspector.js'),
          path.join(__dirname, '../../injected-scripts/element-inspector.js'),
          path.join(__dirname, '../../../dist/injected-scripts/element-inspector.js'),
          path.join(__dirname, '../../../src/injected-scripts/element-inspector.js')
        );

        // Try each path until we find one that exists
        let scriptPath: string | null = null;
        for (const p of possiblePaths) {
          try {
            await stat(p);
            scriptPath = p;
            break;
          } catch {
            // Continue to next path
          }
        }

        if (!scriptPath) {
          throw new Error(`Element inspector script not found. Tried paths: ${possiblePaths.join(', ')}`);
        }

        const content = await readFile(scriptPath, 'utf-8');
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(content);
        console.log('[ServerManager] Serving element inspector from:', scriptPath);
      } catch (error) {
        console.error('[ServerManager] Error serving element inspector:', error);
        res.status(500).send(`// Error loading element inspector: ${(error as Error).message}`);
      }
    });

    // Proxy route for /_next/ static files (Next.js resources)
    // This intercepts relative URLs that browsers resolve against the proxy server
    this.app.get('/_next/*', async (req, res) => {
      if (!this.lastProxiedOrigin) {
        res.status(404).send('No proxied origin available');
        return;
      }

      const targetUrl = `${this.lastProxiedOrigin}${req.originalUrl}`;
      console.log('[ServerManager] Proxying Next.js resource:', req.originalUrl, '->', targetUrl);

      try {
        const parsedUrl = new URL(targetUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const proxyReq = httpModule.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': '*/*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'identity',
              'Host': parsedUrl.host,
            },
          },
          (proxyRes) => {
            // Copy headers
            const headers = { ...proxyRes.headers };
            delete headers['transfer-encoding'];
            delete headers['content-encoding'];

            res.status(proxyRes.statusCode || 200);
            Object.entries(headers).forEach(([key, value]) => {
              if (value) {
                res.setHeader(key, value as string);
              }
            });

            // Pipe the response directly
            proxyRes.pipe(res);
          }
        );

        proxyReq.on('error', (error) => {
          console.error('[ServerManager] Next.js proxy error:', error);
          res.status(502).send(`Proxy error: ${error.message}`);
        });

        proxyReq.end();
      } catch (error) {
        console.error('[ServerManager] Next.js proxy error:', error);
        res.status(500).send(`Proxy error: ${(error as Error).message}`);
      }
    });

    // Serve all files with proper MIME types and HTML injection
    this.app.get('*', async (req, res) => {
      try {
        const filePath = await this.resolveFilePath(req.path);

        if (!filePath) {
          res.status(404).send('File not found');
          return;
        }

        // Check if file exists and is accessible
        try {
          const stats = await stat(filePath);

          if (!stats.isFile()) {
            res.status(404).send('Not a file');
            return;
          }
        } catch (error) {
          res.status(404).send('File not found');
          return;
        }

        // Determine MIME type
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = this.MIME_TYPES[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);

        // Read file
        const content = await readFile(filePath);

        // Inject element inspector script into HTML files
        if (ext === '.html' || ext === '.htm') {
          const injectedContent = this.injectInspectorScript(content.toString('utf-8'));
          res.send(injectedContent);
        } else {
          res.send(content);
        }
      } catch (error) {
        console.error('[ServerManager] Error serving file:', error);
        res.status(500).send('Error reading file');
      }
    });

    // Error handling middleware (must be defined AFTER all routes)
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('[ServerManager] Error:', err);
      res.status(500).send('Internal Server Error');
    });
  }

  /**
   * Resolve file path from URL path
   */
  private async resolveFilePath(urlPath: string): Promise<string | null> {
    if (!this.config) return null;

    // Remove leading slash and decode URI
    const relativePath = decodeURIComponent(urlPath.replace(/^\/+/, ''));

    // Construct full path
    let filePath = path.join(this.config.rootPath, relativePath);

    // Security check: ensure path is within rootPath
    const normalizedPath = path.normalize(filePath);
    const normalizedRoot = path.normalize(this.config.rootPath);

    if (!normalizedPath.startsWith(normalizedRoot)) {
      console.warn('[ServerManager] Attempted path traversal:', urlPath);
      return null;
    }

    // Check if path exists
    try {
      const stats = await stat(filePath);

      // If directory, look for index.html
      if (stats.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        try {
          await stat(indexPath);
          return indexPath;
        } catch {
          // No index.html found
          return null;
        }
      }

      return filePath;
    } catch {
      // File doesn't exist, return null
      return null;
    }
  }

  /**
   * Inject element inspector script into HTML content
   */
  private injectInspectorScript(htmlContent: string): string {
    if (!this.config) return htmlContent;

    const hmrPort = this.config.hmrScriptPort || this.config.port + 1;

    // Create the script injection
    const inspectorScript = `
    <!-- Claude Visual Studio: Element Inspector & HMR -->
    <script>
      // HMR Configuration
      window.__CLAUDE_VS_HMR_PORT__ = ${hmrPort};

      // Load element inspector
      (function() {
        const script = document.createElement('script');
        script.src = 'http://localhost:${this.config.port}/__claude-vs__/element-inspector.js';
        script.async = true;
        script.onerror = function() {
          console.warn('[Claude VS] Failed to load element inspector');
        };
        document.head.appendChild(script);

        // Load HMR client
        const hmrScript = document.createElement('script');
        hmrScript.textContent = \`
          (function() {
            let ws;
            let reconnectAttempts = 0;
            const maxReconnectAttempts = 10;
            const reconnectDelay = 1000;

            function connect() {
              ws = new WebSocket('ws://localhost:${hmrPort}');

              ws.onopen = function() {
                console.log('[Claude VS HMR] Connected');
                reconnectAttempts = 0;
              };

              ws.onmessage = function(event) {
                try {
                  const message = JSON.parse(event.data);

                  if (message.type === 'file-changed') {
                    console.log('[Claude VS HMR] File changed, reloading...');
                    window.location.reload();
                  }
                } catch (error) {
                  console.error('[Claude VS HMR] Error handling message:', error);
                }
              };

              ws.onerror = function(error) {
                console.error('[Claude VS HMR] WebSocket error:', error);
              };

              ws.onclose = function() {
                console.log('[Claude VS HMR] Connection closed');

                if (reconnectAttempts < maxReconnectAttempts) {
                  reconnectAttempts++;
                  console.log(\\\`[Claude VS HMR] Reconnecting (attempt \\\${reconnectAttempts}/\\\${maxReconnectAttempts})...\\\`);
                  setTimeout(connect, reconnectDelay);
                } else {
                  console.log('[Claude VS HMR] Max reconnection attempts reached');
                }
              };
            }

            connect();
          })();
        \`;
        document.head.appendChild(hmrScript);
      })();
    </script>
    `;

    // Try to inject before </head>, fallback to before </body>, or append to end
    if (htmlContent.includes('</head>')) {
      return htmlContent.replace('</head>', `${inspectorScript}</head>`);
    } else if (htmlContent.includes('</body>')) {
      return htmlContent.replace('</body>', `${inspectorScript}</body>`);
    } else {
      return htmlContent + inspectorScript;
    }
  }

  /**
   * Rewrite HTML URLs to use the proxy for external resources
   */
  private rewriteHtmlUrls(html: string, baseUrl: string, proxyPort: number): string {
    const proxyBase = `http://localhost:${proxyPort}/__claude-vs__/proxy?url=`;

    // Rewrite absolute URLs in href and src attributes
    html = html.replace(
      /(href|src|action)=["'](https?:\/\/[^"']+)["']/gi,
      (match, attr, url) => {
        const proxiedUrl = `${proxyBase}${encodeURIComponent(url)}`;
        return `${attr}="${proxiedUrl}"`;
      }
    );

    // Rewrite root-relative URLs (starting with /) but not protocol-relative (//)
    html = html.replace(
      /(href|src|action)=["'](\/(?!\/)[^"']+)["']/gi,
      (match, attr, url) => {
        const absoluteUrl = baseUrl + url;
        const proxiedUrl = `${proxyBase}${encodeURIComponent(absoluteUrl)}`;
        return `${attr}="${proxiedUrl}"`;
      }
    );

    // Rewrite protocol-relative URLs (starting with //)
    html = html.replace(
      /(href|src|action)=["'](\/\/[^"']+)["']/gi,
      (match, attr, url) => {
        const absoluteUrl = 'https:' + url;
        const proxiedUrl = `${proxyBase}${encodeURIComponent(absoluteUrl)}`;
        return `${attr}="${proxiedUrl}"`;
      }
    );

    // Rewrite relative URLs (not starting with /, http, or #)
    // Match: href="script.js", src="assets/img.png", src="./style.css", src="../lib.js"
    html = html.replace(
      /(href|src|action)=["'](?!https?:\/\/|\/|#|data:|javascript:|mailto:)([^"']+)["']/gi,
      (match, attr, url) => {
        // Handle ../ and ./ by normalizing the URL
        const absoluteUrl = new URL(url, baseUrl + '/').href;
        const proxiedUrl = `${proxyBase}${encodeURIComponent(absoluteUrl)}`;
        return `${attr}="${proxiedUrl}"`;
      }
    );

    // Rewrite CSS url() references
    html = html.replace(
      /url\(["']?(?!https?:\/\/|\/|data:|#)([^"')]+)["']?\)/gi,
      (match, url) => {
        try {
          const absoluteUrl = new URL(url, baseUrl + '/').href;
          return `url("${proxyBase}${encodeURIComponent(absoluteUrl)}")`;
        } catch {
          return match; // Keep original if URL parsing fails
        }
      }
    );

    // DO NOT use base tag - it doesn't work correctly with query-string-based proxying
    // The browser would resolve relative URLs against the path portion, not the query string

    return html;
  }

  /**
   * Inject MCP bridge script for parent-iframe communication
   * This allows the webview to access content from proxied pages
   */
  private injectMCPBridgeScript(html: string): string {
    const mcpBridgeScript = `
    <!-- Claude Visual Studio: MCP Bridge -->
    <script>
      (function() {
        console.log('[MCP Bridge] Initializing...');

        // Load html2canvas dynamically with error handling
        var html2canvasLoaded = false;
        var html2canvasScript = document.createElement('script');
        html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        html2canvasScript.onload = function() {
          html2canvasLoaded = true;
          console.log('[MCP Bridge] html2canvas loaded');
        };
        html2canvasScript.onerror = function() {
          console.warn('[MCP Bridge] html2canvas failed to load, screenshots will use canvas fallback');
        };
        document.head.appendChild(html2canvasScript);

        // Screenshot function with fallback
        async function captureScreenshot() {
          // Try html2canvas first, but fall back gracefully on any error
          if (typeof html2canvas !== 'undefined') {
            try {
              const canvas = await html2canvas(document.body, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                scale: 1,
                logging: false,
                imageTimeout: 15000,
                onclone: function(clonedDoc) {
                  // Fix fixed positioning
                  var fixedElements = clonedDoc.querySelectorAll('[style*="position: fixed"]');
                  fixedElements.forEach(function(el) {
                    el.style.position = 'absolute';
                  });
                  // Remove problematic CSS color functions that html2canvas doesn't support
                  var allElements = clonedDoc.querySelectorAll('*');
                  allElements.forEach(function(el) {
                    var style = el.style;
                    var computed = window.getComputedStyle(el);
                    // Replace unsupported color functions with fallbacks
                    ['color', 'backgroundColor', 'borderColor', 'outlineColor'].forEach(function(prop) {
                      var value = computed[prop];
                      if (value && (value.includes('lab(') || value.includes('lch(') || value.includes('oklch(') || value.includes('oklab('))) {
                        // Use a safe fallback color
                        if (prop === 'backgroundColor') {
                          style[prop] = '#ffffff';
                        } else {
                          style[prop] = '#000000';
                        }
                      }
                    });
                  });
                }
              });

              var dataUrl = canvas.toDataURL('image/png');
              var base64 = dataUrl.split(',')[1];

              return {
                screenshot: base64,
                width: canvas.width,
                height: canvas.height
              };
            } catch (html2canvasError) {
              console.warn('[MCP Bridge] html2canvas failed, using fallback:', html2canvasError.message);
              // Fall through to fallback below
            }
          }

          // Fallback: create a simple canvas with page info
          try {
            console.log('[MCP Bridge] Using fallback screenshot method');
            var canvas = document.createElement('canvas');
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#333';
            ctx.font = '16px sans-serif';
            ctx.fillText('Screenshot captured (simplified view)', 20, 40);
            ctx.fillText('Page URL: ' + window.location.href, 20, 70);
            ctx.fillText('Page Title: ' + (document.title || 'Untitled'), 20, 100);
            ctx.fillText('Viewport: ' + window.innerWidth + 'x' + window.innerHeight, 20, 130);

            var dataUrl = canvas.toDataURL('image/png');
            var base64 = dataUrl.split(',')[1];

            return {
              screenshot: base64,
              width: canvas.width,
              height: canvas.height,
              fallback: true
            };
          } catch (fallbackError) {
            console.error('[MCP Bridge] Fallback screenshot also failed:', fallbackError);
            return { error: 'Screenshot failed: ' + (fallbackError.message || fallbackError) };
          }
        }

        // Listen for commands from parent (VS Code webview)
        window.addEventListener('message', async function(event) {
          // Only handle MCP commands
          if (!event.data || event.data.type !== '__claude_mcp_command__') return;

          console.log('[MCP Bridge] Received command:', event.data.command);
          var id = event.data.id;
          var command = event.data.command;
          var params = event.data.params || {};
          var result;

          try {
            switch (command) {
              case 'getText':
                if (params.selector) {
                  var el = document.querySelector(params.selector);
                  result = { text: el ? el.textContent || '' : '' };
                } else {
                  result = { text: document.body.innerText || '' };
                }
                break;

              case 'getHtml':
                if (params.selector) {
                  var el = document.querySelector(params.selector);
                  result = { html: el ? el.outerHTML : '' };
                } else {
                  result = { html: document.documentElement.outerHTML };
                }
                break;

              case 'click':
                var clickEl = document.querySelector(params.selector);
                if (clickEl) {
                  clickEl.click();
                  result = { success: true };
                } else {
                  result = { error: 'Element not found: ' + params.selector };
                }
                break;

              case 'type':
                var inputEl = document.querySelector(params.selector);
                if (inputEl && (inputEl.tagName === 'INPUT' || inputEl.tagName === 'TEXTAREA')) {
                  inputEl.value = params.text;
                  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                  result = { success: true };
                } else {
                  result = { error: 'Input element not found: ' + params.selector };
                }
                break;

              case 'getElements':
                var elements = document.querySelectorAll(params.selector);
                result = {
                  elements: Array.from(elements).map(function(el, i) {
                    return {
                      index: i,
                      tagName: el.tagName.toLowerCase(),
                      id: el.id || undefined,
                      className: el.className || undefined,
                      textContent: (el.textContent || '').substring(0, 100)
                    };
                  })
                };
                break;

              case 'screenshot':
                result = await captureScreenshot();
                break;

              default:
                result = { error: 'Unknown command: ' + command };
            }
          } catch (error) {
            console.error('[MCP Bridge] Command error:', error);
            result = { error: error.message || 'Unknown error' };
          }

          console.log('[MCP Bridge] Sending response for:', command);
          // Send response back to parent
          window.parent.postMessage({
            type: '__claude_mcp_response__',
            id: id,
            result: result
          }, '*');
        });

        // Notify parent that bridge is ready (with small delay to ensure listener is set up)
        setTimeout(function() {
          console.log('[MCP Bridge] Sending ready message');
          window.parent.postMessage({ type: '__claude_mcp_bridge_ready__' }, '*');
        }, 100);
      })();
    </script>
    `;

    // Inject before </body> or </html>, or append to end
    if (html.includes('</body>')) {
      return html.replace('</body>', `${mcpBridgeScript}</body>`);
    } else if (html.includes('</html>')) {
      return html.replace('</html>', `${mcpBridgeScript}</html>`);
    } else {
      return html + mcpBridgeScript;
    }
  }

  /**
   * Create an error page with MCP bridge injected
   * This ensures MCP commands don't timeout even when the target page fails to load
   */
  private createErrorPage(title: string, message: string, url: string): string {
    const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1e1e1e;
      color: #cccccc;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .error-container {
      text-align: center;
      max-width: 600px;
    }
    .error-icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    h1 {
      color: #e06c75;
      font-size: 24px;
      margin-bottom: 16px;
    }
    .error-message {
      color: #abb2bf;
      font-size: 14px;
      background: #2d2d2d;
      padding: 12px 16px;
      border-radius: 6px;
      word-break: break-all;
      margin-bottom: 16px;
    }
    .url {
      color: #61afef;
      font-size: 12px;
      opacity: 0.8;
    }
    .hint {
      color: #98c379;
      font-size: 13px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">⚠️</div>
    <h1>${title}</h1>
    <div class="error-message">${message}</div>
    <div class="url">URL: ${url}</div>
    <div class="hint">Make sure the server is running and accessible.</div>
  </div>
</body>
</html>`;

    // Inject MCP bridge so commands like getUrl, getText still work
    return this.injectMCPBridgeScript(errorHtml);
  }
}
