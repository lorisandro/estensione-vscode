/**
 * External Browser MCP Server
 *
 * A full-featured MCP server for controlling an external Chrome browser
 * via Chrome DevTools Protocol (CDP). This browser is shared across all
 * Claude Code terminals.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer-core';
import * as fs from 'fs';
import * as path from 'path';

// Browser state
let browser: Browser | null = null;
let currentPage: Page | null = null;

// Configuration
const DEFAULT_DEBUG_PORT = 9222;
const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;

/**
 * Get Chrome debug port from workspace file or use default
 */
function getChromeDebugPort(): number {
  try {
    // Try to read from workspace config file
    const workspaceRoot = process.cwd();
    const portFilePath = path.join(workspaceRoot, '.vscode', '.claude-chrome-debug-port');

    if (fs.existsSync(portFilePath)) {
      const content = fs.readFileSync(portFilePath, 'utf-8');
      const config = JSON.parse(content);
      if (config.port) {
        return config.port;
      }
    }
  } catch (error) {
    console.error('[MCP Browser] Error reading port file:', error);
  }

  return DEFAULT_DEBUG_PORT;
}

/**
 * Find Chrome executable path
 */
function findChromePath(): string {
  const possiblePaths = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean) as string[];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return possiblePaths[1]; // Default to Windows path
}

/**
 * Connect to existing Chrome browser, or launch a new one if not running
 */
async function connectToBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) {
    return browser;
  }

  const debugPort = getChromeDebugPort();
  const browserURL = `http://localhost:${debugPort}`;

  console.error(`[MCP Browser] Connecting to Chrome at ${browserURL}...`);

  try {
    // Try to connect to existing Chrome first
    browser = await puppeteer.connect({
      browserURL,
      defaultViewport: null, // Use actual window size, don't resize
    });

    console.error('[MCP Browser] Connected to existing Chrome successfully');
    return browser;
  } catch (connectError) {
    // Chrome not running, try to launch it
    console.error('[MCP Browser] Chrome not running, launching new instance...');

    try {
      const chromePath = findChromePath();
      console.error(`[MCP Browser] Using Chrome at: ${chromePath}`);

      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        defaultViewport: null, // Use actual window size, not fixed viewport
        args: [
          `--remote-debugging-port=${debugPort}`,
          '--no-first-run',
          '--no-default-browser-check',
          '--start-maximized',
          '--window-size=1920,1080',
        ],
      });

      console.error('[MCP Browser] Launched new Chrome instance successfully');
      return browser;
    } catch (launchError) {
      throw new Error(
        `Failed to connect or launch Chrome. ` +
        `Connect error: ${connectError instanceof Error ? connectError.message : 'Unknown'}. ` +
        `Launch error: ${launchError instanceof Error ? launchError.message : 'Unknown'}`
      );
    }
  }
}

// Track which pages have listeners attached using a Map with page URL as identifier
const pagesWithListeners = new Map<string, boolean>();

/**
 * Get a unique identifier for a page
 */
