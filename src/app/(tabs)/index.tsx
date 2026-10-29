import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useMediaStore } from '../../store/useMediaStore';
import PhotoGrid from '../../components/gallery/PhotoGrid';
import EmptyStateView from '../../components/common/EmptyStateView';
import { useVisibleMedia } from '../../hooks/useVisibleMedia';
import { groupMediaByDate, getMediaEffectiveTimestamp } from '../../utils/dateGrouping';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PhotosScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  // 1. All hooks must be at the top!
  const permissionStatus = useMediaStore((state) => state.permissionStatus);
  const isCheckingPermission = useMediaStore((state) => state.isCheckingPermission);
  const canonicalMedia = useMediaStore((state) => state.media);
  const sortOrder = useMediaStore((state) => state.sortOrder);
  const setSortOrder = useMediaStore((state) => state.setSortOrder);
  const isLoading = useMediaStore((state) => state.isLoading);
  const isRefreshing = useMediaStore((state) => state.isRefreshing);
  const checkPermissions = useMediaStore((state) => state.checkPermissions);
  const requestPermissions = useMediaStore((state) => state.requestPermissions);
  const loadMoreMedia = useMediaStore((state) => state.loadMoreMedia);
  const refreshMedia = useMediaStore((state) => state.refreshMedia);

  const visibleMedia = useVisibleMedia(canonicalMedia);
  
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all');

  const filteredGrouped = useMemo(() => {
    let media = visibleMedia;
    if (filterType !== 'all') {
      media = media.filter(m => m.mediaType === filterType);
    }
    const sorted = [...media].sort((a, b) => {
      const timeA = getMediaEffectiveTimestamp(a);
      const timeB = getMediaEffectiveTimestamp(b);
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
    return groupMediaByDate(sorted);
  }, [visibleMedia, sortOrder, filterType]);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  useFocusEffect(
    useCallback(() => {
      const state = useMediaStore.getState();
      const status = state.permissionStatus;
      if (status === 'GRANTED' || status === 'LIMITED') {
        // Throttled refresh: skip full query if recently loaded within 20s
        if (state.media.length === 0 || Date.now() - state.lastRefreshTime > 20000) {
          refreshMedia();
        }
      }
    }, [refreshMedia])
  );

  // 2. Early Returns (only AFTER all hooks are called)
  if (isCheckingPermission) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="small" color={theme.accent} />
      </View>
    );
  }

  if (permissionStatus === 'UNDETERMINED') {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <EmptyStateView
          icon="images-outline"
          title="Access Your Gallery"
          description="Pixora requires access to your photos and videos to organize, browse, and edit your device media."
          actionLabel="Grant Permission"
          onAction={requestPermissions}
        />
      </View>
    );
  }

  if (permissionStatus === 'DENIED') {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <EmptyStateView
          icon="lock-closed-outline"
          title="Permission Required"
          description="Media access is denied. Please open system settings to grant Pixora permission to view your photos and videos."
          actionLabel="Open Settings"
          onAction={() => Linking.openSettings()}
        />
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
        <EmptyStateView
          icon="images-outline"
          title="No Media Found"
          description="Photos and videos stored on your device will appear here."
        />
      </View>
    );
  }

  // 3. Main Render
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {permissionStatus === 'LIMITED' && (
        <View style={[styles.limitedBanner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.limitedLeft}>
            <Ionicons name="information-circle-outline" size={18} color={theme.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.limitedText, { color: theme.text }]}>
              Showing limited photos. Tap to manage access.
            </Text>
          </View>
          <Pressable 
            style={[styles.manageBtn, { backgroundColor: theme.accent }]}
            onPress={requestPermissions}
            hitSlop={6}
          >
            <Text style={styles.manageBtnText}>Manage</Text>
          </Pressable>
        </View>
      )}
      
      {/* Top Floating Search Capsule */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 6 }]}>
        <Pressable 
          style={[
            styles.searchBar, 
            { 
              backgroundColor: theme.surface, 
              borderColor: theme.border,
            }
          ]} 
          onPress={() => router.push('/search')}
        >
          <View style={styles.searchLeft}>
            <Ionicons name="search" size={17} color={theme.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.searchPlaceholder, { color: theme.textMuted }]}>Search photos, albums, dates</Text>
          </View>

          {/* Quick Storage Cleaner / Shortcut */}
          <Pressable 
            style={[styles.avatarPill, { backgroundColor: theme.card }]} 
            onPress={(e) => {
              e.stopPropagation();
              router.push('/storage');
            }}
            hitSlop={6}
          >
            <Ionicons name="sparkles-outline" size={15} color={theme.accent} />
          </Pressable>
        </Pressable>
      </View>

      {/* Unified Filter & Sort Control Strip */}
      <View style={styles.controlStrip}>
        {/* Segmented Filter Pills */}
        <View style={[styles.segmentedTrack, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {(['all', 'photo', 'video'] as const).map((type) => {
            const isActive = filterType === type;
            const label = type === 'all' ? 'All' : type === 'photo' ? 'Photos' : 'Videos';
            return (
              <Pressable
                key={type}
                style={[
                  styles.segmentBtn,
                  isActive && { backgroundColor: theme.accent }
                ]}
                onPress={() => setFilterType(type)}
                hitSlop={4}
              >
                <Text style={[
                  styles.segmentText,
                  { color: isActive ? '#FFFFFF' : theme.textMuted }
                ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Coherent Sort Action */}
        <Pressable 
          style={[styles.sortBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
          hitSlop={4}
        >
          <Ionicons name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'} size={12} color={theme.accent} />
          <Text style={[styles.sortText, { color: theme.textMuted }]}>
            {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
          </Text>
        </Pressable>
      </View>

      <PhotoGrid 
        groupedMedia={filteredGrouped}
        onEndReached={loadMoreMedia}
        isRefreshing={isRefreshing}
        onRefresh={refreshMedia}
        source="gallery"
        filterType={filterType}
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  limitedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  limitedText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  manageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  manageBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  searchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchPlaceholder: {
    fontSize: 13,
    fontWeight: '500',
  },
  avatarPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  segmentedTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: 16,
    borderWidth: 1,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  sortText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
