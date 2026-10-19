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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PhotosScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
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

  if (isLoading && visibleMedia.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (visibleMedia.length === 0) {
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
      
      {/* Top Floating Search Capsule (Google Photos style) */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
        <Pressable 
          style={[
            styles.searchBar, 
            { 
              backgroundColor: theme.surface, 
              borderColor: theme.border,
              shadowOpacity: theme.isDark ? 0.2 : 0.06,
            }
          ]} 
          onPress={() => router.push('/search')}
        >
          <View style={styles.searchLeft}>
            <View style={[styles.searchIconBg, { backgroundColor: theme.accent + '1A' }]}>
              <Ionicons name="search" size={17} color={theme.accent} />
            </View>
            <Text style={[styles.searchPlaceholder, { color: theme.textMuted }]}>Search photos, albums & dates</Text>
          </View>

          {/* Quick Storage Cleaner / Shortcut */}
          <Pressable 
            style={[styles.avatarPill, { backgroundColor: theme.card }]} 
            onPress={(e) => {
              e.stopPropagation();
              router.push('/storage');
            }}
          >
            <Ionicons name="sparkles" size={16} color={theme.accent} />
          </Pressable>
        </Pressable>
      </View>

      {/* Filter Chips & Sort Row */}
      <View style={[styles.filterBar, { borderBottomColor: theme.border }]}>
        <View style={styles.filterChipGroup}>
          <Pressable 
            style={[
              styles.filterChip, 
              filterType === 'all' 
                ? { backgroundColor: theme.accent } 
                : { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }
            ]}
            onPress={() => setFilterType('all')}
          >
            <Ionicons 
              name="grid-outline" 
              size={13} 
              color={filterType === 'all' ? (theme.isDark ? '#0F172A' : '#FFFFFF') : theme.textMuted} 
              style={{ marginRight: 5 }} 
            />
            <Text style={[
              styles.filterChipText, 
              { color: filterType === 'all' ? (theme.isDark ? '#0F172A' : '#FFFFFF') : theme.textMuted }
            ]}>All</Text>
          </Pressable>

          <Pressable 
            style={[
              styles.filterChip, 
              filterType === 'photo' 
                ? { backgroundColor: theme.accent } 
                : { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }
            ]}
            onPress={() => setFilterType('photo')}
          >
            <Ionicons 
              name="camera-outline" 
              size={13} 
              color={filterType === 'photo' ? (theme.isDark ? '#0F172A' : '#FFFFFF') : theme.textMuted} 
              style={{ marginRight: 5 }} 
            />
            <Text style={[
              styles.filterChipText, 
              { color: filterType === 'photo' ? (theme.isDark ? '#0F172A' : '#FFFFFF') : theme.textMuted }
            ]}>Photos</Text>
          </Pressable>

          <Pressable 
            style={[
              styles.filterChip, 
              filterType === 'video' 
                ? { backgroundColor: theme.accent } 
                : { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }
            ]}
            onPress={() => setFilterType('video')}
          >
            <Ionicons 
              name="videocam-outline" 
              size={13} 
              color={filterType === 'video' ? (theme.isDark ? '#0F172A' : '#FFFFFF') : theme.textMuted} 
              style={{ marginRight: 5 }} 
            />
            <Text style={[
              styles.filterChipText, 
              { color: filterType === 'video' ? (theme.isDark ? '#0F172A' : '#FFFFFF') : theme.textMuted }
            ]}>Videos</Text>
          </Pressable>
        </View>

        <Pressable 
          style={[styles.sortBtn, { backgroundColor: theme.card }]}
          onPress={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
        >
          <Ionicons name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'} size={13} color={theme.accent} />
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
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 8,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  searchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  searchPlaceholder: {
    fontSize: 14,
    fontWeight: '500',
  },
  avatarPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterChipGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  filterChipActive: {
    backgroundColor: '#67E8F9',
  },
  filterChipInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  sortText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
