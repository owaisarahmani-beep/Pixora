import { create } from 'zustand';

interface ViewerState {
  isZoomed: boolean;
  setIsZoomed: (zoomed: boolean) => void;
  controlsVisible: boolean;
  toggleControls: () => void;
  detailsVisible: boolean;
  setDetailsVisible: (visible: boolean) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  isZoomed: false,
  setIsZoomed: (zoomed) => set({ isZoomed: zoomed }),
  controlsVisible: true,
  toggleControls: () => set((state) => ({ controlsVisible: !state.controlsVisible })),
  detailsVisible: false,
  setDetailsVisible: (visible) => set({ detailsVisible: visible }),
}));
