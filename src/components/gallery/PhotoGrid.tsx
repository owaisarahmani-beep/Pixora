import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, LayoutChangeEvent } from 'react-native';
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

interface ItemLayout {
  type: 'header' | 'row';
  top: number;
  bottom: number;
  items?: PixoraMediaInfo[];
}

const NUM_COLUMNS = 4;
const SPACING = 2;
const HEADER_HEIGHT = 46;

export default function PhotoGrid({ groupedMedia, onEndReached, isRefreshing, onRefresh, source = 'gallery' }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const itemSize = Math.max(10, Math.floor((width - SPACING * (NUM_COLUMNS - 1)) / NUM_COLUMNS));
  const rowHeight = itemSize + SPACING;

  const setAvailableIds = useSelectionStore(state => state.setAvailableIds);
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode);
  const selectedIds = useSelectionStore(state => state.selectedIds);
  const selectMultiple = useSelectionStore(state => state.selectMultiple);
  const setSelectedIds = useSelectionStore(state => state.setSelectedIds);
  const enterSelectionMode = useSelectionStore(state => state.enterSelectionMode);

  const scrollYRef = useRef(0);
  const flashListRef = useRef<any>(null);
  const gridHeightRef = useRef(600);

  // Drag selection tracking refs
  const anchorIndexRef = useRef<number>(-1);
  const lastIndexRef = useRef<number>(-1);
  const initialSelectedRef = useRef<Set<string>>(new Set());
  const dragModeRef = useRef<'select' | 'deselect'>('select');

  // Auto-scroll refs
  const autoScrollSpeedRef = useRef<number>(0);
  const autoScrollTimerRef = useRef<any>(null);

  const allIds = useMemo(() => {
    const ids: string[] = [];
    groupedMedia.forEach(group => group.data.forEach(m => ids.push(m.id)));
    return ids;
  }, [groupedMedia]);

  const idToIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    allIds.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [allIds]);

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

  // Precompute spatial bounding box of every row and header for O(log N) lookup
  const itemLayouts = useMemo<ItemLayout[]>(() => {
    const layouts: ItemLayout[] = [];
    let currentY = 0;

    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      if (entry.type === 'header') {
        layouts.push({
          type: 'header',
          top: currentY,
          bottom: currentY + HEADER_HEIGHT,
        });
        currentY += HEADER_HEIGHT;
      } else {
        layouts.push({
          type: 'row',
          top: currentY,
          bottom: currentY + rowHeight,
          items: entry.items,
        });
        currentY += rowHeight;
      }
    }
    return layouts;
  }, [data, rowHeight]);

  const itemLayoutsRef = useRef(itemLayouts);
  itemLayoutsRef.current = itemLayouts;

  // Ultra-fast O(log N) binary search for the photo under coordinate (x, y)
  const getItemAtPosition = useCallback((touchX: number, touchY: number): PixoraMediaInfo | null => {
    const targetY = touchY + scrollYRef.current;
    const layouts = itemLayoutsRef.current;
    if (layouts.length === 0) return null;

    let low = 0;
    let high = layouts.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const layout = layouts[mid];

      if (targetY < layout.top) {
        high = mid - 1;
      } else if (targetY >= layout.bottom) {
        low = mid + 1;
      } else {
        if (layout.type === 'row' && layout.items && layout.items.length > 0) {
          const col = Math.min(
            Math.max(0, Math.floor(touchX / (itemSize + SPACING))),
            layout.items.length - 1
          );
          return layout.items[col] || null;
        }
        return null;
      }
    }
    return null;
  }, [itemSize]);

  // Auto-scroll control
  const startAutoScroll = useCallback((speed: number) => {
    autoScrollSpeedRef.current = speed;
    if (autoScrollTimerRef.current !== null) return;

    autoScrollTimerRef.current = setInterval(() => {
      if (autoScrollSpeedRef.current === 0) {
        if (autoScrollTimerRef.current !== null) {
          clearInterval(autoScrollTimerRef.current);
          autoScrollTimerRef.current = null;
        }
        return;
      }
      const newOffset = Math.max(0, scrollYRef.current + autoScrollSpeedRef.current);
      scrollYRef.current = newOffset;
      flashListRef.current?.scrollToOffset({ offset: newOffset, animated: false });
    }, 20);
  }, []);

  const stopAutoScroll = useCallback(() => {
    autoScrollSpeedRef.current = 0;
    if (autoScrollTimerRef.current !== null) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAutoScroll();
    };
  }, [stopAutoScroll]);

  // Drag-to-select handlers
  const handleDragStart = useCallback((x: number, y: number) => {
    const item = getItemAtPosition(x, y);
    if (!item) return;

    const idx = idToIndexMap.get(item.id);
    if (idx === undefined) return;

    anchorIndexRef.current = idx;
    lastIndexRef.current = idx;

    const currentSelected = useSelectionStore.getState().selectedIds;
    const currentlyInSelectionMode = useSelectionStore.getState().isSelectionMode;

    if (!currentlyInSelectionMode) {
      initialSelectedRef.current = new Set([item.id]);
      dragModeRef.current = 'select';
      enterSelectionMode('media', item.id, allIds);
    } else {
      if (currentSelected.has(item.id)) {
        dragModeRef.current = 'deselect';
        const updated = new Set(currentSelected);
        updated.delete(item.id);
        initialSelectedRef.current = updated;
        setSelectedIds(updated);
      } else {
        dragModeRef.current = 'select';
        const updated = new Set(currentSelected);
        updated.add(item.id);
        initialSelectedRef.current = updated;
        setSelectedIds(updated);
      }
    }
  }, [getItemAtPosition, idToIndexMap, enterSelectionMode, allIds, setSelectedIds]);

  const handleDragUpdate = useCallback((x: number, y: number) => {
    // Edge auto-scrolling
    const height = gridHeightRef.current;
    const EDGE_ZONE = 75;
    if (y < EDGE_ZONE) {
      const factor = Math.min(1, Math.max(0.2, (EDGE_ZONE - y) / EDGE_ZONE));
      startAutoScroll(-16 * factor);
    } else if (y > height - EDGE_ZONE) {
      const factor = Math.min(1, Math.max(0.2, (y - (height - EDGE_ZONE)) / EDGE_ZONE));
      startAutoScroll(16 * factor);
    } else {
      stopAutoScroll();
    }

    if (anchorIndexRef.current === -1) return;

    const item = getItemAtPosition(x, y);
    if (!item) return;

    const currentIdx = idToIndexMap.get(item.id);
    if (currentIdx === undefined || currentIdx === lastIndexRef.current) return;

    lastIndexRef.current = currentIdx;

    const start = Math.min(anchorIndexRef.current, currentIdx);
    const end = Math.max(anchorIndexRef.current, currentIdx);
    const rangeIds = allIds.slice(start, end + 1);

    const nextSelected = new Set(initialSelectedRef.current);
    if (dragModeRef.current === 'select') {
      for (let i = 0; i < rangeIds.length; i++) {
        nextSelected.add(rangeIds[i]);
      }
    } else {
      for (let i = 0; i < rangeIds.length; i++) {
        nextSelected.delete(rangeIds[i]);
      }
    }
    setSelectedIds(nextSelected);
  }, [getItemAtPosition, idToIndexMap, allIds, setSelectedIds, startAutoScroll, stopAutoScroll]);

  const handleDragEnd = useCallback(() => {
    stopAutoScroll();
    anchorIndexRef.current = -1;
    lastIndexRef.current = -1;
  }, [stopAutoScroll]);

  // Pan gesture with 200ms stationary activation threshold
  // Quick vertical swipes (<200ms) fail this gesture immediately, allowing 60fps FlashList native scrolling.
  // Holding for 200ms activates smooth drag selection across photos.
  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activateAfterLongPress(200)
      .minDistance(4)
      .onStart((e) => {
        runOnJS(handleDragStart)(e.x, e.y);
      })
      .onUpdate((e) => {
        runOnJS(handleDragUpdate)(e.x, e.y);
      })
      .onEnd(() => {
        runOnJS(handleDragEnd)();
      })
      .onFinalize(() => {
        runOnJS(handleDragEnd)();
      });
  }, [handleDragStart, handleDragUpdate, handleDragEnd]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      let isAllSelected = false;
      if (isSelectionMode && item.assetIds.length > 0) {
        const selectedCount = item.assetIds.filter(id => selectedIds.has(id)).length;
        isAllSelected = selectedCount === item.assetIds.length;
      }

      return (
        <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
          <Text style={[styles.headerText, { color: theme.text }]}>{item.title}</Text>
          {isSelectionMode && (
            <Pressable 
              onPress={() => selectMultiple(item.assetIds, !isAllSelected)}
              style={styles.dateSelectBtn}
              hitSlop={8}
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
      <View style={[styles.row, { height: rowHeight }]}>
        {item.items.map((media) => (
          <PhotoThumbnail
            key={media.id}
            item={media}
            itemSize={itemSize}
            numColumns={NUM_COLUMNS}
            source={source}
            allIds={allIds}
          />
        ))}
      </View>
    );
  };
  
  const AnyFlashList = FlashList as any;

  return (
    <GestureDetector gesture={panGesture}>
      <View 
        style={{ flex: 1 }}
        onLayout={(e: LayoutChangeEvent) => {
          gridHeightRef.current = e.nativeEvent.layout.height;
        }}
      >
        <AnyFlashList
          ref={flashListRef}
          data={data}
          estimatedItemSize={rowHeight}
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
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
  },
  dateSelectBtn: {
    padding: 4,
  }
});
