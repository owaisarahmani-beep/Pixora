import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import Animated, { FadeInDown, FadeOutUp, FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useSelectionStore } from '../../store/useSelectionStore';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { useTheme } from '../../theme/ThemeProvider';
import DeleteConfirmModal from '../common/DeleteConfirmModal';
import { toastController } from '../common/Toast';

export default function GlobalSelectionBar({ tabBarHeight = 0 }: { tabBarHeight?: number }) {
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode);
  const selectionContext = useSelectionStore(state => state.selectionContext);
  const selectedIds = useSelectionStore(state => state.selectedIds);
  const availableIds = useSelectionStore(state => state.availableIds);
  const exitSelectionMode = useSelectionStore(state => state.exitSelectionMode);
  const selectAll = useSelectionStore(state => state.selectAll);
  const deselectAll = useSelectionStore(state => state.deselectAll);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const favoritesStore = useFavoritesStore();

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  // Intercept Android hardware back press when selection mode is active
  useEffect(() => {
    if (!isSelectionMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitSelectionMode();
      return true;
    });
    return () => sub.remove();
  }, [isSelectionMode, exitSelectionMode]);

  if (!isSelectionMode) return null;
  const count = selectedIds.size;
  const isAllSelected = count > 0 && count === availableIds.length;

  // ---------------------------------------------------------------------------
  // Action handler
  // ---------------------------------------------------------------------------
  const handleAction = async (action: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (isWorking) return;

    const privacyStore = usePrivacyStore.getState();
    const mediaStore = useMediaStore.getState();

    setMoreMenuVisible(false);

    if (action === 'delete') {
      setDeleteModalVisible(true);
      return;
    }

    setIsWorking(true);
    try {
      if (selectionContext === 'media') {
        switch (action) {
          case 'private': {
            await privacyStore.makeAssetsPrivate(ids);
            exitSelectionMode();
            toastController.show({
              message: `${ids.length} ${ids.length === 1 ? 'item' : 'items'} moved to Private Vault`,
              type: 'success',
            });
            break;
          }
          case 'archive': {
            await privacyStore.archiveAssets(ids);
            exitSelectionMode();
            toastController.show({
              message: `${ids.length} ${ids.length === 1 ? 'item' : 'items'} archived`,
              type: 'success',
            });
            break;
          }
          case 'favorite': {
            const allMedia = mediaStore.media;
            for (const id of ids) {
              const item = allMedia.find(m => m.id === id);
              if (item) favoritesStore.toggleFavorite(id, item);
            }
            exitSelectionMode();
            toastController.show({
              message: `${ids.length} ${ids.length === 1 ? 'item' : 'items'} updated in Favorites`,
              type: 'success',
            });
            break;
          }
          case 'share': {
            // Gather URIs for all selected items
            const allMedia = mediaStore.media;
            const selectedItems = ids
              .map(id => allMedia.find(m => m.id === id))
              .filter(Boolean) as typeof allMedia;

            if (selectedItems.length === 0) break;
            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
              toastController.show({ message: 'Sharing is not available on this device', type: 'error' });
              break;
            }
            // Share first item (OS share sheet handles one file at a time on Android)
            await Sharing.shareAsync(selectedItems[0].uri);
            exitSelectionMode();
            break;
          }
        }
      } else if (selectionContext === 'album') {
        switch (action) {
          case 'lock': {
            for (const id of ids) await privacyStore.lockAlbumContent(id);
            exitSelectionMode();
            toastController.show({
              message: `${ids.length} ${ids.length === 1 ? 'album' : 'albums'} locked`,
              type: 'success',
            });
            break;
          }
          case 'unlock': {
            for (const id of ids) await privacyStore.unlockAlbumContent(id);
            exitSelectionMode();
            toastController.show({
              message: `${ids.length} ${ids.length === 1 ? 'album' : 'albums'} unlocked`,
              type: 'success',
            });
            break;
          }
          case 'share':
            // Albums cannot be shared as a unit
            toastController.show({ message: 'Select photos inside an album to share them', type: 'info' });
            break;
        }
      }
    } catch (e) {
      console.error('[GlobalSelectionBar] Bulk action failed', action, e);
      toastController.show({ message: 'Action failed. Please try again.', type: 'error' });
    } finally {
      setIsWorking(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete confirmation
  // ---------------------------------------------------------------------------
  const handleConfirmDelete = async () => {
    const ids = Array.from(selectedIds);
    const mediaStore = useMediaStore.getState();
    const albumsStore = useAlbumsStore.getState();

    setDeleteModalVisible(false);
    setIsWorking(true);
    try {
      if (selectionContext === 'media') {
        const successCount = await mediaStore.batchDeleteMediaAsync(ids);
        if (successCount >= ids.length) {
          exitSelectionMode();
        }
        toastController.show({
          message:
            successCount === ids.length
              ? `${successCount} ${successCount === 1 ? 'item' : 'items'} moved to Trash`
              : `${successCount} of ${ids.length} items moved to Trash`,
          type: successCount === ids.length ? 'success' : 'info',
        });
      } else if (selectionContext === 'album') {
        // Correctly delete albums — not unlock them
        for (const id of ids) albumsStore.deleteAlbum(id);
        exitSelectionMode();
        toastController.show({
          message: `${ids.length} ${ids.length === 1 ? 'album' : 'albums'} deleted`,
          type: 'success',
        });
      }
    } catch (e) {
      console.error('[GlobalSelectionBar] Delete failed', e);
      toastController.show({ message: 'Deletion failed. Please try again.', type: 'error' });
    } finally {
      setIsWorking(false);
    }
  };

  // ---------------------------------------------------------------------------
  // More menu — context-aware options
  // ---------------------------------------------------------------------------
  const moreOptions: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; action: string; destructive?: boolean }[] =
    selectionContext === 'media'
      ? [
          { label: 'Move to Vault', icon: 'shield-checkmark-outline', action: 'private' },
          { label: 'Archive', icon: 'archive-outline', action: 'archive' },
        ]
      : [
          { label: 'Lock Selected', icon: 'lock-closed-outline', action: 'lock' },
          { label: 'Unlock Selected', icon: 'lock-open-outline', action: 'unlock' },
        ];

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Top Bar (enters downward from above, exits upward)                 */}
      {/* ------------------------------------------------------------------ */}
          <Animated.View
            entering={FadeInUp.duration(200)}
            exiting={FadeOutUp.duration(180)}
            style={[
              styles.topBar,
              {
                paddingTop: Math.max(insets.top, 20),
                backgroundColor: theme.isDark ? 'rgba(28, 28, 30, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                borderBottomColor: theme.border,
              },
            ]}
          >
            <View style={styles.topContent}>
              <Pressable onPress={exitSelectionMode} style={styles.iconBtn} hitSlop={10}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>

              <Text style={[styles.title, { color: theme.text }]}>
                {count} {count === 1 ? 'Selected' : 'Selected'}
              </Text>

              <View style={styles.topActions}>
                <Pressable
                  onPress={isAllSelected ? deselectAll : selectAll}
                  style={[styles.textBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)' }]}
                >
                  <Text style={[styles.textBtnLabel, { color: theme.text }]}>
                    {isAllSelected ? 'Deselect All' : 'Select All'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMoreMenuVisible(true)}
                  style={styles.iconBtn}
                  hitSlop={10}
                  disabled={isWorking}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
                </Pressable>
              </View>
            </View>
          </Animated.View>

          {/* ------------------------------------------------------------------ */}
          {/* Bottom Action Bar (enters upward from below, exits downward)       */}
          {/* ------------------------------------------------------------------ */}
          <Animated.View
            entering={FadeInDown.duration(200)}
            exiting={FadeOutDown.duration(180)}
            style={[
              styles.bottomBar,
              {
                bottom: tabBarHeight,
                paddingBottom: Math.max(insets.bottom, 12),
                backgroundColor: theme.isDark ? 'rgba(28, 28, 30, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                borderTopColor: theme.border,
              },
            ]}
          >
            <View style={styles.bottomContent}>
              {/* Share */}
              <Pressable
                onPress={() => handleAction('share')}
                style={styles.actionItem}
                hitSlop={8}
                disabled={isWorking}
              >
                <Ionicons name="share-outline" size={22} color={theme.text} />
                <Text style={[styles.actionLabel, { color: theme.text }]}>Share</Text>
              </Pressable>

              {/* Favorite — media only */}
              {selectionContext === 'media' && (
                <Pressable
                  onPress={() => handleAction('favorite')}
                  style={styles.actionItem}
                  hitSlop={8}
                  disabled={isWorking}
                >
                  <Ionicons name="heart-outline" size={22} color={theme.text} />
                  <Text style={[styles.actionLabel, { color: theme.text }]}>Favorite</Text>
                </Pressable>
              )}

              {/* Archive — media only */}
              {selectionContext === 'media' && (
                <Pressable
                  onPress={() => handleAction('archive')}
                  style={styles.actionItem}
                  hitSlop={8}
                  disabled={isWorking}
                >
                  <Ionicons name="archive-outline" size={22} color={theme.text} />
                  <Text style={[styles.actionLabel, { color: theme.text }]}>Archive</Text>
                </Pressable>
              )}

              {/* Lock — album only */}
              {selectionContext === 'album' && (
                <Pressable
                  onPress={() => handleAction('lock')}
                  style={styles.actionItem}
                  hitSlop={8}
                  disabled={isWorking}
                >
                  <Ionicons name="lock-closed-outline" size={22} color={theme.text} />
                  <Text style={[styles.actionLabel, { color: theme.text }]}>Lock</Text>
                </Pressable>
              )}

              {/* Delete — always shown, red */}
              <Pressable
                onPress={() => handleAction('delete')}
                style={styles.actionItem}
                hitSlop={8}
                disabled={isWorking}
              >
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
                <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Delete</Text>
              </Pressable>
            </View>
          </Animated.View>

      {/* ------------------------------------------------------------------ */}
      {/* More Options Bottom Sheet (cross-platform, themed)                 */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMoreMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.menuSheet,
                  {
                    backgroundColor: theme.isDark ? '#1C1C1E' : '#FFFFFF',
                    borderColor: theme.border,
                    paddingBottom: Math.max(insets.bottom, 16),
                  },
                ]}
              >
                {/* Grab handle */}
                <View style={[styles.menuHandle, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)' }]} />

                <Text style={[styles.menuTitle, { color: theme.textMuted }]}>
                  More Options
                </Text>

                {moreOptions.map(opt => (
                  <Pressable
                    key={opt.action}
                    style={({ pressed }) => [
                      styles.menuRow,
                      { backgroundColor: pressed ? (theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent' },
                    ]}
                    onPress={() => handleAction(opt.action)}
                  >
                    <Ionicons name={opt.icon} size={20} color={opt.destructive ? '#EF4444' : theme.accent} style={styles.menuIcon} />
                    <Text style={[styles.menuLabel, { color: opt.destructive ? '#EF4444' : theme.text }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}

                {/* Cancel */}
                <Pressable
                  style={({ pressed }) => [
                    styles.menuCancelRow,
                    { backgroundColor: pressed ? (theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent' },
                  ]}
                  onPress={() => setMoreMenuVisible(false)}
                >
                  <Text style={[styles.menuCancelLabel, { color: theme.textMuted }]}>Cancel</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Delete Confirmation Modal                                           */}
      {/* ------------------------------------------------------------------ */}
      <DeleteConfirmModal
        visible={deleteModalVisible}
        title={
          selectionContext === 'album'
            ? count === 1 ? 'Delete Album?' : `Delete ${count} Albums?`
            : count === 1 ? 'Delete Photo?' : `Delete ${count} Items?`
        }
        message={
          selectionContext === 'album'
            ? 'Photos inside will remain on your device.'
            : 'Items can be recovered from Trash within 30 days.'
        }
        confirmText={selectionContext === 'album' ? 'Delete' : 'Move to Trash'}
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginLeft: 12,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  textBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconBtn: {
    padding: 6,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 100,
    elevation: 10,
  },
  bottomContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  // More menu sheet
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
    marginBottom: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 10,
    marginVertical: 1,
  },
  menuIcon: {
    marginRight: 14,
    width: 24,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuCancelRow: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
    borderRadius: 10,
  },
  menuCancelLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
