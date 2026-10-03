import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useVisibleMedia } from '../../hooks/useVisibleMedia';
import { groupMediaByDate } from '../../utils/dateGrouping';
import PhotoGrid from '../../components/gallery/PhotoGrid';

export default function FavoritesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const { isLoading, favoritesMedia: canonicalFavorites, loadFavorites } = useFavoritesStore();
  const { permissionStatus, requestPermissions } = useMediaStore();

  const favoritesMedia = useVisibleMedia(canonicalFavorites);
  const groupedFavorites = React.useMemo(() => groupMediaByDate(favoritesMedia), [favoritesMedia]);

  useEffect(() => {
    if (permissionStatus === 'GRANTED' || permissionStatus === 'LIMITED') {
      loadFavorites();
    }
  }, [loadFavorites, permissionStatus]);

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
