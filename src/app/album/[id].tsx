import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useAuthorizedMedia } from '../../hooks/useVisibleMedia';
import { groupMediaByDate } from '../../utils/dateGrouping';
import PhotoGrid from '../../components/gallery/PhotoGrid';
import { useSecureScreen } from '../../hooks/useSecureScreen';

export default function AlbumMediaScreen() {
  const { id } = useLocalSearchParams();
  const theme = useTheme();
  
  const isLocked = usePrivacyStore(state => state.isAlbumLocked(id as string));
  const isUnlocked = usePrivacyStore(state => state.unlockedAlbums.includes(id as string));
  
  // Protect screen if album is locked
  useSecureScreen(isLocked);

  const { 
    albums, 
    activeAlbumMedia, 
    isLoadingMedia, 
    openAlbum, 
    loadMoreAlbumMedia 
  } = useAlbumsStore();

  const album = albums.find(a => a.id === id);

  useEffect(() => {
    if (typeof id === 'string') {
      openAlbum(id);
    }
  }, [id, openAlbum]);

  // Apply Access Control and group
  const authorizedMedia = useAuthorizedMedia(
    activeAlbumMedia, 
    isLocked ? { type: 'locked_album', albumId: id as string } : 'public'
  );
  
  const groupedMedia = useMemo(() => groupMediaByDate(authorizedMedia), [authorizedMedia]);

  // If it's a locked album and not unlocked in session, block view
  if (isLocked && !isUnlocked) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ title: 'Locked Album', headerBackTitle: 'Albums' }} />
        <Ionicons name="lock-closed" size={48} color={theme.textMuted} />
        <Text style={{ color: theme.textMuted, marginTop: 16 }}>Authentication Required</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: album?.title || 'Album',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
          ),
        }} 
      />

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
        />
      ) : (
        <View style={styles.centerState}>
          <Ionicons name="images-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>This album is empty.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
