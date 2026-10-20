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
import EmptyStateView from '../../components/common/EmptyStateView';

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

  const { 
    albums, 
    activeAlbumMedia, 
    isLoadingMedia, 
    openAlbum, 
    loadMoreAlbumMedia 
  } = useAlbumsStore();

  const album = albums.find(a => a.id === albumId);

  useEffect(() => {
    if (albumId) {
      openAlbum(albumId);
    }
  }, [albumId, openAlbum]);

  // Apply Access Control and group
  const authorizedMedia = useAuthorizedMedia(
    activeAlbumMedia, 
    isLocked ? { type: 'locked_album', albumId } : 'public'
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

  const handleToggleLock = async () => {
    if (isLocked) {
      await unlockAlbumContent(albumId);
    } else {
      await lockAlbumContent(albumId);
    }
  };

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
          headerRight: () => (
            <Pressable
              onPress={handleToggleLock}
              style={({ pressed }) => [
                styles.lockButton,
                {
                  backgroundColor: isLocked ? '#10B9811A' : theme.surface,
                  borderColor: isLocked ? '#10B981' : theme.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons
                name={isLocked ? 'lock-open-outline' : 'lock-closed-outline'}
                size={16}
                color={isLocked ? '#10B981' : theme.text}
              />
              <Text
                style={[
                  styles.lockButtonText,
                  { color: isLocked ? '#10B981' : theme.text },
                ]}
              >
                {isLocked ? 'Remove Lock' : 'Lock Album'}
              </Text>
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
        <EmptyStateView
          icon="images-outline"
          title="Album is Empty"
          description="There are no photos or videos in this album yet."
          actionLabel="Explore Photos"
          onAction={() => router.push('/(tabs)')}
        />
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
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  lockButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
