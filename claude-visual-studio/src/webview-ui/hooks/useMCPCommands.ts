import { useEffect, RefObject, useRef } from 'react';
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

  useEffect(() => {
    const cleanup = onMessage((message) => {
      if (message.type === 'mcpRequest') {
        const request = message.payload as MCPRequest;
        handleMCPCommand(request);
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
  }, [onMessage]);

  async function handleMCPCommand(request: MCPRequest) {
    const { id, command, params } = request;
    let result: any;

    try {
      switch (command) {
        case 'getUrl':
          // Get current URL directly from Zustand store to avoid stale closure
          result = { url: useNavigationStore.getState().url };
          break;

        case 'getHtml':
          result = await getIframeHtml(iframeRef, params.selector);
          break;

        case 'getText':
          result = await getIframeText(iframeRef, params.selector);
          break;

        case 'screenshot':
          result = await captureScreenshot(iframeRef);
          break;

        case 'click':
          result = await clickElement(iframeRef, params.selector);
          break;

        case 'type':
          result = await typeInElement(iframeRef, params.selector, params.text);
          break;

        case 'getElements':
          result = await getElements(iframeRef, params.selector);
          break;

        default:
          result = { error: `Unknown command: ${command}` };
      }
    } catch (error) {
      result = { error: (error as Error).message };
    }

    // Send response back to extension
    postMessage({
      type: 'mcpResponse',
      payload: { id, result },
    });
  }
}

/**
 * Get HTML content from iframe
 */
async function getIframeHtml(
  iframeRef: RefObject<HTMLIFrameElement>,
  selector?: string
): Promise<{ html: string }> {
  const iframe = iframeRef.current;
  if (!iframe?.contentDocument) {
    throw new Error('Cannot access iframe content');
  }

  try {
    const doc = iframe.contentDocument;
    if (selector) {
      const element = doc.querySelector(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      return { html: element.outerHTML };
    }
    return { html: doc.documentElement.outerHTML };
  } catch (error) {
    // Cross-origin error - try postMessage approach
    return { html: '[Cannot access content - cross-origin restriction]' };
  }
}

/**
 * Get text content from iframe
 */
async function getIframeText(
  iframeRef: RefObject<HTMLIFrameElement>,
  selector?: string
): Promise<{ text: string }> {
  const iframe = iframeRef.current;
  if (!iframe?.contentDocument) {
    throw new Error('Cannot access iframe content');
  }

  try {
    const doc = iframe.contentDocument;
    if (selector) {
      const element = doc.querySelector(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      return { text: element.textContent || '' };
    }
    return { text: doc.body.innerText || '' };
  } catch (error) {
    return { text: '[Cannot access content - cross-origin restriction]' };
  }
}

/**
 * Capture screenshot of iframe (using html2canvas or similar)
 * Note: Due to security restrictions, this returns a placeholder
 */
async function captureScreenshot(
  iframeRef: RefObject<HTMLIFrameElement>
): Promise<{ image: string }> {
  // Due to cross-origin restrictions, we can't capture external pages
  // For localhost pages, we could use html2canvas
  // For now, return a placeholder indicating the limitation
  return {
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  };
}

/**
 * Click an element in the iframe
 */
async function clickElement(
  iframeRef: RefObject<HTMLIFrameElement>,
  selector: string
): Promise<{ success: boolean }> {
  const iframe = iframeRef.current;
  if (!iframe?.contentDocument) {
    throw new Error('Cannot access iframe content');
  }

  try {
    const element = iframe.contentDocument.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    (element as HTMLElement).click();
    return { success: true };
  } catch (error) {
    throw new Error(`Click failed: ${(error as Error).message}`);
  }
}

/**
 * Type text into an element
 */
async function typeInElement(
  iframeRef: RefObject<HTMLIFrameElement>,
  selector: string,
  text: string
): Promise<{ success: boolean }> {
  const iframe = iframeRef.current;
  if (!iframe?.contentDocument) {
    throw new Error('Cannot access iframe content');
  }

  try {
    const element = iframe.contentDocument.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };
    }
    throw new Error('Element is not an input field');
  } catch (error) {
    throw new Error(`Type failed: ${(error as Error).message}`);
  }
}

/**
 * Get elements matching a selector
 */
async function getElements(
  iframeRef: RefObject<HTMLIFrameElement>,
  selector: string
): Promise<{ elements: any[] }> {
  const iframe = iframeRef.current;
  if (!iframe?.contentDocument) {
    throw new Error('Cannot access iframe content');
  }

  try {
    const elements = iframe.contentDocument.querySelectorAll(selector);
    const result = Array.from(elements).map((el, index) => ({
      index,
      tagName: el.tagName.toLowerCase(),
      id: (el as HTMLElement).id || undefined,
      className: (el as HTMLElement).className || undefined,
      textContent: el.textContent?.substring(0, 100) || undefined,
    }));
    return { elements: result };
  } catch (error) {
    return { elements: [] };
  }
}
