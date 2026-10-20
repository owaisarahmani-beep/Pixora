import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TouchableWithoutFeedback, Alert, Platform, ActionSheetIOS } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import { useViewerStore } from '../../store/useViewerStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { useMediaStore } from '../../store/useMediaStore';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import DeleteConfirmModal from '../common/DeleteConfirmModal';

interface Props {
  item: PixoraMediaInfo;
}

export default function ViewerControls({ item }: Props) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const source = Array.isArray(params.source) ? params.source[0] : (params.source as string) || 'gallery';

  const insets = useSafeAreaInsets();
  const { controlsVisible, setDetailsVisible } = useViewerStore();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { deleteMediaAsync } = useMediaStore();
  
  const opacity = useSharedValue(1);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    opacity.value = withTiming(controlsVisible ? 1 : 0, { duration: 200 });
  }, [controlsVisible, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleShare = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(item.uri);
      }
    } catch (e) {
      console.error('Share failed', e);
    }
  };

  const handleEdit = () => {
    if (item.mediaType === 'photo') {
      router.push({ pathname: '/editor/[id]', params: { id: item.id, source } });
    } else {
      Alert.alert('Video Editing', 'Editing tools are currently designed for photos.');
    }
  };

  const isFavorite = favorites.has(item.id);
  const isPrivate = usePrivacyStore(state => state.isAssetPrivate(item.id));
  const isArchived = usePrivacyStore(state => state.isAssetArchived(item.id));

  const handleMoreAction = async (action: string) => {
    setMoreMenuVisible(false);
    const privacyStore = usePrivacyStore.getState();

    switch (action) {
      case 'edit':
        handleEdit();
        break;
      case 'details':
        setDetailsVisible(true);
        break;
      case 'private':
        await privacyStore.makeAssetsPrivate([item.id]);
        router.back();
        break;
      case 'unprivate':
        await privacyStore.removeAssetsFromPrivate([item.id]);
        break;
      case 'archive':
        await privacyStore.archiveAssets([item.id]);
        router.back();
        break;
      case 'unarchive':
        await privacyStore.unarchiveAssets([item.id]);
        break;
      case 'delete':
        setShowDeleteModal(true);
        break;
    }
  };

  const openMoreMenu = () => {
    if (Platform.OS === 'ios') {
      const options = ['Cancel', 'Details'];
      if (item.mediaType === 'photo') options.push('Edit');
      if (isPrivate) options.push('Remove from Vault'); else options.push('Make Private');
      if (isArchived) options.push('Unarchive'); else options.push('Archive');
      options.push('Delete');

      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: options.length - 1, cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 0) return;
          const actionMap: Record<string, string> = {
            'Details': 'details', 'Edit': 'edit',
            'Make Private': 'private', 'Remove from Vault': 'unprivate',
            'Archive': 'archive', 'Unarchive': 'unarchive',
            'Delete': 'delete'
          };
          const selectedAction = actionMap[options[buttonIndex]];
          if (selectedAction) handleMoreAction(selectedAction);
        }
      );
    } else {
      setMoreMenuVisible(true);
    }
  };

  return (
    <>
      <Animated.View style={[styles.container, animatedStyle]} pointerEvents={controlsVisible ? 'box-none' : 'none'}>
        {/* Top Bar: Back & More */}
        <View style={[styles.topBar, { paddingTop: insets.top || 20 }]}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityRole="button">
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </Pressable>
          <Pressable onPress={openMoreMenu} style={styles.iconButton} accessibilityRole="button">
            <Ionicons name="ellipsis-vertical" size={24} color="#FFF" />
          </Pressable>
        </View>

        {/* Bottom Bar: 4 Primary Icon Actions (Favorite, Edit, Share, Delete) */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.bottomBarInner}>
            {/* 1. Favorite */}
            <Pressable onPress={() => toggleFavorite(item.id, item)} style={styles.actionButton} hitSlop={12}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={26}
                color={isFavorite ? '#EF4444' : '#FFF'}
              />
            </Pressable>

            {/* 2. Edit */}
            {item.mediaType === 'photo' ? (
              <Pressable onPress={handleEdit} style={styles.actionButton} hitSlop={12}>
                <Ionicons
                  name="color-wand-outline"
                  size={26}
                  color="#FFF"
                />
              </Pressable>
            ) : null}

            {/* 3. Share */}
            <Pressable onPress={handleShare} style={styles.actionButton} hitSlop={12}>
              <Ionicons name="share-outline" size={26} color="#FFF" />
            </Pressable>

            {/* 4. Delete */}
            <Pressable onPress={() => setShowDeleteModal(true)} style={styles.actionButton} hitSlop={12}>
              <Ionicons name="trash-outline" size={26} color="#EF4444" />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Android Custom More Menu */}
      {Platform.OS !== 'ios' && (
        <Modal visible={moreMenuVisible} transparent animationType="fade" onRequestClose={() => setMoreMenuVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setMoreMenuVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>More Options</Text>
                  
                  <Pressable style={styles.modalItem} onPress={() => handleMoreAction('details')}>
                    <Ionicons name="information-circle-outline" size={24} color="#FFF" />
                    <Text style={styles.modalItemText}>Details</Text>
                  </Pressable>

                  {item.mediaType === 'photo' && (
                    <Pressable style={styles.modalItem} onPress={() => handleMoreAction('edit')}>
                      <Ionicons name="color-wand-outline" size={24} color="#FFF" />
                      <Text style={styles.modalItemText}>Edit</Text>
                    </Pressable>
                  )}

                  <Pressable style={styles.modalItem} onPress={() => handleMoreAction(isPrivate ? 'unprivate' : 'private')}>
                    <Ionicons name={isPrivate ? "lock-open-outline" : "lock-closed-outline"} size={24} color="#FFF" />
                    <Text style={styles.modalItemText}>{isPrivate ? 'Remove from Vault' : 'Make Private'}</Text>
                  </Pressable>

                  <Pressable style={styles.modalItem} onPress={() => handleMoreAction(isArchived ? 'unarchive' : 'archive')}>
                    <Ionicons name={isArchived ? "archive" : "archive-outline"} size={24} color="#FFF" />
                    <Text style={styles.modalItemText}>{isArchived ? 'Unarchive' : 'Archive'}</Text>
                  </Pressable>

                  <Pressable style={[styles.modalItem, { borderBottomWidth: 0, marginTop: 8 }]} onPress={() => handleMoreAction('delete')}>
                    <Ionicons name="trash-outline" size={24} color="#EF4444" />
                    <Text style={[styles.modalItemText, { color: '#EF4444' }]}>Delete</Text>
                  </Pressable>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Sleek Delete Confirmation Modal */}
      <DeleteConfirmModal
        visible={showDeleteModal}
        title={item.mediaType === 'video' ? 'Delete Video?' : 'Delete Photo?'}
        message="You can restore this from Trash within 30 days."
        confirmText="Move to Trash"
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          setShowDeleteModal(false);
          const success = await deleteMediaAsync(item.id);
          if (success) {
            router.back();
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bottomBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 44,
  },
  iconButton: {
    padding: 8,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    minWidth: 52,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  modalItemText: {
    color: '#FFF',
    fontSize: 15,
    marginLeft: 16,
    fontWeight: '500',
  },
});
