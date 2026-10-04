import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import PagerView from 'react-native-pager-view';
import { Image } from 'expo-image';
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
import { useVisibleMedia } from '../../hooks/useVisibleMedia';

export default function ViewerScreen() {
  const { id, source } = useLocalSearchParams();
  
  const galleryMedia = useMediaStore(state => state.media);
  const galleryLoadMore = useMediaStore(state => state.loadMoreMedia);
  const galleryHasNext = useMediaStore(state => state.hasNextPage);
  
  const searchMedia = useSearchStore(state => state.searchResults);
  const favoritesMedia = useFavoritesStore(state => state.favoritesMedia);
  const albumMediaInfo = useAlbumsStore(state => state.activeAlbumMedia);
  const albumLoadMore = useAlbumsStore(state => state.loadMoreAlbumMedia);
  const albumHasNext = useAlbumsStore(state => state.hasNextPage);

  const isSearch = source === 'search';
  const isFavorites = source === 'favorites';
  const isAlbum = source === 'album';
  
  const rawMedia = isSearch ? searchMedia : isFavorites ? favoritesMedia : isAlbum ? albumMediaInfo : galleryMedia;
  const media = useVisibleMedia(rawMedia);

  const loadMoreMedia = isSearch || isFavorites ? () => {} : isAlbum ? albumLoadMore : galleryLoadMore;
  const hasNextPage = isSearch || isFavorites ? false : isAlbum ? albumHasNext : galleryHasNext;

  const { isZoomed } = useViewerStore();
  
  const initialIndex = useMemo(() => {
    const idx = media.findIndex(m => m.id === id);
    return idx >= 0 ? idx : 0;
  }, [id, media]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  React.useEffect(() => {
    // Unlock orientation when viewer mounts
    ScreenOrientation.unlockAsync();
    
    // Re-lock to portrait when leaving viewer
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
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
    
    // Pagination boundary check
    if (newIndex >= media.length - 10 && hasNextPage) {
      loadMoreMedia();
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      
      <PagerView
        style={styles.pager}
        initialPage={initialIndex}
        onPageSelected={handlePageSelected}
        scrollEnabled={!isZoomed}
      >
        {media.map((item, index) => {
          // Render optimization: only render adjacent pages
          if (Math.abs(index - currentIndex) > 2) {
            return <View key={item.id} />;
          }
          return <MediaPage key={item.id} item={item} isActive={index === currentIndex} />;
        })}
      </PagerView>

      <ViewerControls item={currentMedia} />
      <MediaDetailsModal item={currentMedia} />
    </View>
  );
}

const MediaPage = React.memo(({ item, isActive }: { item: PixoraMediaInfo, isActive: boolean }) => {
  if (item.mediaType === 'video') {
    return <VideoPage item={item} isActive={isActive} />;
  }

  return <PhotoPage item={item} />;
});
MediaPage.displayName = 'MediaPage';

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
    <View style={[styles.page, { paddingBottom: 80, paddingTop: 60 }]}>
      <VideoView
        style={styles.media}
        player={player}
        nativeControls
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
