// Element information returned from iframe
export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes: Record<string, string>;
  styles: Record<string, string>;
  rect: ElementRect;
  selector: string;
}

// Element rectangle/bounding box
export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Message types for webview <-> extension communication
export type WebviewMessage =
  | { type: 'webview-ready' }
  | { type: 'navigate'; payload: { url: string } }
  | { type: 'refresh' }
  | { type: 'toggle-selection'; payload: { enabled: boolean } }
  | { type: 'element-selected'; payload: ElementInfo };

export type ExtensionMessage =
  | { type: 'set-url'; payload: { url: string } }
  | { type: 'clear-selection' };

// VSCode API interface
export interface VSCodeApi {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

// Resize handle position
export type ResizeHandlePosition = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';
