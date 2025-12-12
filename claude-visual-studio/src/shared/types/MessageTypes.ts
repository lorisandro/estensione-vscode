/**
 * Message types for communication between VSCode extension and webview
 *
 * This file defines the contract for all messages passed between the extension
 * host and the webview UI using the postMessage API.
 */

// Base message type with common properties
export interface BaseMessage {
  type: string;
  timestamp?: number;
}

// Extension -> Webview Messages
// =============================

/**
 * Request the webview to navigate to a specific URL
 */
export interface RequestNavigateMessage extends BaseMessage {
  type: 'requestNavigate';
  payload: {
    url: string;
    filePath?: string;
  };
}

/**
 * Toggle element selection mode in the webview
 */
export interface ToggleSelectionModeMessage extends BaseMessage {
  type: 'toggleSelectionMode';
  payload: {
    enabled: boolean;
  };
}

/**
 * Request the webview to refresh/reload the preview
 */
export interface RefreshPreviewMessage extends BaseMessage {
  type: 'refreshPreview';
  payload?: {
    preserveScroll?: boolean;
  };
}

/**
 * Update styles for a specific element
 */
export interface UpdateStylesMessage extends BaseMessage {
  type: 'updateStyles';
  payload: {
    selector: string;
    styles: Record<string, string>;
    elementPath?: string;
  };
}

/**
 * Request to update HTML content
 */
export interface UpdateHTMLMessage extends BaseMessage {
  type: 'updateHTML';
  payload: {
    html: string;
    filePath?: string;
  };
}

/**
 * Configuration update from extension
 */
export interface ConfigUpdateMessage extends BaseMessage {
  type: 'configUpdate';
  payload: {
    serverPort?: number;
    autoRefresh?: boolean;
  };
}

/**
 * Error message from extension
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  payload: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Navigate command from extension to webview (for MCP bridge)
 */
export interface NavigateCommandMessage extends BaseMessage {
  type: 'navigate';
  payload: {
    url?: string;
    action?: 'back' | 'forward';
  };
}

// Webview -> Extension Messages
// ==============================

/**
 * Element has been selected in the webview
 */
export interface ElementSelectedMessage extends BaseMessage {
  type: 'elementSelected';
  payload: {
    selector: string;
    tagName: string;
    className?: string;
    id?: string;
    textContent?: string;
    attributes: Record<string, string>;
    computedStyles?: Record<string, string>;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    xpath?: string;
  };
}

/**
 * Webview is ready to receive messages
 */
export interface WebviewReadyMessage extends BaseMessage {
  type: 'webviewReady';
  payload?: {
    initialUrl?: string;
  };
}

/**
 * Request to open a file in the editor
 */
export interface OpenFileMessage extends BaseMessage {
  type: 'openFile';
  payload: {
    filePath: string;
    line?: number;
    column?: number;
  };
}

/**
 * Request to save changes to a file
 */
export interface SaveFileMessage extends BaseMessage {
  type: 'saveFile';
  payload: {
    filePath: string;
    content: string;
  };
}

/**
 * Navigation event in the preview
 */
export interface NavigationMessage extends BaseMessage {
  type: 'navigation';
  payload: {
    url: string;
    title?: string;
  };
}

/**
 * Console log from the preview iframe
 */
export interface ConsoleLogMessage extends BaseMessage {
  type: 'consoleLog';
  payload: {
    level: 'log' | 'info' | 'warn' | 'error' | 'debug';
    args: unknown[];
  };
}

/**
 * State update from webview to be persisted
 */
export interface StateUpdateMessage extends BaseMessage {
  type: 'stateUpdate';
  payload: {
    key: string;
    value: unknown;
  };
}

/**
 * MCP response from webview
 */
export interface MCPResponseMessage extends BaseMessage {
  type: 'mcpResponse';
  payload: {
    id: string;
    result: unknown;
  };
}

/**
 * Toggle selection mode from webview toolbar
 */
export interface ToggleSelectionMessage extends BaseMessage {
  type: 'toggle-selection';
  payload: {
    enabled: boolean;
  };
}

/**
 * Navigate request from webview
 */
