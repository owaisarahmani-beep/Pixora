import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useTrashStore, TrashedItem, ensureTrashHydrated } from '../store/useTrashStore';
import { useMediaStore } from '../store/useMediaStore';
import { useAlbumsStore } from '../store/useAlbumsStore';
import { mediaStoreService } from '../services/media/MediaStoreService';
import { PixoraMediaInfo } from '../services/media/mediaTypes';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import EmptyStateView from '../components/common/EmptyStateView';
import { toastController } from '../components/common/Toast';
import * as MediaLibrary from 'expo-media-library/legacy';

const NUM_COLUMNS = 3;
const GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const THUMB_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function TrashScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const items = useTrashStore(state => state.items);
  const restoreItems = useTrashStore(state => state.restoreItems);
  const permanentlyDelete = useTrashStore(state => state.permanentlyDelete);
  const getDaysRemaining = useTrashStore(state => state.getDaysRemaining);
  const refreshMedia = useMediaStore(state => state.refreshMedia);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedIds.size > 0;
  const [isDeleting, setIsDeleting] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => Promise<void>;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    onConfirm: async () => {},
  });

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleLongPress = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
  }, []);

  const handleRestore = async () => {
    const ids = Array.from(selectedIds);
    await ensureTrashHydrated();

    // 1. Snapshot items from trash store BEFORE deleting them
    const trashItems = useTrashStore.getState().items;
    const itemsToRestore = trashItems.filter(i => ids.includes(String(i.id)));

    // 2. Perform trash store restoration (updates restoredTimestamps & persistent restoredItems)
    restoreItems(ids);
    setSelectedIds(new Set());

    // 3. Convert to PixoraMediaInfo baseline
    const restoredBaseline: PixoraMediaInfo[] = itemsToRestore.map(i => ({
      id: String(i.id),
      uri: i.uri,
      filename: i.filename,
      mediaType: i.mediaType,
      width: i.width,
      height: i.height,
      creationTime: i.creationTime,
      modificationTime: i.modificationTime || i.creationTime,
      duration: i.duration,
    }));

    // 4. Try fetching updated native assets if available on Android MediaStore, merging with baseline
    try {
      const nativeAssets = await mediaStoreService.getAssetsByIdsAsync(ids);
      const trashStore = useTrashStore.getState();
      for (const asset of nativeAssets) {
        const idx = restoredBaseline.findIndex(b => b.id === asset.id);
        const baselineTime = idx >= 0 ? restoredBaseline[idx].creationTime : undefined;
        const preserved = trashStore.getPreservedTimestamp?.(asset.id, asset.uri) || baselineTime;
        if (preserved && preserved > 0) {
          asset.creationTime = preserved;
        }
        if (idx >= 0) {
          restoredBaseline[idx] = { ...restoredBaseline[idx], ...asset };
        } else {
          restoredBaseline.push(asset);
        }
      }
    } catch {}

    // 5. Register enriched restored items with stable identity back into useTrashStore
    if (restoredBaseline.length > 0) {
      useTrashStore.getState().registerRestoredItems(restoredBaseline);
      useMediaStore.getState().upsertMedia(restoredBaseline);
    }

    await refreshMedia();
    useAlbumsStore.getState().loadAlbums(true);
    toastController.show({
      message: `${ids.length} ${ids.length === 1 ? 'item' : 'items'} restored to gallery`,
      type: 'success',
    });
  };

  const handleDeleteForever = () => {
    if (isDeleting || selectedIds.size === 0) return;
    const count = selectedIds.size;
    const isSingle = count === 1;

    setConfirmModal({
      visible: true,
      title: isSingle ? 'Delete Item Forever?' : `Delete ${count} Items Forever?`,
      message: isSingle
        ? 'This item will be permanently removed from device storage. This cannot be undone.'
        : `All ${count} selected items will be permanently removed from device storage. This cannot be undone.`,
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        if (isDeleting) return;
        // Dismiss confirmation modal immediately before triggering native OS dialog
        setConfirmModal(prev => ({ ...prev, visible: false }));
        setIsDeleting(true);
        try {
          await ensureTrashHydrated();
          const ids = Array.from(selectedIds);
          const targetItems = items.filter(i => ids.includes(String(i.id)));
          let deletedSuccessfully: string[] = [];
          let deletedUris: string[] = [];

          try {
            // Batch delete in a single native OS call so Android only shows one confirmation dialog
            const success = await MediaLibrary.deleteAssetsAsync(ids);
            if (success) {
              deletedSuccessfully = ids;
              deletedUris = targetItems.map(i => i.uri).filter(Boolean);
            } else {
              // Partial check via MediaStore query
              const remaining = await mediaStoreService.getAssetsByIdsAsync(ids);
              const remainingIds = new Set(remaining.map(r => String(r.id)));
              deletedSuccessfully = ids.filter(id => !remainingIds.has(id));
              deletedUris = targetItems
                .filter(i => !remainingIds.has(String(i.id)) && i.uri)
                .map(i => i.uri);
            }
          } catch (e) {
            console.warn('[Pixora Trash] Bulk deleteAssetsAsync threw error, checking surviving assets:', e);
            try {
              const remaining = await mediaStoreService.getAssetsByIdsAsync(ids);
              const remainingIds = new Set(remaining.map(r => String(r.id)));
              deletedSuccessfully = ids.filter(id => !remainingIds.has(id));
              deletedUris = targetItems
                .filter(i => !remainingIds.has(String(i.id)) && i.uri)
                .map(i => i.uri);
            } catch {}
          }

          if (deletedSuccessfully.length > 0) {
            // Decrement album counts directly in useAlbumsStore for instant accuracy
            const albumCounts = new Map<string, number>();
            for (const item of targetItems) {
              if (deletedSuccessfully.includes(String(item.id)) && item.albumId) {
                albumCounts.set(item.albumId, (albumCounts.get(item.albumId) || 0) + 1);
              }
            }
            if (albumCounts.size > 0) {
              useAlbumsStore.getState().decrementAlbumCounts(albumCounts);
            }

            permanentlyDelete(deletedSuccessfully, deletedUris);
            const deletedSet = new Set(deletedSuccessfully);
            setSelectedIds(prev => new Set(Array.from(prev).filter(id => !deletedSet.has(id))));
            await refreshMedia();
            useAlbumsStore.getState().loadAlbums(true);
            toastController.show({
              message: `${deletedSuccessfully.length} ${deletedSuccessfully.length === 1 ? 'item' : 'items'} permanently deleted`,
              type: 'info',
            });
          }

          if (deletedSuccessfully.length === 0) {
            toastController.show({
              message: 'Deletion cancelled',
              type: 'info',
            });
          } else if (deletedSuccessfully.length < ids.length) {
            Alert.alert(
              'Partial Deletion',
              `${deletedSuccessfully.length} of ${ids.length} items were deleted. Remaining items could not be deleted because system permission was declined.`
            );
          }
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleEmptyTrash = () => {
    if (isDeleting || items.length === 0) return;

    setConfirmModal({
      visible: true,
      title: 'Empty Recently Deleted?',
      message: 'All items in Recently Deleted will be permanently deleted. This action cannot be undone.',
      confirmText: 'Empty Trash',
      onConfirm: async () => {
        if (isDeleting) return;
        // Dismiss confirmation modal immediately before triggering native OS dialog
        setConfirmModal(prev => ({ ...prev, visible: false }));
        setIsDeleting(true);
        try {
          await ensureTrashHydrated();
          const allIds = items.map(i => String(i.id));
          let deletedSuccessfully: string[] = [];
          let deletedUris: string[] = [];

          try {
            // Batch delete all trash items in a single OS call: triggers exactly ONE system dialog
            const success = await MediaLibrary.deleteAssetsAsync(allIds);
            if (success) {
              deletedSuccessfully = allIds;
              deletedUris = items.map(i => i.uri).filter(Boolean);
            } else {
              // Partial check via MediaStore query
              const remaining = await mediaStoreService.getAssetsByIdsAsync(allIds);
              const remainingIds = new Set(remaining.map(r => String(r.id)));
              deletedSuccessfully = allIds.filter(id => !remainingIds.has(id));
              deletedUris = items
                .filter(i => !remainingIds.has(String(i.id)) && i.uri)
                .map(i => i.uri);
            }
          } catch (e) {
            console.warn('[Pixora Trash] Empty trash threw error, checking surviving assets:', e);
            try {
              const remaining = await mediaStoreService.getAssetsByIdsAsync(allIds);
              const remainingIds = new Set(remaining.map(r => String(r.id)));
              deletedSuccessfully = allIds.filter(id => !remainingIds.has(id));
              deletedUris = items
                .filter(i => !remainingIds.has(String(i.id)) && i.uri)
                .map(i => i.uri);
            } catch {}
          }

          if (deletedSuccessfully.length > 0) {
            // Decrement album counts directly in useAlbumsStore for instant accuracy
            const albumCounts = new Map<string, number>();
            for (const item of items) {
              if (deletedSuccessfully.includes(String(item.id)) && item.albumId) {
                albumCounts.set(item.albumId, (albumCounts.get(item.albumId) || 0) + 1);
              }
            }
            if (albumCounts.size > 0) {
              useAlbumsStore.getState().decrementAlbumCounts(albumCounts);
            }

            permanentlyDelete(deletedSuccessfully, deletedUris);
            setSelectedIds(new Set());
            await refreshMedia();
            useAlbumsStore.getState().loadAlbums(true);
            toastController.show({
              message: 'Recently Deleted emptied',
              type: 'info',
            });
          }

          if (deletedSuccessfully.length === 0) {
            toastController.show({
              message: 'Deletion cancelled',
              type: 'info',
            });
          } else if (deletedSuccessfully.length < allIds.length) {
            Alert.alert(
              'Partial Deletion',
              `${deletedSuccessfully.length} of ${allIds.length} items were deleted. Remaining items could not be deleted because system permission was declined.`
            );
          }
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const ITEM_ROW_HEIGHT = THUMB_SIZE + GAP;
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_ROW_HEIGHT,
      offset: ITEM_ROW_HEIGHT * Math.floor(index / NUM_COLUMNS),
      index,
    }),
    [ITEM_ROW_HEIGHT]
  );

  const renderItem = useCallback(({ item }: { item: TrashedItem }) => {
    const isSelected = selectedIds.has(item.id);
    const daysLeft = getDaysRemaining(item.trashedAt);

    return (
      <Pressable
        onPress={() => {
          if (isSelectionMode) {
            toggleSelection(item.id);
          } else {
            router.push({ pathname: '/trash-viewer', params: { id: item.id } });
          }
        }}
        onLongPress={() => handleLongPress(item.id)}
        style={[
          styles.thumbnail,
          isSelected && styles.thumbnailSelected,
        ]}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          allowDownscaling={true}
          recyclingKey={item.id}
          transition={0}
        />
        {/* Days remaining overlay */}
        <View style={styles.daysOverlay}>
          <Text style={styles.daysText}>{daysLeft}d left</Text>
        </View>
        {/* Selection indicator */}
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
          </View>
        )}
        {/* Video indicator */}
        {item.mediaType === 'video' && (
          <View style={styles.videoIndicator}>
            <Ionicons name="play" size={14} color="#FFFFFF" />
          </View>
        )}
      </Pressable>
    );
  }, [selectedIds, isSelectionMode, toggleSelection, handleLongPress, getDaysRemaining]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Recently Deleted',
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
          ),
          headerRight: () =>
            items.length > 0 ? (
              <Pressable onPress={handleEmptyTrash} disabled={isDeleting} style={isDeleting && { opacity: 0.5 }}>
                <Text style={[styles.emptyTrashBtn, { color: '#EF4444' }]}>
                  {isDeleting ? 'Deleting...' : 'Empty'}
                </Text>
              </Pressable>
            ) : null,
        }}
      />

      {items.length === 0 ? (
        <EmptyStateView
          icon="trash-outline"
          title="Trash is Empty"
          description="Deleted items stay here for 30 days before permanent removal."
          actionLabel="Return to Gallery"
          onAction={() => router.back()}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialNumToRender={18}
          maxToRenderPerBatch={18}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ paddingBottom: insets.bottom + (isSelectionMode ? 90 : 20) }}
        />
      )}

      {/* Bottom action bar when items are selected */}
      {isSelectionMode && (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.surface,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <Pressable 
            style={[styles.barBtn, { borderColor: theme.accent }, isDeleting && { opacity: 0.5 }]} 
            onPress={handleRestore}
            disabled={isDeleting}
          >
            <Ionicons name="refresh-outline" size={18} color={theme.accent} />
            <Text style={[styles.barBtnText, { color: theme.accent }]}>Restore</Text>
          </Pressable>
          <Pressable
            style={[styles.barBtn, { borderColor: '#EF4444', backgroundColor: '#EF444420' }, isDeleting && { opacity: 0.5 }]}
            onPress={handleDeleteForever}
            disabled={isDeleting}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={[styles.barBtnText, { color: '#EF4444' }]}>
              {isDeleting ? 'Deleting...' : 'Delete Forever'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Sleek Delete Confirmation Modal */}
      <DeleteConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        onConfirm={confirmModal.onConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 8,
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumbnailSelected: {
    opacity: 0.7,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  daysOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  daysText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 3,
  },
  emptyTrashBtn: {
    fontSize: 15,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  barBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  barBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
