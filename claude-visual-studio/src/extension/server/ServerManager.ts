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

  // Store extracted styled-jsx CSS to inject into HTML
  private extractedStyledJsxCss: Map<string, string> = new Map();

  // Track the current served HTML file for Page Builder text editing
  private currentServedFile: string | null = null;

  // Callback when an HTML file is served (for Page Builder integration)
  public onHtmlFileServed: ((filePath: string) => void) | null = null;

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
   * Get the current served HTML file path
   */
  getCurrentServedFile(): string | null {
    return this.currentServedFile;
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
        const newOrigin = `${parsedUrl.protocol}//${parsedUrl.host}`;

        // Only clear CSS when navigating to a different origin (new site)
        // Don't clear on every proxy request, as JS files extract CSS during loading
        if (this.lastProxiedOrigin !== newOrigin) {
          this.clearExtractedStyledJsxCss();
          this.lastProxiedOrigin = newOrigin;
        }

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
              'Referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
              'Origin': `${parsedUrl.protocol}//${parsedUrl.host}`,
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

            // Disable caching to always get fresh content
            headers['cache-control'] = 'no-cache, no-store, must-revalidate';
            headers['pragma'] = 'no-cache';
            headers['expires'] = '0';

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
              } else if (contentType.includes('javascript') || parsedUrl.pathname.endsWith('.js')) {
                // For JavaScript content, extract styled-jsx CSS
                const jsContent = body.toString('utf-8');
                this.extractStyledJsxCss(jsContent);
                res.send(body);
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

    // Endpoint to retrieve extracted styled-jsx CSS
    // This is called by the MCP bridge after JS files have loaded
    this.app.get('/__claude-vs__/styled-jsx-css', (req, res) => {
      const css = this.getExtractedStyledJsxStyles();
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(css);
      console.log(`[ServerManager] Served styled-jsx CSS (${this.extractedStyledJsxCss.size} rules)`);
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
              'Referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
              'Origin': `${parsedUrl.protocol}//${parsedUrl.host}`,
            },
          },
          (proxyRes) => {
            // Copy headers
            const headers = { ...proxyRes.headers };
            delete headers['transfer-encoding'];
            delete headers['content-encoding'];

            // Disable caching to always get fresh content
            headers['cache-control'] = 'no-cache, no-store, must-revalidate';
            headers['pragma'] = 'no-cache';
            headers['expires'] = '0';

            res.status(proxyRes.statusCode || 200);
            Object.entries(headers).forEach(([key, value]) => {
              if (value) {
                res.setHeader(key, value as string);
              }
            });

            // For JavaScript files, collect body and extract styled-jsx CSS
            const contentType = proxyRes.headers['content-type'] || '';
            const isJavaScript = contentType.includes('javascript') || req.originalUrl.endsWith('.js');

            if (isJavaScript) {
              const chunks: Buffer[] = [];
              proxyRes.on('data', (chunk) => chunks.push(chunk));
              proxyRes.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf-8');

                // Extract styled-jsx CSS from the JavaScript
                this.extractStyledJsxCss(body);

                res.send(body);
              });
            } else {
              // Pipe non-JS responses directly
              proxyRes.pipe(res);
            }
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
          // Track the served HTML file for Page Builder
          this.currentServedFile = filePath;
          console.log('[ServerManager] Serving HTML file:', filePath);

          // Notify callback if set
          if (this.onHtmlFileServed) {
            this.onHtmlFileServed(filePath);
          }

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

    // Create the script injection with cache control meta tags
    const inspectorScript = `
    <!-- Claude Visual Studio: Universal Visibility Fix for iframe -->
    <script id="__claude-vs-visibility-fix__">
    (function() {
      'use strict';

      // Force all hidden elements to be visible
      // This is necessary because Intersection Observer doesn't work in VS Code webview

      function forceVisible(el) {
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('transform', 'none', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
      }

      function hideCurtains() {
        var selectors = '[class*="curtain"], [class*="preloader"], [class*="loading-screen"]';
        document.querySelectorAll(selectors).forEach(function(el) {
          el.style.setProperty('display', 'none', 'important');
        });
      }

      function fixPage() {
        hideCurtains();

        // Fix all elements with inline opacity/transform
        document.querySelectorAll('[style]').forEach(function(el) {
          var style = el.getAttribute('style') || '';
          if (style.includes('opacity') || style.includes('transform')) {
            forceVisible(el);
          }
        });

        // Fix elements with computed low opacity
        document.querySelectorAll('body *').forEach(function(el) {
          try {
            var cs = getComputedStyle(el);
            if (parseFloat(cs.opacity) < 0.5 && (el.children.length > 0 || el.textContent.trim())) {
              forceVisible(el);
            }
          } catch(e) {}
        });

        // Fix common animation classes
        document.querySelectorAll('[class*="hero-"], [class*="fade-"], [class*="slide-"], [class*="animate-"]').forEach(forceVisible);
      }

      // Run multiple times to catch dynamically added content
      fixPage();
      document.addEventListener('DOMContentLoaded', fixPage);
      window.addEventListener('load', fixPage);
      [100, 300, 500, 1000, 2000].forEach(function(ms) { setTimeout(fixPage, ms); });

      console.log('[Claude VS] Visibility fix active');
    })();
    </script>
    <style id="__claude-vs-animation-fallback__">
      /* Hide curtains */
      [class*="curtain"] { display: none !important; }

      /* Force visibility */
      [style*="opacity: 0"], [style*="opacity:0"] { opacity: 1 !important; transform: none !important; }
      [class*="hero-content"], [class*="hero-reveal"] { opacity: 1 !important; transform: none !important; }
    </style>
    <!-- Claude Visual Studio: Cache Control -->
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
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

    // Get any extracted styled-jsx CSS to inject
    const styledJsxStyles = this.getExtractedStyledJsxStyles();

    // Combine styled-jsx CSS with inspector script
    const allInjections = styledJsxStyles + inspectorScript;

    // Try to inject before </head>, fallback to before </body>, or append to end
    if (htmlContent.includes('</head>')) {
      return htmlContent.replace('</head>', `${allInjections}</head>`);
    } else if (htmlContent.includes('</body>')) {
      return htmlContent.replace('</body>', `${allInjections}</body>`);
    } else {
      return htmlContent + allInjections;
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
        // styled-jsx CSS injection polyfill
        // This ensures styled-jsx CSS works even if the normal runtime fails
        (function() {
          var injectedStyles = {};
          var serverPort = window.location.port || '3333';
          var cssEndpoint = 'http://localhost:' + serverPort + '/__claude-vs__/styled-jsx-css';


          // Fetch and inject extracted styled-jsx CSS from server
          // The server extracts CSS from JS files as they pass through the proxy
          function fetchAndInjectStyledJsxCss() {
            fetch(cssEndpoint)
              .then(function(response) {
                return response.text();
              })
              .then(function(css) {
                if (css && css.trim().length > 0) {
                  // Check if we already have this CSS injected
                  var existingStyle = document.getElementById('__claude-vs-styled-jsx__');
                  if (existingStyle) {
                    // Update existing style
                    if (existingStyle.textContent !== css) {
                      existingStyle.textContent = css;
                      console.log('[Claude VS] Updated styled-jsx CSS from server');
                    }
                  } else {
                    // Create new style element
                    var style = document.createElement('style');
                    style.id = '__claude-vs-styled-jsx__';
                    style.textContent = css;
                    document.head.appendChild(style);
                    console.log('[Claude VS] Injected styled-jsx CSS from server');
                  }
                }
              })
              .catch(function(err) {
                // Silently ignore errors - CSS endpoint may not be ready yet
              });
          }

          // Monitor for styled-jsx style elements being created
          var originalCreateElement = document.createElement.bind(document);
          document.createElement = function(tagName) {
            var element = originalCreateElement(tagName);

            // If it's a style element, track it
            if (tagName.toLowerCase() === 'style') {
              // Watch for styled-jsx id being set
              var originalSetAttribute = element.setAttribute.bind(element);
              element.setAttribute = function(name, value) {
                originalSetAttribute(name, value);

                // styled-jsx uses id attribute with the hash
                if (name === 'id' && value && value.match(/^jsx-[a-f0-9]+$|^__jsx-style-[a-f0-9]+$/)) {
                  // Ensure this style gets into the document
                  setTimeout(function() {
                    if (!element.parentNode && element.textContent) {
                      document.head.appendChild(element);
                      console.log('[Claude VS] Recovered styled-jsx CSS:', value);
                    }
                  }, 100);
                }
              };
            }

            return element;
          };

          // styled-jsx CSS is extracted from JS files as they load through the proxy
          // Poll until CSS is found, then do a few more checks and stop
          var cssFound = false;
          var retryCount = 0;
          var maxRetries = 20; // Max retries before giving up
          var postCssRetries = 0;
          var maxPostCssRetries = 3; // Only 3 more checks after CSS is found
          var lastCssHash = '';

          function fetchWithRetry() {
            // Stop if we've done enough post-CSS retries
            if (cssFound && postCssRetries >= maxPostCssRetries) return;
            if (!cssFound && retryCount >= maxRetries) return;

            if (cssFound) {
              postCssRetries++;
            } else {
              retryCount++;
            }

            fetch(cssEndpoint)
              .then(function(response) { return response.text(); })
              .then(function(css) {
                if (css && css.trim().length > 0) {
                  // Compute a simple hash to detect changes
                  var cssHash = css.length + '-' + css.substring(0, 100);

                  var existingStyle = document.getElementById('__claude-vs-styled-jsx__');
                  if (existingStyle) {
                    // Update if CSS changed
                    if (cssHash !== lastCssHash) {
                      existingStyle.textContent = css;
                      lastCssHash = cssHash;
                      console.log('[Claude VS] Updated styled-jsx CSS from server');
                    }
                  } else {
                    // Create new style element
                    var style = document.createElement('style');
                    style.id = '__claude-vs-styled-jsx__';
                    style.textContent = css;
                    document.head.appendChild(style);
                    lastCssHash = cssHash;
                    cssFound = true;
                    console.log('[Claude VS] Injected styled-jsx CSS from server');
                  }

                  // Continue polling briefly to catch late CSS extractions
                  if (postCssRetries < maxPostCssRetries) {
                    setTimeout(fetchWithRetry, 500);
                  }
                } else if (!cssFound && retryCount < maxRetries) {
                  // CSS not ready yet, retry quickly
                  setTimeout(fetchWithRetry, 150);
                }
              })
              .catch(function() {
                if (!cssFound && retryCount < maxRetries) {
                  setTimeout(fetchWithRetry, 200);
                }
              });
          }

          // Start fetching after a small delay to let JS files load
          setTimeout(fetchWithRetry, 100);
        })();

        // Console log interception - capture all console output
        var consoleLogs = [];
        var maxLogs = 1000; // Limit to prevent memory issues

        // Store original console methods
        var originalConsole = {
          log: console.log.bind(console),
          error: console.error.bind(console),
          warn: console.warn.bind(console),
          info: console.info.bind(console),
          debug: console.debug.bind(console)
        };

        // Helper to serialize arguments safely
        function serializeArgs(args) {
          return Array.from(args).map(function(arg) {
            if (arg === null) return 'null';
            if (arg === undefined) return 'undefined';
            if (typeof arg === 'string') return arg;
            if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
            if (arg instanceof Error) return arg.name + ': ' + arg.message + (arg.stack ? '\\n' + arg.stack : '');
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }).join(' ');
        }

        // Intercept console methods
        ['log', 'error', 'warn', 'info', 'debug'].forEach(function(method) {
          console[method] = function() {
            // Call original method
            originalConsole[method].apply(console, arguments);

            // Serialize the message
            var message = serializeArgs(arguments);

            // Skip only internal MCP Bridge initialization logs
            if (message.indexOf('[MCP Bridge] Initializing') === 0) return;
            if (message.indexOf('[MCP Bridge] html2canvas loaded') === 0) return;
            if (message.indexOf('[MCP Bridge] Sending ready') === 0) return;
            if (message.indexOf('[MCP Bridge] Received command') === 0) return;
            if (message.indexOf('[MCP Bridge] Sending response') === 0) return;
            if (message.indexOf('[Element Inspector]') === 0) return;
            if (message.indexOf('[Claude VS HMR]') === 0) return;

            var logEntry = {
              type: method,
              message: message,
              timestamp: Date.now(),
              url: window.location.href
            };

            // Store the log entry
            consoleLogs.push(logEntry);

            // Trim old logs if exceeding limit
            if (consoleLogs.length > maxLogs) {
              consoleLogs = consoleLogs.slice(-maxLogs);
            }

            // Send log to parent in real-time for ConsolePanel display
            window.parent.postMessage({
              type: 'console-log',
              payload: {
                logType: method,
                message: message,
                timestamp: logEntry.timestamp
              }
            }, '*');
          };
        });

        // Also capture uncaught errors
        window.addEventListener('error', function(event) {
          var errorMessage = 'Uncaught Error: ' + event.message + ' at ' + event.filename + ':' + event.lineno + ':' + event.colno;
          var logEntry = {
            type: 'error',
            message: errorMessage,
            timestamp: Date.now(),
            url: window.location.href,
            stack: event.error ? event.error.stack : null
          };
          consoleLogs.push(logEntry);

          // Send to parent in real-time
          window.parent.postMessage({
            type: 'console-log',
            payload: {
              logType: 'error',
              message: errorMessage + (logEntry.stack ? '\\n' + logEntry.stack : ''),
              timestamp: logEntry.timestamp
            }
          }, '*');
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', function(event) {
          var reason = event.reason;
          var message = 'Unhandled Promise Rejection: ';
          if (reason instanceof Error) {
            message += reason.message;
          } else if (typeof reason === 'string') {
            message += reason;
          } else {
            try {
              message += JSON.stringify(reason);
            } catch (e) {
              message += String(reason);
            }
          }
          var stack = reason instanceof Error ? reason.stack : null;
          var logEntry = {
            type: 'error',
            message: message,
            timestamp: Date.now(),
            url: window.location.href,
            stack: stack
          };
          consoleLogs.push(logEntry);

          // Send to parent in real-time
          window.parent.postMessage({
            type: 'console-log',
            payload: {
              logType: 'error',
              message: message + (stack ? '\\n' + stack : ''),
              timestamp: logEntry.timestamp
            }
          }, '*');
        });

        originalConsole.log('[MCP Bridge] Initializing...');

        // Send a welcome message to ConsolePanel to show it's working
        setTimeout(function() {
          console.info('Console connected - logs from this page will appear here');
        }, 200);

        // Load html2canvas-pro dynamically (supports modern CSS colors: oklab, oklch, lab, lch)
        // Save to a unique variable to avoid conflicts with pages that load their own html2canvas
        var html2canvasLoaded = false;
        var html2canvasPro = null;
        var html2canvasLoadPromise = new Promise(function(resolve, reject) {
          var html2canvasScript = document.createElement('script');
          html2canvasScript.src = 'https://unpkg.com/html2canvas-pro@1.5.13/dist/html2canvas-pro.min.js';
          html2canvasScript.onload = function() {
            // Immediately save reference before page scripts can overwrite it
            html2canvasPro = window.html2canvas;
            html2canvasLoaded = true;
            console.log('[MCP Bridge] html2canvas-pro loaded and saved to isolated variable');
            resolve(true);
          };
          html2canvasScript.onerror = function(e) {
            console.error('[MCP Bridge] html2canvas-pro failed to load from CDN');
            reject(new Error('Failed to load html2canvas-pro'));
          };
          document.head.appendChild(html2canvasScript);

          // Timeout after 10 seconds
          setTimeout(function() {
            if (!html2canvasLoaded) {
              reject(new Error('html2canvas-pro load timeout'));
            }
          }, 10000);
        });

        // Maximum dimension allowed by Claude API (using 7900 for safety margin)
        var MAX_SCREENSHOT_DIMENSION = 7900;

        // Resize canvas if any dimension exceeds max allowed size
        function resizeCanvasIfNeeded(canvas) {
          var width = canvas.width;
          var height = canvas.height;

          // Check if resizing is needed (strict check)
          if (width < MAX_SCREENSHOT_DIMENSION && height < MAX_SCREENSHOT_DIMENSION) {
            return canvas;
          }

          // Calculate scale to fit within max dimensions with safety margin
          var scale = Math.min(
            (MAX_SCREENSHOT_DIMENSION - 1) / width,
            (MAX_SCREENSHOT_DIMENSION - 1) / height
          );
          var newWidth = Math.floor(width * scale);
          var newHeight = Math.floor(height * scale);

          // Ensure we never exceed the limit
          newWidth = Math.min(newWidth, MAX_SCREENSHOT_DIMENSION - 1);
          newHeight = Math.min(newHeight, MAX_SCREENSHOT_DIMENSION - 1);

          console.log('[MCP Bridge] Resizing screenshot from ' + width + 'x' + height + ' to ' + newWidth + 'x' + newHeight);

          // Create resized canvas
          var resizedCanvas = document.createElement('canvas');
          resizedCanvas.width = newWidth;
          resizedCanvas.height = newHeight;

          var ctx = resizedCanvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
          }

          return resizedCanvas;
        }

        // Screenshot function with proper wait for html2canvas
        async function captureScreenshot() {
          console.log('[MCP Bridge] Starting screenshot capture...');

          // Wait for html2canvas to load (with timeout)
          try {
            await Promise.race([
              html2canvasLoadPromise,
              new Promise(function(_, reject) {
                setTimeout(function() { reject(new Error('html2canvas wait timeout')); }, 5000);
              })
            ]);
          } catch (loadError) {
            console.warn('[MCP Bridge] html2canvas not available:', loadError.message);
          }

          // Try html2canvas-pro if available (supports modern CSS colors)
          // Use our saved reference to avoid conflicts with page's html2canvas
          if (typeof html2canvasPro === 'function') {
            console.log('[MCP Bridge] Using html2canvas-pro for screenshot');

            try {
              // Calculate scale that won't exceed max dimensions
              var dpr = window.devicePixelRatio || 1;
              var bodyWidth = document.body.scrollWidth || window.innerWidth;
              var bodyHeight = document.body.scrollHeight || window.innerHeight;

              // Use conservative limit (100px safety margin)
              var safeLimit = MAX_SCREENSHOT_DIMENSION - 100;

              // Calculate scale ensuring BOTH dimensions stay under limit
              var scale = Math.min(
                safeLimit / bodyWidth,
                safeLimit / bodyHeight,
                dpr  // Don't exceed device pixel ratio
              );

              console.log('[MCP Bridge] Calculated scale:', scale, '(dpr:', dpr, ', body:', bodyWidth, 'x', bodyHeight, ', safeLimit:', safeLimit, ')');

              var canvas = await html2canvasPro(document.body, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                scale: scale,
                logging: false,
                imageTimeout: 15000,
                removeContainer: true,
                foreignObjectRendering: false,
                onclone: function(clonedDoc) {
                  console.log('[MCP Bridge] html2canvas-pro cloning document...');
                  // Fix fixed positioning
                  var fixedElements = clonedDoc.querySelectorAll('[style*="position: fixed"]');
                  fixedElements.forEach(function(el) {
                    el.style.position = 'absolute';
                  });
                  console.log('[MCP Bridge] html2canvas-pro clone ready');
                }
              });

              console.log('[MCP Bridge] html2canvas-pro render complete, canvas size:', canvas.width, 'x', canvas.height);

              // Double-check and resize if still too large
              var finalCanvas = resizeCanvasIfNeeded(canvas);

              var dataUrl = finalCanvas.toDataURL('image/png');
              var base64 = dataUrl.split(',')[1];

              if (base64 && base64.length > 100) {
                console.log('[MCP Bridge] Screenshot captured successfully, final size:', finalCanvas.width, 'x', finalCanvas.height, ', base64 length:', base64.length);
                return {
                  screenshot: base64,
                  width: finalCanvas.width,
                  height: finalCanvas.height
                };
              } else {
                throw new Error('Canvas produced empty or invalid image');
              }
            } catch (html2canvasError) {
              console.error('[MCP Bridge] html2canvas-pro failed:', html2canvasError.message, html2canvasError.stack);
              // Continue to native canvas fallback
            }
          } else {
            console.warn('[MCP Bridge] html2canvas-pro not available (typeof:', typeof html2canvasPro, ')');
          }

          // Native Canvas API fallback - try to capture visible viewport
          console.log('[MCP Bridge] Using native canvas fallback...');
          try {
            var canvas = document.createElement('canvas');
            var width = Math.min(window.innerWidth, 1920);
            var height = Math.min(window.innerHeight, 1080);
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');

            // Draw white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            // Draw page info
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillText('Screenshot Preview', 20, 40);

            ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = '#666666';
            ctx.fillText('URL: ' + window.location.href, 20, 70);
            ctx.fillText('Title: ' + (document.title || 'Untitled'), 20, 95);
            ctx.fillText('Size: ' + window.innerWidth + ' x ' + window.innerHeight + 'px', 20, 120);

            // Draw a border
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, width - 20, height - 20);

            // Add timestamp
            ctx.fillStyle = '#999999';
            ctx.font = '12px monospace';
            ctx.fillText('Captured: ' + new Date().toISOString(), 20, height - 20);

            // Note about limitation
            ctx.fillStyle = '#cc6600';
            ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillText('Note: Full visual capture requires html2canvas', 20, 150);
            ctx.fillText('The page content is visible in the VS Code preview panel', 20, 170);

            var dataUrl = canvas.toDataURL('image/png');
            var base64 = dataUrl.split(',')[1];

            console.log('[MCP Bridge] Fallback screenshot created');
            return {
              screenshot: base64,
              width: canvas.width,
              height: canvas.height,
              fallback: true,
              note: 'Native canvas fallback - html2canvas failed or unavailable'
            };
          } catch (fallbackError) {
            console.error('[MCP Bridge] Fallback screenshot failed:', fallbackError);
            return { error: 'Screenshot failed: ' + (fallbackError.message || String(fallbackError)) };
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

              case 'getConsoleLogs':
                // Return captured console logs
                var filter = params.filter; // 'all', 'error', 'warn', 'log', 'info', 'debug'
                var limit = params.limit || 100;
                var filteredLogs = consoleLogs;
                if (filter && filter !== 'all') {
                  filteredLogs = consoleLogs.filter(function(log) {
                    return log.type === filter;
                  });
                }
                // Return most recent logs up to limit
                result = {
                  logs: filteredLogs.slice(-limit),
                  total: filteredLogs.length,
                  truncated: filteredLogs.length > limit
                };
                break;

              case 'clearConsoleLogs':
                // Clear the console logs buffer
                consoleLogs = [];
                result = { success: true, message: 'Console logs cleared' };
                break;

              case 'getAllResources':
                // Extract ALL resources from the page
                var resources = {
                  stylesheets: [],
                  scripts: [],
                  images: [],
                  fonts: [],
                  videos: [],
                  audios: [],
                  iframes: [],
                  links: [],
                  meta: []
                };

                // Get all stylesheets (link tags)
                document.querySelectorAll('link[rel="stylesheet"], link[type="text/css"]').forEach(function(el) {
                  resources.stylesheets.push({
                    href: el.href || el.getAttribute('href'),
                    media: el.media || undefined,
                    type: 'external'
                  });
                });

                // Get all style tags (inline CSS)
                document.querySelectorAll('style').forEach(function(el, i) {
                  resources.stylesheets.push({
                    content: el.textContent,
                    id: el.id || 'style-' + i,
                    type: 'inline'
                  });
                });

                // Get all scripts
                document.querySelectorAll('script').forEach(function(el, i) {
                  if (el.src) {
                    resources.scripts.push({
                      src: el.src,
                      type: el.type || 'text/javascript',
                      async: el.async,
                      defer: el.defer,
                      scriptType: 'external'
                    });
                  } else if (el.textContent && el.textContent.trim()) {
                    resources.scripts.push({
                      content: el.textContent.substring(0, 5000), // Limit inline script size
                      id: el.id || 'script-' + i,
                      type: el.type || 'text/javascript',
                      scriptType: 'inline',
                      truncated: el.textContent.length > 5000
                    });
                  }
                });

                // Get all images
                document.querySelectorAll('img').forEach(function(el) {
                  resources.images.push({
                    src: el.src,
                    alt: el.alt || undefined,
                    width: el.naturalWidth || el.width,
                    height: el.naturalHeight || el.height,
                    srcset: el.srcset || undefined
                  });
                });

                // Get background images from inline styles
                document.querySelectorAll('[style*="background"]').forEach(function(el) {
                  var style = el.getAttribute('style') || '';
                  var match = style.match(/url\\(['"]*([^'"\\)]+)['"]*\\)/);
                  if (match) {
                    resources.images.push({
                      src: match[1],
                      type: 'background-image',
                      element: el.tagName.toLowerCase()
                    });
                  }
                });

                // Get all videos
                document.querySelectorAll('video, source[type^="video"]').forEach(function(el) {
                  resources.videos.push({
                    src: el.src || el.getAttribute('src'),
                    type: el.type || undefined,
                    poster: el.poster || undefined
                  });
                });

                // Get all audio
                document.querySelectorAll('audio, source[type^="audio"]').forEach(function(el) {
                  resources.audios.push({
                    src: el.src || el.getAttribute('src'),
                    type: el.type || undefined
                  });
                });

                // Get all iframes
                document.querySelectorAll('iframe').forEach(function(el) {
                  resources.iframes.push({
                    src: el.src,
                    width: el.width,
                    height: el.height,
                    title: el.title || undefined
                  });
                });

                // Get all links (anchors)
                document.querySelectorAll('a[href]').forEach(function(el) {
                  resources.links.push({
                    href: el.href,
                    text: (el.textContent || '').substring(0, 100),
                    target: el.target || undefined,
                    rel: el.rel || undefined
                  });
                });

                // Get all meta tags
                document.querySelectorAll('meta').forEach(function(el) {
                  resources.meta.push({
                    name: el.name || undefined,
                    property: el.getAttribute('property') || undefined,
                    content: el.content || undefined,
                    httpEquiv: el.httpEquiv || undefined,
                    charset: el.getAttribute('charset') || undefined
                  });
                });

                // Get fonts from @font-face in stylesheets
                try {
                  Array.from(document.styleSheets).forEach(function(sheet) {
                    try {
                      Array.from(sheet.cssRules || []).forEach(function(rule) {
                        if (rule.type === CSSRule.FONT_FACE_RULE) {
                          var fontRule = rule;
                          resources.fonts.push({
                            family: fontRule.style.getPropertyValue('font-family'),
                            src: fontRule.style.getPropertyValue('src'),
                            weight: fontRule.style.getPropertyValue('font-weight') || undefined,
                            style: fontRule.style.getPropertyValue('font-style') || undefined
                          });
                        }
                      });
                    } catch (e) {
                      // Cross-origin stylesheet, skip
                    }
                  });
                } catch (e) {}

                // Get preload/prefetch links
                document.querySelectorAll('link[rel="preload"], link[rel="prefetch"], link[rel="preconnect"]').forEach(function(el) {
                  resources.fonts.push({
                    href: el.href,
                    rel: el.rel,
                    as: el.getAttribute('as') || undefined,
                    crossorigin: el.getAttribute('crossorigin') || undefined
                  });
                });

                result = {
                  url: window.location.href,
                  title: document.title,
                  resources: resources,
                  counts: {
                    stylesheets: resources.stylesheets.length,
                    scripts: resources.scripts.length,
                    images: resources.images.length,
                    fonts: resources.fonts.length,
                    videos: resources.videos.length,
                    audios: resources.audios.length,
                    iframes: resources.iframes.length,
                    links: resources.links.length,
                    meta: resources.meta.length
                  }
                };
                break;

              case 'getAllStyles':
                // Extract all CSS styles from the page
                var allStyles = {
                  external: [],
                  inline: [],
                  computed: []
                };

                // Get external stylesheets content
                Array.from(document.styleSheets).forEach(function(sheet, i) {
                  try {
                    var rules = Array.from(sheet.cssRules || []).map(function(rule) {
                      return rule.cssText;
                    }).join('\\n');
                    allStyles.external.push({
                      href: sheet.href || 'inline-' + i,
                      rules: rules,
                      ruleCount: sheet.cssRules ? sheet.cssRules.length : 0
                    });
                  } catch (e) {
                    // Cross-origin stylesheet
                    allStyles.external.push({
                      href: sheet.href,
                      error: 'Cross-origin: cannot access rules',
                      ruleCount: 0
                    });
                  }
                });

                // Get inline styles from elements
                document.querySelectorAll('[style]').forEach(function(el) {
                  var selector = el.tagName.toLowerCase();
                  if (el.id) selector += '#' + el.id;
                  if (el.className) selector += '.' + String(el.className).split(' ').join('.');
                  allStyles.inline.push({
                    selector: selector,
                    style: el.getAttribute('style')
                  });
                });

                // Get computed styles for key elements (limited to avoid huge output)
                var keySelectors = ['body', 'header', 'nav', 'main', 'footer', 'h1', 'h2', 'p', 'a', 'button'];
                keySelectors.forEach(function(sel) {
                  var el = document.querySelector(sel);
                  if (el) {
                    var cs = getComputedStyle(el);
                    allStyles.computed.push({
                      selector: sel,
                      styles: {
                        color: cs.color,
                        backgroundColor: cs.backgroundColor,
                        fontFamily: cs.fontFamily,
                        fontSize: cs.fontSize,
                        fontWeight: cs.fontWeight,
                        lineHeight: cs.lineHeight,
                        margin: cs.margin,
                        padding: cs.padding,
                        display: cs.display,
                        position: cs.position
                      }
                    });
                  }
                });

                result = {
                  url: window.location.href,
                  styles: allStyles,
                  counts: {
                    externalSheets: allStyles.external.length,
                    inlineStyles: allStyles.inline.length,
                    computedSamples: allStyles.computed.length
                  }
                };
                break;

              case 'getAllScripts':
                // Extract all JavaScript from the page
                var allScripts = {
                  external: [],
                  inline: [],
                  eventHandlers: []
                };

                // Get external scripts
                document.querySelectorAll('script[src]').forEach(function(el) {
                  allScripts.external.push({
                    src: el.src,
                    type: el.type || 'text/javascript',
                    async: el.async,
                    defer: el.defer,
                    integrity: el.integrity || undefined,
                    crossorigin: el.getAttribute('crossorigin') || undefined
                  });
                });

                // Get inline scripts with full content
                document.querySelectorAll('script:not([src])').forEach(function(el, i) {
                  if (el.textContent && el.textContent.trim()) {
                    allScripts.inline.push({
                      id: el.id || 'inline-script-' + i,
                      type: el.type || 'text/javascript',
                      content: el.textContent,
                      length: el.textContent.length
                    });
                  }
                });

                // Get inline event handlers (onclick, onload, etc.)
                var eventAttrs = ['onclick', 'onload', 'onsubmit', 'onchange', 'oninput', 'onmouseover', 'onmouseout', 'onfocus', 'onblur', 'onkeydown', 'onkeyup'];
                eventAttrs.forEach(function(attr) {
                  document.querySelectorAll('[' + attr + ']').forEach(function(el) {
                    var selector = el.tagName.toLowerCase();
                    if (el.id) selector += '#' + el.id;
                    allScripts.eventHandlers.push({
                      selector: selector,
                      event: attr,
                      handler: el.getAttribute(attr)
                    });
                  });
                });

                result = {
                  url: window.location.href,
                  scripts: allScripts,
                  counts: {
                    external: allScripts.external.length,
                    inline: allScripts.inline.length,
                    eventHandlers: allScripts.eventHandlers.length,
                    totalInlineSize: allScripts.inline.reduce(function(sum, s) { return sum + s.length; }, 0)
                  }
                };
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
   * Extract styled-jsx CSS from JavaScript content
   * styled-jsx embeds CSS in JavaScript with a pattern like: id: "hash", children: "css"
   */
  private extractStyledJsxCss(jsContent: string): void {
    // Match styled-jsx pattern: { id: "hash", children: "css" }
    // The pattern in Turbopack looks like: __["default"], {\n    id: "hash",\n    children: "CSS_STRING"
    // Use a more flexible regex that handles newlines and whitespace
    const styledJsxPattern = /\["default"\],\s*\{\s*id:\s*"([a-f0-9]+)",\s*children:\s*"([^"]+)"/g;

    let match;
    while ((match = styledJsxPattern.exec(jsContent)) !== null) {
      const cssId = match[1];
      const cssContent = match[2];

      // Unescape the CSS content (it's escaped for JavaScript string)
      const unescapedCss = cssContent
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');

      if (!this.extractedStyledJsxCss.has(cssId)) {
        this.extractedStyledJsxCss.set(cssId, unescapedCss);
        console.log(`[ServerManager] Extracted styled-jsx CSS: ${cssId} (${unescapedCss.length} chars)`);
      }
    }
  }

  /**
   * Get all extracted styled-jsx CSS as a single style tag
   */
  private getExtractedStyledJsxStyles(): string {
    if (this.extractedStyledJsxCss.size === 0) {
      return '';
    }

    const allCss = Array.from(this.extractedStyledJsxCss.values()).join('\n');
    return `
    <!-- Claude Visual Studio: Extracted styled-jsx CSS -->
    <style id="__claude-vs-styled-jsx__">
${allCss}
    </style>`;
  }

  /**
   * Clear extracted styled-jsx CSS (called when navigating to new page)
   */
  private clearExtractedStyledJsxCss(): void {
    this.extractedStyledJsxCss.clear();
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
