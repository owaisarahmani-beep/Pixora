import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActionSheetIOS, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSelectionStore } from '../../store/useSelectionStore';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useMediaStore } from '../../store/useMediaStore';

export default function GlobalSelectionBar() {
  const { isSelectionMode, selectionContext, selectedIds, exitSelectionMode } = useSelectionStore();
  const insets = useSafeAreaInsets();
  
  if (!isSelectionMode) return null;
  const count = selectedIds.size;

  const handleAction = async (action: string) => {
    const ids = Array.from(selectedIds);
    const privacyStore = usePrivacyStore.getState();
    const mediaStore = useMediaStore.getState();

    try {
      if (selectionContext === 'media') {
        switch (action) {
          case 'hide': await privacyStore.hideAssets(ids); break;
          case 'unhide': await privacyStore.unhideAssets(ids); break;
          case 'private': await privacyStore.makeAssetsPrivate(ids); break;
          case 'archive': await privacyStore.archiveAssets(ids); break;
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
        }
      }
    } catch (e) {
      console.error('Bulk action failed', e);
    }
    
    exitSelectionMode();
  };

  const openMore = () => {
    if (selectionContext === 'album') {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Hide', 'Unhide', 'Lock', 'Unlock'], cancelButtonIndex: 0 },
          (btnIndex) => {
            const map: Record<number, string> = { 1: 'hide', 2: 'unhide', 3: 'lock', 4: 'unlock' };
            if (btnIndex > 0) handleAction(map[btnIndex]);
          }
        );
      } else {
        Alert.alert("More actions", "Select action", [
          { text: "Hide", onPress: () => handleAction('hide') },
          { text: "Unhide", onPress: () => handleAction('unhide') },
          { text: "Lock", onPress: () => handleAction('lock') },
          { text: "Unlock", onPress: () => handleAction('unlock') },
          { text: "Cancel", style: "cancel" }
        ]);
      }
      return;
    }

    if (Platform.OS === 'ios') {
      const options = ['Cancel', 'Hide', 'Make Private', 'Archive', 'Delete'];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 4, cancelButtonIndex: 0 },
        (btnIndex) => {
          if (btnIndex === 0) return;
          const map: Record<string, string> = {
            'Hide': 'hide', 'Make Private': 'private', 'Archive': 'archive', 'Delete': 'delete'
          };
          handleAction(map[options[btnIndex]]);
        }
      );
    } else {
      Alert.alert("More actions", "Select action", [
        { text: "Hide", onPress: () => handleAction('hide') },
        { text: "Make Private", onPress: () => handleAction('private') },
        { text: "Archive", onPress: () => handleAction('archive') },
        { text: "Delete", style: 'destructive', onPress: () => handleAction('delete') },
        { text: "Cancel", style: "cancel" }
      ]);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={styles.content}>
        <Pressable onPress={exitSelectionMode} style={styles.iconBtn}>
          <Ionicons name="close" size={28} color="#FFF" />
        </Pressable>
        
        <Text style={styles.title}>{count} Selected</Text>
        
        <View style={styles.actions}>
          {selectionContext === 'media' && (
            <Pressable onPress={() => handleAction('share')} style={styles.iconBtn}>
              <Ionicons name="share-outline" size={24} color="#FFF" />
            </Pressable>
          )}
          <Pressable onPress={openMore} style={styles.iconBtn}>
            <Ionicons name="ellipsis-vertical" size={24} color="#FFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C1C1E', // or theme.surface
    zIndex: 100,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 8,
  },
});
