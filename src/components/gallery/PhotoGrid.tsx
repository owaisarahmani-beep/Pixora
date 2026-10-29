import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../theme/ThemeProvider';
import { MediaGroup, PixoraMediaInfo } from '../../services/media/mediaTypes';
import { useSelectionStore } from '../../store/useSelectionStore';
import { tokens } from '../../theme/tokens';
import PhotoThumbnail from './PhotoThumbnail';

interface Props {
  groupedMedia: MediaGroup[];
  onEndReached: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  source?: 'gallery' | 'search' | 'favorites' | 'album' | 'locked' | 'archive' | 'hidden' | 'private' | 'smart_album';
  filterType?: 'all' | 'photo' | 'video';
  smartAlbumId?: string;
  albumId?: string;
}

type ListItem = 
  | { type: 'header'; title: string; assetIds: string[] }
  | { type: 'row'; items: PixoraMediaInfo[] };

const NUM_COLUMNS = tokens.grid.numColumns; // 3 columns for balanced, natural photo display
const SPACING = tokens.grid.spacing; // 2px hairline spacing
const HEADER_HEIGHT = 44;

interface GridHeaderProps {
  title: string;
  assetIds: string[];
  theme: any;
}

const GridHeader = React.memo(({ title, assetIds, theme }: GridHeaderProps) => {
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode && state.selectionContext === 'media');
  const isAllSelected = useSelectionStore(state => {
    if (!state.isSelectionMode || state.selectionContext !== 'media' || assetIds.length === 0) return false;
    if (state.selectedIds.size < assetIds.length) return false;
    return assetIds.every(id => state.selectedIds.has(id));
  });
  const selectMultiple = useSelectionStore(state => state.selectMultiple);

  return (
    <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
      <Text style={[styles.headerText, { color: theme.text }]}>{title}</Text>
      {isSelectionMode && (
        <Pressable 
          onPress={() => selectMultiple(assetIds, !isAllSelected)}
          style={styles.dateSelectBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isAllSelected ? "Deselect date section" : "Select date section"}
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
});
GridHeader.displayName = 'GridHeader';

interface GridRowProps {
  items: PixoraMediaInfo[];
  itemSize: number;
  rowHeight: number;
  source?: 'gallery' | 'search' | 'favorites' | 'album' | 'locked' | 'archive' | 'hidden' | 'private' | 'smart_album';
  filterType?: 'all' | 'photo' | 'video';
  smartAlbumId?: string;
  albumId?: string;
  allIds?: string[];
}

const GridRow = React.memo(({
  items,
  itemSize,
  rowHeight,
  source,
  filterType,
  smartAlbumId,
  albumId,
  allIds,
}: GridRowProps) => {
  return (
    <View style={[styles.row, { height: rowHeight }]}>
      {items.map((media, colIdx) => (
        <PhotoThumbnail
          key={`${media.id}-${colIdx}`}
          item={media}
          itemSize={itemSize}
          numColumns={NUM_COLUMNS}
          isLastInRow={colIdx === NUM_COLUMNS - 1}
          source={source}
          filterType={filterType}
          smartAlbumId={smartAlbumId}
          albumId={albumId}
          allIds={allIds}
        />
      ))}
    </View>
  );
});
GridRow.displayName = 'GridRow';

export default function PhotoGrid({ 
  groupedMedia, 
  onEndReached, 
  isRefreshing, 
  onRefresh, 
  source = 'gallery',
  filterType,
  smartAlbumId,
  albumId,
}: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  // Pixel-perfect item size: total width minus internal gaps, divided cleanly by columns
  const totalGaps = SPACING * (NUM_COLUMNS - 1);
  const itemSize = Math.max(10, Math.floor((width - totalGaps) / NUM_COLUMNS));
  const rowHeight = itemSize + SPACING;

  const setAvailableIds = useSelectionStore(state => state.setAvailableIds);

  const scrollYRef = useRef(0);
  const flashListRef = useRef<any>(null);

  const allIds = useMemo(() => {
    const ids: string[] = [];
    groupedMedia.forEach(group => group.data.forEach(m => ids.push(m.id)));
    return ids;
  }, [groupedMedia]);

  useEffect(() => {
    setAvailableIds(allIds);
  }, [allIds, setAvailableIds]);

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

  const renderItem = React.useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return <GridHeader title={item.title} assetIds={item.assetIds} theme={theme} />;
    }

    return (
      <GridRow
        items={item.items}
        itemSize={itemSize}
        rowHeight={rowHeight}
        source={source}
        filterType={filterType}
        smartAlbumId={smartAlbumId}
        albumId={albumId}
      />
    );
  }, [theme, itemSize, rowHeight, source, filterType, smartAlbumId, albumId]);

  const overrideItemLayout = React.useCallback((layout: { span?: number; size?: number }, item: ListItem) => {
    layout.size = item.type === 'header' ? HEADER_HEIGHT : rowHeight;
  }, [rowHeight]);
  
  const AnyFlashList = FlashList as any;

  return (
    <View style={{ flex: 1 }}>
      <AnyFlashList
        ref={flashListRef}
        data={data}
        estimatedItemSize={rowHeight}
        overrideItemLayout={overrideItemLayout}
        renderItem={renderItem}
        keyExtractor={(item: ListItem, index: number) => item.type === 'header' ? `header-${item.title}` : `row-${item.items[0]?.id ?? index}`}
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
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    minHeight: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  row: {
    flexDirection: 'row',
  },
  dateSelectBtn: {
    padding: 4,
  }
});
