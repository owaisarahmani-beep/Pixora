import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useVisibleAlbums } from '../../hooks/useVisibleMedia';
import { Link } from 'expo-router';
import { Image } from 'expo-image';

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

  const renderAlbum = ({ item }: { item: any }) => {
    const coverUri = albumCovers[item.id];
    
    return (
      <Link href={`/album/${item.id}`} asChild>
        <Pressable style={[styles.albumCard, { backgroundColor: theme.surface }]}>
          <View style={[styles.albumIcon, { backgroundColor: theme.background }]}>
            {coverUri ? (
              <Image 
                source={coverUri}
                style={styles.coverImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Ionicons name="folder" size={32} color={theme.accent} />
            )}
          </View>
          <View style={styles.albumInfo}>
            <Text style={[styles.albumTitle, { color: theme.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.albumCount, { color: theme.textMuted }]}>
              {item.assetCount} items
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        </Pressable>
      </Link>
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
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Albums</Text>
      </View>

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
