import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal, TextInput, TouchableWithoutFeedback, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { useAuthorizedMedia } from '../../hooks/useVisibleMedia';
import { groupMediaByDate, getMediaEffectiveTimestamp } from '../../utils/dateGrouping';
import PhotoGrid from '../../components/gallery/PhotoGrid';
import { useSecureScreen } from '../../hooks/useSecureScreen';
import EmptyStateView from '../../components/common/EmptyStateView';
import GlobalSelectionBar from '../../components/gallery/GlobalSelectionBar';
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal';
import { toastController } from '../../components/common/Toast';
import { appLockService } from '../../services/privacy/AppLockService';

export default function AlbumMediaScreen() {
  const { id } = useLocalSearchParams();
  const albumId = typeof id === 'string' ? id : (Array.isArray(id) ? id[0] : '');
  const theme = useTheme();
  
  const isLocked = usePrivacyStore(state => state.isAlbumLocked(albumId));
  const isUnlocked = usePrivacyStore(state => state.unlockedAlbums.includes(albumId));
  const unlockAlbumContent = usePrivacyStore(state => state.unlockAlbumContent);
  const lockAlbumContent = usePrivacyStore(state => state.lockAlbumContent);
  
  // Protect screen if album is locked
  useSecureScreen(isLocked);

  // Lock album on background and prompt on foreground return
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'inactive' || nextState === 'background') {
        if (appLockService.isAuthenticating) return;
        if (isLocked) {
          usePrivacyStore.getState().lockAlbum(albumId);
        }
      }
      if (nextState === 'active') {
        if (appLockService.isAuthenticating) return;
        const currentPrivacy = usePrivacyStore.getState();
        if (isLocked && !currentPrivacy.unlockedAlbums.includes(albumId)) {
          unlockAlbumContent(albumId);
        }
      }
    });
    return () => sub.remove();
  }, [isLocked, albumId, unlockAlbumContent]);

  const albums = useAlbumsStore((state) => state.albums);
  const activeAlbumMedia = useAlbumsStore((state) => state.activeAlbumMedia);
  const isLoadingMedia = useAlbumsStore((state) => state.isLoadingMedia);
  const openAlbum = useAlbumsStore((state) => state.openAlbum);
  const loadMoreAlbumMedia = useAlbumsStore((state) => state.loadMoreAlbumMedia);
  const renameAlbum = useAlbumsStore((state) => state.renameAlbum);
  const deleteAlbum = useAlbumsStore((state) => state.deleteAlbum);
  const setAlbumCover = useAlbumsStore((state) => state.setAlbumCover);
  const setAlbumSortOrder = useAlbumsStore((state) => state.setAlbumSortOrder);
  const albumSortOrder = useAlbumsStore((state) => state.albumSortOrder);

  const album = albums.find(a => a.id === albumId);

  // Selection store integration
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode && state.selectionContext === 'media');
  const enterSelectionMode = useSelectionStore(state => state.enterSelectionMode);

  // Album-specific filtering state (sorting uses authoritative albumSortOrder from useAlbumsStore)
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all');
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  // Rename state
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState('');

  // Delete album confirmation modal state
  const [deleteAlbumModalVisible, setDeleteAlbumModalVisible] = useState(false);

  // Clear album-specific selection when navigating away
  useFocusEffect(
    useCallback(() => {
      // On blur (leaving the album screen), exit selection mode so stale
      // selection does not carry over to other albums or the main gallery.
      return () => {
        useSelectionStore.getState().exitSelectionMode();
      };
    }, [])
  );

  useEffect(() => {
    if (albumId) {
      useSelectionStore.getState().clearIfScopeMismatch('album:' + albumId);
      openAlbum(albumId);
    }
  }, [albumId, openAlbum]);

  // Apply Access Control and group
  const authorizedMedia = useAuthorizedMedia(
    activeAlbumMedia, 
    isLocked ? { type: 'locked_album', albumId } : 'public'
  );

  // Apply album-specific sort and media filter
  const processedMedia = useMemo(() => {
    let list = authorizedMedia;
    if (filterType !== 'all') {
      list = list.filter(m => m.mediaType === filterType);
    }
    return [...list].sort((a, b) => {
      const timeA = getMediaEffectiveTimestamp(a);
      const timeB = getMediaEffectiveTimestamp(b);
      return albumSortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [authorizedMedia, albumSortOrder, filterType]);

  const groupedMedia = useMemo(() => groupMediaByDate(processedMedia), [processedMedia]);
  const allIds = useMemo(() => processedMedia.map(m => m.id), [processedMedia]);

  const handleToggleLock = useCallback(async () => {
    setMoreMenuVisible(false);
    if (isLocked) {
      await unlockAlbumContent(albumId);
      toastController.show({ message: 'Album lock protection removed', type: 'success' });
    } else {
      await lockAlbumContent(albumId);
      toastController.show({ message: 'Album locked with biometric protection', type: 'success' });
    }
  }, [isLocked, albumId, unlockAlbumContent, lockAlbumContent]);

  const handleOpenRename = () => {
    setMoreMenuVisible(false);
    setRenameText(album?.title || '');
    setRenameVisible(true);
  };

  const handleConfirmRename = () => {
    const trimmed = renameText.trim();
    if (trimmed && trimmed !== album?.title) {
      renameAlbum(albumId, trimmed);
      toastController.show({ message: `Album renamed to "${trimmed}"`, type: 'success' });
    }
    setRenameVisible(false);
  };

  const handleSetCover = () => {
    setMoreMenuVisible(false);
    if (processedMedia.length > 0) {
      setAlbumCover(albumId, processedMedia[0].uri);
      toastController.show({ message: 'Album cover updated', type: 'success' });
    } else {
      toastController.show({ message: 'No photos available to set as cover', type: 'info' });
    }
  };

  const handleDeleteAlbum = () => {
    setMoreMenuVisible(false);
    setDeleteAlbumModalVisible(true);
  };

  const handleConfirmDeleteAlbum = () => {
    setDeleteAlbumModalVisible(false);
    deleteAlbum(albumId);
    toastController.show({ message: `Album "${album?.title || 'Album'}" deleted`, type: 'success' });
    router.back();
  };

  // If it's a locked album and not unlocked in session, block view
  if (isLocked && !isUnlocked) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ title: 'Locked Album', headerBackTitle: 'Albums' }} />
        <Ionicons name="lock-closed" size={48} color={theme.textMuted} />
        <Text style={{ color: theme.textMuted, marginTop: 16 }}>Authentication Required</Text>
        <Pressable
          style={{ backgroundColor: theme.accent, marginTop: 24, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 }}
          onPress={async () => {
            await unlockAlbumContent(albumId);
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Unlock Album</Text>
        </Pressable>
      </View>
    );
  }

  const isFilteringOrSorting = filterType !== 'all' || albumSortOrder !== 'newest';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Selection Bar for Album Media */}
      <GlobalSelectionBar tabBarHeight={0} />

      {/* Clean Single Navigation Header (hidden during selection mode so GlobalSelectionBar owns the single header) */}
      <Stack.Screen 
        options={{ 
          headerShown: !isSelectionMode,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.headerBackBtn} hitSlop={10} accessibilityRole="button">
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
          ),
          headerTitle: () => (
            <Text style={[styles.headerTitleText, { color: theme.text }]} numberOfLines={1}>
              {album?.title || 'Album'}
            </Text>
          ),
          headerRight: () => (
            <View style={styles.headerRightActions}>
              <Pressable
                onPress={() => enterSelectionMode('media', undefined, allIds, 'album:' + albumId)}
                style={styles.headerIconBtn}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-circle-outline" size={22} color={theme.text} />
              </Pressable>
              <Pressable
                onPress={() => setMoreMenuVisible(true)}
                style={styles.headerIconBtn}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Ionicons name="ellipsis-vertical" size={22} color={theme.text} />
              </Pressable>
            </View>
          ),
        }} 
      />

      {/* Subtle Active Filter/Sort Indicator (Only appears when active, 0px space otherwise) */}
      {isFilteringOrSorting && (
        <View style={styles.filterChipRow}>
          {filterType !== 'all' && (
            <Pressable 
              style={[styles.filterChip, { backgroundColor: theme.surface, borderColor: theme.border }]} 
              onPress={() => setFilterType('all')}
            >
              <Text style={[styles.filterChipText, { color: theme.text }]}>
                {filterType === 'photo' ? 'Photos Only' : 'Videos Only'}
              </Text>
              <Ionicons name="close-circle" size={14} color={theme.textMuted} style={{ marginLeft: 4 }} />
            </Pressable>
          )}
          {albumSortOrder !== 'newest' && (
            <Pressable 
              style={[styles.filterChip, { backgroundColor: theme.surface, borderColor: theme.border }]} 
              onPress={() => {
                setAlbumSortOrder('newest');
              }}
            >
              <Text style={[styles.filterChipText, { color: theme.text }]}>Oldest First</Text>
              <Ionicons name="close-circle" size={14} color={theme.textMuted} style={{ marginLeft: 4 }} />
            </Pressable>
          )}
        </View>
      )}

      {/* Priority Photo/Video Grid */}
      {isLoadingMedia && groupedMedia.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : groupedMedia.length > 0 ? (
        <PhotoGrid
          groupedMedia={groupedMedia}
          onEndReached={loadMoreAlbumMedia}
          isRefreshing={false}
          onRefresh={() => {}}
          source={isLocked ? 'locked' : 'album'}
          albumId={albumId}
        />
      ) : (
        <EmptyStateView
          icon="images-outline"
          title={isFilteringOrSorting ? "No Matching Media" : "Album is Empty"}
          description={isFilteringOrSorting ? "Try clearing active filters to see all items." : "There are no photos or videos in this album yet."}
          actionLabel={isFilteringOrSorting ? "Clear Filter" : "Explore Photos"}
          onAction={() => {
            if (isFilteringOrSorting) {
              setFilterType('all');
              setAlbumSortOrder('newest');
            } else {
              router.push('/(tabs)');
            }
          }}
        />
      )}

      {/* Album More Options Modal */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMoreMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.menuTitle, { color: theme.text }]} numberOfLines={1}>
                  {album?.title || 'Album Options'}
                </Text>

                {/* 1. Selection Mode */}
                <Pressable
                  style={styles.menuRow}
                  onPress={() => {
                    setMoreMenuVisible(false);
                    enterSelectionMode('media', undefined, allIds, 'album:' + albumId);
                  }}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.accent} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: theme.text }]}>Select Photos</Text>
                </Pressable>

                {/* 2. Sorting */}
                <Pressable
                  style={styles.menuRow}
                  onPress={() => {
                    setMoreMenuVisible(false);
                    const nextOrder = albumSortOrder === 'newest' ? 'oldest' : 'newest';
                    setAlbumSortOrder(nextOrder);
                  }}
                >
                  <Ionicons name="swap-vertical-outline" size={20} color={theme.accent} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: theme.text }]}>
                    Sort: {albumSortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
                  </Text>
                </Pressable>

                {/* 3. Filtering */}
                <Pressable
                  style={styles.menuRow}
                  onPress={() => {
                    setMoreMenuVisible(false);
                    setFilterType(prev => prev === 'all' ? 'photo' : prev === 'photo' ? 'video' : 'all');
                  }}
                >
                  <Ionicons name="filter-outline" size={20} color={theme.accent} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: theme.text }]}>
                    Filter: {filterType === 'all' ? 'All Media' : filterType === 'photo' ? 'Photos Only' : 'Videos Only'}
                  </Text>
                </Pressable>

                {/* 4. Lock / Unlock */}
                <Pressable style={styles.menuRow} onPress={handleToggleLock}>
                  <Ionicons 
                    name={isLocked ? 'lock-open-outline' : 'lock-closed-outline'} 
                    size={20} 
                    color={isLocked ? '#10B981' : theme.text} 
                    style={styles.menuIcon} 
                  />
                  <Text style={[styles.menuLabel, { color: isLocked ? '#10B981' : theme.text }]}>
                    {isLocked ? 'Remove Lock Protection' : 'Lock Album (Biometrics)'}
                  </Text>
                </Pressable>

                {/* 5. Set Cover */}
                <Pressable style={styles.menuRow} onPress={handleSetCover}>
                  <Ionicons name="image-outline" size={20} color={theme.text} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: theme.text }]}>Set First Photo as Cover</Text>
                </Pressable>

                {/* 6. Rename */}
                <Pressable style={styles.menuRow} onPress={handleOpenRename}>
                  <Ionicons name="pencil-outline" size={20} color={theme.text} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: theme.text }]}>Rename Album</Text>
                </Pressable>

                {/* 7. Delete */}
                <Pressable style={[styles.menuRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, marginTop: 4, paddingTop: 12 }]} onPress={handleDeleteAlbum}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Delete Album</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Rename Album Modal */}
      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={() => setRenameVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.renameBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.renameTitle, { color: theme.text }]}>Rename Album</Text>
            <TextInput
              style={[styles.renameInput, { color: theme.text, borderColor: theme.accent }]}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              placeholder="Album title"
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.renameActions}>
              <Pressable style={styles.renameBtn} onPress={() => setRenameVisible(false)}>
                <Text style={{ color: theme.textMuted, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.renameBtn} onPress={handleConfirmRename}>
                <Text style={{ color: theme.accent, fontSize: 15, fontWeight: '600' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Album Confirmation Dialog */}
      <DeleteConfirmModal
        visible={deleteAlbumModalVisible}
        title="Delete Album?"
        message={`Are you sure you want to delete "${album?.title || 'this album'}"? Photos inside will not be deleted from your device.`}
        confirmText="Delete"
        isDestructive={true}
        onCancel={() => setDeleteAlbumModalVisible(false)}
        onConfirm={handleConfirmDeleteAlbum}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBackBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitleText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    padding: 6,
    marginLeft: 6,
  },
  headerSelectAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterChipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  menuBox: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
  },
  menuIcon: {
    marginRight: 14,
    width: 24,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  renameBox: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    elevation: 12,
  },
  renameTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  renameInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    marginBottom: 18,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  renameBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
});
