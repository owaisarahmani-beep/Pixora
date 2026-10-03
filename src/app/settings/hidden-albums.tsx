import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

export default function HiddenAlbumsScreen() {
  const theme = useTheme();
  
  const { albums: canonicalAlbums, albumCovers, loadAlbums } = useAlbumsStore();
  const { hiddenAlbumIds, hideAlbum, unhideAlbum } = usePrivacyStore();

  useEffect(() => {
    // Ensure albums are loaded
    if (canonicalAlbums.length === 0) {
      loadAlbums();
    }
  }, [loadAlbums, canonicalAlbums.length]);

  const toggleHidden = async (albumId: string, isCurrentlyHidden: boolean) => {
    if (isCurrentlyHidden) {
      await unhideAlbum(albumId);
    } else {
      await hideAlbum(albumId);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Hidden Albums' }} />
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
        
        <View style={styles.header}>
          <Text style={[styles.description, { color: theme.textMuted }]}>
            Select albums to hide them from the main gallery, search, and favorites.
          </Text>
        </View>
        
        <View style={styles.list}>
          {canonicalAlbums.map(album => {
            const isHidden = hiddenAlbumIds.includes(album.id);
            const cover = albumCovers[album.id];

            return (
              <Pressable 
                key={album.id}
                style={[styles.albumRow, { backgroundColor: theme.surface }]}
                onPress={() => toggleHidden(album.id, isHidden)}
              >
                <View style={styles.albumInfo}>
                  {cover ? (
                    <Image source={cover} style={styles.cover} contentFit="cover" />
                  ) : (
                    <View style={[styles.cover, styles.placeholder, { backgroundColor: theme.background }]}>
                      <Ionicons name="folder" size={24} color={theme.accent} />
                    </View>
                  )}
                  <View style={styles.textContainer}>
                    <Text style={[styles.albumTitle, { color: theme.text }]} numberOfLines={1}>
                      {album.title}
                    </Text>
                    <Text style={[styles.albumCount, { color: theme.textMuted }]}>
                      {album.assetCount} items
                    </Text>
                  </View>
                </View>

                {/* Checkbox / Toggle */}
                <View style={[
                  styles.toggle, 
                  { 
                    borderColor: isHidden ? theme.accent : '#333333',
                    backgroundColor: isHidden ? theme.accent : 'transparent'
                  }
                ]}>
                  {isHidden && <Ionicons name="eye-off" size={16} color="#000" />}
                </View>

              </Pressable>
            );
          })}

          {canonicalAlbums.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No albums found on device.</Text>
          )}
        </View>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
  },
  albumInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  albumCount: {
    fontSize: 12,
  },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
  }
});
