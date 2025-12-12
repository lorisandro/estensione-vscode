import { create } from 'zustand';
import type { WebviewElementInfo } from '../../shared/types/webview';

// Navigation state
interface NavigationState {
  url: string;
  history: string[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  setUrl: (url: string) => void;
  navigateTo: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  refresh: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  url: 'http://localhost:3333',
  history: ['http://localhost:3333'],
  historyIndex: 0,
  canGoBack: false,
  canGoForward: false,

  setUrl: (url: string) => {
    set({ url });
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
    set({ url: url + '?t=' + Date.now() });
  },
}));

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

export const useSelectionStore = create<SelectionState>((set) => ({
  selectionMode: false,
  selectedElement: null,
  hoveredElement: null,

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
}));

// Editor state
interface EditorState {
  isLoading: boolean;
  error: string | null;
  inspectorWidth: number;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInspectorWidth: (width: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  isLoading: false,
  error: null,
  inspectorWidth: 300,

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setInspectorWidth: (width: number) => {
    set({ inspectorWidth: Math.max(200, Math.min(600, width)) });
  },
}));
