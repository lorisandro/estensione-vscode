import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { WebviewElementInfo } from '../../shared/types/webview';

// Default server URL - can be overridden via configuration
const DEFAULT_SERVER_URL = 'http://localhost:3333';

// Navigation state
interface NavigationState {
  url: string;
  history: string[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  serverBaseUrl: string;
  refreshKey: number;
  setUrl: (url: string) => void;
  setServerBaseUrl: (baseUrl: string) => void;
  navigateTo: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  refresh: () => void;
  reset: () => void;
}

const initialNavigationState = {
  url: DEFAULT_SERVER_URL,
  history: [DEFAULT_SERVER_URL],
  historyIndex: 0,
  canGoBack: false,
  canGoForward: false,
  serverBaseUrl: DEFAULT_SERVER_URL,
  refreshKey: 0,
};

export const useNavigationStore = create<NavigationState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialNavigationState,

        setUrl: (url: string) => {
          set({ url }, undefined, 'navigation/setUrl');
        },

        setServerBaseUrl: (baseUrl: string) => {
          set({ serverBaseUrl: baseUrl }, undefined, 'navigation/setServerBaseUrl');
        },

        navigateTo: (url: string) => {
          const { history, historyIndex } = get();
          const newHistory = [...history.slice(0, historyIndex + 1), url];
          set({
            url,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            canGoBack: newHistory.length > 1,
            canGoForward: false,
          }, undefined, 'navigation/navigateTo');
        },

        goBack: () => {
          const { history, historyIndex } = get();
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            set({
              url: history[newIndex],
              historyIndex: newIndex,
              canGoBack: newIndex > 0,
              canGoForward: true,
            }, undefined, 'navigation/goBack');
          }
        },

        goForward: () => {
          const { history, historyIndex } = get();
          if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            set({
              url: history[newIndex],
              historyIndex: newIndex,
              canGoBack: true,
              canGoForward: newIndex < history.length - 1,
            }, undefined, 'navigation/goForward');
          }
        },

        refresh: () => {
          const { refreshKey } = get();
          // Increment refresh key to force iframe remount without modifying URL
          set({ refreshKey: refreshKey + 1 }, undefined, 'navigation/refresh');
        },

        reset: () => {
          const { serverBaseUrl } = get();
          set({
            ...initialNavigationState,
            url: serverBaseUrl,
            history: [serverBaseUrl],
            serverBaseUrl,
            refreshKey: 0,
          }, undefined, 'navigation/reset');
        },
      }),
      {
        name: 'claude-vs-navigation',
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          url: state.url,
          history: state.history,
          historyIndex: state.historyIndex,
          serverBaseUrl: state.serverBaseUrl,
        }),
        // Per Zustand best practices: handle hydration state
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.warn('[NavigationStore] Hydration failed:', error);
          } else if (state) {
            // Recalculate canGoBack/canGoForward after hydration
            console.debug('[NavigationStore] Hydration completed');
          }
        },
      }
    ),
    { name: 'NavigationStore' }
  )
);

// Re-export element info type for convenience
export type ElementInfo = WebviewElementInfo;

// Screenshot area selection state
export interface ScreenshotArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Drag change represents a single drag operation for undo (DOM reordering)
export interface DragChange {
  id: string;
  elementSelector: string;
  // DOM reorder fields
  originalParentSelector?: string | null;
  originalNextSiblingSelector?: string | null;
  action?: 'move' | 'move-into';
  targetSelector?: string;
  containerSelector?: string;
  position?: 'before' | 'after';
  // Legacy CSS positioning (kept for compatibility)
  originalPosition?: { x: number; y: number };
  newPosition?: { x: number; y: number };
  timestamp: number;
}

// Selection state
interface SelectionState {
  selectionMode: boolean;
  screenshotMode: boolean;
  screenshotArea: ScreenshotArea | null;
  selectedElement: ElementInfo | null;
  hoveredElement: ElementInfo | null;
  // Drag mode state
  dragChanges: DragChange[];
  hasPendingChanges: boolean;
  setSelectionMode: (mode: boolean) => void;
  setScreenshotMode: (mode: boolean) => void;
  setScreenshotArea: (area: ScreenshotArea | null) => void;
  setSelectedElement: (element: ElementInfo | null) => void;
  setHoveredElement: (element: ElementInfo | null) => void;
  clearSelection: () => void;
  // Drag mode actions
  addDragChange: (change: Omit<DragChange, 'id' | 'timestamp'>) => void;
  undoLastChange: () => DragChange | null;
  applyChanges: () => void;
  clearDragChanges: () => void;
}

const initialSelectionState = {
  selectionMode: false,
  screenshotMode: false,
  screenshotArea: null,
  selectedElement: null,
  hoveredElement: null,
  dragChanges: [] as DragChange[],
  hasPendingChanges: false,
};

