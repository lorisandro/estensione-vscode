import React, { useState, useCallback } from 'react';
import { useSelectionStore } from '../state/stores';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--vscode-sideBar-background)',
    borderLeft: '1px solid var(--vscode-panel-border)',
    overflow: 'hidden',
  } as React.CSSProperties,

  header: {
    padding: '12px',
    borderBottom: '1px solid var(--vscode-panel-border)',
    fontWeight: 600,
    fontSize: '13px',
    color: 'var(--vscode-foreground)',
  } as React.CSSProperties,

  content: {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
  } as React.CSSProperties,

  section: {
    marginBottom: '16px',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--vscode-foreground)',
    textTransform: 'uppercase',
    marginBottom: '8px',
    opacity: 0.7,
  } as React.CSSProperties,

  property: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '6px',
    fontSize: '12px',
  } as React.CSSProperties,

  propertyName: {
    color: 'var(--vscode-symbolIcon-propertyForeground)',
    fontWeight: 500,
    marginRight: '8px',
    flexShrink: 0,
  } as React.CSSProperties,

  propertyValue: {
    color: 'var(--vscode-foreground)',
    wordBreak: 'break-word',
    textAlign: 'right',
    fontFamily: 'var(--vscode-editor-font-family)',
  } as React.CSSProperties,

  tag: {
    display: 'inline-block',
    padding: '2px 6px',
    backgroundColor: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    borderRadius: '2px',
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '8px',
  } as React.CSSProperties,

  emptyState: {
    padding: '24px 12px',
    textAlign: 'center',
    color: 'var(--vscode-descriptionForeground)',
    fontSize: '12px',
  } as React.CSSProperties,

  code: {
    fontFamily: 'var(--vscode-editor-font-family)',
    fontSize: '11px',
    backgroundColor: 'var(--vscode-textCodeBlock-background)',
    padding: '2px 4px',
    borderRadius: '2px',
  } as React.CSSProperties,

  attributeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  } as React.CSSProperties,

  styleGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  } as React.CSSProperties,

  styleProperty: {
    fontSize: '11px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  } as React.CSSProperties,
};

export const ElementInspector: React.FC = () => {
  const { selectedElement } = useSelectionStore();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['general', 'styles'])
  );

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  if (!selectedElement) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Element Inspector</div>
        <div style={styles.emptyState}>
          Select an element to inspect its properties
        </div>
      </div>
    );
  }

  const { tagName, id, className, attributes, styles: elementStyles, rect, selector } = selectedElement;

  return (
    <div style={styles.container}>
      <div style={styles.header}>Element Inspector</div>
      <div style={styles.content}>
        {/* Element Tag */}
        <div style={styles.section}>
          <span style={styles.tag}>&lt;{tagName}&gt;</span>
        </div>

        {/* General Properties */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>General</div>
          <div style={styles.property}>
            <span style={styles.propertyName}>Selector:</span>
            <span style={{ ...styles.propertyValue, ...styles.code }}>{selector}</span>
          </div>
          {id && (
            <div style={styles.property}>
              <span style={styles.propertyName}>ID:</span>
              <span style={styles.propertyValue}>{id}</span>
            </div>
          )}
          {className && (
            <div style={styles.property}>
              <span style={styles.propertyName}>Class:</span>
              <span style={styles.propertyValue}>{className}</span>
            </div>
          )}
        </div>

        {/* Dimensions */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Dimensions</div>
          <div style={styles.property}>
            <span style={styles.propertyName}>Width:</span>
            <span style={styles.propertyValue}>{Math.round(rect.width)}px</span>
          </div>
          <div style={styles.property}>
            <span style={styles.propertyName}>Height:</span>
            <span style={styles.propertyValue}>{Math.round(rect.height)}px</span>
          </div>
          <div style={styles.property}>
            <span style={styles.propertyName}>X:</span>
            <span style={styles.propertyValue}>{Math.round(rect.x)}px</span>
          </div>
          <div style={styles.property}>
            <span style={styles.propertyName}>Y:</span>
            <span style={styles.propertyValue}>{Math.round(rect.y)}px</span>
          </div>
        </div>

        {/* Attributes */}
        {Object.keys(attributes).length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Attributes</div>
            <div style={styles.attributeList}>
              {Object.entries(attributes).map(([key, value]) => (
                <div key={key} style={styles.property}>
                  <span style={styles.propertyName}>{key}:</span>
                  <span style={styles.propertyValue}>
                    {typeof value === 'string' && value.length > 50
                      ? value.substring(0, 50) + '...'
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Computed Styles */}
        {elementStyles && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Computed Styles</div>
            <div style={styles.styleGrid}>
              {Object.entries(elementStyles).map(([key, value]) => (
                <div key={key} style={styles.styleProperty}>
                  <span style={styles.propertyName}>{key}:</span>
                  <span style={{ ...styles.propertyValue, fontSize: '11px' }}>
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
