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
   */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = '__claude-vs-inspector-overlay__';
    this.overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #007acc;
      background-color: rgba(0, 122, 204, 0.1);
      z-index: 999999;
      display: none;
      box-sizing: border-box;
      transition: all 0.1s ease;
    `;
    document.body.appendChild(this.overlay);
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

    // Cleanup on unload
    window.addEventListener('beforeunload', this.cleanup.bind(this));
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
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isSelectionMode) {
      return;
    }

    const target = event.target as HTMLElement;

    // Ignore our own overlay
    if (target === this.overlay || target.id === '__claude-vs-inspector-overlay__') {
      return;
    }

    // Update last hovered element
    if (this.lastHoveredElement !== target) {
      this.lastHoveredElement = target;
      this.highlightElement(target);

      // Send hover info to parent
      this.sendMessage({
        type: 'element-hover',
        data: this.getElementInfo(target),
        timestamp: Date.now(),
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
   * Highlight an element
   */
  private highlightElement(element: HTMLElement): void {
    if (!this.overlay) return;

    const rect = element.getBoundingClientRect();

    this.overlay.style.top = `${rect.top + window.scrollY}px`;
    this.overlay.style.left = `${rect.left + window.scrollX}px`;
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

    if (!enabled) {
      this.hideOverlay();
      this.lastHoveredElement = null;
      this.selectedElement = null;

      // Reset overlay style
      if (this.overlay) {
        this.overlay.style.borderColor = '#007acc';
        this.overlay.style.backgroundColor = 'rgba(0, 122, 204, 0.1)';
      }
    }

    // Update cursor
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
    if (this.overlay && this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }

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
