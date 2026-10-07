import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import PagerView from 'react-native-pager-view';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';
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

  const { isZoomed } = useViewerStore();
  
  const initialIndex = useMemo(() => {
    const idx = media.findIndex(m => m.id === id);
    return idx >= 0 ? idx : 0;
  }, [id, media]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  React.useEffect(() => {
    ScreenOrientation.unlockAsync();
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
      }
    };
  }, []);

  const currentMedia = media[currentIndex];
  
  if (!currentMedia) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: 'white' }}>Media not found</Text>
      </View>
    );
  }

  const handlePageSelected = (e: any) => {
    const newIndex = e.nativeEvent.position;
    setCurrentIndex(newIndex);
    
    if (newIndex >= media.length - 10 && hasNextPage) {
      loadMoreMedia();
    }
  };

  const router = require('expo-router').router;

  const verticalSwipe = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-20, 20])
    .onEnd((e) => {
      if (Math.abs(e.velocityY) > 500 || Math.abs(e.translationY) > 100) {
        runOnJS(router.back)();
      }
    });

  return (
    <GestureDetector gesture={verticalSwipe}>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
        
        <PagerView
          style={styles.pager}
          initialPage={initialIndex}
          onPageSelected={handlePageSelected}
          scrollEnabled={!isZoomed}
        >
          {media.map((item, index) => {
            if (Math.abs(index - currentIndex) > 2) {
              return <View key={item.id} />;
            }
            return <MediaPage key={item.id} item={item} isActive={index === currentIndex} />;
          })}
        </PagerView>

        <ViewerControls item={currentMedia} />
        <MediaDetailsModal item={currentMedia} />
      </View>
    </GestureDetector>
  );
}

const MediaPage = React.memo(({ item, isActive }: { item: PixoraMediaInfo, isActive: boolean }) => {
  if (item.mediaType === 'video') {
    return <VideoPage item={item} isActive={isActive} />;
  }

  return <PhotoPage item={item} />;
});
MediaPage.displayName = 'MediaPage';

// BUG #1 FIX: Extracted video logic. NO Gesture wrapper.
// This allows native expo-video controls to absorb and process all tap/seek events.
const VideoPage = ({ item, isActive }: { item: PixoraMediaInfo, isActive: boolean }) => {
  const player = useVideoPlayer(item.uri, (p) => {
    p.loop = true;
  });

  // Pause when swiping away
  React.useEffect(() => {
    if (!isActive && player.playing) {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <View style={styles.page}>
      <VideoView
        style={styles.media}
        player={player}
        nativeControls
        contentFit="contain"
      />
    </View>
  );
};

const PhotoPage = ({ item }: { item: PixoraMediaInfo }) => {
  return (
    <View style={styles.page}>
      <ZoomableView>
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
