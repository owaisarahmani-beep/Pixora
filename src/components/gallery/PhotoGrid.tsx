import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../theme/ThemeProvider';
import { MediaGroup, PixoraMediaInfo } from '../../services/media/mediaTypes';
import { useSelectionStore } from '../../store/useSelectionStore';
import PhotoThumbnail from './PhotoThumbnail';

interface Props {
  groupedMedia: MediaGroup[];
  onEndReached: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  source?: 'gallery' | 'search' | 'favorites' | 'album' | 'locked' | 'archive' | 'hidden' | 'private';
}

type ListItem = 
  | { type: 'header'; title: string }
  | { type: 'row'; items: PixoraMediaInfo[] };

const NUM_COLUMNS = 4;

export default function PhotoGrid({ groupedMedia, onEndReached, isRefreshing, onRefresh, source = 'gallery' }: Props) {
  const theme = useTheme();
  
  const setAvailableIds = useSelectionStore(state => state.setAvailableIds);
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode);

  const allIds = useMemo(() => {
    const ids: string[] = [];
    groupedMedia.forEach(group => group.data.forEach(m => ids.push(m.id)));
    return ids;
  }, [groupedMedia]);

  useEffect(() => {
    if (isSelectionMode) {
      setAvailableIds(allIds);
    }
  }, [isSelectionMode, allIds, setAvailableIds]);

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
          <PhotoThumbnail key={media.id} item={media} numColumns={NUM_COLUMNS} source={source} allIds={allIds} />
        ))}
      </View>
    );
  };
  
  const AnyFlashList = FlashList as any;

  return (
    <AnyFlashList
      data={data}
      estimatedItemSize={100}
      renderItem={renderItem}
      keyExtractor={(item: ListItem) => item.type === 'header' ? `header-${item.title}` : `row-${item.items[0].id}`}
      getItemType={(item: ListItem) => item.type}
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
