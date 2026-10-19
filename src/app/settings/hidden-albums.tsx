import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

export default function HiddenAlbumsScreen() {
  const theme = useTheme();
  
  const { albums: canonicalAlbums, albumCovers, loadAlbums, isLoadingAlbums } = useAlbumsStore();
  const { hiddenAlbumIds, hideAlbum, unhideAlbum } = usePrivacyStore();

  useEffect(() => {
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
      <Stack.Screen 
        options={{ 
          title: 'Hidden Albums',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }} 
      />
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: 'rgba(255,255,255,0.06)' }]}>
          <View style={[styles.infoIconBadge, { backgroundColor: '#EC489920' }]}>
            <Ionicons name="eye-off-outline" size={20} color="#F472B6" />
          </View>
          <View style={styles.infoTextWrapper}>
            <Text style={[styles.infoTitle, { color: theme.text }]}>Folder Exclusions</Text>
            <Text style={[styles.infoDescription, { color: theme.textMuted }]}>
              Hidden albums will not appear on the Albums tab, main gallery timeline, or search results.
            </Text>
          </View>
        </View>
        
        <View style={styles.list}>
          {canonicalAlbums.map(album => {
            const isHidden = hiddenAlbumIds.includes(album.id);
            const cover = albumCovers[album.id];

            return (
              <Pressable 
                key={album.id}
                style={({ pressed }) => [
                  styles.albumRow, 
                  { backgroundColor: theme.surface },
                  pressed && styles.rowPressed,
                  isHidden && { borderColor: theme.accent + '40', borderWidth: 1 }
                ]}
                onPress={() => toggleHidden(album.id, isHidden)}
              >
                <View style={styles.albumInfo}>
                  {cover ? (
                    <Image source={cover} style={styles.cover} contentFit="cover" />
                  ) : (
                    <View style={[styles.cover, styles.placeholder, { backgroundColor: theme.background }]}>
                      <Ionicons name="folder" size={22} color={theme.accent} />
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

                {/* Status Toggle Capsule */}
                <View style={[
                  styles.toggleBadge, 
                  { 
                    backgroundColor: isHidden ? theme.accent : 'rgba(255,255,255,0.06)',
                    borderColor: isHidden ? theme.accent : 'rgba(255,255,255,0.1)'
                  }
                ]}>
                  <Ionicons 
                    name={isHidden ? 'eye-off' : 'eye-outline'} 
                    size={16} 
                    color={isHidden ? '#000000' : theme.textMuted} 
                  />
                  <Text style={[
                    styles.toggleBadgeText, 
                    { color: isHidden ? '#000000' : theme.textMuted }
                  ]}>
                    {isHidden ? 'Hidden' : 'Visible'}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {canonicalAlbums.length === 0 && (
            <View style={styles.emptyContainer}>
              {isLoadingAlbums ? (
                <ActivityIndicator size="large" color={theme.accent} />
              ) : (
                <>
                  <Ionicons name="folder-outline" size={48} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>No albums found on device</Text>
                </>
              )}
            </View>
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
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  infoIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextWrapper: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  list: {
    gap: 10,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  albumInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 10,
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
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  albumCount: {
    fontSize: 12,
  },
  toggleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  toggleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});
