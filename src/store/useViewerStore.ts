import { create } from 'zustand';

interface ViewerState {
  isZoomed: boolean;
  setIsZoomed: (zoomed: boolean) => void;
  controlsVisible: boolean;
  setControlsVisible: (visible: boolean) => void;
  toggleControls: () => void;
  detailsVisible: boolean;
  setDetailsVisible: (visible: boolean) => void;
  isSeeking: boolean;
  setIsSeeking: (seeking: boolean) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  isZoomed: false,
  setIsZoomed: (zoomed) => set({ isZoomed: zoomed }),
  controlsVisible: true,
  setControlsVisible: (visible) => set({ controlsVisible: visible }),
  toggleControls: () => set((state) => ({ controlsVisible: !state.controlsVisible })),
  detailsVisible: false,
  setDetailsVisible: (visible) => set({ detailsVisible: visible }),
  isSeeking: false,
  setIsSeeking: (seeking) => set({ isSeeking: seeking }),
}));
