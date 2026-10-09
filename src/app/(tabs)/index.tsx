import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, AppState, AppStateStatus, Button, ActivityIndicator, Pressable } from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useMediaStore } from '../../store/useMediaStore';
import PhotoGrid from '../../components/gallery/PhotoGrid';
import { useVisibleMedia } from '../../hooks/useVisibleMedia';
import { groupMediaByDate } from '../../utils/dateGrouping';
import { router } from 'expo-router';

export default function PhotosScreen() {
  const theme = useTheme();
  
  // 1. All hooks must be at the top!
  const { 
    permissionStatus, 
    media: canonicalMedia, 
    isLoading, 
    isRefreshing, 
    checkPermissions, 
    requestPermissions, 
    loadMoreMedia, 
    refreshMedia 
  } = useMediaStore();

  const visibleMedia = useVisibleMedia(canonicalMedia);
  const groupedMedia = useMemo(() => groupMediaByDate(visibleMedia), [visibleMedia]);
  
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all');

  const filteredGrouped = useMemo(() => {
    let media = visibleMedia;
    if (filterType !== 'all') {
      media = media.filter(m => m.mediaType === filterType);
    }
    if (sortOrder === 'oldest') {
      media = [...media].sort((a, b) => a.creationTime - b.creationTime);
    }
    return groupMediaByDate(media);
  }, [visibleMedia, sortOrder, filterType]);

  useEffect(() => {
    checkPermissions();
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkPermissions();
        const currentStatus = useMediaStore.getState().permissionStatus;
        if (currentStatus === 'GRANTED' || currentStatus === 'LIMITED') {
          useMediaStore.getState().refreshMedia();
        }
      }
    });
    return () => subscription.remove();
  }, [checkPermissions]);

  // 2. Early Returns (only AFTER all hooks are called)
  if (permissionStatus === 'UNDETERMINED') {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.text, { color: theme.text }]}>Pixora needs access to your media.</Text>
        <Button title="Grant Permission" onPress={requestPermissions} color={theme.accent} />
      </View>
    );
  }

  if (permissionStatus === 'DENIED') {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.text, { color: theme.text }]}>Permission denied. Please enable access in system settings.</Text>
        <Button title="Open Settings" onPress={() => Linking.openSettings()} color={theme.accent} />
      </View>
    );
  }

  if (isLoading && groupedMedia.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (groupedMedia.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.text, { color: theme.textMuted }]}>No photos or videos found.</Text>
      </View>
    );
  }

  // 3. Main Render
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {permissionStatus === 'LIMITED' && (
        <View style={[styles.limitedBanner, { backgroundColor: theme.surface }]}>
          <Text style={[styles.limitedText, { color: theme.text }]}>
            Showing limited photos. Tap to manage access.
          </Text>
          <Button title="Manage" onPress={requestPermissions} color={theme.accent} />
        </View>
      )}
      
      {/* Top Search Bar */}
      <Pressable 
        style={[styles.searchBar, { backgroundColor: theme.surface }]} 
        onPress={() => router.push('/search')}
      >
        <Ionicons name="search" size={20} color={theme.textMuted} />
        <Text style={[styles.searchPlaceholder, { color: theme.textMuted }]}>Search your photos</Text>
      </Pressable>
      {/* Sort/Filter bar */}
      <View style={[styles.filterBar, { backgroundColor: theme.background, borderBottomColor: theme.surface }]}>
        <Pressable 
          style={[styles.filterChip, filterType === 'all' && { backgroundColor: theme.accent }]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.filterChipText, { color: filterType === 'all' ? '#FFF' : theme.textMuted }]}>All</Text>
        </Pressable>
        <Pressable 
          style={[styles.filterChip, filterType === 'photo' && { backgroundColor: theme.accent }]}
          onPress={() => setFilterType('photo')}
        >
          <Text style={[styles.filterChipText, { color: filterType === 'photo' ? '#FFF' : theme.textMuted }]}>Photos</Text>
        </Pressable>
        <Pressable 
          style={[styles.filterChip, filterType === 'video' && { backgroundColor: theme.accent }]}
          onPress={() => setFilterType('video')}
        >
          <Text style={[styles.filterChipText, { color: filterType === 'video' ? '#FFF' : theme.textMuted }]}>Videos</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable 
          style={styles.sortBtn}
          onPress={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
        >
          <Ionicons name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'} size={14} color={theme.textMuted} />
          <Text style={[styles.sortText, { color: theme.textMuted }]}>{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</Text>
        </Pressable>
      </View>

      <PhotoGrid 
        groupedMedia={filteredGrouped}
        onEndReached={loadMoreMedia}
        isRefreshing={isRefreshing}
        onRefresh={refreshMedia}
        source="gallery"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  limitedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  limitedText: {
    flex: 1,
    fontSize: 14,
    marginRight: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
  },
  searchPlaceholder: {
    marginLeft: 8,
    fontSize: 15,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#555',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sortText: {
    fontSize: 13,
  },
});
