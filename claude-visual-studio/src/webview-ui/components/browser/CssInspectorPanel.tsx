import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore, useSelectionStore, useCssChangesStore, VIEWPORT_PRESETS, type ElementInfo, type CssChange } from '../../state/stores';
import { ElementInspector } from '../ElementInspector';
import { useVSCodeApi } from '../../hooks/useVSCodeApi';

// ============================================================================
// Types
// ============================================================================

type CssUnit = 'px' | '%' | 'em' | 'rem' | 'vw' | 'vh' | 'auto';
type DisplayType = 'block' | 'flex' | 'grid' | 'inline' | 'inline-block' | 'none';
type FlexDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse';
type JustifyContent = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
type AlignItems = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
type TextAlign = 'left' | 'center' | 'right' | 'justify';
type VerticalAlign = 'top' | 'middle' | 'bottom';

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1e1e1e',
    borderLeft: '1px solid var(--vscode-panel-border)',
    height: '100%',
    overflow: 'hidden',
    color: '#cccccc',
    fontSize: '12px',
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
    backgroundColor: '#252526',
    borderBottom: '1px solid #3c3c3c',
    minHeight: '36px',
    flexShrink: 0,
  } as React.CSSProperties,

  title: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#cccccc',
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  closeButton: {
    padding: '2px 4px',
    backgroundColor: 'transparent',
    color: '#cccccc',
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
    borderBottom: '1px solid #3c3c3c',
  } as React.CSSProperties,

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: '#2d2d2d',
    cursor: 'pointer',
    userSelect: 'none',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#ffffff',
  } as React.CSSProperties,

  sectionContent: {
    padding: '12px',
    backgroundColor: '#1e1e1e',
  } as React.CSSProperties,

  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  } as React.CSSProperties,

  label: {
    fontSize: '11px',
    color: '#9d9d9d',
    minWidth: '70px',
    flexShrink: 0,
  } as React.CSSProperties,

  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flex: 1,
  } as React.CSSProperties,

  input: {
    flex: 1,
    padding: '4px 8px',
    fontSize: '11px',
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    border: '1px solid #3c3c3c',
    borderRadius: '3px',
    outline: 'none',
    minWidth: '50px',
  } as React.CSSProperties,

  smallInput: {
    width: '60px',
    padding: '4px 6px',
    fontSize: '11px',
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    border: '1px solid #3c3c3c',
    borderRadius: '3px',
    outline: 'none',
  } as React.CSSProperties,

  select: {
    flex: 1,
    padding: '4px 8px',
    fontSize: '11px',
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    border: '1px solid #3c3c3c',
    borderRadius: '3px',
    outline: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  unitSelect: {
    width: '50px',
    padding: '4px 4px',
    fontSize: '10px',
    backgroundColor: '#3c3c3c',
    color: '#9d9d9d',
    border: '1px solid #3c3c3c',
    borderRadius: '3px',
    outline: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  colorInput: {
    width: '24px',
    height: '24px',
    padding: '0',
    border: '1px solid #3c3c3c',
    borderRadius: '3px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
  } as React.CSSProperties,

  checkbox: {
    width: '14px',
    height: '14px',
    cursor: 'pointer',
    accentColor: '#0078d4',
  } as React.CSSProperties,

  buttonGroup: {
    display: 'flex',
    gap: '2px',
    flex: 1,
  } as React.CSSProperties,

  button: {
    flex: 1,
    padding: '6px 8px',
    fontSize: '11px',
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    border: '1px solid #3c3c3c',
    borderRadius: '3px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  buttonActive: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
    color: '#ffffff',
  } as React.CSSProperties,

  iconButton: {
    padding: '4px',
    backgroundColor: 'transparent',
    color: '#9d9d9d',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  gridRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '8px',
  } as React.CSSProperties,

  gridRow3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '4px',
    marginBottom: '8px',
  } as React.CSSProperties,

  noSelection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '24px',
    textAlign: 'center',
    color: '#9d9d9d',
  } as React.CSSProperties,

  elementTag: {
    backgroundColor: '#0078d4',
    color: '#ffffff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    marginLeft: '8px',
  } as React.CSSProperties,

  sliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  } as React.CSSProperties,

  slider: {
    flex: 1,
    height: '4px',
    appearance: 'none',
    backgroundColor: '#3c3c3c',
    borderRadius: '2px',
    outline: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  collapsibleHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    backgroundColor: '#252526',
    cursor: 'pointer',
    userSelect: 'none',
    borderBottom: '1px solid #3c3c3c',
  } as React.CSSProperties,

  // Tab styles
  tabContainer: {
    display: 'flex',
    backgroundColor: '#252526',
    borderBottom: '1px solid #3c3c3c',
    flexShrink: 0,
  } as React.CSSProperties,

  tab: {
    flex: 1,
    padding: '10px 16px',
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    backgroundColor: 'transparent',
    color: '#9d9d9d',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  } as React.CSSProperties,

  tabActive: {
    color: '#ffffff',
    borderBottomColor: '#0078d4',
    backgroundColor: '#1e1e1e',
  } as React.CSSProperties,

  tabContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,

  // Apply/Undo Toolbar styles
  applyUndoToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: '#2d2d30',
    borderBottom: '1px solid #3c3c3c',
    gap: '8px',
    flexShrink: 0,
  } as React.CSSProperties,

  applyUndoInfo: {
    fontSize: '11px',
    color: '#9d9d9d',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties,

  applyUndoButtons: {
    display: 'flex',
    gap: '6px',
  } as React.CSSProperties,

  applyButton: {
    padding: '5px 12px',
    fontSize: '11px',
    fontWeight: 500,
    backgroundColor: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,

  undoButton: {
    padding: '5px 12px',
    fontSize: '11px',
    fontWeight: 500,
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    border: '1px solid #5a5a5a',
    borderRadius: '3px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,

  changesCount: {
    backgroundColor: '#0e639c',
    color: '#ffffff',
    padding: '1px 6px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 600,
  } as React.CSSProperties,
};

// ============================================================================
// Utility Functions
// ============================================================================

function parseNumericValue(value: string | undefined): { num: number; unit: string } {
  if (!value || value === 'auto' || value === 'none' || value === 'normal') {
    return { num: 0, unit: 'px' };
  }
  const match = value.match(/^(-?[\d.]+)(px|%|em|rem|vw|vh)?$/);
  if (match) {
    return { num: parseFloat(match[1]), unit: match[2] || 'px' };
  }
  return { num: 0, unit: 'px' };
}

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

function hexToRgba(hex: string, alpha: number = 1): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;
  }
  return hex;
}

