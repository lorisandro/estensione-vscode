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
  type: 'element-hover' | 'element-select' | 'inspector-ready' | 'selection-mode-changed' | 'element-drag-start' | 'element-drag-end' | 'drag-mode-changed' | 'css-style-applied' | 'element-updated';
  data?: ElementInfo | boolean | DragChangeData | CssStyleChange;
  timestamp: number;
}

interface DragChangeData {
  elementSelector: string;
  originalPosition: { x: number; y: number };
  newPosition: { x: number; y: number };
}

interface CssStyleChange {
  selector: string;
  property: string;
  value: string;
  previousValue?: string;
}

// Guided drag and drop interfaces
interface AlignmentPoint {
  position: number;
  type: 'edge' | 'center';
  source: 'parent' | 'sibling';
}

interface AlignmentLine {
  orientation: 'horizontal' | 'vertical';
  position: number;
  start: number;
  end: number;
  type: 'edge' | 'center';
}

interface DistanceIndicator {
  orientation: 'horizontal' | 'vertical';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  distance: number;
}

interface ElementBounds {
  rect: DOMRect;
  edges: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    centerX: number;
    centerY: number;
  };
}

interface DragGuideState {
  alignmentPoints: {
    horizontal: AlignmentPoint[];
    vertical: AlignmentPoint[];
  };
  siblingBounds: ElementBounds[];
  parentBounds: ElementBounds | null;
}

interface SnapResult {
  snappedX: number;
  snappedY: number;
  horizontalGuides: AlignmentLine[];
  verticalGuides: AlignmentLine[];
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
  private dragOverlay: HTMLDivElement | null = null;

  // DOM reorder drag properties
  private dropIndicator: HTMLDivElement | null = null;
  private dropTarget: HTMLElement | null = null;
  private dropContainer: HTMLElement | null = null;
  private dropPosition: 'before' | 'after' | null = null;
  private originalNextSibling: Node | null = null;
  private originalParent: HTMLElement | null = null;

  // Guide properties (for visual feedback)
  private readonly GUIDE_COLOR = '#ff00ff';
  private readonly GUIDE_CENTER_COLOR = '#00d4ff';
  private guidesContainer: SVGSVGElement | null = null;
  private distanceContainer: HTMLDivElement | null = null;

  // Drag mode hover overlay (replaces CSS :hover)
  private dragHoverOverlay: HTMLDivElement | null = null;
  private lastDragHoveredElement: HTMLElement | null = null;

  private readonly IMPORTANT_STYLES = [
    // Position & Transform
    'position',
    'top',
    'left',
    'right',
    'bottom',
    'zIndex',
    'transform',
    'transformOrigin',
    // Layout
    'display',
    'flexDirection',
    'flexWrap',
    'justifyContent',
    'alignItems',
    'alignContent',
    'gap',
    'gridTemplateColumns',
    'gridTemplateRows',
    'gridColumn',
    'gridRow',
    // Dimensions
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
    // Spacing
    'margin',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'padding',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'boxSizing',
    // Appearance
    'opacity',
    'borderRadius',
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomLeftRadius',
    'borderBottomRightRadius',
    'overflow',
    'visibility',
    // Typography
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'lineHeight',
    'letterSpacing',
    'textAlign',
    'verticalAlign',
    'textDecoration',
    'textTransform',
    'whiteSpace',
    'wordBreak',
    'color',
    // Background
    'background',
    'backgroundColor',
    'backgroundImage',
    'backgroundSize',
    'backgroundPosition',
    'backgroundRepeat',
    // Border
    'border',
    'borderWidth',
    'borderStyle',
    'borderColor',
    'borderTop',
    'borderRight',
    'borderBottom',
    'borderLeft',
    // Shadow
    'boxShadow',
    'textShadow',
    // Filter
    'filter',
    'backdropFilter',
    // Transition & Animation
    'transition',
    'animation',
    // Cursor & Interaction
    'cursor',
    'pointerEvents',
    'userSelect',
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
    this.createDropIndicator();
    this.createDragHoverOverlay();

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
    // Note: Hover effect is now handled by dragHoverOverlay (JS-based) instead of CSS :hover
    // This prevents glitches with nested elements and z-index issues
    this.dragStyleElement.textContent = `
      .__claude-vs-drag-mode__ *:not(#__claude-vs-inspector-overlay__):not(#__claude-vs-drag-overlay__):not(#__claude-vs-drag-hover-overlay__):not(script):not(style):not(head):not(html):not(body) {
        cursor: grab !important;
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
   * Create drag overlay for visual feedback during drag (follows dragged element)
   */
  private createDragOverlay(): void {
    this.dragOverlay = document.createElement('div');
    this.dragOverlay.id = '__claude-vs-drag-overlay__';
    this.dragOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      border: 2px solid #007acc;
      background-color: rgba(0, 122, 204, 0.1);
      z-index: 999997;
      display: none;
      box-sizing: border-box;
      opacity: 0.7;
    `;
    document.body.appendChild(this.dragOverlay);
  }

