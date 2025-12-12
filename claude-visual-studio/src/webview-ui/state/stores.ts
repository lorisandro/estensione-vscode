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
          set({ url });
        },

        setServerBaseUrl: (baseUrl: string) => {
          set({ serverBaseUrl: baseUrl });
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
          });
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
            });
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
            });
          }
        },

        refresh: () => {
          const { url } = get();
          // Trigger re-render by setting url to empty then back
          // This forces iframe reload without modifying the URL
          set({ url: '' });
          setTimeout(() => set({ url }), 0);
        },

        reset: () => {
          const { serverBaseUrl } = get();
          set({
            ...initialNavigationState,
            url: serverBaseUrl,
            history: [serverBaseUrl],
            serverBaseUrl,
          });
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
        set({ selectionMode: mode });
        if (!mode) {
          set({ selectedElement: null, hoveredElement: null });
        }
      },

      setSelectedElement: (element: ElementInfo | null) => {
        set({ selectedElement: element });
      },

      setHoveredElement: (element: ElementInfo | null) => {
        set({ hoveredElement: element });
      },

      clearSelection: () => {
        set({ selectedElement: null, hoveredElement: null });
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

let logIdCounter = 0;

export const useEditorStore = create<EditorState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialEditorState,

        setLoading: (loading: boolean) => {
          set({ isLoading: loading });
        },

        setError: (error: string | null) => {
          set({ error });
        },

        setInspectorWidth: (width: number) => {
          set({ inspectorWidth: Math.max(200, Math.min(600, width)) });
        },

        setConsoleVisible: (visible: boolean) => {
          set({ consoleVisible: visible });
        },

        toggleConsole: () => {
          set({ consoleVisible: !get().consoleVisible });
        },

        setConsoleHeight: (height: number) => {
          set({ consoleHeight: Math.max(80, Math.min(400, height)) });
        },

        addConsoleLog: (log: Omit<ConsoleLogEntry, 'id' | 'timestamp'>) => {
          const newLog: ConsoleLogEntry = {
            ...log,
            id: `log-${++logIdCounter}`,
            timestamp: Date.now(),
          };
          set((state) => ({
            consoleLogs: [...state.consoleLogs.slice(-99), newLog], // Keep last 100 logs
          }));
        },

        clearConsoleLogs: () => {
          set({ consoleLogs: [] });
        },

        setCssInspectorVisible: (visible: boolean) => {
          set({ cssInspectorVisible: visible });
        },

        toggleCssInspector: () => {
          set({ cssInspectorVisible: !get().cssInspectorVisible });
        },

        setCssInspectorWidth: (width: number) => {
          set({ cssInspectorWidth: Math.max(200, Math.min(500, width)) });
        },

        clearError: () => {
          set({ error: null });
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
      }
    ),
    { name: 'EditorStore' }
  )
);
