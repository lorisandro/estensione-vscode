import { useEffect, useRef, useCallback } from 'react';
import type { VSCodeApi, WebviewMessage } from '../../shared/types/webview';

// Re-export message type for convenience
export type Message = WebviewMessage;

export interface UseVSCodeApiReturn {
  postMessage: (message: Message) => void;
  onMessage: (handler: (message: Message) => void) => () => void;
  getState: <T = unknown>() => T | undefined;
  setState: <T = unknown>(state: T) => void;
}

/**
 * Hook to interact with VSCode API
 * Provides methods to send and receive messages from the extension
 */
export const useVSCodeApi = (): UseVSCodeApiReturn => {
  const vscodeApi = useRef<VSCodeApi | null>(null);
  const messageHandlers = useRef<Set<(message: Message) => void>>(new Set());

  // Initialize VSCode API once
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use already acquired API if available (from inline script)
      if ((window as any).vscode) {
        vscodeApi.current = (window as any).vscode;
      } else if (window.acquireVsCodeApi) {
        vscodeApi.current = window.acquireVsCodeApi();
      }
    }

    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as Message;
      messageHandlers.current.forEach((handler) => handler(message));
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Post message to extension
  const postMessage = useCallback((message: Message) => {
    if (vscodeApi.current) {
      vscodeApi.current.postMessage(message);
    } else {
      console.warn('VSCode API not available');
    }
  }, []);

  // Register message handler
  const onMessage = useCallback((handler: (message: Message) => void) => {
    messageHandlers.current.add(handler);

    // Return cleanup function
    return () => {
      messageHandlers.current.delete(handler);
    };
  }, []);

  // Get state
  const getState = useCallback(<T = unknown>(): T | undefined => {
    return vscodeApi.current?.getState<T>();
  }, []);

  // Set state
  const setState = useCallback(<T = unknown>(state: T): void => {
    vscodeApi.current?.setState(state);
  }, []);

  return {
    postMessage,
    onMessage,
    getState,
    setState,
  };
};
