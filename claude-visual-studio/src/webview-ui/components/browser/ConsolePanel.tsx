import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorStore, type ConsoleLogEntry } from '../../state/stores';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--vscode-panel-background)',
    borderTop: '1px solid var(--vscode-panel-border)',
    overflow: 'hidden',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 8px',
    backgroundColor: 'var(--vscode-sideBarSectionHeader-background)',
    borderBottom: '1px solid var(--vscode-panel-border)',
    minHeight: '28px',
    flexShrink: 0,
  } as React.CSSProperties,

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  title: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--vscode-sideBarSectionHeader-foreground)',
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  badge: {
    backgroundColor: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    fontSize: '10px',
    padding: '1px 6px',
    borderRadius: '10px',
    minWidth: '16px',
    textAlign: 'center',
  } as React.CSSProperties,

  headerButtons: {
    display: 'flex',
    gap: '4px',
  } as React.CSSProperties,

  iconButton: {
    padding: '2px 4px',
    backgroundColor: 'transparent',
    color: 'var(--vscode-foreground)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  } as React.CSSProperties,

  logsContainer: {
    flex: 1,
    overflow: 'auto',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: '12px',
  } as React.CSSProperties,

  logEntry: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '2px 8px',
    borderBottom: '1px solid var(--vscode-panel-border)',
  } as React.CSSProperties,

  logIcon: {
    width: '14px',
    height: '14px',
    marginRight: '6px',
    marginTop: '2px',
    flexShrink: 0,
  } as React.CSSProperties,

  logMessage: {
    flex: 1,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    lineHeight: '18px',
  } as React.CSSProperties,

  logTimestamp: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    marginLeft: '8px',
    flexShrink: 0,
  } as React.CSSProperties,

  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--vscode-descriptionForeground)',
    fontSize: '12px',
    fontStyle: 'italic',
  } as React.CSSProperties,

  resizer: {
    height: '4px',
    backgroundColor: 'var(--vscode-panel-border)',
    cursor: 'row-resize',
    transition: 'background-color 0.1s',
  } as React.CSSProperties,
};

const logTypeStyles: Record<ConsoleLogEntry['type'], React.CSSProperties> = {
  log: { color: 'var(--vscode-foreground)' },
  info: { color: 'var(--vscode-editorInfo-foreground, #3794ff)' },
  warn: { color: 'var(--vscode-editorWarning-foreground, #cca700)', backgroundColor: 'rgba(204, 167, 0, 0.1)' },
  error: { color: 'var(--vscode-errorForeground, #f14c4c)', backgroundColor: 'rgba(241, 76, 76, 0.1)' },
  debug: { color: 'var(--vscode-descriptionForeground)' },
  stdout: { color: 'var(--vscode-terminal-ansiGreen, #23d18b)' },
  stderr: { color: 'var(--vscode-terminal-ansiRed, #f14c4c)', backgroundColor: 'rgba(241, 76, 76, 0.1)' },
};

const sourceStyles: Record<string, React.CSSProperties> = {
  browser: { backgroundColor: '#3794ff', color: 'white' },
  backend: { backgroundColor: '#23d18b', color: 'black' },
  extension: { backgroundColor: '#cca700', color: 'black' },
};

const SourceBadge: React.FC<{ source?: string }> = ({ source }) => {
  if (!source) return null;
  const style = sourceStyles[source] || sourceStyles.browser;
  return (
    <span style={{
      ...style,
      fontSize: '9px',
      padding: '1px 4px',
      borderRadius: '3px',
      marginRight: '6px',
      fontWeight: 600,
      textTransform: 'uppercase',
      flexShrink: 0,
    }}>
      {source === 'browser' ? 'FE' : source === 'backend' ? 'BE' : 'EXT'}
    </span>
  );
};

const LogIcon: React.FC<{ type: ConsoleLogEntry['type'] }> = ({ type }) => {
  const iconProps = { style: styles.logIcon, viewBox: '0 0 16 16' };

  switch (type) {
    case 'error':
      return (
        <svg {...iconProps} fill="var(--vscode-errorForeground, #f14c4c)">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM7 4h2v5H7V4zm0 6h2v2H7v-2z" />
        </svg>
      );
    case 'warn':
      return (
        <svg {...iconProps} fill="var(--vscode-editorWarning-foreground, #cca700)">
          <path d="M8 1l7 14H1L8 1zm0 2.5L2.5 14h11L8 3.5zM7 6h2v4H7V6zm0 5h2v2H7v-2z" />
        </svg>
      );
    case 'info':
      return (
        <svg {...iconProps} fill="var(--vscode-editorInfo-foreground, #3794ff)">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM7 7h2v5H7V7zm0-3h2v2H7V4z" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps} fill="var(--vscode-descriptionForeground)">
          <circle cx="8" cy="8" r="2" />
        </svg>
      );
  }
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const ConsolePanel: React.FC = () => {
  const { consoleLogs, consoleHeight, setConsoleHeight, clearConsoleLogs, toggleConsole } = useEditorStore();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizerHover, setResizerHover] = useState(false);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  // Handle resizer drag
  const handleResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY - 40; // 40 for nav bar
      setConsoleHeight(newHeight);
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
  }, [isResizing, setConsoleHeight]);

  return (
    <div style={{ ...styles.container, height: `${consoleHeight}px` }}>
      {/* Resizer */}
      <div
        style={{
          ...styles.resizer,
          backgroundColor: resizerHover || isResizing ? 'var(--vscode-focusBorder)' : 'var(--vscode-panel-border)',
        }}
        onMouseDown={handleResizerMouseDown}
        onMouseEnter={() => setResizerHover(true)}
        onMouseLeave={() => setResizerHover(false)}
      />

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>Console</span>
          {consoleLogs.length > 0 && (
            <span style={styles.badge}>{consoleLogs.length}</span>
          )}
        </div>
        <div style={styles.headerButtons}>
          <button
            style={styles.iconButton}
            onClick={clearConsoleLogs}
            title="Clear Console"
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 3h3v1h-1v9l-1 1H5l-1-1V4H3V3h3V2a1 1 0 011-1h2a1 1 0 011 1v1zM9 2H7v1h2V2zM6 13h1V5H6v8zm3 0h1V5H9v8z" />
            </svg>
          </button>
          <button
            style={styles.iconButton}
            onClick={toggleConsole}
            title="Hide Console"
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.116 8l-4.558 4.558.884.884L8 8.884l4.558 4.558.884-.884L8.884 8l4.558-4.558-.884-.884L8 7.116 3.442 2.558l-.884.884L7.116 8z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Logs */}
      <div style={styles.logsContainer}>
        {consoleLogs.length === 0 ? (
          <div style={styles.emptyState}>No console output</div>
        ) : (
          consoleLogs.map((log) => (
            <div
              key={log.id}
              style={{
                ...styles.logEntry,
                ...logTypeStyles[log.type],
              }}
            >
              <SourceBadge source={log.source} />
              <LogIcon type={log.type} />
              <span style={styles.logMessage}>{log.message}</span>
              <span style={styles.logTimestamp}>{formatTimestamp(log.timestamp)}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
