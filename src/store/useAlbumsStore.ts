import { create } from 'zustand';
import { mediaStoreService } from '../services/media/MediaStoreService';
import * as MediaLibrary from 'expo-media-library/legacy';
import { PixoraMediaInfo, MediaGroup } from '../services/media/mediaTypes';
import { groupMediaByDate, getMediaEffectiveTimestamp } from '../utils/dateGrouping';
import { useTrashStore, ensureTrashHydrated, TrashedItem } from './useTrashStore';
import { usePrivacyStore } from './usePrivacyStore';
import { useMediaStore } from './useMediaStore';

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
  albumSortOrder: 'newest' | 'oldest';

  loadAlbums: (force?: boolean) => Promise<void>;
  openAlbum: (albumId: string, sortOrder?: 'newest' | 'oldest') => Promise<void>;
  loadMoreAlbumMedia: () => Promise<void>;
  setAlbumSortOrder: (order: 'newest' | 'oldest') => Promise<void>;
  renameAlbum: (albumId: string, newTitle: string) => void;
  deleteAlbum: (albumId: string) => void;
  setAlbumCover: (albumId: string, coverUri: string) => void;
  removeMediaFromActiveAlbum: (assetId: string) => void;
  removeMultipleMediaFromActiveAlbum: (assetIds: string[]) => void;
  decrementAlbumCount: (albumId: string, count?: number) => void;
  decrementAlbumCounts: (counts: Map<string, number> | Record<string, number>) => void;

  // Smart Album state & actions
  activeSmartAlbumId: string | null;
  activeSmartAlbumMedia: PixoraMediaInfo[];
  activeSmartAlbumGrouped: MediaGroup[];
  isLoadingSmartAlbum: boolean;
  hasMoreSmartAlbum: boolean;
  smartAlbumCursor: string | undefined;
  smartAlbumSortOrder: 'newest' | 'oldest';

  openSmartAlbum: (smartAlbumId: string, sortOrder?: 'newest' | 'oldest') => Promise<void>;
  loadMoreSmartAlbumMedia: () => Promise<void>;
  refreshSmartAlbum: () => Promise<void>;
  setSmartAlbumSortOrder: (order: 'newest' | 'oldest') => Promise<void>;
  removeMediaFromActiveSmartAlbum: (assetId: string) => void;
  removeMultipleMediaFromActiveSmartAlbum: (assetIds: string[]) => void;
}

let smartAlbumRequestId = 0;

