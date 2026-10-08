import { create } from 'zustand';
import { mediaStoreService } from '../services/media/MediaStoreService';
import { PixoraMediaInfo, MediaGroup, MediaPermissionStatus } from '../services/media/mediaTypes';
import { groupMediaByDate } from '../utils/dateGrouping';

interface MediaState {
  permissionStatus: MediaPermissionStatus;
  media: PixoraMediaInfo[];
  groupedMedia: MediaGroup[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasNextPage: boolean;
  endCursor: string | undefined;

  checkPermissions: () => Promise<void>;
  requestPermissions: () => Promise<void>;
  loadInitialMedia: () => Promise<void>;
  loadMoreMedia: () => Promise<void>;
  refreshMedia: () => Promise<void>;
  deleteMediaAsync: (id: string) => Promise<boolean>;
  permanentDeleteAsync: (id: string) => Promise<boolean>;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  permissionStatus: 'UNDETERMINED',
  media: [],
  groupedMedia: [],
  isLoading: false,
  isRefreshing: false,
  hasNextPage: true,
  endCursor: undefined,

  checkPermissions: async () => {
    const status = await mediaStoreService.getPermissionsAsync();
    set({ permissionStatus: status });
    if (status === 'GRANTED' || status === 'LIMITED') {
      get().loadInitialMedia();
    }
  },

  requestPermissions: async () => {
    const status = await mediaStoreService.requestPermissionsAsync();
    set({ permissionStatus: status });
    if (status === 'GRANTED' || status === 'LIMITED') {
      get().loadInitialMedia();
    }
  },

  loadInitialMedia: async () => {
    const state = get();
    if (state.isLoading) return;

    set({ isLoading: true });
    try {
      const { assets, hasNextPage, endCursor } = await mediaStoreService.getMediaAsync();
      
      set({
        media: assets,
        groupedMedia: groupMediaByDate(assets),
        hasNextPage,
        endCursor,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load initial media', error);
      set({ isLoading: false });
    }
  },

  loadMoreMedia: async () => {
    const state = get();
    if (state.isLoading || state.isRefreshing || !state.hasNextPage) return;

    set({ isLoading: true });
    try {
      const { assets, hasNextPage, endCursor } = await mediaStoreService.getMediaAsync(state.endCursor);
      
      const newMedia = [...state.media, ...assets];
      
      set({
        media: newMedia,
        groupedMedia: groupMediaByDate(newMedia),
        hasNextPage,
        endCursor,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load more media', error);
      set({ isLoading: false });
    }
  },

  refreshMedia: async () => {
    const state = get();
    if (state.isRefreshing || state.isLoading) return;

    set({ isRefreshing: true });
    try {
      const { assets } = await mediaStoreService.getMediaAsync();
      
      if (assets.length > 0) {
        const existingIds = new Set(state.media.map((m) => m.id));
        const newItems = assets.filter((a) => !existingIds.has(a.id));
        const firstPageIds = new Set(assets.map((a) => a.id));
        
        const cutoffTime = assets[assets.length - 1].creationTime;
        const validMedia = state.media.filter((m) => {
          if (m.creationTime >= cutoffTime) {
            return firstPageIds.has(m.id);
          }
          return true;
        });

        if (newItems.length > 0 || validMedia.length !== state.media.length) {
          const updatedMedia = [...newItems, ...validMedia].sort((a, b) => b.creationTime - a.creationTime);
          
          set({
            media: updatedMedia,
            groupedMedia: groupMediaByDate(updatedMedia),
          });
        }
      }
      set({ isRefreshing: false });
    } catch (error) {
      set({ isRefreshing: false });
    }
  },

  deleteMediaAsync: async (id: string) => {
    try {
      const { media } = get();
      const item = media.find(m => m.id === id);
      if (!item) return false;

      // Soft-delete: move to Pixora trash (30-day recovery)
      const { useTrashStore } = require('./useTrashStore');
      useTrashStore.getState().moveToTrash({
        id: item.id,
        uri: item.uri,
        filename: item.filename,
        mediaType: item.mediaType,
        width: item.width,
        height: item.height,
        creationTime: item.creationTime,
        duration: item.duration,
      });

      // Remove from gallery view immediately
      const updatedMedia = media.filter(m => m.id !== id);
      set({ 
        media: updatedMedia,
        groupedMedia: groupMediaByDate(updatedMedia),
      });
      return true;
    } catch (e) {
      console.error('Delete failed', e);
      return false;
    }
  },

  permanentDeleteAsync: async (id: string) => {
    try {
      const MediaLibrary = require('expo-media-library');
      await MediaLibrary.deleteAssetsAsync([id]);
      const { media } = get();
      const updatedMedia = media.filter(m => m.id !== id);
      set({ media: updatedMedia, groupedMedia: groupMediaByDate(updatedMedia) });
      return true;
    } catch (e) {
      console.error('Permanent delete failed', e);
      return false;
    }
  },
}));
