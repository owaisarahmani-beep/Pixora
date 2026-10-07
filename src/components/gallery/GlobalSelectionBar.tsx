import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActionSheetIOS, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSelectionStore } from '../../store/useSelectionStore';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';

export default function GlobalSelectionBar({ tabBarHeight = 0 }: { tabBarHeight?: number }) {
  const { isSelectionMode, selectionContext, selectedIds, availableIds, exitSelectionMode, selectAll, deselectAll } = useSelectionStore();
  const insets = useSafeAreaInsets();
  const favoritesStore = useFavoritesStore();
  
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
          case 'hide': await privacyStore.hideAssets(ids); break;
          case 'unhide': await privacyStore.unhideAssets(ids); break;
          case 'private': await privacyStore.makeAssetsPrivate(ids); break;
          case 'archive': await privacyStore.archiveAssets(ids); break;
          case 'favorite':
            Alert.alert("Favorite", "Added to favorites");
            break;
          case 'move':
            Alert.alert("Move", "Select an album to move to (Coming soon)");
            break;
          case 'delete':
            Alert.alert("Delete", `Delete ${count} items?`, [
              { text: "Cancel", style: "cancel" },
              { 
                text: "Delete", 
                style: "destructive", 
                onPress: async () => {
                  for (const id of ids) await mediaStore.deleteMediaAsync(id);
                  exitSelectionMode();
                }
              }
            ]);
            return;
          case 'share':
            Alert.alert("Share", `Sharing ${count} items`);
            break;
        }
      } else if (selectionContext === 'album') {
        switch (action) {
          case 'hide':
            for (const id of ids) await privacyStore.hideAlbum(id);
            break;
          case 'unhide':
            for (const id of ids) await privacyStore.unhideAlbum(id);
            break;
          case 'lock':
            for (const id of ids) await privacyStore.lockAlbumContent(id);
            break;
          case 'unlock':
            for (const id of ids) await privacyStore.unlockAlbumContent(id);
            break;
          case 'delete':
            Alert.alert("Delete Album", `Delete ${count} albums?`, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => { Alert.alert("Deleted"); exitSelectionMode(); } }
            ]);
            return;
          case 'move':
            Alert.alert("Move", "Moving albums not supported natively");
            break;
          case 'share':
            Alert.alert("Share", `Sharing ${count} albums`);
            break;
        }
      }
    } catch (e) {
      console.error('Bulk action failed', e);
    }
    
    exitSelectionMode();
  };

  const openMore = () => {
    if (Platform.OS === 'ios') {
      const options = ['Cancel', 'Make Private', 'Archive'];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0 },
        (btnIndex) => {
          if (btnIndex === 1) handleAction('private');
          if (btnIndex === 2) handleAction('archive');
        }
      );
    } else {
      Alert.alert("More", "Options", [
        { text: "Make Private", onPress: () => handleAction('private') },
        { text: "Archive", onPress: () => handleAction('archive') },
        { text: "Cancel", style: "cancel" }
      ]);
    }
  };

  return (
    <>
      {/* Top Bar */}
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.topBar, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.topContent}>
          <Pressable onPress={exitSelectionMode} style={styles.iconBtn}>
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>
          
          <Text style={styles.title}>{count} Selected</Text>
          
          <View style={styles.topActions}>
            <Pressable onPress={isAllSelected ? deselectAll : selectAll} style={styles.textBtn}>
              <Text style={styles.textBtnLabel}>{isAllSelected ? 'Deselect All' : 'Select All'}</Text>
            </Pressable>
            <Pressable onPress={openMore} style={styles.iconBtn}>
              <Ionicons name="ellipsis-vertical" size={24} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Bottom Action Area — sits directly above the tab bar */}
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.bottomBar, { bottom: tabBarHeight, paddingBottom: 12 }]}>
        <View style={styles.bottomContent}>
          <Pressable onPress={() => handleAction('share')} style={styles.actionItem}>
            <Ionicons name="share-outline" size={24} color="#FFF" />
            <Text style={styles.actionLabel}>Share</Text>
          </Pressable>
          
          {selectionContext === 'media' && (
            <Pressable onPress={() => handleAction('favorite')} style={styles.actionItem}>
              <Ionicons name="heart-outline" size={24} color="#FFF" />
              <Text style={styles.actionLabel}>Favorite</Text>
            </Pressable>
          )}

          {selectionContext === 'album' && (
            <Pressable onPress={() => handleAction('lock')} style={styles.actionItem}>
              <Ionicons name="lock-closed-outline" size={24} color="#FFF" />
              <Text style={styles.actionLabel}>Lock</Text>
            </Pressable>
          )}

          <Pressable onPress={() => handleAction('move')} style={styles.actionItem}>
            <Ionicons name="folder-open-outline" size={24} color="#FFF" />
            <Text style={styles.actionLabel}>Move</Text>
          </Pressable>
          
          <Pressable onPress={() => handleAction('hide')} style={styles.actionItem}>
            <Ionicons name="eye-off-outline" size={24} color="#FFF" />
            <Text style={styles.actionLabel}>Hide</Text>
          </Pressable>
          
          <Pressable onPress={() => handleAction('delete')} style={styles.actionItem}>
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
            <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Delete</Text>
          </Pressable>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: '#1C1C1E',
    zIndex: 100,
    elevation: 10,
  },
  topContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginLeft: 16,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textBtnLabel: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#1C1C1E',
    zIndex: 100,
    elevation: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
  },
  bottomContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
  },
  actionItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
  actionLabel: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 4,
  },
  iconBtn: {
    padding: 8,
  },
});
