import React, { useState, useEffect, useCallback } from 'react';
import { useNavigationStore, useSelectionStore, useEditorStore } from '../../state/stores';
import { useVSCodeApi } from '../../hooks/useVSCodeApi';

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'var(--vscode-editor-background)',
    borderBottom: '1px solid var(--vscode-panel-border)',
    height: '40px',
    flexShrink: 0,
  } as React.CSSProperties,

  buttonGroup: {
    display: 'flex',
    gap: '4px',
  } as React.CSSProperties,

  applyUndoGroup: {
    display: 'flex',
    gap: '4px',
    marginLeft: '4px',
    paddingLeft: '8px',
    borderLeft: '1px solid var(--vscode-panel-border)',
  } as React.CSSProperties,

  applyButton: {
    padding: '4px 12px',
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    height: '28px',
    transition: 'background-color 0.1s',
  } as React.CSSProperties,

  undoButton: {
    padding: '4px 12px',
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    height: '28px',
    transition: 'background-color 0.1s',
  } as React.CSSProperties,

  dragModeIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    backgroundColor: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 500,
  } as React.CSSProperties,

  button: {
    padding: '4px 8px',
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '28px',
    height: '28px',
    transition: 'background-color 0.1s',
  } as React.CSSProperties,

  buttonHover: {
    backgroundColor: 'var(--vscode-button-secondaryHoverBackground)',
  } as React.CSSProperties,

  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as React.CSSProperties,

  buttonActive: {
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
  } as React.CSSProperties,

  urlInputContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    overflow: 'hidden',
  } as React.CSSProperties,

  urlInput: {
    flex: 1,
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: 'var(--vscode-input-foreground)',
    border: 'none',
    outline: 'none',
    fontSize: '12px',
    fontFamily: 'var(--vscode-font-family)',
  } as React.CSSProperties,

  icon: {
    width: '16px',
    height: '16px',
    fill: 'currentColor',
  } as React.CSSProperties,
};

