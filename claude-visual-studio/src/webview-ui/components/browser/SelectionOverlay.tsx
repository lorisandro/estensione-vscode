import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSelectionStore, type ElementInfo } from '../../state/stores';

const HANDLE_SIZE = 8;
const HANDLE_OFFSET = HANDLE_SIZE / 2;

const styles = {
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1000,
  } as React.CSSProperties,

  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '2px',
    fontSize: '11px',
    fontFamily: 'var(--vscode-font-family)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 1001,
  } as React.CSSProperties,
};

interface ResizeHandle {
  x: number;
  y: number;
  position: string;
}

export const SelectionOverlay: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  // Draw overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!selectionMode) return;

    // Draw hovered element
    if (hoveredElement && hoveredElement !== selectedElement) {
      drawElementHighlight(ctx, hoveredElement.rect, 'rgba(66, 133, 244, 0.3)', 'rgba(66, 133, 244, 0.8)', 1);
    }

    // Draw selected element
    if (selectedElement) {
      drawElementHighlight(ctx, selectedElement.rect, 'rgba(66, 133, 244, 0.2)', 'rgba(66, 133, 244, 1)', 2);
      drawResizeHandles(ctx, selectedElement.rect);

      // Update tooltip
      const label = getElementLabel(selectedElement);
      setTooltip({
        x: selectedElement.rect.x,
        y: selectedElement.rect.y - 24,
        text: label,
      });
    } else {
      setTooltip(null);
    }
  }, [selectionMode, selectedElement, hoveredElement, getElementLabel]);

  // Draw element highlight
  const drawElementHighlight = (
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    fillColor: string,
    strokeColor: string,
    lineWidth: number
  ) => {
    // Fill
    ctx.fillStyle = fillColor;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Stroke
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // Dimensions label
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.font = '11px var(--vscode-font-family)';
    const dimensionText = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    const textMetrics = ctx.measureText(dimensionText);
    const labelX = rect.x + rect.width / 2 - textMetrics.width / 2;
    const labelY = rect.y + rect.height / 2 + 4;

    // Draw background for dimension text
    ctx.fillRect(
      labelX - 4,
      labelY - 12,
      textMetrics.width + 8,
      16
    );

    // Draw dimension text
    ctx.fillStyle = '#fff';
    ctx.fillText(dimensionText, labelX, labelY);
  };

  // Draw resize handles
  const drawResizeHandles = (
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number }
  ) => {
    const handles: ResizeHandle[] = [
      { x: rect.x - HANDLE_OFFSET, y: rect.y - HANDLE_OFFSET, position: 'nw' },
      { x: rect.x + rect.width / 2 - HANDLE_OFFSET, y: rect.y - HANDLE_OFFSET, position: 'n' },
      { x: rect.x + rect.width - HANDLE_OFFSET, y: rect.y - HANDLE_OFFSET, position: 'ne' },
      { x: rect.x - HANDLE_OFFSET, y: rect.y + rect.height / 2 - HANDLE_OFFSET, position: 'w' },
      { x: rect.x + rect.width - HANDLE_OFFSET, y: rect.y + rect.height / 2 - HANDLE_OFFSET, position: 'e' },
      { x: rect.x - HANDLE_OFFSET, y: rect.y + rect.height - HANDLE_OFFSET, position: 'sw' },
      { x: rect.x + rect.width / 2 - HANDLE_OFFSET, y: rect.y + rect.height - HANDLE_OFFSET, position: 's' },
      { x: rect.x + rect.width - HANDLE_OFFSET, y: rect.y + rect.height - HANDLE_OFFSET, position: 'se' },
    ];

    handles.forEach((handle) => {
      // Draw handle background
      ctx.fillStyle = '#fff';
      ctx.fillRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE);

      // Draw handle border
      ctx.strokeStyle = 'rgba(66, 133, 244, 1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE);
    });
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = canvasRef.current.offsetWidth;
        canvasRef.current.height = canvasRef.current.offsetHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
