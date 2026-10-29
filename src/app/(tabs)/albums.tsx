import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, SectionList, TextInput, Modal, TouchableWithoutFeedback } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useVisibleAlbums, useAuthorizedMedia } from '../../hooks/useVisibleMedia';
import { useSmartAlbums } from '../../hooks/useSmartAlbums';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { useTrashStore } from '../../store/useTrashStore';
import { useMemories } from '../../hooks/useMemories';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import MemoriesCarousel from '../../components/gallery/MemoriesCarousel';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { toastController } from '../../components/common/Toast';
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal';

export default function AlbumsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const canonicalAlbums = useAlbumsStore((state) => state.albums);
  const albumCovers = useAlbumsStore((state) => state.albumCovers);
  const isLoadingAlbums = useAlbumsStore((state) => state.isLoadingAlbums);
  const loadAlbums = useAlbumsStore((state) => state.loadAlbums);

  const permissionStatus = useMediaStore((state) => state.permissionStatus);
  const allMedia = useMediaStore((state) => state.media);
  
  // Run authorized filter for public context
  const publicMedia = useAuthorizedMedia(allMedia, 'public');
  
  // Memories
  const memories = useMemories(publicMedia);
  
  // Favorites count
  const favoritesCount = useFavoritesStore(state => state.favorites.size);
  
  // Trashed items and count
  const trashedItems = useTrashStore(state => state.items);
  const trashCount = trashedItems.length;

  // Smart albums derived from public media, canonical device albums, covers, and reconciled trash
  const smartAlbums = useSmartAlbums(publicMedia, canonicalAlbums, albumCovers, trashedItems);
  
  // Visible regular albums (filtered by hidden etc)
  const albums = useVisibleAlbums(canonicalAlbums);
  
  // Archive count
  const archivedIds = usePrivacyStore(state => state.archivedAssetIds);

  useEffect(() => {
    if (permissionStatus === 'GRANTED' || permissionStatus === 'LIMITED') {
      loadAlbums();
      if (allMedia.length === 0) {
        useMediaStore.getState().loadInitialMedia();
      }
    }
  }, [loadAlbums, permissionStatus, allMedia.length]);

  const lockedAlbumIds = usePrivacyStore(state => state.lockedAlbumIds);
  const unlockAlbum = usePrivacyStore(state => state.unlockAlbum);
  const unlockAlbumContent = usePrivacyStore(state => state.unlockAlbumContent);
  const lockAlbumContent = usePrivacyStore(state => state.lockAlbumContent);
  
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode && state.selectionContext === 'album');
  const enterSelectionMode = useSelectionStore(state => state.enterSelectionMode);
  const toggleSelection = useSelectionStore(state => state.toggleSelection);
  const isSelected = useSelectionStore(state => state.isSelected);

  // Album menu state
  const [albumMenuTarget, setAlbumMenuTarget] = React.useState<any | null>(null);

  // Rename state
  const [renameVisible, setRenameVisible] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<{ id: string; title: string } | null>(null);
  const [renameText, setRenameText] = React.useState('');

  // Delete album state
  const [deleteAlbumTarget, setDeleteAlbumTarget] = React.useState<{ id: string; title: string } | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = React.useState(false);

  // Clear album selection on tab blur
  useFocusEffect(
    useCallback(() => {
      return () => {
        useSelectionStore.getState().exitSelectionMode();
      };
    }, [])
  );
  
  const handlePressAlbum = async (albumId: string) => {
    if (isSelectionMode) {
      toggleSelection(albumId);
      return;
    }
    const isLocked = lockedAlbumIds.includes(albumId);
    if (isLocked) {
      const success = await unlockAlbum(albumId);
      if (!success) return;
    }
    router.push(`/album/${albumId}`);
  };

  const handleLongPressAlbum = (albumId: string) => {
    if (!isSelectionMode) {
      const allIds = canonicalAlbums.map(a => a.id);
      enterSelectionMode('album', albumId, allIds);
    }
  };

  const handleRenameAlbum = (albumId: string, currentTitle: string) => {
    setRenameTarget({ id: albumId, title: currentTitle });
    setRenameText(currentTitle);
    setRenameVisible(true);
  };

  const renderSpecialRow = (item: { id: string; icon: string; label: string; sublabel: string; onPress: () => void; color?: string }) => (
    <Pressable style={styles.listRow} onPress={item.onPress}>
      <View style={[styles.thumbnailWrap, { backgroundColor: (item.color || theme.accent) + '18' }]}>
        <Ionicons name={item.icon as any} size={22} color={item.color || theme.accent} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, { color: item.color || theme.text }]}>{item.label}</Text>
        <Text style={[styles.rowSublabel, { color: theme.textMuted }]}>{item.sublabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </Pressable>
  );

  const renderSmartAlbum = (item: { id: string; title: string; icon: string; count: number; items: any[]; coverUri?: string | null }) => {
    const cover = item.coverUri || item.items[0]?.uri;
    return (
      <Pressable style={styles.listRow} onPress={() => router.push({ pathname: '/smart-album/[id]', params: { id: item.id } })}>
        <View style={[styles.thumbnailWrap, { backgroundColor: theme.card }]}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.coverImage} contentFit="cover" transition={150} />
          ) : (
            <Ionicons name={item.icon as any} size={22} color={theme.accent} />
          )}
        </View>
        <View style={styles.rowInfo}>
          <Text style={[styles.rowLabel, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </Pressable>
    );
  };

  const renderAlbum = ({ item, index, total }: { item: any; index: number; total: number }) => {
    const isLocked = lockedAlbumIds.includes(item.id);
    const coverUri = isLocked ? null : albumCovers[item.id];
    const selected = isSelectionMode && isSelected(item.id);
    const isFirst = index === 0;
    const isLast = index === total - 1;
    
    return (
      <View
        style={[
          styles.albumRowWrapper,
          { backgroundColor: selected ? theme.accent + '22' : theme.surface },
          isFirst && styles.roundedTop,
          isLast && styles.roundedBottom,
          selected && { borderWidth: 1.5, borderColor: theme.accent },
        ]}
      >
        <Pressable
          style={styles.listRow}
          onPress={() => handlePressAlbum(item.id)}
          onLongPress={() => handleLongPressAlbum(item.id)}
          delayLongPress={500}
        >
          <View style={[styles.thumbnailWrap, { backgroundColor: theme.card }]}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.coverImage} contentFit="cover" transition={200} />
            ) : (
              <Ionicons name={isLocked ? 'lock-closed' : 'folder'} size={22} color={isLocked ? '#F59E0B' : theme.accent} />
            )}
          </View>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowLabel, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
            {isLocked && (
              <Text style={[styles.rowSublabel, { color: theme.textMuted }]}>
                Locked Album
              </Text>
            )}
          </View>
          {selected ? (
            <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
          ) : (
            <Pressable onPress={() => setAlbumMenuTarget(item)} style={styles.moreBtn} hitSlop={10}>
              <Ionicons name="ellipsis-vertical" size={16} color={theme.textMuted} />
            </Pressable>
          )}
        </Pressable>
        {!isLast && <View style={[styles.inlineDivider, { backgroundColor: theme.border }]} />}
      </View>
    );
  };

  const sections = [
    {
      title: 'Library',
      data: ['library' as const],
    },
    {
      title: 'Smart Albums',
      data: ['smart' as const],
    },
    {
      title: 'My Albums',
      data: albums.length > 0 ? albums : ['empty_my_albums' as const],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Albums</Text>
      </View>

      <SectionList<any, any>
        sections={sections}
        refreshing={isLoadingAlbums}
        onRefresh={() => {
          loadAlbums(true);
          useMediaStore.getState().refreshMedia();
        }}
        ListHeaderComponent={
          memories.length > 0 ? <MemoriesCarousel memories={memories} /> : null
        }
        keyExtractor={(item, index) => (typeof item === 'string' ? item : (item as any).id ?? String(index))}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 84 }}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionHeader, { color: theme.textMuted, backgroundColor: theme.background }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item, index, section }) => {
          if (section.title === 'Library') {
            return (
              <View style={[styles.groupedCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {renderSpecialRow({ id: 'favorites', icon: 'heart', label: 'Favorites', sublabel: `${favoritesCount} items`, onPress: () => router.push('/favorites'), color: '#EF4444' })}
                <View style={[styles.inlineDivider, { backgroundColor: theme.border }]} />
                {renderSpecialRow({ id: 'archive', icon: 'archive', label: 'Archive', sublabel: `${archivedIds.length} items`, onPress: () => router.push('/archive'), color: theme.accent })}
                <View style={[styles.inlineDivider, { backgroundColor: theme.border }]} />
                {renderSpecialRow({ id: 'trash', icon: 'trash', label: 'Recently Deleted', sublabel: trashCount > 0 ? `${trashCount} items` : 'Empty', onPress: () => router.push('/trash'), color: '#F43F5E' })}
              </View>
            );
          }
          if (section.title === 'Smart Albums') {
            return (
              <View style={[styles.groupedCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {smartAlbums.map((sa, i) => (
                  <React.Fragment key={sa.id}>
                    {i > 0 && <View style={[styles.inlineDivider, { backgroundColor: theme.border }]} />}
                    {renderSmartAlbum(sa)}
                  </React.Fragment>
                ))}
              </View>
            );
          }
          if (item === 'empty_my_albums') {
            return (
              <View style={[styles.emptyGroupedCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="folder-open-outline" size={28} color={theme.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No Custom Albums</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                  Albums from your camera and device will appear here
                </Text>
              </View>
            );
          }
          return renderAlbum({ item, index, total: section.data.length });
        }}
        ListEmptyComponent={
          isLoadingAlbums ? (
            <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 60 }} />
          ) : null
        }
      />

      {/* Album Options Modal */}
      <Modal
        visible={albumMenuTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAlbumMenuTarget(null)}
      >
        <TouchableWithoutFeedback onPress={() => setAlbumMenuTarget(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.menuAlbumTitle, { color: theme.text }]} numberOfLines={1}>
                  {albumMenuTarget?.title}
                </Text>

                {lockedAlbumIds.includes(albumMenuTarget?.id) ? (
                  <Pressable
                    style={styles.menuRow}
                    onPress={async () => {
                      const target = albumMenuTarget;
                      setAlbumMenuTarget(null);
                      const success = await unlockAlbum(target.id);
                      if (success) {
                        await unlockAlbumContent(target.id);
                        toastController.show({ message: `"${target.title}" unlocked`, type: 'success' });
                      }
                    }}
                  >
                    <View style={[styles.menuIconWrap, { backgroundColor: '#10B9811A' }]}>
                      <Ionicons name="lock-open-outline" size={20} color="#10B981" />
                    </View>
                    <View style={styles.menuRowInfo}>
                      <Text style={[styles.menuRowLabel, { color: '#10B981' }]}>Unlock Album</Text>
                      <Text style={[styles.menuRowSublabel, { color: theme.textMuted }]}>
                        Remove lock protection from this album
                      </Text>
                    </View>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.menuRow}
                    onPress={async () => {
                      const target = albumMenuTarget;
                      setAlbumMenuTarget(null);
                      await lockAlbumContent(target.id);
                      toastController.show({ message: `"${target.title}" locked with biometric protection`, type: 'success' });
                    }}
                  >
                    <View style={[styles.menuIconWrap, { backgroundColor: theme.accent + '1A' }]}>
                      <Ionicons name="lock-closed-outline" size={20} color={theme.accent} />
                    </View>
                    <View style={styles.menuRowInfo}>
                      <Text style={[styles.menuRowLabel, { color: theme.text }]}>Lock Album</Text>
                      <Text style={[styles.menuRowSublabel, { color: theme.textMuted }]}>
                        Require biometrics to access this album
                      </Text>
                    </View>
                  </Pressable>
                )}

                <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />

                <Pressable
                  style={styles.menuRow}
                  onPress={() => {
                    const target = albumMenuTarget;
                    setAlbumMenuTarget(null);
                    handleRenameAlbum(target.id, target.title);
                  }}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: theme.card }]}>
                    <Ionicons name="pencil-outline" size={20} color={theme.text} />
                  </View>
                  <View style={styles.menuRowInfo}>
                    <Text style={[styles.menuRowLabel, { color: theme.text }]}>Rename Album</Text>
                  </View>
                </Pressable>

                <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />

                <Pressable
                  style={styles.menuRow}
                  onPress={() => {
                    const target = albumMenuTarget;
                    setAlbumMenuTarget(null);
                    setDeleteAlbumTarget({ id: target.id, title: target.title });
                    setDeleteModalVisible(true);
                  }}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: '#EF44441A' }]}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </View>
                  <View style={styles.menuRowInfo}>
                    <Text style={[styles.menuRowLabel, { color: '#EF4444' }]}>Delete Album</Text>
                  </View>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Rename Modal */}
      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={() => setRenameVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {renameTarget ? `Rename "${renameTarget.title}"` : 'Rename Album'}
            </Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.accent }]}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtn} onPress={() => setRenameVisible(false)}>
                <Text style={{ color: theme.textMuted, fontSize: 16 }}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalBtn} onPress={() => {
                const trimmed = renameText.trim();
                if (trimmed && renameTarget) {
                  useAlbumsStore.getState().renameAlbum(renameTarget.id, trimmed);
                  toastController.show({ message: `Album renamed to "${trimmed}"`, type: 'success' });
                }
                setRenameVisible(false);
              }}>
                <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '600' }}>Rename</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Album Modal */}
      <DeleteConfirmModal
        visible={deleteModalVisible}
        title="Delete Album?"
        message={`Are you sure you want to delete "${deleteAlbumTarget?.title || 'this album'}"? Photos inside will not be deleted from your device.`}
        confirmText="Delete"
        isDestructive={true}
        onCancel={() => {
          setDeleteModalVisible(false);
          setDeleteAlbumTarget(null);
        }}
        onConfirm={() => {
          if (deleteAlbumTarget) {
            useAlbumsStore.getState().deleteAlbum(deleteAlbumTarget.id);
            toastController.show({ message: `Album "${deleteAlbumTarget.title}" deleted`, type: 'success' });
          }
          setDeleteModalVisible(false);
          setDeleteAlbumTarget(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  headerTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  groupedCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  albumRowWrapper: {
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  roundedTop: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  roundedBottom: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  thumbnailWrap: {
    width: 46,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 14,
  },
  coverImage: { width: '100%', height: '100%' },
  rowInfo: { flex: 1, justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSublabel: { fontSize: 13, marginTop: 2 },
  inlineDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
  moreBtn: { padding: 6 },
  emptyGroupedCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '80%',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  modalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  menuBox: {
    width: '85%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  menuAlbumTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuRowInfo: {
    flex: 1,
  },
  menuRowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuRowSublabel: {
    fontSize: 12,
    marginTop: 2,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },
});
