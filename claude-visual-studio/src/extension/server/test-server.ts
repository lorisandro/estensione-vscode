#!/usr/bin/env node
/**
 * Standalone Test Script for Development Server
 *
 * This script can be run directly with ts-node to test the server
 * without needing the full VS Code extension environment.
 *
 * Usage:
 *   ts-node src/extension/server/test-server.ts [path-to-serve]
 */

import { ServerManager } from './ServerManager';
import { HMRBridge } from './HMRBridge';
import * as path from 'path';
import * as process from 'process';

const DEFAULT_PORT = 3333;
const DEFAULT_HMR_PORT = 3334;

async function main() {
  // Get path from args or use current directory
  const servePath = process.argv[2] || process.cwd();
  const absolutePath = path.resolve(servePath);

  console.log('==========================================');
  console.log('Claude Visual Studio - Development Server');
  console.log('==========================================');
  console.log(`Serving: ${absolutePath}`);
  console.log('');

  const serverManager = new ServerManager();
  const hmrBridge = new HMRBridge();

  // Handle graceful shutdown
  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('\n\nShutting down servers...');

    try {
      await hmrBridge.stop();
      await serverManager.stop();
      console.log('Servers stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    // Start HTTP server
    console.log(`Starting HTTP server on port ${DEFAULT_PORT}...`);
    await serverManager.start(DEFAULT_PORT, absolutePath, DEFAULT_HMR_PORT);
    console.log(`✓ HTTP server running at http://localhost:${DEFAULT_PORT}`);

    // Start HMR WebSocket server
    console.log(`\nStarting HMR WebSocket server on port ${DEFAULT_HMR_PORT}...`);
    await hmrBridge.start({
      port: DEFAULT_HMR_PORT,
      rootPath: absolutePath,
    });
    console.log(`✓ HMR WebSocket server running on port ${DEFAULT_HMR_PORT}`);

    // Status updates
    setInterval(() => {
      const clientCount = hmrBridge.getClientCount();
      if (clientCount > 0) {
        console.log(`[Status] ${clientCount} HMR client(s) connected`);
      }
    }, 30000); // Every 30 seconds

    console.log('\n==========================================');
    console.log('Server ready!');
    console.log('==========================================');
    console.log('');
    console.log('Open your browser to:');
    console.log(`  http://localhost:${DEFAULT_PORT}`);
    console.log('');
    console.log('Or if you have an index.html:');
    console.log(`  http://localhost:${DEFAULT_PORT}/index.html`);
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');

  } catch (error) {
    console.error('\n❌ Failed to start servers:');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as testServer };
