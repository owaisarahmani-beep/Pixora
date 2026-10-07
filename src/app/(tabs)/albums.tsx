import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useVisibleAlbums } from '../../hooks/useVisibleMedia';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useSelectionStore } from '../../store/useSelectionStore';

export default function AlbumsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const { albums: canonicalAlbums, albumCovers, isLoadingAlbums, loadAlbums } = useAlbumsStore();
  const { permissionStatus, requestPermissions } = useMediaStore();
  
  const albums = useVisibleAlbums(canonicalAlbums);

  useEffect(() => {
    if (permissionStatus === 'GRANTED' || permissionStatus === 'LIMITED') {
      loadAlbums();
    }
  }, [loadAlbums, permissionStatus]);

  const lockedAlbumIds = usePrivacyStore(state => state.lockedAlbumIds);
  const unlockAlbum = usePrivacyStore(state => state.unlockAlbum);
  
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode && state.selectionContext === 'album');
  const enterSelectionMode = useSelectionStore(state => state.enterSelectionMode);
  const toggleSelection = useSelectionStore(state => state.toggleSelection);
  const isSelected = useSelectionStore(state => state.isSelected);
  
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
      enterSelectionMode('album', albumId);
    }
  };

  const renderAlbum = ({ item }: { item: any }) => {
    const isLocked = lockedAlbumIds.includes(item.id);
    const coverUri = isLocked ? null : albumCovers[item.id];
    const selected = isSelectionMode && isSelected(item.id);
    
    return (
      <Pressable 
        style={[
          styles.albumCard, 
          { backgroundColor: selected ? theme.surfaceHighlight || '#2C3E50' : theme.surface },
          selected && { borderWidth: 2, borderColor: theme.accent }
        ]}
        onPress={() => handlePressAlbum(item.id)}
        onLongPress={() => handleLongPressAlbum(item.id)}
        delayLongPress={300}
      >
        <View style={[styles.albumIcon, { backgroundColor: theme.background }]}>
          {coverUri ? (
            <Image 
              source={{ uri: coverUri }}
              style={styles.coverImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Ionicons name={isLocked ? "lock-closed" : "folder"} size={32} color={theme.accent} />
          )}
        </View>
        <View style={styles.albumInfo}>
          <Text style={[styles.albumTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.albumCount, { color: theme.textMuted }]}>
            {isLocked ? "Locked Album" : `${item.assetCount} items`}
          </Text>
        </View>
        {selected ? (
          <Ionicons name="checkmark-circle" size={24} color={theme.accent} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        )}
      </Pressable>
    );
  };

  if (permissionStatus === 'UNDETERMINED') {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.background }]}>
        <Text style={[styles.stateText, { color: theme.text, marginBottom: 16 }]}>Pixora needs access to your media.</Text>
        <Pressable onPress={requestPermissions} style={{ padding: 12, backgroundColor: theme.surface, borderRadius: 8 }}>
          <Text style={{ color: theme.accent, fontWeight: '600' }}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  if (permissionStatus === 'DENIED') {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.background }]}>
        <Text style={[styles.stateText, { color: theme.text }]}>Permission denied. Please enable access in system settings.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {isLoadingAlbums && albums.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>Loading albums...</Text>
        </View>
      ) : albums.length > 0 ? (
        <FlatList
          data={albums}
          keyExtractor={(item) => item.id}
          renderItem={renderAlbum}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.centerState}>
          <Ionicons name="albums-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>No albums found.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  albumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  albumIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  albumInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  albumCount: {
    fontSize: 14,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateText: {
    marginTop: 16,
    fontSize: 16,
  },
});
