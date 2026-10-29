import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { useAuthorizedMedia } from '../../hooks/useVisibleMedia';
import { groupMediaByDate } from '../../utils/dateGrouping';
import { SMART_ALBUM_DEFS } from '../../hooks/useSmartAlbums';
import PhotoGrid from '../../components/gallery/PhotoGrid';
import GlobalSelectionBar from '../../components/gallery/GlobalSelectionBar';

export default function SmartAlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const smartAlbumId = typeof id === 'string' ? id : (Array.isArray(id) ? id[0] : '');
  const theme = useTheme();

  const activeSmartAlbumId = useAlbumsStore((state) => state.activeSmartAlbumId);
  const activeSmartAlbumMedia = useAlbumsStore((state) => state.activeSmartAlbumMedia);
  const isLoadingSmartAlbum = useAlbumsStore((state) => state.isLoadingSmartAlbum);
  const smartAlbumSortOrder = useAlbumsStore((state) => state.smartAlbumSortOrder);
  const openSmartAlbum = useAlbumsStore((state) => state.openSmartAlbum);
  const loadMoreSmartAlbumMedia = useAlbumsStore((state) => state.loadMoreSmartAlbumMedia);
  const refreshSmartAlbum = useAlbumsStore((state) => state.refreshSmartAlbum);
  const setSmartAlbumSortOrder = useAlbumsStore((state) => state.setSmartAlbumSortOrder);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Find the smart album definition matching the route id
  const def = useMemo(() => SMART_ALBUM_DEFS.find((d) => d.id === smartAlbumId), [smartAlbumId]);

  // Open the smart album when smartAlbumId changes
  useEffect(() => {
    if (smartAlbumId) {
      useSelectionStore.getState().clearIfScopeMismatch('smart:' + smartAlbumId);
      openSmartAlbum(smartAlbumId, smartAlbumSortOrder);
    }
  }, [smartAlbumId, openSmartAlbum, smartAlbumSortOrder]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshSmartAlbum();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshSmartAlbum]);

  // Selection store integration
  const isSelectionMode = useSelectionStore(
    (state) => state.isSelectionMode && state.selectionContext === 'media'
  );
  const enterSelectionMode = useSelectionStore((state) => state.enterSelectionMode);

  // Clear selection when navigating away from this smart album
  useFocusEffect(
    useCallback(() => {
      return () => {
        useSelectionStore.getState().exitSelectionMode();
      };
    }, [])
  );

  // Authorize media (strips hidden/private/archived/trashed)
  // Ensure we only authorize and render media belonging to this active smart album
  const currentAlbumMedia = activeSmartAlbumId === smartAlbumId ? activeSmartAlbumMedia : [];
  const authorizedMedia = useAuthorizedMedia(currentAlbumMedia, 'public');

  // Group authorized media by date
  const groupedMedia = useMemo(() => groupMediaByDate(authorizedMedia), [authorizedMedia]);
  const allIds = useMemo(() => authorizedMedia.map((m) => m.id), [authorizedMedia]);


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GlobalSelectionBar tabBarHeight={0} />
      <Stack.Screen
        options={{
          headerShown: !isSelectionMode,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={styles.headerBackBtn}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
          ),
          headerTitle: () => (
            <Text style={[styles.headerTitleText, { color: theme.text }]} numberOfLines={1}>
              {def?.title ?? 'Smart Album'}
            </Text>
          ),
          headerRight: () => (
            <View style={styles.headerRightActions}>
              <Pressable
                onPress={() =>
                  setSmartAlbumSortOrder(smartAlbumSortOrder === 'newest' ? 'oldest' : 'newest')
                }
                style={styles.headerIconBtn}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Ionicons
                  name="swap-vertical-outline"
                  size={22}
                  color={smartAlbumSortOrder === 'oldest' ? theme.accent : theme.text}
                />
              </Pressable>
              <Pressable
                onPress={() => enterSelectionMode('media', undefined, allIds, 'smart:' + smartAlbumId)}
                style={styles.headerIconBtn}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-circle-outline" size={22} color={theme.text} />
              </Pressable>
            </View>
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
      ) : isLoadingSmartAlbum && activeSmartAlbumMedia.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>
            Loading {def.title}...
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
          onEndReached={loadMoreSmartAlbumMedia}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          source="smart_album"
          smartAlbumId={smartAlbumId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBackBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitleText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    padding: 6,
    marginLeft: 6,
  },
  headerSelectAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: '600',
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
