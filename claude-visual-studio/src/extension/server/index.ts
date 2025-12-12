/**
 * Server Module Exports
 *
 * This module provides the local development server infrastructure for
 * Claude Visual Studio extension, including:
 * - Express-based static file server with HTML injection
 * - WebSocket-based Hot Module Replacement (HMR)
 * - File watching and live reload capabilities
 */

export { ServerManager } from './ServerManager';
export { HMRBridge } from './HMRBridge';
