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
          const { url } = get();
          // Trigger re-render by appending a cache-busting timestamp
          // This forces iframe reload without using setTimeout (avoids memory leaks)
          const separator = url.includes('?') ? '&' : '?';
          const refreshUrl = `${url.split('&_refresh=')[0].split('?_refresh=')[0]}${separator}_refresh=${Date.now()}`;
          set({ url: refreshUrl }, undefined, 'navigation/refresh');
        },

        reset: () => {
          const { serverBaseUrl } = get();
          set({
            ...initialNavigationState,
            url: serverBaseUrl,
            history: [serverBaseUrl],
            serverBaseUrl,
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

// Selection state
interface SelectionState {
  selectionMode: boolean;
  selectedElement: ElementInfo | null;
  hoveredElement: ElementInfo | null;
  setSelectionMode: (mode: boolean) => void;
  setSelectedElement: (element: ElementInfo | null) => void;
  setHoveredElement: (element: ElementInfo | null) => void;
  clearSelection: () => void;
}

const initialSelectionState = {
  selectionMode: false,
  selectedElement: null,
  hoveredElement: null,
};

export const useSelectionStore = create<SelectionState>()(
  devtools(
    (set) => ({
      ...initialSelectionState,

      setSelectionMode: (mode: boolean) => {
        set({ selectionMode: mode }, undefined, 'selection/setSelectionMode');
        if (!mode) {
          set({ selectedElement: null, hoveredElement: null }, undefined, 'selection/clearOnModeOff');
        }
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
