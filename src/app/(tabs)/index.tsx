import React, { useEffect } from 'react';
import { View, Text, StyleSheet, AppState, AppStateStatus, Button, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { useTheme } from '../../theme/ThemeProvider';
import { useMediaStore } from '../../store/useMediaStore';
import PhotoGrid from '../../components/gallery/PhotoGrid';
import { useVisibleMedia } from '../../hooks/useVisibleMedia';
import { groupMediaByDate } from '../../utils/dateGrouping';

export default function PhotosScreen() {
  const theme = useTheme();
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
  const groupedMedia = React.useMemo(() => groupMediaByDate(visibleMedia), [visibleMedia]);

  useEffect(() => {
    checkPermissions();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkPermissions();
        // Also refresh media if permission is already granted
        const currentStatus = useMediaStore.getState().permissionStatus;
        if (currentStatus === 'GRANTED' || currentStatus === 'LIMITED') {
          useMediaStore.getState().refreshMedia();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkPermissions]);

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
      <PhotoGrid 
        groupedMedia={groupedMedia}
        onEndReached={loadMoreMedia}
        isRefreshing={isRefreshing}
        onRefresh={refreshMedia}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
});
