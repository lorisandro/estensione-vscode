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
  type: 'element-hover' | 'element-select' | 'inspector-ready' | 'selection-mode-changed' | 'element-drag-start' | 'element-drag-end' | 'drag-mode-changed';
  data?: ElementInfo | boolean | DragChangeData;
  timestamp: number;
}

interface DragChangeData {
  elementSelector: string;
  originalPosition: { x: number; y: number };
  newPosition: { x: number; y: number };
}

class ElementInspector {
  private isSelectionMode: boolean = false;
  private isDragMode: boolean = true; // Drag mode enabled by default
  private lastHoveredElement: HTMLElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private selectedElement: HTMLElement | null = null;
  private outlineStyleElement: HTMLStyleElement | null = null;
  private dragStyleElement: HTMLStyleElement | null = null;
  private rafId: number | null = null;
  private pendingUpdate: { element: HTMLElement; rect: DOMRect } | null = null;
  private lastMessageTime: number = 0;
  private readonly MESSAGE_THROTTLE_MS = 16; // ~60fps for messages

  // Drag mode properties
  private isDragging: boolean = false;
  private dragElement: HTMLElement | null = null;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private elementStartX: number = 0;
  private elementStartY: number = 0;
  private originalPosition: { x: number; y: number } | null = null;
  private dragOverlay: HTMLDivElement | null = null;
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

    // Create drag mode elements
    this.createDragStyle();
    this.createDragOverlay();

    // Setup event listeners
    this.setupEventListeners();

    // Setup global interface
    this.setupGlobalInterface();

    // Enable drag mode by default
    this.setDragMode(true);

    // Notify parent that inspector is ready
    this.sendMessage({
      type: 'inspector-ready',
      timestamp: Date.now(),
    });

    console.log('[Element Inspector] Initialized with drag mode enabled');
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
   * Create style element for drag mode
   */
  private createDragStyle(): void {
    this.dragStyleElement = document.createElement('style');
    this.dragStyleElement.id = '__claude-vs-inspector-drag-style__';
    this.dragStyleElement.textContent = `
      .__claude-vs-drag-mode__ *:not(#__claude-vs-inspector-overlay__):not(#__claude-vs-drag-overlay__):not(script):not(style):not(head):not(html):not(body) {
        cursor: grab !important;
      }
      .__claude-vs-drag-mode__ *:not(#__claude-vs-inspector-overlay__):not(#__claude-vs-drag-overlay__):not(script):not(style):not(head):not(html):not(body):hover {
        outline: 2px dashed rgba(0, 122, 204, 0.6) !important;
        outline-offset: 2px !important;
      }
      .__claude-vs-dragging__ {
        cursor: grabbing !important;
      }
      .__claude-vs-dragging__ * {
        cursor: grabbing !important;
      }
      .__claude-vs-drag-element__ {
        opacity: 0.8 !important;
        z-index: 999998 !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
        outline: 2px solid #007acc !important;
      }
    `;
    document.head.appendChild(this.dragStyleElement);
  }