export interface NavigateMessage extends BaseMessage {
  type: 'navigate';
  payload: {
    url: string;
  };
}

/**
 * Webview ready (kebab-case variant)
 */
export interface WebviewReadyKebabMessage extends BaseMessage {
  type: 'webview-ready';
}

/**
 * Refresh request from webview
 */
export interface RefreshMessage extends BaseMessage {
  type: 'refresh';
}

/**
 * Screenshot request from webview
 */
export interface ScreenshotMessage extends BaseMessage {
  type: 'screenshot';
}

/**
 * Capture screenshot area from webview
 */
export interface CaptureScreenshotAreaMessage extends BaseMessage {
  type: 'capture-screenshot-area';
  payload: {
    x: number;
    y: number;
    width: number;
    height: number;
    imageData?: string | null;
  };
}

/**
 * Open DevTools request from webview
 */
export interface OpenDevToolsMessage extends BaseMessage {
  type: 'openDevTools';
}

/**
 * Element selected from iframe inspector (kebab-case)
 */
export interface ElementSelectedKebabMessage extends BaseMessage {
  type: 'element-selected';
  payload: {
    tagName?: string;
    tag?: string;
    id?: string;
    classes?: string[];
    className?: string;
    selector?: string;
    xpath?: string;
    textContent?: string;
    attributes?: Record<string, string>;
    boundingBox?: { x: number; y: number; width: number; height: number };
    rect?: { x: number; y: number; width: number; height: number };
    computedStyles?: Record<string, string>;
    styles?: { computed?: Record<string, string> };
    parent?: string;
    children?: number;
  };
}

// Union types for type safety
// ============================

/**
 * All possible messages from Extension to Webview
 */
export type ExtensionToWebviewMessage =
  | RequestNavigateMessage
  | ToggleSelectionModeMessage
  | RefreshPreviewMessage
  | UpdateStylesMessage
  | UpdateHTMLMessage
  | ConfigUpdateMessage
  | ErrorMessage
  | NavigateCommandMessage;

/**
 * All possible messages from Webview to Extension
 */
export type WebviewToExtensionMessage =
  | ElementSelectedMessage
  | WebviewReadyMessage
  | OpenFileMessage
  | SaveFileMessage
  | NavigationMessage
  | ConsoleLogMessage
  | StateUpdateMessage
  | MCPResponseMessage
  | ToggleSelectionMessage
  | NavigateMessage
  | WebviewReadyKebabMessage
  | RefreshMessage
  | ScreenshotMessage
  | CaptureScreenshotAreaMessage
  | OpenDevToolsMessage
  | ElementSelectedKebabMessage;

/**
 * All possible messages in either direction
 */
export type Message = ExtensionToWebviewMessage | WebviewToExtensionMessage;

// Type guards for runtime type checking
// ======================================

export function isExtensionToWebviewMessage(
  message: Message
): message is ExtensionToWebviewMessage {
  return [
    'requestNavigate',
    'toggleSelectionMode',
    'refreshPreview',
    'updateStyles',
    'updateHTML',
    'configUpdate',
    'error',
    'navigate',
  ].includes(message.type);
}

export function isWebviewToExtensionMessage(
  message: Message
): message is WebviewToExtensionMessage {
  return [
    'elementSelected',
    'webviewReady',
    'openFile',
    'saveFile',
    'navigation',
    'consoleLog',
    'stateUpdate',
    'mcpResponse',
    'toggle-selection',
    'navigate',
    'webview-ready',
    'refresh',
    'screenshot',
    'capture-screenshot-area',
    'openDevTools',
    'element-selected',
  ].includes(message.type);
}

// Helper type for message handlers
export type MessageHandler<T extends Message> = (message: T) => void | Promise<void>;

// State persistence types
// =======================

export interface WebviewState {
  currentUrl?: string;
  selectionMode?: boolean;
  scrollPosition?: { x: number; y: number };
  zoomLevel?: number;
  selectedElement?: ElementSelectedMessage['payload'];
}

export interface ExtensionState {
  lastOpenedFile?: string;
  recentUrls?: string[];
  configuration?: ConfigUpdateMessage['payload'];
}
