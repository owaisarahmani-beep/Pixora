import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useMediaStore } from '../store/useMediaStore';
import { PixoraMediaInfo } from '../services/media/mediaTypes';
import { Image } from 'expo-image';

export default function StorageScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const media = useMediaStore(state => state.media);

  // Simple heuristic duplicate detection: Same width, height, and creationTime (within 1 second)
  const duplicates = useMemo(() => {
    const groups = new Map<string, PixoraMediaInfo[]>();
    
    media.forEach(m => {
      // Group by exact resolution + time rounded to nearest second
      const timeKey = Math.floor(m.creationTime / 1000);
      const key = `${m.width}x${m.height}_${timeKey}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(m);
    });

    const duplicateGroups: PixoraMediaInfo[][] = [];
    groups.forEach(assets => {
      if (assets.length > 1) {
        duplicateGroups.push(assets);
      }
    });

    return duplicateGroups;
  }, [media]);

  const largeVideos = useMemo(() => {
    // For local dev, we don't have file size, so let's flag videos over 60 seconds as "Large"
    return media.filter(m => m.mediaType === 'video' && m.duration > 60)
                .sort((a, b) => b.duration - a.duration);
  }, [media]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Storage Cleaner', headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.text }} />
      
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        
        {/* Duplicates Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="copy-outline" size={24} color={theme.text} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Duplicate Photos</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.sectionCount, { color: theme.textMuted }]}>
              {duplicates.length} groups found
            </Text>
          </View>
          
          <Text style={[styles.sectionDesc, { color: theme.textMuted }]}>
            Photos taken at the exact same time with the same resolution.
          </Text>

          {duplicates.map((group, index) => (
            <View key={index} style={[styles.duplicateGroup, { backgroundColor: theme.surface }]}>
              {group.map((item, i) => (
                <Pressable 
                  key={item.id} 
                  style={styles.duplicateItem}
                  onPress={() => router.push(`/viewer/${item.id}`)}
                >
                  <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" />
                  {i > 0 && (
                    <View style={styles.duplicateBadge}>
                      <Text style={styles.duplicateBadgeText}>Delete Copy</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
          
          {duplicates.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-circle-outline" size={32} color={theme.accent} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No duplicates found!</Text>
            </View>
          )}
        </View>

        {/* Large Videos Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="videocam-outline" size={24} color={theme.text} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Large Videos</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.sectionCount, { color: theme.textMuted }]}>
              {largeVideos.length} found
            </Text>
          </View>
          
          <Text style={[styles.sectionDesc, { color: theme.textMuted }]}>
            Videos longer than 60 seconds that might be taking up space.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.largeVideosScroll}>
            {largeVideos.map(video => (
              <Pressable 
                key={video.id} 
                style={styles.largeVideoCard}
                onPress={() => router.push(`/viewer/${video.id}`)}
              >
                <Image source={{ uri: video.uri }} style={styles.largeVideoThumb} contentFit="cover" />
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{Math.floor(video.duration / 60)}:{(Math.floor(video.duration % 60)).toString().padStart(2, '0')}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          
          {largeVideos.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-circle-outline" size={32} color={theme.accent} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No large videos found!</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  sectionCount: { fontSize: 14, fontWeight: '500' },
  sectionDesc: { fontSize: 13, marginBottom: 16 },
  duplicateGroup: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  duplicateItem: {
    flex: 1,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
  duplicateBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  duplicateBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  emptyText: { marginTop: 12, fontSize: 14 },
  largeVideosScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  largeVideoCard: {
    width: 140,
    height: 180,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  largeVideoThumb: { width: '100%', height: '100%' },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
});