  /**
   * Create drop indicator (horizontal line showing where element will be inserted)
   */
  private createDropIndicator(): void {
    this.dropIndicator = document.createElement('div');
    this.dropIndicator.id = '__claude-vs-drop-indicator__';
    this.dropIndicator.style.cssText = `
      position: fixed;
      height: 4px;
      background: linear-gradient(90deg, transparent, #007acc, #007acc, transparent);
      border-radius: 2px;
      z-index: 999998;
      display: none;
      pointer-events: none;
      box-shadow: 0 0 8px rgba(0, 122, 204, 0.6);
    `;
    document.body.appendChild(this.dropIndicator);
  }

  /**
   * Show drop indicator at position
   */
  private showDropIndicator(x: number, y: number, width: number): void {
    if (!this.dropIndicator) return;
    this.dropIndicator.style.left = `${x}px`;
    this.dropIndicator.style.top = `${y - 2}px`;
    this.dropIndicator.style.width = `${width}px`;
    this.dropIndicator.style.display = 'block';
  }

  /**
   * Hide drop indicator
   */
  private hideDropIndicator(): void {
    if (!this.dropIndicator) return;
    this.dropIndicator.style.display = 'none';
  }

  /**
   * Find drop target and position based on mouse coordinates
   * Searches for valid drop zones across the entire document, not just siblings
   */
  private findDropTarget(mouseX: number, mouseY: number): { target: HTMLElement | null; position: 'before' | 'after'; container: HTMLElement | null } {
    if (!this.dragElement) {
      return { target: null, position: 'before', container: null };
    }

    // Get element under mouse (excluding our inspector elements and the dragged element)
    const elementsAtPoint = document.elementsFromPoint(mouseX, mouseY) as HTMLElement[];

    // Find the first valid container element under the mouse
    let targetContainer: HTMLElement | null = null;
    for (const el of elementsAtPoint) {
      if (el === this.dragElement) continue;
      if (el.id?.startsWith('__claude-vs-')) continue;
      if (el.tagName === 'HTML' || el.tagName === 'HEAD' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;

      // Skip inline elements - we want block-level containers (but allow body)
      const display = window.getComputedStyle(el).display;
      if (display === 'inline' || display === 'none') continue;

      targetContainer = el;
      break;
    }

    if (!targetContainer) {
      return { target: null, position: 'before', container: null };
    }

    // Get children of the target container
    const children = Array.from(targetContainer.children).filter(
      child => child !== this.dragElement &&
               child.nodeType === Node.ELEMENT_NODE &&
               !((child as HTMLElement).id?.startsWith('__claude-vs-')) &&
               window.getComputedStyle(child as HTMLElement).display !== 'none'
    ) as HTMLElement[];

    // If container has no children, we can drop directly inside
    if (children.length === 0) {
      return { target: null, position: 'before', container: targetContainer };
    }

    // Find the closest child to insert before/after
    let closestChild: HTMLElement | null = null;
    let closestDistance = Infinity;
    let position: 'before' | 'after' = 'before';

    for (const child of children) {
      const rect = child.getBoundingClientRect();
      const childCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(mouseY - childCenterY);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestChild = child;
        position = mouseY < childCenterY ? 'before' : 'after';
      }
    }

    return { target: closestChild, position, container: targetContainer };
  }

  /**
   * Create containers for alignment guides and distance indicators
   */
  private createGuidesContainer(): void {
    // SVG container for crisp guide lines
    this.guidesContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.guidesContainer.id = '__claude-vs-guides-container__';
    this.guidesContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999996;
      overflow: visible;
    `;
    document.body.appendChild(this.guidesContainer);

    // Container for distance labels
    this.distanceContainer = document.createElement('div');
    this.distanceContainer.id = '__claude-vs-distance-container__';
    this.distanceContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999996;
    `;
    document.body.appendChild(this.distanceContainer);
  }

