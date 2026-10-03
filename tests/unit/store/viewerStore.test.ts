import { useViewerStore } from '../../../src/store/useViewerStore';

describe('useViewerStore', () => {
  beforeEach(() => {
    useViewerStore.setState({ isZoomed: false, controlsVisible: true, detailsVisible: false });
  });

  it('toggles controls visibility', () => {
    const store = useViewerStore.getState();
    expect(store.controlsVisible).toBe(true);

    store.toggleControls();
    expect(useViewerStore.getState().controlsVisible).toBe(false);
  });

  it('updates zoomed state', () => {
    const store = useViewerStore.getState();
    expect(store.isZoomed).toBe(false);

    store.setIsZoomed(true);
    expect(useViewerStore.getState().isZoomed).toBe(true);
  });

  it('updates details modal visibility', () => {
    const store = useViewerStore.getState();
    expect(store.detailsVisible).toBe(false);

    store.setDetailsVisible(true);
    expect(useViewerStore.getState().detailsVisible).toBe(true);
  });
});
