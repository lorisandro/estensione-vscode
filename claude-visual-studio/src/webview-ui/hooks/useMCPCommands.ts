import { useEffect, RefObject, useRef, useCallback } from 'react';
import { useVSCodeApi } from './useVSCodeApi';
import { useNavigationStore, useEditorStore, type ConsoleLogEntry } from '../state/stores';

interface NavigationActions {
  navigateTo: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  refresh: () => void;
  url: string;
}

interface MCPRequest {
  id: string;
  command: string;
  params: Record<string, any>;
}

// Pending requests waiting for iframe response
const pendingIframeRequests = new Map<string, {
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timeout: NodeJS.Timeout;
}>();

let iframeRequestId = 0;

// Track if the MCP bridge in the iframe is ready
let iframeBridgeReady = false;
let bridgeReadyResolvers: Array<() => void> = [];

// Debounce timer for bridge reset to prevent rapid successive resets
let bridgeResetDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const BRIDGE_RESET_DEBOUNCE_MS = 300;

// Reset bridge ready state (called when iframe is reloaded)
// Uses debounce to prevent rapid successive resets from HMR/file watchers
export function resetIframeBridgeReady() {
  // Immediately mark bridge as not ready so new commands wait
  iframeBridgeReady = false;

  // Debounce the full reset to handle rapid successive refreshes
  if (bridgeResetDebounceTimer) {
    clearTimeout(bridgeResetDebounceTimer);
  }

  bridgeResetDebounceTimer = setTimeout(() => {
    console.log('[MCP] Executing debounced bridge reset');
    bridgeResetDebounceTimer = null;

    // Clear any pending resolvers
    bridgeReadyResolvers = [];

    // Cancel all pending iframe requests - they will never get a response
    // because the iframe has been reloaded with new context
    for (const [id, pending] of pendingIframeRequests.entries()) {
      console.log('[MCP] Cancelling pending request due to bridge reset:', id);
      clearTimeout(pending.timeout);
      pending.reject(new Error('Bridge reset - iframe reloaded'));
    }
    pendingIframeRequests.clear();
  }, BRIDGE_RESET_DEBOUNCE_MS);
}

