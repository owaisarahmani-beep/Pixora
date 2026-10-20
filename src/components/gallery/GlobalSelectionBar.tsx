import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActionSheetIOS, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSelectionStore } from '../../store/useSelectionStore';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import DeleteConfirmModal from '../common/DeleteConfirmModal';

export default function GlobalSelectionBar({ tabBarHeight = 0 }: { tabBarHeight?: number }) {
  const { isSelectionMode, selectionContext, selectedIds, availableIds, exitSelectionMode, selectAll, deselectAll } = useSelectionStore();
  const insets = useSafeAreaInsets();
  const favoritesStore = useFavoritesStore();
  
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  if (!isSelectionMode) return null;
  const count = selectedIds.size;
  const isAllSelected = count > 0 && count === availableIds.length;

  const handleAction = async (action: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const privacyStore = usePrivacyStore.getState();
    const mediaStore = useMediaStore.getState();

    try {
      if (selectionContext === 'media') {
        switch (action) {
          case 'private':
            await privacyStore.makeAssetsPrivate(ids);
            break;
          case 'archive':
            await privacyStore.archiveAssets(ids);
            break;
          case 'favorite': {
            const allMedia = mediaStore.media;
            for (const id of ids) {
              const item = allMedia.find(m => m.id === id);
              if (item) {
                favoritesStore.toggleFavorite(id, item);
              }
            }
            break;
          }
          case 'share': {
            const allMedia = mediaStore.media;
            const firstItem = allMedia.find(m => m.id === ids[0]);
            if (firstItem && await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(firstItem.uri);
            }
            break;
          }
          case 'delete':
            setDeleteModalVisible(true);
            return;
        }
      } else if (selectionContext === 'album') {
        switch (action) {
          case 'lock':
            for (const id of ids) await privacyStore.lockAlbumContent(id);
            break;
          case 'unlock':
            for (const id of ids) await privacyStore.unlockAlbumContent(id);
            break;
          case 'delete':
            setDeleteModalVisible(true);
            return;
          case 'share':
            break;
        }
      }
    } catch (e) {
      console.error('Bulk action failed', e);
    }
    
    exitSelectionMode();
  };

  const handleConfirmDelete = async () => {
    const ids = Array.from(selectedIds);
    const mediaStore = useMediaStore.getState();
    const privacyStore = usePrivacyStore.getState();

    setDeleteModalVisible(false);
    if (selectionContext === 'media') {
      for (const id of ids) {
        await mediaStore.deleteMediaAsync(id);
      }
    } else if (selectionContext === 'album') {
      for (const id of ids) {
        await privacyStore.unlockAlbumContent(id);
      }
    }
    exitSelectionMode();
  };

  const openMore = () => {
    if (Platform.OS === 'ios') {
      const options = ['Cancel', 'Move to Vault', 'Archive'];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0 },
        (btnIndex) => {
          if (btnIndex === 1) handleAction('private');
          if (btnIndex === 2) handleAction('archive');
        }
      );
    } else {
      Alert.alert("More Options", undefined, [
        { text: "Move to Vault", onPress: () => handleAction('private') },
        { text: "Archive", onPress: () => handleAction('archive') },
        { text: "Cancel", style: "cancel" }
      ]);
    }
  };

  return (
    <>
      {/* Top Bar */}
      <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[styles.topBar, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.topContent}>
          <Pressable onPress={exitSelectionMode} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="close" size={26} color="#FFF" />
          </Pressable>
          
          <Text style={styles.title}>{count} Selected</Text>
          
          <View style={styles.topActions}>
            <Pressable onPress={isAllSelected ? deselectAll : selectAll} style={styles.textBtn}>
              <Text style={styles.textBtnLabel}>{isAllSelected ? 'Deselect All' : 'Select All'}</Text>
            </Pressable>
            <Pressable onPress={openMore} style={styles.iconBtn} hitSlop={10}>
              <Ionicons name="ellipsis-vertical" size={22} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Bottom Action Area — sits directly above bottom edge */}
      <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[styles.bottomBar, { bottom: tabBarHeight, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.bottomContent}>
          <Pressable onPress={() => handleAction('share')} style={styles.actionItem} hitSlop={8}>
            <Ionicons name="share-outline" size={24} color="#FFF" />
            <Text style={styles.actionLabel}>Share</Text>
          </Pressable>
          
          {selectionContext === 'media' && (
            <Pressable onPress={() => handleAction('favorite')} style={styles.actionItem} hitSlop={8}>
              <Ionicons name="heart-outline" size={24} color="#FFF" />
              <Text style={styles.actionLabel}>Favorite</Text>
            </Pressable>
          )}

          {selectionContext === 'album' && (
            <Pressable onPress={() => handleAction('lock')} style={styles.actionItem} hitSlop={8}>
              <Ionicons name="lock-closed-outline" size={24} color="#FFF" />
              <Text style={styles.actionLabel}>Lock</Text>
            </Pressable>
          )}

          {selectionContext === 'media' && (
            <Pressable onPress={() => handleAction('archive')} style={styles.actionItem} hitSlop={8}>
              <Ionicons name="archive-outline" size={24} color="#FFF" />
              <Text style={styles.actionLabel}>Archive</Text>
            </Pressable>
          )}
          
          <Pressable onPress={() => handleAction('delete')} style={styles.actionItem} hitSlop={8}>
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
            <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Delete</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Modern Delete Confirmation Dialog */}
      <DeleteConfirmModal
        visible={deleteModalVisible}
        title={selectionContext === 'album' ? (count === 1 ? 'Delete Album?' : `Delete ${count} Albums?`) : (count === 1 ? 'Delete Photo?' : `Delete ${count} Items?`)}
        message={selectionContext === 'album' ? undefined : 'Items can be recovered from Trash within 30 days.'}
        confirmText="Move to Trash"
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(28, 28, 30, 0.96)',
    zIndex: 100,
    elevation: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  topContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  title: {
    color: '#FFF',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  textBtnLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  iconBtn: {
    padding: 6,
  },
  bottomBar: {
    position: 'absolute',
    left: 0, right: 0,
    backgroundColor: 'rgba(28, 28, 30, 0.96)',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
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
    color: '#FFF',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
});
