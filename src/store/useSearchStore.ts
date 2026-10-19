import { create } from 'zustand';
import { mediaStoreService } from '../services/media/MediaStoreService';
import { PixoraMediaInfo } from '../services/media/mediaTypes';
import { useMediaStore } from './useMediaStore';

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
    // 1. Instantly seed with already loaded media so search is available immediately
    const existingMedia = useMediaStore.getState().media;
    if (existingMedia.length > 0 && get().indexedMedia.length === 0) {
      set({ indexedMedia: existingMedia });
      get()._updateResults();
    }

    if (get().isIndexing) return;
    set({ isIndexing: true });
    
    try {
      const [allAssets, allAlbums] = await Promise.all([
        mediaStoreService.getAllMediaMetadataAsync(),
        mediaStoreService.getAlbumsAsync()
      ]);
      set({ 
        indexedMedia: allAssets.length > 0 ? allAssets : existingMedia, 
        albums: allAlbums, 
        isIndexing: false 
      });
      get()._updateResults();
    } catch (e) {
      console.error('Failed to index media', e);
      set({ 
        indexedMedia: existingMedia.length > 0 ? existingMedia : get().indexedMedia, 
        isIndexing: false 
      });
      get()._updateResults();
    }
  },

  _updateResults: () => {
    const { indexedMedia, albums, searchQuery, mediaTypeFilter, albumFilter, dateFilter } = get();
    
    if (!searchQuery && mediaTypeFilter === 'all' && !albumFilter && dateFilter === 'all') {
      set({ searchResults: [] });
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Album ID -> Name mapping
    const albumTitleMap = new Map<string, string>();
    albums.forEach((a: any) => {
      if (a.id && a.title) albumTitleMap.set(a.id, a.title.toLowerCase());
    });
    
    const results = indexedMedia.filter(media => {
      // 1. Search Query match across Filename, Month, Year, Album Name, or Media Type
      if (query) {
        const fn = (media.filename || '').toLowerCase();
        const albumName = media.albumId ? (albumTitleMap.get(media.albumId) || '') : '';
        const dateObj = new Date(media.creationTime);
        const monthName = dateObj.toLocaleString('en-US', { month: 'long' }).toLowerCase();
        const shortMonth = dateObj.toLocaleString('en-US', { month: 'short' }).toLowerCase();
        const yearStr = dateObj.getFullYear().toString();
        const typeStr = media.mediaType ? media.mediaType.toLowerCase() : '';

        const matches = 
          fn.includes(query) || 
          albumName.includes(query) || 
          monthName.includes(query) || 
          shortMonth.includes(query) ||
          yearStr.includes(query) ||
          typeStr.includes(query);

        if (!matches) return false;
      }

      // 2. Media type filter
      if (mediaTypeFilter !== 'all' && media.mediaType !== mediaTypeFilter) {
        return false;
      }

      // 3. Album filter
      if (albumFilter && media.albumId !== albumFilter) {
        return false;
      }

      // 4. Date filter
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
