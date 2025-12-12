import React, { useRef, useEffect, useCallback } from 'react';
import { useNavigationStore, useSelectionStore, useEditorStore, type ElementInfo } from '../../state/stores';
import { useVSCodeApi } from '../../hooks/useVSCodeApi';

interface BrowserFrameProps {
  onElementHover?: (element: ElementInfo | null) => void;
  onElementClick?: (element: ElementInfo | null) => void;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  onElementHover,
  onElementClick,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { url } = useNavigationStore();
  const { selectionMode } = useSelectionStore();
  const { setLoading, setError } = useEditorStore();
  const { postMessage } = useVSCodeApi();

  // Handle iframe load
  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(null);

    // Inject selection script if in selection mode
    if (selectionMode && iframeRef.current?.contentWindow) {
      injectSelectionScript();
    }
  }, [selectionMode, setLoading, setError]);

  // Handle iframe error
  const handleError = useCallback(() => {
    setLoading(false);
    setError('Failed to load preview. Make sure the server is running.');
  }, [setLoading, setError]);

  // Inject selection script into iframe
  const injectSelectionScript = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;

      // Check if script already exists
      if (doc.getElementById('selection-script')) return;

      const script = doc.createElement('script');
      script.id = 'selection-script';
      script.textContent = `
        (function() {
          let lastHoveredElement = null;

          function getElementInfo(element) {
            if (!element || element === document.body || element === document.documentElement) {
              return null;
            }

            const rect = element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(element);

            // Generate CSS selector
            const selector = generateSelector(element);

            // Get all attributes
            const attributes = {};
            for (let i = 0; i < element.attributes.length; i++) {
              const attr = element.attributes[i];
              attributes[attr.name] = attr.value;
            }

            // Get key styles
            const styles = {
              display: computedStyle.display,
              position: computedStyle.position,
              width: computedStyle.width,
              height: computedStyle.height,
              padding: computedStyle.padding,
              margin: computedStyle.margin,
              backgroundColor: computedStyle.backgroundColor,
              color: computedStyle.color,
              fontSize: computedStyle.fontSize,
              fontFamily: computedStyle.fontFamily,
            };

            return {
              tagName: element.tagName.toLowerCase(),
              id: element.id || undefined,
              className: element.className || undefined,
              textContent: element.textContent?.trim().substring(0, 100) || undefined,
              attributes,
              styles,
              rect: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
              },
              selector,
            };
          }

          function generateSelector(element) {
            if (element.id) {
              return '#' + element.id;
            }

            if (element === document.body) {
              return 'body';
            }

            const names = [];
            while (element.parentElement && element !== document.body) {
              if (element.id) {
                names.unshift('#' + element.id);
                break;
              } else {
                let c = 1;
                let e = element;
                while (e.previousElementSibling) {
                  e = e.previousElementSibling;
                  if (e.tagName === element.tagName) c++;
                }
                names.unshift(element.tagName.toLowerCase() + ':nth-of-type(' + c + ')');
                element = element.parentElement;
              }
            }
            return names.join(' > ');
          }

          // Mouse move handler
          document.addEventListener('mousemove', (e) => {
            const element = e.target;
            if (element !== lastHoveredElement) {
              lastHoveredElement = element;
              const info = getElementInfo(element);
              if (info) {
                window.parent.postMessage({
                  type: 'element-hover',
                  payload: info
                }, '*');
              }
            }
          }, true);

          // Click handler
          document.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const info = getElementInfo(e.target);
            if (info) {
              window.parent.postMessage({
                type: 'element-click',
                payload: info
              }, '*');
            }
          }, true);

          // Mouse out of iframe
          document.addEventListener('mouseleave', () => {
            window.parent.postMessage({
              type: 'element-hover',
              payload: null
            }, '*');
          });
        })();
      `;

      doc.body.appendChild(script);
    } catch (err) {
      console.error('Failed to inject selection script:', err);
    }
  }, []);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const { type, payload } = event.data;

      if (type === 'element-hover') {
        onElementHover?.(payload);
      } else if (type === 'element-click') {
        onElementClick?.(payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementHover, onElementClick]);

  // Reinject script when selection mode changes
  useEffect(() => {
    if (selectionMode && iframeRef.current?.contentWindow) {
      injectSelectionScript();
    }
  }, [selectionMode, url, injectSelectionScript]);

  // Set loading when URL changes
  useEffect(() => {
    setLoading(true);
  }, [url, setLoading]);

  return (
    <iframe
      ref={iframeRef}
      src={url}
      onLoad={handleLoad}
      onError={handleError}
      // Security Note: allow-same-origin is required for element inspector script injection.
      // This is safe because we only load content from localhost dev server.
      // In production, consider using postMessage-only communication.
      sandbox="allow-same-origin allow-scripts allow-forms"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        backgroundColor: '#fff',
        pointerEvents: selectionMode ? 'auto' : 'auto',
      }}
      title="Browser Preview"
    />
  );
};
