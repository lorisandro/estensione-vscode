import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigationStore, useSelectionStore, useEditorStore, type ElementInfo, type ConsoleLogEntry } from '../../state/stores';
import { useVSCodeApi } from '../../hooks/useVSCodeApi';

interface BrowserFrameProps {
  onElementHover?: (element: ElementInfo | null) => void;
  onElementClick?: (element: ElementInfo | null) => void;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

/**
 * Check if URL is external (not localhost)
 */
function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return hostname !== 'localhost' && hostname !== '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Convert external URL to proxy URL
 */
function getProxiedUrl(url: string, serverBaseUrl: string): string {
  if (!isExternalUrl(url)) {
    return url;
  }
  // Route external URLs through the proxy
  const proxyUrl = `${serverBaseUrl}/__claude-vs__/proxy?url=${encodeURIComponent(url)}`;
  return proxyUrl;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  onElementHover,
  onElementClick,
  iframeRef: externalRef,
}) => {
  const internalRef = useRef<HTMLIFrameElement>(null);
  const iframeRef = externalRef || internalRef;
  const { url, serverBaseUrl } = useNavigationStore();
  const { selectionMode } = useSelectionStore();
  const { setLoading, setError, addConsoleLog } = useEditorStore();
  const { postMessage } = useVSCodeApi();

  // Convert external URLs to proxy URLs
  const iframeSrc = useMemo(() => {
    return getProxiedUrl(url, serverBaseUrl);
  }, [url, serverBaseUrl]);

  // Inject console capture script into iframe
  const injectConsoleScript = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;

      // Check if script already exists
      if (doc.getElementById('console-capture-script')) return;

      const script = doc.createElement('script');
      script.id = 'console-capture-script';
      script.textContent = `
        (function() {
          const originalConsole = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            info: console.info.bind(console),
            debug: console.debug.bind(console),
          };

          function formatArgs(args) {
            return Array.from(args).map(arg => {
              if (typeof arg === 'object') {
                try {
                  return JSON.stringify(arg, null, 2);
                } catch {
                  return String(arg);
                }
              }
              return String(arg);
            }).join(' ');
          }

          function interceptConsole(type) {
            console[type] = function() {
              originalConsole[type].apply(console, arguments);
              window.parent.postMessage({
                type: 'console-log',
                payload: {
                  logType: type,
                  message: formatArgs(arguments)
                }
              }, '*');
            };
          }

          ['log', 'warn', 'error', 'info', 'debug'].forEach(interceptConsole);

          // Capture unhandled errors
          window.onerror = function(message, source, lineno, colno, error) {
            window.parent.postMessage({
              type: 'console-log',
              payload: {
                logType: 'error',
                message: message + ' at ' + source + ':' + lineno + ':' + colno
              }
            }, '*');
          };

          // Capture unhandled promise rejections
          window.onunhandledrejection = function(event) {
            window.parent.postMessage({
              type: 'console-log',
              payload: {
                logType: 'error',
                message: 'Unhandled Promise Rejection: ' + (event.reason?.message || event.reason || 'Unknown error')
              }
            }, '*');
          };
        })();
      `;

      // Insert at the beginning of head to capture early logs
      if (doc.head) {
        doc.head.insertBefore(script, doc.head.firstChild);
      } else if (doc.body) {
        doc.body.insertBefore(script, doc.body.firstChild);
      }
    } catch (err) {
      console.error('Failed to inject console capture script:', err);
    }
  }, []);

  // Handle iframe load
  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(null);

    // Always inject console capture script
    injectConsoleScript();

    // Inject selection script if in selection mode
    if (selectionMode && iframeRef.current?.contentWindow) {
      injectSelectionScript();
    }
  }, [selectionMode, setLoading, setError, injectConsoleScript]);

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

      // Add outline style for showing all element boundaries
      if (!doc.getElementById('selection-outline-style')) {
        const style = doc.createElement('style');
        style.id = 'selection-outline-style';
        style.textContent =
          'body.__claude-vs-show-outlines__ *:not(#__claude-vs-inspector-overlay__) {' +
          '  outline: 1px dashed rgba(66, 133, 244, 0.5) !important;' +
          '  outline-offset: -1px !important;' +
          '}' +
          'body.__claude-vs-show-outlines__ *:not(#__claude-vs-inspector-overlay__):hover {' +
          '  outline: 2px solid rgba(66, 133, 244, 0.8) !important;' +
          '  outline-offset: -1px !important;' +
          '}';
        doc.head.appendChild(style);
      }

      // Enable outline mode
      doc.body.classList.add('__claude-vs-show-outlines__');

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
      } else if (type === 'console-log') {
        addConsoleLog({
          type: payload.logType as ConsoleLogEntry['type'],
          message: payload.message,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementHover, onElementClick, addConsoleLog]);

  // Reinject script when selection mode changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;

      if (selectionMode) {
        injectSelectionScript();
      } else {
        // Remove outline mode when selection mode is disabled
        doc.body.classList.remove('__claude-vs-show-outlines__');
      }
    } catch (err) {
      // Cross-origin error - iframe content not accessible
      console.error('Failed to update selection mode:', err);
    }
  }, [selectionMode, url, injectSelectionScript]);

  // Set loading when URL changes
  useEffect(() => {
    setLoading(true);
  }, [url, setLoading]);

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      onLoad={handleLoad}
      onError={handleError}
      // Security Note: allow-same-origin is required for element inspector script injection.
      // External URLs are routed through proxy to bypass X-Frame-Options.
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
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
