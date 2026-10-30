import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, BackHandler, Pressable, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import PagerView from 'react-native-pager-view';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring, 
  interpolate, 
  Extrapolation, 
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as ScreenOrientation from 'expo-screen-orientation';
import { shareService } from '../../services/share/ShareService';
import Slider from '@react-native-community/slider';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMediaStore } from '../../store/useMediaStore';
import { useViewerStore } from '../../store/useViewerStore';
import { useTrashStore } from '../../store/useTrashStore';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import ZoomableView from '../../components/viewer/ZoomableView';
import ViewerControls from '../../components/viewer/ViewerControls';
import MediaDetailsModal from '../../components/viewer/MediaDetailsModal';
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal';
import { toastController } from '../../components/common/Toast';
import { useSecureScreen } from '../../hooks/useSecureScreen';
import { appLockService } from '../../services/privacy/AppLockService';

import { useSearchStore } from '../../store/useSearchStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useAuthorizedMedia, MediaContext } from '../../hooks/useVisibleMedia';
import { SMART_ALBUM_DEFS } from '../../hooks/useSmartAlbums';

export default function ViewerScreen() {
  const { id, source, filter, smartAlbumId } = useLocalSearchParams();
  const idStr = Array.isArray(id) ? id[0] : id;
  const filterStr = Array.isArray(filter) ? filter[0] : (filter as string);
  const smartAlbumIdStr = Array.isArray(smartAlbumId) ? smartAlbumId[0] : (smartAlbumId as string);
  const pagerRef = useRef<PagerView>(null);
  
  const galleryMedia = useMediaStore(state => state.media);
  const galleryLoadMore = useMediaStore(state => state.loadMoreMedia);
  const galleryHasNext = useMediaStore(state => state.hasNextPage);
  
  const searchMedia = useSearchStore(state => state.searchResults);
  const favoritesMedia = useFavoritesStore(state => state.favoritesMedia);
  
  const activeAlbumId = useAlbumsStore(state => state.activeAlbumId);
  const albumMediaInfo = useAlbumsStore(state => state.activeAlbumMedia);
  const albumLoadMore = useAlbumsStore(state => state.loadMoreAlbumMedia);
  const albumHasNext = useAlbumsStore(state => state.hasNextPage);
  const activeSmartAlbumId = useAlbumsStore(state => state.activeSmartAlbumId);
  const smartAlbumMediaInfo = useAlbumsStore(state => state.activeSmartAlbumMedia);

  const isSearch = source === 'search';
  const isFavorites = source === 'favorites';
  const isAlbum = source === 'album';
  const isLockedAlbum = source === 'locked';
  const isHidden = source === 'hidden';
  const isPrivate = source === 'private';
  const isArchive = source === 'archive';
  const isSmartAlbum = source === 'smart_album';

  const isVaultUnlocked = usePrivacyStore(state => state.isVaultUnlocked);
  const unlockedAlbums = usePrivacyStore(state => state.unlockedAlbums);
  const vaultMedia = usePrivacyStore(state => state.vaultMedia);
  const archivedMedia = usePrivacyStore(state => state.archivedMedia);

  const isProtected = isPrivate || isLockedAlbum;
  useSecureScreen(isProtected);
  
  const baseMedia = useMemo(() => {
    if (isSearch) return searchMedia;
    if (isFavorites) return favoritesMedia;
    if (isAlbum || isLockedAlbum) return albumMediaInfo;
    if (isPrivate) return isVaultUnlocked ? vaultMedia : [];
    if (isArchive) return archivedMedia;
    if (isSmartAlbum && smartAlbumIdStr) {
      if (activeSmartAlbumId === smartAlbumIdStr && smartAlbumMediaInfo.length > 0) {
        return smartAlbumMediaInfo;
      }
      const def = SMART_ALBUM_DEFS.find(d => d.id === smartAlbumIdStr);
      if (def) return galleryMedia.filter(m => def.filter(m));
    }
    return galleryMedia;
  }, [
    isSearch,
    searchMedia,
    isFavorites,
    favoritesMedia,
    isAlbum,
    isLockedAlbum,
    albumMediaInfo,
    isPrivate,
    isVaultUnlocked,
    vaultMedia,
    isArchive,
    archivedMedia,
    isSmartAlbum,
    smartAlbumIdStr,
    activeSmartAlbumId,
    smartAlbumMediaInfo,
    galleryMedia,
  ]);

  const rawMedia = useMemo(() => {
    if (filterStr === 'video') {
      return baseMedia.filter(m => m.mediaType === 'video');
    }
    if (filterStr === 'photo') {
      return baseMedia.filter(m => m.mediaType === 'photo');
    }
    return baseMedia;
  }, [baseMedia, filterStr]);
  
  const authContext: MediaContext = useMemo(() => {
    if (isPrivate) return 'private';
    if (isHidden) return 'hidden';
    if (isArchive) return 'archive';
    if (isLockedAlbum && activeAlbumId) return { type: 'locked_album', albumId: activeAlbumId };
    return 'public';
  }, [isPrivate, isHidden, isArchive, isLockedAlbum, activeAlbumId]);

  const media = useAuthorizedMedia(rawMedia, authContext);
  const isDeleted = useTrashStore(state => state.isDeleted);
  const trashedItems = useTrashStore(state => state.items);
  const permanentlyDeletedIds = useTrashStore(state => state.permanentlyDeletedIds);

  // Direct asset fallback to guarantee playback even if item is not in current paged list
  const [directAsset, setDirectAsset] = useState<PixoraMediaInfo | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (idStr && !media.some(m => m.id === idStr)) {
      if (isDeleted(idStr)) {
        return;
      }
      // Strict authorization pre-check: Never query directAsset for unauthorized protected contexts
      const privacyState = usePrivacyStore.getState();
      if (isPrivate && !privacyState.isVaultUnlocked) {
        return;
      }
      if (privacyState.isAssetPrivate(idStr) && !privacyState.isVaultUnlocked) {
        return;
      }

      MediaLibrary.getAssetInfoAsync(idStr).then((asset) => {
        if (isMounted && asset) {
          if (isDeleted(asset.id, asset.localUri || asset.uri)) {
            return;
          }
          // Strict post-fetch authorization check before allowing directAsset state
          const currentPrivacy = usePrivacyStore.getState();
          if (currentPrivacy.isAssetPrivate(asset.id) && !currentPrivacy.isVaultUnlocked) {
            return;
          }
          if (asset.albumId && currentPrivacy.isAlbumLocked(asset.albumId) && !currentPrivacy.unlockedAlbums.includes(asset.albumId)) {
            return;
          }
          if (currentPrivacy.isAssetHidden(asset.id) && authContext !== 'hidden') {
            return;
          }
          if (currentPrivacy.isAssetArchived(asset.id) && authContext !== 'archive') {
            return;
          }

          setDirectAsset({
            id: asset.id,
            uri: asset.localUri || asset.uri,
            filename: asset.filename,
            mediaType: asset.mediaType as any,
            width: asset.width,
            height: asset.height,
            creationTime: asset.creationTime,
            modificationTime: asset.modificationTime,
            duration: asset.duration || 0,
            albumId: asset.albumId,
          });
        }
      }).catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [idStr, media, isDeleted, isPrivate, isVaultUnlocked, authContext]);

  const effectiveMedia = useMemo(() => {
    const trashedIds = new Set(trashedItems.map(i => String(i.id)));
    const permDeletedSet = new Set(permanentlyDeletedIds.map(String));
    const isExcluded = (id?: string) => {
      if (!id) return false;
      const str = String(id);
      if (trashedIds.has(str) || permDeletedSet.has(str)) return true;
      return false;
    };

    const isAuthorizedAsset = (item: PixoraMediaInfo) => {
      if (isExcluded(item.id)) return false;
      const privacyState = usePrivacyStore.getState();
      if (privacyState.isAssetPrivate(item.id) && !isVaultUnlocked) return false;
      if (item.albumId && privacyState.isAlbumLocked(item.albumId) && !privacyState.unlockedAlbums.includes(item.albumId)) return false;
      if (privacyState.isAssetHidden(item.id) && authContext !== 'hidden') return false;
      if (privacyState.isAssetArchived(item.id) && authContext !== 'archive') return false;
      return true;
    };

    let base = media;
    if (base.length > 0) {
      if (idStr && !base.some(m => m.id === idStr) && directAsset && isAuthorizedAsset(directAsset)) {
        base = [directAsset, ...base];
      }
    } else if (directAsset && isAuthorizedAsset(directAsset)) {
      base = [directAsset];
    }
    return base.filter(m => isAuthorizedAsset(m));
  }, [media, directAsset, idStr, trashedItems, permanentlyDeletedIds, isVaultUnlocked, authContext]);

  const handleDismiss = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, []);

  // If viewing a private photo or locked album and authorization is revoked, immediately exit
  useEffect(() => {
    const isUnauthorizedPrivate = isPrivate && !isVaultUnlocked;
    const isUnauthorizedLocked = isLockedAlbum && !!activeAlbumId && !unlockedAlbums.includes(activeAlbumId);

    if (isUnauthorizedPrivate || isUnauthorizedLocked) {
      handleDismiss();
    }
  }, [isPrivate, isVaultUnlocked, isLockedAlbum, activeAlbumId, unlockedAlbums, handleDismiss]);

  // Dismiss viewer when app goes to background while displaying protected media
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'inactive' || nextState === 'background') {
        if (appLockService.isAuthenticating) return;
        if (isPrivate || isLockedAlbum || usePrivacyStore.getState().isAppLockEnabled) {
          handleDismiss();
        }
      }
    });
    return () => sub.remove();
  }, [isPrivate, isLockedAlbum, handleDismiss]);

  // If currently viewed item was deleted and no media remains, return to gallery
  useEffect(() => {
    if (effectiveMedia.length === 0 && initialSyncDoneRef.current) {
      handleDismiss();
    }
  }, [effectiveMedia.length, handleDismiss]);

  const loadMoreMedia = isSearch || isFavorites ? () => {} : (isAlbum || isLockedAlbum) ? albumLoadMore : galleryLoadMore;
  const hasNextPage = isSearch || isFavorites ? false : (isAlbum || isLockedAlbum) ? albumHasNext : galleryHasNext;

  const { isZoomed, setIsZoomed, detailsVisible, setDetailsVisible, isSeeking } = useViewerStore();
  
  const initialIndex = useMemo(() => {
    const idx = effectiveMedia.findIndex(m => m.id === idStr);
    return idx >= 0 ? idx : 0;
  }, [idStr, effectiveMedia]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Sync index once when media loads and guarantee native PagerView is synchronized
  const initialSyncDoneRef = useRef(false);
  useEffect(() => {
    if (!initialSyncDoneRef.current && idStr && effectiveMedia.length > 0) {
      const idx = effectiveMedia.findIndex(m => m.id === idStr);
      if (idx >= 0) {
        initialSyncDoneRef.current = true;
        if (idx !== initialIndex) {
          pagerRef.current?.setPageWithoutAnimation(idx);
        }
      }
    }
  }, [idStr, effectiveMedia, initialIndex]);

  const safeIndex = Math.max(0, Math.min(currentIndex, Math.max(0, effectiveMedia.length - 1)));
  const currentMedia = effectiveMedia[safeIndex] || effectiveMedia.find(m => m.id === idStr);
  
  // Proactively prefetch adjacent photo assets with deduplication cache to keep Glide queues light
  const prefetchedUrisRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (effectiveMedia.length === 0) return;
    const urisToPrefetch: string[] = [];
    const windowIndices = [
      currentIndex + 1,
      currentIndex - 1,
      currentIndex + 2,
      currentIndex - 2,
      currentIndex + 3,
      currentIndex - 3,
    ];
    for (const idx of windowIndices) {
      if (idx >= 0 && idx < effectiveMedia.length) {
        const item = effectiveMedia[idx];
        if (item && item.mediaType === 'photo' && item.uri) {
          if (!prefetchedUrisRef.current.has(item.uri)) {
            urisToPrefetch.push(item.uri);
            prefetchedUrisRef.current.add(item.uri);
          }
        }
      }
    }

    // Bound memory size of deduplication set
    if (prefetchedUrisRef.current.size > 80) {
      prefetchedUrisRef.current.clear();
      for (const uri of urisToPrefetch) {
        prefetchedUrisRef.current.add(uri);
      }
    }

    if (urisToPrefetch.length > 0) {
      Image.prefetch(urisToPrefetch, 'memory-disk').catch(() => {});
    }
  }, [currentIndex, effectiveMedia]);

  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const detailsProgress = useSharedValue(0);

  // Android hardware & bottom system navigation bar back button:
  // Directly exits the viewer and returns to the calling screen (Home tab or Album)
  useEffect(() => {
    const onBackPress = () => {
      handleDismiss();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [handleDismiss]);

  // Support natural device rotation for landscape and portrait videos in the viewer
  // Defer slightly with requestAnimationFrame to avoid competing with initial screen transition & layout
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      ScreenOrientation.unlockAsync().catch(() => {});
    });
    return () => {
      cancelAnimationFrame(frame);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailsVisible(false);
    detailsProgress.value = withTiming(0, { duration: 200 });
    translateY.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDetailsVisible]);

  const deleteMediaAsync = useMediaStore((state) => state.deleteMediaAsync);
  const isDeletingRef = useRef(false);

  const handleDeleteCurrentMedia = useCallback(
    async (itemToDelete?: PixoraMediaInfo): Promise<boolean> => {
      const target = itemToDelete || currentMedia;
      if (!target || isDeletingRef.current) return false;

      isDeletingRef.current = true;
      try {
        const targetId = String(target.id);
        const currIdx = effectiveMedia.findIndex((m) => String(m.id) === targetId);

        // Determine next target item before removing target
        let targetNextId: string | null = null;
        if (effectiveMedia.length > 1) {
          if (currIdx >= 0 && currIdx + 1 < effectiveMedia.length) {
            targetNextId = String(effectiveMedia[currIdx + 1].id);
          } else if (currIdx > 0) {
            targetNextId = String(effectiveMedia[currIdx - 1].id);
          }
        }

        const success = await deleteMediaAsync(targetId);
        if (!success) {
          return false;
        }

        toastController.show({ message: 'Moved to Trash', type: 'success' });

        // If no valid media remains, return to parent screen
        if (effectiveMedia.length <= 1 || !targetNextId) {
          handleDismiss();
          return true;
        }

        // Remaining items in visual order
        const remaining = effectiveMedia.filter((m) => String(m.id) !== targetId);
        const nextIdx = remaining.findIndex((m) => String(m.id) === targetNextId);
        const safeNextIdx = Math.max(0, Math.min(nextIdx >= 0 ? nextIdx : 0, remaining.length - 1));

        setCurrentIndex(safeNextIdx);
        pagerRef.current?.setPageWithoutAnimation(safeNextIdx);
        return true;
      } finally {
        isDeletingRef.current = false;
      }
    },
    [currentMedia, effectiveMedia, deleteMediaAsync, handleDismiss]
  );

  // Sync detailsVisible state from menu actions
  useEffect(() => {
    if (detailsVisible) {
      detailsProgress.value = withSpring(1, { damping: 22, stiffness: 200 });
      translateY.value = 0;
    } else {
      detailsProgress.value = withTiming(0, { duration: 200 });
      translateY.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsVisible]);

  const handlePageSelected = (e: any) => {
    const newIndex = e.nativeEvent.position;
    if (typeof newIndex === 'number' && newIndex >= 0 && newIndex < effectiveMedia.length) {
      setCurrentIndex(newIndex);
      setIsZoomed(false);
      if (detailsVisible) {
        handleCloseDetails();
      }
      
      if (newIndex >= effectiveMedia.length - 10 && hasNextPage) {
        loadMoreMedia();
      }
    }
  };

  const handlePageScroll = useCallback(
    (e: any) => {
      const pos = Math.round(e.nativeEvent.position);
      if (typeof pos === 'number' && pos >= 0 && pos < effectiveMedia.length && Math.abs(pos - currentIndex) >= 2) {
        setCurrentIndex(pos);
      }
    },
    [effectiveMedia.length, currentIndex]
  );

  // Fluid vertical drag handler:
  // - Downwards: Smooth drag to dismiss with scaling & fade
  // - Upwards: 1:1 tactile tracking that pulls up the Details sheet, keeping the image completely still
  const verticalDrag = Gesture.Pan()
    .enabled(!isZoomed)
    .maxPointers(1)
    .activeOffsetY([-30, 30])
    .failOffsetX([-10, 10])
    .cancelsTouchesInView(false)
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        // Dragging down (Dismiss gesture)
        translateY.value = e.translationY;
        translateX.value = e.translationX * 0.2;
        scale.value = Math.max(0.75, 1 - (e.translationY / 1200));
        detailsProgress.value = 0;
      } else {
        // Dragging up: tactile tracking that brings up details sheet — photo stays still!
        translateY.value = 0;
        translateX.value = 0;
        scale.value = 1;
        detailsProgress.value = Math.min(1, Math.max(0, -e.translationY / 260));
      }
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 120 || e.velocityY > 600) {
        // Dragged down far enough -> animate offscreen and dismiss
        translateY.value = withTiming(800, { duration: 200 }, () => {
          runOnJS(handleDismiss)();
        });
      } else if (e.translationY < -60 || e.velocityY < -500) {
        // Dragged up far enough -> snap details sheet open
        detailsProgress.value = withSpring(1, { damping: 22, stiffness: 200 });
        translateY.value = 0;
        runOnJS(setDetailsVisible)(true);
      } else {
        // Cancel -> smoothly animate back without any spring shake/wobble
        translateY.value = withTiming(0, { duration: 180 });
        translateX.value = withTiming(0, { duration: 180 });
        scale.value = withTiming(1, { duration: 180 });
        detailsProgress.value = withTiming(0, { duration: 180 });
        runOnJS(setDetailsVisible)(false);
      }
    });

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const opacity = translateY.value > 0
      ? interpolate(translateY.value, [0, 250], [1, 0], Extrapolation.CLAMP)
      : 1;
    return {
      backgroundColor: `rgba(0, 0, 0, ${opacity})`,
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { translateX: translateX.value },
        { scale: scale.value },
      ],
    };
  });

  const controlsAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, 80],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
    };
  });

  if (!currentMedia) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: 'white' }}>Media not found</Text>
      </View>
    );
  }

  return (
    <GestureDetector gesture={verticalDrag}>
      <Animated.View style={[styles.container, backdropAnimatedStyle]}>
        <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
        
        <Animated.View style={[styles.pagerContainer, contentAnimatedStyle]}>
          <PagerView
            ref={pagerRef}
            style={styles.pager}
            initialPage={initialIndex}
            onPageSelected={handlePageSelected}
            onPageScroll={handlePageScroll}
            scrollEnabled={!isZoomed && !isSeeking}
            offscreenPageLimit={2}
          >
            {effectiveMedia.map((item, index) => {
              const isActive = index === currentIndex;
              const isWithinWindow = Math.abs(index - currentIndex) <= 4;
              if (!isWithinWindow && !isActive) {
                return <View key={item.id} style={styles.page} />;
              }
              return (
                <MediaPage
                  key={item.id}
                  item={item}
                  isActive={isActive}
                  detailsProgress={detailsProgress}
                  onDeleteMedia={handleDeleteCurrentMedia}
                />
              );
            })}
          </PagerView>
        </Animated.View>

        {/* Controls Overlay */}
        <Animated.View 
          style={[StyleSheet.absoluteFill, controlsAnimatedStyle]} 
          pointerEvents="box-none"
        >
          <ViewerControls item={currentMedia} detailsProgress={detailsProgress} onDeleteMedia={handleDeleteCurrentMedia} />
        </Animated.View>

        {/* Integrated Fluid Details Bottom Sheet */}
        <MediaDetailsModal 
          item={currentMedia} 
          detailsProgress={detailsProgress}
          onClose={handleCloseDetails}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const formatVideoTime = (totalSeconds: number): string => {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const InactiveVideoPage = React.memo(({ item }: { item: PixoraMediaInfo }) => {
  const [hasError, setHasError] = useState(false);

  return (
    <View style={styles.page}>
      <View style={styles.mediaWrapper}>
        <View style={[styles.media, StyleSheet.absoluteFill as any, styles.videoPosterFallback]}>
          <Ionicons name="videocam-outline" size={48} color="rgba(255, 255, 255, 0.4)" />
        </View>

        {!hasError && (
          <Image
            source={{ uri: item.uri }}
            style={[styles.media, StyleSheet.absoluteFill as any]}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="normal"
            allowDownscaling={true}
            transition={100}
            onError={() => setHasError(true)}
          />
        )}

        <View style={styles.centerPlayBtn} pointerEvents="none">
          <Ionicons name="play" size={34} color="#FFFFFF" style={{ marginLeft: 3 }} />
        </View>
      </View>
    </View>
  );
});
InactiveVideoPage.displayName = 'InactiveVideoPage';

const MediaPage = React.memo(
  ({
    item,
    isActive,
    detailsProgress,
    onDeleteMedia,
  }: {
    item: PixoraMediaInfo;
    isActive: boolean;
    detailsProgress: SharedValue<number>;
    onDeleteMedia?: (item: PixoraMediaInfo) => Promise<boolean>;
  }) => {
    if (item.mediaType === 'video') {
      if (!isActive) {
        return <InactiveVideoPage item={item} />;
      }
      return <VideoPage item={item} isActive={isActive} detailsProgress={detailsProgress} onDeleteMedia={onDeleteMedia} />;
    }

    return <PhotoPage item={item} isActive={isActive} />;
  }
);
MediaPage.displayName = 'MediaPage';

const VideoPage = ({
  item,
  isActive,
  detailsProgress,
  onDeleteMedia,
}: {
  item: PixoraMediaInfo;
  isActive: boolean;
  detailsProgress: SharedValue<number>;
  onDeleteMedia?: (item: PixoraMediaInfo) => Promise<boolean>;
}) => {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(item.uri, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
  });

  const [isPlaying, setIsPlaying] = useState(player.playing);
  const [playerStatus, setPlayerStatus] = useState<string>(player.status || 'loading');
  const [currentTime, setCurrentTime] = useState(player.currentTime || 0);
  const [duration, setDuration] = useState(
    player.duration > 0 ? player.duration : (item.duration ? item.duration : 0)
  );
  const [isMuted, setIsMuted] = useState(player.muted);
  const [seekPosition, setSeekPosition] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isFavorite = useFavoritesStore((state) => state.favorites.has(item.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const deleteMediaAsync = useMediaStore((state) => state.deleteMediaAsync);

  const controlsVisible = useViewerStore(state => state.controlsVisible);
  const setControlsVisible = useViewerStore(state => state.setControlsVisible);
  const isSeeking = useViewerStore(state => state.isSeeking);
  const setIsSeeking = useViewerStore(state => state.setIsSeeking);
  const isSeekingRef = useRef(isSeeking);
  isSeekingRef.current = isSeeking;

  // Clean up player on unmount
  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  // Synchronize player event listeners stably without recreation on duration/seek changes
  useEffect(() => {
    try {
      player.timeUpdateEventInterval = 0.25;
    } catch {}

    const subPlaying = player.addListener('playingChange', (e) => {
      if (__DEV__) {
        console.log('[Pixora VideoPlayer] playingChange:', e.isPlaying);
      }
      if (isMountedRef.current) {
        setIsPlaying(e.isPlaying);
      }
    });

    const subTime = player.addListener('timeUpdate', (e) => {
      if (!isSeekingRef.current && isMountedRef.current) {
        setCurrentTime(e.currentTime);
      }
    });

    const subSourceLoad = player.addListener('sourceLoad', (e) => {
      if (e.duration > 0 && isMountedRef.current) {
        setDuration(e.duration);
      }
    });

    const subStatus = player.addListener('statusChange', (payload: any) => {
      const nextStatus = payload?.status || player.status;
      if (__DEV__) {
        console.log('[Pixora VideoPlayer] statusChange:', {
          status: nextStatus,
          error: payload?.error,
          playerDuration: player.duration,
          playing: player.playing,
        });
      }
      if (isMountedRef.current) {
        if (nextStatus) {
          setPlayerStatus(nextStatus);
        }
        if (player.duration > 0) {
          setDuration(player.duration);
        }
      }
      if (payload?.error) {
        console.error('[Pixora VideoPlayer] Native player error:', payload.error);
      }
    });

    const subEnd = player.addListener('playToEnd', () => {
      if (isMountedRef.current) {
        setIsPlaying(false);
        setCurrentTime(player.duration || 0);
      }
    });

    return () => {
      subPlaying.remove();
      subTime.remove();
      subSourceLoad.remove();
      subStatus.remove();
      subEnd.remove();
    };
  }, [player]);

  // Pause when swiping away
  useEffect(() => {
    if (!isActive && player.playing) {
      player.pause();
    }
  }, [isActive, player]);

  // Auto-hide idle timer when playing
  const idleTimerRef = useRef<any>(null);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    if (isPlaying && !isSeeking) {
      idleTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isPlaying, isSeeking, setControlsVisible]);

  useEffect(() => {
    if (isPlaying) {
      resetIdleTimer();
    } else {
      clearIdleTimer();
      setControlsVisible(true);
    }
    return clearIdleTimer;
  }, [isPlaying, resetIdleTimer, setControlsVisible]);

  // Tap gesture on video to toggle controls visibility without restarting playback
  const handleTapVideo = () => {
    if (controlsVisible) {
      clearIdleTimer();
      setControlsVisible(false);
    } else {
      setControlsVisible(true);
      resetIdleTimer();
    }
  };

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(handleTapVideo)();
    });

  // Slider seeking handlers
  const handleSlidingStart = (value: number) => {
    clearIdleTimer();
    setIsSeeking(true);
    setSeekPosition(value);
  };

  const handleValueChange = (value: number) => {
    setSeekPosition(value);
  };

  const handleSlidingComplete = (value: number) => {
    try {
      player.currentTime = value;
      setCurrentTime(value);
    } catch {}
    setSeekPosition(null);
    setIsSeeking(false);
    if (isPlaying) {
      resetIdleTimer();
    }
  };

  // Play / Pause toggle
  const maxDuration = duration > 0 ? duration : (item.duration ? item.duration : 0);
  const isEnded = maxDuration > 0 && currentTime >= maxDuration - 0.5;

  const togglePlayPause = () => {
    try {
      if (__DEV__) {
        console.log('[Pixora VideoPlayer] Before toggle:', {
          playing: player.playing,
          status: player.status,
          currentTime: player.currentTime,
          duration: player.duration,
          itemUri: item.uri,
        });
      }
      if (player.playing) {
        player.pause();
      } else {
        if (isEnded) {
          player.currentTime = 0;
          setCurrentTime(0);
        }
        player.play();
      }
      if (__DEV__) {
        console.log('[Pixora VideoPlayer] After toggle request:', {
          playing: player.playing,
          status: player.status,
          currentTime: player.currentTime,
        });
      }
    } catch (e) {
      console.error('[Pixora VideoPlayer] togglePlayPause error:', e);
    }
  };

  // Mute toggle
  const toggleMute = () => {
    try {
      const next = !player.muted;
      player.muted = next;
      setIsMuted(next);
    } catch {}
  };

  // Share
  const handleShare = async () => {
    try {
      await shareService.shareSingleAsync(item);
    } catch (e) {
      console.error('Share failed', e);
    }
  };

  // Delete
  const handleDelete = async () => {
    setShowDeleteModal(false);
    try {
      player.pause();
    } catch {}
    if (onDeleteMedia) {
      await onDeleteMedia(item);
    } else {
      const success = await deleteMediaAsync(item.id);
      if (success) {
        router.back();
      }
    }
  };

  // Animated styles for controls
  const controlsOpacity = useSharedValue(1);
  useEffect(() => {
    controlsOpacity.value = withTiming(controlsVisible ? 1 : 0, { duration: 200 });
  }, [controlsVisible, controlsOpacity]);

  const centerPlayAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: controlsOpacity.value,
    };
  });

  const bottomCapsuleAnimatedStyle = useAnimatedStyle(() => {
    const baseOpacity = controlsOpacity.value;
    if (!detailsProgress) return { opacity: baseOpacity };
    const detailOpacity = interpolate(
      detailsProgress.value,
      [0, 0.35],
      [1, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      detailsProgress.value,
      [0, 1],
      [0, 40],
      Extrapolation.CLAMP
    );
    return {
      opacity: baseOpacity * detailOpacity,
      transform: [{ translateY }],
    };
  });

  const displayTime = seekPosition !== null ? seekPosition : currentTime;

  return (
    <View style={styles.page}>
      {/* Video Surface Area with Tap Gesture */}
      <GestureDetector gesture={singleTap}>
        <View style={styles.mediaWrapper}>
          {/* 1. Underlying Stable Poster Image (visible while loading/buffering) */}
          {playerStatus !== 'readyToPlay' && !isPlaying && (
            posterError ? (
              <View style={[styles.media, StyleSheet.absoluteFill as any, styles.videoPosterFallback]}>
                <Ionicons name="videocam-outline" size={48} color="rgba(255, 255, 255, 0.4)" />
              </View>
            ) : (
              <Image
                source={{ uri: item.uri }}
                style={[styles.media, StyleSheet.absoluteFill as any]}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
                onError={() => {
                  if (isMountedRef.current) {
                    setPosterError(true);
                  }
                }}
              />
            )
          )}

          {/* 2. Video Player View */}
          <VideoView
            style={styles.media}
            player={player}
            nativeControls={false}
            contentFit="contain"
          />

          {/* 3. Buffering / Loading Indicator */}
          {playerStatus === 'loading' && (
            <View style={styles.videoLoadingOverlay} pointerEvents="none">
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          )}

          {/* 4. Error & Retry State */}
          {playerStatus === 'error' && (
            <View style={styles.videoErrorOverlay}>
              <Ionicons name="alert-circle-outline" size={36} color="#EF4444" />
              <Text style={styles.videoErrorText}>Could not play video</Text>
              <Pressable
                style={styles.videoRetryBtn}
                onPress={() => {
                  try {
                    player.replace(item.uri);
                  } catch {}
                }}
              >
                <Text style={styles.videoRetryBtnText}>Retry</Text>
              </Pressable>
            </View>
          )}
        </View>
      </GestureDetector>

      {/* Single Prominent Central Play/Replay Button when paused, unobtrusive pause button when playing with controls */}
      {controlsVisible && (
        <Animated.View style={[styles.centerPlayWrapper, centerPlayAnimatedStyle]} pointerEvents="box-none">
          <Pressable
            style={isPlaying ? styles.centerPauseBtn : styles.centerPlayBtn}
            onPress={togglePlayPause}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Ionicons
              name={isEnded ? "reload" : isPlaying ? "pause" : "play"}
              size={isPlaying ? 26 : 34}
              color="#FFFFFF"
              style={{ marginLeft: isPlaying ? 0 : isEnded ? 0 : 3 }}
            />
          </Pressable>
        </Animated.View>
      )}

      {/* Unified Floating Video Playback Capsule */}
      <Animated.View
        style={[
          styles.bottomPlaybackContainer,
          { paddingBottom: Math.max(insets.bottom, 10) + 8 },
          bottomCapsuleAnimatedStyle,
        ]}
        pointerEvents={controlsVisible ? 'box-none' : 'none'}
      >
        <View style={styles.playbackCapsule}>
          {/* Seek Scrubber Row */}
          <View style={styles.scrubberRow}>
            <Text style={styles.timeText}>{formatVideoTime(displayTime)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={maxDuration > 0 ? maxDuration : 1}
              value={displayTime}
              onSlidingStart={handleSlidingStart}
              onValueChange={handleValueChange}
              onSlidingComplete={handleSlidingComplete}
              minimumTrackTintColor="#0A84FF"
              maximumTrackTintColor="rgba(255, 255, 255, 0.25)"
              thumbTintColor="#FFFFFF"
            />
            <Text style={styles.timeText}>{formatVideoTime(maxDuration)}</Text>
          </View>

          {/* Action Row: Separated Playback Audio Control & Media Actions */}
          <View style={styles.playbackActionsRow}>
            {/* Playback Audio Control (Mute Toggle) */}
            <View style={styles.playbackGroup}>
              <Pressable onPress={toggleMute} style={styles.playbackActionBtn} hitSlop={10} accessibilityRole="button">
                <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={22} color={isMuted ? "#EF4444" : "#FFFFFF"} />
              </Pressable>
            </View>

            {/* Subtle Divider Separating Playback from Media Actions */}
            <View style={styles.actionDivider} />

            {/* Media Actions: Share, Favorite, Delete */}
            <View style={styles.mediaActionsGroup}>
              <Pressable onPress={handleShare} style={styles.playbackActionBtn} hitSlop={10} accessibilityRole="button">
                <Ionicons name="share-outline" size={22} color="#FFFFFF" />
              </Pressable>

              <Pressable onPress={() => toggleFavorite(item.id, item)} style={styles.playbackActionBtn} hitSlop={10} accessibilityRole="button">
                <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? "#EF4444" : "#FFFFFF"} />
              </Pressable>

              <Pressable onPress={() => setShowDeleteModal(true)} style={styles.playbackActionBtn} hitSlop={10} accessibilityRole="button">
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        visible={showDeleteModal}
        title="Delete Video?"
        message="You can restore this from Trash within 30 days."
        confirmText="Move to Trash"
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
      />
    </View>
  );
};

const PhotoPage = React.memo(({ item, isActive }: { item: PixoraMediaInfo, isActive: boolean }) => {
  return (
    <View style={styles.page}>
      <ZoomableView isActive={isActive}>
        <Image
          source={{ uri: item.uri }}
          style={styles.media}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="high"
          allowDownscaling={true}
          recyclingKey={item.id}
          transition={150}
        />
      </ZoomableView>
    </View>
  );
});
PhotoPage.displayName = 'PhotoPage';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pagerContainer: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  mediaWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  centerPlayWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  centerPlayBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  centerPauseBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomPlaybackContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  playbackCapsule: {
    backgroundColor: 'rgba(28, 28, 30, 0.94)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    width: '92%',
    maxWidth: 360,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 28,
  },
  slider: {
    flex: 1,
    marginHorizontal: 4,
    height: 28,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center',
  },
  playbackActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 2,
    paddingHorizontal: 8,
  },
  playbackGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 8,
  },
  mediaActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  playbackActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 38,
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    zIndex: 5,
  },
  videoPosterFallback: {
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoErrorOverlay: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 6,
    padding: 20,
  },
  videoErrorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
  },
  videoRetryBtn: {
    backgroundColor: '#0A84FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  videoRetryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
