import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  BackHandler,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import PagerView from 'react-native-pager-view';
import * as MediaLibrary from 'expo-media-library/legacy';
import Slider from '@react-native-community/slider';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTrashStore, TrashedItem, ensureTrashHydrated } from '../store/useTrashStore';
import { useMediaStore } from '../store/useMediaStore';
import { useAlbumsStore } from '../store/useAlbumsStore';
import { mediaStoreService } from '../services/media/MediaStoreService';
import { PixoraMediaInfo } from '../services/media/mediaTypes';
import ZoomableView from '../components/viewer/ZoomableView';
import DeleteConfirmModal from '../components/common/DeleteConfirmModal';
import { toastController } from '../components/common/Toast';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Dedicated Video Player item for Trashed Videos.
 * Manages player lifecycle, pause on swipe away, listener cleanup, and scrubber controls.
 */
function TrashVideoItem({
  item,
  isActive,
}: {
  item: TrashedItem;
  isActive: boolean;
}) {
  const isMountedRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(item.duration || 0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const idleTimerRef = useRef<any>(null);

  const player = useVideoPlayer(item.uri, (p) => {
    p.loop = false;
  });

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    if (isPlaying && !isSeeking) {
      idleTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isPlaying, isSeeking]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearIdleTimer();
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  // Event listeners
  useEffect(() => {
    try {
      player.timeUpdateEventInterval = 0.25;
    } catch {}

    const subPlaying = player.addListener('playingChange', (e) => {
      if (isMountedRef.current) {
        setIsPlaying(e.isPlaying);
      }
    });

    const subTime = player.addListener('timeUpdate', (e) => {
      if (!isSeeking && isMountedRef.current) {
        setCurrentTime(e.currentTime);
      }
    });

    const subSourceLoad = player.addListener('sourceLoad', (e) => {
      if (e.duration > 0 && isMountedRef.current) {
        setDuration(e.duration);
      }
    });

    const subEnd = player.addListener('playToEnd', () => {
      if (isMountedRef.current) {
        setIsPlaying(false);
        setCurrentTime(player.duration || 0);
      }
    });

    return () => {
      subPlaying.remove();
      subTime.remove();
      subSourceLoad.remove();
      subEnd.remove();
    };
  }, [player, isSeeking]);

  // Pause when swiped away
  useEffect(() => {
    if (!isActive) {
      try {
        if (player.playing) {
          player.pause();
        }
      } catch {}
    }
  }, [isActive, player]);

  // Idle timer auto-hide when playing
  useEffect(() => {
    if (isPlaying) {
      resetIdleTimer();
    } else {
      clearIdleTimer();
    }
    return clearIdleTimer;
  }, [isPlaying, resetIdleTimer]);

  const togglePlayPause = () => {
    setControlsVisible(true);
    try {
      if (player.playing) {
        player.pause();
      } else {
        if (duration > 0 && currentTime >= duration - 0.5) {
          player.currentTime = 0;
          setCurrentTime(0);
        }
        player.play();
      }
    } catch (e) {
      console.warn('[Pixora TrashVideo] Play error:', e);
    }
  };

  const toggleMute = () => {
    try {
      const next = !player.muted;
      player.muted = next;
      setIsMuted(next);
    } catch {}
  };

  const handleSliderComplete = (val: number) => {
    try {
      player.currentTime = val;
      setCurrentTime(val);
    } catch {}
    setIsSeeking(false);
    if (isPlaying) resetIdleTimer();
  };

  const maxDuration = duration > 0 ? duration : (item.duration || 0);

  return (
    <View style={styles.mediaContainer}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          if (controlsVisible) {
            clearIdleTimer();
            setControlsVisible(false);
          } else {
            setControlsVisible(true);
            resetIdleTimer();
          }
        }}
      >
        <VideoView
          player={player}
          style={styles.fullMedia}
          contentFit="contain"
          nativeControls={false}
        />
      </Pressable>

      {/* Video Overlay Controls */}
      {controlsVisible && (
        <View style={styles.videoControlsOverlay} pointerEvents="box-none">
          {/* Central Play/Pause Button */}
          <Pressable
            style={styles.centerPlayBtn}
            onPress={togglePlayPause}
            hitSlop={20}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={36}
              color="#FFFFFF"
            />
          </Pressable>

          {/* Bottom Scrubber & Time */}
          <View style={styles.videoBottomScrubber}>
            <Text style={styles.timeText}>{formatDuration(currentTime)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={maxDuration > 0 ? maxDuration : 1}
              value={currentTime}
              minimumTrackTintColor="#FFFFFF"
              maximumTrackTintColor="rgba(255,255,255,0.3)"
              thumbTintColor="#FFFFFF"
              onSlidingStart={() => {
                clearIdleTimer();
                setIsSeeking(true);
              }}
              onValueChange={(v) => setCurrentTime(v)}
              onSlidingComplete={handleSliderComplete}
            />
            <Text style={styles.timeText}>{formatDuration(maxDuration)}</Text>
            <Pressable onPress={toggleMute} style={styles.muteBtn} hitSlop={10}>
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={20}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export default function TrashViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  // Reactive subscription to authoritative Trash store
  const items = useTrashStore((state) => state.items);
  const restoreItems = useTrashStore((state) => state.restoreItems);
  const permanentlyDelete = useTrashStore((state) => state.permanentlyDelete);
  const getDaysRemaining = useTrashStore((state) => state.getDaysRemaining);
  const refreshMedia = useMediaStore((state) => state.refreshMedia);
  const pagerRef = useRef<PagerView>(null);

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (!id || items.length === 0) return 0;
    const idx = items.findIndex((i) => String(i.id) === String(id));
    return idx >= 0 ? idx : 0;
  });

  const [isActionPending, setIsActionPending] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  // Security Check: Resolve requested item against authoritative Trash dataset
  const safeIndex = Math.min(currentIndex, Math.max(0, items.length - 1));
  const currentItem: TrashedItem | undefined = items[safeIndex];

  // Proactively prefetch adjacent trashed photo assets into memory-disk cache
  useEffect(() => {
    if (items.length === 0) return;
    const urisToPrefetch: string[] = [];
    const windowIndices = [
      safeIndex + 1,
      safeIndex - 1,
      safeIndex + 2,
      safeIndex - 2,
    ];
    for (const idx of windowIndices) {
      if (idx >= 0 && idx < items.length) {
        const item = items[idx];
        if (item && item.mediaType === 'photo' && item.uri) {
          urisToPrefetch.push(item.uri);
        }
      }
    }
    if (urisToPrefetch.length > 0) {
      Image.prefetch(urisToPrefetch, 'memory-disk').catch(() => {});
    }
  }, [safeIndex, items]);

  useEffect(() => {
    // If trash is empty, immediately refuse access and return
    if (items.length === 0) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/trash');
      }
    }
  }, [items.length]);

  // Hardware back button handler
  useEffect(() => {
    const onBackPress = () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/trash');
      }
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/trash');
    }
  };

  // Revalidate Trash membership before Restore
  const handleRestoreCurrent = async () => {
    if (!currentItem || isActionPending) return;

    // Authoritative check
    const currentTrash = useTrashStore.getState().items;
    const target = currentTrash.find((i) => String(i.id) === String(currentItem.id));
    if (!target) {
      toastController.show({ message: 'Item is no longer in Recently Deleted', type: 'info' });
      return;
    }

    // Determine target next item by stable identity before removing target
    const currIdx = currentTrash.findIndex((i) => String(i.id) === String(target.id));
    let targetNextId: string | null = null;
    if (currentTrash.length > 1) {
      if (currIdx + 1 < currentTrash.length) {
        targetNextId = String(currentTrash[currIdx + 1].id);
      } else if (currIdx - 1 >= 0) {
        targetNextId = String(currentTrash[currIdx - 1].id);
      }
    }

    setIsActionPending(true);
    try {
      await ensureTrashHydrated();
      const targetId = String(target.id);

      // 1. Perform trash store restoration
      restoreItems([targetId]);

      // 2. Convert to PixoraMediaInfo baseline
      const restoredBaseline: PixoraMediaInfo[] = [
        {
          id: targetId,
          uri: target.uri,
          filename: target.filename,
          mediaType: target.mediaType,
          width: target.width,
          height: target.height,
          creationTime: target.creationTime,
          modificationTime: target.modificationTime || target.creationTime,
          duration: target.duration,
          albumId: target.albumId,
        },
      ];

      // 3. Try fetching updated native asset metadata
      try {
        const nativeAssets = await mediaStoreService.getAssetsByIdsAsync([targetId]);
        if (nativeAssets.length > 0) {
          const asset = nativeAssets[0];
          const preserved =
            useTrashStore.getState().getPreservedTimestamp?.(asset.id, asset.uri) ||
            target.creationTime;
          if (preserved && preserved > 0) {
            asset.creationTime = preserved;
          }
          restoredBaseline[0] = { ...restoredBaseline[0], ...asset };
        }
      } catch {}

      // 4. Register enriched restored items with stable identity and upsert
      useTrashStore.getState().registerRestoredItems(restoredBaseline);
      useMediaStore.getState().upsertMedia(restoredBaseline);

      await refreshMedia();
      useAlbumsStore.getState().loadAlbums(true);

      toastController.show({
        message: '1 item restored to gallery',
        type: 'success',
      });

      // Advance to next valid item or return if Trash is now empty
      const nextRemaining = useTrashStore.getState().items;
      if (nextRemaining.length === 0 || !targetNextId) {
        handleBack();
      } else {
        const nextIdx = nextRemaining.findIndex((i) => String(i.id) === targetNextId);
        const safeNextIdx = Math.max(0, Math.min(nextIdx >= 0 ? nextIdx : 0, nextRemaining.length - 1));
        setCurrentIndex(safeNextIdx);
        pagerRef.current?.setPageWithoutAnimation(safeNextIdx);
      }
    } catch (e) {
      console.error('[Pixora TrashViewer] Restore error:', e);
      Alert.alert('Restore Failed', 'Unable to restore this item.');
    } finally {
      setIsActionPending(false);
    }
  };

  // Revalidate Trash membership before Delete Permanently
  const handleDeleteCurrent = async () => {
    if (!currentItem || isActionPending) return;

    // Authoritative check
    const currentTrash = useTrashStore.getState().items;
    const target = currentTrash.find((i) => String(i.id) === String(currentItem.id));
    if (!target) {
      toastController.show({ message: 'Item is no longer in Recently Deleted', type: 'info' });
      setDeleteModalVisible(false);
      return;
    }

    // Determine target next item by stable identity before removing target
    const currIdx = currentTrash.findIndex((i) => String(i.id) === String(target.id));
    let targetNextId: string | null = null;
    if (currentTrash.length > 1) {
      if (currIdx + 1 < currentTrash.length) {
        targetNextId = String(currentTrash[currIdx + 1].id);
      } else if (currIdx - 1 >= 0) {
        targetNextId = String(currentTrash[currIdx - 1].id);
      }
    }

    // Dismiss confirmation modal immediately before triggering native OS dialog
    setDeleteModalVisible(false);
    setIsActionPending(true);
    try {
      await ensureTrashHydrated();
      const targetId = String(target.id);
      let deletedSuccessfully = false;

      try {
        // Native OS permanent delete
        deletedSuccessfully = await MediaLibrary.deleteAssetsAsync([targetId]);
        if (!deletedSuccessfully) {
          const remaining = await mediaStoreService.getAssetsByIdsAsync([targetId]);
          deletedSuccessfully = remaining.length === 0;
        }
      } catch (e) {
        console.warn('[Pixora TrashViewer] deleteAssetsAsync threw error, checking survival:', e);
        try {
          const remaining = await mediaStoreService.getAssetsByIdsAsync([targetId]);
          deletedSuccessfully = remaining.length === 0;
        } catch {}
      }

      if (deletedSuccessfully) {
        if (target.albumId) {
          useAlbumsStore.getState().decrementAlbumCount(target.albumId, 1);
        }
        permanentlyDelete([targetId], [target.uri]);
        await refreshMedia();
        useAlbumsStore.getState().loadAlbums(true);

        toastController.show({
          message: 'Item permanently deleted',
          type: 'info',
        });

        const nextRemaining = useTrashStore.getState().items;
        if (nextRemaining.length === 0 || !targetNextId) {
          handleBack();
        } else {
          const nextIdx = nextRemaining.findIndex((i) => String(i.id) === targetNextId);
          const safeNextIdx = Math.max(0, Math.min(nextIdx >= 0 ? nextIdx : 0, nextRemaining.length - 1));
          setCurrentIndex(safeNextIdx);
          pagerRef.current?.setPageWithoutAnimation(safeNextIdx);
        }
      } else {
        // Subtle non-blocking feedback when user cancels or denies Android dialog
        toastController.show({
          message: 'Deletion cancelled',
          type: 'info',
        });
      }
    } finally {
      setIsActionPending(false);
    }
  };

  if (!currentItem) {
    return <View style={styles.container} />;
  }

  const daysLeft = getDaysRemaining(currentItem.trashedAt);

  return (
    <View style={styles.container}>
      {/* Pager View of Trashed Items */}
      <PagerView
        ref={pagerRef}
        style={StyleSheet.absoluteFill}
        initialPage={currentIndex}
        onPageSelected={(e) => setCurrentIndex(e.nativeEvent.position)}
        offscreenPageLimit={2}
      >
        {items.map((item, index) => {
          const isItemActive = index === safeIndex;
          if (Math.abs(index - safeIndex) > 2) {
            return <View key={item.id} style={styles.page} />;
          }
          return (
            <View key={item.id} style={styles.page}>
              {item.mediaType === 'video' ? (
                isItemActive ? (
                  <TrashVideoItem item={item} isActive={isItemActive} />
                ) : (
                  <View style={[styles.fullMedia, styles.videoPosterFallback]}>
                    <Ionicons name="videocam-outline" size={48} color="rgba(255, 255, 255, 0.4)" />
                  </View>
                )
              ) : (
                <View style={styles.mediaContainer}>
                  <ZoomableView isActive={isItemActive}>
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.fullMedia}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      priority="high"
                      allowDownscaling={true}
                      recyclingKey={item.id}
                      transition={150}
                    />
                  </ZoomableView>
                </View>
              )}
            </View>
          );
        })}
      </PagerView>

      {/* Floating Top Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 6),
          },
        ]}
      >
        <Pressable
          onPress={handleBack}
          style={styles.iconBtn}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentItem.filename || 'Deleted Media'}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.daysBadge}>
              <Ionicons name="time-outline" size={12} color="#F59E0B" style={{ marginRight: 3 }} />
              <Text style={styles.daysBadgeText}>{daysLeft}d left</Text>
            </View>
            <Text style={styles.counterText}>
              {safeIndex + 1} / {items.length}
            </Text>
          </View>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* Floating Bottom Action Capsule */}
      <View
        style={[
          styles.bottomBarContainer,
          {
            paddingBottom: Math.max(insets.bottom, 12) + 8,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.actionCapsule}>
          <Pressable
            style={({ pressed }) => [
              styles.deleteBtn,
              pressed && styles.deleteBtnPressed,
              isActionPending && { opacity: 0.5 },
            ]}
            onPress={() => setDeleteModalVisible(true)}
            disabled={isActionPending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Delete item permanently"
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </Pressable>

          <View style={styles.capsuleDivider} />

          <Pressable
            style={({ pressed }) => [
              styles.restoreBtn,
              pressed && styles.restoreBtnPressed,
              isActionPending && { opacity: 0.6 },
            ]}
            onPress={handleRestoreCurrent}
            disabled={isActionPending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Restore item to gallery"
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.restoreBtnText}>
              {isActionPending ? 'Restoring…' : 'Restore'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        visible={deleteModalVisible}
        title="Delete Permanently?"
        message="This item will be permanently removed from device storage. This cannot be undone."
        confirmText="Delete Permanently"
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={handleDeleteCurrent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullMedia: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    maxWidth: SCREEN_WIDTH * 0.6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  daysBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
  },
  counterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.92)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  deleteBtnPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  capsuleDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#0284C7',
    elevation: 3,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  restoreBtnPressed: {
    backgroundColor: '#0369A1',
  },
  restoreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  videoControlsOverlay: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBottomScrubber: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
  },
  slider: {
    flex: 1,
    height: 36,
    marginHorizontal: 8,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    minWidth: 36,
    textAlign: 'center',
  },
  muteBtn: {
    padding: 6,
    marginLeft: 4,
  },
  videoPosterFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});
