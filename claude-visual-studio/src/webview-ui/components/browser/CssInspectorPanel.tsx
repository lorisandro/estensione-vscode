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

  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
    pointerEvents: 'none' as const,
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

// Box Shadow Types and Parsing
interface BoxShadowValue {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

function parseBoxShadow(value: string): BoxShadowValue[] {
  if (!value || value === 'none') {
    return [{ offsetX: 0, offsetY: 4, blur: 6, spread: 0, color: '#000000', inset: false }];
  }

  const shadows: BoxShadowValue[] = [];
  // Split by comma, but handle rgba() properly
  const shadowStrings = value.split(/,(?![^(]*\))/);

  for (const shadowStr of shadowStrings) {
    const trimmed = shadowStr.trim();
    const isInset = trimmed.includes('inset');
    const withoutInset = trimmed.replace('inset', '').trim();

    // Extract color (rgb, rgba, hex, or named)
    let color = '#000000';
    const rgbaMatch = withoutInset.match(/rgba?\([^)]+\)/);
    const hexMatch = withoutInset.match(/#[0-9a-fA-F]{3,8}/);

    if (rgbaMatch) {
      color = rgbToHex(rgbaMatch[0]);
    } else if (hexMatch) {
      color = hexMatch[0];
    }

    // Extract numeric values (offsetX, offsetY, blur, spread)
    const colorRemoved = withoutInset.replace(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/g, '').trim();
    const nums = colorRemoved.match(/-?\d+(\.\d+)?/g) || [];
    const values = nums.map(n => parseFloat(n));

    shadows.push({
      offsetX: values[0] || 0,
      offsetY: values[1] || 0,
      blur: values[2] || 0,
      spread: values[3] || 0,
      color,
      inset: isInset,
    });
  }

  return shadows.length > 0 ? shadows : [{ offsetX: 0, offsetY: 4, blur: 6, spread: 0, color: '#000000', inset: false }];
}

function buildBoxShadowString(shadows: BoxShadowValue[]): string {
  if (shadows.length === 0) return 'none';

  return shadows.map(s => {
    const parts = [];
    if (s.inset) parts.push('inset');
    parts.push(`${s.offsetX}px`);
    parts.push(`${s.offsetY}px`);
    parts.push(`${s.blur}px`);
    parts.push(`${s.spread}px`);
    parts.push(s.color);
    return parts.join(' ');
  }).join(', ');
}

// Gradient Types and Parsing
type BackgroundMode = 'color' | 'gradient' | 'image';
type GradientType = 'linear' | 'radial';

interface GradientStop {
  color: string;
  position: number;
}

interface GradientValue {
  type: GradientType;
  angle: number;
  stops: GradientStop[];
}

function parseGradient(value: string): GradientValue {
  const defaults: GradientValue = {
    type: 'linear',
    angle: 180,
    stops: [
      { color: '#000000', position: 0 },
      { color: '#ffffff', position: 100 },
    ],
  };

  if (!value || !value.includes('gradient')) {
    return defaults;
  }

  // Detect gradient type
  const isRadial = value.includes('radial-gradient');
  defaults.type = isRadial ? 'radial' : 'linear';

  // Extract angle for linear gradient
  if (!isRadial) {
    const angleMatch = value.match(/linear-gradient\((\d+)deg/);
    if (angleMatch) {
      defaults.angle = parseInt(angleMatch[1]);
    }
  }

  // Extract color stops
  const stopsMatch = value.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*(\d+)?%?/g);
  if (stopsMatch && stopsMatch.length >= 2) {
    defaults.stops = stopsMatch.map((stop, index) => {
      const colorMatch = stop.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/);
      const posMatch = stop.match(/(\d+)%?$/);
      const color = colorMatch ? (colorMatch[0].startsWith('rgb') ? rgbToHex(colorMatch[0]) : colorMatch[0]) : '#000000';
      const position = posMatch ? parseInt(posMatch[1]) : (index === 0 ? 0 : 100);
      return { color, position };
    });
  }

  return defaults;
}

function buildGradientString(gradient: GradientValue): string {
  const sortedStops = [...gradient.stops].sort((a, b) => a.position - b.position);
  const stopsStr = sortedStops.map(s => `${s.color} ${s.position}%`).join(', ');

  if (gradient.type === 'radial') {
    return `radial-gradient(circle, ${stopsStr})`;
  }
  return `linear-gradient(${gradient.angle}deg, ${stopsStr})`;
}

function detectBackgroundMode(bg: string, bgImage: string): BackgroundMode {
  if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
    return 'image';
  }
  if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
    return 'gradient';
  }
  return 'color';
}

// Parse transform CSS value to extract individual transform functions
interface TransformValues {
  rotate: number;
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  skewX: number;
  skewY: number;
}

