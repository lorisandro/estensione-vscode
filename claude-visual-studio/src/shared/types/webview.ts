/**
 * Shared type definitions for VSCode Webview communication
 */

/**
 * VSCode API interface available in webviews
 */
export interface VSCodeApi {
  postMessage(message: unknown): void;
  getState<T = unknown>(): T | undefined;
  setState<T = unknown>(state: T): T;
}

/**
 * Declare global window augmentation for VSCode API
 */
declare global {
  interface Window {
    acquireVsCodeApi?: () => VSCodeApi;
    vscode?: VSCodeApi;
    __INITIAL_STATE__?: unknown;
  }
}

/**
 * Element information for selection/inspection
 * Used across webview UI components
 */
export interface WebviewElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes: Record<string, string>;
  styles: Record<string, string>;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selector: string;
}

/**
 * Base message interface for webview communication
 */
export interface WebviewMessage {
  type: string;
  payload?: unknown;
}
