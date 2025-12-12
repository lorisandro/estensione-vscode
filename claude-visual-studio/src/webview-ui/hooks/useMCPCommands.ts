import { useEffect, RefObject, useRef, useCallback } from 'react';
import { useVSCodeApi } from './useVSCodeApi';
import { useNavigationStore } from '../state/stores';

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
      if (event.data?.type === '__claude_mcp_response__') {
        const { id, result } = event.data;
        const pending = pendingIframeRequests.get(id);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingIframeRequests.delete(id);
          pending.resolve(result);
        }
      }
    };

    window.addEventListener('message', handleIframeResponse);
    return () => window.removeEventListener('message', handleIframeResponse);
  }, []);

  // Send command to iframe and wait for response
  const sendToIframe = useCallback((command: string, params: Record<string, any> = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) {
        reject(new Error('Iframe not available'));
        return;
      }

      const id = `iframe_${++iframeRequestId}`;
      const timeout = setTimeout(() => {
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
    });
  }, [iframeRef]);

  useEffect(() => {
    console.log('[MCP] useMCPCommands hook initialized');
    const cleanup = onMessage((message) => {
      console.log('[MCP] Received message:', message.type);
      if (message.type === 'mcpRequest') {
        const request = message.payload as MCPRequest;
        console.log('[MCP] Processing mcpRequest:', request.command);
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
          // Screenshot still has limitations, return info message
          result = await captureScreenshot(iframeRef);
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
