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

// Global singleton for VS Code API - must only be acquired once
let globalVscodeApi: VSCodeApi | null = null;

function getVSCodeApi(): VSCodeApi | null {
  if (globalVscodeApi) {
    return globalVscodeApi;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  // Check if API was already acquired and stored on window
  if ((window as any).vscode) {
    globalVscodeApi = (window as any).vscode;
    return globalVscodeApi;
  }

  // Try to acquire the API, catching any errors
  if (window.acquireVsCodeApi) {
    try {
      globalVscodeApi = window.acquireVsCodeApi();
      // Store it globally for future reference
      (window as any).vscode = globalVscodeApi;
    } catch (e) {
      console.warn('Failed to acquire VS Code API:', e);
      return null;
    }
  }

  return globalVscodeApi;
}

/**
 * Hook to interact with VSCode API
 * Provides methods to send and receive messages from the extension
 */
export const useVSCodeApi = (): UseVSCodeApiReturn => {
  const vscodeApi = useRef<VSCodeApi | null>(getVSCodeApi());
  const messageHandlers = useRef<Set<(message: Message) => void>>(new Set());

  // Initialize VSCode API once
  useEffect(() => {
    if (!vscodeApi.current) {
      vscodeApi.current = getVSCodeApi();
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
