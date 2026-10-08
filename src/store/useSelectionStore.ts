import { create } from 'zustand';

export type SelectionContextType = 'media' | 'album' | null;

interface SelectionState {
  isSelectionMode: boolean;
  selectionContext: SelectionContextType;
  selectedIds: Set<string>;
  availableIds: string[];
  
  // Actions
  enterSelectionMode: (context: 'media' | 'album', initialId?: string, availableIds?: string[]) => void;
  exitSelectionMode: () => void;
  setAvailableIds: (ids: string[]) => void;
  
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectMultiple: (ids: string[], select: boolean) => void;
  
  isSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  isSelectionMode: false,
  selectionContext: null,
  selectedIds: new Set<string>(),
  availableIds: [],

  enterSelectionMode: (context, initialId, availableIds = []) => {
    set({
      isSelectionMode: true,
      selectionContext: context,
      selectedIds: initialId ? new Set([initialId]) : new Set(),
      availableIds: availableIds.length > 0 ? availableIds : get().availableIds,
    });
  },

  setAvailableIds: (ids: string[]) => {
    set({ availableIds: ids });
  },

  exitSelectionMode: () => {
    set({
      isSelectionMode: false,
      selectionContext: null,
      selectedIds: new Set(),
      availableIds: [],
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

  selectAll: () => {
    const { availableIds, isSelectionMode } = get();
    if (!isSelectionMode) return;
    set({ selectedIds: new Set(availableIds) });
  },

  deselectAll: () => {
    set({
      isSelectionMode: false,
      selectionContext: null,
      selectedIds: new Set(),
      availableIds: [],
    });
  },

  selectMultiple: (ids: string[], select: boolean) => {
    set((state) => {
      const newSelected = new Set(state.selectedIds);
      ids.forEach((id) => {
        if (select) {
          newSelected.add(id);
        } else {
          newSelected.delete(id);
        }
      });
      return { selectedIds: newSelected };
    });
  },

  isSelected: (id: string) => {
    return get().selectedIds.has(id);
  }
}));
