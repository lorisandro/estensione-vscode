import React, { useCallback, useEffect, useRef } from 'react';
import { NavigationBar } from './components/browser/NavigationBar';
import { BrowserFrame } from './components/browser/BrowserFrame';
import { SelectionOverlay } from './components/browser/SelectionOverlay';
import { ScreenshotOverlay } from './components/browser/ScreenshotOverlay';
import { ConsolePanel } from './components/browser/ConsolePanel';
import { CssInspectorPanel } from './components/browser/CssInspectorPanel';
import { useSelectionStore, useEditorStore, useNavigationStore, type ElementInfo } from './state/stores';
import { useVSCodeApi } from './hooks/useVSCodeApi';
import { useMCPCommands } from './hooks/useMCPCommands';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    backgroundColor: 'var(--vscode-editor-background)',
  } as React.CSSProperties,

  mainContent: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  } as React.CSSProperties,

  previewContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,

  browserContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#fff',
  } as React.CSSProperties,

  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
    fontSize: '14px',
    zIndex: 1000,
  } as React.CSSProperties,

  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--vscode-editor-background)',
    color: 'var(--vscode-errorForeground)',
    fontSize: '14px',
    padding: '24px',
    textAlign: 'center',
    zIndex: 1000,
  } as React.CSSProperties,
};

export const App: React.FC = () => {
  const { setSelectedElement, setHoveredElement, screenshotMode } = useSelectionStore();
  const { isLoading, error, consoleVisible, cssInspectorVisible } = useEditorStore();
  const { setUrl, navigateTo, goBack, goForward, refresh, url } = useNavigationStore();
  const { onMessage, postMessage } = useVSCodeApi();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const browserContainerRef = useRef<HTMLDivElement>(null);

  // Initialize MCP commands handler
  useMCPCommands(iframeRef, { navigateTo, goBack, goForward, refresh, url });

  // Handle element hover
  const handleElementHover = useCallback(
    (element: ElementInfo | null) => {
      setHoveredElement(element);
    },
    [setHoveredElement]
  );

  // Handle element click
  const handleElementClick = useCallback(
    (element: ElementInfo | null) => {
      setSelectedElement(element);
      if (element) {
        postMessage({
          type: 'element-selected',
          payload: element,
        });
      }
    },
    [setSelectedElement, postMessage]
  );

  // Listen for messages from extension
  useEffect(() => {
    const cleanup = onMessage((message) => {
      switch (message.type) {
        case 'set-url': {
          const payload = message.payload as { url: string } | undefined;
          if (payload?.url) {
            setUrl(payload.url);
          }
          break;
        }
        case 'clear-selection':
          setSelectedElement(null);
          setHoveredElement(null);
          break;
        default:
          break;
      }
    });

    return cleanup;
  }, [onMessage, setUrl, setSelectedElement, setHoveredElement]);

  // Send ready message on mount
  useEffect(() => {
    postMessage({ type: 'webview-ready' });
  }, [postMessage]);

  // Listen for drag-related custom events from NavigationBar and forward to iframe
  useEffect(() => {
    const handleApplyDragChanges = () => {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'apply-drag-changes',
        }, '*');
        console.log('[App] Forwarded apply-drag-changes to iframe');
      }
    };

    const handleUndoDragChange = (event: CustomEvent) => {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow && event.detail) {
        iframe.contentWindow.postMessage({
          type: 'undo-drag-change',
          payload: event.detail,
        }, '*');
        console.log('[App] Forwarded undo-drag-change to iframe:', event.detail);
      }
    };

    window.addEventListener('claude-vs-apply-drag-changes', handleApplyDragChanges as EventListener);
    window.addEventListener('claude-vs-undo-drag-change', handleUndoDragChange as EventListener);

    return () => {
      window.removeEventListener('claude-vs-apply-drag-changes', handleApplyDragChanges as EventListener);
      window.removeEventListener('claude-vs-undo-drag-change', handleUndoDragChange as EventListener);
    };
  }, []);

  return (
    <div style={styles.container}>
      {/* Navigation Bar */}
      <NavigationBar />

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Preview Container */}
        <div style={styles.previewContainer}>
          <div ref={browserContainerRef} style={styles.browserContainer}>
            {/* Browser Frame */}
            <BrowserFrame
              onElementHover={handleElementHover}
              onElementClick={handleElementClick}
              iframeRef={iframeRef}
            />

            {/* Selection Overlay */}
            <SelectionOverlay />

            {/* Screenshot Area Selection Overlay */}
            {screenshotMode && (
              <ScreenshotOverlay containerRef={browserContainerRef} iframeRef={iframeRef} />
            )}

            {/* Loading Overlay */}
            {isLoading && (
              <div style={styles.loadingOverlay}>
                <div>Loading preview...</div>
              </div>
            )}

            {/* Error Overlay */}
            {error && (
              <div style={styles.errorOverlay}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>Error</div>
                  <div>{error}</div>
                </div>
              </div>
            )}
          </div>

          {/* Console Panel */}
          {consoleVisible && <ConsolePanel />}
        </div>

        {/* CSS Inspector Panel (includes Element Inspector as tab) */}
        {cssInspectorVisible && <CssInspectorPanel />}
      </div>
    </div>
  );
};
