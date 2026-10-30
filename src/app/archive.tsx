import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useMediaStore } from '../store/useMediaStore';
import { usePrivacyStore } from '../store/usePrivacyStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { useAlbumsStore } from '../store/useAlbumsStore';
import { useAuthorizedMedia } from '../hooks/useVisibleMedia';
import { mediaStoreService } from '../services/media/MediaStoreService';
import { PixoraMediaInfo } from '../services/media/mediaTypes';
import { groupMediaByDate } from '../utils/dateGrouping';
import PhotoGrid from '../components/gallery/PhotoGrid';
import EmptyStateView from '../components/common/EmptyStateView';

export default function ArchiveScreen() {
  const theme = useTheme();

  const archivedAssetIds = usePrivacyStore(state => state.archivedAssetIds);
  const unarchiveAssets = usePrivacyStore(state => state.unarchiveAssets);

  const isSelectionMode = useSelectionStore(state => state.isSelectionMode);
  const selectedIds = useSelectionStore(state => state.selectedIds);
  const exitSelectionMode = useSelectionStore(state => state.exitSelectionMode);

  const [rawMedia, setRawMedia] = useState<PixoraMediaInfo[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(archivedAssetIds.length > 0);
  const [isQueryError, setIsQueryError] = useState(false);

  // Authoritative Query: resolve cached assets first, then query missing IDs from MediaStore
  const loadArchivedMedia = useCallback(async () => {
    const currentArchivedIds = usePrivacyStore.getState().archivedAssetIds;
    if (currentArchivedIds.length === 0) {
      setRawMedia([]);
      setIsLoadingMedia(false);
      setIsQueryError(false);
      return;
    }

    setIsLoadingMedia(true);
    setIsQueryError(false);

    try {
      // 1. Build fast-lookup map from in-memory media stores
      const memoryMap = new Map<string, PixoraMediaInfo>();
      for (const item of useMediaStore.getState().media) {
        memoryMap.set(item.id, item);
      }
      for (const item of useAlbumsStore.getState().activeAlbumMedia) {
        memoryMap.set(item.id, item);
      }

      const cachedAssets: PixoraMediaInfo[] = [];
      const missingIds: string[] = [];

      for (const id of currentArchivedIds) {
        const cached = memoryMap.get(id);
        if (cached) {
          cachedAssets.push(cached);
        } else {
          missingIds.push(id);
        }
      }

      // 2. Query missing archived assets by ID directly from repository
      let fetchedAssets: PixoraMediaInfo[] = [];
      if (missingIds.length > 0) {
        fetchedAssets = await mediaStoreService.getAssetsByIdsAsync(missingIds);
      }

      const combined = [...cachedAssets, ...fetchedAssets];
      combined.sort((a, b) => (b.creationTime || 0) - (a.creationTime || 0));

      setRawMedia(combined);
      setIsLoadingMedia(false);
    } catch (e) {
      console.error('Failed to load archived media', e);
      setIsQueryError(true);
      setIsLoadingMedia(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function fetchArchive() {
      const currentArchivedIds = usePrivacyStore.getState().archivedAssetIds;
      if (currentArchivedIds.length === 0) {
        return;
      }

      const memoryMap = new Map<string, PixoraMediaInfo>();
      for (const item of useMediaStore.getState().media) {
        memoryMap.set(item.id, item);
      }
      for (const item of useAlbumsStore.getState().activeAlbumMedia) {
        memoryMap.set(item.id, item);
      }

      const cachedAssets: PixoraMediaInfo[] = [];
      const missingIds: string[] = [];

      for (const id of currentArchivedIds) {
        const cached = memoryMap.get(id);
        if (cached) {
          cachedAssets.push(cached);
        } else {
          missingIds.push(id);
        }
      }

      try {
        const fetchedAssets = missingIds.length > 0
          ? await mediaStoreService.getAssetsByIdsAsync(missingIds)
          : [];

        await Promise.resolve();
        if (!isCancelled) {
          const combined = [...cachedAssets, ...fetchedAssets];
          combined.sort((a, b) => (b.creationTime || 0) - (a.creationTime || 0));
          setRawMedia(combined);
          usePrivacyStore.getState().setArchivedMedia(combined);
          setIsLoadingMedia(false);
        }
      } catch (e) {
        if (!isCancelled) {
          console.error('Failed to load archived media', e);
          setIsQueryError(true);
          setIsLoadingMedia(false);
        }
      }
    }

    void fetchArchive();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Central access control filtering for archive context
  const archivedMedia = useAuthorizedMedia(rawMedia, 'archive');
  const groupedMedia = useMemo(() => groupMediaByDate(archivedMedia), [archivedMedia]);

  const handleUnarchive = async () => {
    const ids = isSelectionMode && selectedIds.size > 0
      ? Array.from(selectedIds)
      : archivedAssetIds;
    
    await unarchiveAssets(ids);
    if (isSelectionMode) {
      exitSelectionMode();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Archive',
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
          ),
          headerRight: () =>
            archivedAssetIds.length > 0 ? (
              <Pressable onPress={handleUnarchive} style={styles.headerBtn}>
                <Ionicons name="eye-outline" size={20} color={theme.accent} />
                <Text style={[styles.headerBtnText, { color: theme.accent }]}>
                  {isSelectionMode && selectedIds.size > 0
                    ? `Restore (${selectedIds.size})`
                    : 'Restore All'}
                </Text>
              </Pressable>
            ) : null,
        }}
      />

      {isLoadingMedia ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.statusText, { color: theme.textMuted }]}>
            Loading archived items...
          </Text>
        </View>
      ) : isQueryError ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
          <Text style={[styles.statusTitle, { color: theme.text }]}>Unable to load archive</Text>
          <Text style={[styles.statusText, { color: theme.textMuted }]}>
            An error occurred retrieving archived photos.
          </Text>
          <Pressable 
            style={[styles.retryBtn, { backgroundColor: theme.accent }]} 
            onPress={loadArchivedMedia}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : groupedMedia.length === 0 ? (
        <EmptyStateView
          icon="archive-outline"
          title="No Archived Photos"
          description="Archived photos are stored here without cluttering your main grid."
          actionLabel="Return to Gallery"
          onAction={() => router.back()}
        />
      ) : (
        <PhotoGrid
          groupedMedia={groupedMedia}
          onEndReached={() => {}}
          isRefreshing={false}
          onRefresh={loadArchivedMedia}
          source="archive"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  statusText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
