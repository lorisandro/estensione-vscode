import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigationStore, useSelectionStore, useEditorStore, type ElementInfo, type ConsoleLogEntry, type DragChange } from '../../state/stores';
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
  const { url, serverBaseUrl, refreshKey } = useNavigationStore();
  const { selectionMode, screenshotMode, addDragChange, setSelectedElement, clearSelection } = useSelectionStore();
  const { setLoading, setError, addConsoleLog, viewportWidth, viewportHeight, isScrubbing } = useEditorStore();
  const { postMessage } = useVSCodeApi();

  // Drag mode is active when no other mode is enabled
  const isDragMode = !selectionMode && !screenshotMode;

  // Convert external URLs to proxy URLs
  const iframeSrc = useMemo(() => {
    return getProxiedUrl(url, serverBaseUrl);
  }, [url, serverBaseUrl]);

  // Handle iframe load
  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(null);

    // Send current modes to iframe after load
    // The element-inspector.ts script injected by the server will receive this
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      // Small delay to ensure the inspector script is initialized
      setTimeout(() => {
        iframe.contentWindow?.postMessage({
          type: 'set-selection-mode',
          payload: { enabled: selectionMode }
        }, '*');
        iframe.contentWindow?.postMessage({
          type: 'set-drag-mode',
          payload: { enabled: isDragMode }
        }, '*');
        console.log('[BrowserFrame] Sent initial modes after load - selection:', selectionMode, 'drag:', isDragMode);
      }, 100);
    }
  }, [selectionMode, isDragMode, setLoading, setError]);

  // Handle iframe error
  const handleError = useCallback(() => {
    setLoading(false);
    setError('Failed to load preview. Make sure the server is running.');
  }, [setLoading, setError]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const { type, data, payload, source } = event.data;

      // Handle messages from element-inspector.ts (uses 'data' property)
      if (source === 'claude-vs-inspector') {
        if (type === 'element-hover') {
          onElementHover?.(data);
        } else if (type === 'element-select') {
          onElementClick?.(data);
        } else if (type === 'element-updated') {
          // Update selected element with new rect info after resize/style change
          // Use setSelectedElement directly to avoid triggering element-selected message to extension
          setSelectedElement(data);
          console.log('[BrowserFrame] Element rect updated:', data?.selector);
        } else if (type === 'element-resized') {
          console.log('[BrowserFrame] Element resized:', data);
        } else if (type === 'inspector-ready') {
          console.log('[BrowserFrame] Inspector ready in iframe');
          // Send current modes when inspector is ready
          iframeRef.current?.contentWindow?.postMessage({
            type: 'set-selection-mode',
            payload: { enabled: selectionMode }
          }, '*');
          iframeRef.current?.contentWindow?.postMessage({
            type: 'set-drag-mode',
            payload: { enabled: isDragMode }
          }, '*');
        } else if (type === 'element-drag-end') {
          // Handle drag end - add change to store (DOM reorder data)
          if (data?.elementSelector) {
            addDragChange({
              elementSelector: data.elementSelector,
              // DOM reorder fields
              originalParentSelector: data.originalParentSelector,
              originalNextSiblingSelector: data.originalNextSiblingSelector,
              action: data.action,
              targetSelector: data.targetSelector,
              containerSelector: data.containerSelector,
              position: data.position,
              // Legacy CSS positioning (if present)
              originalPosition: data.originalPosition,
              newPosition: data.newPosition,
            });
            console.log('[BrowserFrame] Drag change recorded:', data);
          }
        } else if (type === 'drag-mode-changed') {
          console.log('[BrowserFrame] Drag mode changed in iframe:', data);
        }
        return;
      }

      // Handle legacy messages (uses 'payload' property)
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
  }, [onElementHover, onElementClick, addConsoleLog, selectionMode, isDragMode, addDragChange, setSelectedElement]);

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

  // Send drag mode change to iframe via postMessage
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    // Send message to iframe to toggle drag mode
    iframe.contentWindow.postMessage({
      type: 'set-drag-mode',
      payload: { enabled: isDragMode }
    }, '*');

    console.log('[BrowserFrame] Sent drag mode to iframe:', isDragMode);
  }, [isDragMode]);

  // Set loading and clear selection when URL changes or on refresh
  useEffect(() => {
    setLoading(true);
    // Clear any selected/hovered elements when navigating or refreshing
    clearSelection();
  }, [url, refreshKey, setLoading, clearSelection]);

  // Determine if we're in responsive mode (fixed viewport)
  const isResponsiveMode = viewportWidth > 0 && viewportHeight > 0;

  // Calculate iframe dimensions and container styles
  // Disable pointer-events on iframe during scrubbing to allow mouse events to reach the sidebar
  const iframeStyles: React.CSSProperties = {
    width: isResponsiveMode ? `${viewportWidth}px` : '100%',
    height: isResponsiveMode ? `${viewportHeight}px` : '100%',
    border: 'none',
    backgroundColor: '#fff',
    pointerEvents: isScrubbing ? 'none' : 'auto',
    ...(isResponsiveMode && {
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      borderRadius: '4px',
    }),
  };

  const containerStyles: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isResponsiveMode ? '#2d2d2d' : '#fff',
    overflow: 'auto',
    padding: isResponsiveMode ? '16px' : 0,
    boxSizing: 'border-box',
  };

  return (
    <div style={containerStyles}>
      <iframe
        key={refreshKey}
        ref={iframeRef}
        src={iframeSrc}
        onLoad={handleLoad}
        onError={handleError}
        // Security Note: allow-same-origin is required for element inspector script injection.
        // External URLs are routed through proxy to bypass X-Frame-Options.
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
        style={iframeStyles}
        title="Browser Preview"
      />
    </div>
  );
};
