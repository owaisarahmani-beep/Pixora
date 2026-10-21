import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, BackHandler } from 'react-native';
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
  runOnJS 
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMediaStore } from '../../store/useMediaStore';
import { useViewerStore } from '../../store/useViewerStore';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import ZoomableView from '../../components/viewer/ZoomableView';
import ViewerControls from '../../components/viewer/ViewerControls';
import MediaDetailsModal from '../../components/viewer/MediaDetailsModal';

import { useSearchStore } from '../../store/useSearchStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { useAlbumsStore } from '../../store/useAlbumsStore';
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

  const isSearch = source === 'search';
  const isFavorites = source === 'favorites';
  const isAlbum = source === 'album';
  const isLockedAlbum = source === 'locked';
  const isHidden = source === 'hidden';
  const isPrivate = source === 'private';
  const isArchive = source === 'archive';
  const isSmartAlbum = source === 'smart_album';
  
  const baseMedia = useMemo(() => {
    if (isSearch) return searchMedia;
    if (isFavorites) return favoritesMedia;
    if (isAlbum || isLockedAlbum) return albumMediaInfo;
    if (isSmartAlbum && smartAlbumIdStr) {
      const def = SMART_ALBUM_DEFS.find(d => d.id === smartAlbumIdStr);
      if (def) return galleryMedia.filter(def.filter);
    }
    return galleryMedia;
  }, [isSearch, searchMedia, isFavorites, favoritesMedia, isAlbum, isLockedAlbum, albumMediaInfo, isSmartAlbum, smartAlbumIdStr, galleryMedia]);

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

  // Direct asset fallback to guarantee playback even if item is not in current paged list
  const [directAsset, setDirectAsset] = useState<PixoraMediaInfo | null>(null);

  useEffect(() => {
    if (idStr && !media.some(m => m.id === idStr)) {
      MediaLibrary.getAssetInfoAsync(idStr).then((asset) => {
        if (asset) {
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
  }, [idStr, media]);

  const effectiveMedia = useMemo(() => {
    if (media.length > 0) {
      if (idStr && !media.some(m => m.id === idStr) && directAsset) {
        return [directAsset, ...media];
      }
      return media;
    }
    if (directAsset) return [directAsset];
    return [];
  }, [media, directAsset, idStr]);

  const loadMoreMedia = isSearch || isFavorites ? () => {} : (isAlbum || isLockedAlbum) ? albumLoadMore : galleryLoadMore;
  const hasNextPage = isSearch || isFavorites ? false : (isAlbum || isLockedAlbum) ? albumHasNext : galleryHasNext;

  const { isZoomed, setIsZoomed, detailsVisible, setDetailsVisible } = useViewerStore();
  
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
        queueMicrotask(() => {
          setCurrentIndex(idx);
        });
        pagerRef.current?.setPageWithoutAnimation(idx);
      }
    }
  }, [idStr, effectiveMedia]);

  const safeIndex = Math.max(0, Math.min(currentIndex, Math.max(0, effectiveMedia.length - 1)));
  const currentMedia = effectiveMedia[safeIndex] 
    || effectiveMedia.find(m => m.id === idStr) 
    || directAsset;
  
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const detailsProgress = useSharedValue(0);

  const handleDismiss = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, []);

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

  const handleCloseDetails = useCallback(() => {
    setDetailsVisible(false);
    detailsProgress.value = withTiming(0, { duration: 200 });
    translateY.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDetailsVisible]);

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
            scrollEnabled={!isZoomed}
            offscreenPageLimit={1}
          >
            {effectiveMedia.map((item, index) => {
              if (Math.abs(index - currentIndex) > 2) {
                return <View key={item.id} />;
              }
              return <MediaPage key={item.id} item={item} isActive={index === currentIndex} />;
            })}
          </PagerView>
        </Animated.View>

        {/* Controls Overlay */}
        <Animated.View 
          style={[StyleSheet.absoluteFill, controlsAnimatedStyle]} 
          pointerEvents="box-none"
        >
          <ViewerControls item={currentMedia} detailsProgress={detailsProgress} />
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

const MediaPage = React.memo(({ item, isActive }: { item: PixoraMediaInfo, isActive: boolean }) => {
  if (item.mediaType === 'video') {
    return <VideoPage item={item} isActive={isActive} />;
  }

  return <PhotoPage item={item} isActive={isActive} />;
});
MediaPage.displayName = 'MediaPage';

const VideoPage = ({ item, isActive }: { item: PixoraMediaInfo, isActive: boolean }) => {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(item.uri, (p) => {
    p.loop = false;
  });

  // When video completes, gracefully pause and reset position to 0 so it's ready to replay
  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      try {
        player.pause();
        player.currentTime = 0;
      } catch {}
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  // Pause when swiping away
  useEffect(() => {
    if (!isActive && player.playing) {
      player.pause();
    }
  }, [isActive, player]);

  const bottomInset = Math.max(insets.bottom, 12) + 56;

  return (
    <View style={[styles.page, { paddingBottom: bottomInset }]}>
      {isActive ? (
        <VideoView
          style={styles.media}
          player={player}
          nativeControls
          contentFit="contain"
          fullscreenOptions={{
            enable: false,
          }}
          buttonOptions={{
            showNext: false,
            showPrevious: false,
          }}
        />
      ) : (
        <Image
          source={{ uri: item.uri }}
          style={styles.media}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      )}
    </View>
  );
};

const PhotoPage = ({ item, isActive }: { item: PixoraMediaInfo, isActive: boolean }) => {
  return (
    <View style={styles.page}>
      <ZoomableView isActive={isActive}>
        <Image
          source={{ uri: item.uri }}
          style={styles.media}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </ZoomableView>
    </View>
  );
};

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
  },
  media: {
    width: '100%',
    height: '100%',
  },
});