function getPageId(page: Page): string {
  try {
    // Use target ID if available, otherwise URL
    return page.target()?.url() || page.url() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Attach console log listeners to a page
 */
function attachConsoleListeners(page: Page, force: boolean = false): void {
  const pageId = getPageId(page);

  if (!force && pagesWithListeners.get(pageId)) {
    return; // Already has listeners
  }

  console.error(`[MCP Browser] Attaching console listeners to page: ${pageId}`);

  page.on('console', (msg) => {
    const logEntry = {
      type: msg.type(),
      text: msg.text(),
      timestamp: Date.now()
    };
    consoleLogs.push(logEntry);
    // Limit logs to last 1000 entries to prevent memory issues
    if (consoleLogs.length > 1000) {
      consoleLogs = consoleLogs.slice(-1000);
    }
    console.error(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });

  page.on('pageerror', (error) => {
    const logEntry = {
      type: 'error',
      text: error.message,
      timestamp: Date.now()
    };
    consoleLogs.push(logEntry);
    console.error(`[Browser Error] ${error.message}`);
  });

  // Auto-inject selector toolbar on page load/navigation
  page.on('load', async () => {
    try {
      await page?.evaluate(SELECTOR_SCRIPT);
      console.error('[MCP Browser] Selector toolbar auto-injected');
    } catch (e) {
      // Ignore errors during injection (page might be navigating)
    }
  });

  pagesWithListeners.set(pageId, true);
}

/**
 * Check if a page is still valid and usable
 */
async function isPageValid(page: Page | null): Promise<boolean> {
  if (!page) return false;
  if (page.isClosed()) return false;

  try {
    // Try to access the page - this will throw if detached
    await page.evaluate(() => true);
    return true;
  } catch (e) {
    console.error('[MCP Browser] Page is no longer valid (detached frame)');
    return false;
  }
}

/**
 * Get or create the current page with auto-reconnect
 */
async function getPage(): Promise<Page> {
  const browser = await connectToBrowser();

  // Check if current page is still valid
  if (currentPage && await isPageValid(currentPage)) {
    // Make sure listeners are attached
    attachConsoleListeners(currentPage);
    return currentPage;
  }

  console.error('[MCP Browser] Getting new page reference...');

  const pages = await browser.pages();
  if (pages.length > 0) {
    // Find the first valid page
    for (const page of pages) {
      if (!page.isClosed()) {
        currentPage = page;
        break;
      }
    }
    if (!currentPage || currentPage.isClosed()) {
      currentPage = pages[0];
    }
  } else {
    currentPage = await browser.newPage();
  }

  // Attach console listeners
  attachConsoleListeners(currentPage);

  // Inject selector toolbar immediately if page is already loaded
  try {
    const url = currentPage.url();
    if (url && url !== 'about:blank') {
      await currentPage.evaluate(SELECTOR_SCRIPT);
      console.error('[MCP Browser] Selector toolbar injected on connect');
    }
  } catch (e) {
    // Ignore errors
  }

  return currentPage;
}

/**
 * Define all available tools - using 'browser_' prefix as default
 */
const tools: Tool[] = [
  // Navigation
  {
    name: 'chrome_navigate',
    description: 'Navigate to a URL in the shared external browser (visible to all Claude Code terminals)',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to navigate to' },
        waitUntil: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
          description: 'When to consider navigation complete (default: load)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'chrome_go_back',
    description: 'Go back in browser history',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chrome_go_forward',
    description: 'Go forward in browser history',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chrome_reload',
    description: 'Reload the current page',
    inputSchema: {
      type: 'object',
      properties: {
        ignoreCache: { type: 'boolean', description: 'Bypass cache (default: false)' },
      },
    },
  },

  // Page Information
  {
    name: 'chrome_get_url',
    description: 'Get the current page URL',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chrome_get_title',
    description: 'Get the current page title',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chrome_get_html',
    description: 'Get the HTML content of the page or a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector (optional, returns full page if omitted)' },
        outer: { type: 'boolean', description: 'Include outer HTML (default: true)' },
      },
    },
  },
  {
    name: 'chrome_get_text',
    description: 'Get the text content of the page or a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector (optional, returns full page text if omitted)' },
      },
    },
  },

  // Screenshots
  {
    name: 'chrome_screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', description: 'Capture full scrollable page (default: false)' },
        selector: { type: 'string', description: 'CSS selector to screenshot specific element' },
        path: { type: 'string', description: 'File path to save screenshot (optional)' },
        quality: { type: 'number', description: 'JPEG quality 0-100 (only for jpeg)' },
        type: { type: 'string', enum: ['png', 'jpeg', 'webp'], description: 'Image format (default: png)' },
      },
    },
  },

  // Interaction
  {
    name: 'chrome_click',
    description: 'Click on an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of element to click' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button (default: left)' },
        clickCount: { type: 'number', description: 'Number of clicks (default: 1)' },
        delay: { type: 'number', description: 'Delay between mousedown and mouseup in ms' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'chrome_double_click',
    description: 'Double-click on an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of element to double-click' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'chrome_hover',
    description: 'Hover over an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of element to hover' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'chrome_type',
    description: 'Type text into an input field',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of input element' },
        text: { type: 'string', description: 'Text to type' },
        delay: { type: 'number', description: 'Delay between keystrokes in ms (default: 0)' },
        clear: { type: 'boolean', description: 'Clear field before typing (default: false)' },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'chrome_press_key',
    description: 'Press a keyboard key',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to press (e.g., Enter, Tab, Escape, ArrowDown)' },
        modifiers: {
          type: 'array',
          items: { type: 'string', enum: ['Alt', 'Control', 'Meta', 'Shift'] },
          description: 'Modifier keys to hold',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'chrome_fill_form',
    description: 'Fill multiple form fields at once',
    inputSchema: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              selector: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['selector', 'value'],
          },
          description: 'Array of {selector, value} pairs',
        },
        submit: { type: 'boolean', description: 'Submit form after filling (default: false)' },
      },
      required: ['fields'],
    },
  },

  // Select & Options
  {
    name: 'chrome_select',
    description: 'Select an option from a dropdown',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of select element' },
        value: { type: 'string', description: 'Option value to select' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'chrome_check',
    description: 'Check or uncheck a checkbox',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of checkbox' },
        checked: { type: 'boolean', description: 'Whether to check (true) or uncheck (false)' },
      },
      required: ['selector', 'checked'],
    },
  },

  // Scrolling
  {
    name: 'chrome_scroll',
    description: 'Scroll the page or an element',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Horizontal scroll amount in pixels' },
        y: { type: 'number', description: 'Vertical scroll amount in pixels' },
        selector: { type: 'string', description: 'CSS selector to scroll into view' },
        behavior: { type: 'string', enum: ['auto', 'smooth'], description: 'Scroll behavior' },
      },
    },
  },
  {
    name: 'chrome_scroll_to_bottom',
    description: 'Scroll to the bottom of the page',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chrome_scroll_to_top',
    description: 'Scroll to the top of the page',
    inputSchema: { type: 'object', properties: {} },
  },

  // Wait
  {
    name: 'chrome_wait_for_selector',
    description: 'Wait for an element to appear',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to wait for' },
        timeout: { type: 'number', description: 'Maximum wait time in ms (default: 30000)' },
        visible: { type: 'boolean', description: 'Wait for element to be visible (default: false)' },
        hidden: { type: 'boolean', description: 'Wait for element to be hidden (default: false)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'chrome_wait_for_navigation',
    description: 'Wait for navigation to complete',
    inputSchema: {
      type: 'object',
      properties: {
        timeout: { type: 'number', description: 'Maximum wait time in ms (default: 30000)' },
        waitUntil: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
        },
      },
    },
  },
  {
    name: 'chrome_wait',
    description: 'Wait for a specified amount of time',
    inputSchema: {
      type: 'object',
      properties: {
        ms: { type: 'number', description: 'Time to wait in milliseconds' },
      },
      required: ['ms'],
    },
  },

  // JavaScript Execution
  {
    name: 'chrome_evaluate',
    description: 'Execute JavaScript code in the browser context',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to execute' },
      },
      required: ['code'],
    },
  },

  // Element Query
  {
    name: 'chrome_query_selector',
    description: 'Find elements matching a CSS selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        attributes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Attributes to extract (default: id, class, href, src, alt, title)',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'chrome_get_attribute',
    description: 'Get an attribute value from an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        attribute: { type: 'string', description: 'Attribute name' },
      },
      required: ['selector', 'attribute'],
    },
  },
  {
    name: 'chrome_get_computed_style',
    description: 'Get computed CSS styles of an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        properties: {
          type: 'array',
          items: { type: 'string' },
          description: 'CSS properties to get (optional, returns all if omitted)',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'chrome_get_bounding_box',
    description: 'Get the bounding box (position and size) of an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
      },
      required: ['selector'],
    },
  },

  // Tabs & Windows
  {
    name: 'chrome_new_tab',
    description: 'Open a new browser tab',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open in new tab (optional)' },
      },
    },
  },
  {
    name: 'chrome_close_tab',
    description: 'Close the current tab',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chrome_list_tabs',
    description: 'List all open tabs',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chrome_switch_tab',
    description: 'Switch to a different tab',
    inputSchema: {
      type: 'object',
      properties: {
        index: { type: 'number', description: 'Tab index (0-based)' },
      },
      required: ['index'],
    },
  },

  // Cookies & Storage
  {
    name: 'chrome_get_cookies',
    description: 'Get cookies for the current page',
    inputSchema: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' }, description: 'URLs to get cookies for' },
      },
    },
  },
  {
    name: 'chrome_set_cookie',
    description: 'Set a cookie',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Cookie name' },
        value: { type: 'string', description: 'Cookie value' },
        domain: { type: 'string', description: 'Cookie domain' },
        path: { type: 'string', description: 'Cookie path (default: /)' },
        expires: { type: 'number', description: 'Expiry timestamp' },
        httpOnly: { type: 'boolean', description: 'HTTP only flag' },
        secure: { type: 'boolean', description: 'Secure flag' },
      },
      required: ['name', 'value'],
    },
  },
  {
    name: 'chrome_delete_cookies',
    description: 'Delete cookies',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Cookie name (optional, deletes all if omitted)' },
      },
    },
  },
  {
    name: 'chrome_get_local_storage',
    description: 'Get localStorage items',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to get (optional, returns all if omitted)' },
      },
    },
  },
  {
    name: 'chrome_set_local_storage',
    description: 'Set a localStorage item',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to set' },
        value: { type: 'string', description: 'Value to set' },
      },
      required: ['key', 'value'],
    },
  },

  // PDF & Print
  {
    name: 'chrome_pdf',
    description: 'Generate a PDF of the current page',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to save PDF' },
        format: { type: 'string', enum: ['Letter', 'Legal', 'Tabloid', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'], description: 'Paper format' },
        landscape: { type: 'boolean', description: 'Landscape orientation (default: false)' },
        printBackground: { type: 'boolean', description: 'Print background graphics (default: false)' },
      },
    },
  },

  // Network
  {
    name: 'chrome_set_extra_headers',
    description: 'Set extra HTTP headers for all requests',
    inputSchema: {
      type: 'object',
      properties: {
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Headers to set',
        },
      },
      required: ['headers'],
    },
  },
  {
    name: 'chrome_set_user_agent',
    description: 'Set the browser user agent',
    inputSchema: {
      type: 'object',
      properties: {
        userAgent: { type: 'string', description: 'User agent string' },
      },
      required: ['userAgent'],
    },
  },

  // Viewport & Emulation
  {
    name: 'chrome_set_viewport',
    description: 'Set the viewport size',
    inputSchema: {
      type: 'object',
      properties: {
        width: { type: 'number', description: 'Viewport width in pixels' },
        height: { type: 'number', description: 'Viewport height in pixels' },
        deviceScaleFactor: { type: 'number', description: 'Device scale factor (default: 1)' },
        isMobile: { type: 'boolean', description: 'Enable mobile mode (default: false)' },
        hasTouch: { type: 'boolean', description: 'Enable touch events (default: false)' },
      },
      required: ['width', 'height'],
    },
  },
  {
    name: 'chrome_emulate_device',
    description: 'Emulate a specific device',
    inputSchema: {
      type: 'object',
      properties: {
        device: {
          type: 'string',
          description: 'Device name (e.g., "iPhone 12", "iPad Pro", "Pixel 5")',
        },
      },
      required: ['device'],
    },
  },

  // Console & Logs
  {
    name: 'chrome_get_console_logs',
    description: 'Get console logs from the page',
    inputSchema: {
      type: 'object',
      properties: {
        clear: { type: 'boolean', description: 'Clear logs after getting them (default: false)' },
        limit: { type: 'number', description: 'Maximum number of logs to return (default: 100, max: 1000)' },
        filter: {
          type: 'string',
          enum: ['all', 'log', 'error', 'warn', 'info', 'debug'],
          description: 'Filter logs by type (default: all)'
        },
      },
    },
  },

  // File Upload
  {
    name: 'chrome_upload_file',
    description: 'Upload a file to a file input',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of file input' },
        filePath: { type: 'string', description: 'Path to file to upload' },
      },
      required: ['selector', 'filePath'],
    },
  },

  // Dialog Handling
  {
    name: 'chrome_handle_dialog',
    description: 'Set how to handle dialogs (alert, confirm, prompt)',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['accept', 'dismiss'], description: 'Action to take' },
        promptText: { type: 'string', description: 'Text to enter for prompt dialogs' },
      },
      required: ['action'],
    },
  },

  // Connection Status
  {
    name: 'chrome_status',
    description: 'Get the browser connection status',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chrome_reattach_listeners',
    description: 'Force reattach console log listeners to current page. Use this if logs stopped working after manual navigation.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chrome_disconnect',
    description: 'Disconnect from the browser (does not close it)',
    inputSchema: { type: 'object', properties: {} },
  },

  // Element Selection
  {
    name: 'chrome_enable_selector',
    description: 'Enable element selection mode - adds a floating toolbar with 🎯 icon. Click elements to select them.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chrome_disable_selector',
    description: 'Disable element selection mode and remove the floating toolbar',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chrome_get_selected_element',
    description: 'Get info about the currently selected element (selector, XPath, classes, attributes, text, dimensions)',
    inputSchema: { type: 'object', properties: {} },
  },
];

