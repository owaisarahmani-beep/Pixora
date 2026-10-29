import { create } from 'zustand';

export type SelectionContextType = 'media' | 'album' | null;

interface SelectionState {
  isSelectionMode: boolean;
  selectionContext: SelectionContextType;
  selectedIds: Set<string>;
  availableIds: string[];
  scopeId: string | null;
  
  // Actions
  enterSelectionMode: (context: 'media' | 'album', initialId?: string, availableIds?: string[], scopeId?: string | null) => void;
  exitSelectionMode: () => void;
  setAvailableIds: (ids: string[]) => void;
  clearIfScopeMismatch: (currentScopeId: string | null) => void;
  
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectMultiple: (ids: string[], select: boolean) => void;
  setSelectedIds: (ids: Set<string>) => void;
  
  isSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  isSelectionMode: false,
  selectionContext: null,
  selectedIds: new Set<string>(),
  availableIds: [],
  scopeId: null,

  enterSelectionMode: (context, initialId, availableIds = [], scopeId = null) => {
    set({
      isSelectionMode: true,
      selectionContext: context,
      selectedIds: initialId ? new Set([initialId]) : new Set(),
      availableIds: availableIds.length > 0 ? availableIds : get().availableIds,
      scopeId: scopeId ?? null,
    });
  },

  setAvailableIds: (ids: string[]) => {
    const current = get().availableIds;
    if (current.length === ids.length) {
      let identical = true;
      for (let i = 0; i < ids.length; i++) {
        if (current[i] !== ids[i]) {
          identical = false;
          break;
        }
      }
      if (identical) return;
    }
    set({ availableIds: ids });
  },

  clearIfScopeMismatch: (currentScopeId: string | null) => {
    const state = get();
    if (state.isSelectionMode && state.scopeId && state.scopeId !== currentScopeId) {
      set({
        isSelectionMode: false,
        selectionContext: null,
        selectedIds: new Set(),
        availableIds: [],
        scopeId: null,
      });
    }
  },

  exitSelectionMode: () => {
    set({
      isSelectionMode: false,
      selectionContext: null,
      selectedIds: new Set(),
      availableIds: [],
      scopeId: null,
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
        availableIds: [],
        scopeId: null,
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
      scopeId: null,
    });
  },

  setSelectedIds: (ids: Set<string>) => {
    if (ids.size === 0) {
      set({
        isSelectionMode: false,
        selectionContext: null,
        selectedIds: new Set(),
        availableIds: [],
        scopeId: null,
      });
    } else {
      set({ selectedIds: ids });
    }
  },

  selectMultiple: (ids: string[], select: boolean) => {
    set((state) => {
      const newSelected = new Set(state.selectedIds);
      let changed = false;
      ids.forEach((id) => {
        if (select) {
          if (!newSelected.has(id)) {
            newSelected.add(id);
            changed = true;
          }
        } else {
          if (newSelected.has(id)) {
            newSelected.delete(id);
            changed = true;
          }
        }
      });
      if (!changed) return state;
      return { selectedIds: newSelected };
    });
  },

  isSelected: (id: string) => {
    return get().selectedIds.has(id);
  }
}));