// Generate unique IDs for drag changes
const generateDragChangeId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `drag-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const useSelectionStore = create<SelectionState>()(
  devtools(
    (set, get) => ({
      ...initialSelectionState,

      setSelectionMode: (mode: boolean) => {
        set({ selectionMode: mode }, undefined, 'selection/setSelectionMode');
        if (!mode) {
          set({ selectedElement: null, hoveredElement: null }, undefined, 'selection/clearOnModeOff');
        }
      },

      setScreenshotMode: (mode: boolean) => {
        set({ screenshotMode: mode, screenshotArea: null }, undefined, 'selection/setScreenshotMode');
        // Disable selection mode when entering screenshot mode
        if (mode) {
          set({ selectionMode: false }, undefined, 'selection/disableSelectionForScreenshot');
        }
      },

      setScreenshotArea: (area: ScreenshotArea | null) => {
        set({ screenshotArea: area }, undefined, 'selection/setScreenshotArea');
      },

      setSelectedElement: (element: ElementInfo | null) => {
        set({ selectedElement: element }, undefined, 'selection/setSelectedElement');
      },

      setHoveredElement: (element: ElementInfo | null) => {
        set({ hoveredElement: element }, undefined, 'selection/setHoveredElement');
      },

      clearSelection: () => {
        set({ selectedElement: null, hoveredElement: null }, undefined, 'selection/clearSelection');
      },

      // Drag mode actions
      addDragChange: (change: Omit<DragChange, 'id' | 'timestamp'>) => {
        const newChange: DragChange = {
          ...change,
          id: generateDragChangeId(),
          timestamp: Date.now(),
        };
        set((state) => ({
          dragChanges: [...state.dragChanges, newChange],
          hasPendingChanges: true,
        }), undefined, 'selection/addDragChange');
      },

      undoLastChange: () => {
        const { dragChanges } = get();
        if (dragChanges.length === 0) return null;

        const lastChange = dragChanges[dragChanges.length - 1];
        set((state) => ({
          dragChanges: state.dragChanges.slice(0, -1),
          hasPendingChanges: state.dragChanges.length > 1,
        }), undefined, 'selection/undoLastChange');

        return lastChange;
      },

      applyChanges: () => {
        // Clear pending changes after applying
        set({
          dragChanges: [],
          hasPendingChanges: false,
        }, undefined, 'selection/applyChanges');
      },

      clearDragChanges: () => {
        set({
          dragChanges: [],
          hasPendingChanges: false,
        }, undefined, 'selection/clearDragChanges');
      },
    }),
    { name: 'SelectionStore' }
  )
);

// Console log entry type
export interface ConsoleLogEntry {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: number;
}

// Viewport preset for responsive design
export interface ViewportPreset {
  name: string;
  width: number;
  height: number;
  icon?: string;
}

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { name: 'Responsive', width: 0, height: 0, icon: 'responsive' },
  { name: 'iPhone SE', width: 375, height: 667, icon: 'mobile' },
  { name: 'iPhone 14', width: 390, height: 844, icon: 'mobile' },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932, icon: 'mobile' },
  { name: 'Pixel 7', width: 412, height: 915, icon: 'mobile' },
  { name: 'Samsung Galaxy S21', width: 360, height: 800, icon: 'mobile' },
  { name: 'iPad Mini', width: 768, height: 1024, icon: 'tablet' },
  { name: 'iPad Pro 11"', width: 834, height: 1194, icon: 'tablet' },
  { name: 'iPad Pro 12.9"', width: 1024, height: 1366, icon: 'tablet' },
  { name: 'Surface Pro', width: 912, height: 1368, icon: 'tablet' },
  { name: 'Laptop', width: 1366, height: 768, icon: 'laptop' },
  { name: 'Desktop', width: 1920, height: 1080, icon: 'desktop' },
  { name: '4K', width: 3840, height: 2160, icon: 'desktop' },
];

// Editor state
interface EditorState {
  isLoading: boolean;
  error: string | null;
  inspectorWidth: number;
  consoleVisible: boolean;
  consoleHeight: number;
  consoleLogs: ConsoleLogEntry[];
  cssInspectorVisible: boolean;
  cssInspectorWidth: number;
  // Responsive viewport state
  viewportWidth: number;
  viewportHeight: number;
  viewportPreset: string;
  viewportRotated: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInspectorWidth: (width: number) => void;
  setConsoleVisible: (visible: boolean) => void;
  toggleConsole: () => void;
  setConsoleHeight: (height: number) => void;
  addConsoleLog: (log: Omit<ConsoleLogEntry, 'id' | 'timestamp'>) => void;
  clearConsoleLogs: () => void;
  setCssInspectorVisible: (visible: boolean) => void;
  toggleCssInspector: () => void;
  setCssInspectorWidth: (width: number) => void;
  clearError: () => void;
  // Responsive viewport actions
  setViewportSize: (width: number, height: number) => void;
  setViewportPreset: (preset: string) => void;
  toggleViewportRotation: () => void;
  resetViewport: () => void;
}

const initialEditorState = {
  isLoading: false,
  error: null,
  inspectorWidth: 300,
  consoleVisible: false,
  consoleHeight: 150,
  consoleLogs: [] as ConsoleLogEntry[],
  cssInspectorVisible: false,
  cssInspectorWidth: 280,
  // Responsive viewport (0 = auto/responsive)
  viewportWidth: 0,
  viewportHeight: 0,
  viewportPreset: 'Responsive',
  viewportRotated: false,
};

// Generate unique IDs using crypto.randomUUID() for better uniqueness
const generateLogId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const useEditorStore = create<EditorState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialEditorState,

        setLoading: (loading: boolean) => {
          set({ isLoading: loading }, undefined, 'editor/setLoading');
        },

        setError: (error: string | null) => {
          set({ error }, undefined, 'editor/setError');
        },

        setInspectorWidth: (width: number) => {
          set({ inspectorWidth: Math.max(200, Math.min(600, width)) }, undefined, 'editor/setInspectorWidth');
        },

        setConsoleVisible: (visible: boolean) => {
          set({ consoleVisible: visible }, undefined, 'editor/setConsoleVisible');
        },

        toggleConsole: () => {
          set({ consoleVisible: !get().consoleVisible }, undefined, 'editor/toggleConsole');
        },

        setConsoleHeight: (height: number) => {
          set({ consoleHeight: Math.max(80, Math.min(400, height)) }, undefined, 'editor/setConsoleHeight');
        },

        addConsoleLog: (log: Omit<ConsoleLogEntry, 'id' | 'timestamp'>) => {
          const newLog: ConsoleLogEntry = {
            ...log,
            id: generateLogId(),
            timestamp: Date.now(),
          };
          set((state) => ({
            consoleLogs: [...state.consoleLogs.slice(-99), newLog], // Keep last 100 logs
          }), undefined, 'editor/addConsoleLog');
        },

        clearConsoleLogs: () => {
          set({ consoleLogs: [] }, undefined, 'editor/clearConsoleLogs');
        },

        setCssInspectorVisible: (visible: boolean) => {
          set({ cssInspectorVisible: visible }, undefined, 'editor/setCssInspectorVisible');
        },

        toggleCssInspector: () => {
          set({ cssInspectorVisible: !get().cssInspectorVisible }, undefined, 'editor/toggleCssInspector');
        },

        setCssInspectorWidth: (width: number) => {
          set({ cssInspectorWidth: Math.max(200, Math.min(500, width)) }, undefined, 'editor/setCssInspectorWidth');
        },

        clearError: () => {
          set({ error: null }, undefined, 'editor/clearError');
        },

        // Responsive viewport actions
        setViewportSize: (width: number, height: number) => {
          set({
            viewportWidth: width,
            viewportHeight: height,
            viewportPreset: 'Custom',
          }, undefined, 'editor/setViewportSize');
        },

        setViewportPreset: (preset: string) => {
          const presetData = VIEWPORT_PRESETS.find(p => p.name === preset);
          if (presetData) {
            const { viewportRotated } = get();
            set({
              viewportPreset: preset,
              viewportWidth: viewportRotated ? presetData.height : presetData.width,
              viewportHeight: viewportRotated ? presetData.width : presetData.height,
            }, undefined, 'editor/setViewportPreset');
          }
        },

        toggleViewportRotation: () => {
          const { viewportWidth, viewportHeight, viewportRotated } = get();
          set({
            viewportWidth: viewportHeight,
            viewportHeight: viewportWidth,
            viewportRotated: !viewportRotated,
          }, undefined, 'editor/toggleViewportRotation');
        },

        resetViewport: () => {
          set({
            viewportWidth: 0,
            viewportHeight: 0,
            viewportPreset: 'Responsive',
            viewportRotated: false,
          }, undefined, 'editor/resetViewport');
        },
      }),
      {
        name: 'claude-vs-editor',
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          inspectorWidth: state.inspectorWidth,
          consoleVisible: state.consoleVisible,
          consoleHeight: state.consoleHeight,
          cssInspectorVisible: state.cssInspectorVisible,
          cssInspectorWidth: state.cssInspectorWidth,
          viewportWidth: state.viewportWidth,
          viewportHeight: state.viewportHeight,
          viewportPreset: state.viewportPreset,
          viewportRotated: state.viewportRotated,
        }),
        // Per Zustand best practices: handle hydration state
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.warn('[EditorStore] Hydration failed:', error);
          } else if (state) {
            console.debug('[EditorStore] Hydration completed');
          }
        },
      }
    ),
    { name: 'EditorStore' }
  )
);