export const NavigationBar: React.FC = () => {
  const {
    url,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    refresh,
    navigateTo,
  } = useNavigationStore();

  const {
    selectionMode,
    setSelectionMode,
    screenshotMode,
    setScreenshotMode,
    hasPendingChanges,
    dragChanges,
    undoLastChange,
    applyChanges,
    clearDragChanges,
    selectedElement,
  } = useSelectionStore();
  const { cssInspectorVisible, toggleCssInspector, consoleVisible, toggleConsole, consoleLogs } = useEditorStore();
  const { postMessage } = useVSCodeApi();

  // Drag mode is active when no other mode is enabled
  const isDragMode = !selectionMode && !screenshotMode;

  const [urlInput, setUrlInput] = useState(url);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Update input when URL changes
  useEffect(() => {
    setUrlInput(url);
  }, [url]);

  const normalizeUrl = useCallback((input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return trimmed;

    // Already has a protocol
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    // localhost without protocol
    if (/^localhost(:\d+)?/i.test(trimmed)) {
      return `http://${trimmed}`;
    }

    // Looks like a URL (has dot and no spaces)
    if (trimmed.includes('.') && !trimmed.includes(' ')) {
      return `https://${trimmed}`;
    }

    // Return as-is (might be a search or relative path)
    return trimmed;
  }, []);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const normalizedUrl = normalizeUrl(urlInput);
    if (normalizedUrl) {
      navigateTo(normalizedUrl);
      setUrlInput(normalizedUrl);
      postMessage({
        type: 'navigate',
        payload: { url: normalizedUrl },
      });
    }
  }, [urlInput, navigateTo, normalizeUrl, postMessage]);

  const handleRefresh = useCallback(() => {
    refresh();
    postMessage({
      type: 'refresh',
    });
  }, [refresh, postMessage]);

  const handleToggleSelection = useCallback(() => {
    const newMode = !selectionMode;
    setSelectionMode(newMode);
    postMessage({
      type: 'toggle-selection',
      payload: { enabled: newMode },
    });
  }, [selectionMode, setSelectionMode, postMessage]);

  const handleScreenshot = useCallback(() => {
    // Toggle screenshot mode for area capture
    setScreenshotMode(!screenshotMode);
  }, [screenshotMode, setScreenshotMode]);

  const handleApply = useCallback(() => {
    // Se c'e un elemento selezionato, invia le sue info a Claude
    if (selectedElement) {
      postMessage({
        type: 'send-to-claude',
      });
    }

    // Send all changes (drag + resize) to extension for Claude Code integration
    if (dragChanges.length > 0) {
      postMessage({
        type: 'apply-drag-changes',
        payload: {
          changes: dragChanges.map(change => ({
            elementSelector: change.elementSelector,
            changeType: change.changeType || 'move',
            // Position changes
            originalPosition: change.originalPosition,
            newPosition: change.newPosition,
            // Resize changes
            originalWidth: change.originalWidth,
            originalHeight: change.originalHeight,
            newWidth: change.newWidth,
            newHeight: change.newHeight,
            // DOM reorder fields
            action: change.action,
            targetSelector: change.targetSelector,
            containerSelector: change.containerSelector,
            position: change.position,
          })),
        },
      });
    }
    // Dispatch custom event to be handled by App.tsx which forwards to iframe
    window.dispatchEvent(new CustomEvent('claude-vs-apply-drag-changes'));
    applyChanges();
  }, [applyChanges, dragChanges, postMessage, selectedElement]);

  const handleUndo = useCallback(() => {
    const lastChange = undoLastChange();
    if (lastChange) {
      // Dispatch custom event with change data to be handled by App.tsx
      window.dispatchEvent(new CustomEvent('claude-vs-undo-drag-change', {
        detail: lastChange,
      }));
    }
  }, [undoLastChange]);

  const getButtonStyle = useCallback((buttonName: string, isActive = false, isDisabled = false) => {
    const baseStyle = { ...styles.button };
    if (isDisabled) {
      return { ...baseStyle, ...styles.buttonDisabled };
    }
    if (isActive) {
      return { ...baseStyle, ...styles.buttonActive };
    }
    if (hoveredButton === buttonName) {
      return { ...baseStyle, ...styles.buttonHover };
    }
    return baseStyle;
  }, [hoveredButton]);

  return (
    <div style={styles.container}>
      <div style={styles.buttonGroup}>
        <button
          onClick={goBack}
          disabled={!canGoBack}
          style={getButtonStyle('back', false, !canGoBack)}
          onMouseEnter={() => setHoveredButton('back')}
          onMouseLeave={() => setHoveredButton(null)}
          title="Go Back"
        >
          <svg style={styles.icon} viewBox="0 0 16 16">
            <path d="M10 14L4 8l6-6v12z" />
          </svg>
        </button>

        <button
          onClick={goForward}
          disabled={!canGoForward}
          style={getButtonStyle('forward', false, !canGoForward)}
          onMouseEnter={() => setHoveredButton('forward')}
          onMouseLeave={() => setHoveredButton(null)}
          title="Go Forward"
        >
          <svg style={styles.icon} viewBox="0 0 16 16">
            <path d="M6 2l6 6-6 6V2z" />
          </svg>
        </button>

        <button
          onClick={handleRefresh}
          style={getButtonStyle('refresh')}
          onMouseEnter={() => setHoveredButton('refresh')}
          onMouseLeave={() => setHoveredButton(null)}
          title="Refresh"
        >
          <svg style={styles.icon} viewBox="0 0 16 16">
            <path d="M13.5 2l-.5 3h-3l.5-.5C9.5 3.5 8 3 6.5 3 3.5 3 1 5.5 1 8.5S3.5 14 6.5 14c2.2 0 4-1.3 4.8-3.2l1.4.5c-1 2.5-3.4 4.2-6.2 4.2C2.8 15.5 0 12.7 0 9.2S2.8 2.8 6.5 2.8c1.5 0 2.9.5 4 1.3l.5-.6V2h2.5z" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleUrlSubmit} style={styles.urlInputContainer}>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          style={styles.urlInput}
          placeholder="Enter URL..."
          spellCheck={false}
        />
      </form>

      {/* Drag mode indicator */}
      {isDragMode && (
        <div style={styles.dragModeIndicator} title="Drag elements to reposition them">
          <svg style={{ width: '12px', height: '12px', fill: 'currentColor' }} viewBox="0 0 16 16">
            <path d="M3 2h2v2H3V2zm0 5h2v2H3V7zm0 5h2v2H3v-2zm4-10h2v2H7V2zm0 5h2v2H7V7zm0 5h2v2H7v-2zm4-10h2v2h-2V2zm0 5h2v2h-2V7zm0 5h2v2h-2v-2z"/>
          </svg>
          DRAG
        </div>
      )}

      {/* Apply/Undo buttons when there are pending changes or element selected */}
      {(hasPendingChanges || selectedElement) && (
        <div style={styles.applyUndoGroup}>
          <button
            onClick={handleApply}
            style={{
              ...styles.applyButton,
              ...(hoveredButton === 'apply' ? { backgroundColor: 'var(--vscode-button-hoverBackground)' } : {}),
            }}
            onMouseEnter={() => setHoveredButton('apply')}
            onMouseLeave={() => setHoveredButton(null)}
            title="Apply all changes"
          >
            <svg style={{ width: '12px', height: '12px', fill: 'currentColor' }} viewBox="0 0 16 16">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
            Apply
          </button>
          {hasPendingChanges && (
            <button
              onClick={handleUndo}
              style={{
                ...styles.undoButton,
                ...(hoveredButton === 'undo' ? { backgroundColor: 'var(--vscode-button-secondaryHoverBackground)' } : {}),
              }}
              onMouseEnter={() => setHoveredButton('undo')}
              onMouseLeave={() => setHoveredButton(null)}
              title="Undo last change"
            >
              <svg style={{ width: '12px', height: '12px', fill: 'currentColor' }} viewBox="0 0 16 16">
                <path d="M4.5 3A3.5 3.5 0 018 6.5V8h1.5a.5.5 0 01.4.8l-3 4a.5.5 0 01-.8 0l-3-4A.5.5 0 013.5 8H5V6.5A2.5 2.5 0 017.5 4H12a.5.5 0 010 1H7.5A1.5 1.5 0 006 6.5V8h-.5a.5.5 0 00-.4.8L8 12.5 10.9 8.8a.5.5 0 00-.4-.8H8V6.5A3.5 3.5 0 004.5 3z" transform="scale(-1,1) translate(-16,0)"/>
              </svg>
              Undo
            </button>
          )}
        </div>
      )}

      <button
        onClick={handleToggleSelection}
        style={getButtonStyle('selection', selectionMode)}
        onMouseEnter={() => setHoveredButton('selection')}
        onMouseLeave={() => setHoveredButton(null)}
        title={selectionMode ? 'Disable Selection Mode' : 'Enable Selection Mode'}
      >
        <svg style={styles.icon} viewBox="0 0 16 16">
          <path d="M1 1l5 14 2-6 6-2L1 1zm3.5 4.5l5 1.8-2.8 1-1 2.8-1.2-5.6z" />
        </svg>
      </button>

      <button
        onClick={handleScreenshot}
        style={getButtonStyle('screenshot', screenshotMode)}
        onMouseEnter={() => setHoveredButton('screenshot')}
        onMouseLeave={() => setHoveredButton(null)}
        title={screenshotMode ? 'Cancel Area Capture' : 'Capture Area Screenshot'}
      >
        <svg style={styles.icon} viewBox="0 0 16 16">
          {/* Crosshair/target icon for area capture */}
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <circle cx="8" cy="8" r="1" fill="currentColor"/>
        </svg>
      </button>

      <button
        onClick={() => postMessage({ type: 'openDevTools' })}
        style={getButtonStyle('devtools')}
        onMouseEnter={() => setHoveredButton('devtools')}
        onMouseLeave={() => setHoveredButton(null)}
        title="Open Developer Tools"
      >
        <svg style={styles.icon} viewBox="0 0 16 16">
          <path d="M0 2v12h16V2H0zm15 11H1V5h14v8zM1 4V3h14v1H1z" />
          <path d="M2 6l3 2-3 2v1l4-3-4-3v1zm5 4h4v1H7v-1z" />
        </svg>
      </button>

      <button
        onClick={toggleCssInspector}
        style={getButtonStyle('cssInspector', cssInspectorVisible)}
        onMouseEnter={() => setHoveredButton('cssInspector')}
        onMouseLeave={() => setHoveredButton(null)}
        title={cssInspectorVisible ? 'Hide CSS Inspector' : 'Show CSS Inspector'}
      >
        <svg style={styles.icon} viewBox="0 0 16 16">
          <path d="M2 1.5l-.5 3v9l.5.5h12l.5-.5v-9l-.5-3H2zm0 12V5h12v8.5H2zm0-9.5V2h12v2H2z" />
          <path d="M3 7h2v1H3V7zm0 2h4v1H3V9zm6-2h4v1H9V7zm0 2h2v1H9V9z" />
        </svg>
      </button>

      {/* Console toggle button */}
      <button
        onClick={toggleConsole}
        style={{
          ...getButtonStyle('console', consoleVisible),
          position: 'relative',
        }}
        onMouseEnter={() => setHoveredButton('console')}
        onMouseLeave={() => setHoveredButton(null)}
        title={consoleVisible ? 'Hide Console' : 'Show Console'}
      >
        <svg style={styles.icon} viewBox="0 0 16 16">
          <path d="M2 2h12v12H2V2zm1 1v10h10V3H3z" />
          <path d="M4 5l2 2-2 2v1l3-3-3-3v1zm4 4h4v1H8V9z" />
        </svg>
        {/* Error count badge */}
        {consoleLogs.filter(l => l.type === 'error').length > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            backgroundColor: 'var(--vscode-errorForeground, #f14c4c)',
            color: 'white',
            fontSize: '9px',
            fontWeight: 600,
            padding: '0 4px',
            borderRadius: '8px',
            minWidth: '14px',
            textAlign: 'center',
            lineHeight: '14px',
          }}>
            {consoleLogs.filter(l => l.type === 'error').length}
          </span>
        )}
      </button>
    </div>
  );
};