// Console logs storage
let consoleLogs: Array<{ type: string; text: string; timestamp: number }> = [];

// Element selector injection script with selection and drag modes
const SELECTOR_SCRIPT = `
(function() {
  if (window.__claudeSelectorActive) return;
  window.__claudeSelectorActive = true;
  window.__claudeSelectedElement = null;
  window.__claudeDraggedElement = null;

  // Create floating toolbar
  const toolbar = document.createElement('div');
  toolbar.id = '__claude-selector-toolbar';
  toolbar.innerHTML = \`
    <button id="__claude-minimize-btn" title="Minimize/Expand">◀</button>
    <button id="__claude-selector-btn" title="Select element">🎯</button>
    <button id="__claude-style-btn" title="Edit element styles" style="display:none;">🎨</button>
    <button id="__claude-drag-btn" title="Drag elements">🖐️</button>
    <button id="__claude-copy-btn" title="Copy all changes" style="display:none;">📋</button>
    <span id="__claude-selector-status"></span>
    <span id="__claude-changes-count" style="display:none;background:#ff9500;color:#000;padding:2px 6px;border-radius:10px;font-size:11px;font-weight:bold;"></span>
  \`;
  toolbar.style.cssText = \`
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 2147483647;
    background: #1a1a2e;
    border: 2px solid #00d4ff;
    border-radius: 8px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: #fff;
    box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);
    cursor: move;
  \`;

  const minimizeBtn = toolbar.querySelector('#__claude-minimize-btn');
  const selectBtn = toolbar.querySelector('#__claude-selector-btn');
  const styleBtn = toolbar.querySelector('#__claude-style-btn');
  const dragBtn = toolbar.querySelector('#__claude-drag-btn');
  const copyBtn = toolbar.querySelector('#__claude-copy-btn');
  const status = toolbar.querySelector('#__claude-selector-status');
  const changesCount = toolbar.querySelector('#__claude-changes-count');

  // Track all CSS changes
  window.__claudeChanges = [];

  // Style minimize button
  minimizeBtn.style.cssText = \`
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    padding: 4px;
    color: #888;
    transition: all 0.2s;
  \`;
  minimizeBtn.onmouseenter = () => minimizeBtn.style.color = '#fff';
  minimizeBtn.onmouseleave = () => minimizeBtn.style.color = '#888';

  // Style action buttons
  [selectBtn, styleBtn, dragBtn, copyBtn].forEach(btn => {
    btn.style.cssText = \`
      background: none;
      border: 2px solid transparent;
      font-size: 24px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.2s;
    \`;
    btn.onmouseenter = () => { if (!btn.classList.contains('active')) btn.style.background = 'rgba(255,255,255,0.1)'; };
    btn.onmouseleave = () => { if (!btn.classList.contains('active')) btn.style.background = 'none'; };
  });

  // Function to update changes count badge
  function updateChangesCount() {
    const count = window.__claudeChanges.length;
    if (count > 0) {
      changesCount.textContent = count;
      changesCount.style.display = '';
      copyBtn.style.display = '';
    } else {
      changesCount.style.display = 'none';
      copyBtn.style.display = 'none';
    }
  }

  document.body.appendChild(toolbar);

  // Minimize/expand functionality
  let isMinimized = false;
  minimizeBtn.onclick = () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
      selectBtn.style.display = 'none';
      styleBtn.style.display = 'none';
      dragBtn.style.display = 'none';
      copyBtn.style.display = 'none';
      status.style.display = 'none';
      changesCount.style.display = 'none';
      minimizeBtn.textContent = '🎯';
      minimizeBtn.title = 'Expand toolbar';
      toolbar.style.padding = '6px 10px';
    } else {
      // Restore all main buttons explicitly with inline-block
      selectBtn.style.display = 'inline-block';
      styleBtn.style.display = 'inline-block';
      dragBtn.style.display = 'inline-block';
      status.style.display = 'inline';
      minimizeBtn.textContent = '◀';
      minimizeBtn.title = 'Minimize toolbar';
      toolbar.style.padding = '8px 12px';
      // Show copy button and badge if there are changes
      if (window.__claudeChanges && window.__claudeChanges.length > 0) {
        copyBtn.style.display = 'inline-block';
        changesCount.style.display = 'inline';
        changesCount.textContent = window.__claudeChanges.length;
      }
    }
  };

  // Toolbar drag functionality
  let isToolbarDragging = false;
  let toolbarOffsetX, toolbarOffsetY;
  toolbar.onmousedown = (e) => {
    if (e.target === selectBtn || e.target === styleBtn || e.target === dragBtn || e.target === copyBtn || e.target === minimizeBtn) return;
    isToolbarDragging = true;
    toolbarOffsetX = e.clientX - toolbar.offsetLeft;
    toolbarOffsetY = e.clientY - toolbar.offsetTop;
  };

  // Highlight overlay
  const highlight = document.createElement('div');
  highlight.id = '__claude-selector-highlight';
  highlight.style.cssText = \`
    position: fixed;
    pointer-events: none;
    border: 2px solid #00d4ff;
    background: rgba(0, 212, 255, 0.1);
    z-index: 2147483646;
    display: none;
    transition: all 0.05s ease;
  \`;
  document.body.appendChild(highlight);

  // Info tooltip
  const tooltip = document.createElement('div');
  tooltip.id = '__claude-selector-tooltip';
  tooltip.style.cssText = \`
    position: fixed;
    z-index: 2147483647;
    background: #1a1a2e;
    border: 1px solid #00d4ff;
    border-radius: 4px;
    padding: 6px 10px;
    font-family: monospace;
    font-size: 12px;
    color: #00d4ff;
    display: none;
    max-width: 400px;
    word-break: break-all;
  \`;
  document.body.appendChild(tooltip);

  // CSS Editor Panel (Elementor-style)
  const cssPanel = document.createElement('div');
  cssPanel.id = '__claude-css-panel';
  cssPanel.innerHTML = \`
    <div class="panel-header">
      <span>🎨 Style Editor</span>
      <button id="__claude-panel-close">✕</button>
    </div>
    <div class="panel-content">
      <div class="control-group">
        <label>Font Size</label>
        <div class="control-row">
          <input type="range" id="__css-font-size" min="8" max="72" value="16">
          <input type="number" id="__css-font-size-val" value="16" min="8" max="200">
          <span>px</span>
        </div>
      </div>
      <div class="control-group">
        <label>Line Height</label>
        <div class="control-row">
          <input type="range" id="__css-line-height" min="0.5" max="3" step="0.1" value="1.5">
          <input type="number" id="__css-line-height-val" value="1.5" min="0.5" max="5" step="0.1">
        </div>
      </div>
      <div class="control-group">
        <label>Font Weight</label>
        <select id="__css-font-weight">
          <option value="300">Light (300)</option>
          <option value="400" selected>Normal (400)</option>
          <option value="500">Medium (500)</option>
          <option value="600">Semi Bold (600)</option>
          <option value="700">Bold (700)</option>
          <option value="800">Extra Bold (800)</option>
        </select>
      </div>
      <div class="control-group">
        <label>Text Color</label>
        <div class="control-row">
          <input type="color" id="__css-color" value="#ffffff">
          <input type="text" id="__css-color-val" value="#ffffff" maxlength="7">
        </div>
      </div>
      <div class="control-group">
        <label>Background</label>
        <div class="control-row">
          <input type="color" id="__css-bg-color" value="#000000">
          <input type="text" id="__css-bg-color-val" value="#000000" maxlength="7">
        </div>
      </div>
      <div class="control-group">
        <label>Padding (px)</label>
        <div class="control-row four">
          <input type="number" id="__css-padding-top" placeholder="T" min="0">
          <input type="number" id="__css-padding-right" placeholder="R" min="0">
          <input type="number" id="__css-padding-bottom" placeholder="B" min="0">
          <input type="number" id="__css-padding-left" placeholder="L" min="0">
        </div>
      </div>
      <div class="control-group">
        <label>Margin (px)</label>
        <div class="control-row four">
          <input type="number" id="__css-margin-top" placeholder="T">
          <input type="number" id="__css-margin-right" placeholder="R">
          <input type="number" id="__css-margin-bottom" placeholder="B">
          <input type="number" id="__css-margin-left" placeholder="L">
        </div>
      </div>
      <div class="control-group">
        <label>Border Radius</label>
        <div class="control-row">
          <input type="range" id="__css-border-radius" min="0" max="50" value="0">
          <input type="number" id="__css-border-radius-val" value="0" min="0" max="200">
          <span>px</span>
        </div>
      </div>
    </div>
    <div class="panel-footer">
      <button id="__claude-apply-styles">Apply & Track</button>
    </div>
  \`;
  cssPanel.style.cssText = \`
    position: fixed;
    top: 60px;
    right: 10px;
    width: 280px;
    z-index: 2147483647;
    background: #1a1a2e;
    border: 2px solid #00d4ff;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    color: #fff;
    box-shadow: 0 8px 32px rgba(0, 212, 255, 0.3);
    display: none;
  \`;

  const panelStyles = document.createElement('style');
  panelStyles.textContent = \`
    #__claude-css-panel .panel-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 15px; border-bottom: 1px solid #333; font-weight: 600;
    }
    #__claude-css-panel .panel-header button {
      background: none; border: none; color: #888; cursor: pointer; font-size: 16px;
    }
    #__claude-css-panel .panel-header button:hover { color: #fff; }
    #__claude-css-panel .panel-content { padding: 15px; max-height: 400px; overflow-y: auto; }
    #__claude-css-panel .control-group { margin-bottom: 15px; }
    #__claude-css-panel .control-group label { display: block; margin-bottom: 6px; color: #aaa; font-size: 11px; text-transform: uppercase; }
    #__claude-css-panel .control-row { display: flex; gap: 8px; align-items: center; }
    #__claude-css-panel .control-row.four { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
    #__claude-css-panel input[type="range"] { flex: 1; accent-color: #00d4ff; }
    #__claude-css-panel input[type="number"], #__claude-css-panel input[type="text"] {
      width: 60px; padding: 6px 8px; background: #2a2a3e; border: 1px solid #444;
      border-radius: 4px; color: #fff; font-size: 12px;
    }
    #__claude-css-panel .control-row.four input { width: 100%; text-align: center; }
    #__claude-css-panel input[type="color"] { width: 40px; height: 30px; border: none; border-radius: 4px; cursor: pointer; }
    #__claude-css-panel select {
      width: 100%; padding: 8px; background: #2a2a3e; border: 1px solid #444;
      border-radius: 4px; color: #fff; font-size: 12px;
    }
    #__claude-css-panel .panel-footer { padding: 15px; border-top: 1px solid #333; }
    #__claude-css-panel .panel-footer button {
      width: 100%; padding: 10px; background: linear-gradient(135deg, #00d4ff, #0099cc);
      border: none; border-radius: 6px; color: #fff; font-weight: 600; cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #__claude-css-panel .panel-footer button:hover { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(0, 212, 255, 0.4); }
  \`;
  document.head.appendChild(panelStyles);
  document.body.appendChild(cssPanel);

  let currentEditElement = null;
  let originalStyles = {};

  // Panel close button
  cssPanel.querySelector('#__claude-panel-close').onclick = () => {
    cssPanel.style.display = 'none';
    currentEditElement = null;
    updateButtonState(styleBtn, false, '');
  };

  // Sync range and number inputs
  function syncInputs(rangeId, numId, isFloat = false) {
    const range = cssPanel.querySelector(rangeId);
    const num = cssPanel.querySelector(numId);
    range.oninput = () => { num.value = range.value; applyLivePreview(); };
    num.oninput = () => { range.value = num.value; applyLivePreview(); };
  }
  syncInputs('#__css-font-size', '#__css-font-size-val');
  syncInputs('#__css-line-height', '#__css-line-height-val', true);
  syncInputs('#__css-border-radius', '#__css-border-radius-val');

  // Sync color inputs
  function syncColors(colorId, textId) {
    const color = cssPanel.querySelector(colorId);
    const text = cssPanel.querySelector(textId);
    color.oninput = () => { text.value = color.value; applyLivePreview(); };
    text.oninput = () => { if (/^#[0-9A-Fa-f]{6}\$/.test(text.value)) { color.value = text.value; applyLivePreview(); } };
  }
  syncColors('#__css-color', '#__css-color-val');
  syncColors('#__css-bg-color', '#__css-bg-color-val');

  // Other inputs live preview
  ['#__css-font-weight', '#__css-padding-top', '#__css-padding-right', '#__css-padding-bottom', '#__css-padding-left',
   '#__css-margin-top', '#__css-margin-right', '#__css-margin-bottom', '#__css-margin-left'].forEach(id => {
    const el = cssPanel.querySelector(id);
    if (el) el.oninput = applyLivePreview;
  });

  function applyLivePreview() {
    if (!currentEditElement) return;
    const el = currentEditElement;

    el.style.fontSize = cssPanel.querySelector('#__css-font-size-val').value + 'px';
    el.style.lineHeight = cssPanel.querySelector('#__css-line-height-val').value;
    el.style.fontWeight = cssPanel.querySelector('#__css-font-weight').value;
    el.style.color = cssPanel.querySelector('#__css-color').value;
    el.style.backgroundColor = cssPanel.querySelector('#__css-bg-color').value;
    el.style.borderRadius = cssPanel.querySelector('#__css-border-radius-val').value + 'px';

    const pt = cssPanel.querySelector('#__css-padding-top').value;
    const pr = cssPanel.querySelector('#__css-padding-right').value;
    const pb = cssPanel.querySelector('#__css-padding-bottom').value;
    const pl = cssPanel.querySelector('#__css-padding-left').value;
    if (pt || pr || pb || pl) {
      el.style.padding = (pt||0) + 'px ' + (pr||0) + 'px ' + (pb||0) + 'px ' + (pl||0) + 'px';
    }

    const mt = cssPanel.querySelector('#__css-margin-top').value;
    const mr = cssPanel.querySelector('#__css-margin-right').value;
    const mb = cssPanel.querySelector('#__css-margin-bottom').value;
    const ml = cssPanel.querySelector('#__css-margin-left').value;
    if (mt || mr || mb || ml) {
      el.style.margin = (mt||0) + 'px ' + (mr||0) + 'px ' + (mb||0) + 'px ' + (ml||0) + 'px';
    }
  }

  // Apply and track button
  cssPanel.querySelector('#__claude-apply-styles').onclick = () => {
    if (!currentEditElement) return;

    const selector = getSelector(currentEditElement);
    const newStyles = {
      fontSize: cssPanel.querySelector('#__css-font-size-val').value + 'px',
      lineHeight: cssPanel.querySelector('#__css-line-height-val').value,
      fontWeight: cssPanel.querySelector('#__css-font-weight').value,
      color: cssPanel.querySelector('#__css-color').value,
      backgroundColor: cssPanel.querySelector('#__css-bg-color').value,
      borderRadius: cssPanel.querySelector('#__css-border-radius-val').value + 'px',
    };

    const pt = cssPanel.querySelector('#__css-padding-top').value;
    const pr = cssPanel.querySelector('#__css-padding-right').value;
    const pb = cssPanel.querySelector('#__css-padding-bottom').value;
    const pl = cssPanel.querySelector('#__css-padding-left').value;
    if (pt || pr || pb || pl) newStyles.padding = (pt||0) + 'px ' + (pr||0) + 'px ' + (pb||0) + 'px ' + (pl||0) + 'px';

    const mt = cssPanel.querySelector('#__css-margin-top').value;
    const mr = cssPanel.querySelector('#__css-margin-right').value;
    const mb = cssPanel.querySelector('#__css-margin-bottom').value;
    const ml = cssPanel.querySelector('#__css-margin-left').value;
    if (mt || mr || mb || ml) newStyles.margin = (mt||0) + 'px ' + (mr||0) + 'px ' + (mb||0) + 'px ' + (ml||0) + 'px';

    // Track the style change
    const change = {
      type: 'style',
      selector: selector,
      element: currentEditElement.tagName.toLowerCase(),
      css: newStyles,
      original: originalStyles
    };

    window.__claudeChanges.push(change);
    updateChangesCount();

    status.textContent = 'Styled! (' + window.__claudeChanges.length + ')';
    status.style.color = '#00ff00';
    setTimeout(() => updateStatus(), 1500);

    cssPanel.style.display = 'none';
    updateButtonState(styleBtn, false, '');
  };

  function openCssPanel(el) {
    currentEditElement = el;
    const computed = getComputedStyle(el);

    // Store original styles
    originalStyles = {
      fontSize: computed.fontSize,
      lineHeight: computed.lineHeight,
      fontWeight: computed.fontWeight,
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      padding: computed.padding,
      margin: computed.margin,
      borderRadius: computed.borderRadius
    };

    // Populate panel with current values
    cssPanel.querySelector('#__css-font-size').value = parseInt(computed.fontSize) || 16;
    cssPanel.querySelector('#__css-font-size-val').value = parseInt(computed.fontSize) || 16;
    cssPanel.querySelector('#__css-line-height').value = parseFloat(computed.lineHeight) / parseInt(computed.fontSize) || 1.5;
    cssPanel.querySelector('#__css-line-height-val').value = (parseFloat(computed.lineHeight) / parseInt(computed.fontSize) || 1.5).toFixed(1);
    cssPanel.querySelector('#__css-font-weight').value = computed.fontWeight;

    // Convert rgb to hex
    function rgbToHex(rgb) {
      const match = rgb.match(/\\d+/g);
      if (!match || match.length < 3) return '#000000';
      return '#' + match.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
    }
    cssPanel.querySelector('#__css-color').value = rgbToHex(computed.color);
    cssPanel.querySelector('#__css-color-val').value = rgbToHex(computed.color);
    cssPanel.querySelector('#__css-bg-color').value = rgbToHex(computed.backgroundColor);
    cssPanel.querySelector('#__css-bg-color-val').value = rgbToHex(computed.backgroundColor);

    cssPanel.querySelector('#__css-border-radius').value = parseInt(computed.borderRadius) || 0;
    cssPanel.querySelector('#__css-border-radius-val').value = parseInt(computed.borderRadius) || 0;

    // Parse padding
    const paddings = computed.padding.split(' ').map(p => parseInt(p) || 0);
    cssPanel.querySelector('#__css-padding-top').value = paddings[0] || '';
    cssPanel.querySelector('#__css-padding-right').value = paddings[1] || paddings[0] || '';
    cssPanel.querySelector('#__css-padding-bottom').value = paddings[2] || paddings[0] || '';
    cssPanel.querySelector('#__css-padding-left').value = paddings[3] || paddings[1] || paddings[0] || '';

    // Parse margin
    const margins = computed.margin.split(' ').map(m => parseInt(m) || 0);
    cssPanel.querySelector('#__css-margin-top').value = margins[0] || '';
    cssPanel.querySelector('#__css-margin-right').value = margins[1] || margins[0] || '';
    cssPanel.querySelector('#__css-margin-bottom').value = margins[2] || margins[0] || '';
    cssPanel.querySelector('#__css-margin-left').value = margins[3] || margins[1] || margins[0] || '';

    cssPanel.style.display = 'block';
  }

  let selectionActive = false;
  let dragModeActive = false;
  let dragTarget = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let originalPosition = null;
  let isDraggingElement = false;

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    let path = [];
    while (el && el.nodeType === 1) {
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector = '#' + el.id;
        path.unshift(selector);
        break;
      } else if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\\s+/).filter(c => !c.startsWith('__claude'));
        if (classes.length) selector += '.' + classes.join('.');
      }
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(' > ');
  }

  function getXPath(el) {
    if (!el) return '';
    if (el.id) return '//*[@id="' + el.id + '"]';
    if (el === document.body) return '/html/body';
    let ix = 0;
    const siblings = el.parentNode ? el.parentNode.childNodes : [];
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === el) {
        return getXPath(el.parentNode) + '/' + el.tagName.toLowerCase() + '[' + (ix + 1) + ']';
      }
      if (sibling.nodeType === 1 && sibling.tagName === el.tagName) ix++;
    }
    return '';
  }

  function updateButtonState(btn, active, color) {
    if (active) {
      btn.classList.add('active');
      btn.style.background = color;
      btn.style.borderColor = color;
    } else {
      btn.classList.remove('active');
      btn.style.background = 'none';
      btn.style.borderColor = 'transparent';
    }
  }

  function updateStatus() {
    if (selectionActive && dragModeActive) {
      status.textContent = 'Select + Drag';
      status.style.color = '#ff00ff';
    } else if (selectionActive) {
      status.textContent = 'Select';
      status.style.color = '#00d4ff';
    } else if (dragModeActive) {
      status.textContent = 'Drag';
      status.style.color = '#ff9500';
    } else {
      status.textContent = '';
    }
  }

  // Selection mode handlers
  function handleSelectMouseMove(e) {
    if (!selectionActive || isDraggingElement) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id?.startsWith('__claude-selector') || el.id?.startsWith('__claude-drag')) return;

    const rect = el.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = rect.left + 'px';
    highlight.style.top = rect.top + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    highlight.style.border = '2px solid #00d4ff';
    highlight.style.background = 'rgba(0, 212, 255, 0.1)';

    const selector = getSelector(el);
    tooltip.textContent = selector;
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(e.clientX + 10, window.innerWidth - tooltip.offsetWidth - 10) + 'px';
    tooltip.style.top = Math.min(e.clientY + 10, window.innerHeight - tooltip.offsetHeight - 10) + 'px';
  }

  function handleSelectClick(e) {
    if (!selectionActive || isDraggingElement) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id?.startsWith('__claude-selector') || el.id?.startsWith('__claude-drag')) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = el.getBoundingClientRect();
    window.__claudeSelectedElement = {
      tagName: el.tagName.toLowerCase(),
      id: el.id || null,
      className: el.className || null,
      selector: getSelector(el),
      xpath: getXPath(el),
      text: el.innerText?.substring(0, 200) || null,
      href: el.href || null,
      src: el.src || null,
      attributes: Array.from(el.attributes || []).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {}),
      boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      computedStyles: {
        color: getComputedStyle(el).color,
        backgroundColor: getComputedStyle(el).backgroundColor,
        fontSize: getComputedStyle(el).fontSize,
        fontWeight: getComputedStyle(el).fontWeight,
      }
    };

    highlight.style.border = '3px solid #00ff00';
    highlight.style.background = 'rgba(0, 255, 0, 0.2)';

    // Copy selector to clipboard automatically
    const selectorText = window.__claudeSelectedElement.selector;
    navigator.clipboard.writeText(selectorText).then(() => {
      status.textContent = '📋 Copied! Click 🎨 to style';
      status.style.color = '#00ff00';
      setTimeout(() => updateStatus(), 2500);

      // Show floating notification
      const notif = document.createElement('div');
      notif.textContent = selectorText;
      notif.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#00ff00;color:#000;padding:10px 20px;border-radius:8px;font-family:monospace;font-size:12px;z-index:2147483647;max-width:80%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 4px 20px rgba(0,255,0,0.4);';
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 3000);

      // Show style button when element is selected
      styleBtn.style.display = '';
    }).catch(() => {
      status.textContent = el.tagName.toLowerCase();
      status.style.color = '#00ff00';
      styleBtn.style.display = '';
    });

    console.log('[Claude Selector] Element selected:', window.__claudeSelectedElement);
  }

  // Drag mode handlers
  function handleDragMouseDown(e) {
    if (!dragModeActive || selectionActive) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id?.startsWith('__claude-selector') || el.id?.startsWith('__claude-drag') || el === toolbar) return;

    e.preventDefault();
    e.stopPropagation();

    dragTarget = el;
    isDraggingElement = true;

    const rect = el.getBoundingClientRect();
    const computedStyle = getComputedStyle(el);

    // Store original position info
    originalPosition = {
      position: computedStyle.position,
      left: computedStyle.left,
      top: computedStyle.top,
      transform: computedStyle.transform,
      zIndex: computedStyle.zIndex
    };

    // Set up for dragging
    if (computedStyle.position === 'static') {
      el.style.position = 'relative';
    }
    el.style.zIndex = '999999';
    el.style.cursor = 'grabbing';

    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    highlight.style.display = 'block';
    highlight.style.border = '3px solid #ff9500';
    highlight.style.background = 'rgba(255, 149, 0, 0.2)';

    status.textContent = 'Dragging: ' + el.tagName.toLowerCase();
    status.style.color = '#ff9500';
  }

  function handleDragMouseMove(e) {
    // Handle toolbar dragging
    if (isToolbarDragging) {
      toolbar.style.left = (e.clientX - toolbarOffsetX) + 'px';
      toolbar.style.right = 'auto';
      toolbar.style.top = (e.clientY - toolbarOffsetY) + 'px';
      return;
    }

    // Handle element dragging
    if (!isDraggingElement || !dragTarget) return;

    e.preventDefault();

    const rect = dragTarget.getBoundingClientRect();
    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;

    // Use transform for smooth dragging
    const computedStyle = getComputedStyle(dragTarget);
    const currentLeft = parseFloat(computedStyle.left) || 0;
    const currentTop = parseFloat(computedStyle.top) || 0;

    dragTarget.style.left = (currentLeft + (newX - rect.left)) + 'px';
    dragTarget.style.top = (currentTop + (newY - rect.top)) + 'px';

    // Update highlight position
    const newRect = dragTarget.getBoundingClientRect();
    highlight.style.left = newRect.left + 'px';
    highlight.style.top = newRect.top + 'px';
    highlight.style.width = newRect.width + 'px';
    highlight.style.height = newRect.height + 'px';
  }

  function handleDragMouseUp(e) {
    isToolbarDragging = false;

    if (!isDraggingElement || !dragTarget) return;

    isDraggingElement = false;
    dragTarget.style.cursor = '';
    dragTarget.style.zIndex = originalPosition.zIndex || '';

    const selector = getSelector(dragTarget);
    const computedStyle = getComputedStyle(dragTarget);

    // Track the CSS change
    const change = {
      type: 'position',
      selector: selector,
      element: dragTarget.tagName.toLowerCase(),
      css: {
        position: dragTarget.style.position || computedStyle.position,
        left: dragTarget.style.left,
        top: dragTarget.style.top
      },
      original: {
        position: originalPosition.position,
        left: originalPosition.left,
        top: originalPosition.top
      }
    };

    window.__claudeChanges.push(change);
    updateChangesCount();

    const rect = dragTarget.getBoundingClientRect();
    window.__claudeDraggedElement = {
      tagName: dragTarget.tagName.toLowerCase(),
      selector: selector,
      newPosition: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      originalPosition: originalPosition,
      cssChange: change
    };

    highlight.style.border = '3px solid #00ff00';
    highlight.style.background = 'rgba(0, 255, 0, 0.2)';
    status.textContent = 'Changed! (' + window.__claudeChanges.length + ')';
    status.style.color = '#00ff00';
    setTimeout(() => updateStatus(), 1500);

    console.log('[Claude Drag] CSS change tracked:', change);

    dragTarget = null;
    originalPosition = null;
  }

  // Hover highlight for drag mode
  function handleDragHover(e) {
    if (!dragModeActive || isDraggingElement || selectionActive) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id?.startsWith('__claude-selector') || el.id?.startsWith('__claude-drag') || el === toolbar) return;

    const rect = el.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = rect.left + 'px';
    highlight.style.top = rect.top + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    highlight.style.border = '2px dashed #ff9500';
    highlight.style.background = 'rgba(255, 149, 0, 0.1)';

    tooltip.textContent = 'Drag: ' + getSelector(el);
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(e.clientX + 10, window.innerWidth - tooltip.offsetWidth - 10) + 'px';
    tooltip.style.top = Math.min(e.clientY + 10, window.innerHeight - tooltip.offsetHeight - 10) + 'px';
  }

  // Toggle selection mode
  selectBtn.onclick = () => {
    selectionActive = !selectionActive;
    updateButtonState(selectBtn, selectionActive, 'rgba(0, 212, 255, 0.3)');

    if (selectionActive) {
      document.addEventListener('mousemove', handleSelectMouseMove, true);
      document.addEventListener('click', handleSelectClick, true);
    } else {
      document.removeEventListener('mousemove', handleSelectMouseMove, true);
      document.removeEventListener('click', handleSelectClick, true);
      if (!dragModeActive) {
        highlight.style.display = 'none';
        tooltip.style.display = 'none';
      }
    }
    updateStatus();
  };

  // Style button - open CSS panel for selected element
  styleBtn.onclick = () => {
    if (!window.__claudeSelectedElement) {
      status.textContent = 'Select element first!';
      status.style.color = '#ff4444';
      setTimeout(() => updateStatus(), 1500);
      return;
    }
    // Find the actual DOM element from the selector
    const selector = window.__claudeSelectedElement.selector;
    const el = document.querySelector(selector);
    if (el) {
      openCssPanel(el);
      updateButtonState(styleBtn, true, 'rgba(138, 43, 226, 0.3)');
    }
  };

  // Toggle drag mode
  dragBtn.onclick = () => {
    dragModeActive = !dragModeActive;
    updateButtonState(dragBtn, dragModeActive, 'rgba(255, 149, 0, 0.3)');

    if (dragModeActive) {
      document.addEventListener('mousedown', handleDragMouseDown, true);
      document.addEventListener('mousemove', handleDragMouseMove, true);
      document.addEventListener('mousemove', handleDragHover, true);
      document.addEventListener('mouseup', handleDragMouseUp, true);
    } else {
      document.removeEventListener('mousedown', handleDragMouseDown, true);
      document.removeEventListener('mousemove', handleDragMouseMove, true);
      document.removeEventListener('mousemove', handleDragHover, true);
      document.removeEventListener('mouseup', handleDragMouseUp, true);
      if (!selectionActive) {
        highlight.style.display = 'none';
        tooltip.style.display = 'none';
      }
    }
    updateStatus();
  };

  // Copy all changes as Claude Code prompt
  copyBtn.onclick = () => {
    if (window.__claudeChanges.length === 0) return;

    // Generate prompt from changes
    let prompt = 'Applica queste modifiche CSS ai seguenti elementi:\\n\\n';

    window.__claudeChanges.forEach((change, index) => {
      prompt += (index + 1) + '. Elemento: ' + change.selector + '\\n';
      prompt += '   CSS da applicare:\\n';

      // Handle all CSS properties
      const css = change.css;
      if (css.position && css.position !== 'static') {
        prompt += '   position: ' + css.position + ';\\n';
      }
      if (css.left && css.left !== 'auto') {
        prompt += '   left: ' + css.left + ';\\n';
      }
      if (css.top && css.top !== 'auto') {
        prompt += '   top: ' + css.top + ';\\n';
      }
      if (css.fontSize) {
        prompt += '   font-size: ' + css.fontSize + ';\\n';
      }
      if (css.lineHeight) {
        prompt += '   line-height: ' + css.lineHeight + ';\\n';
      }
      if (css.fontWeight) {
        prompt += '   font-weight: ' + css.fontWeight + ';\\n';
      }
      if (css.color) {
        prompt += '   color: ' + css.color + ';\\n';
      }
      if (css.backgroundColor) {
        prompt += '   background-color: ' + css.backgroundColor + ';\\n';
      }
      if (css.padding) {
        prompt += '   padding: ' + css.padding + ';\\n';
      }
      if (css.margin) {
        prompt += '   margin: ' + css.margin + ';\\n';
      }
      if (css.borderRadius) {
        prompt += '   border-radius: ' + css.borderRadius + ';\\n';
      }
      prompt += '\\n';
    });

    navigator.clipboard.writeText(prompt).then(() => {
      status.textContent = '📋 Prompt copied!';
      status.style.color = '#00ff00';

      // Show notification with prompt preview
      const notif = document.createElement('div');
      notif.innerHTML = '<strong>Prompt copiato!</strong><br><small>' + window.__claudeChanges.length + ' modifiche - Incolla in Claude Code</small>';
      notif.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#00ff00;color:#000;padding:15px 25px;border-radius:8px;font-family:sans-serif;font-size:14px;z-index:2147483647;text-align:center;box-shadow:0 4px 20px rgba(0,255,0,0.4);';
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 3000);

      // Clear changes after copying
      window.__claudeChanges = [];
      updateChangesCount();
      setTimeout(() => updateStatus(), 1500);
    });
  };

  window.__claudeDisableSelector = () => {
    selectionActive = false;
    dragModeActive = false;
    toolbar.remove();
    highlight.remove();
    tooltip.remove();
    cssPanel.remove();
    panelStyles.remove();
    document.removeEventListener('mousemove', handleSelectMouseMove, true);
    document.removeEventListener('click', handleSelectClick, true);
    document.removeEventListener('mousedown', handleDragMouseDown, true);
    document.removeEventListener('mousemove', handleDragMouseMove, true);
    document.removeEventListener('mousemove', handleDragHover, true);
    document.removeEventListener('mouseup', handleDragMouseUp, true);
    window.__claudeSelectorActive = false;
  };
})();
`;

