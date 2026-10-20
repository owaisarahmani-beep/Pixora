import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMediaStore } from '../store/useMediaStore';
import { usePrivacyStore } from '../store/usePrivacyStore';
import { useAuthorizedMedia } from '../hooks/useVisibleMedia';
import { SMART_ALBUM_DEFS } from '../hooks/useSmartAlbums';
import { PixoraMediaInfo } from '../services/media/mediaTypes';
import { useMemories } from '../hooks/useMemories';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SLIDE_INTERVAL_MS = 4000;

export default function SlideshowScreen() {
  const insets = useSafeAreaInsets();
  const { source, albumId, smartAlbumId, memoryId } = useLocalSearchParams<{
    source?: string;
    albumId?: string;
    smartAlbumId?: string;
    memoryId?: string;
  }>();

  // Media sources
  const allMedia = useMediaStore(state => state.media);
  const publicMedia = useAuthorizedMedia(allMedia, 'public');
  const archiveMedia = useAuthorizedMedia(allMedia, 'archive');
  const memories = useMemories(publicMedia);

  const selectedMemory = useMemo(() => {
    return memoryId ? memories.find(m => m.id === memoryId) : null;
  }, [memoryId, memories]);

  // Resolve media array based on source param
  const slides: PixoraMediaInfo[] = useMemo(() => {
    let base: PixoraMediaInfo[] = [];

    if (source === 'archive') {
      base = archiveMedia;
    } else if (source === 'memory' && memoryId) {
      base = selectedMemory ? selectedMemory.assets : [];
    } else if (source === 'smart' && smartAlbumId) {
      const def = SMART_ALBUM_DEFS.find(d => d.id === smartAlbumId);
      base = def ? publicMedia.filter(def.filter) : publicMedia;
    } else if (source === 'album' && albumId) {
      base = publicMedia.filter(m => m.albumId === albumId);
    } else {
      base = publicMedia;
    }

    // Photos for story slideshow
    return base.filter(m => m.mediaType === 'photo');
  }, [source, albumId, smartAlbumId, memoryId, publicMedia, archiveMedia, selectedMemory]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setCurrentIndex(prev => {
      if (prev + 1 >= slides.length) {
        // Finished story -> close
        router.back();
        return prev;
      }
      return prev + 1;
    });
  }, [slides.length]);

  const goPrevious = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  // Set up / tear down the advance timer (paused when finger is holding)
  useEffect(() => {
    if (!isHolding && slides.length > 0) {
      intervalRef.current = setInterval(advance, SLIDE_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHolding, advance, slides.length, currentIndex]);

  // Reset index when slides list changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [slides.length]);

  const handlePress = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    // Left 30% goes to previous slide
    if (x < SCREEN_WIDTH * 0.3) {
      goPrevious();
    } else {
      // Right 70% goes to next slide
      advance();
    }
  };

  const currentSlide = slides[currentIndex];

  if (slides.length === 0) {
    return (
      <View style={styles.noPhotosContainer}>
        <StatusBar hidden />
        <Ionicons name="images-outline" size={64} color="#FFFFFF" />
        <Text style={styles.noPhotosText}>No photos in this memory</Text>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Main Touch Container with WhatsApp-style Hold-to-Pause */}
      <Pressable
        style={styles.fullScreenPressable}
        onPressIn={() => setIsHolding(true)}
        onPressOut={() => setIsHolding(false)}
        onPress={handlePress}
      >
        {/* Subtle Ambient Blurred Backdrop (prevents black letterboxing) */}
        {currentSlide && (
          <Image
            source={{ uri: currentSlide.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={30}
          />
        )}
        <View style={styles.backdropDarkDim} />

        {/* Foreground Photo (contentFit="contain" prevents any over-zooming or cropping) */}
        {currentSlide && (
          <Image
            key={currentSlide.id}
            source={{ uri: currentSlide.uri }}
            style={styles.mainImage}
            contentFit="contain"
            transition={150}
          />
        )}
      </Pressable>

      {/* Top Overlays (WhatsApp/Instagram Status Header): Hidden when holding to pause */}
      {!isHolding && (
        <View style={[styles.headerContainer, { top: insets.top + 8 }]} pointerEvents="box-none">
          {/* Segmented Progress Bars */}
          <View style={styles.progressBarRow}>
            {slides.map((slide, index) => {
              const isPast = index < currentIndex;
              const isCurrent = index === currentIndex;
              return (
                <View key={slide.id || index} style={styles.progressSegmentTrack}>
                  <View
                    style={[
                      styles.progressSegmentFill,
                      isPast && styles.progressSegmentFilled,
                      isCurrent && styles.progressSegmentCurrent,
                    ]}
                  />
                </View>
              );
            })}
          </View>

          {/* Title & Close Row */}
          <View style={styles.headerInfoRow} pointerEvents="box-none">
            <View style={styles.titleColumn}>
              <Text style={styles.memoryTitle} numberOfLines={1}>
                {selectedMemory?.title || 'Memory'}
              </Text>
              {selectedMemory?.subtitle && (
                <Text style={styles.memorySubtitle} numberOfLines={1}>
                  {selectedMemory.subtitle}
                </Text>
              )}
            </View>

            <Pressable
              style={styles.closeButton}
              onPress={() => router.back()}
              hitSlop={14}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Subtle Hold Hint (fades away or shows briefly) */}
      {isHolding && (
        <View style={styles.pausePill}>
          <Ionicons name="pause" size={14} color="#FFFFFF" />
          <Text style={styles.pausePillText}>Paused</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullScreenPressable: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropDarkDim: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  mainImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  headerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    zIndex: 20,
  },
  progressBarRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
  },
  progressSegmentTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressSegmentFill: {
    height: '100%',
    width: '0%',
    backgroundColor: '#FFFFFF',
  },
  progressSegmentFilled: {
    width: '100%',
  },
  progressSegmentCurrent: {
    width: '100%',
  },
  headerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  titleColumn: {
    flex: 1,
    marginRight: 16,
  },
  memoryTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  memorySubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pausePill: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pausePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  noPhotosContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  noPhotosText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 18,
  },
});
