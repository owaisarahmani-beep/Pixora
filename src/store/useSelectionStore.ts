import { create } from 'zustand';

export type SelectionContextType = 'media' | 'album' | null;

interface SelectionState {
  isSelectionMode: boolean;
  selectionContext: SelectionContextType;
  selectedIds: Set<string>;
  
  // Actions
  enterSelectionMode: (context: 'media' | 'album', initialId?: string) => void;
  exitSelectionMode: () => void;
  
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  
  isSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  isSelectionMode: false,
  selectionContext: null,
  selectedIds: new Set<string>(),

  enterSelectionMode: (context, initialId) => {
    set({
      isSelectionMode: true,
      selectionContext: context,
      selectedIds: initialId ? new Set([initialId]) : new Set(),
    });
  },

  exitSelectionMode: () => {
    set({
      isSelectionMode: false,
      selectionContext: null,
      selectedIds: new Set(),
    });
  },

  toggleSelection: (id: string) => {
    const state = get();
    if (!state.isSelectionMode) return;
    
    const newSelectedIds = new Set(state.selectedIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    
    // Auto-exit if empty
    if (newSelectedIds.size === 0) {
      set({
        isSelectionMode: false,
        selectionContext: null,
        selectedIds: new Set(),
      });
    } else {
      set({ selectedIds: newSelectedIds });
    }
  },

  selectAll: (ids: string[]) => {
    if (!get().isSelectionMode) return;
    const newSet = new Set(get().selectedIds);
    ids.forEach(id => newSet.add(id));
    set({ selectedIds: newSet });
  },

  deselectAll: () => {
    set({
      isSelectionMode: false,
      selectionContext: null,
      selectedIds: new Set(),
    });
  },

  isSelected: (id: string) => {
    return get().selectedIds.has(id);
  }
}));