let activeAlbumsSeq = 0;
let inFlightAlbumsPromise: Promise<void> | null = null;

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
  albumSortOrder: 'newest',

  activeSmartAlbumId: null,
  activeSmartAlbumMedia: [],
  activeSmartAlbumGrouped: [],
  isLoadingSmartAlbum: false,
  hasMoreSmartAlbum: true,
  smartAlbumCursor: undefined,
  smartAlbumSortOrder: 'newest',

  renameAlbum: (albumId: string, newTitle: string) => {
    set((state) => ({
      albums: state.albums.map((a) => (a.id === albumId ? { ...a, title: newTitle } : a)),
    }));
  },

  deleteAlbum: (albumId: string) => {
    set((state) => ({
      albums: state.albums.filter((a) => a.id !== albumId),
      activeAlbumId: state.activeAlbumId === albumId ? null : state.activeAlbumId,
      activeAlbumMedia: state.activeAlbumId === albumId ? [] : state.activeAlbumMedia,
      activeAlbumGrouped: state.activeAlbumId === albumId ? [] : state.activeAlbumGrouped,
    }));
  },

  setAlbumCover: (albumId: string, coverUri: string) => {
    set((state) => ({
      albumCovers: { ...state.albumCovers, [albumId]: coverUri },
    }));
  },

  removeMediaFromActiveAlbum: (assetId: string) => {
    set((state) => {
      const strId = String(assetId);
      const updatedMedia = state.activeAlbumMedia.filter((m) => String(m.id) !== strId);
      return {
        activeAlbumMedia: updatedMedia,
        activeAlbumGrouped: groupMediaByDate(updatedMedia),
      };
    });
  },

  removeMultipleMediaFromActiveAlbum: (assetIds: string[]) => {
    if (!assetIds || assetIds.length === 0) return;
    const idSet = new Set(assetIds.map(String));
    set((state) => {
      const updatedMedia = state.activeAlbumMedia.filter((m) => !idSet.has(String(m.id)));
      return {
        activeAlbumMedia: updatedMedia,
        activeAlbumGrouped: groupMediaByDate(updatedMedia),
      };
    });
  },

  decrementAlbumCount: (albumId: string, count: number = 1) => {
    set((state) => ({
      albums: state.albums.map((a) =>
        String(a.id) === String(albumId)
          ? { ...a, assetCount: Math.max(0, (a.assetCount || 0) - count) }
          : a
      ),
    }));
  },

  decrementAlbumCounts: (counts: Map<string, number> | Record<string, number>) => {
    const countMap = counts instanceof Map ? counts : new Map(Object.entries(counts));
    set((state) => ({
      albums: state.albums.map((a) => {
        const decrementBy = countMap.get(String(a.id)) || countMap.get(a.title.toLowerCase());
        if (decrementBy && decrementBy > 0) {
          return { ...a, assetCount: Math.max(0, (a.assetCount || 0) - decrementBy) };
        }
        return a;
      }),
    }));
  },

  loadAlbums: (force: boolean = false): Promise<void> => {
    if (!force && get().albums.length > 0) return Promise.resolve();
    if (inFlightAlbumsPromise && force) {
      return inFlightAlbumsPromise;
    }
    if (get().isLoadingAlbums && !force) return Promise.resolve();

    const seq = ++activeAlbumsSeq;
    set({ isLoadingAlbums: true });

    inFlightAlbumsPromise = (async () => {
      try {
        const albums = await mediaStoreService.getAlbumsAsync();
        if (seq !== activeAlbumsSeq) return;
        set({ albums, isLoadingAlbums: false });

        // Load covers lazily with sequence verification (reuse existing covers to avoid disk flooding)
        const currentCovers = get().albumCovers;
        const covers: Record<string, string | null> = {};
        await Promise.all(
          albums.map(async (album) => {
            if (album.assetCount === 0) return;
            if (currentCovers[album.id]) {
              covers[album.id] = currentCovers[album.id];
              return;
            }
            const isCam = album.title.toLowerCase() === 'camera' || album.title.toLowerCase() === 'dcim';
            const cover = await mediaStoreService.getAlbumCoverAsync(album.id, isCam);
            if (cover) {
              covers[album.id] = cover;
            }
          })
        );

        if (seq === activeAlbumsSeq) {
          set((state) => ({
            albumCovers: { ...state.albumCovers, ...covers }
          }));
        }
      } catch (error) {
        console.error('Failed to load albums', error);
        if (seq === activeAlbumsSeq) {
          set({ isLoadingAlbums: false });
        }
      } finally {
        inFlightAlbumsPromise = null;
      }
    })();

    return inFlightAlbumsPromise;
  },

  openAlbum: async (albumId: string, sortOrder: 'newest' | 'oldest' = 'newest') => {
    set({ 
      activeAlbumId: albumId, 
      activeAlbumMedia: [], 
      activeAlbumGrouped: [], 
      isLoadingMedia: true,
      hasNextPage: true,
      endCursor: undefined,
      albumSortOrder: sortOrder,
    });
    
    try {
      await ensureTrashHydrated();
      const { assets, hasNextPage, endCursor } = await mediaStoreService.getAlbumAssetsAsync(
        albumId,
        undefined,
        sortOrder
      );
      const trashStore = useTrashStore.getState();
      const seenIds = new Set<string>();
      const filteredAssets = assets
        .filter((a) => !trashStore.isDeleted(a.id, a.uri))
        .filter((a) => {
          const strId = String(a.id);
          if (seenIds.has(strId)) return false;
          seenIds.add(strId);
          return true;
        });

      // Merge any restored items belonging to this album that might not have been returned yet
      const restoredItems = trashStore.restoredItems || [];
      for (const r of restoredItems) {
        if (!trashStore.isDeleted(r.id, r.uri) && r.albumId === albumId && !seenIds.has(String(r.id))) {
          seenIds.add(String(r.id));
          filteredAssets.push(r);
        }
      }

      // Strictly reorder the full eligible album dataset according to sortOrder
      const sortedAssets = [...filteredAssets].sort((a, b) => {
        const timeA = getMediaEffectiveTimestamp(a);
        const timeB = getMediaEffectiveTimestamp(b);
        return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
      });

      const privacy = usePrivacyStore.getState();
      const isProtectedAlbum = privacy.hiddenAlbumIds.includes(albumId) || privacy.lockedAlbumIds.includes(albumId);
      if (!isProtectedAlbum) {
        useMediaStore.getState().upsertMedia(sortedAssets);
      }

      // Register asset albums for authoritative count reconciliation
      for (const a of sortedAssets) {
        if (a && a.id != null) {
          assetAlbumCache.set(String(a.id), String(albumId));
        }
      }

      set({
        activeAlbumMedia: sortedAssets,
        activeAlbumGrouped: groupMediaByDate(sortedAssets),
        hasNextPage,
        endCursor,
        isLoadingMedia: false,
      });
    } catch (e) {
      console.error('Failed to open album', e);
      set({ isLoadingMedia: false });
    }
  },

  setAlbumSortOrder: async (order: 'newest' | 'oldest') => {
    const { activeAlbumId, albumSortOrder } = get();
    if (!activeAlbumId || albumSortOrder === order) return;
    await get().openAlbum(activeAlbumId, order);
  },

  loadMoreAlbumMedia: async () => {
    const { activeAlbumId, hasNextPage, endCursor, activeAlbumMedia, isLoadingMedia, albumSortOrder } = get();
    if (!activeAlbumId || !hasNextPage || isLoadingMedia) return;

    set({ isLoadingMedia: true });
    try {
      await ensureTrashHydrated();
      let currentCursor = endCursor;
      let nextHasNextPage: boolean = hasNextPage;
      let result = await mediaStoreService.getAlbumAssetsAsync(activeAlbumId, currentCursor, albumSortOrder);
      const trashStore = useTrashStore.getState();
      const existingIds = new Set(activeAlbumMedia.map((m) => String(m.id)));

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

      addFiltered(result.assets);
      currentCursor = result.endCursor;
      nextHasNextPage = result.hasNextPage;

      let attempts = 0;
      while (accumulated.length === 0 && nextHasNextPage && attempts < 5) {
        attempts++;
        result = await mediaStoreService.getAlbumAssetsAsync(activeAlbumId, currentCursor, albumSortOrder);
        currentCursor = result.endCursor;
        nextHasNextPage = result.hasNextPage;
        addFiltered(result.assets);
      }

      const newMedia = [...activeAlbumMedia, ...accumulated].sort((a, b) => {
        const timeA = getMediaEffectiveTimestamp(a);
        const timeB = getMediaEffectiveTimestamp(b);
        return albumSortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
      });

      set({
        activeAlbumMedia: newMedia,
        activeAlbumGrouped: groupMediaByDate(newMedia),
        hasNextPage: nextHasNextPage,
        endCursor: currentCursor,
        isLoadingMedia: false,
      });
    } catch (e) {
      console.error('Failed to load more album media', e);
      set({ isLoadingMedia: false });
    }
  },

  openSmartAlbum: async (smartAlbumId: string, sortOrder: 'newest' | 'oldest' = 'newest') => {
    const requestId = ++smartAlbumRequestId;
    set({
      activeSmartAlbumId: smartAlbumId,
      activeSmartAlbumMedia: [],
      activeSmartAlbumGrouped: [],
      isLoadingSmartAlbum: true,
      hasMoreSmartAlbum: true,
      smartAlbumCursor: undefined,
      smartAlbumSortOrder: sortOrder,
    });

    try {
      await ensureTrashHydrated();
      const physicalAlbums = get().albums;
      const { assets, hasNextPage, endCursor } = await mediaStoreService.getSmartAlbumMediaAsync(
        smartAlbumId,
        undefined,
        50,
        sortOrder,
        physicalAlbums
      );

      // Guard against stale async responses if user navigated away or changed smart albums
      if (requestId !== smartAlbumRequestId || get().activeSmartAlbumId !== smartAlbumId) {
        return;
      }

      const trashStore = useTrashStore.getState();
      const seenIds = new Set<string>();
      const nonTrashed = assets
        .filter((a) => !trashStore.isDeleted(a.id, a.uri))
        .filter((a) => {
          const strId = String(a.id);
          if (seenIds.has(strId)) return false;
          seenIds.add(strId);
          return true;
        });

      // Propagate newly loaded smart album media to useMediaStore so Photos screen stays immediately up-to-date
      useMediaStore.getState().upsertMedia(nonTrashed);

      set({
        activeSmartAlbumMedia: nonTrashed,
        activeSmartAlbumGrouped: groupMediaByDate(nonTrashed),
        hasMoreSmartAlbum: hasNextPage,
        smartAlbumCursor: endCursor,
        isLoadingSmartAlbum: false,
      });
    } catch (e) {
      if (requestId === smartAlbumRequestId && get().activeSmartAlbumId === smartAlbumId) {
        console.error('[useAlbumsStore] Failed to open smart album', smartAlbumId, e);
        set({ isLoadingSmartAlbum: false });
      }
    }
  },

  loadMoreSmartAlbumMedia: async () => {
    const {
      activeSmartAlbumId,
      hasMoreSmartAlbum,
      smartAlbumCursor,
      activeSmartAlbumMedia,
      isLoadingSmartAlbum,
      smartAlbumSortOrder,
      albums: physicalAlbums,
    } = get();
    if (!activeSmartAlbumId || !hasMoreSmartAlbum || isLoadingSmartAlbum) return;

    const requestId = smartAlbumRequestId;
    set({ isLoadingSmartAlbum: true });
    try {
      await ensureTrashHydrated();
      let currentCursor = smartAlbumCursor;
      let nextHasMore: boolean = hasMoreSmartAlbum;
      let result = await mediaStoreService.getSmartAlbumMediaAsync(
        activeSmartAlbumId,
        currentCursor,
        50,
        smartAlbumSortOrder,
        physicalAlbums
      );

      if (requestId !== smartAlbumRequestId || get().activeSmartAlbumId !== activeSmartAlbumId) {
        return;
      }

      const trashStore = useTrashStore.getState();
      const existingIds = new Set(activeSmartAlbumMedia.map((m) => String(m.id)));

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

      addFiltered(result.assets);
      currentCursor = result.endCursor;
      nextHasMore = result.hasNextPage;

      let attempts = 0;
      while (accumulated.length === 0 && nextHasMore && attempts < 5) {
        attempts++;
        result = await mediaStoreService.getSmartAlbumMediaAsync(
          activeSmartAlbumId,
          currentCursor,
          50,
          smartAlbumSortOrder,
          physicalAlbums
        );
        if (requestId !== smartAlbumRequestId || get().activeSmartAlbumId !== activeSmartAlbumId) {
          return;
        }
        currentCursor = result.endCursor;
        nextHasMore = result.hasNextPage;
        addFiltered(result.assets);
      }

      if (accumulated.length > 0) {
        useMediaStore.getState().upsertMedia(accumulated);
      }

      const combined = [...activeSmartAlbumMedia, ...accumulated];
      set({
        activeSmartAlbumMedia: combined,
        activeSmartAlbumGrouped: groupMediaByDate(combined),
        smartAlbumCursor: currentCursor,
        hasMoreSmartAlbum: nextHasMore,
        isLoadingSmartAlbum: false,
      });
    } catch (e) {
      if (requestId === smartAlbumRequestId) {
        console.error('[useAlbumsStore] Failed to load more smart album media', e);
        set({ isLoadingSmartAlbum: false });
      }
    }
  },

  refreshSmartAlbum: async () => {
    const { activeSmartAlbumId, smartAlbumSortOrder } = get();
    if (!activeSmartAlbumId) return;
    await get().openSmartAlbum(activeSmartAlbumId, smartAlbumSortOrder);
  },

  setSmartAlbumSortOrder: async (order: 'newest' | 'oldest') => {
    const { activeSmartAlbumId, smartAlbumSortOrder } = get();
    if (!activeSmartAlbumId || smartAlbumSortOrder === order) return;
    await get().openSmartAlbum(activeSmartAlbumId, order);
  },

  removeMediaFromActiveSmartAlbum: (assetId: string) => {
    set((state) => {
      const strId = String(assetId);
      const updatedMedia = state.activeSmartAlbumMedia.filter((m) => String(m.id) !== strId);
      return {
        activeSmartAlbumMedia: updatedMedia,
        activeSmartAlbumGrouped: groupMediaByDate(updatedMedia),
      };
    });
  },

  removeMultipleMediaFromActiveSmartAlbum: (assetIds: string[]) => {
    if (!assetIds || assetIds.length === 0) return;
    const idSet = new Set(assetIds.map(String));
    set((state) => {
      const updatedMedia = state.activeSmartAlbumMedia.filter((m) => !idSet.has(String(m.id)));
      return {
        activeSmartAlbumMedia: updatedMedia,
        activeSmartAlbumGrouped: groupMediaByDate(updatedMedia),
      };
    });
  },
}));

