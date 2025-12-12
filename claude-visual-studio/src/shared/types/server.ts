/**
 * Shared type definitions for the Server components
 */

export interface ServerConfig {
  port: number;
  rootPath: string;
  hmrScriptPort?: number;
}

export interface HMRBridgeConfig {
  port: number;
  rootPath: string;
  watchPatterns?: string[];
}

export interface HMRMessage {
  type: 'file-changed' | 'connected' | 'error' | 'ping';
  file?: string;
  timestamp?: number;
  error?: string;
}

export interface ServerStatus {
  running: boolean;
  port?: number;
  hmrPort?: number;
  clientCount?: number;
}
