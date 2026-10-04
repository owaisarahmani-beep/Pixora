import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../theme/ThemeProvider';
import { MediaGroup, PixoraMediaInfo } from '../../services/media/mediaTypes';
import PhotoThumbnail from './PhotoThumbnail';

interface Props {
  groupedMedia: MediaGroup[];
  onEndReached: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  source?: 'gallery' | 'search' | 'favorites' | 'album';
}

type ListItem = 
  | { type: 'header'; title: string }
  | { type: 'row'; items: PixoraMediaInfo[] };

const NUM_COLUMNS = 4;

export default function PhotoGrid({ groupedMedia, onEndReached, isRefreshing, onRefresh, source = 'gallery' }: Props) {
  const theme = useTheme();

  const data = useMemo(() => {
    const flattened: ListItem[] = [];
    groupedMedia.forEach((group) => {
      flattened.push({ type: 'header', title: group.title });
      
      for (let i = 0; i < group.data.length; i += NUM_COLUMNS) {
        flattened.push({
          type: 'row',
          items: group.data.slice(i, i + NUM_COLUMNS),
        });
      }
    });
    return flattened;
  }, [groupedMedia]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
          <Text style={[styles.headerText, { color: theme.text }]}>{item.title}</Text>
        </View>
      );
    }

    return (
      <View style={styles.row}>
        {item.items.map((media) => (
          <PhotoThumbnail key={media.id} item={media} numColumns={NUM_COLUMNS} source={source} />
        ))}
      </View>
    );
  };

  return (
    <FlashList
      data={data}
      estimatedItemSize={100}
      renderItem={renderItem}
      keyExtractor={(item) => item.type === 'header' ? `header-${item.title}` : `row-${item.items[0].id}`}
      getItemType={(item) => item.type}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      contentContainerStyle={{ paddingBottom: 100 }}
    />
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
  },
});
