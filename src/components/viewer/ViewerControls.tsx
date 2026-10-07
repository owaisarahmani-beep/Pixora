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

  const handleDelete = () => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to permanently delete this item?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const success = await deleteMediaAsync(item.id);
            if (success) router.back();
          }
        }
      ]
    );
  };

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

  const isFavorite = favorites.has(item.id);
  const isHidden = usePrivacyStore(state => state.isAssetHidden(item.id));
  const isPrivate = usePrivacyStore(state => state.isAssetPrivate(item.id));
  const isArchived = usePrivacyStore(state => state.isAssetArchived(item.id));

  const handleMoreAction = async (action: string) => {
    setMoreMenuVisible(false);
    const privacyStore = usePrivacyStore.getState();

    switch (action) {
      case 'edit':
        router.push({ pathname: '/editor/[id]', params: { id: item.id, source } });
        break;
      case 'details':
        setDetailsVisible(true);
        break;
      case 'hide':
        await privacyStore.hideAssets([item.id]);
        router.back();
        break;
      case 'unhide':
        await privacyStore.unhideAssets([item.id]);
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
        handleDelete();
        break;
    }
  };

  const openMoreMenu = () => {
    if (Platform.OS === 'ios') {
      const options = ['Cancel', 'Details', 'Edit'];
      if (isHidden) options.push('Unhide'); else options.push('Hide');
      if (isPrivate) options.push('Remove from Vault'); else options.push('Make Private');
      if (isArchived) options.push('Unarchive'); else options.push('Archive');
      options.push('Delete');

      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: options.length - 1, cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 0) return;
          const actionMap: Record<string, string> = {
            'Details': 'details', 'Edit': 'edit',
            'Hide': 'hide', 'Unhide': 'unhide',
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

        {/* Bottom Bar: Primary Actions (Favorite, Share) */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 20 }]}>
          <View style={styles.bottomBarInner}>
            <Pressable onPress={() => toggleFavorite(item.id, item)} style={styles.actionButton}>
              <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={28} color={isFavorite ? "#EF4444" : "#FFF"} />
            </Pressable>
            <Pressable onPress={handleShare} style={styles.actionButton}>
              <Ionicons name="share-outline" size={28} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Android Custom More Menu */}
      {Platform.OS !== 'ios' && (
        <Modal visible={moreMenuVisible} transparent animationType="fade" onRequestClose={() => setMoreMenuVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setMoreMenuVisible(false)}>
            <View style={styles.modalOverlay}>
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

                <Pressable style={styles.modalItem} onPress={() => handleMoreAction(isHidden ? 'unhide' : 'hide')}>
                  <Ionicons name={isHidden ? "eye-outline" : "eye-off-outline"} size={24} color="#FFF" />
                  <Text style={styles.modalItemText}>{isHidden ? 'Unhide' : 'Hide'}</Text>
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
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 8,
  },
  iconButton: {
    padding: 8,
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalItemText: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 16,
  },
});
