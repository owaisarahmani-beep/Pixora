import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useTheme } from '../../theme/ThemeProvider';
import { useSecureScreen } from '../../hooks/useSecureScreen';
import { useAuthorizedMedia } from '../../hooks/useVisibleMedia';
import { mediaStoreService } from '../../services/media/MediaStoreService';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import { isVideoMedia, formatVideoDuration } from '../../components/gallery/PhotoThumbnail';
import EmptyStateView from '../../components/common/EmptyStateView';

// Helper component to measure first render timing safely inside an effect
function FirstItemMountTracker({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return null;
}

export default function PrivateVaultScreen() {
  const theme = useTheme();
  const { isVaultUnlocked, unlockVault, removeAssetsFromPrivate } = usePrivacyStore();
  const authAttemptedRef = useRef(false);

  // Raw media queried after authorization
  const [rawMedia, setRawMedia] = useState<PixoraMediaInfo[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isQueryError, setIsQueryError] = useState(false);

  // Performance instrumentation references
  const perfTimings = useRef({
    authSuccessTime: 0,
    vaultVisibleTime: 0,
    queryCompleteTime: 0,
    firstRenderedTime: 0,
    thumbnailLoadedTime: 0,
  });

  // Secure screen to prevent OS switcher preview leak
  useSecureScreen(true);

  // 1. Authentication Session Gate
  useEffect(() => {
    if (!isVaultUnlocked && !authAttemptedRef.current) {
      authAttemptedRef.current = true;
      unlockVault().then(success => {
        if (success) {
          perfTimings.current.authSuccessTime = performance.now();
        } else {
          router.back();
        }
      });
    }
  }, [isVaultUnlocked, unlockVault]);

  // Query authorized media after successful authentication
  const executeQuery = useCallback(async () => {
    setIsLoadingMedia(true);
    setIsQueryError(false);

    try {
      const currentPrivateIds = usePrivacyStore.getState().privateAssetIds;
      if (currentPrivateIds.length === 0) {
        setRawMedia([]);
        setIsLoadingMedia(false);
        const tQuery = performance.now();
        perfTimings.current.queryCompleteTime = tQuery;
        if (__DEV__) {
          const diff2 = perfTimings.current.vaultVisibleTime > 0
            ? tQuery - perfTimings.current.vaultVisibleTime
            : 0;
          console.log(`[PixoraVaultPerf] 2. Vault visible -> Authorized query complete: ${diff2.toFixed(1)}ms (0 items)`);
        }
        return;
      }

      // Optimization: Check in-memory media store first (O(1) Map lookup)
      const memoryAssets = useMediaStore.getState().media;
      const memoryMap = new Map<string, PixoraMediaInfo>();
      for (const item of memoryAssets) {
        memoryMap.set(item.id, item);
      }

      const cachedAssets: PixoraMediaInfo[] = [];
      const missingIds: string[] = [];

      for (const id of currentPrivateIds) {
        const cached = memoryMap.get(id);
        if (cached) {
          cachedAssets.push(cached);
        } else {
          missingIds.push(id);
        }
      }

      // Query any missing assets from media repository
      let fetchedAssets: PixoraMediaInfo[] = [];
      if (missingIds.length > 0) {
        fetchedAssets = await mediaStoreService.getAssetsByIdsAsync(missingIds);
      }

      const combined = [...cachedAssets, ...fetchedAssets];
      combined.sort((a, b) => (b.creationTime || 0) - (a.creationTime || 0));

      setRawMedia(combined);
      setIsLoadingMedia(false);

      const tQuery = performance.now();
      perfTimings.current.queryCompleteTime = tQuery;
      if (__DEV__) {
        const diff2 = perfTimings.current.vaultVisibleTime > 0
          ? tQuery - perfTimings.current.vaultVisibleTime
          : 0;
        console.log(`[PixoraVaultPerf] 2. Vault visible -> Authorized query complete: ${diff2.toFixed(1)}ms (${combined.length} items: ${cachedAssets.length} memory-cached, ${missingIds.length} queried)`);
      }
    } catch (e) {
      console.error('Failed to query vault media', e);
      setIsQueryError(true);
      setIsLoadingMedia(false);
    }
  }, []);

  // 2. Lifecycle & Session Lock Observer
  useEffect(() => {
    if (!isVaultUnlocked) {
      return;
    }

    let isCancelled = false;
    const tVisible = performance.now();
    perfTimings.current.vaultVisibleTime = tVisible;
    if (__DEV__) {
      const diff1 = perfTimings.current.authSuccessTime > 0
        ? tVisible - perfTimings.current.authSuccessTime
        : 0;
      console.log(`[PixoraVaultPerf] 1. Auth success -> Vault screen visible: ${diff1.toFixed(1)}ms`);
    }

    async function fetchVaultMedia() {
      try {
        const currentPrivateIds = usePrivacyStore.getState().privateAssetIds;
        if (currentPrivateIds.length === 0) {
          await Promise.resolve();
          if (!isCancelled) {
            setRawMedia([]);
            setIsLoadingMedia(false);
            const tQuery = performance.now();
            perfTimings.current.queryCompleteTime = tQuery;
            if (__DEV__) {
              const diff2 = perfTimings.current.vaultVisibleTime > 0
                ? tQuery - perfTimings.current.vaultVisibleTime
                : 0;
              console.log(`[PixoraVaultPerf] 2. Vault visible -> Authorized query complete: ${diff2.toFixed(1)}ms (0 items)`);
            }
          }
          return;
        }

        const memoryAssets = useMediaStore.getState().media;
        const memoryMap = new Map<string, PixoraMediaInfo>();
        for (const item of memoryAssets) {
          memoryMap.set(item.id, item);
        }

        const cachedAssets: PixoraMediaInfo[] = [];
        const missingIds: string[] = [];

        for (const id of currentPrivateIds) {
          const cached = memoryMap.get(id);
          if (cached) {
            cachedAssets.push(cached);
          } else {
            missingIds.push(id);
          }
        }

        const fetchedAssets = missingIds.length > 0
          ? await mediaStoreService.getAssetsByIdsAsync(missingIds)
          : [];

        await Promise.resolve();
        if (!isCancelled) {
          const combined = [...cachedAssets, ...fetchedAssets];
          combined.sort((a, b) => (b.creationTime || 0) - (a.creationTime || 0));

          setRawMedia(combined);
          setIsLoadingMedia(false);

          const tQuery = performance.now();
          perfTimings.current.queryCompleteTime = tQuery;
          if (__DEV__) {
            const diff2 = perfTimings.current.vaultVisibleTime > 0
              ? tQuery - perfTimings.current.vaultVisibleTime
              : 0;
            console.log(`[PixoraVaultPerf] 2. Vault visible -> Authorized query complete: ${diff2.toFixed(1)}ms (${combined.length} items: ${cachedAssets.length} memory-cached, ${missingIds.length} queried)`);
          }
        }
      } catch (e) {
        if (!isCancelled) {
          console.error('Failed to query vault media', e);
          setIsQueryError(true);
          setIsLoadingMedia(false);
        }
      }
    }

    void fetchVaultMedia();

    return () => {
      isCancelled = true;
    };
  }, [isVaultUnlocked]);

  // Safely record first item rendered timing inside an effect
  const handleFirstItemMount = useCallback(() => {
    if (perfTimings.current.firstRenderedTime === 0) {
      const tRender = performance.now();
      perfTimings.current.firstRenderedTime = tRender;
      const diff3 = perfTimings.current.queryCompleteTime > 0
        ? tRender - perfTimings.current.queryCompleteTime
        : 0;
      if (__DEV__) {
        console.log(`[PixoraVaultPerf] 3. Query complete -> First item rendered: ${diff3.toFixed(1)}ms`);
      }
    }
  }, []);

  // Central access control boundary: Evaluates context and active vault session
  const authorizedMedia = useAuthorizedMedia(rawMedia, 'private');
  // Immediately wipe protected content if session is locked
  const vaultPhotos = isVaultUnlocked ? authorizedMedia : [];

  // If vault is locked, render secure biometric gate
  if (!isVaultUnlocked) {
    return (
      <View style={[styles.authContainer, { backgroundColor: theme.background }]}>
        <Stack.Screen 
          options={{ 
            title: 'Private Vault',
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            headerShadowVisible: false,
          }} 
        />
        <View style={[styles.lockIconBadge, { backgroundColor: '#6366F120', borderColor: '#818CF8' }]}>
          <Ionicons name="lock-closed" size={44} color="#818CF8" />
        </View>
        <Text style={[styles.authTitle, { color: theme.text }]}>Private Vault</Text>
        <Text style={[styles.authSubtitle, { color: theme.textMuted }]}>
          Authentication required to view protected media
        </Text>
        <ActivityIndicator size="small" color={theme.accent} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const renderPhotoItem = ({ item, index }: { item: PixoraMediaInfo; index: number }) => {
    const isVideo = isVideoMedia(item);
    const durationText = formatVideoDuration(item.duration);

    return (
      <View style={styles.photoContainer}>
        {/* Instrument Timing 3: Query completion to first media item rendered */}
        {index === 0 && <FirstItemMountTracker onMount={handleFirstItemMount} />}

        {/* Stable Placeholder beneath */}
        <View style={styles.thumbnailPlaceholder}>
          <Ionicons 
            name={isVideo ? "videocam-outline" : "image-outline"} 
            size={20} 
            color="#475569" 
          />
        </View>

        <Pressable 
          style={styles.photoPressable} 
          onPress={() => router.push({ pathname: `/viewer/[id]`, params: { id: item.id, source: 'private' } })}
        >
          <Image 
            source={{ uri: item.uri }} 
            style={styles.photo} 
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            onLoad={() => {
              // Instrument Timing 4: First item rendered to thumbnail loaded
              if (index === 0 && perfTimings.current.thumbnailLoadedTime === 0) {
                const tLoad = performance.now();
                perfTimings.current.thumbnailLoadedTime = tLoad;
                const diff4 = perfTimings.current.firstRenderedTime > 0
                  ? tLoad - perfTimings.current.firstRenderedTime
                  : 0;
                const total = perfTimings.current.authSuccessTime > 0
                  ? tLoad - perfTimings.current.authSuccessTime
                  : 0;
                if (__DEV__) {
                  console.log(`[PixoraVaultPerf] 4. First item rendered -> Thumbnail loaded: ${diff4.toFixed(1)}ms`);
                  console.log(`[PixoraVaultPerf] Total Vault Load Pipeline: ${total.toFixed(1)}ms`);
                }
              }
            }}
          />
        </Pressable>

        {/* Video Play Indicator: always mounted immediately, unaffected by image loading */}
        {isVideo && (
          <View style={styles.videoBadge} testID="vault-video-badge">
            <Ionicons name="play" size={10} color="#FFFFFF" />
            {durationText ? (
              <Text style={styles.durationText}>{durationText}</Text>
            ) : null}
          </View>
        )}
        
        {/* Quick Un-Private Action */}
        <Pressable 
          style={styles.removeOverlay} 
          onPress={() => removeAssetsFromPrivate([item.id])}
          hitSlop={8}
        >
          <Ionicons name="lock-open-outline" size={16} color="#FFF" />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Private Vault',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }} 
      />

      {isLoadingMedia ? (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.statusText, { color: theme.textMuted }]}>
            Loading protected media...
          </Text>
        </View>
      ) : isQueryError ? (
        <View style={styles.statusContainer}>
          <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
          <Text style={[styles.statusTitle, { color: theme.text }]}>Unable to load vault</Text>
          <Text style={[styles.statusText, { color: theme.textMuted }]}>
            There was an error reading private assets from media store.
          </Text>
          <Pressable 
            style={[styles.retryBtn, { backgroundColor: theme.accent }]} 
            onPress={executeQuery}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={vaultPhotos}
          numColumns={3}
          keyExtractor={item => item.id}
          contentContainerStyle={vaultPhotos.length === 0 ? styles.emptyContainer : styles.gridContainer}
          renderItem={renderPhotoItem}
          ListEmptyComponent={
            <EmptyStateView
              icon="lock-closed-outline"
              title="Vault is Empty"
              description="Items you add to the vault are secured with biometrics and hidden from your main library."
              actionLabel="Return to Gallery"
              onAction={() => router.back()}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIconBadge: {
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
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  statusText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  retryBtn: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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
  thumbnailPlaceholder: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  photoPressable: {
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    elevation: 6,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 3,
  },
  removeOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 15,
    elevation: 7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
});