function getOpacityFromColor(color: string): number {
  const match = color.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
  return match ? parseFloat(match[1]) * 100 : 100;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultOpen = true,
  actions,
  children
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader} onClick={() => setIsOpen(!isOpen)}>
        <span style={styles.sectionTitle}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {actions}
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
      </div>
      {isOpen && <div style={styles.sectionContent}>{children}</div>}
    </div>
  );
};

// Scrub Label Component - for labels that can be dragged to change values
interface ScrubLabelProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  sensitivity?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
  setIsScrubbing?: (scrubbing: boolean) => void;
}

const ScrubLabel: React.FC<ScrubLabelProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  sensitivity = 2,
  disabled = false,
  style,
  setIsScrubbing,
}) => {
  const scrubRef = useRef<{
    isDragging: boolean;
    startX: number;
    startValue: number;
    cleanup: (() => void) | null;
  }>({ isDragging: false, startX: 0, startValue: 0, cleanup: null });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrubRef.current.cleanup) {
        scrubRef.current.cleanup();
      }
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    // Cleanup any existing drag operation
    if (scrubRef.current.cleanup) {
      scrubRef.current.cleanup();
    }

    const startX = e.clientX;
    const startValue = value;

    scrubRef.current = {
      isDragging: true,
      startX,
      startValue,
      cleanup: null,
    };

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    // Notify that scrubbing started (to disable iframe pointer-events)
    setIsScrubbing?.(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!scrubRef.current.isDragging) return;

      const deltaX = moveEvent.clientX - startX;
      const deltaValue = Math.round(deltaX / sensitivity) * step;
      let newValue = startValue + deltaValue;

      if (min !== undefined) newValue = Math.max(min, newValue);
      if (max !== undefined) newValue = Math.min(max, newValue);

      onChange(newValue);
    };

    const cleanup = () => {
      scrubRef.current.isDragging = false;
      scrubRef.current.cleanup = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);
      // Notify that scrubbing ended
      setIsScrubbing?.(false);
    };

    const handleMouseUp = () => {
      cleanup();
    };

    scrubRef.current.cleanup = cleanup;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp);
  }, [disabled, value, step, min, max, onChange, sensitivity, setIsScrubbing]);

  return (
    <span
      style={{
        ...styles.label,
        cursor: disabled ? 'default' : 'ew-resize',
        userSelect: 'none',
        padding: '2px 4px',
        borderRadius: '2px',
        transition: 'background-color 0.15s',
        ...style,
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      title={disabled ? '' : 'Drag to adjust value'}
    >
      {label}
    </span>
  );
};

interface NumberInputProps {
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  onUnitChange?: (unit: string) => void;
  onScrubEnd?: () => void; // Called when scrub ends
  showUnit?: boolean;
  units?: string[];
  disabled?: boolean;
  label?: string;
  scrubSensitivity?: number; // pixels per step change
  setIsScrubbing?: (scrubbing: boolean) => void;
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  unit = 'px',
  min,
  max,
  step = 1,
  onChange,
  onUnitChange,
  onScrubEnd,
  showUnit = true,
  units = ['px', '%', 'em', 'rem', 'vw', 'vh'],
  disabled = false,
  label,
  scrubSensitivity = 2, // default: 2 pixels = 1 step
  setIsScrubbing,
}) => {
  const scrubRef = useRef<{
    isDragging: boolean;
    startX: number;
    startValue: number;
    cleanup: (() => void) | null;
  }>({ isDragging: false, startX: 0, startValue: 0, cleanup: null });
  const labelRef = useRef<HTMLSpanElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrubRef.current.cleanup) {
        scrubRef.current.cleanup();
      }
    };
  }, []);

  // Handle scrubbing (drag on label to change value)
  const handleLabelMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    // Cleanup any existing drag operation
    if (scrubRef.current.cleanup) {
      scrubRef.current.cleanup();
    }

    const startX = e.clientX;
    const startValue = value;

    scrubRef.current = {
      isDragging: true,
      startX,
      startValue,
      cleanup: null,
    };

    // Change cursor globally during drag
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    // Notify that scrubbing started (to disable iframe pointer-events)
    setIsScrubbing?.(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!scrubRef.current.isDragging) return;

      const deltaX = moveEvent.clientX - startX;
      const deltaValue = Math.round(deltaX / scrubSensitivity) * step;
      let newValue = startValue + deltaValue;

      // Clamp to min/max
      if (min !== undefined) newValue = Math.max(min, newValue);
      if (max !== undefined) newValue = Math.min(max, newValue);

      onChange(newValue);
    };

    const cleanup = () => {
      scrubRef.current.isDragging = false;
      scrubRef.current.cleanup = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);
      // Notify that scrubbing ended
      setIsScrubbing?.(false);
      // Call onScrubEnd callback if provided
      onScrubEnd?.();
    };

    const handleMouseUp = () => {
      cleanup();
    };

    scrubRef.current.cleanup = cleanup;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    // Also listen for mouse leaving the window
    document.addEventListener('mouseleave', handleMouseUp);
  }, [disabled, value, step, min, max, onChange, scrubSensitivity, onScrubEnd, setIsScrubbing]);

  const scrubLabelStyle: React.CSSProperties = {
    ...styles.label,
    minWidth: 'auto',
    marginRight: '4px',
    cursor: disabled ? 'default' : 'ew-resize',
    userSelect: 'none',
    padding: '2px 4px',
    borderRadius: '2px',
    transition: 'background-color 0.15s',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
      {label && (
        <span
          ref={labelRef}
          style={scrubLabelStyle}
          onMouseDown={handleLabelMouseDown}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title={disabled ? '' : 'Drag to adjust value'}
        >
          {label}
        </span>
      )}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{ ...styles.smallInput, flex: 1 }}
        disabled={disabled}
      />
      {showUnit && onUnitChange && (
        <select
          value={unit}
          onChange={(e) => onUnitChange(e.target.value)}
          style={styles.unitSelect}
          disabled={disabled}
        >
          {units.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      )}
    </div>
  );
};

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  showOpacity?: boolean;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  showOpacity = false,
  opacity = 100,
  onOpacityChange,
}) => {
  const hexValue = rgbToHex(value);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
      <input
        type="color"
        value={hexValue}
        onChange={(e) => {
          const newColor = showOpacity && opacity < 100
            ? hexToRgba(e.target.value, opacity / 100)
            : e.target.value;
          onChange(newColor);
        }}
        style={styles.colorInput}
      />
      <input
        type="text"
        value={hexValue}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...styles.input, flex: 1 }}
      />
      {showOpacity && onOpacityChange && (
        <>
          <input
            type="number"
            value={Math.round(opacity)}
            min={0}
            max={100}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value) || 0)}
            style={{ ...styles.smallInput, width: '50px' }}
          />
          <span style={{ color: '#9d9d9d', fontSize: '11px' }}>%</span>
        </>
      )}
    </div>
  );
};

