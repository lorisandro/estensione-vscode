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
 * Connect to existing Chrome browser
 */
async function connectToBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) {
    return browser;
  }

  const debugPort = getChromeDebugPort();
  const browserURL = `http://localhost:${debugPort}`;

  console.error(`[MCP Browser] Connecting to Chrome at ${browserURL}...`);

  try {
    browser = await puppeteer.connect({
      browserURL,
      defaultViewport: {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
      },
    });

    console.error('[MCP Browser] Connected to Chrome successfully');
    return browser;
  } catch (error) {
    throw new Error(
      `Failed to connect to Chrome. Make sure Chrome is running with --remote-debugging-port=${debugPort}. ` +
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get or create the current page
 */
async function getPage(): Promise<Page> {
  const browser = await connectToBrowser();

  if (currentPage && !currentPage.isClosed()) {
    return currentPage;
  }

  const pages = await browser.pages();
  if (pages.length > 0) {
    currentPage = pages[0];
  } else {
    currentPage = await browser.newPage();
  }

  // Set up console log capture
  currentPage.on('console', (msg) => {
    console.error(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });

  currentPage.on('pageerror', (error) => {
    console.error(`[Browser Error] ${error.message}`);
  });

  return currentPage;
}

/**
 * Define all available tools
 */
const tools: Tool[] = [
  // Navigation
  {
    name: 'chrome_navigate',
    description: 'Navigate to a URL in the browser',
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
    name: 'chrome_disconnect',
    description: 'Disconnect from the browser (does not close it)',
    inputSchema: { type: 'object', properties: {} },
  },
];

// Console logs storage
let consoleLogs: Array<{ type: string; text: string; timestamp: number }> = [];

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
      return { success: true, url: page.url(), title: await page.title() };
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
      return { success: true, url: page.url() };
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
      return { success: true, url: currentPage.url() };
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
      const { clear = false } = args as { clear?: boolean };
      const logs = [...consoleLogs];
      if (clear) {
        consoleLogs = [];
      }
      return { logs, count: logs.length };
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
