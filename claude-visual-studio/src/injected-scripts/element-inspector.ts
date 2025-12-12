/**
 * Element Inspector Script
 *
 * This script is injected into the preview iframe to enable element selection
 * and inspection functionality. It detects mouse events, highlights elements,
 * and sends element information back to the parent webview.
 */

interface ElementInfo {
  tagName: string;
  id: string;
  classes: string[];
  textContent: string;
  attributes: Record<string, string>;
  styles: {
    computed: Record<string, string>;
    inline: Record<string, string>;
  };
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
    x: number;
    y: number;
  };
  xpath: string;
  selector: string;
  children: number;
  parent: string | null;
}

interface InspectorMessage {
  type: 'element-hover' | 'element-select' | 'inspector-ready' | 'selection-mode-changed';
  data?: ElementInfo | boolean;
  timestamp: number;
}

class ElementInspector {
  private isSelectionMode: boolean = false;
  private lastHoveredElement: HTMLElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private selectedElement: HTMLElement | null = null;
  private outlineStyleElement: HTMLStyleElement | null = null;
  private rafId: number | null = null;
  private pendingUpdate: { element: HTMLElement; rect: DOMRect } | null = null;
  private lastMessageTime: number = 0;
  private readonly MESSAGE_THROTTLE_MS = 16; // ~60fps for messages
  private readonly IMPORTANT_STYLES = [
    'display',
    'position',
    'top',
    'left',
    'right',
    'bottom',
    'width',
    'height',
    'margin',
    'padding',
    'border',
    'background',
    'backgroundColor',
    'color',
    'font',
    'fontSize',
    'fontFamily',
    'fontWeight',
    'lineHeight',
    'textAlign',
    'flex',
    'flexDirection',
    'justifyContent',
    'alignItems',
    'grid',
    'gridTemplate',
    'zIndex',
    'opacity',
    'transform',
  ];

  constructor() {
    this.init();
  }

  /**
   * Initialize the inspector
   */
  private init(): void {
    // Create overlay for highlighting
    this.createOverlay();

    // Setup event listeners
    this.setupEventListeners();

    // Setup global interface
    this.setupGlobalInterface();

    // Notify parent that inspector is ready
    this.sendMessage({
      type: 'inspector-ready',
      timestamp: Date.now(),
    });

    console.log('[Element Inspector] Initialized');
  }