interface ButtonGroupProps<T extends string> {
  options: { value: T; icon?: React.ReactNode; label?: string }[];
  value: T;
  onChange: (value: T) => void;
}

function ButtonGroup<T extends string>({ options, value, onChange }: ButtonGroupProps<T>) {
  return (
    <div style={styles.buttonGroup}>
      {options.map((opt) => (
        <button
          key={opt.value}
          style={{
            ...styles.button,
            ...(value === opt.value ? styles.buttonActive : {}),
          }}
          onClick={() => onChange(opt.value)}
          title={opt.label || opt.value}
        >
          {opt.icon || opt.label || opt.value}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

const FlexIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" />
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
);

const BlockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" />
  </svg>
);

const InlineIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12" />
    <rect x="7" y="8" width="10" height="8" />
  </svg>
);

const InlineBlockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="5" width="14" height="14" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </svg>
);

const AlignLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"/>
  </svg>
);

const AlignCenterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h18v2H3V3zm3 4h12v2H6V7zm-3 4h18v2H3v-2zm3 4h12v2H6v-2zm-3 4h18v2H3v-2z"/>
  </svg>
);

const AlignRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h18v2H3V3zm6 4h12v2H9V7zm-6 4h18v2H3v-2zm6 4h12v2H9v-2zm-6 4h18v2H3v-2z"/>
  </svg>
);

const AlignTopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h18v2H3V3zm5 4h8v14H8V7z"/>
  </svg>
);

const AlignMiddleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5h8v6H8V5zm0 8h8v6H8v-6zm-5-1h4v2H3v-2zm14 0h4v2h-4v-2z"/>
  </svg>
);

const AlignBottomIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 19h18v2H3v-2zm5-16h8v14H8V3z"/>
  </svg>
);

const LinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const MobileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12" y2="18" />
  </svg>
);

const TabletIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12" y2="18" />
  </svg>
);

const LaptopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="12" rx="2" ry="2" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

const DesktopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const ResponsiveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
    <path d="M8 3v2M16 3v2M8 19v2M16 19v2" />
  </svg>
);

const RotateIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

// Tab Icons
const StylesTabIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 3h12v1H2V3zm0 3h8v1H2V6zm0 3h12v1H2V9zm0 3h8v1H2v-1z"/>
  </svg>
);

const ElementTabIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.708 5.578L2.061 8.224l2.647 2.646.708-.708-1.94-1.939 1.939-1.939-.707-.706zm6.584 0l-.707.707 1.939 1.939-1.939 1.939.707.707 2.646-2.646-2.646-2.646zM6.5 11l2-6h1l-2 6h-1z"/>
  </svg>
);

// ============================================================================
// Main Component
// ============================================================================

type TabType = 'styles' | 'element';

// Icons for Apply/Undo toolbar
const ApplyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
  </svg>
);

const UndoIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5.5 3.5L1 8l4.5 4.5v-3h6.5a2 2 0 100-4H5.5v-2z"/>
  </svg>
);

// Helper function to generate Claude Code prompt
function generateClaudeCodePrompt(changes: CssChange[]): string {
  // Group changes by element
  const changesByElement = changes.reduce((acc, change) => {
    const key = `${change.elementTagName} (${change.elementSelector})`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(change);
    return acc;
  }, {} as Record<string, CssChange[]>);

  let prompt = `Apply the following CSS style changes to the HTML/CSS file:\n\n`;

  for (const [elementKey, elementChanges] of Object.entries(changesByElement)) {
    prompt += `**Element: ${elementKey}**\n`;
    for (const change of elementChanges) {
      prompt += `- Change \`${change.property}\` from \`${change.originalValue || 'unset'}\` to \`${change.newValue}\`\n`;
    }
    prompt += `\n`;
  }

  prompt += `\n**Instructions:**\n`;
  prompt += `1. Find the element(s) matching the selector(s) above\n`;
  prompt += `2. Update the CSS styles accordingly (inline styles or stylesheet)\n`;
  prompt += `3. Preserve existing styles that are not being changed\n`;

  return prompt;
}

