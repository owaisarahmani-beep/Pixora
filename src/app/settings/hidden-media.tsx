import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Image } from 'expo-image';
import { appLockService } from '../../services/privacy/AppLockService';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';

export default function HiddenMediaScreen() {
  const theme = useTheme();
  const { hiddenAlbumIds, hiddenAssetIds, unhideAlbum, unhideAssets, isAppLockEnabled } = usePrivacyStore();
  const { media } = useMediaStore();
  const { albums } = useAlbumsStore();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    let mounted = true;
    const auth = async () => {
      if (isAppLockEnabled) {
        const success = await appLockService.authenticateAsync('Authenticate to view hidden media');
        if (mounted) {
          if (success) {
            setIsAuthenticated(true);
          } else {
            router.back();
          }
        }
      } else {
        setIsAuthenticated(true);
      }
    };
    auth();
    return () => { mounted = false; };
  }, [isAppLockEnabled]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Hidden Media' }} />
      </View>
    );
  }

  const hiddenAlbums = albums.filter(a => hiddenAlbumIds.includes(a.id));
  const hiddenPhotos = media.filter(m => hiddenAssetIds.includes(m.id));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Hidden Media' }} />
      
      {!isAppLockEnabled && (
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={24} color="#F59E0B" />
          <Text style={styles.warningText}>
            App Lock is disabled. Hidden media is removed from normal browsing but is NOT protected by authentication.
          </Text>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Hidden Albums ({hiddenAlbums.length})</Text>
      <FlatList
        data={hiddenAlbums}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.itemRow, { borderBottomColor: theme.surface }]}>
            <Text style={[styles.itemText, { color: theme.text }]}>{item.title}</Text>
            <Pressable style={styles.actionButton} onPress={() => unhideAlbum(item.id)}>
              <Text style={{ color: theme.accent }}>Unhide</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: theme.textMuted, padding: 16 }}>No hidden albums</Text>}
      />

      <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>Hidden Photos ({hiddenPhotos.length})</Text>
      <FlatList
        data={hiddenPhotos}
        numColumns={3}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.photoContainer}>
            <Image source={{ uri: item.uri }} style={styles.photo} />
            <Pressable style={styles.unhideOverlay} onPress={() => unhideAssets([item.id])}>
              <Ionicons name="eye" size={24} color="#FFF" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: theme.textMuted, padding: 16 }}>No individually hidden photos</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#332200',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    gap: 12,
  },
  warningText: {
    color: '#FFF',
    flex: 1,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemText: {
    fontSize: 16,
  },
  actionButton: {
    padding: 8,
  },
  photoContainer: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 1,
  },
  photo: {
    flex: 1,
  },
  unhideOverlay: {
    position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
