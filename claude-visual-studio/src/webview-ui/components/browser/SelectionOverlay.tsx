import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useSelectionStore, type ElementInfo } from '../../state/stores';

const HANDLE_SIZE = 8;
const HANDLE_OFFSET = HANDLE_SIZE / 2;

// Colors for better visual feedback
const COLORS = {
  hoverFill: 'rgba(66, 133, 244, 0.15)',
  hoverStroke: 'rgba(66, 133, 244, 0.9)',
  selectedFill: 'rgba(66, 133, 244, 0.1)',
  selectedStroke: 'rgba(66, 133, 244, 1)',
  handleFill: '#ffffff',
  handleStroke: 'rgba(66, 133, 244, 1)',
  dimensionBg: 'rgba(0, 0, 0, 0.85)',
  dimensionText: '#ffffff',
};

const styles = {
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1000,
    // GPU acceleration hints
    willChange: 'contents',
    contain: 'strict',
  } as React.CSSProperties,

  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontFamily: 'var(--vscode-font-family)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 1001,
    // Smooth transform for tooltip positioning
    transform: 'translateZ(0)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  } as React.CSSProperties,
};

interface ResizeHandle {
  x: number;
  y: number;
  position: string;
}

export const SelectionOverlay: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const dprRef = useRef<number>(1);
  const { selectionMode, selectedElement, hoveredElement } = useSelectionStore();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Get element label - memoized for performance
  const getElementLabel = useCallback((element: ElementInfo): string => {
    const parts: string[] = [element.tagName];

    if (element.id) {
      parts.push(`#${element.id}`);
    }

    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(Boolean);
      if (classes.length > 0) {
        parts.push(`.${classes[0]}`);
        if (classes.length > 1) {
          parts.push(`+${classes.length - 1}`);
        }
      }
    }

    return parts.join('');
  }, []);

  // Setup canvas with proper DPI scaling
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    // Get device pixel ratio for HiDPI displays
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Only resize if dimensions changed
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      // Set actual size in memory (scaled for DPI)
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      // Scale context to match DPI
      ctx.scale(dpr, dpr);
    }

    // Reset transform for each frame
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return ctx;
  }, []);

  // Draw overlay using requestAnimationFrame
  useEffect(() => {
    // Cancel any pending frame
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const drawFrame = () => {
      const ctx = setupCanvas();
      if (!ctx) return;

      const canvas = canvasRef.current!;
      const dpr = dprRef.current;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      if (!selectionMode) return;

      // Draw only hovered element (not selected) for hover feedback
      if (hoveredElement && hoveredElement !== selectedElement) {
        drawElementHighlight(ctx, hoveredElement.rect, COLORS.hoverFill, COLORS.hoverStroke, 2);
      }

      // Draw selected element
      if (selectedElement) {
        drawElementHighlight(ctx, selectedElement.rect, COLORS.selectedFill, COLORS.selectedStroke, 2);
        drawResizeHandles(ctx, selectedElement.rect);

        // Update tooltip
        const label = getElementLabel(selectedElement);
        setTooltip({
          x: selectedElement.rect.x,
          y: Math.max(24, selectedElement.rect.y) - 24,
          text: label,
        });
      } else {
        setTooltip(null);
      }
    };

    // Use RAF for smooth rendering
    rafIdRef.current = requestAnimationFrame(drawFrame);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [selectionMode, selectedElement, hoveredElement, getElementLabel, setupCanvas]);

  // Draw element highlight with crisp edges
  const drawElementHighlight = (
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    fillColor: string,
    strokeColor: string,
    lineWidth: number
  ) => {
    // Round coordinates for crisp rendering
    const x = Math.round(rect.x);
    const y = Math.round(rect.y);
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    // Save context state
    ctx.save();

    // Fill with semi-transparent background
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w, h);

    // Stroke with crisp edges
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    // Offset by 0.5 for crisp 1px lines
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Only draw dimensions if element is large enough
    if (w > 60 && h > 30) {
      // Dimensions label
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      const dimensionText = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
      const textMetrics = ctx.measureText(dimensionText);
      const labelWidth = textMetrics.width + 10;
      const labelHeight = 18;
      const labelX = x + w / 2 - labelWidth / 2;
      const labelY = y + h / 2 - labelHeight / 2;

      // Draw rounded background for dimension text
      ctx.fillStyle = COLORS.dimensionBg;
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 3);
      ctx.fill();

      // Draw dimension text centered
      ctx.fillStyle = COLORS.dimensionText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dimensionText, x + w / 2, y + h / 2);
    }

    ctx.restore();
  };

  // Draw resize handles with crisp rendering
  const drawResizeHandles = (
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number }
  ) => {
    // Round coordinates for crisp rendering
    const x = Math.round(rect.x);
    const y = Math.round(rect.y);
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    const handles: ResizeHandle[] = [
      { x: x - HANDLE_OFFSET, y: y - HANDLE_OFFSET, position: 'nw' },
      { x: x + w / 2 - HANDLE_OFFSET, y: y - HANDLE_OFFSET, position: 'n' },
      { x: x + w - HANDLE_OFFSET, y: y - HANDLE_OFFSET, position: 'ne' },
      { x: x - HANDLE_OFFSET, y: y + h / 2 - HANDLE_OFFSET, position: 'w' },
      { x: x + w - HANDLE_OFFSET, y: y + h / 2 - HANDLE_OFFSET, position: 'e' },
      { x: x - HANDLE_OFFSET, y: y + h - HANDLE_OFFSET, position: 'sw' },
      { x: x + w / 2 - HANDLE_OFFSET, y: y + h - HANDLE_OFFSET, position: 's' },
      { x: x + w - HANDLE_OFFSET, y: y + h - HANDLE_OFFSET, position: 'se' },
    ];

    ctx.save();

    handles.forEach((handle) => {
      const hx = Math.round(handle.x);
      const hy = Math.round(handle.y);

      // Draw handle background (white square)
      ctx.fillStyle = COLORS.handleFill;
      ctx.fillRect(hx, hy, HANDLE_SIZE, HANDLE_SIZE);

      // Draw handle border with crisp edges
      ctx.strokeStyle = COLORS.handleStroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(hx + 0.5, hy + 0.5, HANDLE_SIZE - 1, HANDLE_SIZE - 1);
    });

    ctx.restore();
  };

  // Handle window resize with debouncing for performance
  useEffect(() => {
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      // Debounce resize events
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        // Canvas will be re-setup on next draw via setupCanvas
        // Just trigger a redraw
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          setupCanvas();
        });
      }, 16); // ~60fps debounce
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
  }, [setupCanvas]);

  if (!selectionMode) return null;

  return (
    <>
      <canvas ref={canvasRef} style={styles.canvas} />
      {tooltip && (
        <div
          style={{
            ...styles.tooltip,
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
};