const assetAlbumCache = new Map<string, string>();

/**
 * Registers asset IDs with their containing album IDs to support global,
 * decoupled count reconciliation across screens without requiring active selection.
 */
export function registerAssetAlbums(assets: { id?: string | number; albumId?: string }[]): void {
  for (const a of assets) {
    if (a && a.id != null && a.albumId) {
      assetAlbumCache.set(String(a.id), String(a.albumId));
    }
  }
}

/**
 * Authoritatively reconciles album count against active Trash, permanent deletions, and privacy rules.
 * Uses unique ID sets to ensure no item is ever subtracted more than once.
 * Never mutates store state and never drifts across sorting or refreshes.
 */
export function getReconciledAlbumCount(
  album: MediaLibrary.Album,
  trashedItems: TrashedItem[] = []
): number {
  if (!album) return 0;
  const baseCount = typeof album.assetCount === 'number' ? album.assetCount : 0;
  if (baseCount === 0) return 0;

  const privacy = usePrivacyStore.getState();
  const deductedIds = new Set<string>();

  // 1. Deduct unique trashed items belonging to this specific album
  for (const item of trashedItems) {
    if (item.albumId && String(item.albumId) === String(album.id)) {
      deductedIds.add(String(item.id));
      continue;
    }
    // Path/URI/Filename heuristic fallback for legacy or unindexed trashed items
    if (!item.albumId && album.title) {
      const lowerUri = (item.uri || '').toLowerCase();
      const lowerTitle = album.title.toLowerCase();
      const lowerFile = (item.filename || '').toLowerCase();

      // Folder segment match in URI (e.g. file:///storage/emulated/0/DCIM/Camera/...)
      if (lowerUri.includes('/' + lowerTitle + '/')) {
        deductedIds.add(String(item.id));
        continue;
      }

      // Standard directory markers when URI is a content:// URI
      if (lowerTitle === 'camera' || lowerTitle === 'dcim') {
        if (
          lowerUri.includes('/camera/') ||
          lowerUri.includes('/dcim/') ||
          lowerFile.startsWith('img_') ||
          lowerFile.startsWith('vid_') ||
          lowerFile.startsWith('pxl_') ||
          lowerFile.startsWith('dsc_')
        ) {
          deductedIds.add(String(item.id));
          continue;
        }
      } else if (lowerTitle.includes('screenshot')) {
        if (
          lowerUri.includes('screenshot') ||
          lowerFile.includes('screenshot') ||
          lowerFile.includes('screencap') ||
          lowerFile.startsWith('capture_')
        ) {
          deductedIds.add(String(item.id));
          continue;
        }
      } else if (lowerTitle === 'download' || lowerTitle === 'downloads') {
        if (
          lowerUri.includes('download') ||
          lowerFile.startsWith('download') ||
          lowerFile.startsWith('dl_')
        ) {
          deductedIds.add(String(item.id));
          continue;
        }
      } else if (lowerTitle.includes('whatsapp')) {
        if (
          lowerUri.includes('whatsapp') ||
          lowerFile.includes('whatsapp') ||
          /^(?:img|vid)-\d{8}-wa\d+/i.test(lowerFile)
        ) {
          deductedIds.add(String(item.id));
          continue;
        }
      }
    }
  }

  // 2. Deduct hidden, private vault, or archived assets that belong to this album
  const protectedIds = new Set([
    ...privacy.hiddenAssetIds,
    ...privacy.privateAssetIds,
    ...privacy.archivedAssetIds,
  ]);

  if (protectedIds.size > 0) {
    // Populate cache with known media from media store & active album
    const mediaStoreMedia = useMediaStore.getState().media;
    for (const m of mediaStoreMedia) {
      if (m && m.id != null && m.albumId) {
        assetAlbumCache.set(String(m.id), String(m.albumId));
      }
    }
    const albumMedia = useAlbumsStore.getState().activeAlbumMedia;
    for (const m of albumMedia) {
      if (m && m.id != null) {
        const aId = m.albumId || useAlbumsStore.getState().activeAlbumId;
        if (aId) {
          assetAlbumCache.set(String(m.id), String(aId));
        }
      }
    }

    for (const id of protectedIds) {
      const strId = String(id);
      const knownAlbumId = assetAlbumCache.get(strId);
      if (knownAlbumId && String(knownAlbumId) === String(album.id)) {
        deductedIds.add(strId);
      }
    }
  }

  return Math.max(0, baseCount - deductedIds.size);
}

