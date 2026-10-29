import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useFavoritesStore } from '../store/useFavoritesStore';
import { useMediaStore } from '../store/useMediaStore';
import { useVisibleMedia } from '../hooks/useVisibleMedia';
import { groupMediaByDate } from '../utils/dateGrouping';
import PhotoGrid from '../components/gallery/PhotoGrid';
import EmptyStateView from '../components/common/EmptyStateView';
import { router } from 'expo-router';

export default function FavoritesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const { isLoading, favoritesMedia: canonicalFavorites, loadFavorites } = useFavoritesStore();
  const permissionStatus = useMediaStore((state) => state.permissionStatus);
  const isCheckingPermission = useMediaStore((state) => state.isCheckingPermission);
  const requestPermissions = useMediaStore((state) => state.requestPermissions);

  const favoritesMedia = useVisibleMedia(canonicalFavorites);
  const groupedFavorites = React.useMemo(() => groupMediaByDate(favoritesMedia), [favoritesMedia]);

  useEffect(() => {
    if (permissionStatus === 'GRANTED' || permissionStatus === 'LIMITED') {
      loadFavorites();
    }
  }, [loadFavorites, permissionStatus]);

  if (isCheckingPermission) {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="small" color={theme.accent} />
      </View>
    );
  }

  if (permissionStatus === 'UNDETERMINED') {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.background }]}>
        <EmptyStateView
          icon="heart-outline"
          title="Access Your Favorites"
          description="Pixora requires access to your media library to view your favorite photos and videos."
          actionLabel="Grant Permission"
          onAction={requestPermissions}
        />
      </View>
    );
  }

  if (permissionStatus === 'DENIED') {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.background }]}>
        <EmptyStateView
          icon="lock-closed-outline"
          title="Permission Required"
          description="Media access is denied. Please open system settings to enable access to your favorites."
          actionLabel="Open Settings"
          onAction={() => Linking.openSettings()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Favorites</Text>
      </View>

      {isLoading && favoritesMedia.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>Loading favorites...</Text>
        </View>
      ) : favoritesMedia.length > 0 ? (
        <PhotoGrid
          groupedMedia={groupedFavorites}
          onEndReached={() => {}}
          isRefreshing={isLoading}
          onRefresh={loadFavorites}
          source="favorites"
        />
      ) : (
        <View style={styles.centerState}>
          <Ionicons name="heart-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>No favorites yet.</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
