import { filterHiddenMedia, filterHiddenAlbums } from '../../../src/hooks/useVisibleMedia';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Visibility Filters', () => {
  it('filters out media from hidden albums', () => {
    const mockMedia: any[] = [
      { id: '1', albumId: 'public-1' },
      { id: '2', albumId: 'hidden-1' },
      { id: '3', albumId: null },
    ];
    
    const result = filterHiddenMedia(mockMedia, ['hidden-1'], []);
    
    expect(result.length).toBe(2);
    expect(result.map(m => m.id)).toEqual(['1', '3']);
  });

  it('filters out hidden albums', () => {
    const mockAlbums: any[] = [
      { id: 'public-1', title: 'Public' },
      { id: 'hidden-1', title: 'Hidden' },
    ];
    
    const result = filterHiddenAlbums(mockAlbums, ['hidden-1']);
    
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('public-1');
  });

  it('preserves array reference if there are no hidden albums or assets', () => {
    const mockMedia: any[] = [
      { id: '1', albumId: 'public-1' },
    ];
    
    const result = filterHiddenMedia(mockMedia, [], []);
    
    expect(result).toBe(mockMedia);
  });

  it('filters out individually hidden assets', () => {
    const mockMedia: any[] = [
      { id: '1', albumId: 'public-1' },
      { id: '2', albumId: 'public-1' },
      { id: '3', albumId: null },
    ];
    
    const result = filterHiddenMedia(mockMedia, [], ['2']);
    
    expect(result.length).toBe(2);
    expect(result.map(m => m.id)).toEqual(['1', '3']);
  });
});
