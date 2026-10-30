import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TouchableWithoutFeedback, Platform, ActionSheetIOS } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { shareService } from '../../services/share/ShareService';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  useSharedValue, 
  interpolate, 
  Extrapolation, 
  SharedValue 
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import { useViewerStore } from '../../store/useViewerStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { useMediaStore } from '../../store/useMediaStore';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { normalizeTimestamp } from '../../utils/dateGrouping';
import DeleteConfirmModal from '../common/DeleteConfirmModal';
import { toastController } from '../common/Toast';

interface Props {
  item: PixoraMediaInfo;
  detailsProgress?: SharedValue<number>;
  onDeleteMedia?: (item: PixoraMediaInfo) => Promise<boolean>;
}

export default function ViewerControls({ item, detailsProgress, onDeleteMedia }: Props) {
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

  const topBarAnimatedStyle = useAnimatedStyle(() => {
    if (!detailsProgress) return {};
    const topOpacity = interpolate(
      detailsProgress.value,
      [0, 0.4],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity: topOpacity,
    };
  });

  const bottomBarAnimatedStyle = useAnimatedStyle(() => {
    if (!detailsProgress) return {};
    const opacity = interpolate(
      detailsProgress.value,
      [0, 0.35],
      [1, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      detailsProgress.value,
      [0, 1],
      [0, 40],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const handleShare = async () => {
    try {
      await shareService.shareSingleAsync(item);
    } catch (e) {
      console.error('Share failed', e);
    }
  };

  const handleEdit = () => {
    if (item.mediaType === 'photo') {
      router.push({ pathname: '/editor/[id]', params: { id: item.id, source } });
    } else {
      setDetailsVisible(true);
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
        toastController.show({ message: 'Moved to Private Vault', type: 'success' });
        router.back();
        break;
      case 'unprivate':
        await privacyStore.removeAssetsFromPrivate([item.id]);
        toastController.show({ message: 'Removed from Private Vault', type: 'success' });
        break;
      case 'archive':
        await privacyStore.archiveAssets([item.id]);
        toastController.show({ message: 'Item archived', type: 'success' });
        router.back();
        break;
      case 'unarchive':
        await privacyStore.unarchiveAssets([item.id]);
        toastController.show({ message: 'Item unarchived', type: 'success' });
        break;
      case 'delete':
        setShowDeleteModal(true);
        break;
    }
  };

  const openMoreMenu = () => {
    if (Platform.OS === 'ios') {
      const options = ['Cancel', 'Details'];
      if (isPrivate) options.push('Remove from Vault'); else options.push('Make Private');
      if (isArchived) options.push('Unarchive'); else options.push('Archive');
      options.push('Delete');

      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: options.length - 1, cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 0) return;
          const actionMap: Record<string, string> = {
            'Details': 'details',
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
        {/* Top Bar: Back, Centered Date/Time, Info & More */}
        <Animated.View style={[styles.topBar, { paddingTop: insets.top || 20 }, topBarAnimatedStyle]}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityRole="button">
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerDateText} numberOfLines={1}>
              {format(new Date(normalizeTimestamp(item.creationTime || item.modificationTime)), 'MMMM d')}
            </Text>
            <Text style={styles.headerTimeText} numberOfLines={1}>
              {format(new Date(normalizeTimestamp(item.creationTime || item.modificationTime)), 'h:mm a')}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable onPress={openMoreMenu} style={styles.iconButton} accessibilityRole="button">
              <Ionicons name="ellipsis-vertical" size={22} color="#FFF" />
            </Pressable>
          </View>
        </Animated.View>

        {/* Bottom Bar: 4 Primary Icon Actions (Share, Favorite, Edit, Delete) for photos */}
        {item.mediaType === 'photo' && (
          <Animated.View 
            style={[
              styles.bottomBarContainer, 
              { paddingBottom: Math.max(insets.bottom, 10) + 8 }, 
              bottomBarAnimatedStyle
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.bottomBarCapsule}>
              <View style={styles.bottomBarInner}>
                {/* 1. Share */}
                <Pressable onPress={handleShare} style={styles.actionButton} hitSlop={10} accessibilityRole="button">
                  <Ionicons name="share-outline" size={24} color="#FFF" />
                </Pressable>

                {/* 2. Favorite */}
                <Pressable 
                  onPress={() => {
                    toggleFavorite(item.id, item);
                    toastController.show({ 
                      message: !isFavorite ? 'Added to Favorites' : 'Removed from Favorites', 
                      type: 'info' 
                    });
                  }} 
                  style={styles.actionButton} 
                  hitSlop={10} 
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={24}
                    color={isFavorite ? '#EF4444' : '#FFF'}
                  />
                </Pressable>

                {/* 3. Edit */}
                <Pressable onPress={handleEdit} style={styles.actionButton} hitSlop={10} accessibilityRole="button">
                  <Ionicons
                    name="color-wand-outline"
                    size={24}
                    color="#FFF"
                  />
                </Pressable>

                {/* 4. Delete */}
                <Pressable onPress={() => setShowDeleteModal(true)} style={styles.actionButton} hitSlop={10} accessibilityRole="button">
                  <Ionicons name="trash-outline" size={24} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}
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
          if (onDeleteMedia) {
            await onDeleteMedia(item);
          } else {
            const success = await deleteMediaAsync(item.id);
            if (success) {
              toastController.show({ message: 'Moved to Trash', type: 'success' });
              router.back();
            }
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDateText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerTimeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBarCapsule: {
    backgroundColor: 'rgba(28, 28, 30, 0.92)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 22,
    paddingVertical: 8,
    minWidth: 260,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
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
    padding: 8,
    minWidth: 48,
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
