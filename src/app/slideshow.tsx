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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_DOTS = 10;
const SLIDE_INTERVAL_MS = 3000;

import { useMemories } from '../hooks/useMemories';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const archivedAssetIds = usePrivacyStore(state => state.archivedAssetIds);

  const publicMedia = useAuthorizedMedia(allMedia, 'public');
  const archiveMedia = useAuthorizedMedia(allMedia, 'archive');
  const memories = useMemories(publicMedia);

  // Resolve media array based on source param
  const slides: PixoraMediaInfo[] = useMemo(() => {
    let base: PixoraMediaInfo[] = [];

    if (source === 'archive') {
      base = archiveMedia;
    } else if (source === 'memory' && memoryId) {
      const memory = memories.find(m => m.id === memoryId);
      base = memory ? memory.assets : [];
    } else if (source === 'smart' && smartAlbumId) {
      const def = SMART_ALBUM_DEFS.find(d => d.id === smartAlbumId);
      base = def ? publicMedia.filter(def.filter) : publicMedia;
    } else if (source === 'album' && albumId) {
      base = publicMedia.filter(m => m.albumId === albumId);
    } else {
      // Default: all public gallery media
      base = publicMedia;
    }

    // Only show photos for slideshow (videos skipped)
    return base.filter(m => m.mediaType === 'photo');
  }, [source, albumId, smartAlbumId, memoryId, publicMedia, archiveMedia, memories]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % Math.max(slides.length, 1));
  }, [slides.length]);

  // Set up / tear down the interval
  useEffect(() => {
    if (isPlaying && slides.length > 1) {
      intervalRef.current = setInterval(advance, SLIDE_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, advance, slides.length]);

  // Reset index when slides list changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [slides.length]);

  const togglePlayPause = () => setIsPlaying(p => !p);

  const handleTouch = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    if (x < SCREEN_WIDTH * 0.3) {
      setCurrentIndex(prev => (prev - 1 + Math.max(slides.length, 1)) % Math.max(slides.length, 1));
      if (isPlaying) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(advance, SLIDE_INTERVAL_MS);
      }
    } else if (x > SCREEN_WIDTH * 0.7) {
      advance();
      if (isPlaying) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(advance, SLIDE_INTERVAL_MS);
      }
    } else {
      togglePlayPause();
    }
  };

  const currentSlide = slides[currentIndex];

  // Dot indicators — show up to MAX_DOTS; when more, show proportional position
  const dotCount = Math.min(slides.length, MAX_DOTS);
  const activeDotIndex = slides.length <= MAX_DOTS
    ? currentIndex
    : Math.floor((currentIndex / (slides.length - 1)) * (MAX_DOTS - 1));

  if (slides.length === 0) {
    return (
      <View style={styles.noPhotosContainer}>
        <StatusBar hidden />
        <Ionicons name="images-outline" size={64} color="#FFFFFF" />
        <Text style={styles.noPhotosText}>No photos to show</Text>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Full-screen image */}
      <Pressable style={styles.imagePressable} onPress={(e) => handleTouch(e)}>
        <Image
          key={currentSlide?.id}
          source={{ uri: currentSlide?.uri }}
          style={styles.image}
          contentFit="cover"
          transition={0}
        />
      </Pressable>

      {/* Dark gradient overlay (top) */}
      <View style={styles.topOverlay} pointerEvents="none" />

      {/* Dark gradient overlay (bottom) */}
      <View style={styles.bottomOverlay} pointerEvents="none" />

      {/* Close button */}
      <Pressable
        style={[styles.closeButton, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <Ionicons name="close" size={26} color="#FFFFFF" />
      </Pressable>

      {/* Bottom controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 24 }]}>
        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: dotCount }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeDotIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Play / Pause button */}
        <Pressable onPress={togglePlayPause} style={styles.playPauseBtn} hitSlop={12}>
          <Ionicons
            name={isPlaying ? 'pause-circle' : 'play-circle'}
            size={52}
            color="#FFFFFF"
          />
        </Pressable>

        {/* Index label */}
        <Text style={styles.indexLabel}>
          {currentIndex + 1} / {slides.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  imagePressable: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    // Simulated top-to-transparent gradient via opacity
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  closeButton: {
    position: 'absolute',
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    borderRadius: 999,
  },
  dotActive: {
    width: 20,
    height: 6,
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    width: 6,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  playPauseBtn: {
    alignItems: 'center',
  },
  indexLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  // No-photos fallback
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
