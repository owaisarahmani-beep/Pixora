import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { useMediaStore } from '../../store/useMediaStore';
import { useAuthorizedMedia } from '../../hooks/useVisibleMedia';
import { groupMediaByDate } from '../../utils/dateGrouping';
import { SMART_ALBUM_DEFS } from '../../hooks/useSmartAlbums';
import PhotoGrid from '../../components/gallery/PhotoGrid';

export default function SmartAlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const allMedia = useMediaStore(state => state.media);

  // Find the smart album definition matching the route id
  const def = useMemo(() => SMART_ALBUM_DEFS.find(d => d.id === id), [id]);

  // Authorize public media first (strips hidden/private/archived)
  const authorizedMedia = useAuthorizedMedia(allMedia, 'public');

  // Apply smart album filter on top of authorized media
  const filteredMedia = useMemo(() => {
    if (!def) return [];
    return authorizedMedia.filter(def.filter);
  }, [authorizedMedia, def]);

  const groupedMedia = useMemo(() => groupMediaByDate(filteredMedia), [filteredMedia]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: def?.title ?? 'Smart Album',
          headerShown: true,
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

      {!def ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>
            Unknown smart album
          </Text>
        </View>
      ) : groupedMedia.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="images-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>
            No items in {def.title}
          </Text>
        </View>
      ) : (
        <PhotoGrid
          groupedMedia={groupedMedia}
          onEndReached={() => {}}
          isRefreshing={false}
          onRefresh={() => {}}
          source="gallery"
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
    gap: 16,
  },
  stateText: {
    fontSize: 16,
    marginTop: 8,
  },
});
