import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigationStore, useSelectionStore, useEditorStore, type ElementInfo, type ConsoleLogEntry } from '../../state/stores';
import { useVSCodeApi } from '../../hooks/useVSCodeApi';

interface BrowserFrameProps {
  onElementHover?: (element: ElementInfo | null) => void;
  onElementClick?: (element: ElementInfo | null) => void;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

/**
 * Check if URL is external (not localhost)
 */
function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return hostname !== 'localhost' && hostname !== '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Convert external URL to proxy URL
 */
function getProxiedUrl(url: string, serverBaseUrl: string): string {
  if (!isExternalUrl(url)) {
    return url;
  }
  // Route external URLs through the proxy
  const proxyUrl = `${serverBaseUrl}/__claude-vs__/proxy?url=${encodeURIComponent(url)}`;
  return proxyUrl;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  onElementHover,
  onElementClick,
  iframeRef: externalRef,
}) => {
  const internalRef = useRef<HTMLIFrameElement>(null);
  const iframeRef = externalRef || internalRef;
  const { url, serverBaseUrl } = useNavigationStore();
  const { selectionMode } = useSelectionStore();
  const { setLoading, setError, addConsoleLog } = useEditorStore();
  const { postMessage } = useVSCodeApi();

  // Convert external URLs to proxy URLs
  const iframeSrc = useMemo(() => {
    return getProxiedUrl(url, serverBaseUrl);
  }, [url, serverBaseUrl]);

  // Handle iframe load
  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(null);

    // Send current selection mode to iframe after load
    // The element-inspector.ts script injected by the server will receive this
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      // Small delay to ensure the inspector script is initialized
      setTimeout(() => {
        iframe.contentWindow?.postMessage({
          type: 'set-selection-mode',
          payload: { enabled: selectionMode }
        }, '*');
        console.log('[BrowserFrame] Sent initial selection mode after load:', selectionMode);
      }, 100);
    }
  }, [selectionMode, setLoading, setError]);

  // Handle iframe error
  const handleError = useCallback(() => {
    setLoading(false);
    setError('Failed to load preview. Make sure the server is running.');
  }, [setLoading, setError]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const { type, payload, source } = event.data;

      // Handle messages from element-inspector.ts
      if (source === 'claude-vs-inspector') {
        if (type === 'element-hover') {
          onElementHover?.(payload);
        } else if (type === 'element-select') {
          onElementClick?.(payload);
        } else if (type === 'inspector-ready') {
          console.log('[BrowserFrame] Inspector ready in iframe');
          // Send current selection mode when inspector is ready
          iframeRef.current?.contentWindow?.postMessage({
            type: 'set-selection-mode',
            payload: { enabled: selectionMode }
          }, '*');
        }
        return;
      }

      // Handle legacy messages
      if (type === 'element-hover') {
        onElementHover?.(payload);
      } else if (type === 'element-click') {
        onElementClick?.(payload);
      } else if (type === 'console-log') {
        addConsoleLog({
          type: payload.logType as ConsoleLogEntry['type'],
          message: payload.message,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementHover, onElementClick, addConsoleLog, selectionMode]);

  // Send selection mode change to iframe via postMessage
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    // Send message to iframe to toggle selection mode
    // The element-inspector.ts script injected by the server will receive this
    iframe.contentWindow.postMessage({
      type: 'set-selection-mode',
      payload: { enabled: selectionMode }
    }, '*');

    console.log('[BrowserFrame] Sent selection mode to iframe:', selectionMode);
  }, [selectionMode]);

  // Set loading when URL changes
  useEffect(() => {
    setLoading(true);
  }, [url, setLoading]);

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      onLoad={handleLoad}
      onError={handleError}
      // Security Note: allow-same-origin is required for element inspector script injection.
      // External URLs are routed through proxy to bypass X-Frame-Options.
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        backgroundColor: '#fff',
        pointerEvents: selectionMode ? 'auto' : 'auto',
      }}
      title="Browser Preview"
    />
  );
};
