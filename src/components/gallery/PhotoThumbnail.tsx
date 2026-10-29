import React, { memo, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import { useSelectionStore } from '../../store/useSelectionStore';

export interface PhotoThumbnailProps {
  item: PixoraMediaInfo;
  numColumns: number;
  itemSize?: number;
  isLastInRow?: boolean;
  source?: 'gallery' | 'search' | 'favorites' | 'album' | 'locked' | 'archive' | 'hidden' | 'private' | 'smart_album';
  allIds?: string[];
  filterType?: 'all' | 'photo' | 'video';
  smartAlbumId?: string;
  albumId?: string;
  onThumbnailLoad?: (id: string) => void;
}

const SPACING = 2;

/**
 * Checks if a media item is a video using mediaType with filename fallback.
 */
export function isVideoMedia(item: PixoraMediaInfo): boolean {
  if (item.mediaType === 'video' || (item.mediaType as string) === 'VIDEO') {
    return true;
  }
  if (item.filename && /\.(mp4|mov|m4v|avi|mkv|webm|3gp|flv)$/i.test(item.filename)) {
    return true;
  }
  return false;
}

/**
 * Formats duration in seconds to M:SS. Returns null if duration is invalid or 0.
 */
export function formatVideoDuration(duration?: number): string | null {
  if (typeof duration !== 'number' || isNaN(duration) || duration <= 0) {
    return null;
  }
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const PhotoThumbnail = ({ 
  item, 
  numColumns, 
  itemSize: propItemSize, 
  isLastInRow = false,
  source = 'gallery', 
  allIds = [],
  filterType,
  smartAlbumId,
  albumId,
  onThumbnailLoad,
}: PhotoThumbnailProps) => {
  const itemSize = propItemSize ?? Math.max(10, (Dimensions.get('window').width - SPACING * (numColumns - 1)) / numColumns);
  
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode && state.selectionContext === 'media');
  const isSelected = useSelectionStore(state => state.isSelected(item.id));
  const isLongPressActiveRef = useRef(false);
  const isNavigatingRef = useRef(false);

  // Loading & error state for thumbnail image
  const [hasError, setHasError] = useState(false);
  const isMountedRef = useRef(false);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isNavigatingRef.current = false;
    };
  }, []);

  // Video determination is independent of thumbnail loading and video metadata
  const isVideo = useMemo(() => isVideoMedia(item), [item]);
  const durationText = useMemo(() => formatVideoDuration(item.duration), [item.duration]);

  const handlePress = () => {
    // If a long press was triggered, consume and reset
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }

    const selectionState = useSelectionStore.getState();
    const inSelectionMode = selectionState.isSelectionMode && selectionState.selectionContext === 'media';

    if (inSelectionMode) {
      // Single tap in selection mode immediately toggles without delay
      selectionState.toggleSelection(item.id);
    } else {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;

      router.push({ 
        pathname: `/viewer/[id]`, 
        params: { 
          id: item.id, 
          source,
          ...(filterType && filterType !== 'all' ? { filter: filterType } : {}),
          ...(smartAlbumId ? { smartAlbumId } : {}),
        } 
      });

      // Release navigation lock quickly
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 350);
    }
  };

  const handleLongPress = () => {
    isLongPressActiveRef.current = true;
    const selectionState = useSelectionStore.getState();
    if (!selectionState.isSelectionMode || selectionState.selectionContext !== 'media') {
      const scopeId = albumId ? `album:${albumId}` : smartAlbumId ? `smart:${smartAlbumId}` : 'gallery';
      const ids = (allIds && allIds.length > 0) ? allIds : selectionState.availableIds;
      selectionState.enterSelectionMode('media', item.id, ids, scopeId);
    }
  };

  const handlePressOut = () => {
    if (isLongPressActiveRef.current) {
      // Reset long press flag shortly after finger lift so future taps are immediate
      setTimeout(() => {
        isLongPressActiveRef.current = false;
      }, 50);
    }
  };

  return (
    <Pressable 
      testID="photo-thumbnail-pressable"
      style={[
        styles.container, 
        { 
          width: itemSize, 
          height: itemSize, 
          marginBottom: SPACING, 
          marginRight: isLastInRow ? 0 : SPACING 
        }
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressOut={handlePressOut}
      delayLongPress={500}
    >
      {/* 1. Stable Placeholder Layer (rendered behind Image) */}
      <View style={styles.placeholder}>
        {hasError ? (
          <Ionicons 
            name={isVideo ? "videocam-outline" : "image-outline"} 
            size={22} 
            color="#555555" 
          />
        ) : null}
      </View>

      {/* 2. Asynchronous Native Image Thumbnail */}
      <Image
        style={[styles.image, isSelected && styles.selectedImage]}
        source={{ uri: item.uri }}
        contentFit="cover"
        transition={0}
        cachePolicy="memory-disk"
        recyclingKey={item.id}
        allowDownscaling={true}
        priority="normal"
        onLoad={() => {
          if (isMountedRef.current) {
            onThumbnailLoad?.(item.id);
          }
        }}
        onError={() => {
          if (isMountedRef.current) {
            setHasError(true);
          }
        }}
      />
      
      {/* 3. Independent Video Play Indicator: mounts immediately on isVideo, unaffected by loading/error */}
      {isVideo && (
        <View style={styles.videoBadge} testID="video-play-indicator">
          <Ionicons name="play" size={11} color="#FFFFFF" />
          {durationText ? (
            <Text style={styles.durationText}>{durationText}</Text>
          ) : null}
        </View>
      )}

      {/* 4. Selection Overlay */}
      {isSelectionMode && (
        <View style={styles.selectionOverlay}>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
          </View>
        </View>
      )}
    </Pressable>
  );
};

export default memo(PhotoThumbnail);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    position: 'relative',
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  placeholderShimmer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#242426',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    elevation: 6, // Critical for Android hardware rendering over Glide textures
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 3,
  },
  selectedImage: {
    opacity: 0.7,
    transform: [{ scale: 0.9 }],
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFill as any,
    padding: 6,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    zIndex: 20,
    elevation: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  checkboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
});
