import { useMemo } from 'react';
import { usePrivacyStore } from '../store/usePrivacyStore';
import { useTrashStore } from '../store/useTrashStore';
import { PixoraMediaInfo } from '../services/media/mediaTypes';
import * as MediaLibrary from 'expo-media-library/legacy';

export type MediaContext = 'public' | 'hidden' | 'private' | 'archive' | { type: 'locked_album', albumId: string };

/**
 * CENTRAL ACCESS CONTROL
 * Evaluates the requested context and the user's active authentication sessions
 * to securely authorize and filter media. Protected media NEVER leaks into public.
 * Trashed/deleted media NEVER leaks into any non-trash context.
 */
export function useAuthorizedMedia(media: PixoraMediaInfo[], context: MediaContext = 'public'): PixoraMediaInfo[] {
  const hiddenAlbumIds = usePrivacyStore(state => state.hiddenAlbumIds);
  const lockedAlbumIds = usePrivacyStore(state => state.lockedAlbumIds);
  const unlockedAlbums = usePrivacyStore(state => state.unlockedAlbums);
  const hiddenAssetIds = usePrivacyStore(state => state.hiddenAssetIds);
  const privateAssetIds = usePrivacyStore(state => state.privateAssetIds);
  const archivedAssetIds = usePrivacyStore(state => state.archivedAssetIds);
  const isVaultUnlocked = usePrivacyStore(state => state.isVaultUnlocked);

  const trashedItems = useTrashStore(state => state.items);
  const permanentlyDeletedIds = useTrashStore(state => state.permanentlyDeletedIds);
  const permanentlyDeletedUris = useTrashStore(state => state.permanentlyDeletedUris);
  
  return useMemo(() => {
    const trashedIds = new Set(trashedItems.map(i => String(i.id)));
    const trashedUris = new Set(trashedItems.map(i => i.uri).filter(Boolean));
    const permDeletedSet = new Set(permanentlyDeletedIds.map(String));
    const permDeletedUriSet = new Set(permanentlyDeletedUris.filter(Boolean));

    const isItemDeleted = (item: PixoraMediaInfo) => {
      const strId = String(item.id);
      if (trashedIds.has(strId) || permDeletedSet.has(strId)) return true;
      if (item.uri && (trashedUris.has(item.uri) || permDeletedUriSet.has(item.uri))) return true;
      return false;
    };

    const hiddenAlbums = new Set(hiddenAlbumIds);
    const lockedAlbums = new Set(lockedAlbumIds);
    const unlockedAlbumsSet = new Set(unlockedAlbums);
    const hiddenAssets = new Set(hiddenAssetIds);
    const privateAssets = new Set(privateAssetIds);
    const archivedAssets = new Set(archivedAssetIds);

    // 1. PRIVATE VAULT (Strict Auth Required)
    if (context === 'private') {
      if (!isVaultUnlocked) return [];
      return media.filter(item => !isItemDeleted(item) && privateAssets.has(item.id));
    }

    // 2. HIDDEN (Isolated Organization)
    if (context === 'hidden') {
       return media.filter(item => 
         !isItemDeleted(item) && (hiddenAssets.has(item.id) || (item.albumId && hiddenAlbums.has(item.albumId)))
       );
    }

    // 3. ARCHIVE (Isolated Organization)
    if (context === 'archive') {
       return media.filter(item => !isItemDeleted(item) && archivedAssets.has(item.id));
    }

    // 4. LOCKED ALBUM (Strict Auth Required)
    if (typeof context === 'object' && context.type === 'locked_album') {
       if (!unlockedAlbumsSet.has(context.albumId)) return [];
       // Also ensure we only return items belonging to this specific album
       return media.filter(item => !isItemDeleted(item) && item.albumId === context.albumId);
    }

    // 5. PUBLIC (Gallery, Search, Favorites, Recent)
    // Absolutely no protected, isolated, or trashed media can leak here.
    return media.filter(item => {
       // Filter out trashed / deleted media by both ID and URI
       if (isItemDeleted(item)) return false;

       // Check individual asset tags
       if (privateAssets.has(item.id)) return false;
       if (hiddenAssets.has(item.id)) return false;
       if (archivedAssets.has(item.id)) return false;

       // Check parent album tags
       if (item.albumId) {
         if (hiddenAlbums.has(item.albumId)) return false;
         if (lockedAlbums.has(item.albumId)) return false; // Locked album contents stay in locked albums
       }

       return true;
    });
  }, [
    media,
    hiddenAlbumIds,
    lockedAlbumIds,
    unlockedAlbums,
    hiddenAssetIds,
    privateAssetIds,
    archivedAssetIds,
    isVaultUnlocked,
    trashedItems,
    permanentlyDeletedIds,
    permanentlyDeletedUris,
    context
  ]);
}

/**
 * Backward-compatible hook for standard public visibility filtering.
 * Replaces old useVisibleMedia.
 */
export function useVisibleMedia(media: PixoraMediaInfo[]): PixoraMediaInfo[] {
  return useAuthorizedMedia(media, 'public');
}

/**
 * Authorizes which albums can be seen in the main Albums tab.
 */
export function useAuthorizedAlbums(albums: MediaLibrary.Album[]): MediaLibrary.Album[] {
  const hiddenAlbumIds = usePrivacyStore(state => state.hiddenAlbumIds);
  // Note: Locked Albums DO show up in the Albums tab (with a lock icon), 
  // but Hidden Albums are completely removed.
  return useMemo(() => {
    const hiddenSet = new Set(hiddenAlbumIds);
    return albums.filter(album => !hiddenSet.has(album.id));
  }, [albums, hiddenAlbumIds]);
}

export function useVisibleAlbums(albums: MediaLibrary.Album[]): MediaLibrary.Album[] {
  return useAuthorizedAlbums(albums);
}
