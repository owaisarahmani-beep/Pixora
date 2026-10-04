import React, { memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  item: PixoraMediaInfo;
  numColumns: number;
  source?: 'gallery' | 'search' | 'favorites' | 'album';
}

const SPACING = 2;

function formatDuration(duration: number) {
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const PhotoThumbnail = ({ item, numColumns, source = 'gallery' }: Props) => {
  const { width } = useWindowDimensions();
  const itemSize = Math.max(10, (width - SPACING * (numColumns - 1)) / numColumns);

  return (
    <Pressable 
      style={[styles.container, { width: itemSize, height: itemSize, marginBottom: SPACING, marginRight: SPACING }]}
      onPress={() => router.push({ pathname: `/viewer/[id]`, params: { id: item.id, source } })}
    >
      <Image
        style={styles.image}
        source={{ uri: item.uri }}
        contentFit="cover"
        transition={200}
        cachePolicy="disk"
      />
      
      {item.mediaType === 'video' && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={12} color="#FFFFFF" />
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
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
});
