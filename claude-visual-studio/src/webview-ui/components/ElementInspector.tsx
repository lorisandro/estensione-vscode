import React, { useState, useCallback, useMemo } from 'react';
import { useSelectionStore } from '../state/stores';

// DevTools-like colors
const colors = {
  tagName: '#e36eec',      // Purple/pink for tags
  attrName: '#9cdcfe',     // Light blue for attribute names
  attrValue: '#ce9178',    // Orange/brown for string values
  punctuation: '#808080',  // Gray for punctuation
  id: '#f1c40f',          // Yellow/gold for ID
  className: '#3498db',    // Blue for class names
  text: '#d4d4d4',        // Default text
  dimText: '#808080',     // Dimmed text
  number: '#b5cea8',      // Green for numbers
  unit: '#569cd6',        // Blue for units (px, em, etc.)
  keyword: '#569cd6',     // Blue for keywords
  color: '#ce9178',       // For color values
  url: '#ce9178',         // For URLs
  background: '#1e1e1e',
  backgroundAlt: '#252526',
  border: '#3c3c3c',
  hoverBg: '#2a2d2e',
  boxMargin: '#f9cc9d',
  boxBorder: '#fce4a8',
  boxPadding: '#c3deb7',
  boxContent: '#9fc4e7',
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: colors.background,
    color: colors.text,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '12px',
    overflow: 'hidden',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: colors.backgroundAlt,
    borderBottom: `1px solid ${colors.border}`,
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: colors.dimText,
  } as React.CSSProperties,

  content: {
    flex: 1,
    overflow: 'auto',
    padding: '0',
  } as React.CSSProperties,

  section: {
    borderBottom: `1px solid ${colors.border}`,
  } as React.CSSProperties,

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    cursor: 'pointer',
    userSelect: 'none',
    backgroundColor: colors.backgroundAlt,
    transition: 'background-color 0.15s',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    color: colors.text,
    marginLeft: '6px',
  } as React.CSSProperties,

  sectionContent: {
    padding: '8px 12px',
    backgroundColor: colors.background,
  } as React.CSSProperties,

  chevron: {
    width: '12px',
    height: '12px',
    transition: 'transform 0.15s',
    color: colors.dimText,
  } as React.CSSProperties,

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
    color: colors.dimText,
  } as React.CSSProperties,

  emptyIcon: {
    width: '48px',
    height: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  } as React.CSSProperties,

  // HTML Element Display
  elementDisplay: {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '12px',
    lineHeight: '1.6',
    padding: '12px',
    backgroundColor: colors.background,
    borderBottom: `1px solid ${colors.border}`,
    wordBreak: 'break-all',
  } as React.CSSProperties,

  // Property rows
  propertyRow: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '3px 0',
    minHeight: '20px',
  } as React.CSSProperties,

  propertyName: {
    color: colors.attrName,
    marginRight: '8px',
    flexShrink: 0,
    minWidth: '100px',
  } as React.CSSProperties,

  propertyValue: {
    color: colors.text,
    wordBreak: 'break-word',
    flex: 1,
  } as React.CSSProperties,

  // Box model
  boxModel: {
    display: 'flex',
    justifyContent: 'center',
    padding: '16px 12px',
  } as React.CSSProperties,

  boxModelContainer: {
    position: 'relative',
    width: '100%',
    maxWidth: '280px',
  } as React.CSSProperties,

  boxLayer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    textAlign: 'center',
  } as React.CSSProperties,

  boxLabel: {
    position: 'absolute',
    fontSize: '10px',
    fontWeight: 500,
    textTransform: 'lowercase',
    color: '#000',
    opacity: 0.7,
  } as React.CSSProperties,

  boxValue: {
    fontSize: '11px',
    fontFamily: 'Consolas, monospace',
    color: '#000',
    padding: '2px 4px',
    minWidth: '20px',
    textAlign: 'center',
  } as React.CSSProperties,

  // Style categories
  styleCategory: {
    marginBottom: '12px',
  } as React.CSSProperties,

  styleCategoryTitle: {
    fontSize: '10px',
    fontWeight: 600,
    color: colors.dimText,
    textTransform: 'uppercase',
    marginBottom: '6px',
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  styleRow: {
    display: 'flex',
    alignItems: 'baseline',
    padding: '2px 0',
    fontSize: '11px',
  } as React.CSSProperties,

  styleName: {
    color: colors.attrName,
    marginRight: '4px',
  } as React.CSSProperties,

  styleColon: {
    color: colors.punctuation,
    marginRight: '6px',
  } as React.CSSProperties,

  styleValue: {
    color: colors.text,
    wordBreak: 'break-word',
  } as React.CSSProperties,

  copyButton: {
    padding: '2px 6px',
    fontSize: '10px',
    backgroundColor: 'transparent',
    border: `1px solid ${colors.border}`,
    borderRadius: '3px',
    color: colors.dimText,
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties,

  // Breadcrumb
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: colors.backgroundAlt,
    borderBottom: `1px solid ${colors.border}`,
    fontSize: '11px',
    overflow: 'auto',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  breadcrumbItem: {
    color: colors.tagName,
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: '2px',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,

  breadcrumbSeparator: {
    color: colors.dimText,
    margin: '0 2px',
  } as React.CSSProperties,
};

// Chevron icon component
const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg
    viewBox="0 0 16 16"
    style={{
      ...styles.chevron,
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
    }}
    fill="currentColor"
  >
    <path d="M6 4l4 4-4 4V4z" />
  </svg>
);

// Element icon
const ElementIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" style={styles.emptyIcon} fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);

// Format CSS value with syntax highlighting
const formatCssValue = (value: string): React.ReactNode => {
  if (!value) return <span style={{ color: colors.dimText }}>none</span>;

  // Color values
  if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            backgroundColor: value,
            border: `1px solid ${colors.border}`,
            borderRadius: '2px',
          }}
        />
        <span style={{ color: colors.color }}>{value}</span>
      </span>
    );
  }

  // URL values
  if (value.includes('url(')) {
    return <span style={{ color: colors.url }}>{value}</span>;
  }

  // Number with units
  const numberMatch = value.match(/^(-?[\d.]+)(px|em|rem|%|vh|vw|deg|s|ms)?$/);
  if (numberMatch) {
    return (
      <span>
        <span style={{ color: colors.number }}>{numberMatch[1]}</span>
        {numberMatch[2] && <span style={{ color: colors.unit }}>{numberMatch[2]}</span>}
      </span>
    );
  }

  // Keywords
  const keywords = ['none', 'auto', 'inherit', 'initial', 'unset', 'block', 'inline', 'flex', 'grid', 'hidden', 'visible', 'absolute', 'relative', 'fixed', 'sticky', 'static'];
  if (keywords.includes(value.toLowerCase())) {
    return <span style={{ color: colors.keyword }}>{value}</span>;
  }

  return <span style={{ color: colors.text }}>{value}</span>;
};