function parseTransform(transform: string): TransformValues {
  const defaults: TransformValues = {
    rotate: 0,
    scaleX: 1,
    scaleY: 1,
    translateX: 0,
    translateY: 0,
    skewX: 0,
    skewY: 0,
  };

  if (!transform || transform === 'none') {
    return defaults;
  }

  // Parse rotate
  const rotateMatch = transform.match(/rotate\((-?[\d.]+)deg\)/);
  if (rotateMatch) {
    defaults.rotate = parseFloat(rotateMatch[1]);
  }

  // Parse scale
  const scaleMatch = transform.match(/scale\((-?[\d.]+)(?:,\s*(-?[\d.]+))?\)/);
  if (scaleMatch) {
    defaults.scaleX = parseFloat(scaleMatch[1]);
    defaults.scaleY = scaleMatch[2] ? parseFloat(scaleMatch[2]) : defaults.scaleX;
  }

  // Parse scaleX
  const scaleXMatch = transform.match(/scaleX\((-?[\d.]+)\)/);
  if (scaleXMatch) {
    defaults.scaleX = parseFloat(scaleXMatch[1]);
  }

  // Parse scaleY
  const scaleYMatch = transform.match(/scaleY\((-?[\d.]+)\)/);
  if (scaleYMatch) {
    defaults.scaleY = parseFloat(scaleYMatch[1]);
  }

  // Parse translate
  const translateMatch = transform.match(/translate\((-?[\d.]+)px(?:,\s*(-?[\d.]+)px)?\)/);
  if (translateMatch) {
    defaults.translateX = parseFloat(translateMatch[1]);
    defaults.translateY = translateMatch[2] ? parseFloat(translateMatch[2]) : 0;
  }

  // Parse translateX
  const translateXMatch = transform.match(/translateX\((-?[\d.]+)px\)/);
  if (translateXMatch) {
    defaults.translateX = parseFloat(translateXMatch[1]);
  }

  // Parse translateY
  const translateYMatch = transform.match(/translateY\((-?[\d.]+)px\)/);
  if (translateYMatch) {
    defaults.translateY = parseFloat(translateYMatch[1]);
  }

  // Parse skewX
  const skewXMatch = transform.match(/skewX\((-?[\d.]+)deg\)/);
  if (skewXMatch) {
    defaults.skewX = parseFloat(skewXMatch[1]);
  }

  // Parse skewY
  const skewYMatch = transform.match(/skewY\((-?[\d.]+)deg\)/);
  if (skewYMatch) {
    defaults.skewY = parseFloat(skewYMatch[1]);
  }

  // Parse matrix - extract rotation, scale, skew from matrix
  // Matrix format: matrix(a, b, c, d, e, f)
  //
  // Different transforms produce different matrices:
  // - rotate(r): matrix(cos(r), sin(r), -sin(r), cos(r), 0, 0)
  // - scale(sx, sy): matrix(sx, 0, 0, sy, 0, 0)
  // - skewX(x): matrix(1, 0, tan(x), 1, 0, 0)
  // - skewY(y): matrix(1, tan(y), 0, 1, 0, 0)
  //
  // Combined: matrix(a, b, c, d, tx, ty)
  const matrixMatch = transform.match(/matrix\((-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)\)/);
  if (matrixMatch) {
    const a = parseFloat(matrixMatch[1]);
    const b = parseFloat(matrixMatch[2]);
    const c = parseFloat(matrixMatch[3]);
    const d = parseFloat(matrixMatch[4]);
    const tx = parseFloat(matrixMatch[5]);
    const ty = parseFloat(matrixMatch[6]);

    // Extract translation
    defaults.translateX = Math.round(tx);
    defaults.translateY = Math.round(ty);

    // Check for pure skewY: matrix(1, tan(skewY), 0, 1, 0, 0)
    // In this case: a ≈ 1, c ≈ 0, d ≈ 1, and b = tan(skewY)
    const isPureSkewY = Math.abs(a - 1) < 0.01 && Math.abs(c) < 0.01 && Math.abs(d - 1) < 0.01 && Math.abs(b) > 0.001;

    // Check for pure skewX: matrix(1, 0, tan(skewX), 1, 0, 0)
    const isPureSkewX = Math.abs(a - 1) < 0.01 && Math.abs(b) < 0.01 && Math.abs(d - 1) < 0.01 && Math.abs(c) > 0.001;

    if (isPureSkewY) {
      // Pure skewY transform
      defaults.skewY = Math.round(Math.atan(b) * (180 / Math.PI));
      defaults.scaleX = 1;
      defaults.scaleY = 1;
      defaults.rotate = 0;
    } else if (isPureSkewX) {
      // Pure skewX transform
      defaults.skewX = Math.round(Math.atan(c) * (180 / Math.PI));
      defaults.scaleX = 1;
      defaults.scaleY = 1;
      defaults.rotate = 0;
    } else {
      // General case: decompose matrix into scale, rotation, and skew

      // Calculate scale from column vector lengths
      const scaleX = Math.sqrt(a * a + b * b);
      const scaleY = Math.sqrt(c * c + d * d);
      defaults.scaleX = Math.round(scaleX * 100) / 100;
      defaults.scaleY = Math.round(scaleY * 100) / 100;

      // Extract rotation (in degrees) from the first column
      const rotation = Math.atan2(b, a);
      defaults.rotate = Math.round(rotation * (180 / Math.PI));

      // Extract skew values when we have valid scales
      if (scaleX !== 0 && scaleY !== 0) {
        // Normalize the matrix by removing rotation
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);

        // After removing rotation: [a', b'] = [1, 0] rotated by -r
        // c' and d' will reveal the skew
        // skewX comes from the second column after normalization
        const c_normalized = (c * cosR + d * sinR) / scaleY;
        if (Math.abs(c_normalized) > 0.01) {
          defaults.skewX = Math.round(Math.atan(c_normalized) * (180 / Math.PI));
        }

        // skewY: check if there's a skew in the first column
        // This is tricky with rotation, but we can detect it from the determinant
        const det = a * d - b * c;
        if (det > 0 && scaleX > 0.01) {
          // Check for skewY by looking at b after accounting for rotation
          const b_expected = scaleX * sinR;
          const b_diff = b - b_expected;
          if (Math.abs(b_diff) > 0.01) {
            defaults.skewY = Math.round(Math.atan(b_diff / (scaleX * cosR)) * (180 / Math.PI));
          }
        }
      }
    }
  }

  return defaults;
}

// Build transform CSS string from individual values
function buildTransformString(values: TransformValues): string {
  const parts: string[] = [];

  if (values.translateX !== 0 || values.translateY !== 0) {
    parts.push(`translate(${values.translateX}px, ${values.translateY}px)`);
  }

  if (values.rotate !== 0) {
    parts.push(`rotate(${values.rotate}deg)`);
  }

  if (values.scaleX !== 1 || values.scaleY !== 1) {
    if (values.scaleX === values.scaleY) {
      parts.push(`scale(${values.scaleX})`);
    } else {
      parts.push(`scale(${values.scaleX}, ${values.scaleY})`);
    }
  }

  if (values.skewX !== 0) {
    parts.push(`skewX(${values.skewX}deg)`);
  }

  if (values.skewY !== 0) {
    parts.push(`skewY(${values.skewY}deg)`);
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
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

const TransformRotateIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 109-9" />
    <polyline points="21 12 21 3 12 3" />
  </svg>
);

const ScaleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const SkewIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="6 3 18 3 20 21 8 21" />
  </svg>
);

// Flexbox Icons
const FlexRowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="6" width="5" height="12" />
    <rect x="10" y="6" width="5" height="12" />
    <rect x="17" y="6" width="4" height="12" />
  </svg>
);

const FlexRowReverseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="6" width="4" height="12" />
    <rect x="9" y="6" width="5" height="12" />
    <rect x="16" y="6" width="5" height="12" />
    <path d="M12 2l-2 2 2 2" />
  </svg>
);

const FlexColumnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="6" y="3" width="12" height="5" />
    <rect x="6" y="10" width="12" height="5" />
    <rect x="6" y="17" width="12" height="4" />
  </svg>
);

const FlexColumnReverseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="6" y="3" width="12" height="4" />
    <rect x="6" y="9" width="12" height="5" />
    <rect x="6" y="16" width="12" height="5" />
    <path d="M2 12l2-2 2 2" />
  </svg>
);

const JustifyStartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="3" x2="3" y2="21" strokeWidth="3" />
    <rect x="6" y="6" width="4" height="12" />
    <rect x="12" y="6" width="4" height="12" />
  </svg>
);

const JustifyCenterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="6" width="4" height="12" />
    <rect x="11" y="6" width="4" height="12" />
    <line x1="12" y1="2" x2="12" y2="5" strokeWidth="1" strokeDasharray="2" />
    <line x1="12" y1="19" x2="12" y2="22" strokeWidth="1" strokeDasharray="2" />
  </svg>
);

const JustifyEndIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="21" y1="3" x2="21" y2="21" strokeWidth="3" />
    <rect x="8" y="6" width="4" height="12" />
    <rect x="14" y="6" width="4" height="12" />
  </svg>
);

const JustifyBetweenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="6" width="4" height="12" />
    <rect x="17" y="6" width="4" height="12" />
  </svg>
);

const JustifyAroundIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="6" width="4" height="12" />
    <rect x="15" y="6" width="4" height="12" />
  </svg>
);

const JustifyEvenlyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="6" y="6" width="4" height="12" />
    <rect x="14" y="6" width="4" height="12" />
  </svg>
);

const AlignStartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="3" x2="21" y2="3" strokeWidth="3" />
    <rect x="6" y="6" width="4" height="10" />
    <rect x="14" y="6" width="4" height="6" />
  </svg>
);

const AlignCenterFlexIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="6" y="5" width="4" height="14" />
    <rect x="14" y="8" width="4" height="8" />
    <line x1="2" y1="12" x2="5" y2="12" strokeWidth="1" strokeDasharray="2" />
    <line x1="19" y1="12" x2="22" y2="12" strokeWidth="1" strokeDasharray="2" />
  </svg>
);

const AlignEndIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="21" x2="21" y2="21" strokeWidth="3" />
    <rect x="6" y="8" width="4" height="10" />
    <rect x="14" y="12" width="4" height="6" />
  </svg>
);

const AlignStretchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="3" x2="21" y2="3" strokeWidth="2" />
    <line x1="3" y1="21" x2="21" y2="21" strokeWidth="2" />
    <rect x="6" y="5" width="4" height="14" />
    <rect x="14" y="5" width="4" height="14" />
  </svg>
);

const AlignBaselineIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="6" y="4" width="4" height="12" />
    <rect x="14" y="8" width="4" height="8" />
    <line x1="3" y1="16" x2="21" y2="16" strokeWidth="2" strokeDasharray="3" />
  </svg>
);

const WrapNowrapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="8" width="4" height="8" />
    <rect x="7" y="8" width="4" height="8" />
    <rect x="12" y="8" width="4" height="8" />
    <rect x="17" y="8" width="5" height="8" />
  </svg>
);

const WrapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="4" height="6" />
    <rect x="9" y="3" width="4" height="6" />
    <rect x="15" y="3" width="4" height="6" />
    <rect x="3" y="12" width="4" height="6" />
    <rect x="9" y="12" width="4" height="6" />
    <path d="M20 6l2 2-2 2" />
  </svg>
);

const WrapReverseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="12" width="4" height="6" />
    <rect x="9" y="12" width="4" height="6" />
    <rect x="15" y="12" width="4" height="6" />
    <rect x="3" y="3" width="4" height="6" />
    <rect x="9" y="3" width="4" height="6" />
    <path d="M20 15l2-2-2-2" />
  </svg>
);

// Grid Layout Icons
const GridJustifyStartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="3" x2="3" y2="21" strokeWidth="2" />
    <rect x="5" y="5" width="6" height="6" />
    <rect x="5" y="13" width="6" height="6" />
  </svg>
);

const GridJustifyEndIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="21" y1="3" x2="21" y2="21" strokeWidth="2" />
    <rect x="13" y="5" width="6" height="6" />
    <rect x="13" y="13" width="6" height="6" />
  </svg>
);

const GridAlignStartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="3" x2="21" y2="3" strokeWidth="2" />
    <rect x="5" y="5" width="6" height="6" />
    <rect x="13" y="5" width="6" height="6" />
  </svg>
);

const GridAlignEndIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="21" x2="21" y2="21" strokeWidth="2" />
    <rect x="5" y="13" width="6" height="6" />
    <rect x="13" y="13" width="6" height="6" />
  </svg>
);

const GridAutoRowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <path d="M18 14l4 4-4 4" />
  </svg>
);

const GridAutoColumnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <path d="M14 18l4 4 4-4" />
  </svg>
);

const GridDenseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="5" height="5" />
    <rect x="10" y="3" width="5" height="5" />
    <rect x="17" y="3" width="4" height="5" />
    <rect x="3" y="10" width="5" height="5" />
    <rect x="10" y="10" width="5" height="5" />
    <rect x="17" y="10" width="4" height="5" />
    <rect x="3" y="17" width="5" height="4" />
    <rect x="10" y="17" width="5" height="4" />
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
  const [linkedBorder, setLinkedBorder] = useState(true);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('color');
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
    console.log('[CssInspectorPanel] applyCssChange called:', property, value);

    if (!element?.selector) {
      console.warn('[CssInspectorPanel] No element selector available');
      return;
    }

    console.log('[CssInspectorPanel] Element selector:', element.selector);

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
    console.log('[CssInspectorPanel] Found iframe:', !!iframe, iframe?.title);

    if (iframe?.contentWindow) {
      console.log('[CssInspectorPanel] Sending apply-css-style message to iframe');
      iframe.contentWindow.postMessage({
        type: 'apply-css-style',
        payload: {
          selector: element.selector,
          property,
          value,
        },
      }, '*');
      console.log('[CssInspectorPanel] Message sent');
    } else {
      console.warn('[CssInspectorPanel] Could not find iframe contentWindow');
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

          {/* Orientation & Reset */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={{
                ...styles.button,
                flex: 1,
                ...(viewportRotated ? styles.buttonActive : {}),
                ...(viewportWidth === 0 && viewportHeight === 0 ? styles.buttonDisabled : {}),
              }}
              onClick={() => {
                if (viewportWidth === 0 && viewportHeight === 0) {
                  // If in responsive mode, first set a default device and then rotate
                  setViewportPreset('iPhone 14');
                  // Toggle rotation after a small delay to ensure preset is applied
                  setTimeout(() => toggleViewportRotation(), 10);
                } else {
                  toggleViewportRotation();
                }
              }}
              title={viewportWidth === 0 && viewportHeight === 0 ? "Select a device preset first" : "Switch between Portrait and Landscape orientation"}
            >
              <RotateIcon />
              <span style={{ marginLeft: '4px' }}>{viewportRotated ? 'Landscape' : 'Portrait'}</span>
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

        {/* Flexbox Section - Only shown when display is flex */}
        {display === 'flex' && (
          <CollapsibleSection title="Flexbox">
            {/* Flex Direction */}
            <div style={styles.row}>
              <span style={styles.label}>Direction</span>
              <ButtonGroup
                options={[
                  { value: 'row' as FlexDirection, icon: <FlexRowIcon />, label: 'Row' },
                  { value: 'row-reverse' as FlexDirection, icon: <FlexRowReverseIcon />, label: 'Row Reverse' },
                  { value: 'column' as FlexDirection, icon: <FlexColumnIcon />, label: 'Column' },
                  { value: 'column-reverse' as FlexDirection, icon: <FlexColumnReverseIcon />, label: 'Column Reverse' },
                ]}
                value={(getStyle('flexDirection') || 'row') as FlexDirection}
                onChange={(v) => applyCssChange('flexDirection', v)}
              />
            </div>

            {/* Justify Content */}
            <div style={{ ...styles.row, marginTop: '8px' }}>
              <span style={styles.label}>Justify</span>
            </div>
            <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
              {[
                { value: 'flex-start', icon: <JustifyStartIcon />, label: 'Start' },
                { value: 'center', icon: <JustifyCenterIcon />, label: 'Center' },
                { value: 'flex-end', icon: <JustifyEndIcon />, label: 'End' },
                { value: 'space-between', icon: <JustifyBetweenIcon />, label: 'Between' },
                { value: 'space-around', icon: <JustifyAroundIcon />, label: 'Around' },
                { value: 'space-evenly', icon: <JustifyEvenlyIcon />, label: 'Evenly' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  style={{
                    ...styles.button,
                    flex: 1,
                    padding: '4px',
                    ...((getStyle('justifyContent') || 'flex-start') === opt.value ? styles.buttonActive : {}),
                  }}
                  onClick={() => applyCssChange('justifyContent', opt.value)}
                  title={opt.label}
                >
                  {opt.icon}
                </button>
              ))}
            </div>

            {/* Align Items */}
            <div style={{ ...styles.row, marginTop: '4px' }}>
              <span style={styles.label}>Align Items</span>
            </div>
            <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
              {[
                { value: 'flex-start', icon: <AlignStartIcon />, label: 'Start' },
                { value: 'center', icon: <AlignCenterFlexIcon />, label: 'Center' },
                { value: 'flex-end', icon: <AlignEndIcon />, label: 'End' },
                { value: 'stretch', icon: <AlignStretchIcon />, label: 'Stretch' },
                { value: 'baseline', icon: <AlignBaselineIcon />, label: 'Baseline' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  style={{
                    ...styles.button,
                    flex: 1,
                    padding: '4px',
                    ...((getStyle('alignItems') || 'stretch') === opt.value ? styles.buttonActive : {}),
                  }}
                  onClick={() => applyCssChange('alignItems', opt.value)}
                  title={opt.label}
                >
                  {opt.icon}
                </button>
              ))}
            </div>

            {/* Flex Wrap */}
            <div style={{ ...styles.row, marginTop: '4px' }}>
              <span style={styles.label}>Wrap</span>
              <ButtonGroup
                options={[
                  { value: 'nowrap', icon: <WrapNowrapIcon />, label: 'No Wrap' },
                  { value: 'wrap', icon: <WrapIcon />, label: 'Wrap' },
                  { value: 'wrap-reverse', icon: <WrapReverseIcon />, label: 'Wrap Reverse' },
                ]}
                value={(getStyle('flexWrap') || 'nowrap') as 'nowrap' | 'wrap' | 'wrap-reverse'}
                onChange={(v) => applyCssChange('flexWrap', v)}
              />
            </div>

            {/* Gap */}
            <div style={{ ...styles.row, marginTop: '12px' }}>
              <span style={styles.label}>Gap</span>
            </div>
            <div style={styles.gridRow}>
              <NumberInput
                label="Row"
                value={parseNumericValue(getStyle('rowGap')).num}
                onChange={(v) => applyCssChange('rowGap', `${v}px`)}
                min={0}
                setIsScrubbing={setIsScrubbing}
              />
              <NumberInput
                label="Col"
                value={parseNumericValue(getStyle('columnGap')).num}
                onChange={(v) => applyCssChange('columnGap', `${v}px`)}
                min={0}
                setIsScrubbing={setIsScrubbing}
              />
            </div>
          </CollapsibleSection>
        )}

        {/* Grid Section - Only shown when display is grid */}
        {display === 'grid' && (
          <CollapsibleSection title="Grid">
            {/* Grid Template Columns */}
            <div style={styles.row}>
              <span style={styles.label}>Columns</span>
              <input
                type="text"
                value={getStyle('gridTemplateColumns') || 'none'}
                onChange={(e) => applyCssChange('gridTemplateColumns', e.target.value)}
                style={styles.input}
                placeholder="1fr 1fr 1fr"
              />
            </div>

            {/* Grid Template Rows */}
            <div style={styles.row}>
              <span style={styles.label}>Rows</span>
              <input
                type="text"
                value={getStyle('gridTemplateRows') || 'none'}
                onChange={(e) => applyCssChange('gridTemplateRows', e.target.value)}
                style={styles.input}
                placeholder="auto auto"
              />
            </div>

            {/* Grid Gap */}
            <div style={{ ...styles.row, marginTop: '8px' }}>
              <span style={styles.label}>Gap</span>
            </div>
            <div style={styles.gridRow}>
              <NumberInput
                label="Row"
                value={parseNumericValue(getStyle('rowGap')).num}
                onChange={(v) => applyCssChange('rowGap', `${v}px`)}
                min={0}
                setIsScrubbing={setIsScrubbing}
              />
              <NumberInput
                label="Col"
                value={parseNumericValue(getStyle('columnGap')).num}
                onChange={(v) => applyCssChange('columnGap', `${v}px`)}
                min={0}
                setIsScrubbing={setIsScrubbing}
              />
            </div>

            {/* Justify Items */}
            <div style={{ ...styles.row, marginTop: '8px' }}>
              <span style={styles.label}>Justify</span>
            </div>
            <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
              {[
                { value: 'start', icon: <GridJustifyStartIcon />, label: 'Start' },
                { value: 'center', icon: <JustifyCenterIcon />, label: 'Center' },
                { value: 'end', icon: <GridJustifyEndIcon />, label: 'End' },
                { value: 'stretch', icon: <AlignStretchIcon />, label: 'Stretch' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  style={{
                    ...styles.button,
                    flex: 1,
                    padding: '4px',
                    ...((getStyle('justifyItems') || 'stretch') === opt.value ? styles.buttonActive : {}),
                  }}
                  onClick={() => applyCssChange('justifyItems', opt.value)}
                  title={opt.label}
                >
                  {opt.icon}
                </button>
              ))}
            </div>

            {/* Align Items */}
            <div style={{ ...styles.row, marginTop: '4px' }}>
              <span style={styles.label}>Align</span>
            </div>
            <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
              {[
                { value: 'start', icon: <GridAlignStartIcon />, label: 'Start' },
                { value: 'center', icon: <AlignCenterFlexIcon />, label: 'Center' },
                { value: 'end', icon: <GridAlignEndIcon />, label: 'End' },
                { value: 'stretch', icon: <AlignStretchIcon />, label: 'Stretch' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  style={{
                    ...styles.button,
                    flex: 1,
                    padding: '4px',
                    ...((getStyle('alignItems') || 'stretch') === opt.value ? styles.buttonActive : {}),
                  }}
                  onClick={() => applyCssChange('alignItems', opt.value)}
                  title={opt.label}
                >
                  {opt.icon}
                </button>
              ))}
            </div>

            {/* Grid Auto Flow */}
            <div style={{ ...styles.row, marginTop: '4px' }}>
              <span style={styles.label}>Auto Flow</span>
              <ButtonGroup
                options={[
                  { value: 'row', icon: <GridAutoRowIcon />, label: 'Row' },
                  { value: 'column', icon: <GridAutoColumnIcon />, label: 'Column' },
                  { value: 'dense', icon: <GridDenseIcon />, label: 'Dense' },
                ]}
                value={(getStyle('gridAutoFlow') || 'row') as 'row' | 'column' | 'dense'}
                onChange={(v) => applyCssChange('gridAutoFlow', v)}
              />
            </div>
          </CollapsibleSection>
        )}

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

        {/* Transform Section */}
        <CollapsibleSection title="Transform" defaultOpen={false}>
          {(() => {
            const transformValue = getStyle('transform');
            const transform = parseTransform(transformValue);

            const updateTransform = (key: keyof TransformValues, value: number) => {
              const newTransform = { ...transform, [key]: value };
              applyCssChange('transform', buildTransformString(newTransform));
            };

            return (
              <>
                {/* Rotate */}
                <div style={styles.row}>
                  <ScrubLabel
                    label="Rotate"
                    value={transform.rotate}
                    onChange={(v) => updateTransform('rotate', v)}
                    min={-360}
                    max={360}
                    step={1}
                    setIsScrubbing={setIsScrubbing}
                  />
                  <div style={styles.sliderContainer}>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={transform.rotate}
                      onChange={(e) => updateTransform('rotate', parseFloat(e.target.value))}
                      style={styles.slider}
                    />
                    <input
                      type="number"
                      value={Math.round(transform.rotate)}
                      min={-360}
                      max={360}
                      onChange={(e) => updateTransform('rotate', parseFloat(e.target.value) || 0)}
                      style={{ ...styles.smallInput, width: '55px' }}
                    />
                    <span style={{ color: '#9d9d9d', fontSize: '11px' }}>°</span>
                  </div>
                </div>

                {/* Scale */}
                <div style={{ ...styles.row, marginTop: '8px' }}>
                  <span style={styles.label}>Scale</span>
                </div>
                <div style={styles.gridRow}>
                  <NumberInput
                    label="X"
                    value={transform.scaleX}
                    step={0.1}
                    min={0}
                    max={10}
                    onChange={(v) => updateTransform('scaleX', v)}
                    showUnit={false}
                    setIsScrubbing={setIsScrubbing}
                    scrubSensitivity={10}
                  />
                  <NumberInput
                    label="Y"
                    value={transform.scaleY}
                    step={0.1}
                    min={0}
                    max={10}
                    onChange={(v) => updateTransform('scaleY', v)}
                    showUnit={false}
                    setIsScrubbing={setIsScrubbing}
                    scrubSensitivity={10}
                  />
                </div>

                {/* Translate */}
                <div style={{ ...styles.row, marginTop: '8px' }}>
                  <span style={styles.label}>Translate</span>
                </div>
                <div style={styles.gridRow}>
                  <NumberInput
                    label="X"
                    value={transform.translateX}
                    onChange={(v) => updateTransform('translateX', v)}
                    showUnit={false}
                    setIsScrubbing={setIsScrubbing}
                  />
                  <NumberInput
                    label="Y"
                    value={transform.translateY}
                    onChange={(v) => updateTransform('translateY', v)}
                    showUnit={false}
                    setIsScrubbing={setIsScrubbing}
                  />
                </div>

                {/* Skew */}
                <div style={{ ...styles.row, marginTop: '8px' }}>
                  <span style={styles.label}>Skew</span>
                </div>
                <div style={styles.gridRow}>
                  <NumberInput
                    label="X"
                    value={transform.skewX}
                    onChange={(v) => updateTransform('skewX', v)}
                    showUnit={false}
                    setIsScrubbing={setIsScrubbing}
                  />
                  <NumberInput
                    label="Y"
                    value={transform.skewY}
                    onChange={(v) => updateTransform('skewY', v)}
                    showUnit={false}
                    setIsScrubbing={setIsScrubbing}
                  />
                </div>

                {/* Reset Transform */}
                <div style={{ marginTop: '12px' }}>
                  <button
                    style={{ ...styles.button, width: '100%' }}
                    onClick={() => applyCssChange('transform', 'none')}
                    title="Reset all transform values"
                  >
                    Reset Transform
                  </button>
                </div>
              </>
            );
          })()}
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

        {/* Background Section - Advanced */}
        <CollapsibleSection title="Background" defaultOpen={false}>
          {(() => {
            const bgImage = getStyle('backgroundImage') || 'none';
            const detectedMode = detectBackgroundMode(backgroundColor, bgImage);
            const currentMode = backgroundMode;
            const gradient = parseGradient(bgImage);

            return (
              <>
                {/* Mode Selector */}
                <div style={{ ...styles.row, marginBottom: '12px' }}>
                  <span style={styles.label}>Type</span>
                  <div style={styles.buttonGroup}>
                    <button
                      style={{
                        ...styles.button,
                        ...(currentMode === 'color' ? styles.buttonActive : {}),
                      }}
                      onClick={() => {
                        setBackgroundMode('color');
                        applyCssChange('backgroundImage', 'none');
                      }}
                    >
                      Color
                    </button>
                    <button
                      style={{
                        ...styles.button,
                        ...(currentMode === 'gradient' ? styles.buttonActive : {}),
                      }}
                      onClick={() => {
                        setBackgroundMode('gradient');
                        applyCssChange('backgroundImage', 'linear-gradient(180deg, #000000 0%, #ffffff 100%)');
                      }}
                    >
                      Gradient
                    </button>
                    <button
                      style={{
                        ...styles.button,
                        ...(currentMode === 'image' ? styles.buttonActive : {}),
                      }}
                      onClick={() => {
                        setBackgroundMode('image');
                      }}
                    >
                      Image
                    </button>
                  </div>
                </div>

                {/* Color Mode */}
                {currentMode === 'color' && (
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
                )}

                {/* Gradient Mode */}
                {currentMode === 'gradient' && (
                  <>
                    {/* Gradient Type */}
                    <div style={styles.row}>
                      <span style={styles.label}>Style</span>
                      <div style={styles.buttonGroup}>
                        <button
                          style={{
                            ...styles.button,
                            ...(gradient.type === 'linear' ? styles.buttonActive : {}),
                          }}
                          onClick={() => {
                            const newGradient = { ...gradient, type: 'linear' as GradientType };
                            applyCssChange('backgroundImage', buildGradientString(newGradient));
                          }}
                        >
                          Linear
                        </button>
                        <button
                          style={{
                            ...styles.button,
                            ...(gradient.type === 'radial' ? styles.buttonActive : {}),
                          }}
                          onClick={() => {
                            const newGradient = { ...gradient, type: 'radial' as GradientType };
                            applyCssChange('backgroundImage', buildGradientString(newGradient));
                          }}
                        >
                          Radial
                        </button>
                      </div>
                    </div>

                    {/* Angle (Linear only) */}
                    {gradient.type === 'linear' && (
                      <div style={styles.row}>
                        <ScrubLabel
                          label="Angle"
                          value={gradient.angle}
                          onChange={(v) => {
                            const newGradient = { ...gradient, angle: v };
                            applyCssChange('backgroundImage', buildGradientString(newGradient));
                          }}
                          min={0}
                          max={360}
                          step={1}
                          setIsScrubbing={setIsScrubbing}
                        />
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={gradient.angle}
                          onChange={(e) => {
                            const newGradient = { ...gradient, angle: parseInt(e.target.value) };
                            applyCssChange('backgroundImage', buildGradientString(newGradient));
                          }}
                          style={{ ...styles.slider, flex: 1 }}
                        />
                        <input
                          type="number"
                          value={gradient.angle}
                          min={0}
                          max={360}
                          onChange={(e) => {
                            const newGradient = { ...gradient, angle: parseInt(e.target.value) || 0 };
                            applyCssChange('backgroundImage', buildGradientString(newGradient));
                          }}
                          style={{ ...styles.smallInput, width: '50px' }}
                        />
                        <span style={{ color: '#9d9d9d', fontSize: '11px' }}>°</span>
                      </div>
                    )}

                    {/* Color Stops */}
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ ...styles.label, display: 'block', marginBottom: '8px' }}>Color Stops</span>
                      {gradient.stops.map((stop, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '6px',
                            padding: '6px',
                            backgroundColor: '#252526',
                            borderRadius: '4px',
                          }}
                        >
                          <input
                            type="color"
                            value={stop.color}
                            onChange={(e) => {
                              const newStops = [...gradient.stops];
                              newStops[index] = { ...newStops[index], color: e.target.value };
                              applyCssChange('backgroundImage', buildGradientString({ ...gradient, stops: newStops }));
                            }}
                            style={{ ...styles.colorInput, width: '28px', height: '24px' }}
                          />
                          <input
                            type="text"
                            value={stop.color}
                            onChange={(e) => {
                              const newStops = [...gradient.stops];
                              newStops[index] = { ...newStops[index], color: e.target.value };
                              applyCssChange('backgroundImage', buildGradientString({ ...gradient, stops: newStops }));
                            }}
                            style={{ ...styles.input, flex: 1, fontSize: '10px' }}
                          />
                          <input
                            type="number"
                            value={stop.position}
                            min={0}
                            max={100}
                            onChange={(e) => {
                              const newStops = [...gradient.stops];
                              newStops[index] = { ...newStops[index], position: parseInt(e.target.value) || 0 };
                              applyCssChange('backgroundImage', buildGradientString({ ...gradient, stops: newStops }));
                            }}
                            style={{ ...styles.smallInput, width: '40px' }}
                          />
                          <span style={{ color: '#9d9d9d', fontSize: '10px' }}>%</span>
                          {gradient.stops.length > 2 && (
                            <button
                              style={{ ...styles.iconButton, color: '#ff6b6b', padding: '2px' }}
                              onClick={() => {
                                const newStops = gradient.stops.filter((_, i) => i !== index);
                                applyCssChange('backgroundImage', buildGradientString({ ...gradient, stops: newStops }));
                              }}
                              title="Remove stop"
                            >
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M7.116 8l-4.558 4.558.884.884L8 8.884l4.558 4.558.884-.884L8.884 8l4.558-4.558-.884-.884L8 7.116 3.442 2.558l-.884.884L7.116 8z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        style={{ ...styles.button, width: '100%', marginTop: '4px', backgroundColor: '#2d2d2d' }}
                        onClick={() => {
                          const newStops = [...gradient.stops, { color: '#888888', position: 50 }];
                          applyCssChange('backgroundImage', buildGradientString({ ...gradient, stops: newStops }));
                        }}
                      >
                        + Add Stop
                      </button>
                    </div>

                    {/* Gradient Preview */}
                    <div style={{ marginTop: '12px' }}>
                      <span style={{ fontSize: '10px', color: '#9d9d9d', display: 'block', marginBottom: '6px' }}>Preview</span>
                      <div style={{
                        height: '40px',
                        borderRadius: '4px',
                        backgroundImage: buildGradientString(gradient),
                        border: '1px solid #3c3c3c',
                      }} />
                    </div>
                  </>
                )}

                {/* Image Mode */}
                {currentMode === 'image' && (
                  <>
                    {/* Image URL */}
                    <div style={styles.row}>
                      <span style={styles.label}>URL</span>
                      <input
                        type="text"
                        value={(() => {
                          const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
                          return match ? match[1] : '';
                        })()}
                        onChange={(e) => {
                          if (e.target.value) {
                            applyCssChange('backgroundImage', `url("${e.target.value}")`);
                          } else {
                            applyCssChange('backgroundImage', 'none');
                          }
                        }}
                        style={styles.input}
                        placeholder="https://..."
                      />
                    </div>

                    {/* Background Size */}
                    <div style={styles.row}>
                      <span style={styles.label}>Size</span>
                      <div style={styles.buttonGroup}>
                        {['cover', 'contain', 'auto'].map((size) => (
                          <button
                            key={size}
                            style={{
                              ...styles.button,
                              ...((getStyle('backgroundSize') || 'auto') === size ? styles.buttonActive : {}),
                            }}
                            onClick={() => applyCssChange('backgroundSize', size)}
                          >
                            {size.charAt(0).toUpperCase() + size.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Background Position */}
                    <div style={{ ...styles.row, marginTop: '8px' }}>
                      <span style={styles.label}>Position</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', marginBottom: '8px' }}>
                      {[
                        'left top', 'center top', 'right top',
                        'left center', 'center center', 'right center',
                        'left bottom', 'center bottom', 'right bottom',
                      ].map((pos) => (
                        <button
                          key={pos}
                          style={{
                            ...styles.button,
                            padding: '6px',
                            fontSize: '8px',
                            ...((getStyle('backgroundPosition') || 'center center') === pos ? styles.buttonActive : {}),
                          }}
                          onClick={() => applyCssChange('backgroundPosition', pos)}
                          title={pos}
                        >
                          <div style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: 'currentColor',
                            borderRadius: '50%',
                          }} />
                        </button>
                      ))}
                    </div>

                    {/* Background Repeat */}
                    <div style={styles.row}>
                      <span style={styles.label}>Repeat</span>
                      <select
                        value={getStyle('backgroundRepeat') || 'repeat'}
                        onChange={(e) => applyCssChange('backgroundRepeat', e.target.value)}
                        style={styles.select}
                      >
                        <option value="no-repeat">No Repeat</option>
                        <option value="repeat">Repeat</option>
                        <option value="repeat-x">Repeat X</option>
                        <option value="repeat-y">Repeat Y</option>
                      </select>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </CollapsibleSection>

        {/* Border Section */}
        <CollapsibleSection title="Border" defaultOpen={false}>
          {/* Link Toggle */}
          <div style={{ ...styles.row, marginBottom: '12px' }}>
            <span style={styles.label}>Mode</span>
            <button
              style={{ ...styles.iconButton, color: linkedBorder ? '#0078d4' : '#9d9d9d' }}
              onClick={() => setLinkedBorder(!linkedBorder)}
              title={linkedBorder ? 'Click to edit individual borders' : 'Click to link all borders'}
            >
              <LinkIcon />
            </button>
            <span style={{ fontSize: '10px', color: '#9d9d9d', marginLeft: '4px' }}>
              {linkedBorder ? 'All sides' : 'Individual'}
            </span>
          </div>

          {linkedBorder ? (
            /* All Borders - Linked Mode */
            <>
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
            </>
          ) : (
            /* Individual Borders Mode */
            <>
              {/* Border Top */}
              <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#252526', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', color: '#9d9d9d', marginBottom: '6px', textTransform: 'uppercase' }}>Top</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={parseNumericValue(getStyle('borderTopWidth')).num}
                    onChange={(e) => applyCssChange('borderTopWidth', `${e.target.value}px`)}
                    style={{ ...styles.smallInput, width: '45px' }}
                    min={0}
                    placeholder="0"
                  />
                  <select
                    value={getStyle('borderTopStyle') || 'none'}
                    onChange={(e) => applyCssChange('borderTopStyle', e.target.value)}
                    style={{ ...styles.select, flex: 1, fontSize: '10px' }}
                  >
                    <option value="none">None</option>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="double">Double</option>
                  </select>
                  <input
                    type="color"
                    value={rgbToHex(getStyle('borderTopColor') || '#000000')}
                    onChange={(e) => applyCssChange('borderTopColor', e.target.value)}
                    style={{ ...styles.colorInput, width: '28px', height: '24px' }}
                  />
                </div>
              </div>

              {/* Border Right */}
              <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#252526', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', color: '#9d9d9d', marginBottom: '6px', textTransform: 'uppercase' }}>Right</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={parseNumericValue(getStyle('borderRightWidth')).num}
                    onChange={(e) => applyCssChange('borderRightWidth', `${e.target.value}px`)}
                    style={{ ...styles.smallInput, width: '45px' }}
                    min={0}
                    placeholder="0"
                  />
                  <select
                    value={getStyle('borderRightStyle') || 'none'}
                    onChange={(e) => applyCssChange('borderRightStyle', e.target.value)}
                    style={{ ...styles.select, flex: 1, fontSize: '10px' }}
                  >
                    <option value="none">None</option>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="double">Double</option>
                  </select>
                  <input
                    type="color"
                    value={rgbToHex(getStyle('borderRightColor') || '#000000')}
                    onChange={(e) => applyCssChange('borderRightColor', e.target.value)}
                    style={{ ...styles.colorInput, width: '28px', height: '24px' }}
                  />
                </div>
              </div>

              {/* Border Bottom */}
              <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#252526', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', color: '#9d9d9d', marginBottom: '6px', textTransform: 'uppercase' }}>Bottom</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={parseNumericValue(getStyle('borderBottomWidth')).num}
                    onChange={(e) => applyCssChange('borderBottomWidth', `${e.target.value}px`)}
                    style={{ ...styles.smallInput, width: '45px' }}
                    min={0}
                    placeholder="0"
                  />
                  <select
                    value={getStyle('borderBottomStyle') || 'none'}
                    onChange={(e) => applyCssChange('borderBottomStyle', e.target.value)}
                    style={{ ...styles.select, flex: 1, fontSize: '10px' }}
                  >
                    <option value="none">None</option>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="double">Double</option>
                  </select>
                  <input
                    type="color"
                    value={rgbToHex(getStyle('borderBottomColor') || '#000000')}
                    onChange={(e) => applyCssChange('borderBottomColor', e.target.value)}
                    style={{ ...styles.colorInput, width: '28px', height: '24px' }}
                  />
                </div>
              </div>

              {/* Border Left */}
              <div style={{ padding: '8px', backgroundColor: '#252526', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', color: '#9d9d9d', marginBottom: '6px', textTransform: 'uppercase' }}>Left</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={parseNumericValue(getStyle('borderLeftWidth')).num}
                    onChange={(e) => applyCssChange('borderLeftWidth', `${e.target.value}px`)}
                    style={{ ...styles.smallInput, width: '45px' }}
                    min={0}
                    placeholder="0"
                  />
                  <select
                    value={getStyle('borderLeftStyle') || 'none'}
                    onChange={(e) => applyCssChange('borderLeftStyle', e.target.value)}
                    style={{ ...styles.select, flex: 1, fontSize: '10px' }}
                  >
                    <option value="none">None</option>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="double">Double</option>
                  </select>
                  <input
                    type="color"
                    value={rgbToHex(getStyle('borderLeftColor') || '#000000')}
                    onChange={(e) => applyCssChange('borderLeftColor', e.target.value)}
                    style={{ ...styles.colorInput, width: '28px', height: '24px' }}
                  />
                </div>
              </div>
            </>
          )}
        </CollapsibleSection>

        {/* Shadow Section - Visual Editor */}
        <CollapsibleSection title="Shadow" defaultOpen={false}>
          {(() => {
            const boxShadowValue = getStyle('boxShadow');
            const shadows = parseBoxShadow(boxShadowValue);
            const hasShadow = boxShadowValue && boxShadowValue !== 'none';

            const updateShadow = (index: number, key: keyof BoxShadowValue, value: number | string | boolean) => {
              const newShadows = [...shadows];
              newShadows[index] = { ...newShadows[index], [key]: value };
              applyCssChange('boxShadow', buildBoxShadowString(newShadows));
            };

            const addShadow = () => {
              const newShadows = [...shadows, { offsetX: 0, offsetY: 4, blur: 6, spread: 0, color: '#000000', inset: false }];
              applyCssChange('boxShadow', buildBoxShadowString(newShadows));
            };

            const removeShadow = (index: number) => {
              if (shadows.length === 1) {
                applyCssChange('boxShadow', 'none');
              } else {
                const newShadows = shadows.filter((_, i) => i !== index);
                applyCssChange('boxShadow', buildBoxShadowString(newShadows));
              }
            };

            return (
              <>
                {/* Enable/Disable Shadow Toggle */}
                <div style={{ ...styles.row, marginBottom: '12px' }}>
                  <input
                    type="checkbox"
                    id="enableShadow"
                    checked={hasShadow}
                    onChange={(e) => {
                      if (e.target.checked) {
                        applyCssChange('boxShadow', '0px 4px 6px 0px #000000');
                      } else {
                        applyCssChange('boxShadow', 'none');
                      }
                    }}
                    style={styles.checkbox}
                  />
                  <label htmlFor="enableShadow" style={{ fontSize: '11px', color: '#9d9d9d', cursor: 'pointer' }}>
                    Enable box shadow
                  </label>
                </div>

                {hasShadow && shadows.map((shadow, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '10px',
                      backgroundColor: '#252526',
                      borderRadius: '4px',
                      marginBottom: '10px',
                      border: '1px solid #3c3c3c',
                    }}
                  >
                    {/* Shadow Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#9d9d9d', textTransform: 'uppercase' }}>
                        Shadow {shadows.length > 1 ? index + 1 : ''}
                      </span>
                      <button
                        style={{
                          ...styles.iconButton,
                          color: '#ff6b6b',
                          padding: '2px',
                        }}
                        onClick={() => removeShadow(index)}
                        title="Remove shadow"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M7.116 8l-4.558 4.558.884.884L8 8.884l4.558 4.558.884-.884L8.884 8l4.558-4.558-.884-.884L8 7.116 3.442 2.558l-.884.884L7.116 8z" />
                        </svg>
                      </button>
                    </div>

                    {/* Offset X/Y */}
                    <div style={styles.gridRow}>
                      <NumberInput
                        label="X"
                        value={shadow.offsetX}
                        onChange={(v) => updateShadow(index, 'offsetX', v)}
                        setIsScrubbing={setIsScrubbing}
                      />
                      <NumberInput
                        label="Y"
                        value={shadow.offsetY}
                        onChange={(v) => updateShadow(index, 'offsetY', v)}
                        setIsScrubbing={setIsScrubbing}
                      />
                    </div>

                    {/* Blur & Spread */}
                    <div style={styles.gridRow}>
                      <NumberInput
                        label="Blur"
                        value={shadow.blur}
                        onChange={(v) => updateShadow(index, 'blur', v)}
                        min={0}
                        setIsScrubbing={setIsScrubbing}
                      />
                      <NumberInput
                        label="Spread"
                        value={shadow.spread}
                        onChange={(v) => updateShadow(index, 'spread', v)}
                        setIsScrubbing={setIsScrubbing}
                      />
                    </div>

                    {/* Color */}
                    <div style={{ ...styles.row, marginBottom: '8px' }}>
                      <span style={styles.label}>Color</span>
                      <input
                        type="color"
                        value={shadow.color}
                        onChange={(e) => updateShadow(index, 'color', e.target.value)}
                        style={styles.colorInput}
                      />
                      <input
                        type="text"
                        value={shadow.color}
                        onChange={(e) => updateShadow(index, 'color', e.target.value)}
                        style={{ ...styles.input, flex: 1 }}
                      />
                    </div>

                    {/* Inset Toggle */}
                    <div style={styles.row}>
                      <input
                        type="checkbox"
                        id={`inset-${index}`}
                        checked={shadow.inset}
                        onChange={(e) => updateShadow(index, 'inset', e.target.checked)}
                        style={styles.checkbox}
                      />
                      <label htmlFor={`inset-${index}`} style={{ fontSize: '11px', color: '#9d9d9d', cursor: 'pointer' }}>
                        Inset (inner shadow)
                      </label>
                    </div>
                  </div>
                ))}

                {/* Add Shadow Button */}
                {hasShadow && (
                  <button
                    style={{
                      ...styles.button,
                      width: '100%',
                      marginTop: '4px',
                      backgroundColor: '#2d2d2d',
                    }}
                    onClick={addShadow}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '4px' }}>
                      <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    Add Shadow
                  </button>
                )}

                {/* Preview Box */}
                {hasShadow && (
                  <div style={{ marginTop: '12px' }}>
                    <span style={{ fontSize: '10px', color: '#9d9d9d', display: 'block', marginBottom: '6px' }}>Preview</span>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '20px',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '4px',
                    }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        backgroundColor: '#3c3c3c',
                        borderRadius: '4px',
                        boxShadow: buildBoxShadowString(shadows),
                      }} />
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </CollapsibleSection>

        {/* Filter Section */}
        <CollapsibleSection title="Filter" defaultOpen={false}>
          <div style={styles.row}>
            <span style={styles.label}>Blur</span>
            <NumberInput
              label=""
              value={(() => {
                const filter = getStyle('filter') || '';
                const match = filter.match(/blur\((\d+)px\)/);
                return match ? parseInt(match[1]) : 0;
              })()}
              onChange={(v) => {
                const currentFilter = getStyle('filter') || '';
                const hasBlur = currentFilter.includes('blur(');
                if (v === 0) {
                  const newFilter = currentFilter.replace(/blur\([^)]+\)\s*/g, '').trim();
                  applyCssChange('filter', newFilter || 'none');
                } else if (hasBlur) {
                  applyCssChange('filter', currentFilter.replace(/blur\([^)]+\)/, `blur(${v}px)`));
                } else {
                  applyCssChange('filter', currentFilter === 'none' ? `blur(${v}px)` : `${currentFilter} blur(${v}px)`);
                }
              }}
              min={0}
              max={50}
              setIsScrubbing={setIsScrubbing}
            />
            <span style={{ color: '#9d9d9d', fontSize: '11px' }}>px</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Raw</span>
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
