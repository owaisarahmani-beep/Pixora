import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Dimensions,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useTrashStore, TrashedItem } from '../store/useTrashStore';

const NUM_COLUMNS = 3;
const GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const THUMB_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function TrashScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const items = useTrashStore(state => state.items);
  const restoreItems = useTrashStore(state => state.restoreItems);
  const permanentlyDelete = useTrashStore(state => state.permanentlyDelete);
  const getDaysRemaining = useTrashStore(state => state.getDaysRemaining);
  const { permanentDeleteAsync } = require('../store/useMediaStore').useMediaStore.getState();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedIds.size > 0;

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleLongPress = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
  }, []);

  const handleRestore = () => {
    restoreItems(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleDeleteForever = () => {
    Alert.alert(
      'Delete Forever',
      `Permanently delete ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ids = Array.from(selectedIds);
            // Actually delete files from disk
            for (const id of ids) {
              try {
                const MediaLibrary = require('expo-media-library');
                await MediaLibrary.deleteAssetsAsync([id]);
              } catch (e) {
                console.warn('Could not delete asset from disk:', id, e);
              }
            }
            permanentlyDelete(ids);
            setSelectedIds(new Set());
          },
        },
      ],
    );
  };

  const handleEmptyTrash = () => {
    Alert.alert(
      'Empty Trash',
      'Permanently delete all items in trash? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty Trash',
          style: 'destructive',
          onPress: async () => {
            for (const item of items) {
              try {
                const MediaLibrary = require('expo-media-library');
                await MediaLibrary.deleteAssetsAsync([item.id]);
              } catch (e) {
                console.warn('Could not delete from disk:', item.id);
              }
            }
            permanentlyDelete(items.map(i => i.id));
            setSelectedIds(new Set());
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: TrashedItem }) => {
    const isSelected = selectedIds.has(item.id);
    const daysLeft = getDaysRemaining(item.trashedAt);

    return (
      <Pressable
        onPress={() => {
          if (isSelectionMode) toggleSelection(item.id);
        }}
        onLongPress={() => handleLongPress(item.id)}
        style={[
          styles.thumbnail,
          isSelected && styles.thumbnailSelected,
        ]}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          contentFit="cover"
          transition={150}
        />
        {/* Days remaining overlay */}
        <View style={styles.daysOverlay}>
          <Text style={styles.daysText}>{daysLeft}d left</Text>
        </View>
        {/* Selection indicator */}
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
          </View>
        )}
        {/* Video indicator */}
        {item.mediaType === 'video' && (
          <View style={styles.videoIndicator}>
            <Ionicons name="play" size={14} color="#FFFFFF" />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Recently Deleted',
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
          ),
          headerRight: () =>
            items.length > 0 ? (
              <Pressable onPress={handleEmptyTrash}>
                <Text style={[styles.emptyTrashBtn, { color: '#EF4444' }]}>
                  Empty
                </Text>
              </Pressable>
            ) : null,
        }}
      />

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="trash-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No deleted items
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ paddingBottom: insets.bottom + (isSelectionMode ? 90 : 20) }}
        />
      )}

      {/* Bottom action bar when items are selected */}
      {isSelectionMode && (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.surface,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <Pressable style={[styles.barBtn, { borderColor: theme.accent }]} onPress={handleRestore}>
            <Ionicons name="refresh-outline" size={18} color={theme.accent} />
            <Text style={[styles.barBtnText, { color: theme.accent }]}>Restore</Text>
          </Pressable>
          <Pressable
            style={[styles.barBtn, { borderColor: '#EF4444', backgroundColor: '#EF444420' }]}
            onPress={handleDeleteForever}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={[styles.barBtnText, { color: '#EF4444' }]}>Delete Forever</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 8,
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumbnailSelected: {
    opacity: 0.7,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  daysOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  daysText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 3,
  },
  emptyTrashBtn: {
    fontSize: 15,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  barBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  barBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
