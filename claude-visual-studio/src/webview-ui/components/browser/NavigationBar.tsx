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

  const { selectionMode, setSelectionMode } = useSelectionStore();
  const { consoleVisible, toggleConsole, cssInspectorVisible, toggleCssInspector } = useEditorStore();
  const { postMessage } = useVSCodeApi();

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
    postMessage({
      type: 'screenshot',
    });
  }, [postMessage]);

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
        style={getButtonStyle('screenshot')}
        onMouseEnter={() => setHoveredButton('screenshot')}
        onMouseLeave={() => setHoveredButton(null)}
        title="Take Screenshot"
      >
        <svg style={styles.icon} viewBox="0 0 16 16">
          <path d="M4 4H2v10h12V4h-2l-1-2H5L4 4zm4 8.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0-1.5a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      </button>

      <button
        onClick={toggleConsole}
        style={getButtonStyle('console', consoleVisible)}
        onMouseEnter={() => setHoveredButton('console')}
        onMouseLeave={() => setHoveredButton(null)}
        title={consoleVisible ? 'Hide Console' : 'Show Console'}
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
    </div>
  );
};
