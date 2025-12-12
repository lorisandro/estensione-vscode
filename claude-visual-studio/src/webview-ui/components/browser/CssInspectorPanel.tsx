import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore, useSelectionStore, type ElementInfo } from '../../state/stores';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--vscode-sideBar-background)',
    borderLeft: '1px solid var(--vscode-panel-border)',
    height: '100%',
    overflow: 'hidden',
  } as React.CSSProperties,

  resizer: {
    width: '4px',
    backgroundColor: 'var(--vscode-panel-border)',
    cursor: 'col-resize',
    transition: 'background-color 0.1s',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: 'var(--vscode-sideBarSectionHeader-background)',
    borderBottom: '1px solid var(--vscode-panel-border)',
    minHeight: '36px',
    flexShrink: 0,
  } as React.CSSProperties,

  title: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--vscode-sideBarSectionHeader-foreground)',
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  closeButton: {
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

  content: {
    flex: 1,
    overflow: 'auto',
    padding: '0',
  } as React.CSSProperties,

  section: {
    borderBottom: '1px solid var(--vscode-panel-border)',
  } as React.CSSProperties,

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: 'var(--vscode-sideBarSectionHeader-background)',
    cursor: 'pointer',
    userSelect: 'none',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--vscode-sideBarSectionHeader-foreground)',
  } as React.CSSProperties,

  sectionContent: {
    padding: '8px 12px',
  } as React.CSSProperties,

  propertyRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  } as React.CSSProperties,

  propertyLabel: {
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)',
    flexShrink: 0,
    width: '80px',
  } as React.CSSProperties,

  propertyValue: {
    flex: 1,
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '4px 8px',
    fontSize: '12px',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
  } as React.CSSProperties,

  colorInput: {
    width: '24px',
    height: '24px',
    padding: '0',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    cursor: 'pointer',
  } as React.CSSProperties,

  colorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  noSelection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '24px',
    textAlign: 'center',
    color: 'var(--vscode-descriptionForeground)',
  } as React.CSSProperties,

  noSelectionIcon: {
    width: '48px',
    height: '48px',
    marginBottom: '12px',
    opacity: 0.5,
  } as React.CSSProperties,

  noSelectionText: {
    fontSize: '12px',
  } as React.CSSProperties,

  elementTag: {
    backgroundColor: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    marginLeft: '8px',
  } as React.CSSProperties,

  boxModelContainer: {
    padding: '12px',
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,

  boxModel: {
    position: 'relative',
    width: '200px',
    height: '140px',
    fontSize: '10px',
    fontFamily: 'monospace',
  } as React.CSSProperties,

  boxMargin: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(255, 190, 130, 0.3)',
    border: '1px dashed rgba(255, 190, 130, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  boxBorder: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    right: '20px',
    bottom: '20px',
    backgroundColor: 'rgba(255, 216, 100, 0.3)',
    border: '1px dashed rgba(255, 216, 100, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  boxPadding: {
    position: 'absolute',
    top: '35px',
    left: '35px',
    right: '35px',
    bottom: '35px',
    backgroundColor: 'rgba(130, 190, 130, 0.3)',
    border: '1px dashed rgba(130, 190, 130, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  boxContent: {
    position: 'absolute',
    top: '50px',
    left: '50px',
    right: '50px',
    bottom: '50px',
    backgroundColor: 'rgba(130, 170, 255, 0.3)',
    border: '1px solid rgba(130, 170, 255, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--vscode-foreground)',
  } as React.CSSProperties,

  boxLabel: {
    position: 'absolute',
    color: 'var(--vscode-descriptionForeground)',
  } as React.CSSProperties,

  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--vscode-panel-border)',
  } as React.CSSProperties,

  tab: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: 'transparent',
    color: 'var(--vscode-foreground)',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    transition: 'all 0.1s',
  } as React.CSSProperties,

  tabActive: {
    borderBottomColor: 'var(--vscode-focusBorder)',
    color: 'var(--vscode-focusBorder)',
  } as React.CSSProperties,
};

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader} onClick={() => setIsOpen(!isOpen)}>
        <span style={styles.sectionTitle}>{title}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="currentColor"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <path d="M6 4l4 4-4 4V4z" />
        </svg>
      </div>
      {isOpen && <div style={styles.sectionContent}>{children}</div>}
    </div>
  );
};

