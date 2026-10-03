import { useFavoritesStore } from '../../../src/store/useFavoritesStore';

jest.mock('expo-media-library', () => ({}));
jest.mock('expo-media-library/legacy', () => ({
  getAssetInfoAsync: jest.fn().mockResolvedValue({ id: '1', creationTime: Date.now() }),
}));

let mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key, value) => {
    mockStorage[key] = value;
  }),
  getItem: jest.fn((key) => {
    return mockStorage[key] || null;
  }),
  removeItem: jest.fn((key) => {
    delete mockStorage[key];
  }),
}));

describe('useFavoritesStore persistence', () => {
  beforeEach(() => {
    mockStorage = {};
    useFavoritesStore.setState({
      favorites: new Set(),
      favoritesMedia: [],
      groupedFavorites: [],
      isLoading: false,
    });
  });

  it('toggles favorite and persists only string IDs', () => {
    const store = useFavoritesStore.getState();
    expect(store.favorites.size).toBe(0);
    
    // Toggle on with item
    store.toggleFavorite('123', { id: '123', filename: 'A.jpg', creationTime: 1000 } as any);
    
    expect(useFavoritesStore.getState().favorites.has('123')).toBe(true);
    expect(useFavoritesStore.getState().favoritesMedia.length).toBe(1);

    // Verify storage format using JSON snapshot
    const persistedRaw = mockStorage['pixora-favorites-store'];
    expect(persistedRaw).toBeDefined();
    const parsed = JSON.parse(persistedRaw);
    expect(parsed.state.favorites).toEqual(['123']);
    // Verify entire media objects are NOT persisted
    expect(parsed.state.favoritesMedia).toBeUndefined();

    // Toggle off
    useFavoritesStore.getState().toggleFavorite('123');
    expect(useFavoritesStore.getState().favorites.has('123')).toBe(false);
    expect(useFavoritesStore.getState().favoritesMedia.length).toBe(0);
  });
});
