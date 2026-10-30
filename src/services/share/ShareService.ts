import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import PixoraEditorModule from '../../../modules/pixora-editor/src/PixoraEditorModule';
import { PixoraMediaInfo } from '../media/mediaTypes';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useTrashStore } from '../../store/useTrashStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { toastController } from '../../components/common/Toast';

export interface ShareResult {
  success: boolean;
  sharedCount: number;
  failedCount: number;
  error?: string;
}

export class ShareService {
  private isSharing: boolean = false;

  /**
   * Share multiple selected media assets with full privacy verification,
   * URI validation, selection order preservation, and user feedback.
   */
  async shareSelectedAsync(
    selectedIds: string[],
    allAvailableMedia: PixoraMediaInfo[] = [],
    dialogTitle: string = 'Share via'
  ): Promise<ShareResult> {
    // 1. Concurrency guard to prevent rapid repeated taps from launching duplicate share sheets
    if (this.isSharing) {
      return { success: false, sharedCount: 0, failedCount: 0, error: 'Share already in progress' };
    }

    this.isSharing = true;
    try {
      if (!selectedIds || selectedIds.length === 0) {
        toastController.show({ message: 'No items selected to share', type: 'error' });
        return { success: false, sharedCount: 0, failedCount: 0 };
      }

      // Build media lookup map for O(1) resolution across available sources
      const mediaMap = new Map<string, PixoraMediaInfo>();
      for (const item of allAvailableMedia) {
        if (item && item.id) mediaMap.set(String(item.id), item);
      }
      for (const item of useMediaStore.getState().media) {
        if (item && item.id && !mediaMap.has(String(item.id))) mediaMap.set(String(item.id), item);
      }
      for (const item of useAlbumsStore.getState().activeAlbumMedia) {
        if (item && item.id && !mediaMap.has(String(item.id))) mediaMap.set(String(item.id), item);
      }
      for (const item of useFavoritesStore.getState().favoritesMedia) {
        if (item && item.id && !mediaMap.has(String(item.id))) mediaMap.set(String(item.id), item);
      }

      const privacy = usePrivacyStore.getState();
      const trash = useTrashStore.getState();

      const validItems: PixoraMediaInfo[] = [];
      const failedIds: string[] = [];

      // 2. Validate, resolve, and preserve EXACT selection order
      for (const id of selectedIds) {
        const strId = String(id);
        const item = mediaMap.get(strId);

        if (!item || !item.uri || typeof item.uri !== 'string' || item.uri.trim().length === 0) {
          failedIds.push(strId);
          continue;
        }

        // Privacy and Authorization Boundaries:
        // Do not leak media that has been deleted or resides in locked/hidden areas
        if (trash.isDeleted(strId, item.uri)) {
          failedIds.push(strId);
          continue;
        }
        if (privacy.isAssetPrivate(strId) && !privacy.isVaultUnlocked) {
          failedIds.push(strId);
          continue;
        }
        if (item.albumId && privacy.isAlbumLocked(item.albumId) && !privacy.unlockedAlbums.includes(item.albumId)) {
          failedIds.push(strId);
          continue;
        }
        if (privacy.isAssetHidden(strId)) {
          failedIds.push(strId);
          continue;
        }

        validItems.push(item);
      }

      // 3. User feedback for missing or completely unauthorized selections
      if (validItems.length === 0) {
        toastController.show({
          message: 'Selected items are not accessible or have been removed',
          type: 'error',
        });
        return { success: false, sharedCount: 0, failedCount: failedIds.length };
      }

      // Report partial failures if some items could not be shared
      if (failedIds.length > 0) {
        toastController.show({
          message: `Sharing ${validItems.length} items (${failedIds.length} unavailable)`,
          type: 'info',
        });
      }

      const uris = validItems.map((item) => item.uri);

      // 4. Launch Native Multi-Item or Single-Item Sharing
      if (Platform.OS === 'android' && PixoraEditorModule?.shareMediaAsync) {
        const success = await PixoraEditorModule.shareMediaAsync(uris, dialogTitle);
        return { success, sharedCount: validItems.length, failedCount: failedIds.length };
      }

      // Fallback for single-item sharing using expo-sharing
      if (uris.length === 1) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uris[0], { dialogTitle });
          return { success: true, sharedCount: 1, failedCount: failedIds.length };
        }
      }

      // If multi-item sharing is attempted on platforms without native multi-share module
      if (uris.length > 1 && PixoraEditorModule?.shareMediaAsync) {
        const success = await PixoraEditorModule.shareMediaAsync(uris, dialogTitle);
        return { success, sharedCount: validItems.length, failedCount: failedIds.length };
      }

      toastController.show({
        message: 'Sharing is not available on this device',
        type: 'error',
      });
      return { success: false, sharedCount: 0, failedCount: failedIds.length };
    } catch (e: any) {
      console.warn('[ShareService] Failed to share media items:', e);
      toastController.show({
        message: 'Failed to open share dialog. Please try again.',
        type: 'error',
      });
      return { success: false, sharedCount: 0, failedCount: selectedIds.length, error: e.message };
    } finally {
      this.isSharing = false;
    }
  }

  /**
   * Share a single media item cleanly delegating through the validated pipeline
   */
  async shareSingleAsync(item: PixoraMediaInfo, dialogTitle: string = 'Share via'): Promise<ShareResult> {
    if (!item || !item.id) {
      return { success: false, sharedCount: 0, failedCount: 1 };
    }
    return this.shareSelectedAsync([String(item.id)], [item], dialogTitle);
  }
}

export const shareService = new ShareService();