type TabType = 'styles' | 'computed' | 'box';

export const CssInspectorPanel: React.FC = () => {
  const { cssInspectorWidth, setCssInspectorWidth, toggleCssInspector } = useEditorStore();
  const { selectedElement, hoveredElement } = useSelectionStore();
  const [isResizing, setIsResizing] = useState(false);
  const [resizerHover, setResizerHover] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('styles');

  const element = selectedElement || hoveredElement;

  // Handle resizer drag
  const handleResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setCssInspectorWidth(newWidth);
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
  }, [isResizing, setCssInspectorWidth]);

  const parseSize = (value: string | undefined): string => {
    if (!value) return '0';
    return value.replace('px', '') || '0';
  };

  return (
    <div style={{ ...styles.container, width: `${cssInspectorWidth}px`, position: 'relative' }}>
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
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={styles.title}>CSS Inspector</span>
          {element && (
            <span style={styles.elementTag}>{element.tagName}</span>
          )}
        </div>
        <button
          style={styles.closeButton}
          onClick={toggleCssInspector}
          title="Close"
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7.116 8l-4.558 4.558.884.884L8 8.884l4.558 4.558.884-.884L8.884 8l4.558-4.558-.884-.884L8 7.116 3.442 2.558l-.884.884L7.116 8z" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'styles' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('styles')}
        >
          Styles
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'computed' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('computed')}
        >
          Computed
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'box' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('box')}
        >
          Box Model
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {!element ? (
          <div style={styles.noSelection}>
            <svg style={styles.noSelectionIcon} viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 1l5 14 2-6 6-2L1 1zm3.5 4.5l5 1.8-2.8 1-1 2.8-1.2-5.6z" />
            </svg>
            <span style={styles.noSelectionText}>
              Enable selection mode and click on an element to inspect its CSS
            </span>
          </div>
        ) : activeTab === 'styles' ? (
          <>
            <CollapsibleSection title="Typography">
              <div style={styles.propertyRow}>
                <span style={styles.propertyLabel}>Font Size</span>
                <div style={styles.propertyValue}>
                  <input
                    type="text"
                    style={styles.input}
                    value={element.styles?.fontSize || ''}
                    readOnly
                  />
                </div>
              </div>
              <div style={styles.propertyRow}>
                <span style={styles.propertyLabel}>Font Family</span>
                <div style={styles.propertyValue}>
                  <input
                    type="text"
                    style={styles.input}
                    value={element.styles?.fontFamily || ''}
                    readOnly
                  />
                </div>
              </div>
              <div style={styles.propertyRow}>
                <span style={styles.propertyLabel}>Color</span>
                <div style={{ ...styles.propertyValue, ...styles.colorRow }}>
                  <input
                    type="color"
                    style={styles.colorInput}
                    value={rgbToHex(element.styles?.color || '')}
                    readOnly
                  />
                  <input
                    type="text"
                    style={{ ...styles.input, flex: 1 }}
                    value={element.styles?.color || ''}
                    readOnly
                  />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Layout">
              <div style={styles.propertyRow}>
                <span style={styles.propertyLabel}>Display</span>
                <div style={styles.propertyValue}>
                  <input
                    type="text"
                    style={styles.input}
                    value={element.styles?.display || ''}
                    readOnly
                  />
                </div>
              </div>
              <div style={styles.propertyRow}>
                <span style={styles.propertyLabel}>Position</span>
                <div style={styles.propertyValue}>
                  <input
                    type="text"
                    style={styles.input}
                    value={element.styles?.position || ''}
                    readOnly
                  />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Size">
              <div style={styles.propertyRow}>
                <span style={styles.propertyLabel}>Width</span>
                <div style={styles.propertyValue}>
                  <input
                    type="text"
                    style={styles.input}
                    value={element.styles?.width || ''}
                    readOnly
                  />
                </div>
              </div>
              <div style={styles.propertyRow}>
                <span style={styles.propertyLabel}>Height</span>
                <div style={styles.propertyValue}>
                  <input
                    type="text"
                    style={styles.input}
                    value={element.styles?.height || ''}
                    readOnly
                  />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Background">
              <div style={styles.propertyRow}>
                <span style={styles.propertyLabel}>Background</span>
                <div style={{ ...styles.propertyValue, ...styles.colorRow }}>
                  <input
                    type="color"
                    style={styles.colorInput}
                    value={rgbToHex(element.styles?.backgroundColor || '')}
                    readOnly
                  />
                  <input
                    type="text"
                    style={{ ...styles.input, flex: 1 }}
                    value={element.styles?.backgroundColor || ''}
                    readOnly
                  />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Spacing">
              <div style={styles.propertyRow}>
                <span style={styles.propertyLabel}>Padding</span>
                <div style={styles.propertyValue}>
                  <input
                    type="text"
                    style={styles.input}
                    value={element.styles?.padding || ''}
                    readOnly
                  />
                </div>
              </div>
              <div style={styles.propertyRow}>
                <span style={styles.propertyLabel}>Margin</span>
                <div style={styles.propertyValue}>
                  <input
                    type="text"
                    style={styles.input}
                    value={element.styles?.margin || ''}
                    readOnly
                  />
                </div>
              </div>
            </CollapsibleSection>
          </>
        ) : activeTab === 'computed' ? (
          <CollapsibleSection title="All Computed Styles" defaultOpen>
            {element.styles && Object.entries(element.styles).map(([key, value]) => (
              <div key={key} style={styles.propertyRow}>
                <span style={{ ...styles.propertyLabel, width: '120px' }}>{key}</span>
                <div style={styles.propertyValue}>
                  <input
                    type="text"
                    style={styles.input}
                    value={String(value)}
                    readOnly
                  />
                </div>
              </div>
            ))}
          </CollapsibleSection>
        ) : (
          <div style={styles.boxModelContainer}>
            <div style={styles.boxModel}>
              {/* Margin */}
              <div style={styles.boxMargin}>
                <span style={{ ...styles.boxLabel, top: '2px', left: '50%', transform: 'translateX(-50%)' }}>
                  {parseSize(element.styles?.margin?.split(' ')[0])}
                </span>
                <span style={{ ...styles.boxLabel, bottom: '2px', left: '50%', transform: 'translateX(-50%)' }}>
                  {parseSize(element.styles?.margin?.split(' ')[2] || element.styles?.margin?.split(' ')[0])}
                </span>
                <span style={{ ...styles.boxLabel, left: '2px', top: '50%', transform: 'translateY(-50%)' }}>
                  {parseSize(element.styles?.margin?.split(' ')[3] || element.styles?.margin?.split(' ')[1] || element.styles?.margin?.split(' ')[0])}
                </span>
                <span style={{ ...styles.boxLabel, right: '2px', top: '50%', transform: 'translateY(-50%)' }}>
                  {parseSize(element.styles?.margin?.split(' ')[1] || element.styles?.margin?.split(' ')[0])}
                </span>
              </div>

              {/* Border */}
              <div style={styles.boxBorder}>
                <span style={{ ...styles.boxLabel, top: '-14px', left: '50%', transform: 'translateX(-50%)' }}>
                  border
                </span>
              </div>

              {/* Padding */}
              <div style={styles.boxPadding}>
                <span style={{ ...styles.boxLabel, top: '2px', left: '50%', transform: 'translateX(-50%)' }}>
                  {parseSize(element.styles?.padding?.split(' ')[0])}
                </span>
                <span style={{ ...styles.boxLabel, bottom: '2px', left: '50%', transform: 'translateX(-50%)' }}>
                  {parseSize(element.styles?.padding?.split(' ')[2] || element.styles?.padding?.split(' ')[0])}
                </span>
                <span style={{ ...styles.boxLabel, left: '2px', top: '50%', transform: 'translateY(-50%)' }}>
                  {parseSize(element.styles?.padding?.split(' ')[3] || element.styles?.padding?.split(' ')[1] || element.styles?.padding?.split(' ')[0])}
                </span>
                <span style={{ ...styles.boxLabel, right: '2px', top: '50%', transform: 'translateY(-50%)' }}>
                  {parseSize(element.styles?.padding?.split(' ')[1] || element.styles?.padding?.split(' ')[0])}
                </span>
              </div>

              {/* Content */}
              <div style={styles.boxContent}>
                {parseSize(element.styles?.width)} x {parseSize(element.styles?.height)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to convert rgb to hex
function rgbToHex(rgb: string): string {
  if (!rgb || rgb === 'transparent' || rgb.startsWith('#')) {
    return rgb || '#000000';
  }

  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#000000';

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
