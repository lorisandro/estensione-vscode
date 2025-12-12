import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/webview-ui',
  build: {
    outDir: '../../dist/webview',
    emptyOutDir: true,
    // Explicit build target per Context7 best practices
    target: 'es2020',
    // Enable source maps for debugging in development
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/webview-ui/index.html'),
      },
      output: {
        // Use static names for VS Code extension (no CDN caching issues)
        // WebviewPanelProvider expects these exact paths
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'index.[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@webview': resolve(__dirname, 'src/webview-ui'),
    },
  },
});