  /**
   * Create drag overlay for visual feedback during drag
   */
  private createDragOverlay(): void {
    this.dragOverlay = document.createElement('div');
    this.dragOverlay.id = '__claude-vs-drag-overlay__';
    this.dragOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      border: 2px dashed rgba(0, 122, 204, 0.8);
      background-color: rgba(0, 122, 204, 0.05);
      z-index: 999997;
      display: none;
      box-sizing: border-box;
    `;
    document.body.appendChild(this.dragOverlay);
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

    // Drag mode event listeners
    document.addEventListener('mousedown', this.handleDragStart.bind(this), true);
    document.addEventListener('mousemove', this.handleDragMove.bind(this), true);
    document.addEventListener('mouseup', this.handleDragEnd.bind(this), true);
  }

  /**
   * Handle messages from parent window
   */
  private handleMessage(event: MessageEvent): void {
    const { type, payload } = event.data || {};

    if (type === 'set-selection-mode') {
      this.setSelectionMode(!!payload?.enabled);
    } else if (type === 'capture-screenshot') {
      this.captureScreenshot(payload);
    } else if (type === 'set-drag-mode') {
      this.setDragMode(!!payload?.enabled);
    } else if (type === 'undo-drag-change') {
      this.undoDragChange(payload);
    } else if (type === 'apply-drag-changes') {
      this.applyDragChanges();
    }
  }

  /**
   * Capture screenshot of specified area using html2canvas or canvas
   */
  private async captureScreenshot(area: { x: number; y: number; width: number; height: number }): Promise<void> {
    try {
      // Try to use html2canvas if available
      if (typeof (window as any).html2canvas === 'function') {
        const canvas = await (window as any).html2canvas(document.body, {
          x: area.x,
          y: area.y,
          width: area.width,
          height: area.height,
          windowWidth: document.documentElement.scrollWidth,
          windowHeight: document.documentElement.scrollHeight,
          scale: window.devicePixelRatio || 1,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });

        const imageData = canvas.toDataURL('image/png');
        this.sendScreenshotResponse(imageData);
        return;
      }

      // Fallback: capture using canvas and DOM serialization
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.sendScreenshotResponse(null);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      canvas.width = area.width * dpr;
      canvas.height = area.height * dpr;
      ctx.scale(dpr, dpr);

      // Draw a white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, area.width, area.height);

      // Try to serialize the DOM and draw it using SVG foreignObject
      try {
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${area.width}" height="${area.height}">
            <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml" style="position: absolute; left: -${area.x}px; top: -${area.y}px;">
                ${new XMLSerializer().serializeToString(document.documentElement)}
              </div>
            </foreignObject>
          </svg>
        `;

        const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load SVG'));
          img.src = url;
        });

        ctx.drawImage(img, 0, 0, area.width, area.height);
        URL.revokeObjectURL(url);

        const imageData = canvas.toDataURL('image/png');
        this.sendScreenshotResponse(imageData);
      } catch (svgError) {
        console.error('[Element Inspector] SVG capture failed:', svgError);
        // Send a placeholder with area info
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, area.width, area.height);
        ctx.fillStyle = '#333';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Area: ${area.width}x${area.height}`, area.width / 2, area.height / 2);

        const imageData = canvas.toDataURL('image/png');
        this.sendScreenshotResponse(imageData);
      }
    } catch (error) {
      console.error('[Element Inspector] Screenshot capture failed:', error);
      this.sendScreenshotResponse(null);
    }
  }

  /**
   * Send screenshot response to parent window
   */
  private sendScreenshotResponse(imageData: string | null): void {
    try {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'screenshot-captured',
          imageData: imageData,
          source: 'claude-vs-inspector',
        }, '*');
      }
    } catch (error) {
      console.error('[Element Inspector] Error sending screenshot:', error);
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
      setDragMode: (enabled: boolean) => {
        this.setDragMode(enabled);
      },
      getSelectedElement: () => {
        return this.selectedElement ? this.getElementInfo(this.selectedElement) : null;
      },
      isSelectionMode: () => {
        return this.isSelectionMode;
      },
      isDragMode: () => {
        return this.isDragMode;
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
    // Escape key to exit selection mode or cancel drag
    if (event.key === 'Escape') {
      if (this.isDragging) {
        this.cancelDrag();
      } else if (this.isSelectionMode) {
        this.setSelectionMode(false);
      }
    }
  }

  /**
   * Check if element is draggable (not our inspector elements)
   */
  private isDraggableElement(element: HTMLElement): boolean {
    if (!element || element === document.body || element === document.documentElement) {
      return false;
    }
    if (element.id?.startsWith('__claude-vs-')) {
      return false;
    }
    if (element.tagName === 'HTML' || element.tagName === 'BODY' || element.tagName === 'HEAD' || element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
      return false;
    }
    return true;
  }

  /**
   * Handle drag start
   */
  private handleDragStart(event: MouseEvent): void {
    if (!this.isDragMode || this.isSelectionMode || this.isDragging) {
      return;
    }

    const target = event.target as HTMLElement;

    if (!this.isDraggableElement(target)) {
      return;
    }

    // Prevent default text selection
    event.preventDefault();

    this.isDragging = true;
    this.dragElement = target;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;

    // Get current position
    const rect = target.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(target);

    // Store original position for undo
    const currentLeft = parseFloat(computedStyle.left) || 0;
    const currentTop = parseFloat(computedStyle.top) || 0;
    this.originalPosition = { x: currentLeft, y: currentTop };

    this.elementStartX = rect.left;
    this.elementStartY = rect.top;

    // Ensure element has position for dragging
    if (computedStyle.position === 'static') {
      target.style.position = 'relative';
    }

    // Add visual feedback
    target.classList.add('__claude-vs-drag-element__');
    document.body.classList.add('__claude-vs-dragging__');

    // Show drag overlay at original position
    if (this.dragOverlay) {
      this.dragOverlay.style.left = `${rect.left}px`;
      this.dragOverlay.style.top = `${rect.top}px`;
      this.dragOverlay.style.width = `${rect.width}px`;
      this.dragOverlay.style.height = `${rect.height}px`;
      this.dragOverlay.style.display = 'block';
    }

    // Send drag start message
    this.sendMessage({
      type: 'element-drag-start',
      data: this.getElementInfo(target),
      timestamp: Date.now(),
    });

    console.log('[Element Inspector] Drag started:', target);
  }

  /**
   * Handle drag move
   */
  private handleDragMove(event: MouseEvent): void {
    if (!this.isDragging || !this.dragElement) {
      return;
    }

    event.preventDefault();

    const deltaX = event.clientX - this.dragStartX;
    const deltaY = event.clientY - this.dragStartY;

    // Move element using transform for smooth movement
    const computedStyle = window.getComputedStyle(this.dragElement);
    const currentLeft = parseFloat(computedStyle.left) || 0;
    const currentTop = parseFloat(computedStyle.top) || 0;

    // Use left/top for positioning (maintains position after drag)
    this.dragElement.style.left = `${(this.originalPosition?.x || 0) + deltaX}px`;
    this.dragElement.style.top = `${(this.originalPosition?.y || 0) + deltaY}px`;
  }

  /**
   * Handle drag end
   */
  private handleDragEnd(event: MouseEvent): void {
    if (!this.isDragging || !this.dragElement) {
      return;
    }

    const deltaX = event.clientX - this.dragStartX;
    const deltaY = event.clientY - this.dragStartY;

    // Only record change if element actually moved
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      const computedStyle = window.getComputedStyle(this.dragElement);
      const newLeft = parseFloat(computedStyle.left) || 0;
      const newTop = parseFloat(computedStyle.top) || 0;

      // Send drag end message with change data
      const changeData: DragChangeData = {
        elementSelector: this.getCSSSelector(this.dragElement),
        originalPosition: this.originalPosition || { x: 0, y: 0 },
        newPosition: { x: newLeft, y: newTop },
      };

      this.sendMessage({
        type: 'element-drag-end',
        data: changeData,
        timestamp: Date.now(),
      });

      console.log('[Element Inspector] Drag ended:', changeData);
    }

    // Clean up
    this.finishDrag();
  }

  /**
   * Cancel current drag operation
   */
  private cancelDrag(): void {
    if (!this.isDragging || !this.dragElement) {
      return;
    }

    // Restore original position
    if (this.originalPosition) {
      this.dragElement.style.left = `${this.originalPosition.x}px`;
      this.dragElement.style.top = `${this.originalPosition.y}px`;
    }

    this.finishDrag();
    console.log('[Element Inspector] Drag cancelled');
  }

  /**
   * Clean up after drag operation
   */
  private finishDrag(): void {
    if (this.dragElement) {
      this.dragElement.classList.remove('__claude-vs-drag-element__');
    }
    document.body.classList.remove('__claude-vs-dragging__');

    if (this.dragOverlay) {
      this.dragOverlay.style.display = 'none';
    }

    this.isDragging = false;
    this.dragElement = null;
    this.originalPosition = null;
  }

  /**
   * Set drag mode
   */
  setDragMode(enabled: boolean): void {
    this.isDragMode = enabled;

    if (enabled) {
      document.body.classList.add('__claude-vs-drag-mode__');
      // Disable selection mode when drag mode is enabled
      if (this.isSelectionMode) {
        this.setSelectionMode(false);
      }
    } else {
      document.body.classList.remove('__claude-vs-drag-mode__');
      // Cancel any ongoing drag
      if (this.isDragging) {
        this.cancelDrag();
      }
    }

    // Send mode change notification
    this.sendMessage({
      type: 'drag-mode-changed',
      data: enabled,
      timestamp: Date.now(),
    });

    console.log('[Element Inspector] Drag mode:', enabled);
  }

  /**
   * Undo a drag change
   */
  private undoDragChange(change: DragChangeData): void {
    if (!change?.elementSelector) {
      console.warn('[Element Inspector] Invalid undo change data');
      return;
    }

    try {
      const element = document.querySelector(change.elementSelector) as HTMLElement;
      if (element) {
        element.style.left = `${change.originalPosition.x}px`;
        element.style.top = `${change.originalPosition.y}px`;
        console.log('[Element Inspector] Undo applied:', change.elementSelector);
      } else {
        console.warn('[Element Inspector] Element not found for undo:', change.elementSelector);
      }
    } catch (error) {
      console.error('[Element Inspector] Error applying undo:', error);
    }
  }

  /**
   * Apply all drag changes (clear undo history on iframe side)
   */
  private applyDragChanges(): void {
    console.log('[Element Inspector] Changes applied');
    // Changes are already applied visually, just acknowledge
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
      // Disable drag mode when selection mode is enabled
      if (this.isDragMode) {
        this.isDragMode = false;
        document.body.classList.remove('__claude-vs-drag-mode__');
      }
      // Show boundaries on all elements when selection mode is enabled
      this.showAllElementBoundaries();
    } else {
      // Re-enable drag mode when selection mode is disabled
      this.setDragMode(true);
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

    // Cancel any ongoing drag
    if (this.isDragging) {
      this.finishDrag();
    }

    this.pendingUpdate = null;

    if (this.overlay && this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }

    if (this.outlineStyleElement && this.outlineStyleElement.parentElement) {
      this.outlineStyleElement.parentElement.removeChild(this.outlineStyleElement);
    }

    if (this.dragStyleElement && this.dragStyleElement.parentElement) {
      this.dragStyleElement.parentElement.removeChild(this.dragStyleElement);
    }

    if (this.dragOverlay && this.dragOverlay.parentElement) {
      this.dragOverlay.parentElement.removeChild(this.dragOverlay);
    }

    this.hideAllElementBoundaries();
    document.body.classList.remove('__claude-vs-drag-mode__');
    document.body.classList.remove('__claude-vs-dragging__');
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
