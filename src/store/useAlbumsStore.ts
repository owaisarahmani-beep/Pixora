import { create } from 'zustand';
import { mediaStoreService } from '../services/media/MediaStoreService';
import * as MediaLibrary from 'expo-media-library/legacy';
import { PixoraMediaInfo, MediaGroup } from '../services/media/mediaTypes';
import { groupMediaByDate } from '../utils/dateGrouping';

interface AlbumsState {
  albums: MediaLibrary.Album[];
  albumCovers: Record<string, string | null>;
  isLoadingAlbums: boolean;
  
  activeAlbumMedia: PixoraMediaInfo[];
  activeAlbumGrouped: MediaGroup[];
  activeAlbumId: string | null;
  isLoadingMedia: boolean;
  hasNextPage: boolean;
  endCursor: string | undefined;

  loadAlbums: () => Promise<void>;
  openAlbum: (albumId: string) => Promise<void>;
  loadMoreAlbumMedia: () => Promise<void>;
}

export const useAlbumsStore = create<AlbumsState>((set, get) => ({
  albums: [],
  albumCovers: {},
  isLoadingAlbums: false,

  activeAlbumMedia: [],
  activeAlbumGrouped: [],
  activeAlbumId: null,
  isLoadingMedia: false,
  hasNextPage: true,
  endCursor: undefined,

  loadAlbums: async () => {
    if (get().albums.length > 0 || get().isLoadingAlbums) return;
    set({ isLoadingAlbums: true });
    try {
      const albums = await mediaStoreService.getAlbumsAsync();
      set({ albums, isLoadingAlbums: false });

      // Load covers lazily
      const covers: Record<string, string | null> = {};
      await Promise.all(
        albums.map(async (album) => {
          if (album.assetCount === 0) return;
          const cover = await mediaStoreService.getAlbumCoverAsync(album.id);
          if (cover) {
            covers[album.id] = cover;
          }
        })
      );
      
      set((state) => ({ 
        albumCovers: { ...state.albumCovers, ...covers } 
      }));
    } catch (error) {
      console.error('Failed to load albums', error);
      set({ isLoadingAlbums: false });
    }
  },

  openAlbum: async (albumId: string) => {
    set({ 
      activeAlbumId: albumId, 
      activeAlbumMedia: [], 
      activeAlbumGrouped: [], 
      isLoadingMedia: true,
      hasNextPage: true,
      endCursor: undefined,
    });
    
    try {
      const { assets, hasNextPage, endCursor } = await mediaStoreService.getAlbumAssetsAsync(albumId);

      set({
        activeAlbumMedia: assets,
        activeAlbumGrouped: groupMediaByDate(assets),
        hasNextPage,
        endCursor,
        isLoadingMedia: false,
      });
    } catch (e) {
      console.error('Failed to open album', e);
      set({ isLoadingMedia: false });
    }
  },

  loadMoreAlbumMedia: async () => {
    const { activeAlbumId, hasNextPage, endCursor, activeAlbumMedia, isLoadingMedia } = get();
    if (!activeAlbumId || !hasNextPage || isLoadingMedia) return;

    set({ isLoadingMedia: true });
    try {
      const result = await mediaStoreService.getAlbumAssetsAsync(activeAlbumId, endCursor);
      const newMedia = [...activeAlbumMedia, ...result.assets];

      set({
        activeAlbumMedia: newMedia,
        activeAlbumGrouped: groupMediaByDate(newMedia),
        hasNextPage: result.hasNextPage,
        endCursor: result.endCursor,
        isLoadingMedia: false,
      });
    } catch (e) {
      console.error('Failed to load more album media', e);
      set({ isLoadingMedia: false });
    }
  }
}));
