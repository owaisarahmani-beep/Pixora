import { useMemo } from 'react';
import { usePrivacyStore } from '../store/usePrivacyStore';
import { PixoraMediaInfo } from '../services/media/mediaTypes';
import * as MediaLibrary from 'expo-media-library/legacy';

export type MediaContext = 'public' | 'hidden' | 'private' | 'archive' | { type: 'locked_album', albumId: string };

/**
 * CENTRAL ACCESS CONTROL
 * Evaluates the requested context and the user's active authentication sessions
 * to securely authorize and filter media. Protected media NEVER leaks into public.
 */
export function useAuthorizedMedia(media: PixoraMediaInfo[], context: MediaContext = 'public'): PixoraMediaInfo[] {
  const privacyState = usePrivacyStore();
  
  return useMemo(() => {
    const hiddenAlbums = new Set(privacyState.hiddenAlbumIds);
    const lockedAlbums = new Set(privacyState.lockedAlbumIds);
    const unlockedAlbums = new Set(privacyState.unlockedAlbums);
    const hiddenAssets = new Set(privacyState.hiddenAssetIds);
    const privateAssets = new Set(privacyState.privateAssetIds);
    const archivedAssets = new Set(privacyState.archivedAssetIds);

    // 1. PRIVATE VAULT (Strict Auth Required)
    if (context === 'private') {
      if (!privacyState.isVaultUnlocked) return [];
      return media.filter(item => privateAssets.has(item.id));
    }

    // 2. HIDDEN (Isolated Organization)
    if (context === 'hidden') {
       return media.filter(item => 
         hiddenAssets.has(item.id) || (item.albumId && hiddenAlbums.has(item.albumId))
       );
    }

    // 3. ARCHIVE (Isolated Organization)
    if (context === 'archive') {
       return media.filter(item => archivedAssets.has(item.id));
    }

    // 4. LOCKED ALBUM (Strict Auth Required)
    if (typeof context === 'object' && context.type === 'locked_album') {
       if (!unlockedAlbums.has(context.albumId)) return [];
       // Also ensure we only return items belonging to this specific album
       return media.filter(item => item.albumId === context.albumId);
    }

    // 5. PUBLIC (Gallery, Search, Favorites, Recent)
    // Absolutely no protected or isolated media can leak here.
    return media.filter(item => {
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
  }, [media, privacyState, context]);
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
