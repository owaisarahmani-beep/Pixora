import { useAlbumsStore } from '../../../src/store/useAlbumsStore';

jest.mock('expo-media-library', () => ({}));
jest.mock('expo-media-library/legacy', () => ({}));

describe('useAlbumsStore', () => {
  beforeEach(() => {
    useAlbumsStore.setState({
      albums: [],
      activeAlbumMedia: [],
      activeAlbumId: null,
      isLoadingAlbums: false,
    });
  });

  it('initializes correctly', () => {
    const state = useAlbumsStore.getState();
    expect(state.albums.length).toBe(0);
    expect(state.activeAlbumMedia.length).toBe(0);
    expect(state.activeAlbumId).toBeNull();
  });
});
