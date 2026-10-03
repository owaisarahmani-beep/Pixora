import { create } from 'zustand';
import { mediaStoreService } from '../services/media/MediaStoreService';
import { PixoraMediaInfo } from '../services/media/mediaTypes';

interface SearchState {
  isIndexing: boolean;
  indexedMedia: PixoraMediaInfo[];
  albums: any[];
  searchQuery: string;
  mediaTypeFilter: 'all' | 'photo' | 'video';
  albumFilter: string | null;
  dateFilter: 'all' | 'today' | 'month' | 'year';
  searchResults: PixoraMediaInfo[];
  
  setSearchQuery: (query: string) => void;
  setMediaTypeFilter: (type: 'all' | 'photo' | 'video') => void;
  setAlbumFilter: (albumId: string | null) => void;
  setDateFilter: (date: 'all' | 'today' | 'month' | 'year') => void;
  buildIndex: () => Promise<void>;
  _updateResults: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  isIndexing: false,
  indexedMedia: [],
  albums: [],
  searchQuery: '',
  mediaTypeFilter: 'all',
  albumFilter: null,
  dateFilter: 'all',

  searchResults: [],

  setSearchQuery: (query) => { set({ searchQuery: query }); get()._updateResults(); },
  setMediaTypeFilter: (type) => { set({ mediaTypeFilter: type }); get()._updateResults(); },
  setAlbumFilter: (albumId) => { set({ albumFilter: albumId }); get()._updateResults(); },
  setDateFilter: (date) => { set({ dateFilter: date }); get()._updateResults(); },

  buildIndex: async () => {
    if (get().isIndexing || get().indexedMedia.length > 0) return;
    set({ isIndexing: true });
    
    try {
      const [allAssets, allAlbums] = await Promise.all([
        mediaStoreService.getAllMediaMetadataAsync(),
        mediaStoreService.getAlbumsAsync()
      ]);
      set({ indexedMedia: allAssets, albums: allAlbums, isIndexing: false });
      get()._updateResults();
    } catch (e) {
      console.error('Failed to index media', e);
      set({ isIndexing: false });
    }
  },

  _updateResults: () => {
    const { indexedMedia, searchQuery, mediaTypeFilter, albumFilter, dateFilter } = get();
    
    if (!searchQuery && mediaTypeFilter === 'all' && !albumFilter && dateFilter === 'all') {
      set({ searchResults: [] });
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    const results = indexedMedia.filter(media => {
      // Filename search
      if (query && !media.filename.toLowerCase().includes(query)) {
        return false;
      }
      // Media type filter
      if (mediaTypeFilter !== 'all' && media.mediaType !== mediaTypeFilter) {
        return false;
      }
      // Album filter
      if (albumFilter && media.albumId !== albumFilter) {
        return false;
      }
      // Date filter
      if (dateFilter !== 'all') {
        const diff = now - media.creationTime;
        if (dateFilter === 'today' && diff > day) return false;
        if (dateFilter === 'month' && diff > day * 30) return false;
        if (dateFilter === 'year' && diff > day * 365) return false;
      }
      return true;
    });

    set({ searchResults: results });
  },
}));
