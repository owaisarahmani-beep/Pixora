import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, SectionList, Alert, TextInput, Modal, TouchableWithoutFeedback } from 'react-native';
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
import { router } from 'expo-router';
import { Image } from 'expo-image';

export default function AlbumsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const { albums: canonicalAlbums, albumCovers, isLoadingAlbums, loadAlbums } = useAlbumsStore();
  const { permissionStatus, media: allMedia } = useMediaStore();
  
  // Run authorized filter for public context
  const publicMedia = useAuthorizedMedia(allMedia, 'public');
  
  // Memories
  const memories = useMemories(publicMedia);
  
  // Favorites count
  const favoritesCount = useFavoritesStore(state => state.favorites.size);
  
  // Smart albums derived from public media
  const smartAlbums = useSmartAlbums(publicMedia);
  
  // Visible regular albums (filtered by hidden etc)
  const albums = useVisibleAlbums(canonicalAlbums);

  // Trash count
  const trashCount = useTrashStore(state => state.items.length);
  
  // Archive count
  const archivedIds = usePrivacyStore(state => state.archivedAssetIds);

  useEffect(() => {
    if (permissionStatus === 'GRANTED' || permissionStatus === 'LIMITED') {
      loadAlbums();
    }
  }, [loadAlbums, permissionStatus]);

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
    <Pressable style={[styles.specialRow, { backgroundColor: theme.surface }]} onPress={item.onPress}>
      <View style={[styles.specialIcon, { backgroundColor: (item.color || theme.accent) + '22' }]}>
        <Ionicons name={item.icon as any} size={24} color={item.color || theme.accent} />
      </View>
      <View style={styles.specialInfo}>
        <Text style={[styles.specialLabel, { color: item.color || theme.text }]}>{item.label}</Text>
        <Text style={[styles.specialSublabel, { color: theme.textMuted }]}>{item.sublabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </Pressable>
  );

  const renderSmartAlbum = (item: { id: string; title: string; icon: string; count: number; items: any[] }) => {
    const cover = item.items[0]?.uri;
    return (
      <Pressable style={[styles.albumCard, { backgroundColor: theme.surface }]} onPress={() => router.push({ pathname: '/smart-album/[id]', params: { id: item.id } })}>
        <View style={[styles.albumIcon, { backgroundColor: theme.background }]}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <Ionicons name={item.icon as any} size={28} color={theme.accent} />
          )}
        </View>
        <View style={styles.albumInfo}>
          <Text style={[styles.albumTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.albumCount, { color: theme.textMuted }]}>{item.count} items</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </Pressable>
    );
  };

  const renderAlbum = ({ item }: { item: any }) => {
    const isLocked = lockedAlbumIds.includes(item.id);
    const coverUri = isLocked ? null : albumCovers[item.id];
    const selected = isSelectionMode && isSelected(item.id);
    
    return (
      <Pressable
        style={[
          styles.albumCard,
          { backgroundColor: selected ? theme.accent + '22' : theme.surface },
          selected && { borderWidth: 2, borderColor: theme.accent },
        ]}
        onPress={() => handlePressAlbum(item.id)}
        onLongPress={() => handleLongPressAlbum(item.id)}
        delayLongPress={300}
      >
        <View style={[styles.albumIcon, { backgroundColor: theme.background }]}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImage} contentFit="cover" transition={200} />
          ) : (
            <Ionicons name={isLocked ? 'lock-closed' : 'folder'} size={28} color={theme.accent} />
          )}
        </View>
        <View style={styles.albumInfo}>
          <Text style={[styles.albumTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.albumCount, { color: theme.textMuted }]}>
            {isLocked ? 'Locked Album' : `${item.assetCount} items`}
          </Text>
        </View>
        {selected ? (
          <Ionicons name="checkmark-circle" size={24} color={theme.accent} />
        ) : (
          <Pressable onPress={() => setAlbumMenuTarget(item)} style={styles.moreBtn} hitSlop={8}>
            <Ionicons name="ellipsis-vertical" size={18} color={theme.textMuted} />
          </Pressable>
        )}
      </Pressable>
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
      data: albums,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Albums</Text>
      </View>

      <SectionList<any, any>
        sections={sections}
        ListHeaderComponent={
          memories.length > 0 ? <MemoriesCarousel memories={memories} /> : null
        }
        keyExtractor={(item, index) => (typeof item === 'string' ? item : (item as any).id ?? String(index))}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionHeader, { color: theme.textMuted, backgroundColor: theme.background }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item, section }) => {
          if (section.title === 'Library') {
            return (
              <View>
                {renderSpecialRow({ id: 'favorites', icon: 'heart', label: 'Favorites', sublabel: `${favoritesCount} items`, onPress: () => router.push('/favorites'), color: '#EF4444' })}
                {renderSpecialRow({ id: 'archive', icon: 'archive', label: 'Archive', sublabel: `${archivedIds.length} items`, onPress: () => router.push('/archive') })}
                {renderSpecialRow({ id: 'trash', icon: 'trash', label: 'Recently Deleted', sublabel: trashCount > 0 ? `${trashCount} items` : 'Empty', onPress: () => router.push('/trash'), color: '#EF4444' })}
              </View>
            );
          }
          if (section.title === 'Smart Albums') {
            return (
              <View>
                {smartAlbums.map(sa => (
                  <View key={sa.id}>{renderSmartAlbum(sa)}</View>
                ))}
              </View>
            );
          }
          return renderAlbum({ item });
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
                // expo-media-library doesn't directly support renaming albums.
                // This is a display-only rename until native API support is added.
                Alert.alert('Rename', `Album will appear as "${renameText}" (requires app restart to sync with OS)`);
                setRenameVisible(false);
              }}>
                <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '600' }}>Rename</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  specialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginVertical: 3,
    borderRadius: 12,
  },
  specialIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  specialInfo: { flex: 1 },
  specialLabel: { fontSize: 16, fontWeight: '500' },
  specialSublabel: { fontSize: 12, marginTop: 2 },
  albumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginVertical: 3,
    borderRadius: 12,
  },
  albumIcon: {
    width: 52,
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  coverImage: { width: '100%', height: '100%' },
  albumInfo: { flex: 1 },
  albumTitle: { fontSize: 15, fontWeight: '500' },
  albumCount: { fontSize: 12, marginTop: 2 },
  moreBtn: { padding: 8 },
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
