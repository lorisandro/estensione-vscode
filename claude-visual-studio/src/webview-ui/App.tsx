import React, { useCallback, useEffect } from 'react';
import { NavigationBar } from './components/browser/NavigationBar';
import { BrowserFrame } from './components/browser/BrowserFrame';
import { SelectionOverlay } from './components/browser/SelectionOverlay';
import { ElementInspector } from './components/ElementInspector';
import { useSelectionStore, useEditorStore, useNavigationStore, type ElementInfo } from './state/stores';
import { useVSCodeApi } from './hooks/useVSCodeApi';

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

  inspector: {
    width: '300px',
    flexShrink: 0,
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

  resizer: {
    width: '4px',
    backgroundColor: 'var(--vscode-panel-border)',
    cursor: 'col-resize',
    transition: 'background-color 0.1s',
  } as React.CSSProperties,

  resizerHover: {
    backgroundColor: 'var(--vscode-focusBorder)',
  } as React.CSSProperties,
};

export const App: React.FC = () => {
  const { setSelectedElement, setHoveredElement, selectedElement } = useSelectionStore();
  const { isLoading, error, inspectorWidth, setInspectorWidth } = useEditorStore();
  const { setUrl } = useNavigationStore();
  const { onMessage, postMessage } = useVSCodeApi();

  const [isResizing, setIsResizing] = React.useState(false);
  const [resizerHover, setResizerHover] = React.useState(false);

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

  // Handle resizer drag
  const handleResizerMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setInspectorWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setInspectorWidth]);

  // Send ready message on mount
  useEffect(() => {
    postMessage({ type: 'webview-ready' });
  }, [postMessage]);

  return (
    <div style={styles.container}>
      {/* Navigation Bar */}
      <NavigationBar />

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Preview Container */}
        <div style={styles.previewContainer}>
          <div style={styles.browserContainer}>
            {/* Browser Frame */}
            <BrowserFrame
              onElementHover={handleElementHover}
              onElementClick={handleElementClick}
            />

            {/* Selection Overlay */}
            <SelectionOverlay />

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
        </div>

        {/* Resizer */}
        {selectedElement && (
          <div
            style={{
              ...styles.resizer,
              ...(resizerHover || isResizing ? styles.resizerHover : {}),
            }}
            onMouseDown={handleResizerMouseDown}
            onMouseEnter={() => setResizerHover(true)}
            onMouseLeave={() => setResizerHover(false)}
          />
        )}

        {/* Inspector Panel */}
        {selectedElement && (
          <div style={{ ...styles.inspector, width: `${inspectorWidth}px` }}>
            <ElementInspector />
          </div>
        )}
      </div>
    </div>
  );
};