export const CssInspectorPanel: React.FC = () => {
  const {
    cssInspectorWidth,
    setCssInspectorWidth,
    toggleCssInspector,
    viewportWidth,
    viewportHeight,
    viewportPreset,
    viewportRotated,
    setViewportSize,
    setViewportPreset,
    toggleViewportRotation,
    resetViewport,
    setIsScrubbing,
  } = useEditorStore();
  const { selectedElement, hoveredElement, setSelectedElement } = useSelectionStore();
  const {
    cssChanges,
    addCssChange,
    undoLastCssChange,
    undoAllCssChanges,
    applyCssChanges,
    getOriginalValue,
  } = useCssChangesStore();
  const { postMessage } = useVSCodeApi();
  const [activeTab, setActiveTab] = useState<TabType>('styles');
  const [isResizing, setIsResizing] = useState(false);
  const [resizerHover, setResizerHover] = useState(false);
  const [linkedPadding, setLinkedPadding] = useState(true);
  const [linkedMargin, setLinkedMargin] = useState(true);
  const [linkedRadius, setLinkedRadius] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Track if we've applied position: relative during current scrub session
  const positionAppliedRef = useRef(false);

  const element = selectedElement || hoveredElement;
  const hasPendingChanges = cssChanges.length > 0;

  // Reset position applied flag when element changes
  useEffect(() => {
    positionAppliedRef.current = false;
  }, [element?.selector]);

  // Get computed styles from element
  const getStyle = useCallback((property: string): string => {
    return element?.styles?.computed?.[property] || '';
  }, [element]);

  // Send CSS change to iframe and track it
  const applyCssChange = useCallback((property: string, value: string) => {
    if (!element?.selector) return;

    // Store original value if not already stored
    const currentValue = getStyle(property);
    const storedOriginal = getOriginalValue(element.selector, property);
    const originalValue = storedOriginal !== undefined ? storedOriginal : currentValue;

    // Track the change
    addCssChange({
      elementSelector: element.selector,
      elementTagName: element.tagName || 'unknown',
      property,
      originalValue,
      newValue: value,
    });

    // Find iframe and send message
    const iframe = document.querySelector('iframe[title="Browser Preview"]') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'apply-css-style',
        payload: {
          selector: element.selector,
          property,
          value,
        },
      }, '*');
    }
  }, [element, getStyle, getOriginalValue, addCssChange]);

  // Handle Apply button - send changes to Claude Code
  const handleApplyChanges = useCallback(() => {
    if (cssChanges.length === 0) return;

    // Generate prompt for Claude Code
    const prompt = generateClaudeCodePrompt(cssChanges);

    // Send to VS Code extension which will forward to Claude Code terminal
    postMessage({
      type: 'apply-css-to-claude',
      payload: {
        changes: cssChanges,
        prompt,
      },
    });

    // Clear changes after applying
    applyCssChanges();
  }, [cssChanges, postMessage, applyCssChanges]);

  // Handle Undo button - revert last change in preview
  const handleUndoLastChange = useCallback(() => {
    const lastChange = undoLastCssChange();
    if (!lastChange) return;

    // Revert the change in the iframe
    const iframe = document.querySelector('iframe[title="Browser Preview"]') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'apply-css-style',
        payload: {
          selector: lastChange.elementSelector,
          property: lastChange.property,
          value: lastChange.originalValue,
        },
      }, '*');
    }
  }, [undoLastCssChange]);

  // Handle Undo All - revert all changes in preview
  const handleUndoAllChanges = useCallback(() => {
    const allChanges = undoAllCssChanges();
    if (allChanges.length === 0) return;

    const iframe = document.querySelector('iframe[title="Browser Preview"]') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      // Revert all changes in reverse order
      for (const change of allChanges.reverse()) {
        iframe.contentWindow.postMessage({
          type: 'apply-css-style',
          payload: {
            selector: change.elementSelector,
            property: change.property,
            value: change.originalValue,
          },
        }, '*');
      }
    }
  }, [undoAllCssChanges]);

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

  // Listen for element updates from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data, source } = event.data || {};
      if (source === 'claude-vs-inspector' && type === 'element-updated' && data) {
        // Update selected element with new styles
        setSelectedElement(data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setSelectedElement]);

  // Determine if element has text content (for text section visibility)
  const hasTextContent = element && (
    ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button', 'label', 'div', 'li', 'td', 'th']
      .includes(element.tagName?.toLowerCase() || '')
  );

  // Get current values
  const position = getStyle('position') || 'static';
  const display = getStyle('display') || 'block';
  const opacity = parseFloat(getStyle('opacity') || '1') * 100;

  const { num: width, unit: widthUnit } = parseNumericValue(getStyle('width'));
  const { num: height, unit: heightUnit } = parseNumericValue(getStyle('height'));
  const { num: x } = parseNumericValue(getStyle('left'));
  const { num: y } = parseNumericValue(getStyle('top'));
  const { num: paddingTop } = parseNumericValue(getStyle('paddingTop'));
  const { num: paddingRight } = parseNumericValue(getStyle('paddingRight'));
  const { num: paddingBottom } = parseNumericValue(getStyle('paddingBottom'));
  const { num: paddingLeft } = parseNumericValue(getStyle('paddingLeft'));
  const { num: marginTop } = parseNumericValue(getStyle('marginTop'));
  const { num: marginRight } = parseNumericValue(getStyle('marginRight'));
  const { num: marginBottom } = parseNumericValue(getStyle('marginBottom'));
  const { num: marginLeft } = parseNumericValue(getStyle('marginLeft'));
  const { num: borderRadius } = parseNumericValue(getStyle('borderRadius'));
  const { num: fontSize } = parseNumericValue(getStyle('fontSize'));
  const fontWeight = getStyle('fontWeight') || '400';
  const fontFamily = getStyle('fontFamily')?.split(',')[0]?.replace(/['"]/g, '') || 'Arial';
  const textAlign = getStyle('textAlign') as TextAlign || 'left';
  const color = getStyle('color') || '#000000';
  const backgroundColor = getStyle('backgroundColor') || 'transparent';
  const lineHeight = getStyle('lineHeight') || 'normal';
  const letterSpacing = getStyle('letterSpacing') || 'normal';

  if (!element) {
    return (
      <div style={{ ...styles.container, width: `${cssInspectorWidth}px`, position: 'relative' }}>
        <div
          style={{
            ...styles.resizer,
            backgroundColor: resizerHover || isResizing ? 'var(--vscode-focusBorder)' : 'var(--vscode-panel-border)',
          }}
          onMouseDown={handleResizerMouseDown}
          onMouseEnter={() => setResizerHover(true)}
          onMouseLeave={() => setResizerHover(false)}
        />
        <div style={styles.header}>
          <span style={styles.title}>Elementor</span>
          <button
            style={styles.closeButton}
            onClick={toggleCssInspector}
            title="Close"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.116 8l-4.558 4.558.884.884L8 8.884l4.558 4.558.884-.884L8.884 8l4.558-4.558-.884-.884L8 7.116 3.442 2.558l-.884.884L7.116 8z" />
            </svg>
          </button>
        </div>
        {/* Tabs */}
        <div style={styles.tabContainer}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'styles' ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab('styles')}
          >
            <StylesTabIcon />
            Styles
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'element' ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab('element')}
          >
            <ElementTabIcon />
            Element
          </button>
        </div>
        {/* Tab Content */}
        <div style={styles.tabContent}>
          {activeTab === 'styles' ? (
            <div style={styles.noSelection}>
              <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" style={{ marginBottom: '12px', opacity: 0.5 }}>
                <path d="M1 1l5 14 2-6 6-2L1 1zm3.5 4.5l5 1.8-2.8 1-1 2.8-1.2-5.6z" />
              </svg>
              <span style={{ fontSize: '12px' }}>
                Enable selection mode and click on an element to inspect its CSS
              </span>
            </div>
          ) : (
            <ElementInspector />
          )}
        </div>
      </div>
    );
  }

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
          <span style={styles.title}>Elementor</span>
          <span style={styles.elementTag}>{element.tagName}</span>
        </div>
        <button
          style={styles.closeButton}
          onClick={toggleCssInspector}
          title="Close"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7.116 8l-4.558 4.558.884.884L8 8.884l4.558 4.558.884-.884L8.884 8l4.558-4.558-.884-.884L8 7.116 3.442 2.558l-.884.884L7.116 8z" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabContainer}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'styles' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('styles')}
        >
          <StylesTabIcon />
          Styles
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'element' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('element')}
        >
          <ElementTabIcon />
          Element
        </button>
      </div>

      {/* Apply/Undo Toolbar - shown when there are pending changes */}
      {hasPendingChanges && (
        <div style={styles.applyUndoToolbar}>
          <div style={styles.applyUndoInfo}>
            <span style={styles.changesCount}>{cssChanges.length}</span>
            <span>change{cssChanges.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={styles.applyUndoButtons}>
            <button
              style={styles.undoButton}
              onClick={handleUndoLastChange}
              title="Undo last change"
            >
              <UndoIcon />
              Undo
            </button>
            <button
              style={{
                ...styles.undoButton,
                marginLeft: '2px',
              }}
              onClick={handleUndoAllChanges}
              title="Undo all changes"
            >
              Undo All
            </button>
            <button
              style={styles.applyButton}
              onClick={handleApplyChanges}
              title="Apply changes to code via Claude"
            >
              <ApplyIcon />
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'element' ? (
        <ElementInspector />
      ) : (
      <div style={styles.content}>
        {/* Responsive Section - Always visible */}
        <CollapsibleSection title="Responsive">
          {/* Device Preset */}
          <div style={styles.row}>
            <span style={styles.label}>Device</span>
            <select
              value={viewportPreset}
              onChange={(e) => setViewportPreset(e.target.value)}
              style={styles.select}
            >
              {VIEWPORT_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name} {preset.width > 0 ? `(${preset.width}x${preset.height})` : ''}
                </option>
              ))}
              <option value="Custom">Custom</option>
            </select>
          </div>

          {/* Quick Device Buttons */}
          <div style={{ ...styles.row, marginBottom: '12px' }}>
            <span style={styles.label}>Quick</span>
            <div style={styles.buttonGroup}>
              <button
                style={{
                  ...styles.button,
                  ...(viewportPreset === 'Responsive' ? styles.buttonActive : {}),
                  padding: '6px',
                }}
                onClick={() => setViewportPreset('Responsive')}
                title="Responsive"
              >
                <ResponsiveIcon />
              </button>
              <button
                style={{
                  ...styles.button,
                  ...(viewportPreset.includes('iPhone') || viewportPreset.includes('Pixel') || viewportPreset.includes('Samsung') ? styles.buttonActive : {}),
                  padding: '6px',
                }}
                onClick={() => setViewportPreset('iPhone 14')}
                title="Mobile"
              >
                <MobileIcon />
              </button>
              <button
                style={{
                  ...styles.button,
                  ...(viewportPreset.includes('iPad') || viewportPreset.includes('Surface') ? styles.buttonActive : {}),
                  padding: '6px',
                }}
                onClick={() => setViewportPreset('iPad Mini')}
                title="Tablet"
              >
                <TabletIcon />
              </button>
              <button
                style={{
                  ...styles.button,
                  ...(viewportPreset === 'Laptop' ? styles.buttonActive : {}),
                  padding: '6px',
                }}
                onClick={() => setViewportPreset('Laptop')}
                title="Laptop"
              >
                <LaptopIcon />
              </button>
              <button
                style={{
                  ...styles.button,
                  ...(viewportPreset === 'Desktop' || viewportPreset === '4K' ? styles.buttonActive : {}),
                  padding: '6px',
                }}
                onClick={() => setViewportPreset('Desktop')}
                title="Desktop"
              >
                <DesktopIcon />
              </button>
            </div>
          </div>

          {/* Custom Dimensions */}
          <div style={styles.gridRow}>
            <NumberInput
              label="W"
              value={viewportWidth}
              showUnit={false}
              onChange={(v) => setViewportSize(v, viewportHeight)}
            />
            <NumberInput
              label="H"
              value={viewportHeight}
              showUnit={false}
              onChange={(v) => setViewportSize(viewportWidth, v)}
            />
          </div>

          {/* Rotation & Reset */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={{
                ...styles.button,
                flex: 1,
                ...(viewportRotated ? styles.buttonActive : {}),
              }}
              onClick={toggleViewportRotation}
              disabled={viewportWidth === 0 && viewportHeight === 0}
              title="Rotate viewport"
            >
              <RotateIcon />
              <span style={{ marginLeft: '4px' }}>Rotate</span>
            </button>
            <button
              style={{
                ...styles.button,
                flex: 1,
              }}
              onClick={resetViewport}
              title="Reset to responsive"
            >
              Reset
            </button>
          </div>

          {/* Current Size Info */}
          {viewportWidth > 0 && viewportHeight > 0 && (
            <div style={{
              marginTop: '8px',
              fontSize: '10px',
              color: '#9d9d9d',
              textAlign: 'center',
            }}>
              {viewportWidth} x {viewportHeight}px
              {viewportRotated && ' (Rotated)'}
            </div>
          )}
        </CollapsibleSection>

        {/* Position Section */}
        <CollapsibleSection title="Position">
          <div style={styles.gridRow}>
            <NumberInput
              label="X"
              value={parseNumericValue(getStyle('left')).num}
              onChange={(v) => {
                // Auto-switch to relative if position is static (only once per scrub session)
                if (position === 'static' && !positionAppliedRef.current) {
                  positionAppliedRef.current = true;
                  applyCssChange('position', 'relative');
                }
                applyCssChange('left', `${Math.round(v)}px`);
              }}
              onScrubEnd={() => { positionAppliedRef.current = false; }}
              setIsScrubbing={setIsScrubbing}
            />
            <NumberInput
              label="Y"
              value={parseNumericValue(getStyle('top')).num}
              onChange={(v) => {
                // Auto-switch to relative if position is static (only once per scrub session)
                if (position === 'static' && !positionAppliedRef.current) {
                  positionAppliedRef.current = true;
                  applyCssChange('position', 'relative');
                }
                applyCssChange('top', `${Math.round(v)}px`);
              }}
              onScrubEnd={() => { positionAppliedRef.current = false; }}
              setIsScrubbing={setIsScrubbing}
            />
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Position</span>
            <select
              value={position}
              onChange={(e) => applyCssChange('position', e.target.value)}
              style={styles.select}
            >
              <option value="static">Static</option>
              <option value="relative">Relative</option>
              <option value="absolute">Absolute</option>
              <option value="fixed">Fixed</option>
              <option value="sticky">Sticky</option>
            </select>
          </div>
          <div style={styles.row}>
            <ScrubLabel
              label="Z-Index"
              value={parseInt(getStyle('zIndex')) || 0}
              onChange={(v) => applyCssChange('zIndex', String(v))}
              step={1}
              setIsScrubbing={setIsScrubbing}
            />
            <input
              type="number"
              value={parseInt(getStyle('zIndex')) || 0}
              onChange={(e) => applyCssChange('zIndex', e.target.value)}
              style={styles.input}
            />
          </div>
        </CollapsibleSection>

        {/* Layout Section */}
        <CollapsibleSection title="Layout">
          <div style={styles.row}>
            <span style={styles.label}>Flow</span>
            <ButtonGroup
              options={[
                { value: 'flex' as DisplayType, icon: <FlexIcon /> },
                { value: 'grid' as DisplayType, icon: <GridIcon /> },
                { value: 'block' as DisplayType, icon: <BlockIcon /> },
                { value: 'inline-block' as DisplayType, icon: <InlineBlockIcon /> },
                { value: 'inline' as DisplayType, icon: <InlineIcon /> },
              ]}
              value={display as DisplayType}
              onChange={(v) => applyCssChange('display', v)}
            />
          </div>

          {/* Dimensions */}
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.label}>Dimensions</span>
          </div>
          <div style={styles.gridRow}>
            <NumberInput
              label="W"
              value={width}
              unit={widthUnit}
              onChange={(v) => applyCssChange('width', `${v}${widthUnit}`)}
              onUnitChange={(u) => applyCssChange('width', `${width}${u}`)}
              setIsScrubbing={setIsScrubbing}
            />
            <NumberInput
              label="H"
              value={height}
              unit={heightUnit}
              onChange={(v) => applyCssChange('height', `${v}${heightUnit}`)}
              onUnitChange={(u) => applyCssChange('height', `${height}${u}`)}
              setIsScrubbing={setIsScrubbing}
            />
          </div>

          {/* Padding */}
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.label}>Padding</span>
            <button
              style={{ ...styles.iconButton, color: linkedPadding ? '#0078d4' : '#9d9d9d' }}
              onClick={() => setLinkedPadding(!linkedPadding)}
              title={linkedPadding ? 'Unlink values' : 'Link values'}
            >
              <LinkIcon />
            </button>
          </div>
          <div style={styles.gridRow}>
            <NumberInput
              label="↑"
              value={paddingTop}
              onChange={(v) => {
                if (linkedPadding) {
                  applyCssChange('padding', `${v}px`);
                } else {
                  applyCssChange('paddingTop', `${v}px`);
                }
              }}
              setIsScrubbing={setIsScrubbing}
            />
            <NumberInput
              label="→"
              value={linkedPadding ? paddingTop : paddingRight}
              onChange={(v) => applyCssChange('paddingRight', `${v}px`)}
              disabled={linkedPadding}
              setIsScrubbing={setIsScrubbing}
            />
          </div>
          <div style={styles.gridRow}>
            <NumberInput
              label="↓"
              value={linkedPadding ? paddingTop : paddingBottom}
              onChange={(v) => applyCssChange('paddingBottom', `${v}px`)}
              disabled={linkedPadding}
              setIsScrubbing={setIsScrubbing}
            />
            <NumberInput
              label="←"
              value={linkedPadding ? paddingTop : paddingLeft}
              onChange={(v) => applyCssChange('paddingLeft', `${v}px`)}
              disabled={linkedPadding}
              setIsScrubbing={setIsScrubbing}
            />
          </div>

          {/* Margin */}
          <div style={{ ...styles.row, marginTop: '12px' }}>
            <span style={styles.label}>Margin</span>
            <button
              style={{ ...styles.iconButton, color: linkedMargin ? '#0078d4' : '#9d9d9d' }}
              onClick={() => setLinkedMargin(!linkedMargin)}
              title={linkedMargin ? 'Unlink values' : 'Link values'}
            >
              <LinkIcon />
            </button>
          </div>
          <div style={styles.gridRow}>
            <NumberInput
              label="↑"
              value={marginTop}
              onChange={(v) => {
                if (linkedMargin) {
                  applyCssChange('margin', `${v}px`);
                } else {
                  applyCssChange('marginTop', `${v}px`);
                }
              }}
              setIsScrubbing={setIsScrubbing}
            />
            <NumberInput
              label="→"
              value={linkedMargin ? marginTop : marginRight}
              onChange={(v) => applyCssChange('marginRight', `${v}px`)}
              disabled={linkedMargin}
              setIsScrubbing={setIsScrubbing}
            />
          </div>
          <div style={styles.gridRow}>
            <NumberInput
              label="↓"
              value={linkedMargin ? marginTop : marginBottom}
              onChange={(v) => applyCssChange('marginBottom', `${v}px`)}
              disabled={linkedMargin}
              setIsScrubbing={setIsScrubbing}
            />
            <NumberInput
              label="←"
              value={linkedMargin ? marginTop : marginLeft}
              onChange={(v) => applyCssChange('marginLeft', `${v}px`)}
              disabled={linkedMargin}
              setIsScrubbing={setIsScrubbing}
            />
          </div>

          {/* Box Sizing */}
          <div style={{ ...styles.row, marginTop: '8px' }}>
            <input
              type="checkbox"
              id="borderBox"
              checked={getStyle('boxSizing') === 'border-box'}
              onChange={(e) => applyCssChange('boxSizing', e.target.checked ? 'border-box' : 'content-box')}
              style={styles.checkbox}
            />
            <label htmlFor="borderBox" style={{ fontSize: '11px', color: '#9d9d9d', cursor: 'pointer' }}>
              Border box
            </label>
          </div>

          {/* Overflow */}
          <div style={{ ...styles.row, marginTop: '8px' }}>
            <input
              type="checkbox"
              id="clipContent"
              checked={getStyle('overflow') === 'hidden'}
              onChange={(e) => applyCssChange('overflow', e.target.checked ? 'hidden' : 'visible')}
              style={styles.checkbox}
            />
            <label htmlFor="clipContent" style={{ fontSize: '11px', color: '#9d9d9d', cursor: 'pointer' }}>
              Clip content
            </label>
          </div>
        </CollapsibleSection>

        {/* Appearance Section */}
        <CollapsibleSection title="Appearance">
          {/* Opacity */}
          <div style={styles.row}>
            <ScrubLabel
              label="Opacity"
              value={opacity}
              onChange={(v) => applyCssChange('opacity', String(v / 100))}
              min={0}
              max={100}
              step={1}
              setIsScrubbing={setIsScrubbing}
            />
            <div style={styles.sliderContainer}>
              <input
                type="range"
                min="0"
                max="100"
                value={opacity}
                onChange={(e) => applyCssChange('opacity', String(parseFloat(e.target.value) / 100))}
                style={styles.slider}
              />
              <input
                type="number"
                value={Math.round(opacity)}
                min={0}
                max={100}
                onChange={(e) => applyCssChange('opacity', String(parseFloat(e.target.value) / 100))}
                style={{ ...styles.smallInput, width: '50px' }}
              />
              <span style={{ color: '#9d9d9d', fontSize: '11px' }}>%</span>
            </div>
          </div>

          {/* Corner Radius */}
          <div style={styles.row}>
            <span style={styles.label}>Corner Radius</span>
            <button
              style={{ ...styles.iconButton, color: linkedRadius ? '#0078d4' : '#9d9d9d' }}
              onClick={() => setLinkedRadius(!linkedRadius)}
              title={linkedRadius ? 'Unlink values' : 'Link values'}
            >
              <LinkIcon />
            </button>
          </div>
          <div style={styles.gridRow}>
            <NumberInput
              label="↖"
              value={borderRadius}
              onChange={(v) => {
                if (linkedRadius) {
                  applyCssChange('borderRadius', `${v}px`);
                } else {
                  applyCssChange('borderTopLeftRadius', `${v}px`);
                }
              }}
              setIsScrubbing={setIsScrubbing}
            />
            <NumberInput
              label="↗"
              value={linkedRadius ? borderRadius : parseNumericValue(getStyle('borderTopRightRadius')).num}
              onChange={(v) => applyCssChange('borderTopRightRadius', `${v}px`)}
              disabled={linkedRadius}
              setIsScrubbing={setIsScrubbing}
            />
          </div>
          <div style={styles.gridRow}>
            <NumberInput
              label="↙"
              value={linkedRadius ? borderRadius : parseNumericValue(getStyle('borderBottomLeftRadius')).num}
              onChange={(v) => applyCssChange('borderBottomLeftRadius', `${v}px`)}
              disabled={linkedRadius}
              setIsScrubbing={setIsScrubbing}
            />
            <NumberInput
              label="↘"
              value={linkedRadius ? borderRadius : parseNumericValue(getStyle('borderBottomRightRadius')).num}
              onChange={(v) => applyCssChange('borderBottomRightRadius', `${v}px`)}
              disabled={linkedRadius}
              setIsScrubbing={setIsScrubbing}
            />
          </div>
        </CollapsibleSection>

        {/* Text Section */}
        {hasTextContent && (
          <CollapsibleSection title="Text">
            {/* Font Family */}
            <div style={styles.row}>
              <span style={styles.label}>Font</span>
              <select
                value={fontFamily}
                onChange={(e) => applyCssChange('fontFamily', e.target.value)}
                style={styles.select}
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
                <option value="Courier New">Courier New</option>
                <option value="system-ui">System UI</option>
                <option value="sans-serif">Sans Serif</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>

            {/* Font Weight & Size */}
            <div style={styles.gridRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ ...styles.label, minWidth: 'auto' }}>Weight</span>
                <select
                  value={fontWeight}
                  onChange={(e) => applyCssChange('fontWeight', e.target.value)}
                  style={{ ...styles.select, flex: 1 }}
                >
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300">300</option>
                  <option value="400">400</option>
                  <option value="500">500</option>
                  <option value="600">600</option>
                  <option value="700">700</option>
                  <option value="800">800</option>
                  <option value="900">900</option>
                </select>
              </div>
              <NumberInput
                label="Size"
                value={fontSize}
                onChange={(v) => applyCssChange('fontSize', `${v}px`)}
                setIsScrubbing={setIsScrubbing}
              />
            </div>

            {/* Color */}
            <div style={styles.row}>
              <span style={styles.label}>Color</span>
              <ColorPicker
                value={color}
                onChange={(c) => applyCssChange('color', c)}
                showOpacity
                opacity={getOpacityFromColor(color)}
                onOpacityChange={(o) => applyCssChange('color', hexToRgba(rgbToHex(color), o / 100))}
              />
            </div>

            {/* Line Height & Letter Spacing */}
            <div style={styles.gridRow}>
              <div>
                <span style={{ ...styles.label, display: 'block', marginBottom: '4px' }}>Line Height</span>
                <input
                  type="text"
                  value={lineHeight}
                  onChange={(e) => applyCssChange('lineHeight', e.target.value)}
                  style={styles.input}
                  placeholder="normal"
                />
              </div>
              <div>
                <span style={{ ...styles.label, display: 'block', marginBottom: '4px' }}>Letter Spacing</span>
                <input
                  type="text"
                  value={letterSpacing}
                  onChange={(e) => applyCssChange('letterSpacing', e.target.value)}
                  style={styles.input}
                  placeholder="normal"
                />
              </div>
            </div>

            {/* Text Alignment */}
            <div style={styles.row}>
              <span style={styles.label}>Alignment</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <ButtonGroup
                options={[
                  { value: 'left' as TextAlign, icon: <AlignLeftIcon /> },
                  { value: 'center' as TextAlign, icon: <AlignCenterIcon /> },
                  { value: 'right' as TextAlign, icon: <AlignRightIcon /> },
                ]}
                value={textAlign}
                onChange={(v) => applyCssChange('textAlign', v)}
              />
              <ButtonGroup
                options={[
                  { value: 'top' as VerticalAlign, icon: <AlignTopIcon /> },
                  { value: 'middle' as VerticalAlign, icon: <AlignMiddleIcon /> },
                  { value: 'bottom' as VerticalAlign, icon: <AlignBottomIcon /> },
                ]}
                value={(getStyle('verticalAlign') || 'top') as VerticalAlign}
                onChange={(v) => applyCssChange('verticalAlign', v)}
              />
            </div>
          </CollapsibleSection>
        )}

        {/* Background Section */}
        <CollapsibleSection title="Background" defaultOpen={false}>
          <div style={styles.row}>
            <span style={styles.label}>Color</span>
            <ColorPicker
              value={backgroundColor}
              onChange={(c) => applyCssChange('backgroundColor', c)}
              showOpacity
              opacity={getOpacityFromColor(backgroundColor)}
              onOpacityChange={(o) => applyCssChange('backgroundColor', hexToRgba(rgbToHex(backgroundColor), o / 100))}
            />
          </div>
        </CollapsibleSection>

        {/* Border Section */}
        <CollapsibleSection title="Border" defaultOpen={false}>
          <div style={styles.row}>
            <NumberInput
              label="Width"
              value={parseNumericValue(getStyle('borderWidth')).num}
              onChange={(v) => applyCssChange('borderWidth', `${v}px`)}
              min={0}
              setIsScrubbing={setIsScrubbing}
            />
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Style</span>
            <select
              value={getStyle('borderStyle') || 'none'}
              onChange={(e) => applyCssChange('borderStyle', e.target.value)}
              style={styles.select}
            >
              <option value="none">None</option>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double</option>
              <option value="groove">Groove</option>
              <option value="ridge">Ridge</option>
              <option value="inset">Inset</option>
              <option value="outset">Outset</option>
            </select>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Color</span>
            <ColorPicker
              value={getStyle('borderColor') || '#000000'}
              onChange={(c) => applyCssChange('borderColor', c)}
            />
          </div>
        </CollapsibleSection>

        {/* Shadow & Blur Section */}
        <CollapsibleSection title="Shadow & Blur" defaultOpen={false}>
          <div style={styles.row}>
            <span style={styles.label}>Box Shadow</span>
            <input
              type="text"
              value={getStyle('boxShadow') || 'none'}
              onChange={(e) => applyCssChange('boxShadow', e.target.value)}
              style={styles.input}
              placeholder="none"
            />
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Blur</span>
            <input
              type="text"
              value={getStyle('filter') || 'none'}
              onChange={(e) => applyCssChange('filter', e.target.value)}
              style={styles.input}
              placeholder="none"
            />
          </div>
        </CollapsibleSection>
      </div>
      )}
    </div>
  );
};
