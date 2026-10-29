import { create } from 'zustand';
import * as MediaLibrary from 'expo-media-library/legacy';
import { mediaStoreService } from '../services/media/MediaStoreService';
import { PixoraMediaInfo, MediaGroup, MediaPermissionStatus } from '../services/media/mediaTypes';
import { getMediaEffectiveTimestamp } from '../utils/dateGrouping';
import { useTrashStore, ensureTrashHydrated } from './useTrashStore';
import { useAlbumsStore, registerAssetAlbums } from './useAlbumsStore';
import { useFavoritesStore } from './useFavoritesStore';
import { useSelectionStore } from './useSelectionStore';

interface MediaState {
  permissionStatus: MediaPermissionStatus;
  isCheckingPermission: boolean;
  media: PixoraMediaInfo[];
  groupedMedia: MediaGroup[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasNextPage: boolean;
  endCursor: string | undefined;
  sortOrder: 'newest' | 'oldest';
  lastRefreshTime: number;

  checkPermissions: () => Promise<void>;
  requestPermissions: () => Promise<void>;
  loadInitialMedia: () => Promise<void>;
  loadMoreMedia: () => Promise<void>;
  refreshMedia: (resetPagination?: boolean) => Promise<void>;
  upsertMedia: (newAssets: PixoraMediaInfo[]) => void;
  setSortOrder: (order: 'newest' | 'oldest') => Promise<void>;
  deleteMediaAsync: (id: string) => Promise<boolean>;
  batchDeleteMediaAsync: (ids: string[]) => Promise<number>;
  permanentDeleteAsync: (id: string) => Promise<boolean>;
}

let activeRefreshSeq = 0;
let inFlightPermissionCheck: Promise<void> | null = null;

export const useMediaStore = create<MediaState>((set, get) => ({
  permissionStatus: 'UNDETERMINED',
  isCheckingPermission: true,
  media: [],
  groupedMedia: [],
  isLoading: false,
  isRefreshing: false,
  hasNextPage: true,
  endCursor: undefined,
  sortOrder: 'newest',
  lastRefreshTime: 0,

  checkPermissions: () => {
    if (inFlightPermissionCheck) return inFlightPermissionCheck;
    inFlightPermissionCheck = (async () => {
      try {
        const status = await mediaStoreService.getPermissionsAsync();
        set({ permissionStatus: status, isCheckingPermission: false });
        if (status === 'GRANTED' || status === 'LIMITED') {
          if (get().media.length === 0) {
            await get().loadInitialMedia();
          } else {
            await get().refreshMedia();
          }
        }
      } catch (e) {
        console.error('Failed to check permissions', e);
        set({ isCheckingPermission: false });
      } finally {
        inFlightPermissionCheck = null;
      }
    })();
    return inFlightPermissionCheck;
  },

  requestPermissions: async () => {
    try {
      const status = await mediaStoreService.requestPermissionsAsync();
      set({ permissionStatus: status, isCheckingPermission: false });
      if (status === 'GRANTED' || status === 'LIMITED') {
        if (get().media.length === 0) {
          await get().loadInitialMedia();
        } else {
          await get().refreshMedia();
        }
      }
    } catch (e) {
      console.error('Failed to request permissions', e);
      set({ isCheckingPermission: false });
    }
  },

  loadInitialMedia: async () => {
    const state = get();
    if (state.isLoading) return;

    ++activeRefreshSeq;
    set({ isLoading: true });
    try {
      await ensureTrashHydrated();
      const { assets, hasNextPage, endCursor } = await mediaStoreService.getMediaAsync(
        undefined,
        undefined,
        undefined,
        state.sortOrder
      );
      const trashStore = useTrashStore.getState();
      const assetMap = new Map<string, PixoraMediaInfo>();

      for (const a of assets) {
        if (!trashStore.isDeleted(a.id, a.uri)) {
          assetMap.set(String(a.id), a);
        }
      }

      // Merge persistent restored historical items so they are NEVER missing upon app restart
      const restoredItems = trashStore.restoredItems || [];
      for (const r of restoredItems) {
        if (!trashStore.isDeleted(r.id, r.uri)) {
          let existing = assetMap.get(String(r.id));
          if (!existing && r.uri) {
            for (const item of assetMap.values()) {
              if (item.uri === r.uri) {
                existing = item;
                break;
              }
            }
          }
          if (existing) {
            const preserved = trashStore.getPreservedTimestamp?.(existing.id, existing.uri) || r.creationTime;
            if (preserved && preserved > 0) {
              existing.creationTime = preserved;
            }
          } else {
            assetMap.set(String(r.id), r);
          }
        }
      }

      const nonTrashed = Array.from(assetMap.values()).sort((a, b) => {
        const timeA = getMediaEffectiveTimestamp(a);
        const timeB = getMediaEffectiveTimestamp(b);
        return state.sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
      });
      
      if (__DEV__ && state.sortOrder === 'oldest') {
        console.log('[Pixora useMediaStore Diagnostic] Loaded initial oldest media:', {
          totalLoaded: nonTrashed.length,
          firstItemDate: nonTrashed.length > 0 ? new Date(nonTrashed[0].creationTime).toISOString().slice(0, 10) : null,
          firstItemId: nonTrashed.length > 0 ? nonTrashed[0].id : null,
          lastItemDate: nonTrashed.length > 0 ? new Date(nonTrashed[nonTrashed.length - 1].creationTime).toISOString().slice(0, 10) : null,
        });
      }

      // Register asset albums for authoritative count reconciliation across screens
      registerAssetAlbums(nonTrashed);

      set({
        media: nonTrashed,
        hasNextPage,
        endCursor,
        isLoading: false,
        lastRefreshTime: Date.now(),
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
      await ensureTrashHydrated();
      let currentCursor = state.endCursor;
      let { assets, hasNextPage, endCursor } = await mediaStoreService.getMediaAsync(
        currentCursor,
        undefined,
        undefined,
        state.sortOrder
      );
      const trashStore = useTrashStore.getState();
      const existingIds = new Set(state.media.map((m) => String(m.id)));
      
      const accumulated: PixoraMediaInfo[] = [];
      const addFiltered = (batch: PixoraMediaInfo[]) => {
        for (const item of batch) {
          const strId = String(item.id);
          if (!trashStore.isDeleted(strId, item.uri) && !existingIds.has(strId)) {
            existingIds.add(strId);
            accumulated.push(item);
          }
        }
      };

      addFiltered(assets);

      // If all items in this page were trashed or duplicates, keep fetching subsequent pages
      // up to 5 attempts so infinite scroll doesn't stall before reaching older photos.
      let attempts = 0;
      while (accumulated.length === 0 && hasNextPage && attempts < 5) {
        attempts++;
        currentCursor = endCursor;
        const nextBatch = await mediaStoreService.getMediaAsync(
          currentCursor,
          undefined,
          undefined,
          state.sortOrder
        );
        endCursor = nextBatch.endCursor;
        hasNextPage = nextBatch.hasNextPage;
        addFiltered(nextBatch.assets);
      }

      const newMedia = [...state.media, ...accumulated].sort((a, b) => {
        const timeA = getMediaEffectiveTimestamp(a);
        const timeB = getMediaEffectiveTimestamp(b);
        return state.sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
      });
      
      set({
        media: newMedia,
        hasNextPage,
        endCursor,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load more media', error);
      set({ isLoading: false });
    }
  },

  refreshMedia: async (resetPagination: boolean = false) => {
    const state = get();
    if (state.isRefreshing) return;

    const requestSeq = ++activeRefreshSeq;
    set({ isRefreshing: true });
    try {
      await ensureTrashHydrated();
      const { assets, hasNextPage, endCursor } = await mediaStoreService.getMediaAsync(
        undefined,
        undefined,
        undefined,
        state.sortOrder
      );

      // Guard against out-of-order async races: discard if a newer refresh was initiated
      if (requestSeq !== activeRefreshSeq) return;

      const trashStore = useTrashStore.getState();
      const nonTrashed = assets.filter((a) => !trashStore.isDeleted(a.id, a.uri));

      // Consolidated asset map: preserves existing valid media and updates/prepends new assets
      const assetMap = new Map<string, PixoraMediaInfo>();

      if (!resetPagination) {
        // Retain existing valid media: a partial page query must NEVER erase existing valid media
        for (const item of state.media) {
          const strId = String(item.id);
          if (!trashStore.isDeleted(strId, item.uri)) {
            assetMap.set(strId, item);
          }
        }
      }

      // Merge and update all items from the fresh query
      for (const item of nonTrashed) {
        const strId = String(item.id);
        assetMap.set(strId, item);
      }

      // Merge persistent restored historical items so they are NEVER erased during refresh
      const restoredItems = trashStore.restoredItems || [];
      for (const r of restoredItems) {
        if (!trashStore.isDeleted(r.id, r.uri)) {
          let existing = assetMap.get(String(r.id));
          if (!existing && r.uri) {
            for (const item of assetMap.values()) {
              if (item.uri === r.uri) {
                existing = item;
                break;
              }
            }
          }
          if (existing) {
            const preserved = trashStore.getPreservedTimestamp?.(existing.id, existing.uri) || r.creationTime;
            if (preserved && preserved > 0) {
              existing.creationTime = preserved;
            }
          } else {
            assetMap.set(String(r.id), r);
          }
        }
      }

      const mergedMedia = Array.from(assetMap.values())
        .filter((m) => !trashStore.isDeleted(m.id, m.uri))
        .sort((a, b) => {
          const timeA = getMediaEffectiveTimestamp(a);
          const timeB = getMediaEffectiveTimestamp(b);
          return state.sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
        });

      // Preserve cursor if we have loaded pages beyond page 1 and no reset was requested
      const shouldPreserveCursor = !resetPagination && state.media.length > 50 && !!state.endCursor;

      registerAssetAlbums(mergedMedia);

      set({
        media: mergedMedia,
        hasNextPage: shouldPreserveCursor ? state.hasNextPage : hasNextPage,
        endCursor: shouldPreserveCursor ? state.endCursor : endCursor,
        isRefreshing: false,
        isLoading: false,
        lastRefreshTime: Date.now(),
      });
    } catch (e) {
      console.error('[useMediaStore] Failed to refresh media', e);
      set({ isRefreshing: false, isLoading: false });
    }
  },

  upsertMedia: (newAssets: PixoraMediaInfo[]) => {
    if (!newAssets || newAssets.length === 0) return;
    registerAssetAlbums(newAssets);
    const state = get();
    const trashStore = useTrashStore.getState();
    const assetMap = new Map<string, PixoraMediaInfo>();

    for (const item of state.media) {
      if (!trashStore.isDeleted(item.id, item.uri)) {
        assetMap.set(String(item.id), item);
      }
    }

    let hasChange = false;
    for (const item of newAssets) {
      const strId = String(item.id);
      if (!trashStore.isDeleted(strId, item.uri)) {
        const existing = assetMap.get(strId);
        if (!existing) {
          hasChange = true;
          assetMap.set(strId, item);
        } else {
          const needsUpdate =
            existing.creationTime !== item.creationTime ||
            existing.uri !== item.uri ||
            (!existing.albumId && !!item.albumId);
          if (needsUpdate) {
            hasChange = true;
            assetMap.set(strId, { ...existing, ...item });
          }
        }
      }
    }

    if (!hasChange) return;

    const mergedMedia = Array.from(assetMap.values())
      .filter((m) => !trashStore.isDeleted(m.id, m.uri))
      .sort((a, b) => {
        const timeA = getMediaEffectiveTimestamp(a);
        const timeB = getMediaEffectiveTimestamp(b);
        return state.sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
      });

    set({ media: mergedMedia });
  },

  setSortOrder: async (order: 'newest' | 'oldest') => {
    const state = get();
    if (state.sortOrder === order) return;

    ++activeRefreshSeq;
    set({
      sortOrder: order,
      isLoading: true,
    });

    try {
      await ensureTrashHydrated();
      const { assets, hasNextPage, endCursor } = await mediaStoreService.getMediaAsync(
        undefined,
        undefined,
        undefined,
        order
      );
      const trashStore = useTrashStore.getState();
      const assetMap = new Map<string, PixoraMediaInfo>();

      // Retain existing valid non-trashed media in memory (so album items or previously loaded media are not purged)
      for (const item of state.media) {
        const strId = String(item.id);
        if (!trashStore.isDeleted(strId, item.uri)) {
          assetMap.set(strId, item);
        }
      }

      for (const a of assets) {
        if (!trashStore.isDeleted(a.id, a.uri)) {
          assetMap.set(String(a.id), a);
        }
      }

      // Merge persistent restored historical items so they are NEVER missing upon sort switch
      const restoredItems = trashStore.restoredItems || [];
      for (const r of restoredItems) {
        if (!trashStore.isDeleted(r.id, r.uri)) {
          let existing = assetMap.get(String(r.id));
          if (!existing && r.uri) {
            for (const item of assetMap.values()) {
              if (item.uri === r.uri) {
                existing = item;
                break;
              }
            }
          }
          if (existing) {
            const preserved = trashStore.getPreservedTimestamp?.(existing.id, existing.uri) || r.creationTime;
            if (preserved && preserved > 0) {
              existing.creationTime = preserved;
            }
          } else {
            assetMap.set(String(r.id), r);
          }
        }
      }

      const nonTrashed = Array.from(assetMap.values())
        .filter((m) => !trashStore.isDeleted(m.id, m.uri))
        .sort((a, b) => {
          const timeA = getMediaEffectiveTimestamp(a);
          const timeB = getMediaEffectiveTimestamp(b);
          return order === 'oldest' ? timeA - timeB : timeB - timeA;
        });

      if (__DEV__ && order === 'oldest') {
        console.log('[Pixora useMediaStore Diagnostic] Set sort order to oldest:', {
          totalLoaded: nonTrashed.length,
          firstItemDate: nonTrashed.length > 0 ? new Date(nonTrashed[0].creationTime).toISOString().slice(0, 10) : null,
          firstItemId: nonTrashed.length > 0 ? nonTrashed[0].id : null,
          lastItemDate: nonTrashed.length > 0 ? new Date(nonTrashed[nonTrashed.length - 1].creationTime).toISOString().slice(0, 10) : null,
        });
      }

      // Register asset albums for authoritative count reconciliation across screens
      registerAssetAlbums(nonTrashed);

      set({
        media: nonTrashed,
        hasNextPage,
        endCursor,
        isLoading: false,
        lastRefreshTime: Date.now(),
      });
    } catch (e) {
      console.error('[useMediaStore] Failed to set sort order', e);
      set({ isLoading: false });
    }
  },

  deleteMediaAsync: async (id: string) => {
    try {
      await ensureTrashHydrated();
      const strId = String(id);
      const { media } = get();
      let item = media.find(m => String(m.id) === strId);

      if (!item) {
        const albumMedia = useAlbumsStore.getState().activeAlbumMedia;
        item = albumMedia.find(m => String(m.id) === strId);
      }
      if (!item) {
        const favMedia = useFavoritesStore.getState().favoritesMedia;
        item = favMedia.find(m => String(m.id) === strId);
      }
      if (!item || !item.albumId) {
        try {
          const fetched = await mediaStoreService.getAssetsByIdsAsync([strId]);
          if (fetched.length > 0) {
            item = item ? { ...item, ...fetched[0] } : fetched[0];
          }
        } catch {}
      }

      if (!item) return false;

      // Soft-delete: move to Pixora trash (30-day recovery)
      useTrashStore.getState().moveToTrash({
        id: strId,
        uri: item.uri,
        filename: item.filename,
        mediaType: item.mediaType === 'video' ? 'video' : 'photo',
        width: item.width,
        height: item.height,
        creationTime: item.creationTime,
        modificationTime: item.modificationTime,
        duration: item.duration,
        albumId: item.albumId || useAlbumsStore.getState().activeAlbumId || undefined,
      });

      // 1. Remove from gallery view immediately
      const updatedMedia = media.filter(m => String(m.id) !== strId);
      set({ 
        media: updatedMedia,
      });

      // 2. Remove from active album & smart album media immediately
      useAlbumsStore.getState().removeMediaFromActiveAlbum(strId);
      useAlbumsStore.getState().removeMediaFromActiveSmartAlbum(strId);

      // 3. Remove from favorites immediately
      useFavoritesStore.getState().removeFavorite(strId);

      // 4. Invalidate selection if selected
      const currentSelected = useSelectionStore.getState().selectedIds;
      if (currentSelected.has(strId)) {
        const newSelected = new Set(currentSelected);
        newSelected.delete(strId);
        useSelectionStore.getState().setSelectedIds(newSelected);
      }

      return true;
    } catch (e) {
      console.error('Delete failed', e);
      return false;
    }
  },

  batchDeleteMediaAsync: async (ids: string[]) => {
    if (!ids || ids.length === 0) return 0;
    try {
      await ensureTrashHydrated();
      const idSet = new Set(ids.map(String));
      const { media } = get();

      const albumMedia = useAlbumsStore.getState().activeAlbumMedia;
      const favMedia = useFavoritesStore.getState().favoritesMedia;

      const itemsToTrash: PixoraMediaInfo[] = [];
      const needsLookupIds: string[] = [];

      for (const strId of idSet) {
        let item =
          media.find((m) => String(m.id) === strId) ||
          albumMedia.find((m) => String(m.id) === strId) ||
          favMedia.find((m) => String(m.id) === strId);

        if (item) {
          if (!item.albumId) {
            needsLookupIds.push(strId);
          }
          itemsToTrash.push(item);
        } else {
          needsLookupIds.push(strId);
        }
      }

      if (needsLookupIds.length > 0) {
        try {
          const fetched = await mediaStoreService.getAssetsByIdsAsync(needsLookupIds);
          for (const f of fetched) {
            const idx = itemsToTrash.findIndex((i) => String(i.id) === String(f.id));
            if (idx >= 0) {
              itemsToTrash[idx] = { ...itemsToTrash[idx], ...f };
            } else {
              itemsToTrash.push(f);
            }
          }
        } catch {}
      }

      if (itemsToTrash.length === 0) return 0;

      const activeAlbumId = useAlbumsStore.getState().activeAlbumId;
      useTrashStore.getState().batchMoveToTrash(
        itemsToTrash.map((item) => ({
          id: String(item.id),
          uri: item.uri,
          filename: item.filename,
          mediaType: item.mediaType === 'video' ? 'video' : 'photo',
          width: item.width,
          height: item.height,
          creationTime: item.creationTime,
          modificationTime: item.modificationTime,
          duration: item.duration,
          albumId: item.albumId || activeAlbumId || undefined,
        }))
      );

      // Single-pass atomic updates
      const updatedMedia = media.filter((m) => !idSet.has(String(m.id)));
      set({ media: updatedMedia });

      useAlbumsStore.getState().removeMultipleMediaFromActiveAlbum(ids);
      useAlbumsStore.getState().removeMultipleMediaFromActiveSmartAlbum(ids);

      const favStore = useFavoritesStore.getState();
      ids.forEach((id) => favStore.removeFavorite(id));

      const selStore = useSelectionStore.getState();
      const currentSelected = selStore.selectedIds;
      const newSelected = new Set(currentSelected);
      ids.forEach((id) => newSelected.delete(String(id)));
      selStore.setSelectedIds(newSelected);

      return itemsToTrash.length;
    } catch (e) {
      console.error('[Pixora MediaStore] batchDeleteMediaAsync error:', e);
      return 0;
    }
  },

  permanentDeleteAsync: async (id: string) => {
    try {
      await ensureTrashHydrated();
      const strId = String(id);
      const trashItem = useTrashStore.getState().items.find(i => String(i.id) === strId);
      const uri = trashItem?.uri;
      
      // Perform genuine Android OS MediaLibrary deletion
      const success = await MediaLibrary.deleteAssetsAsync([strId]);
      if (!success) {
        console.warn('[Pixora MediaStore] System deletion returned false or permission denied for:', strId);
        return false;
      }

      // Deletion succeeded on Android disk: cleanly excise from trash, record tombstone, and excise in-memory caches
      if (trashItem?.albumId) {
        useAlbumsStore.getState().decrementAlbumCount(trashItem.albumId, 1);
      }
      useTrashStore.getState().permanentlyDelete([strId], uri ? [uri] : undefined);
      const { media } = get();
      const updatedMedia = media.filter(m => String(m.id) !== strId && (!uri || m.uri !== uri));
      set({ media: updatedMedia });
      useAlbumsStore.getState().removeMediaFromActiveAlbum(strId);
      useAlbumsStore.getState().removeMediaFromActiveSmartAlbum(strId);
      useFavoritesStore.getState().removeFavorite(strId);
      return true;
    } catch (e) {
      console.error('Permanent delete failed', e);
      return false;
    }
  },
}));
