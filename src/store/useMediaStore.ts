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
      console.error('Failed to refresh media', error);
      set({ isRefreshing: false });
    }
  },
}));
