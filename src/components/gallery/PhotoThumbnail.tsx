import React, { memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  item: PixoraMediaInfo;
  numColumns: number;
  source?: 'gallery' | 'search' | 'favorites' | 'album' | 'locked' | 'archive' | 'hidden' | 'private';
  allIds?: string[];
}

const SPACING = 2;

function formatDuration(duration: number) {
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

import { useSelectionStore } from '../../store/useSelectionStore';

const PhotoThumbnail = ({ item, numColumns, source = 'gallery', allIds = [] }: Props) => {
  const { width } = useWindowDimensions();
  const itemSize = Math.max(10, (width - SPACING * (numColumns - 1)) / numColumns);
  
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode && state.selectionContext === 'media');
  const isSelected = useSelectionStore(state => state.isSelected(item.id));
  const enterSelectionMode = useSelectionStore(state => state.enterSelectionMode);
  const toggleSelection = useSelectionStore(state => state.toggleSelection);

  const handlePress = () => {
    if (isSelectionMode) {
      toggleSelection(item.id);
    } else {
      router.push({ pathname: `/viewer/[id]`, params: { id: item.id, source } });
    }
  };

  const handleLongPress = () => {
    if (!isSelectionMode) {
      enterSelectionMode('media', item.id, allIds);
    }
  };

  return (
    <Pressable 
      style={[styles.container, { width: itemSize, height: itemSize, marginBottom: SPACING, marginRight: SPACING }]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={300}
    >
      <Image
        style={[styles.image, isSelected && styles.selectedImage]}
        source={{ uri: item.uri }}
        contentFit="cover"
        transition={0}
        cachePolicy="memory-disk"
      />
      
      {item.mediaType === 'video' && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={12} color="#FFFFFF" />
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        </View>
      )}

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
    backgroundColor: '#333333',
    position: 'relative',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  selectedImage: {
    opacity: 0.7,
    transform: [{ scale: 0.9 }],
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 6,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
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
