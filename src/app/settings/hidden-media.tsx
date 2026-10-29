import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Image } from 'expo-image';
import { appLockService } from '../../services/privacy/AppLockService';

export default function HiddenMediaScreen() {
  const theme = useTheme();
  const { hiddenAlbumIds, hiddenAssetIds, unhideAlbum, unhideAssets, isAppLockEnabled } = usePrivacyStore();
  const { media } = useMediaStore();
  const { albums } = useAlbumsStore();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'photos' | 'albums'>('photos');
  
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
      <View style={[styles.authContainer, { backgroundColor: theme.background }]}>
        <Stack.Screen 
          options={{ 
            title: 'Hidden Media',
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            headerShadowVisible: false,
          }} 
        />
        <View style={[styles.authIconBadge, { backgroundColor: '#A855F720', borderColor: '#C084FC' }]}>
          <Ionicons name="eye-off" size={44} color="#C084FC" />
        </View>
        <Text style={[styles.authTitle, { color: theme.text }]}>Hidden Media Locked</Text>
        <Text style={[styles.authSubtitle, { color: theme.textMuted }]}>
          Biometric authentication required
        </Text>
        <ActivityIndicator size="small" color={theme.accent} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const hiddenAlbums = albums.filter(a => hiddenAlbumIds.includes(a.id));
  const hiddenPhotos = media.filter(m => hiddenAssetIds.includes(m.id));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Hidden Media',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }} 
      />
      
      {/* Warning banner when App Lock is not active */}
      {!isAppLockEnabled && (
        <View style={[styles.warningBox, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
          <Ionicons name="warning-outline" size={20} color="#F59E0B" />
          <Text style={[styles.warningText, { color: '#FCD34D' }]}>
            App Lock is disabled. Hidden items are excluded from normal views but lack biometric protection.
          </Text>
        </View>
      )}

      {/* Segmented Filter Pills */}
      <View style={styles.tabBar}>
        <Pressable
          style={[
            styles.tabButton,
            { backgroundColor: activeTab === 'photos' ? theme.accent : theme.surface },
          ]}
          onPress={() => setActiveTab('photos')}
        >
          <Ionicons 
            name="images" 
            size={16} 
            color={activeTab === 'photos' ? '#000000' : theme.textMuted} 
          />
          <Text style={[
            styles.tabButtonText,
            { color: activeTab === 'photos' ? '#000000' : theme.text }
          ]}>
            Photos ({hiddenPhotos.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabButton,
            { backgroundColor: activeTab === 'albums' ? theme.accent : theme.surface },
          ]}
          onPress={() => setActiveTab('albums')}
        >
          <Ionicons 
            name="folder" 
            size={16} 
            color={activeTab === 'albums' ? '#000000' : theme.textMuted} 
          />
          <Text style={[
            styles.tabButtonText,
            { color: activeTab === 'albums' ? '#000000' : theme.text }
          ]}>
            Albums ({hiddenAlbums.length})
          </Text>
        </Pressable>
      </View>

      {/* Main Content Area */}
      {activeTab === 'photos' ? (
        <FlatList
          data={hiddenPhotos}
          numColumns={3}
          keyExtractor={item => item.id}
          contentContainerStyle={hiddenPhotos.length === 0 ? styles.emptyContainer : styles.gridContainer}
          renderItem={({ item }) => (
            <View style={styles.photoContainer}>
              <Pressable 
                style={styles.photoPressable} 
                onPress={() => router.push({ pathname: `/viewer/[id]`, params: { id: item.id, source: 'hidden' } })}
              >
                <Image source={{ uri: item.uri }} style={styles.photo} contentFit="cover" />
              </Pressable>
              <Pressable 
                style={styles.unhideOverlay} 
                onPress={() => unhideAssets([item.id])}
                hitSlop={8}
              >
                <Ionicons name="eye-outline" size={16} color="#FFF" />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconBadge, { backgroundColor: '#A855F715' }]}>
                <Ionicons name="eye-off-outline" size={48} color="#C084FC" />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Hidden Photos</Text>
              <Text style={[styles.emptyDescription, { color: theme.textMuted }]}>
                Individual photos and videos you hide will appear here.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={hiddenAlbums}
          keyExtractor={item => item.id}
          contentContainerStyle={hiddenAlbums.length === 0 ? styles.emptyContainer : styles.albumListContainer}
          renderItem={({ item }) => (
            <View style={[styles.albumRow, { backgroundColor: theme.surface }]}>
              <View style={[styles.albumIconBadge, { backgroundColor: '#A855F720' }]}>
                <Ionicons name="folder" size={24} color="#C084FC" />
              </View>
              <View style={styles.albumTextWrapper}>
                <Text style={[styles.albumTitle, { color: theme.text }]}>{item.title}</Text>
              </View>
              <Pressable 
                style={[styles.unhideButton, { backgroundColor: theme.accent + '20' }]} 
                onPress={() => unhideAlbum(item.id)}
              >
                <Text style={[styles.unhideButtonText, { color: theme.accent }]}>Unhide</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconBadge, { backgroundColor: '#A855F715' }]}>
                <Ionicons name="folder-open-outline" size={48} color="#C084FC" />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Hidden Albums</Text>
              <Text style={[styles.emptyDescription, { color: theme.textMuted }]}>
                Hide entire folders in Settings &gt; Hidden Albums to keep them private.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  authIconBadge: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  gridContainer: {
    paddingHorizontal: 1,
    paddingBottom: 40,
  },
  photoContainer: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 1.5,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  photoPressable: {
    width: '100%',
    height: '100%',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  unhideOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  albumListContainer: {
    padding: 16,
    gap: 10,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
  },
  albumIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  albumTextWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  albumTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  albumCount: {
    fontSize: 12,
  },
  unhideButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  unhideButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 40,
  },
  emptyIconBadge: {
    width: 90,
    height: 90,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
