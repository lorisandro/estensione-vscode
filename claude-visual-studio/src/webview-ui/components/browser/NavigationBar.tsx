import React, { useState, useEffect, useCallback } from 'react';
import { useNavigationStore, useSelectionStore } from '../../state/stores';
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
    </div>
  );
};
