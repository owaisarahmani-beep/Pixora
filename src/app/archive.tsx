import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useMediaStore } from '../store/useMediaStore';
import { usePrivacyStore } from '../store/usePrivacyStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { useAuthorizedMedia } from '../hooks/useVisibleMedia';
import { groupMediaByDate } from '../utils/dateGrouping';
import PhotoGrid from '../components/gallery/PhotoGrid';

export default function ArchiveScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const media = useMediaStore(state => state.media);
  const archivedAssetIds = usePrivacyStore(state => state.archivedAssetIds);
  const unarchiveAssets = usePrivacyStore(state => state.unarchiveAssets);

  const isSelectionMode = useSelectionStore(state => state.isSelectionMode);
  const selectedIds = useSelectionStore(state => state.selectedIds);
  const exitSelectionMode = useSelectionStore(state => state.exitSelectionMode);

  // Filter to only archived assets
  const archivedMedia = useAuthorizedMedia(media, 'archive');
  const groupedMedia = useMemo(() => groupMediaByDate(archivedMedia), [archivedMedia]);

  const handleUnarchive = async () => {
    const ids = isSelectionMode && selectedIds.size > 0
      ? Array.from(selectedIds)
      : archivedAssetIds;
    await unarchiveAssets(ids);
    if (isSelectionMode) exitSelectionMode();
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
          headerRight: () => (
            <Pressable onPress={handleUnarchive} style={styles.headerBtn}>
              <Ionicons name="eye-outline" size={22} color={theme.accent} />
              <Text style={[styles.headerBtnText, { color: theme.accent }]}>
                {isSelectionMode && selectedIds.size > 0
                  ? `Unarchive (${selectedIds.size})`
                  : 'Unarchive All'}
              </Text>
            </Pressable>
          ),
        }}
      />

      {groupedMedia.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="archive-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No archived photos
          </Text>
        </View>
      ) : (
        <PhotoGrid
          groupedMedia={groupedMedia}
          onEndReached={() => {}}
          isRefreshing={false}
          onRefresh={() => {}}
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 8,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