// Wait for the bridge to be ready (with timeout)
// Increased timeout to 15s to handle dev server restarts
function waitForBridgeReady(timeoutMs: number = 15000): Promise<void> {
  if (iframeBridgeReady) {
    console.log('[MCP] Bridge already ready');
    return Promise.resolve();
  }

  console.log('[MCP] Waiting for bridge to be ready...');
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const index = bridgeReadyResolvers.indexOf(resolve);
      if (index > -1) {
        bridgeReadyResolvers.splice(index, 1);
      }
      console.error('[MCP] Timeout waiting for bridge ready');
      reject(new Error('Timeout waiting for MCP bridge to be ready'));
    }, timeoutMs);

    bridgeReadyResolvers.push(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

// Mark bridge as ready and notify waiters
function markBridgeReady() {
  console.log('[MCP] Marking bridge as ready, notifying', bridgeReadyResolvers.length, 'waiters');
  iframeBridgeReady = true;
  const resolvers = bridgeReadyResolvers;
  bridgeReadyResolvers = [];
  resolvers.forEach(resolve => resolve());
}

// Helper for retry logic with exponential backoff
// Increased delay to 3s to give dev server time to restart
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 3000
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        console.log(`[MCP] Retry ${i + 1}/${maxRetries} after error:`, (error as Error).message);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

/**
 * Hook to handle MCP commands from the extension
 * Executes browser control commands and returns results
 */
export function useMCPCommands(
  iframeRef: RefObject<HTMLIFrameElement>,
  navigation: NavigationActions
) {
  const { onMessage, postMessage } = useVSCodeApi();

  // Use refs to always have access to latest values in callbacks
  const navigationRef = useRef(navigation);
  const iframeRefCurrent = useRef(iframeRef);

  // Keep refs updated
  useEffect(() => {
    navigationRef.current = navigation;
    iframeRefCurrent.current = iframeRef;
  }, [navigation, iframeRef]);

  // Listen for responses from iframe (injected MCP bridge script)
  useEffect(() => {
    const handleIframeResponse = (event: MessageEvent) => {
      // Log all messages for debugging
      if (event.data?.type?.startsWith('__claude')) {
        console.log('[MCP] Received iframe message:', event.data.type, event.data);
      }
      if (event.data?.type === '__claude_mcp_response__') {
        const { id, result } = event.data;
        console.log('[MCP] Got response from iframe:', id, result);
        const pending = pendingIframeRequests.get(id);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingIframeRequests.delete(id);
          pending.resolve(result);
        } else {
          console.warn('[MCP] No pending request found for:', id);
        }
      } else if (event.data?.type === '__claude_mcp_bridge_ready__') {
        console.log('[MCP] MCP bridge ready in iframe!');
        markBridgeReady();
      } else if (event.data?.type === 'console-log') {
        // Handle console logs from the MCP bridge (browser/frontend logs)
        const { payload } = event.data;
        if (payload) {
          useEditorStore.getState().addConsoleLog({
            type: payload.logType as ConsoleLogEntry['type'],
            message: payload.message,
            source: 'browser',
          });
        }
      } else if (event.data?.type === 'backendLog') {
        // Handle backend server logs (Next.js, Vite, etc.)
        const { payload } = event.data;
        if (payload) {
          useEditorStore.getState().addConsoleLog({
            type: payload.type as ConsoleLogEntry['type'],
            message: payload.message,
            source: 'backend',
          });
        }
      } else if (event.data?.type === 'extensionLog') {
        // Handle Extension Host logs
        const { payload } = event.data;
        if (payload) {
          useEditorStore.getState().addConsoleLog({
            type: payload.type as ConsoleLogEntry['type'],
            message: payload.message,
            source: 'extension',
          });
        }
      }
    };

    window.addEventListener('message', handleIframeResponse);
    return () => window.removeEventListener('message', handleIframeResponse);
  }, []);

  // Send command to iframe and wait for response
  const sendToIframe = useCallback(async (command: string, params: Record<string, any> = {}): Promise<any> => {
    // Wait for the MCP bridge to be ready before sending command
    try {
      await waitForBridgeReady(10000);
    } catch (error) {
      console.error('[MCP] Bridge not ready, failing command:', command);
      throw error;
    }

    return new Promise((resolve, reject) => {
      const iframe = iframeRef.current;
      console.log('[MCP] sendToIframe called:', command, 'iframe:', !!iframe, 'contentWindow:', !!iframe?.contentWindow);
      if (!iframe?.contentWindow) {
        console.error('[MCP] Iframe not available for command:', command);
        reject(new Error('Iframe not available'));
        return;
      }

      const id = `iframe_${++iframeRequestId}`;
      console.log('[MCP] Sending to iframe:', id, command, params);
      const timeout = setTimeout(() => {
        console.error('[MCP] Iframe request timeout for:', id, command);
        pendingIframeRequests.delete(id);
        reject(new Error('Iframe request timeout'));
      }, 10000);

      pendingIframeRequests.set(id, { resolve, reject, timeout });

      iframe.contentWindow.postMessage({
        type: '__claude_mcp_command__',
        id,
        command,
        params,
      }, '*');
      console.log('[MCP] Message posted to iframe:', id);
    });
  }, [iframeRef]);

  useEffect(() => {
    console.log('[MCP] useMCPCommands hook initialized, iframeRef:', !!iframeRef.current);
    const cleanup = onMessage((message) => {
      console.log('[MCP] Received message:', message.type, message);
      if (message.type === 'mcpRequest') {
        const request = message.payload as MCPRequest;
        console.log('[MCP] Processing mcpRequest:', request.command, 'iframe available:', !!iframeRef.current);
        handleMCPCommand(request, sendToIframe);
      } else if (message.type === 'navigate') {
        const payload = message.payload as { url?: string; action?: string };
        if (payload.url) {
          navigationRef.current.navigateTo(payload.url);
        } else if (payload.action === 'back') {
          navigationRef.current.goBack();
        } else if (payload.action === 'forward') {
          navigationRef.current.goForward();
        }
      } else if (message.type === 'refreshPreview') {
        navigationRef.current.refresh();
      }
    });

    return cleanup;
  }, [onMessage, sendToIframe]);

  async function handleMCPCommand(
    request: MCPRequest,
    sendToIframe: (command: string, params: Record<string, any>) => Promise<any>
  ) {
    const { id, command, params } = request;
    let result: any;

    try {
      switch (command) {
        case 'getUrl':
          // Get current URL directly from Zustand store
          result = { url: useNavigationStore.getState().url };
          break;

        case 'getHtml':
          // Use postMessage to get HTML from iframe
          result = await sendToIframe('getHtml', { selector: params.selector });
          break;

        case 'getText':
          // Use postMessage to get text from iframe
          result = await sendToIframe('getText', { selector: params.selector });
          break;

        case 'screenshot':
          // Use html2canvas in iframe to capture screenshot
          // Retry logic to handle bridge not ready issues
          result = await withRetry(() => sendToIframe('screenshot', {}), 3, 2000);
          break;

        case 'click':
          // Use postMessage to click element in iframe
          result = await sendToIframe('click', { selector: params.selector });
          break;

        case 'type':
          // Use postMessage to type in iframe
          result = await sendToIframe('type', { selector: params.selector, text: params.text });
          break;

        case 'getElements':
          // Use postMessage to get elements from iframe
          result = await sendToIframe('getElements', { selector: params.selector });
          break;

        case 'getConsoleLogs':
          // Get console logs from iframe
          result = await sendToIframe('getConsoleLogs', {
            filter: params.filter,
            limit: params.limit
          });
          break;

        case 'clearConsoleLogs':
          // Clear console logs in iframe
          result = await sendToIframe('clearConsoleLogs', {});
          break;

        default:
          result = { error: `Unknown command: ${command}` };
      }
    } catch (error) {
      result = { error: (error as Error).message };
    }

    // Send response back to extension
    console.log('[MCP] Sending response for:', command, result);
    postMessage({
      type: 'mcpResponse',
      payload: { id, result },
    });
  }
}

/**
 * Capture screenshot of iframe
 * Note: Due to cross-origin restrictions, returns a message about the limitation
 */
async function captureScreenshot(
  iframeRef: RefObject<HTMLIFrameElement>
): Promise<{ text: string }> {
  // Screenshots of cross-origin content are not possible due to browser security
  // Return a descriptive message instead
  return {
    text: 'Screenshot not available for external pages due to browser security restrictions. The page is loaded and visible in the VS Code browser panel.',
  };
}
