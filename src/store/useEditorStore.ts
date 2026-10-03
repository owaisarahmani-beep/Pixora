import { create } from 'zustand';

export type FilterType = 'Original' | 'Mono' | 'Vintage' | 'Fade' | 'Cool' | 'Warm';

export type EditState = {
  brightness: number; // -1 to 1
  contrast: number; // 0 to 2
  saturation: number; // 0 to 2
  warmth: number; // -1 to 1
  rotation: number; // 0, 90, 180, 270
  flipX: boolean;
  flipY: boolean;
  filter: FilterType;
  crop?: { originX: number; originY: number; width: number; height: number };
};

const INITIAL_EDIT_STATE: EditState = {
  brightness: 0,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
  filter: 'Original',
  crop: undefined,
};

interface EditorStoreState {
  originalAssetId: string | null;
  originalUri: string | null;
  
  currentState: EditState;
  history: EditState[];
  historyIndex: number;
  
  previewUri: string | null;
  isProcessingPreview: boolean;
  isExporting: boolean;

  initEditor: (id: string, uri: string) => void;
  updateState: (partial: Partial<EditState>) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  
  setPreviewUri: (uri: string) => void;
  setIsProcessingPreview: (val: boolean) => void;
  setIsExporting: (val: boolean) => void;
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  originalAssetId: null,
  originalUri: null,
  
  currentState: { ...INITIAL_EDIT_STATE },
  history: [{ ...INITIAL_EDIT_STATE }],
  historyIndex: 0,
  
  previewUri: null,
  isProcessingPreview: false,
  isExporting: false,

  initEditor: (id: string, uri: string) => {
    set({
      originalAssetId: id,
      originalUri: uri,
      previewUri: uri,
      currentState: { ...INITIAL_EDIT_STATE },
      history: [{ ...INITIAL_EDIT_STATE }],
      historyIndex: 0,
      isProcessingPreview: false,
      isExporting: false,
    });
  },

  updateState: (partial: Partial<EditState>) => {
    const { currentState, history, historyIndex } = get();
    const newState = { ...currentState, ...partial };
    
    // Truncate redo history and add new state
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    
    set({
      currentState: newState,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      set({
        historyIndex: historyIndex - 1,
        currentState: history[historyIndex - 1],
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      set({
        historyIndex: historyIndex + 1,
        currentState: history[historyIndex + 1],
      });
    }
  },

  reset: () => {
    const { history, historyIndex } = get();
    const newState = { ...INITIAL_EDIT_STATE };
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    
    set({
      currentState: newState,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  setPreviewUri: (uri: string) => set({ previewUri: uri }),
  setIsProcessingPreview: (val: boolean) => set({ isProcessingPreview: val }),
  setIsExporting: (val: boolean) => set({ isExporting: val }),
}));
