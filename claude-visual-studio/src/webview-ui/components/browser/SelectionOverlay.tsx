import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSelectionStore, type ElementInfo } from '../../state/stores';

const HANDLE_SIZE = 10;
const HANDLE_OFFSET = HANDLE_SIZE / 2;
const HANDLE_HIT_AREA = 16; // Larger hit area for easier clicking

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

type HandlePosition = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';

interface ResizeHandle {
  x: number;
  y: number;
  position: HandlePosition;
}

interface ResizeState {
  isResizing: boolean;
  handle: HandlePosition | null;
  startX: number;
  startY: number;
  startRect: { x: number; y: number; width: number; height: number } | null;
}

// Cursor styles for each handle position
const CURSOR_MAP: Record<HandlePosition, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  w: 'ew-resize',
  e: 'ew-resize',
  sw: 'nesw-resize',
  s: 'ns-resize',
  se: 'nwse-resize',
};

export const SelectionOverlay: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const dprRef = useRef<number>(1);
  const { selectionMode, selectedElement, hoveredElement } = useSelectionStore();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<HandlePosition | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    handle: null,
    startX: 0,
    startY: 0,
    startRect: null,
  });
  const [liveRect, setLiveRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

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

  // Get handle positions for a given rect
  const getHandlePositions = useCallback((rect: { x: number; y: number; width: number; height: number }): ResizeHandle[] => {
    const x = Math.round(rect.x);
    const y = Math.round(rect.y);
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    return [
      { x: x - HANDLE_OFFSET, y: y - HANDLE_OFFSET, position: 'nw' },
      { x: x + w / 2 - HANDLE_OFFSET, y: y - HANDLE_OFFSET, position: 'n' },
      { x: x + w - HANDLE_OFFSET, y: y - HANDLE_OFFSET, position: 'ne' },
      { x: x - HANDLE_OFFSET, y: y + h / 2 - HANDLE_OFFSET, position: 'w' },
      { x: x + w - HANDLE_OFFSET, y: y + h / 2 - HANDLE_OFFSET, position: 'e' },
      { x: x - HANDLE_OFFSET, y: y + h - HANDLE_OFFSET, position: 'sw' },
      { x: x + w / 2 - HANDLE_OFFSET, y: y + h - HANDLE_OFFSET, position: 's' },
      { x: x + w - HANDLE_OFFSET, y: y + h - HANDLE_OFFSET, position: 'se' },
    ];
  }, []);

  // Check if a point is inside a handle's hit area
  const getHandleAtPoint = useCallback((mouseX: number, mouseY: number, rect: { x: number; y: number; width: number; height: number }): HandlePosition | null => {
    const handles = getHandlePositions(rect);
    const hitOffset = (HANDLE_HIT_AREA - HANDLE_SIZE) / 2;

    for (const handle of handles) {
      const hitX = handle.x - hitOffset;
      const hitY = handle.y - hitOffset;

      if (
        mouseX >= hitX &&
        mouseX <= hitX + HANDLE_HIT_AREA &&
        mouseY >= hitY &&
        mouseY <= hitY + HANDLE_HIT_AREA
      ) {
        return handle.position;
      }
    }
    return null;
  }, [getHandlePositions]);

  // Calculate new rect based on handle drag
  const calculateNewRect = useCallback((
    handle: HandlePosition,
    startRect: { x: number; y: number; width: number; height: number },
    deltaX: number,
    deltaY: number
  ): { x: number; y: number; width: number; height: number } => {
    let { x, y, width, height } = startRect;
    const minSize = 20;

    switch (handle) {
      case 'nw':
        x += deltaX;
        y += deltaY;
        width -= deltaX;
        height -= deltaY;
        break;
      case 'n':
        y += deltaY;
        height -= deltaY;
        break;
      case 'ne':
        y += deltaY;
        width += deltaX;
        height -= deltaY;
        break;
      case 'w':
        x += deltaX;
        width -= deltaX;
        break;
      case 'e':
        width += deltaX;
        break;
      case 'sw':
        x += deltaX;
        width -= deltaX;
        height += deltaY;
        break;
      case 's':
        height += deltaY;
        break;
      case 'se':
        width += deltaX;
        height += deltaY;
        break;
    }

    // Enforce minimum size and adjust position if needed
    if (width < minSize) {
      if (handle.includes('w')) {
        x = startRect.x + startRect.width - minSize;
      }
      width = minSize;
    }
    if (height < minSize) {
      if (handle.includes('n')) {
        y = startRect.y + startRect.height - minSize;
      }
      height = minSize;
    }

    return { x, y, width, height };
  }, []);

  // Send resize message to iframe
  const sendResizeToIframe = useCallback((
    selector: string,
    newWidth: number,
    newHeight: number
  ) => {
    // Dispatch custom event that App.tsx will forward to iframe
    window.dispatchEvent(new CustomEvent('claude-vs-resize-element', {
      detail: {
        selector,
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      }
    }));
  }, []);

  // Handle mouse down on overlay
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!selectionMode || !selectedElement) return;

    const rect = selectedElement.rect;
    const handle = getHandleAtPoint(e.clientX, e.clientY, rect);

    if (handle) {
      e.preventDefault();
      e.stopPropagation();

      setResizeState({
        isResizing: true,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...rect },
      });
      setLiveRect({ ...rect });
    }
  }, [selectionMode, selectedElement, getHandleAtPoint]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selectionMode || !selectedElement) return;

    if (resizeState.isResizing && resizeState.handle && resizeState.startRect) {
      e.preventDefault();

      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;
      const newRect = calculateNewRect(resizeState.handle, resizeState.startRect, deltaX, deltaY);
      setLiveRect(newRect);
    } else {
      // Check for handle hover
      const handle = getHandleAtPoint(e.clientX, e.clientY, selectedElement.rect);
      setHoveredHandle(handle);
    }
  }, [selectionMode, selectedElement, resizeState, calculateNewRect, getHandleAtPoint]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (resizeState.isResizing && liveRect && selectedElement) {
      // Send final size to iframe
      sendResizeToIframe(selectedElement.selector, liveRect.width, liveRect.height);

      console.log('[SelectionOverlay] Resize complete:', {
        selector: selectedElement.selector,
        width: liveRect.width,
        height: liveRect.height,
      });
    }

    setResizeState({
      isResizing: false,
      handle: null,
      startX: 0,
      startY: 0,
      startRect: null,
    });
    setLiveRect(null);
    setHoveredHandle(null);
  }, [resizeState.isResizing, liveRect, selectedElement, sendResizeToIframe]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (!resizeState.isResizing) {
      setHoveredHandle(null);
    }
  }, [resizeState.isResizing]);

  // Add global mouse event listeners during resize
  useEffect(() => {
    if (!resizeState.isResizing) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (resizeState.handle && resizeState.startRect) {
        const deltaX = e.clientX - resizeState.startX;
        const deltaY = e.clientY - resizeState.startY;
        const newRect = calculateNewRect(resizeState.handle, resizeState.startRect, deltaX, deltaY);
        setLiveRect(newRect);
      }
    };

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [resizeState, calculateNewRect, handleMouseUp]);

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

      // Draw selected element - use liveRect during resize for live feedback
      if (selectedElement) {
        const rectToDraw = liveRect || selectedElement.rect;

        // Use different colors during resize
        const fillColor = resizeState.isResizing ? 'rgba(66, 133, 244, 0.2)' : COLORS.selectedFill;
        const strokeColor = resizeState.isResizing ? 'rgba(66, 133, 244, 1)' : COLORS.selectedStroke;

        drawElementHighlight(ctx, rectToDraw, fillColor, strokeColor, 2);
        drawResizeHandles(ctx, rectToDraw, hoveredHandle);

        // Update tooltip
        const label = getElementLabel(selectedElement);
        const dimensionLabel = resizeState.isResizing && liveRect
          ? ` (${Math.round(liveRect.width)}×${Math.round(liveRect.height)})`
          : '';
        setTooltip({
          x: rectToDraw.x,
          y: Math.max(24, rectToDraw.y) - 24,
          text: label + dimensionLabel,
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
  }, [selectionMode, selectedElement, hoveredElement, getElementLabel, setupCanvas, liveRect, resizeState.isResizing, hoveredHandle]);

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
    rect: { x: number; y: number; width: number; height: number },
    activeHandle?: HandlePosition | null
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
      const isActive = activeHandle === handle.position || resizeState.handle === handle.position;

      // Draw handle background (white or highlighted)
      ctx.fillStyle = isActive ? COLORS.handleStroke : COLORS.handleFill;
      ctx.fillRect(hx, hy, HANDLE_SIZE, HANDLE_SIZE);

      // Draw handle border with crisp edges
      ctx.strokeStyle = isActive ? '#0056b3' : COLORS.handleStroke;
      ctx.lineWidth = isActive ? 2 : 1;
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

  // Get handle positions for rendering interactive elements
  const rectForHandles = liveRect || selectedElement?.rect;
  const handleElements = rectForHandles ? getHandlePositions(rectForHandles) : [];

  return (
    <>
      <canvas ref={canvasRef} style={styles.canvas} />
      {/* Interactive resize handles - individual elements for each handle */}
      {selectedElement && handleElements.map((handle) => (
        <div
          key={handle.position}
          style={{
            position: 'absolute',
            left: `${handle.x - (HANDLE_HIT_AREA - HANDLE_SIZE) / 2}px`,
            top: `${handle.y - (HANDLE_HIT_AREA - HANDLE_SIZE) / 2}px`,
            width: `${HANDLE_HIT_AREA}px`,
            height: `${HANDLE_HIT_AREA}px`,
            cursor: CURSOR_MAP[handle.position],
            pointerEvents: 'auto',
            zIndex: 1002,
            // Debug: uncomment to see hit areas
            // backgroundColor: 'rgba(255, 0, 0, 0.2)',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setResizeState({
              isResizing: true,
              handle: handle.position,
              startX: e.clientX,
              startY: e.clientY,
              startRect: { ...selectedElement.rect },
            });
            setLiveRect({ ...selectedElement.rect });
          }}
        />
      ))}
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
