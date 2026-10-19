import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../theme/ThemeProvider';
import { useMediaStore } from '../store/useMediaStore';
import { PixoraMediaInfo } from '../services/media/mediaTypes';

const LARGE_VIDEO_THRESHOLD_BYTES = 500 * 1024 * 1024; // 500 MB

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface VideoSizeInfo {
  asset: PixoraMediaInfo;
  sizeBytes: number;
}

export default function StorageScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { media, deleteMediaAsync } = useMediaStore();

  const [isScanning, setIsScanning] = useState(true);
  const [videoSizes, setVideoSizes] = useState<Map<string, number>>(new Map());

  // Filter all video assets
  const allVideos = useMemo(() => {
    return media.filter(m => m.mediaType === 'video');
  }, [media]);

  // Scan file sizes for all videos
  useEffect(() => {
    let isCancelled = false;

    async function scanVideoSizes() {
      setIsScanning(true);
      const sizesMap = new Map<string, number>();

      for (const video of allVideos) {
        if (isCancelled) break;
        try {
          const info = await FileSystem.getInfoAsync(video.uri);
          if (info.exists && info.size && info.size > 0) {
            sizesMap.set(video.id, info.size);
          } else {
            // Fallback estimation if OS ContentResolver doesn't expose size directly:
            // ~35 Mbps average bitrate for mobile 1080p/4K video (~4.4 MB per second)
            const estimatedBytes = video.duration > 0 ? video.duration * 4.4 * 1024 * 1024 : 0;
            if (estimatedBytes >= LARGE_VIDEO_THRESHOLD_BYTES) {
              sizesMap.set(video.id, estimatedBytes);
            }
          }
        } catch {
          // If query fails, estimate based on duration
          const estimatedBytes = video.duration > 0 ? video.duration * 4.4 * 1024 * 1024 : 0;
          if (estimatedBytes >= LARGE_VIDEO_THRESHOLD_BYTES) {
            sizesMap.set(video.id, estimatedBytes);
          }
        }
      }

      if (!isCancelled) {
        setVideoSizes(sizesMap);
        setIsScanning(false);
      }
    }

    scanVideoSizes();

    return () => {
      isCancelled = true;
    };
  }, [allVideos]);

  // Filter videos that exceed the 500 MB threshold
  const largeVideos: VideoSizeInfo[] = useMemo(() => {
    const list: VideoSizeInfo[] = [];

    allVideos.forEach(v => {
      const sizeBytes = videoSizes.get(v.id) || 0;
      if (sizeBytes >= LARGE_VIDEO_THRESHOLD_BYTES) {
        list.push({ asset: v, sizeBytes });
      }
    });

    // Sort by largest first
    return list.sort((a, b) => b.sizeBytes - a.sizeBytes);
  }, [allVideos, videoSizes]);

  // Total size occupied by large videos
  const totalLargeBytes = useMemo(() => {
    return largeVideos.reduce((acc, curr) => acc + curr.sizeBytes, 0);
  }, [largeVideos]);

  // Handle delete / move to trash
  const handleDelete = useCallback((item: VideoSizeInfo) => {
    Alert.alert(
      'Move to Trash',
      `Move "${item.asset.filename || 'this video'}" (${formatBytes(item.sizeBytes)}) to Recently Deleted? You can recover it within 30 days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Move to Trash', 
          style: 'destructive',
          onPress: async () => {
            const success = await deleteMediaAsync(item.asset.id);
            if (success) {
              setVideoSizes(prev => {
                const next = new Map(prev);
                next.delete(item.asset.id);
                return next;
              });
            }
          }
        }
      ]
    );
  }, [deleteMediaAsync]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Storage Cleaner', 
          headerStyle: { backgroundColor: '#10151F' }, 
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }} 
      />
      
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        
        {/* Storage Hero Banner */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.heroIconBadge}>
              <Ionicons name="pie-chart" size={26} color="#67E8F9" />
            </View>
            <View>
              <Text style={styles.heroLabel}>Large Videos Space</Text>
              <Text style={styles.heroSizeText}>{formatBytes(totalLargeBytes)}</Text>
            </View>
          </View>
          <View style={styles.thresholdPill}>
            <Text style={styles.thresholdText}>{'>'} 500 MB each</Text>
          </View>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="videocam" size={20} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Videos Over 500 MB</Text>
          </View>
          <Text style={[styles.sectionCountBadge, { color: theme.textMuted }]}>
            {isScanning ? 'Scanning...' : `${largeVideos.length} found`}
          </Text>
        </View>

        <Text style={[styles.sectionDesc, { color: theme.textMuted }]}>
          These high-resolution or long videos consume significant device storage. Review and clean them up to free up space.
        </Text>

        {/* Scanning State */}
        {isScanning && (
          <View style={styles.scanningBox}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={[styles.scanningText, { color: theme.textMuted }]}>
              Calculating video file sizes...
            </Text>
          </View>
        )}

        {/* Large Videos List */}
        {!isScanning && largeVideos.length > 0 && (
          <View style={styles.videoList}>
            {largeVideos.map(({ asset, sizeBytes }) => (
              <Pressable 
                key={asset.id} 
                style={[styles.videoCard, { backgroundColor: '#161D2B', borderColor: 'rgba(255,255,255,0.06)' }]}
                onPress={() => router.push(`/viewer/${asset.id}`)}
              >
                {/* Thumbnail */}
                <View style={styles.thumbnailWrapper}>
                  <Image source={{ uri: asset.uri }} style={styles.thumbnail} contentFit="cover" />
                  <View style={styles.durationPill}>
                    <Ionicons name="play" size={10} color="#FFF" style={{ marginRight: 2 }} />
                    <Text style={styles.durationText}>{formatDuration(asset.duration)}</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.detailsWrapper}>
                  <Text style={[styles.videoTitle, { color: theme.text }]} numberOfLines={1}>
                    {asset.filename || 'Untitled Video'}
                  </Text>
                  
                  <View style={styles.metaRow}>
                    <View style={styles.sizeBadge}>
                      <Text style={styles.sizeText}>{formatBytes(sizeBytes)}</Text>
                    </View>
                    {asset.width > 0 && (
                      <Text style={[styles.resolutionText, { color: theme.textMuted }]}>
                        {asset.width}×{asset.height}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Trash Action */}
                <Pressable 
                  style={styles.deleteBtn}
                  onPress={() => handleDelete({ asset, sizeBytes })}
                  hitSlop={12}
                >
                  <Ionicons name="trash-outline" size={20} color="#F87171" />
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}

        {/* Empty State */}
        {!isScanning && largeVideos.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="checkmark-done-circle" size={48} color="#34D399" />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Videos Over 500 MB</Text>
            <Text style={[styles.emptyDesc, { color: theme.textMuted }]}>
              None of your videos exceed the 500 MB threshold. Your storage is clean and optimized!
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  content: { 
    padding: 16 
  },
  heroCard: {
    backgroundColor: '#161E2E',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.15)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(103, 232, 249, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    color: '#8E9BAE',
    fontSize: 12,
    fontWeight: '500',
  },
  heroSizeText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  thresholdPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  thresholdText: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '700' 
  },
  sectionCountBadge: { 
    fontSize: 13, 
    fontWeight: '600' 
  },
  sectionDesc: { 
    fontSize: 13, 
    lineHeight: 18,
    marginBottom: 16 
  },
  scanningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  scanningText: {
    fontSize: 13,
  },
  videoList: {
    gap: 12,
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  thumbnailWrapper: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationPill: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  durationText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  detailsWrapper: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizeBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  sizeText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '700',
  },
  resolutionText: {
    fontSize: 11,
  },
  deleteBtn: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: '#161E2E',
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
