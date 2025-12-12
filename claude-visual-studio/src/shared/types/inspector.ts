/**
 * Shared type definitions for the Element Inspector
 */

export interface ElementInfo {
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

export interface InspectorMessage {
  source: 'claude-vs-inspector';
  type: 'element-hover' | 'element-select' | 'inspector-ready' | 'selection-mode-changed';
  data?: ElementInfo | boolean;
  timestamp: number;
}

export interface InspectorAPI {
  setSelectionMode: (enabled: boolean) => void;
  getSelectedElement: () => ElementInfo | null;
  isSelectionMode: () => boolean;
}

declare global {
  interface Window {
    __claudeVSInspector__?: InspectorAPI;
    __CLAUDE_VS_HMR_PORT__?: number;
  }
}
