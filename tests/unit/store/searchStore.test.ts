import { useSearchStore } from '../../../src/store/useSearchStore';

jest.mock('expo-media-library', () => ({}));
jest.mock('expo-media-library/legacy', () => ({}));

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({
      indexedMedia: [
        { id: '1', filename: 'IMG_2023.jpg', mediaType: 'photo', albumId: 'a1', creationTime: Date.now() },
        { id: '2', filename: 'VID_2023.mp4', mediaType: 'video', albumId: 'a2', creationTime: Date.now() - 86400000 * 2 }, // 2 days ago
      ] as any,
      searchQuery: '',
      mediaTypeFilter: 'all',
      albumFilter: null,
      dateFilter: 'all',
    });
  });

  it('filters by filename', () => {
    useSearchStore.getState().setSearchQuery('img');
    const results = useSearchStore.getState().searchResults;
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('1');
  });

  it('filters by media type', () => {
    useSearchStore.getState().setMediaTypeFilter('video');
    const results = useSearchStore.getState().searchResults;
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('2');
  });

  it('filters by date (today)', () => {
    useSearchStore.getState().setDateFilter('today');
    const results = useSearchStore.getState().searchResults;
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('1'); // Only the first one is today
  });

  it('filters by album', () => {
    useSearchStore.getState().setAlbumFilter('a2');
    const results = useSearchStore.getState().searchResults;
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('2');
  });

  it('returns empty when no filters active', () => {
    useSearchStore.getState().setSearchQuery('');
    const results = useSearchStore.getState().searchResults;
    expect(results.length).toBe(0);
  });
});
