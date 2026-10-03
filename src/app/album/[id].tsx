import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import PhotoGrid from '../../components/gallery/PhotoGrid';

export default function AlbumMediaScreen() {
  const { id } = useLocalSearchParams();
  const theme = useTheme();

  const { 
    albums, 
    activeAlbumGrouped, 
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

      {isLoadingMedia && activeAlbumGrouped.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : activeAlbumGrouped.length > 0 ? (
        <PhotoGrid
          groupedMedia={activeAlbumGrouped}
          onEndReached={loadMoreAlbumMedia}
          isRefreshing={false}
          onRefresh={() => {}}
          source="album"
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