  /**
   * Create highlight overlay
   * Optimized for smooth rendering without transitions
   */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = '__claude-vs-inspector-overlay__';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      border: 2px solid #007acc;
      background-color: rgba(0, 122, 204, 0.1);
      z-index: 999999;
      display: none;
      box-sizing: border-box;
      will-change: transform, width, height;
      contain: strict;
      transform: translate3d(0, 0, 0);
    `;
    document.body.appendChild(this.overlay);
  }

  /**
   * Create style element for showing element boundaries on hover only
   * Uses box-shadow instead of outline for better visual consistency
   */
  private createOutlineStyle(): void {
    this.outlineStyleElement = document.createElement('style');
    this.outlineStyleElement.id = '__claude-vs-inspector-outline-style__';
    // Using box-shadow with inset for cleaner visual without layout shifts
    // Also using pointer-events: none on pseudo-elements to prevent interference
    this.outlineStyleElement.textContent = `
      .__claude-vs-show-outlines__ {
        cursor: crosshair !important;
      }
      .__claude-vs-show-outlines__ *:not(#__claude-vs-inspector-overlay__) {
        cursor: crosshair !important;
      }
    `;
    document.head.appendChild(this.outlineStyleElement);
  }

  /**
   * Show boundaries on all elements
   */
  private showAllElementBoundaries(): void {
    if (!this.outlineStyleElement) {
      this.createOutlineStyle();
    }
    document.body.classList.add('__claude-vs-show-outlines__');
  }

  /**
   * Hide boundaries from all elements
   */
  private hideAllElementBoundaries(): void {
    document.body.classList.remove('__claude-vs-show-outlines__');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Mouse move for hover detection
    document.addEventListener('mousemove', this.handleMouseMove.bind(this), true);

    // Click for element selection
    document.addEventListener('click', this.handleClick.bind(this), true);

    // Key press for toggling selection mode (Escape to exit)
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);

    // Listen for messages from parent window
    window.addEventListener('message', this.handleMessage.bind(this), false);

    // Cleanup on unload
    window.addEventListener('beforeunload', this.cleanup.bind(this));
  }

  /**
   * Handle messages from parent window
   */
  private handleMessage(event: MessageEvent): void {
    const { type, payload } = event.data || {};

    if (type === 'set-selection-mode') {
      this.setSelectionMode(!!payload?.enabled);
    }
  }

  /**
   * Setup global interface for external control
   */
  private setupGlobalInterface(): void {
    // Expose global API
    (window as any).__claudeVSInspector__ = {
      setSelectionMode: (enabled: boolean) => {
        this.setSelectionMode(enabled);
      },
      getSelectedElement: () => {
        return this.selectedElement ? this.getElementInfo(this.selectedElement) : null;
      },
      isSelectionMode: () => {
        return this.isSelectionMode;
      },
    };
  }

  /**
   * Handle mouse move events
   * Optimized with requestAnimationFrame for smooth 60fps updates
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isSelectionMode) {
      return;
    }

    const target = event.target as HTMLElement;

    // Ignore our own overlay and inspector elements
    if (
      target === this.overlay ||
      target.id === '__claude-vs-inspector-overlay__' ||
      target.id?.startsWith('__claude-vs-')
    ) {
      return;
    }

    // Only update if element changed
    if (this.lastHoveredElement === target) {
      return;
    }

    this.lastHoveredElement = target;

    // Get rect immediately for accurate positioning
    const rect = target.getBoundingClientRect();

    // Schedule RAF update for smooth visual feedback
    this.pendingUpdate = { element: target, rect };

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        if (this.pendingUpdate) {
          this.highlightElementOptimized(this.pendingUpdate.rect);

          // Throttle messages to parent to avoid overwhelming
          const now = Date.now();
          if (now - this.lastMessageTime >= this.MESSAGE_THROTTLE_MS) {
            this.lastMessageTime = now;
            this.sendMessage({
              type: 'element-hover',
              data: this.getElementInfo(this.pendingUpdate.element),
              timestamp: now,
            });
          }
          this.pendingUpdate = null;
        }
      });
    }
  }

  /**
   * Handle click events
   */
  private handleClick(event: MouseEvent): void {
    if (!this.isSelectionMode) {
      return;
    }

    // Prevent default action
    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement;

    // Ignore our own overlay
    if (target === this.overlay || target.id === '__claude-vs-inspector-overlay__') {
      return;
    }

    // Select element
    this.selectElement(target);
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Escape key to exit selection mode
    if (event.key === 'Escape' && this.isSelectionMode) {
      this.setSelectionMode(false);
    }
  }

  /**
   * Highlight an element (legacy method - kept for compatibility)
   */
  private highlightElement(element: HTMLElement): void {
    if (!this.overlay) return;
    const rect = element.getBoundingClientRect();
    this.highlightElementOptimized(rect);
  }

  /**
   * Highlight element using optimized transform-based positioning
   * Uses GPU-accelerated transforms for smoother rendering
   */
  private highlightElementOptimized(rect: DOMRect): void {
    if (!this.overlay) return;

    // Use transform for GPU-accelerated positioning (much smoother than top/left)
    // Note: rect values from getBoundingClientRect are already viewport-relative
    this.overlay.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
    this.overlay.style.display = 'block';
  }

  /**
   * Hide the overlay
   */
  private hideOverlay(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  }

  /**
   * Select an element
   */
  private selectElement(element: HTMLElement): void {
    this.selectedElement = element;

    // Change overlay style to indicate selection
    if (this.overlay) {
      this.overlay.style.borderColor = '#00ff00';
      this.overlay.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
    }

    // Send selection info to parent
    this.sendMessage({
      type: 'element-select',
      data: this.getElementInfo(element),
      timestamp: Date.now(),
    });

    console.log('[Element Inspector] Selected:', element);
  }

  /**
   * Set selection mode
   */
  setSelectionMode(enabled: boolean): void {
    this.isSelectionMode = enabled;

    if (enabled) {
      // Show boundaries on all elements when selection mode is enabled
      this.showAllElementBoundaries();
    } else {
      // Cancel any pending RAF updates
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.pendingUpdate = null;

      this.hideOverlay();
      this.lastHoveredElement = null;
      this.selectedElement = null;

      // Hide boundaries from all elements
      this.hideAllElementBoundaries();

      // Reset overlay style
      if (this.overlay) {
        this.overlay.style.borderColor = '#007acc';
        this.overlay.style.backgroundColor = 'rgba(0, 122, 204, 0.1)';
        this.overlay.style.transform = 'translate3d(0, 0, 0)';
      }
    }

    // Update cursor (now handled by CSS in outline style)
    document.body.style.cursor = enabled ? 'crosshair' : '';

    // Send mode change notification
    this.sendMessage({
      type: 'selection-mode-changed',
      data: enabled,
      timestamp: Date.now(),
    });

    console.log('[Element Inspector] Selection mode:', enabled);
  }

  /**
   * Get detailed information about an element
   */
  private getElementInfo(element: HTMLElement): ElementInfo {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    // Get computed styles (only important ones)
    const computedStyles: Record<string, string> = {};
    this.IMPORTANT_STYLES.forEach((prop) => {
      computedStyles[prop] = computedStyle.getPropertyValue(prop);
    });

    // Get inline styles
    const inlineStyles: Record<string, string> = {};
    if (element.style.length > 0) {
      for (let i = 0; i < element.style.length; i++) {
        const prop = element.style[i];
        inlineStyles[prop] = element.style.getPropertyValue(prop);
      }
    }

    // Get all attributes
    const attributes: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }

    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id,
      classes: Array.from(element.classList),
      textContent: element.textContent?.trim().substring(0, 100) || '',
      attributes,
      styles: {
        computed: computedStyles,
        inline: inlineStyles,
      },
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
      },
      xpath: this.getXPath(element),
      selector: this.getCSSSelector(element),
      children: element.children.length,
      parent: element.parentElement?.tagName.toLowerCase() || null,
    };
  }

  /**
   * Generate XPath for an element
   */
  private getXPath(element: HTMLElement): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const parts: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = current.previousSibling;

      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = current.nodeName.toLowerCase();
      const part = index > 0 ? `${tagName}[${index + 1}]` : tagName;
      parts.unshift(part);

      current = current.parentElement;
    }

    return '/' + parts.join('/');
  }

  /**
   * Generate CSS selector for an element
   */
  private getCSSSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    const parts: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      // Add classes
      if (current.classList.length > 0) {
        selector += '.' + Array.from(current.classList).join('.');
      }

      // Add nth-child if needed for uniqueness
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children);
        const sameTagSiblings = siblings.filter(
          (sibling) => sibling.tagName === current!.tagName
        );

        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      parts.unshift(selector);

      // Stop if we have a unique selector
      if (document.querySelectorAll(parts.join(' > ')).length === 1) {
        break;
      }

      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  /**
   * Send message to parent window
   */
  private sendMessage(message: InspectorMessage): void {
    try {
      // Try to send to parent
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            source: 'claude-vs-inspector',
            ...message,
          },
          '*'
        );
      }

      // Also dispatch custom event for same-window communication
      window.dispatchEvent(
        new CustomEvent('claude-vs-inspector-message', {
          detail: message,
        })
      );
    } catch (error) {
      console.error('[Element Inspector] Error sending message:', error);
    }
  }

  /**
   * Cleanup on unload
   */
  private cleanup(): void {
    // Cancel any pending RAF
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.pendingUpdate = null;

    if (this.overlay && this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }

    if (this.outlineStyleElement && this.outlineStyleElement.parentElement) {
      this.outlineStyleElement.parentElement.removeChild(this.outlineStyleElement);
    }

    this.hideAllElementBoundaries();
    document.body.style.cursor = '';
  }
}

// Initialize inspector when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ElementInspector();
  });
} else {
  new ElementInspector();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ElementInspector;
}
