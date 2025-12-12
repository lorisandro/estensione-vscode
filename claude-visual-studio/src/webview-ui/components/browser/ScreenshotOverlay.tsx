import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSelectionStore, type ScreenshotArea } from '../../state/stores';
import { useVSCodeApi } from '../../hooks/useVSCodeApi';

const styles = {
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    cursor: 'crosshair',
    zIndex: 2000,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  } as React.CSSProperties,

  selectionBox: {
    position: 'absolute',
    border: '2px dashed #fff',
    backgroundColor: 'rgba(66, 133, 244, 0.2)',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
  } as React.CSSProperties,

  instructions: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 500,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: '12px 20px',
    borderRadius: '6px',
    pointerEvents: 'none',
  } as React.CSSProperties,

  dimensions: {
    position: 'absolute',
    color: '#fff',
    fontSize: '11px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: '2px 6px',
    borderRadius: '3px',
    pointerEvents: 'none',
  } as React.CSSProperties,

  cancelButton: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    padding: '8px 16px',
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    zIndex: 2001,
  } as React.CSSProperties,
};

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface ScreenshotOverlayProps {
  containerRef: React.RefObject<HTMLDivElement>;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

export const ScreenshotOverlay: React.FC<ScreenshotOverlayProps> = ({ containerRef, iframeRef }) => {
  const { screenshotMode, setScreenshotMode, setScreenshotArea } = useSelectionStore();
  const { postMessage } = useVSCodeApi();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  const [showInstructions, setShowInstructions] = useState(true);

  // Calculate selection rectangle
  const getSelectionRect = useCallback((): ScreenshotArea | null => {
    if (!dragState.isDragging && dragState.startX === 0) {
      return null;
    }

    const x = Math.min(dragState.startX, dragState.currentX);
    const y = Math.min(dragState.startY, dragState.currentY);
    const width = Math.abs(dragState.currentX - dragState.startX);
    const height = Math.abs(dragState.currentY - dragState.startY);

    if (width < 5 || height < 5) {
      return null;
    }

    return { x, y, width, height };
  }, [dragState]);

  // Handle mouse down - start selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setShowInstructions(false);
    setDragState({
      isDragging: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });
  }, []);

  // Handle mouse move - update selection
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging) return;

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    setDragState(prev => ({
      ...prev,
      currentX: x,
      currentY: y,
    }));
  }, [dragState.isDragging]);

  // Capture screenshot from iframe via postMessage
  const captureScreenshot = useCallback(async (area: ScreenshotArea): Promise<string | null> => {
    const iframe = iframeRef?.current;
    if (!iframe || !iframe.contentWindow) {
      console.error('[ScreenshotOverlay] No iframe reference available for screenshot');
      return null;
    }

    try {
      // Request the iframe to capture the screenshot via postMessage
      // This avoids cross-origin access issues
      const capturePromise = new Promise<string | null>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[ScreenshotOverlay] Screenshot capture timed out');
          resolve(null);
        }, 5000);

        const handleCaptureResponse = (event: MessageEvent) => {
          // Check if this is our screenshot response
          if (event.data?.type === 'screenshot-captured' && event.data?.source === 'claude-vs-inspector') {
            clearTimeout(timeout);
            window.removeEventListener('message', handleCaptureResponse);
            console.log('[ScreenshotOverlay] Received screenshot from iframe');
            resolve(event.data.imageData);
          }
        };

        window.addEventListener('message', handleCaptureResponse);

        // Request iframe to capture the area
        console.log('[ScreenshotOverlay] Requesting screenshot from iframe:', area);
        iframe.contentWindow?.postMessage({
          type: 'capture-screenshot',
          payload: area,
        }, '*');
      });

      return await capturePromise;
    } catch (error) {
      console.error('[ScreenshotOverlay] Screenshot capture failed:', error);
      return null;
    }
  }, [iframeRef]);

  // Handle mouse up - complete selection
  const handleMouseUp = useCallback(async () => {
    if (!dragState.isDragging) return;

    const selectionRect = getSelectionRect();

    if (selectionRect && selectionRect.width >= 10 && selectionRect.height >= 10) {
      // Get the container (browser frame) offset
      const containerRect = containerRef.current?.getBoundingClientRect();
      const overlayRect = overlayRef.current?.getBoundingClientRect();

      if (containerRect && overlayRect) {
        // Adjust coordinates relative to the iframe/browser frame
        const adjustedArea: ScreenshotArea = {
          x: selectionRect.x,
          y: selectionRect.y,
          width: selectionRect.width,
          height: selectionRect.height,
        };

        setScreenshotArea(adjustedArea);

        // Try to capture the screenshot
        const imageData = await captureScreenshot(adjustedArea);

        // Send capture request to extension with image data
        postMessage({
          type: 'capture-screenshot-area',
          payload: {
            ...adjustedArea,
            imageData: imageData,
          },
        });
      }
    }

    // Reset and exit screenshot mode
    setScreenshotMode(false);
    setDragState({
      isDragging: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    });
  }, [dragState.isDragging, getSelectionRect, containerRef, setScreenshotArea, setScreenshotMode, postMessage, captureScreenshot]);

  // Handle escape key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && screenshotMode) {
        setScreenshotMode(false);
        setDragState({
          isDragging: false,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenshotMode, setScreenshotMode]);

  // Handle cancel button click
  const handleCancel = useCallback(() => {
    setScreenshotMode(false);
  }, [setScreenshotMode]);

  if (!screenshotMode) return null;

  const selectionRect = getSelectionRect();

  return (
    <div
      ref={overlayRef}
      style={styles.overlay}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Cancel button */}
      <button
        style={styles.cancelButton}
        onClick={handleCancel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        Cancel (ESC)
      </button>

      {/* Instructions */}
      {showInstructions && !dragState.isDragging && (
        <div style={styles.instructions}>
          Click and drag to select an area to capture
        </div>
      )}

      {/* Selection box */}
      {selectionRect && (
        <>
          <div
            style={{
              ...styles.selectionBox,
              left: `${selectionRect.x}px`,
              top: `${selectionRect.y}px`,
              width: `${selectionRect.width}px`,
              height: `${selectionRect.height}px`,
            }}
          />
          {/* Dimensions label */}
          <div
            style={{
              ...styles.dimensions,
              left: `${selectionRect.x + selectionRect.width / 2 - 30}px`,
              top: `${selectionRect.y + selectionRect.height + 5}px`,
            }}
          >
            {Math.round(selectionRect.width)} x {Math.round(selectionRect.height)}
          </div>
        </>
      )}
    </div>
  );
};
