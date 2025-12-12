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

// Global singleton for VS Code API
let globalVscodeApi: VSCodeApi | null = null;

// State storage for fallback mode
let fallbackState: unknown = undefined;

// Create a fallback API that uses postMessage directly
function createFallbackApi(): VSCodeApi {
  return {
    postMessage: (message: unknown) => {
      window.parent.postMessage(message, '*');
    },
    getState: <T>() => fallbackState as T | undefined,
    setState: <T>(state: T) => {
      fallbackState = state;
      return state;
    }
  };
}

function getVSCodeApi(): VSCodeApi {
  // Return cached
  if (globalVscodeApi) {
    return globalVscodeApi;
  }

  if (typeof window === 'undefined') {
    return createFallbackApi();
  }

  // Check if already stored on window (VS Code sets this after first acquisition)
  if ((window as any).vscode) {
    globalVscodeApi = (window as any).vscode as VSCodeApi;
    return globalVscodeApi;
  }

  // Try to acquire VS Code API (only available in VS Code webview context)
  if (typeof (window as any).acquireVsCodeApi === 'function') {
    try {
      const api = (window as any).acquireVsCodeApi() as VSCodeApi;
      globalVscodeApi = api;
      // Store on window for subsequent calls
      (window as any).vscode = api;
      return api;
    } catch (e) {
      console.warn('Failed to acquire VS Code API:', e);
    }
  }

  // Use fallback API for non-VS Code environments (e.g., standalone browser testing)
  globalVscodeApi = createFallbackApi();
  return globalVscodeApi;
}

/**
 * Hook to interact with VSCode API
 * Provides methods to send and receive messages from the extension
 */
export const useVSCodeApi = (): UseVSCodeApiReturn => {
  // Initialize ref as null - we'll acquire lazily in useEffect
  const vscodeApi = useRef<VSCodeApi | null>(null);
  const messageHandlers = useRef<Set<(message: Message) => void>>(new Set());

  // Initialize VSCode API once after mount
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