  /**
   * Create drag hover overlay (replaces CSS :hover for better control)
   */
  private createDragHoverOverlay(): void {
    this.dragHoverOverlay = document.createElement('div');
    this.dragHoverOverlay.id = '__claude-vs-drag-hover-overlay__';
    this.dragHoverOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px dashed rgba(0, 122, 204, 0.8);
      background-color: rgba(0, 122, 204, 0.05);
      z-index: 999999;
      display: none;
      box-sizing: border-box;
      transition: left 0.08s ease-out, top 0.08s ease-out, width 0.08s ease-out, height 0.08s ease-out;
    `;
    document.body.appendChild(this.dragHoverOverlay);
  }

  /**
   * Show drag hover overlay on element
   */
  private showDragHoverOverlay(rect: DOMRect): void {
    if (!this.dragHoverOverlay) return;

    this.dragHoverOverlay.style.left = `${rect.left}px`;
    this.dragHoverOverlay.style.top = `${rect.top}px`;
    this.dragHoverOverlay.style.width = `${rect.width}px`;
    this.dragHoverOverlay.style.height = `${rect.height}px`;
    this.dragHoverOverlay.style.display = 'block';
  }

  /**
   * Hide drag hover overlay
   */
  private hideDragHoverOverlay(): void {
    if (!this.dragHoverOverlay) return;
    this.dragHoverOverlay.style.display = 'none';
    this.lastDragHoveredElement = null;
  }

  /**
   * Handle hover in drag mode (replaces CSS :hover)
   */
  private handleDragModeHover(event: MouseEvent): void {
    // Only active in drag mode, when not dragging, and not in selection mode
    if (!this.isDragMode || this.isDragging || this.isSelectionMode) {
      this.hideDragHoverOverlay();
      return;
    }

    const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement;

    // Skip if same element or not draggable
    if (!target || target === this.lastDragHoveredElement) {
      return;
    }

    if (!this.isDraggableElement(target)) {
      this.hideDragHoverOverlay();
      return;
    }

    // Update last hovered element
    this.lastDragHoveredElement = target;

    // Show overlay on element
    const rect = target.getBoundingClientRect();
    this.showDragHoverOverlay(rect);
  }

  /**
   * Collect alignment points from parent and siblings
   */
  private collectAlignmentPoints(dragElement: HTMLElement): DragGuideState {
    const state: DragGuideState = {
      alignmentPoints: { horizontal: [], vertical: [] },
      siblingBounds: [],
      parentBounds: null
    };

    const parent = dragElement.parentElement;
    if (!parent) {
      return state;
    }

    // Check if parent is body or html - use viewport as reference
    const isBodyOrHtml = parent === document.body || parent === document.documentElement;

    let parentRect: DOMRect;
    if (isBodyOrHtml) {
      // Use viewport as reference bounds
      parentRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    } else {
      parentRect = parent.getBoundingClientRect();
    }

    state.parentBounds = {
      rect: parentRect,
      edges: {
        top: parentRect.top,
        right: parentRect.right,
        bottom: parentRect.bottom,
        left: parentRect.left,
        centerX: parentRect.left + parentRect.width / 2,
        centerY: parentRect.top + parentRect.height / 2
      }
    };

    // Add parent/viewport alignment points
    // Horizontal alignments (y-axis positions)
    state.alignmentPoints.horizontal.push(
      { position: parentRect.top, type: 'edge', source: 'parent' },
      { position: parentRect.top + parentRect.height / 2, type: 'center', source: 'parent' },
      { position: parentRect.bottom, type: 'edge', source: 'parent' }
    );

    // Vertical alignments (x-axis positions)
    state.alignmentPoints.vertical.push(
      { position: parentRect.left, type: 'edge', source: 'parent' },
      { position: parentRect.left + parentRect.width / 2, type: 'center', source: 'parent' },
      { position: parentRect.right, type: 'edge', source: 'parent' }
    );

    // Get the actual parent for sibling collection (use body if parent is html)
    const siblingContainer = isBodyOrHtml ? document.body : parent;

    // Collect sibling bounds and alignment points
    const siblings = Array.from(siblingContainer.children).filter(
      child => child !== dragElement &&
               child.nodeType === Node.ELEMENT_NODE &&
               !((child as HTMLElement).id?.startsWith('__claude-vs-')) &&
               window.getComputedStyle(child as HTMLElement).display !== 'none'
    ) as HTMLElement[];

    for (const sibling of siblings) {
      const rect = sibling.getBoundingClientRect();
      const bounds: ElementBounds = {
        rect,
        edges: {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2
        }
      };
      state.siblingBounds.push(bounds);

      // Add sibling horizontal alignment points
      state.alignmentPoints.horizontal.push(
        { position: rect.top, type: 'edge', source: 'sibling' },
        { position: rect.top + rect.height / 2, type: 'center', source: 'sibling' },
        { position: rect.bottom, type: 'edge', source: 'sibling' }
      );

      // Add sibling vertical alignment points
      state.alignmentPoints.vertical.push(
        { position: rect.left, type: 'edge', source: 'sibling' },
        { position: rect.left + rect.width / 2, type: 'center', source: 'sibling' },
        { position: rect.right, type: 'edge', source: 'sibling' }
      );
    }

    return state;
  }

  /**
   * Find snap position based on alignment points
   */
  private findSnapPosition(
    elementRect: DOMRect,
    state: DragGuideState,
    proposedX: number,
    proposedY: number
  ): SnapResult {
    const result: SnapResult = {
      snappedX: proposedX,
      snappedY: proposedY,
      horizontalGuides: [],
      verticalGuides: []
    };

    // Element edges at current visual position
    const elementEdges = {
      top: elementRect.top,
      bottom: elementRect.bottom,
      centerY: elementRect.top + elementRect.height / 2,
      left: elementRect.left,
      right: elementRect.right,
      centerX: elementRect.left + elementRect.width / 2
    };

    // Check horizontal snapping (affects Y position)
    let bestHSnap: { distance: number; adjustment: number; guide: AlignmentLine } | null = null;
    const hEdgesToCheck = [
      { edge: 'top', value: elementEdges.top },
      { edge: 'center', value: elementEdges.centerY },
      { edge: 'bottom', value: elementEdges.bottom }
    ];

    for (const edgeInfo of hEdgesToCheck) {
      for (const point of state.alignmentPoints.horizontal) {
        const distance = Math.abs(edgeInfo.value - point.position);

        if (distance <= this.SNAP_THRESHOLD) {
          if (!bestHSnap || distance < bestHSnap.distance) {
            let adjustment: number;
            if (edgeInfo.edge === 'top') {
              adjustment = proposedY + (point.position - elementEdges.top);
            } else if (edgeInfo.edge === 'center') {
              adjustment = proposedY + (point.position - elementEdges.centerY);
            } else {
              adjustment = proposedY + (point.position - elementEdges.bottom);
            }

            bestHSnap = {
              distance,
              adjustment,
              guide: {
                orientation: 'horizontal',
                position: point.position,
                start: 0,
                end: window.innerWidth,
                type: point.type
              }
            };
          }
        }
      }
    }

    if (bestHSnap) {
      result.snappedY = bestHSnap.adjustment;
      result.horizontalGuides.push(bestHSnap.guide);
    }

    // Check vertical snapping (affects X position)
    let bestVSnap: { distance: number; adjustment: number; guide: AlignmentLine } | null = null;
    const vEdgesToCheck = [
      { edge: 'left', value: elementEdges.left },
      { edge: 'center', value: elementEdges.centerX },
      { edge: 'right', value: elementEdges.right }
    ];

    for (const edgeInfo of vEdgesToCheck) {
      for (const point of state.alignmentPoints.vertical) {
        const distance = Math.abs(edgeInfo.value - point.position);

        if (distance <= this.SNAP_THRESHOLD) {
          if (!bestVSnap || distance < bestVSnap.distance) {
            let adjustment: number;
            if (edgeInfo.edge === 'left') {
              adjustment = proposedX + (point.position - elementEdges.left);
            } else if (edgeInfo.edge === 'center') {
              adjustment = proposedX + (point.position - elementEdges.centerX);
            } else {
              adjustment = proposedX + (point.position - elementEdges.right);
            }

            bestVSnap = {
              distance,
              adjustment,
              guide: {
                orientation: 'vertical',
                position: point.position,
                start: 0,
                end: window.innerHeight,
                type: point.type
              }
            };
          }
        }
      }
    }

    if (bestVSnap) {
      result.snappedX = bestVSnap.adjustment;
      result.verticalGuides.push(bestVSnap.guide);
    }

    return result;
  }

  /**
   * Calculate distance indicators from element to parent and siblings
   */
  private calculateDistanceIndicators(
    elementRect: DOMRect,
    state: DragGuideState
  ): DistanceIndicator[] {
    const indicators: DistanceIndicator[] = [];

    // Distance to parent edges
    if (state.parentBounds) {
      const parent = state.parentBounds;

      // Top distance
      if (elementRect.top > parent.rect.top) {
        indicators.push({
          orientation: 'vertical',
          fromX: elementRect.left + elementRect.width / 2,
          fromY: parent.rect.top,
          toX: elementRect.left + elementRect.width / 2,
          toY: elementRect.top,
          distance: elementRect.top - parent.rect.top
        });
      }

      // Bottom distance
      if (elementRect.bottom < parent.rect.bottom) {
        indicators.push({
          orientation: 'vertical',
          fromX: elementRect.left + elementRect.width / 2,
          fromY: elementRect.bottom,
          toX: elementRect.left + elementRect.width / 2,
          toY: parent.rect.bottom,
          distance: parent.rect.bottom - elementRect.bottom
        });
      }

      // Left distance
      if (elementRect.left > parent.rect.left) {
        indicators.push({
          orientation: 'horizontal',
          fromX: parent.rect.left,
          fromY: elementRect.top + elementRect.height / 2,
          toX: elementRect.left,
          toY: elementRect.top + elementRect.height / 2,
          distance: elementRect.left - parent.rect.left
        });
      }

      // Right distance
      if (elementRect.right < parent.rect.right) {
        indicators.push({
          orientation: 'horizontal',
          fromX: elementRect.right,
          fromY: elementRect.top + elementRect.height / 2,
          toX: parent.rect.right,
          toY: elementRect.top + elementRect.height / 2,
          distance: parent.rect.right - elementRect.right
        });
      }
    }

    // Distance to nearest siblings
    for (const sibling of state.siblingBounds) {
      const sRect = sibling.rect;

      // Check if sibling is to the left and overlaps vertically
      if (sRect.right < elementRect.left &&
          !(elementRect.bottom < sRect.top || elementRect.top > sRect.bottom)) {
        const midY = Math.max(elementRect.top, sRect.top) +
                     (Math.min(elementRect.bottom, sRect.bottom) - Math.max(elementRect.top, sRect.top)) / 2;
        indicators.push({
          orientation: 'horizontal',
          fromX: sRect.right,
          fromY: midY,
          toX: elementRect.left,
          toY: midY,
          distance: elementRect.left - sRect.right
        });
      }

      // Check if sibling is to the right and overlaps vertically
      if (sRect.left > elementRect.right &&
          !(elementRect.bottom < sRect.top || elementRect.top > sRect.bottom)) {
        const midY = Math.max(elementRect.top, sRect.top) +
                     (Math.min(elementRect.bottom, sRect.bottom) - Math.max(elementRect.top, sRect.top)) / 2;
        indicators.push({
          orientation: 'horizontal',
          fromX: elementRect.right,
          fromY: midY,
          toX: sRect.left,
          toY: midY,
          distance: sRect.left - elementRect.right
        });
      }

      // Check if sibling is above and overlaps horizontally
      if (sRect.bottom < elementRect.top &&
          !(elementRect.right < sRect.left || elementRect.left > sRect.right)) {
        const midX = Math.max(elementRect.left, sRect.left) +
                     (Math.min(elementRect.right, sRect.right) - Math.max(elementRect.left, sRect.left)) / 2;
        indicators.push({
          orientation: 'vertical',
          fromX: midX,
          fromY: sRect.bottom,
          toX: midX,
          toY: elementRect.top,
          distance: elementRect.top - sRect.bottom
        });
      }

      // Check if sibling is below and overlaps horizontally
      if (sRect.top > elementRect.bottom &&
          !(elementRect.right < sRect.left || elementRect.left > sRect.right)) {
        const midX = Math.max(elementRect.left, sRect.left) +
                     (Math.min(elementRect.right, sRect.right) - Math.max(elementRect.left, sRect.left)) / 2;
        indicators.push({
          orientation: 'vertical',
          fromX: midX,
          fromY: elementRect.bottom,
          toX: midX,
          toY: sRect.top,
          distance: sRect.top - elementRect.bottom
        });
      }
    }

    return indicators;
  }

  /**
   * Update the visual display of guides and distance indicators
   */
  private updateGuidesDisplay(guides: AlignmentLine[], indicators: DistanceIndicator[]): void {
    if (!this.guidesContainer || !this.distanceContainer) return;

    // Clear existing content
    this.guidesContainer.innerHTML = '';
    this.distanceContainer.innerHTML = '';

    // Draw alignment guide lines
    for (const guide of guides) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const isCenter = guide.type === 'center';

      if (guide.orientation === 'vertical') {
        line.setAttribute('x1', String(guide.position));
        line.setAttribute('y1', String(guide.start));
        line.setAttribute('x2', String(guide.position));
        line.setAttribute('y2', String(guide.end));
      } else {
        line.setAttribute('x1', String(guide.start));
        line.setAttribute('y1', String(guide.position));
        line.setAttribute('x2', String(guide.end));
        line.setAttribute('y2', String(guide.position));
      }

      line.setAttribute('stroke', isCenter ? this.GUIDE_CENTER_COLOR : this.GUIDE_COLOR);
      line.setAttribute('stroke-width', '1');
      if (isCenter) {
        line.setAttribute('stroke-dasharray', '4,4');
      }

      this.guidesContainer.appendChild(line);
    }

    // Draw distance measurement lines and labels
    for (const indicator of indicators) {
      // Draw measurement line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(indicator.fromX));
      line.setAttribute('y1', String(indicator.fromY));
      line.setAttribute('x2', String(indicator.toX));
      line.setAttribute('y2', String(indicator.toY));
      line.setAttribute('stroke', this.GUIDE_COLOR);
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '2,2');
      this.guidesContainer.appendChild(line);

      // Draw end caps for the measurement line
      if (indicator.orientation === 'horizontal') {
        // Vertical caps at each end
        const cap1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        cap1.setAttribute('x1', String(indicator.fromX));
        cap1.setAttribute('y1', String(indicator.fromY - 4));
        cap1.setAttribute('x2', String(indicator.fromX));
        cap1.setAttribute('y2', String(indicator.fromY + 4));
        cap1.setAttribute('stroke', this.GUIDE_COLOR);
        cap1.setAttribute('stroke-width', '1');
        this.guidesContainer.appendChild(cap1);

        const cap2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        cap2.setAttribute('x1', String(indicator.toX));
        cap2.setAttribute('y1', String(indicator.toY - 4));
        cap2.setAttribute('x2', String(indicator.toX));
        cap2.setAttribute('y2', String(indicator.toY + 4));
        cap2.setAttribute('stroke', this.GUIDE_COLOR);
        cap2.setAttribute('stroke-width', '1');
        this.guidesContainer.appendChild(cap2);
      } else {
        // Horizontal caps at each end
        const cap1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        cap1.setAttribute('x1', String(indicator.fromX - 4));
        cap1.setAttribute('y1', String(indicator.fromY));
        cap1.setAttribute('x2', String(indicator.fromX + 4));
        cap1.setAttribute('y2', String(indicator.fromY));
        cap1.setAttribute('stroke', this.GUIDE_COLOR);
        cap1.setAttribute('stroke-width', '1');
        this.guidesContainer.appendChild(cap1);

        const cap2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        cap2.setAttribute('x1', String(indicator.toX - 4));
        cap2.setAttribute('y1', String(indicator.toY));
        cap2.setAttribute('x2', String(indicator.toX + 4));
        cap2.setAttribute('y2', String(indicator.toY));
        cap2.setAttribute('stroke', this.GUIDE_COLOR);
        cap2.setAttribute('stroke-width', '1');
        this.guidesContainer.appendChild(cap2);
      }

      // Draw distance label
      const label = document.createElement('div');
      const midX = (indicator.fromX + indicator.toX) / 2;
      const midY = (indicator.fromY + indicator.toY) / 2;

      label.style.cssText = `
        position: fixed;
        left: ${midX}px;
        top: ${midY}px;
        transform: translate(-50%, -50%);
        background: ${this.GUIDE_COLOR};
        color: #ffffff;
        font-size: 10px;
        font-family: system-ui, -apple-system, sans-serif;
        font-variant-numeric: tabular-nums;
        padding: 2px 4px;
        border-radius: 2px;
        white-space: nowrap;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      `;
      label.textContent = `${Math.round(indicator.distance)}`;
      this.distanceContainer.appendChild(label);
    }
  }

  /**
   * Clear all guides and distance indicators
   */
  private clearGuides(): void {
    if (this.guidesContainer) {
      this.guidesContainer.innerHTML = '';
    }
    if (this.distanceContainer) {
      this.distanceContainer.innerHTML = '';
    }
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

    // Drag mode hover (replaces CSS :hover for better control)
    document.addEventListener('mousemove', this.handleDragModeHover.bind(this), true);

    // Prevent native browser drag which interferes with our custom drag
    document.addEventListener('dragstart', this.handleNativeDragStart.bind(this), true);
  }

  /**
   * Prevent native browser drag when in drag mode
   */
  private handleNativeDragStart(event: DragEvent): void {
    if (this.isDragMode && !this.isSelectionMode) {
      event.preventDefault();
      event.stopPropagation();
    }
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
    } else if (type === 'apply-css-style') {
      this.applyCssStyle(payload);
    } else if (type === 'get-element-info') {
      this.sendSelectedElementInfo();
    }
  }

  /**
   * Apply CSS style to selected element or by selector
   */
  private applyCssStyle(payload: { selector?: string; property: string; value: string }): void {
    if (!payload?.property) {
      console.warn('[Element Inspector] Invalid CSS style payload');
      return;
    }

    let element: HTMLElement | null = null;

    // If selector is provided, use it; otherwise use selected element
    if (payload.selector) {
      element = document.querySelector(payload.selector) as HTMLElement;
    } else if (this.selectedElement) {
      element = this.selectedElement;
    }

    if (!element) {
      console.warn('[Element Inspector] No element found to apply CSS style');
      return;
    }

    // Get previous value for undo support
    const computedStyle = window.getComputedStyle(element);
    const previousValue = computedStyle.getPropertyValue(payload.property);

    // Apply the style
    try {
      // Convert camelCase to kebab-case for CSS property
      const cssProperty = payload.property.replace(/([A-Z])/g, '-$1').toLowerCase();
      element.style.setProperty(cssProperty, payload.value);

      // Send confirmation with updated element info
      this.sendMessage({
        type: 'css-style-applied',
        data: {
          selector: this.getCSSSelector(element),
          property: payload.property,
          value: payload.value,
          previousValue: previousValue,
        } as CssStyleChange,
        timestamp: Date.now(),
      });

      // Also send updated element info
      this.sendMessage({
        type: 'element-updated',
        data: this.getElementInfo(element),
        timestamp: Date.now(),
      });

      console.log('[Element Inspector] CSS style applied:', payload.property, '=', payload.value);
    } catch (error) {
      console.error('[Element Inspector] Error applying CSS style:', error);
    }
  }

  /**
   * Send current selected element info
   */
  private sendSelectedElementInfo(): void {
    if (this.selectedElement) {
      this.sendMessage({
        type: 'element-updated',
        data: this.getElementInfo(this.selectedElement),
        timestamp: Date.now(),
      });
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
   * Handle drag start - DOM reorder approach
   */
  private handleDragStart(event: MouseEvent): void {
    if (!this.isDragMode || this.isSelectionMode || this.isDragging) {
      return;
    }

    const target = event.target as HTMLElement;

    if (!this.isDraggableElement(target)) {
      return;
    }

    // Prevent default behavior (text selection, native drag)
    event.preventDefault();
    event.stopPropagation();

    // Hide the hover overlay when starting to drag
    this.hideDragHoverOverlay();

    this.isDragging = true;
    this.dragElement = target;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;

    // Store original DOM position for potential cancel
    this.originalParent = target.parentElement;
    this.originalNextSibling = target.nextSibling;

    // Get element dimensions for overlay
    const rect = target.getBoundingClientRect();

    // Add visual feedback
    target.classList.add('__claude-vs-drag-element__');
    document.body.classList.add('__claude-vs-dragging__');

    // Disable text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    // Show drag overlay following the element
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

    console.log('[Element Inspector] DOM Reorder drag started:', target.tagName);
  }

  /**
   * Handle drag move - DOM reorder approach
   */
  private handleDragMove(event: MouseEvent): void {
    if (!this.isDragging || !this.dragElement) {
      return;
    }

    event.preventDefault();

    // Update drag overlay position to follow mouse
    const rect = this.dragElement.getBoundingClientRect();
    if (this.dragOverlay) {
      this.dragOverlay.style.left = `${rect.left}px`;
      this.dragOverlay.style.top = `${rect.top}px`;
    }

    // Find where the element would be dropped
    const { target, position, container } = this.findDropTarget(event.clientX, event.clientY);

    this.dropContainer = container;

    if (container) {
      if (target) {
        // Drop before/after a specific child
        this.dropTarget = target;
        this.dropPosition = position;

        const targetRect = target.getBoundingClientRect();
        const indicatorY = position === 'before' ? targetRect.top : targetRect.bottom;
        this.showDropIndicator(targetRect.left, indicatorY, targetRect.width);
      } else {
        // Drop inside empty container
        this.dropTarget = null;
        this.dropPosition = 'before';

        const containerRect = container.getBoundingClientRect();
        // Show indicator at top of container
        this.showDropIndicator(containerRect.left + 10, containerRect.top + 10, containerRect.width - 20);
      }
    } else {
      this.dropTarget = null;
      this.dropContainer = null;
      this.dropPosition = null;
      this.hideDropIndicator();
    }
  }

  /**
   * Handle drag end - DOM reorder approach
   */
  private handleDragEnd(event: MouseEvent): void {
    if (!this.isDragging || !this.dragElement) {
      return;
    }

    console.log('[Element Inspector] handleDragEnd - dropContainer:', this.dropContainer?.tagName, 'dropTarget:', this.dropTarget?.tagName, 'dropPosition:', this.dropPosition);

    // Perform DOM move if we have a valid drop container
    if (this.dropContainer && this.dropPosition !== null) {
      const elementSelector = this.getCSSSelector(this.dragElement);

      if (this.dropTarget) {
        // Insert before/after a specific element
        const targetSelector = this.getCSSSelector(this.dropTarget);

        if (this.dropPosition === 'before') {
          this.dropTarget.parentElement?.insertBefore(this.dragElement, this.dropTarget);
        } else {
          this.dropTarget.parentElement?.insertBefore(this.dragElement, this.dropTarget.nextSibling);
        }

        console.log('[Element Inspector] DOM Move completed:', elementSelector, this.dropPosition, targetSelector);

        this.sendMessage({
          type: 'element-drag-end',
          data: {
            elementSelector,
            action: 'move',
            targetSelector,
            position: this.dropPosition,
          },
          timestamp: Date.now(),
        });
      } else {
        // Insert into empty container
        const containerSelector = this.getCSSSelector(this.dropContainer);
        this.dropContainer.appendChild(this.dragElement);

        console.log('[Element Inspector] DOM Move completed:', elementSelector, 'into', containerSelector);

        this.sendMessage({
          type: 'element-drag-end',
          data: {
            elementSelector,
            action: 'move-into',
            containerSelector,
          },
          timestamp: Date.now(),
        });
      }
    } else {
      console.log('[Element Inspector] No valid drop container found');
    }

    // Clean up
    this.finishDrag();
  }

  /**
   * Cancel current drag operation - restore element to original DOM position
   */
  private cancelDrag(): void {
    if (!this.isDragging || !this.dragElement) {
      return;
    }

    // Restore to original DOM position
    if (this.originalParent && this.originalNextSibling) {
      this.originalParent.insertBefore(this.dragElement, this.originalNextSibling);
    } else if (this.originalParent) {
      this.originalParent.appendChild(this.dragElement);
    }

    this.finishDrag();
    console.log('[Element Inspector] Drag cancelled - restored to original position');
  }

  /**
   * Clean up after drag operation
   */
  private finishDrag(): void {
    if (this.dragElement) {
      this.dragElement.classList.remove('__claude-vs-drag-element__');
    }
    document.body.classList.remove('__claude-vs-dragging__');

    // Re-enable text selection
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';

    // Hide overlays
    if (this.dragOverlay) {
      this.dragOverlay.style.display = 'none';
    }
    this.hideDropIndicator();

    // Reset state
    this.isDragging = false;
    this.dragElement = null;
    this.dropTarget = null;
    this.dropContainer = null;
    this.dropPosition = null;
    this.originalParent = null;
    this.originalNextSibling = null;
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

    if (this.dragHoverOverlay && this.dragHoverOverlay.parentElement) {
      this.dragHoverOverlay.parentElement.removeChild(this.dragHoverOverlay);
    }

    if (this.dropIndicator && this.dropIndicator.parentElement) {
      this.dropIndicator.parentElement.removeChild(this.dropIndicator);
    }

    // Remove guide containers
    if (this.guidesContainer && this.guidesContainer.parentElement) {
      this.guidesContainer.parentElement.removeChild(this.guidesContainer);
    }

    if (this.distanceContainer && this.distanceContainer.parentElement) {
      this.distanceContainer.parentElement.removeChild(this.distanceContainer);
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
