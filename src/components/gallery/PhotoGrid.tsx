import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

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
  | { type: 'header'; title: string; assetIds: string[] }
  | { type: 'row'; items: PixoraMediaInfo[] };

const NUM_COLUMNS = 4;
const SPACING = 2;

export default function PhotoGrid({ groupedMedia, onEndReached, isRefreshing, onRefresh, source = 'gallery' }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const itemSize = Math.max(10, (width - SPACING * (NUM_COLUMNS - 1)) / NUM_COLUMNS);
  
  const setAvailableIds = useSelectionStore(state => state.setAvailableIds);
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode);
  const selectedIds = useSelectionStore(state => state.selectedIds);
  const selectMultiple = useSelectionStore(state => state.selectMultiple);

  const scrollYRef = useRef(0);
  const lastSelectedIdRef = useRef<string | null>(null);

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
      flattened.push({ type: 'header', title: group.title, assetIds: group.data.map(m => m.id) });
      
      for (let i = 0; i < group.data.length; i += NUM_COLUMNS) {
        flattened.push({
          type: 'row',
          items: group.data.slice(i, i + NUM_COLUMNS),
        });
      }
    });
    return flattened;
  }, [groupedMedia]);

  // Precompute spatial layout of headers and rows for drag-to-select hit testing
  const layoutMap = useMemo(() => {
    const map: { type: 'header' | 'row'; top: number; bottom: number; items?: PixoraMediaInfo[] }[] = [];
    let currentY = 0;
    const headerHeight = 44;
    const rowHeight = itemSize + SPACING;

    data.forEach((entry) => {
      if (entry.type === 'header') {
        map.push({ type: 'header', top: currentY, bottom: currentY + headerHeight });
        currentY += headerHeight;
      } else {
        map.push({ type: 'row', top: currentY, bottom: currentY + rowHeight, items: entry.items });
        currentY += rowHeight;
      }
    });
    return map;
  }, [data, itemSize]);

  // Find item under finger coordinates and select it
  const selectItemAtCoords = useCallback((touchX: number, touchY: number) => {
    const absoluteY = touchY + scrollYRef.current;
    
    for (let i = 0; i < layoutMap.length; i++) {
      const row = layoutMap[i];
      if (absoluteY >= row.top && absoluteY < row.bottom) {
        if (row.type === 'row' && row.items) {
          const col = Math.floor(touchX / (itemSize + SPACING));
          if (col >= 0 && col < row.items.length) {
            const item = row.items[col];
            if (item && item.id !== lastSelectedIdRef.current) {
              lastSelectedIdRef.current = item.id;
              selectMultiple([item.id], true);
            }
          }
        }
        break;
      }
    }
  }, [layoutMap, itemSize, selectMultiple]);

  // Drag to select Pan gesture
  const dragSelectGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(isSelectionMode)
      .activeOffsetX([-10, 10])
      .activeOffsetY([-10, 10])
      .onBegin((e) => {
        runOnJS(selectItemAtCoords)(e.x, e.y);
      })
      .onUpdate((e) => {
        runOnJS(selectItemAtCoords)(e.x, e.y);
      })
      .onEnd(() => {
        lastSelectedIdRef.current = null;
      });
  }, [isSelectionMode, selectItemAtCoords]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      let isAllSelected = false;
      if (isSelectionMode && item.assetIds.length > 0) {
        const selectedCount = item.assetIds.filter(id => selectedIds.has(id)).length;
        isAllSelected = selectedCount === item.assetIds.length;
      }

      return (
        <View style={[styles.headerContainer, { backgroundColor: theme.background, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 }]}>
          <Text style={[styles.headerText, { color: theme.text }]}>{item.title}</Text>
          {isSelectionMode && (
            <Pressable 
              onPress={() => selectMultiple(item.assetIds, !isAllSelected)}
              style={styles.dateSelectBtn}
            >
              <Ionicons 
                name={isAllSelected ? "checkmark-circle" : "ellipse-outline"} 
                size={22} 
                color={isAllSelected ? theme.accent : theme.textMuted} 
              />
            </Pressable>
          )}
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
    <GestureDetector gesture={dragSelectGesture}>
      <View style={{ flex: 1 }}>
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
          onScroll={(e: any) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
  },
  dateSelectBtn: {
    padding: 4,
  }
});
