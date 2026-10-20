import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
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
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
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

export default function ViewerScreen() {
  const { id, source } = useLocalSearchParams();
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
  
  const rawMedia = isSearch ? searchMedia : isFavorites ? favoritesMedia : (isAlbum || isLockedAlbum) ? albumMediaInfo : galleryMedia;
  
  const authContext: MediaContext = useMemo(() => {
    if (isPrivate) return 'private';
    if (isHidden) return 'hidden';
    if (isArchive) return 'archive';
    if (isLockedAlbum && activeAlbumId) return { type: 'locked_album', albumId: activeAlbumId };
    return 'public';
  }, [isPrivate, isHidden, isArchive, isLockedAlbum, activeAlbumId]);

  const media = useAuthorizedMedia(rawMedia, authContext);

  const loadMoreMedia = isSearch || isFavorites ? () => {} : (isAlbum || isLockedAlbum) ? albumLoadMore : galleryLoadMore;
  const hasNextPage = isSearch || isFavorites ? false : (isAlbum || isLockedAlbum) ? albumHasNext : galleryHasNext;

  const { isZoomed, setIsZoomed, detailsVisible, setDetailsVisible } = useViewerStore();
  
  const initialIndex = useMemo(() => {
    const idx = media.findIndex(m => m.id === id);
    return idx >= 0 ? idx : 0;
  }, [id, media]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Guarantee clean viewer state on mount/unmount
  useEffect(() => {
    setIsZoomed(false);
    setDetailsVisible(false);
    return () => {
      setIsZoomed(false);
      setDetailsVisible(false);
    };
  }, [setIsZoomed, setDetailsVisible]);

  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    if (Platform.OS === 'android') {
      try {
        const NavigationBar = require('expo-navigation-bar');
        NavigationBar?.setVisibilityAsync?.('hidden')?.catch(() => {});
      } catch (e) {}
    }
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      if (Platform.OS === 'android') {
        try {
          const NavigationBar = require('expo-navigation-bar');
          NavigationBar?.setVisibilityAsync?.('visible')?.catch(() => {});
        } catch (e) {}
      }
    };
  }, []);

  const currentMedia = media[currentIndex];
  
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const detailsProgress = useSharedValue(0);

  const handleDismiss = useCallback(() => {
    router.back();
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailsVisible(false);
    detailsProgress.value = withSpring(0, { damping: 22, stiffness: 220 });
    translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
  }, [setDetailsVisible, detailsProgress, translateY]);

  // Sync detailsVisible state from menu actions with spring animation
  useEffect(() => {
    if (detailsVisible) {
      detailsProgress.value = withSpring(1, { damping: 22, stiffness: 200 });
      translateY.value = withSpring(-100, { damping: 22, stiffness: 200 });
    } else {
      detailsProgress.value = withSpring(0, { damping: 22, stiffness: 220 });
      if (translateY.value < 0) {
        translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
      }
    }
  }, [detailsVisible, detailsProgress, translateY]);

  const handlePageSelected = (e: any) => {
    const newIndex = e.nativeEvent.position;
    setCurrentIndex(newIndex);
    setIsZoomed(false);
    if (detailsVisible) {
      handleCloseDetails();
    }
    
    if (newIndex >= media.length - 10 && hasNextPage) {
      loadMoreMedia();
    }
  };

  // Fluid vertical drag handler:
  // - Downwards: Smooth drag to dismiss with scaling & fade
  // - Upwards: 1:1 tactile tracking that pulls up the Details sheet directly under the finger
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
        translateX.value = e.translationX * 0.25;
        scale.value = Math.max(0.75, 1 - (e.translationY / 1200));
        detailsProgress.value = 0;
      } else {
        // Dragging up: 1:1 tactile tracking that brings up the details sheet
        translateY.value = e.translationY * 0.45;
        detailsProgress.value = Math.min(1, Math.max(0, -e.translationY / 240));
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
        // Dragged up far enough -> snap details sheet open with spring physics
        detailsProgress.value = withSpring(1, { damping: 22, stiffness: 200 });
        translateY.value = withSpring(-100, { damping: 22, stiffness: 200 });
        runOnJS(setDetailsVisible)(true);
      } else {
        // Cancel -> smoothly spring back into place
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        scale.value = withSpring(1, { damping: 20, stiffness: 200 });
        detailsProgress.value = withSpring(0, { damping: 20, stiffness: 200 });
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
      opacity: detailsProgress.value > 0.1 ? 0 : opacity,
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
            {media.map((item, index) => {
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
          <ViewerControls item={currentMedia} />
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
    p.loop = true;
  });

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