// Style categories configuration
const styleCategories = {
  layout: {
    title: 'Layout',
    properties: ['display', 'position', 'float', 'clear', 'visibility', 'overflow', 'overflowX', 'overflowY', 'zIndex'],
  },
  flexbox: {
    title: 'Flexbox',
    properties: ['flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignContent', 'gap', 'rowGap', 'columnGap', 'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'order'],
  },
  grid: {
    title: 'Grid',
    properties: ['gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow', 'gridArea', 'gridGap'],
  },
  size: {
    title: 'Size',
    properties: ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'boxSizing'],
  },
  spacing: {
    title: 'Margin & Padding',
    properties: ['margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  },
  position: {
    title: 'Position',
    properties: ['top', 'right', 'bottom', 'left'],
  },
  typography: {
    title: 'Typography',
    properties: ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'textDecoration', 'textTransform', 'whiteSpace', 'wordBreak', 'color'],
  },
  background: {
    title: 'Background',
    properties: ['background', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat'],
  },
  border: {
    title: 'Border',
    properties: ['border', 'borderWidth', 'borderStyle', 'borderColor', 'borderRadius', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft'],
  },
  effects: {
    title: 'Effects',
    properties: ['opacity', 'boxShadow', 'textShadow', 'filter', 'backdropFilter', 'transform', 'transition', 'animation'],
  },
  interaction: {
    title: 'Interaction',
    properties: ['cursor', 'pointerEvents', 'userSelect'],
  },
};

// Box Model Component
const BoxModel: React.FC<{ rect: { width: number; height: number }; styles: Record<string, string> }> = ({ rect, styles: elementStyles }) => {
  const getValue = (prop: string): string => {
    const val = elementStyles[prop];
    if (!val || val === '0px' || val === 'auto') return '-';
    const num = parseFloat(val);
    return isNaN(num) ? '-' : Math.round(num).toString();
  };

  const margin = {
    top: getValue('marginTop'),
    right: getValue('marginRight'),
    bottom: getValue('marginBottom'),
    left: getValue('marginLeft'),
  };

  const border = {
    top: getValue('borderTopWidth'),
    right: getValue('borderRightWidth'),
    bottom: getValue('borderBottomWidth'),
    left: getValue('borderLeftWidth'),
  };

  const padding = {
    top: getValue('paddingTop'),
    right: getValue('paddingRight'),
    bottom: getValue('paddingBottom'),
    left: getValue('paddingLeft'),
  };

  const content = {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };

  return (
    <div style={styles.boxModel}>
      <div style={{ ...styles.boxModelContainer }}>
        {/* Margin layer */}
        <div
          style={{
            ...styles.boxLayer,
            backgroundColor: colors.boxMargin,
            padding: '16px',
            borderRadius: '2px',
          }}
        >
          <span style={{ ...styles.boxLabel, top: '2px', left: '50%', transform: 'translateX(-50%)' }}>margin</span>
          <span style={{ ...styles.boxValue, position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', marginTop: '10px' }}>{margin.top}</span>
          <span style={{ ...styles.boxValue, position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}>{margin.right}</span>
          <span style={{ ...styles.boxValue, position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)' }}>{margin.bottom}</span>
          <span style={{ ...styles.boxValue, position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)' }}>{margin.left}</span>

          {/* Border layer */}
          <div
            style={{
              ...styles.boxLayer,
              backgroundColor: colors.boxBorder,
              padding: '14px',
              width: '100%',
            }}
          >
            <span style={{ ...styles.boxLabel, top: '2px', left: '50%', transform: 'translateX(-50%)' }}>border</span>
            <span style={{ ...styles.boxValue, position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', marginTop: '10px' }}>{border.top}</span>
            <span style={{ ...styles.boxValue, position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}>{border.right}</span>
            <span style={{ ...styles.boxValue, position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)' }}>{border.bottom}</span>
            <span style={{ ...styles.boxValue, position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)' }}>{border.left}</span>

            {/* Padding layer */}
            <div
              style={{
                ...styles.boxLayer,
                backgroundColor: colors.boxPadding,
                padding: '14px',
                width: '100%',
              }}
            >
              <span style={{ ...styles.boxLabel, top: '2px', left: '50%', transform: 'translateX(-50%)' }}>padding</span>
              <span style={{ ...styles.boxValue, position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', marginTop: '10px' }}>{padding.top}</span>
              <span style={{ ...styles.boxValue, position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}>{padding.right}</span>
              <span style={{ ...styles.boxValue, position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)' }}>{padding.bottom}</span>
              <span style={{ ...styles.boxValue, position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)' }}>{padding.left}</span>

              {/* Content layer */}
              <div
                style={{
                  ...styles.boxLayer,
                  backgroundColor: colors.boxContent,
                  padding: '12px 8px',
                  minWidth: '60px',
                }}
              >
                <span style={{ ...styles.boxValue, color: '#000', fontWeight: 500 }}>
                  {content.width} × {content.height}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// HTML Element syntax highlighted display
const ElementHtml: React.FC<{ element: { tagName: string; id?: string; className?: string; attributes: Record<string, string> } }> = ({ element }) => {
  const { tagName, id, className, attributes } = element;

  // Filter out id and class from attributes since we handle them separately
  const otherAttrs = Object.entries(attributes).filter(
    ([key]) => key !== 'id' && key !== 'class' && key !== 'className'
  );

  return (
    <div style={styles.elementDisplay}>
      <span style={{ color: colors.punctuation }}>&lt;</span>
      <span style={{ color: colors.tagName }}>{tagName.toLowerCase()}</span>

      {id && (
        <>
          <span style={{ color: colors.punctuation }}> </span>
          <span style={{ color: colors.attrName }}>id</span>
          <span style={{ color: colors.punctuation }}>=</span>
          <span style={{ color: colors.punctuation }}>"</span>
          <span style={{ color: colors.id }}>{id}</span>
          <span style={{ color: colors.punctuation }}>"</span>
        </>
      )}

      {className && (
        <>
          <span style={{ color: colors.punctuation }}> </span>
          <span style={{ color: colors.attrName }}>class</span>
          <span style={{ color: colors.punctuation }}>=</span>
          <span style={{ color: colors.punctuation }}>"</span>
          <span style={{ color: colors.className }}>{className}</span>
          <span style={{ color: colors.punctuation }}>"</span>
        </>
      )}

      {otherAttrs.slice(0, 5).map(([key, value]) => (
        <span key={key}>
          <span style={{ color: colors.punctuation }}> </span>
          <span style={{ color: colors.attrName }}>{key}</span>
          <span style={{ color: colors.punctuation }}>=</span>
          <span style={{ color: colors.punctuation }}>"</span>
          <span style={{ color: colors.attrValue }}>
            {value.length > 30 ? value.substring(0, 30) + '...' : value}
          </span>
          <span style={{ color: colors.punctuation }}>"</span>
        </span>
      ))}

      {otherAttrs.length > 5 && (
        <span style={{ color: colors.dimText }}> +{otherAttrs.length - 5} more</span>
      )}

      <span style={{ color: colors.punctuation }}>&gt;</span>
    </div>
  );
};

// Collapsible Section Component
const Section: React.FC<{
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string | number;
}> = ({ title, expanded, onToggle, children, badge }) => (
  <div style={styles.section}>
    <div
      style={{
        ...styles.sectionHeader,
      }}
      onClick={onToggle}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = colors.backgroundAlt;
      }}
    >
      <ChevronIcon expanded={expanded} />
      <span style={styles.sectionTitle}>{title}</span>
      {badge !== undefined && (
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '10px',
            color: colors.dimText,
            backgroundColor: colors.background,
            padding: '2px 6px',
            borderRadius: '10px',
          }}
        >
          {badge}
        </span>
      )}
    </div>
    {expanded && <div style={styles.sectionContent}>{children}</div>}
  </div>
);

export const ElementInspector: React.FC = () => {
  const { selectedElement } = useSelectionStore();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['properties', 'boxModel', 'styles'])
  );
  const [copiedSelector, setCopiedSelector] = useState(false);

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

  const copySelector = useCallback(() => {
    if (selectedElement?.selector) {
      navigator.clipboard.writeText(selectedElement.selector);
      setCopiedSelector(true);
      setTimeout(() => setCopiedSelector(false), 2000);
    }
  }, [selectedElement?.selector]);

  // Organize styles by category
  const organizedStyles = useMemo(() => {
    if (!selectedElement?.styles) return null;

    const elementStyles = selectedElement.styles;
    const result: Record<string, { prop: string; value: string }[]> = {};

    for (const [categoryKey, category] of Object.entries(styleCategories)) {
      const categoryStyles = category.properties
        .filter((prop) => elementStyles[prop] && elementStyles[prop] !== 'none' && elementStyles[prop] !== 'normal' && elementStyles[prop] !== 'auto')
        .map((prop) => ({ prop, value: elementStyles[prop] }));

      if (categoryStyles.length > 0) {
        result[categoryKey] = categoryStyles;
      }
    }

    return result;
  }, [selectedElement?.styles]);

  if (!selectedElement) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span>Element Inspector</span>
        </div>
        <div style={styles.emptyState}>
          <ElementIcon />
          <div style={{ fontSize: '13px', marginBottom: '8px', color: colors.text }}>
            No element selected
          </div>
          <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
            Click the <strong>Select</strong> button in the toolbar,<br />
            then click on any element in the preview.
          </div>
        </div>
      </div>
    );
  }

  const { tagName, id, className, attributes, styles: elementStyles, rect, selector } = selectedElement;
  const attrCount = Object.keys(attributes).length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>Element Inspector</span>
        <button
          style={{
            ...styles.copyButton,
            backgroundColor: copiedSelector ? '#2ea043' : 'transparent',
            color: copiedSelector ? '#fff' : colors.dimText,
          }}
          onClick={copySelector}
          title="Copy CSS selector"
        >
          {copiedSelector ? '✓ Copied' : 'Copy Selector'}
        </button>
      </div>

      {/* Element HTML Display */}
      <ElementHtml element={{ tagName, id, className, attributes }} />

      <div style={styles.content}>
        {/* Properties Section */}
        <Section
          title="Properties"
          expanded={expandedSections.has('properties')}
          onToggle={() => toggleSection('properties')}
        >
          <div style={styles.propertyRow}>
            <span style={styles.propertyName}>Selector</span>
            <span style={{ ...styles.propertyValue, color: colors.attrValue, fontFamily: 'Consolas, monospace' }}>
              {selector}
            </span>
          </div>
          {id && (
            <div style={styles.propertyRow}>
              <span style={styles.propertyName}>ID</span>
              <span style={{ ...styles.propertyValue, color: colors.id }}>#{id}</span>
            </div>
          )}
          {className && (
            <div style={styles.propertyRow}>
              <span style={styles.propertyName}>Classes</span>
              <span style={{ ...styles.propertyValue, color: colors.className }}>
                {className.split(' ').map((cls, i) => (
                  <span key={i} style={{ marginRight: '4px' }}>.{cls}</span>
                ))}
              </span>
            </div>
          )}
          <div style={styles.propertyRow}>
            <span style={styles.propertyName}>Position</span>
            <span style={styles.propertyValue}>
              <span style={{ color: colors.number }}>{Math.round(rect.x)}</span>
              <span style={{ color: colors.punctuation }}>, </span>
              <span style={{ color: colors.number }}>{Math.round(rect.y)}</span>
              <span style={{ color: colors.unit }}> px</span>
            </span>
          </div>
          <div style={styles.propertyRow}>
            <span style={styles.propertyName}>Size</span>
            <span style={styles.propertyValue}>
              <span style={{ color: colors.number }}>{Math.round(rect.width)}</span>
              <span style={{ color: colors.punctuation }}> × </span>
              <span style={{ color: colors.number }}>{Math.round(rect.height)}</span>
              <span style={{ color: colors.unit }}> px</span>
            </span>
          </div>
        </Section>

        {/* Box Model Section */}
        {elementStyles && (
          <Section
            title="Box Model"
            expanded={expandedSections.has('boxModel')}
            onToggle={() => toggleSection('boxModel')}
          >
            <BoxModel rect={rect} styles={elementStyles} />
          </Section>
        )}

        {/* Attributes Section */}
        {attrCount > 0 && (
          <Section
            title="Attributes"
            expanded={expandedSections.has('attributes')}
            onToggle={() => toggleSection('attributes')}
            badge={attrCount}
          >
            {Object.entries(attributes).map(([key, value]) => (
              <div key={key} style={styles.propertyRow}>
                <span style={styles.propertyName}>{key}</span>
                <span style={{ ...styles.propertyValue, color: colors.attrValue }}>
                  {typeof value === 'string' && value.length > 60
                    ? value.substring(0, 60) + '...'
                    : String(value)}
                </span>
              </div>
            ))}
          </Section>
        )}

        {/* Computed Styles Section */}
        {organizedStyles && Object.keys(organizedStyles).length > 0 && (
          <Section
            title="Computed Styles"
            expanded={expandedSections.has('styles')}
            onToggle={() => toggleSection('styles')}
          >
            {Object.entries(organizedStyles).map(([categoryKey, categoryStyles]) => (
              <div key={categoryKey} style={styles.styleCategory}>
                <div style={styles.styleCategoryTitle}>
                  {styleCategories[categoryKey as keyof typeof styleCategories].title}
                </div>
                {categoryStyles.map(({ prop, value }) => (
                  <div key={prop} style={styles.styleRow}>
                    <span style={styles.styleName}>{prop}</span>
                    <span style={styles.styleColon}>:</span>
                    <span style={styles.styleValue}>{formatCssValue(value)}</span>
                  </div>
                ))}
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
};