/**
 * Handle tool calls
 */
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  const page = await getPage();

  switch (name) {
    // Navigation
    case 'chrome_navigate': {
      const { url, waitUntil = 'load' } = args as { url: string; waitUntil?: string };
      await page.goto(url, { waitUntil: waitUntil as any });
      // Auto-inject selector toolbar after navigation
      await page.evaluate(SELECTOR_SCRIPT);
      return { success: true, url: page.url(), title: await page.title(), selectorInjected: true };
    }

    case 'chrome_go_back': {
      await page.goBack();
      return { success: true, url: page.url() };
    }

    case 'chrome_go_forward': {
      await page.goForward();
      return { success: true, url: page.url() };
    }

    case 'chrome_reload': {
      const { ignoreCache = false } = args as { ignoreCache?: boolean };
      if (ignoreCache) {
        await page.reload({ waitUntil: 'load' });
      } else {
        await page.reload();
      }
      // Re-inject selector toolbar after reload
      await page.evaluate(SELECTOR_SCRIPT);
      return { success: true, url: page.url(), selectorInjected: true };
    }

    // Page Information
    case 'chrome_get_url': {
      return { url: page.url() };
    }

    case 'chrome_get_title': {
      return { title: await page.title() };
    }

    case 'chrome_get_html': {
      const { selector, outer = true } = args as { selector?: string; outer?: boolean };
      if (selector) {
        const element = await page.$(selector);
        if (!element) throw new Error(`Element not found: ${selector}`);
        const html = outer
          ? await element.evaluate((el) => el.outerHTML)
          : await element.evaluate((el) => el.innerHTML);
        return { html };
      }
      const html = await page.content();
      return { html };
    }

    case 'chrome_get_text': {
      const { selector } = args as { selector?: string };
      if (selector) {
        const element = await page.$(selector);
        if (!element) throw new Error(`Element not found: ${selector}`);
        const text = await element.evaluate((el) => el.textContent);
        return { text };
      }
      const text = await page.evaluate(() => document.body.innerText);
      return { text };
    }

    // Screenshots
    case 'chrome_screenshot': {
      const { fullPage = false, selector, path: filePath, quality, type = 'png' } = args as {
        fullPage?: boolean;
        selector?: string;
        path?: string;
        quality?: number;
        type?: 'png' | 'jpeg' | 'webp';
      };

      const options: any = { type, fullPage };
      if (quality && type === 'jpeg') options.quality = quality;
      if (filePath) options.path = filePath;

      let screenshot: string | Buffer;
      if (selector) {
        const element = await page.$(selector);
        if (!element) throw new Error(`Element not found: ${selector}`);
        screenshot = await element.screenshot({ ...options, encoding: 'base64' });
      } else {
        screenshot = await page.screenshot({ ...options, encoding: 'base64' });
      }

      return {
        success: true,
        path: filePath || null,
        base64: screenshot,
        type,
      };
    }

    // Interaction
    case 'chrome_click': {
      const { selector, button = 'left', clickCount = 1, delay } = args as {
        selector: string;
        button?: 'left' | 'right' | 'middle';
        clickCount?: number;
        delay?: number;
      };
      await page.click(selector, { button, clickCount, delay });
      return { success: true, selector };
    }

    case 'chrome_double_click': {
      const { selector } = args as { selector: string };
      await page.click(selector, { clickCount: 2 });
      return { success: true, selector };
    }

    case 'chrome_hover': {
      const { selector } = args as { selector: string };
      await page.hover(selector);
      return { success: true, selector };
    }

    case 'chrome_type': {
      const { selector, text, delay = 0, clear = false } = args as {
        selector: string;
        text: string;
        delay?: number;
        clear?: boolean;
      };
      if (clear) {
        await page.click(selector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
      }
      await page.type(selector, text, { delay });
      return { success: true, selector, text };
    }

    case 'chrome_press_key': {
      const { key, modifiers = [] } = args as { key: string; modifiers?: string[] };
      for (const mod of modifiers) {
        await page.keyboard.down(mod as any);
      }
      await page.keyboard.press(key as any);
      for (const mod of modifiers.reverse()) {
        await page.keyboard.up(mod as any);
      }
      return { success: true, key, modifiers };
    }

    case 'chrome_fill_form': {
      const { fields, submit = false } = args as {
        fields: Array<{ selector: string; value: string }>;
        submit?: boolean;
      };
      for (const field of fields) {
        await page.type(field.selector, field.value);
      }
      if (submit) {
        await page.keyboard.press('Enter');
      }
      return { success: true, fieldsCount: fields.length };
    }

    // Select & Options
    case 'chrome_select': {
      const { selector, value } = args as { selector: string; value: string };
      await page.select(selector, value);
      return { success: true, selector, value };
    }

    case 'chrome_check': {
      const { selector, checked } = args as { selector: string; checked: boolean };
      const isChecked = await page.$eval(selector, (el) => (el as HTMLInputElement).checked);
      if (isChecked !== checked) {
        await page.click(selector);
      }
      return { success: true, selector, checked };
    }

    // Scrolling
    case 'chrome_scroll': {
      const { x = 0, y = 0, selector, behavior = 'auto' } = args as {
        x?: number;
        y?: number;
        selector?: string;
        behavior?: 'auto' | 'smooth';
      };
      if (selector) {
        await page.$eval(selector, (el, opts) => {
          el.scrollIntoView({ behavior: opts.behavior as ScrollBehavior });
        }, { behavior });
      } else {
        await page.evaluate(
          (opts) => window.scrollBy({ left: opts.x, top: opts.y, behavior: opts.behavior as ScrollBehavior }),
          { x, y, behavior }
        );
      }
      return { success: true };
    }

    case 'chrome_scroll_to_bottom': {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      return { success: true };
    }

    case 'chrome_scroll_to_top': {
      await page.evaluate(() => window.scrollTo(0, 0));
      return { success: true };
    }

    // Wait
    case 'chrome_wait_for_selector': {
      const { selector, timeout = 30000, visible = false, hidden = false } = args as {
        selector: string;
        timeout?: number;
        visible?: boolean;
        hidden?: boolean;
      };
      await page.waitForSelector(selector, { timeout, visible, hidden });
      return { success: true, selector };
    }

    case 'chrome_wait_for_navigation': {
      const { timeout = 30000, waitUntil = 'load' } = args as {
        timeout?: number;
        waitUntil?: string;
      };
      await page.waitForNavigation({ timeout, waitUntil: waitUntil as any });
      return { success: true, url: page.url() };
    }

    case 'chrome_wait': {
      const { ms } = args as { ms: number };
      await new Promise((resolve) => setTimeout(resolve, ms));
      return { success: true, waited: ms };
    }

    // JavaScript Execution
    case 'chrome_evaluate': {
      const { code } = args as { code: string };
      const result = await page.evaluate(code);
      return { result };
    }

    // Element Query
    case 'chrome_query_selector': {
      const { selector, attributes = ['id', 'class', 'href', 'src', 'alt', 'title'] } = args as {
        selector: string;
        attributes?: string[];
      };
      const elements = await page.$$eval(
        selector,
        (els, attrs) =>
          els.map((el) => {
            const result: Record<string, string | null> = {
              tagName: el.tagName.toLowerCase(),
              textContent: el.textContent?.trim().substring(0, 100) || null,
            };
            for (const attr of attrs) {
              result[attr] = el.getAttribute(attr);
            }
            return result;
          }),
        attributes
      );
      return { elements, count: elements.length };
    }

    case 'chrome_get_attribute': {
      const { selector, attribute } = args as { selector: string; attribute: string };
      const value = await page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
      return { attribute, value };
    }

    case 'chrome_get_computed_style': {
      const { selector, properties } = args as { selector: string; properties?: string[] };
      const styles = await page.$eval(
        selector,
        (el, props) => {
          const computed = window.getComputedStyle(el);
          if (props && props.length > 0) {
            const result: Record<string, string> = {};
            for (const prop of props) {
              result[prop] = computed.getPropertyValue(prop);
            }
            return result;
          }
          const result: Record<string, string> = {};
          for (let i = 0; i < computed.length; i++) {
            const prop = computed[i];
            result[prop] = computed.getPropertyValue(prop);
          }
          return result;
        },
        properties
      );
      return { styles };
    }

    case 'chrome_get_bounding_box': {
      const { selector } = args as { selector: string };
      const box = await page.$eval(selector, (el) => {
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
        };
      });
      return { boundingBox: box };
    }

    // Tabs & Windows
    case 'chrome_new_tab': {
      const { url } = args as { url?: string };
      const browser = await connectToBrowser();
      currentPage = await browser.newPage();
      if (url) {
        await currentPage.goto(url);
      }
      return { success: true, url: currentPage.url() };
    }

    case 'chrome_close_tab': {
      await page.close();
      currentPage = null;
      return { success: true };
    }

    case 'chrome_list_tabs': {
      const browser = await connectToBrowser();
      const pages = await browser.pages();
      const tabs = await Promise.all(
        pages.map(async (p, i) => ({
          index: i,
          url: p.url(),
          title: await p.title(),
          isCurrent: p === currentPage,
        }))
      );
      return { tabs };
    }

    case 'chrome_switch_tab': {
      const { index } = args as { index: number };
      const browser = await connectToBrowser();
      const pages = await browser.pages();
      if (index < 0 || index >= pages.length) {
        throw new Error(`Invalid tab index: ${index}. Available: 0-${pages.length - 1}`);
      }
      currentPage = pages[index];
      await currentPage.bringToFront();
      // Attach console listeners to the new tab
      attachConsoleListeners(currentPage);
      return { success: true, url: currentPage.url(), listenersAttached: true };
    }

    // Cookies & Storage
    case 'chrome_get_cookies': {
      const { urls } = args as { urls?: string[] };
      const cookies = await page.cookies(...(urls || []));
      return { cookies };
    }

    case 'chrome_set_cookie': {
      const { name, value, domain, path: cookiePath = '/', expires, httpOnly, secure } = args as {
        name: string;
        value: string;
        domain?: string;
        path?: string;
        expires?: number;
        httpOnly?: boolean;
        secure?: boolean;
      };
      await page.setCookie({
        name,
        value,
        domain: domain || new URL(page.url()).hostname,
        path: cookiePath,
        expires,
        httpOnly,
        secure,
      });
      return { success: true, name };
    }

    case 'chrome_delete_cookies': {
      const { name } = args as { name?: string };
      const cookies = await page.cookies();
      const toDelete = name ? cookies.filter((c) => c.name === name) : cookies;
      for (const cookie of toDelete) {
        await page.deleteCookie(cookie);
      }
      return { success: true, deleted: toDelete.length };
    }

    case 'chrome_get_local_storage': {
      const { key } = args as { key?: string };
      const storage = await page.evaluate((k) => {
        if (k) {
          return { [k]: localStorage.getItem(k) };
        }
        const items: Record<string, string | null> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) items[key] = localStorage.getItem(key);
        }
        return items;
      }, key);
      return { localStorage: storage };
    }

    case 'chrome_set_local_storage': {
      const { key, value } = args as { key: string; value: string };
      await page.evaluate(
        (k, v) => {
          localStorage.setItem(k, v);
        },
        key,
        value
      );
      return { success: true, key };
    }

    // PDF
    case 'chrome_pdf': {
      const { path: filePath, format = 'A4', landscape = false, printBackground = false } = args as {
        path?: string;
        format?: string;
        landscape?: boolean;
        printBackground?: boolean;
      };
      const pdfBuffer = await page.pdf({
        path: filePath,
        format: format as any,
        landscape,
        printBackground,
      });
      return {
        success: true,
        path: filePath || null,
        base64: filePath ? null : pdfBuffer.toString('base64'),
      };
    }

    // Network
    case 'chrome_set_extra_headers': {
      const { headers } = args as { headers: Record<string, string> };
      await page.setExtraHTTPHeaders(headers);
      return { success: true, headers: Object.keys(headers) };
    }

    case 'chrome_set_user_agent': {
      const { userAgent } = args as { userAgent: string };
      await page.setUserAgent(userAgent);
      return { success: true, userAgent };
    }

    // Viewport & Emulation
    case 'chrome_set_viewport': {
      const { width, height, deviceScaleFactor = 1, isMobile = false, hasTouch = false } = args as {
        width: number;
        height: number;
        deviceScaleFactor?: number;
        isMobile?: boolean;
        hasTouch?: boolean;
      };
      await page.setViewport({ width, height, deviceScaleFactor, isMobile, hasTouch });
      return { success: true, viewport: { width, height } };
    }

    case 'chrome_emulate_device': {
      const { device } = args as { device: string };
      const devices = puppeteer.devices;
      const deviceConfig = devices[device as keyof typeof devices];
      if (!deviceConfig) {
        const available = Object.keys(devices).slice(0, 20).join(', ');
        throw new Error(`Unknown device: ${device}. Some available: ${available}...`);
      }
      await page.emulate(deviceConfig);
      return { success: true, device, viewport: deviceConfig.viewport };
    }

    // Console Logs
    case 'chrome_get_console_logs': {
      const { clear = false, limit = 100, filter = 'all' } = args as {
        clear?: boolean;
        limit?: number;
        filter?: 'all' | 'log' | 'error' | 'warn' | 'info' | 'debug';
      };

      // Filter logs by type if specified
      let filteredLogs = filter === 'all'
        ? [...consoleLogs]
        : consoleLogs.filter(log => log.type === filter);

      // Apply limit (max 1000)
      const effectiveLimit = Math.min(limit, 1000);
      const totalCount = filteredLogs.length;
      filteredLogs = filteredLogs.slice(-effectiveLimit);

      if (clear) {
        consoleLogs = [];
      }

      return {
        logs: filteredLogs,
        count: filteredLogs.length,
        totalCount,
        filtered: filter !== 'all',
        truncated: totalCount > effectiveLimit
      };
    }

    // File Upload
    case 'chrome_upload_file': {
      const { selector, filePath } = args as { selector: string; filePath: string };
      const input = await page.$(selector);
      if (!input) throw new Error(`File input not found: ${selector}`);
      await (input as ElementHandle<HTMLInputElement>).uploadFile(filePath);
      return { success: true, selector, filePath };
    }

    // Dialog Handling
    case 'chrome_handle_dialog': {
      const { action, promptText } = args as { action: 'accept' | 'dismiss'; promptText?: string };
      page.on('dialog', async (dialog) => {
        if (action === 'accept') {
          await dialog.accept(promptText);
        } else {
          await dialog.dismiss();
        }
      });
      return { success: true, action };
    }

    // Status
    case 'chrome_status': {
      const connected = browser?.isConnected() ?? false;
      const debugPort = getChromeDebugPort();
      return {
        connected,
        debugPort,
        currentUrl: connected ? page.url() : null,
        currentTitle: connected ? await page.title() : null,
        consoleLogs: consoleLogs.length,
      };
    }

    case 'chrome_reattach_listeners': {
      // Force invalidate current page reference and get fresh one
      const oldPage = currentPage;
      const oldUrl = oldPage?.url() || null;
      currentPage = null;

      // Clear the listeners tracking map
      pagesWithListeners.clear();

      const browser = await connectToBrowser();
      const pages = await browser.pages();

      // Find a valid page (preferably the one that's in front)
      for (const p of pages) {
        if (!p.isClosed()) {
          currentPage = p;
          // Force re-attach listeners
          attachConsoleListeners(currentPage, true);
          break;
        }
      }

      if (!currentPage) {
        throw new Error('No valid pages found in browser');
      }

      return {
        success: true,
        url: currentPage.url(),
        message: 'Console listeners reattached to current page',
        previousUrl: oldUrl,
        listenersCleared: true
      };
    }

    case 'chrome_disconnect': {
      if (browser) {
        browser.disconnect();
        browser = null;
        currentPage = null;
      }
      return { success: true, message: 'Disconnected from browser' };
    }

    // Element Selection Tools
    case 'chrome_enable_selector': {
      await page.evaluate(SELECTOR_SCRIPT);
      return {
        success: true,
        message: 'Selector toolbar injected. Click 🎯 to toggle selection mode, 🖐️ to toggle drag mode.'
      };
    }

    case 'chrome_disable_selector': {
      await page.evaluate(() => {
        if ((window as any).__claudeDisableSelector) {
          (window as any).__claudeDisableSelector();
        }
      });
      return { success: true, message: 'Selector toolbar removed' };
    }

    case 'chrome_get_selected_element': {
      const selectedElement = await page.evaluate(() => (window as any).__claudeSelectedElement);
      const draggedElement = await page.evaluate(() => (window as any).__claudeDraggedElement);
      return {
        selectedElement: selectedElement || null,
        draggedElement: draggedElement || null,
        message: selectedElement ? 'Element found' : 'No element selected. Use chrome_enable_selector first and click an element.'
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.error('[MCP Browser] Starting External Browser MCP Server...');

  const server = new Server(
    {
      name: 'claude-browser',
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
    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await handleToolCall(name, args || {});
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[MCP Browser] Error in ${name}:`, errorMessage);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
        isError: true,
      };
    }
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP Browser] Server started and ready for connections');
}

// Run the server
main().catch((error) => {
  console.error('[MCP Browser] Fatal error:', error);
  process.exit(1);
});
