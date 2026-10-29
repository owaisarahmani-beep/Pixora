import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import Animated, { 
  SharedValue, 
  useAnimatedStyle, 
  interpolate, 
  Extrapolation, 
  withTiming, 
  withSpring, 
  runOnJS 
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import { useTheme } from '../../theme/ThemeProvider';
import { normalizeTimestamp } from '../../utils/dateGrouping';

interface Props {
  item: PixoraMediaInfo;
  detailsProgress: SharedValue<number>;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return 'Unknown size';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const SHEET_HEIGHT = 320;

export default function MediaDetailsModal({ item, detailsProgress, onClose }: Props) {
  const theme = useTheme();
  const [fileSize, setFileSize] = useState<number | null>(null);

  useEffect(() => {
    if (!item?.uri) return;

    let isMounted = true;
    FileSystem.getInfoAsync(item.uri)
      .then((info) => {
        if (isMounted && info.exists && info.size) {
          setFileSize(info.size);
        }
      })
      .catch(() => {
        if (isMounted) setFileSize(null);
      });

    return () => {
      isMounted = false;
    };
  }, [item?.uri]);

  // Drag down gesture on the bottom sheet to smoothly close it
  const sheetDragDown = Gesture.Pan()
    .activeOffsetY([0, 15])
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        detailsProgress.value = Math.max(0, 1 - (e.translationY / 280));
      }
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 60 || e.velocityY > 500) {
        detailsProgress.value = withTiming(0, { duration: 180 }, () => {
          runOnJS(onClose)();
        });
      } else {
        detailsProgress.value = withSpring(1, { damping: 20, stiffness: 200 });
      }
    });

  const overlayAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      detailsProgress.value,
      [0, 1],
      [0, 0.55],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      pointerEvents: detailsProgress.value > 0.05 ? ('auto' as const) : ('none' as const),
    };
  });

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      detailsProgress.value,
      [0, 1],
      [SHEET_HEIGHT, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY }],
      pointerEvents: detailsProgress.value > 0.05 ? ('auto' as const) : ('none' as const),
    };
  });

  if (!item) return null;

  const megapixels = item.width > 0 && item.height > 0 
    ? ((item.width * item.height) / 1000000).toFixed(1) + ' MP'
    : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Fluid Reanimated Sheet */}
      <GestureDetector gesture={sheetDragDown}>
        <Animated.View 
          style={[
            styles.sheet, 
            { 
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            sheetAnimatedStyle
          ]}
        >
          {/* Drag Handle */}
          <View style={[styles.dragHandle, { backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.25)' : '#CBD5E1' }]} />
          
          <View style={[styles.headerRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>Details</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* Filename */}
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <View style={styles.labelCol}>
              <Ionicons name="document-text-outline" size={17} color={theme.accent} style={styles.rowIcon} />
              <Text style={[styles.label, { color: theme.textMuted }]}>File Name</Text>
            </View>
            <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>{item.filename || 'Untitled'}</Text>
          </View>

          {/* Date & Time */}
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <View style={styles.labelCol}>
              <Ionicons name="calendar-outline" size={17} color={theme.accent} style={styles.rowIcon} />
              <Text style={[styles.label, { color: theme.textMuted }]}>Date</Text>
            </View>
            <Text style={[styles.value, { color: theme.text }]}>
              {format(new Date(normalizeTimestamp(item.creationTime || item.modificationTime)), 'EEE, MMM d, yyyy • h:mm a')}
            </Text>
          </View>

          {/* Resolution & Megapixels */}
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <View style={styles.labelCol}>
              <Ionicons name="scan-outline" size={17} color={theme.accent} style={styles.rowIcon} />
              <Text style={[styles.label, { color: theme.textMuted }]}>Dimensions</Text>
            </View>
            <Text style={[styles.value, { color: theme.text }]}>
              {item.width} × {item.height}{megapixels ? ` (${megapixels})` : ''}
            </Text>
          </View>

          {/* File Size */}
          {fileSize !== null && fileSize > 0 && (
            <View style={[styles.row, { borderBottomColor: theme.border }]}>
              <View style={styles.labelCol}>
                <Ionicons name="pie-chart-outline" size={17} color={theme.accent} style={styles.rowIcon} />
                <Text style={[styles.label, { color: theme.textMuted }]}>File Size</Text>
              </View>
              <Text style={[styles.value, { color: theme.text }]}>{formatBytes(fileSize)}</Text>
            </View>
          )}

          {/* Duration if video */}
          {item.mediaType === 'video' && item.duration > 0 && (
            <View style={[styles.row, { borderBottomColor: theme.border }]}>
              <View style={styles.labelCol}>
                <Ionicons name="time-outline" size={17} color={theme.accent} style={styles.rowIcon} />
                <Text style={[styles.label, { color: theme.textMuted }]}>Duration</Text>
              </View>
              <Text style={[styles.value, { color: theme.text }]}>{formatDuration(item.duration)}</Text>
            </View>
          )}

          {/* Media Type */}
          <View style={[styles.row, { borderBottomColor: 'transparent' }]}>
            <View style={styles.labelCol}>
              <Ionicons name="film-outline" size={17} color={theme.accent} style={styles.rowIcon} />
              <Text style={[styles.label, { color: theme.textMuted }]}>Media Type</Text>
            </View>
            <Text style={[styles.value, { color: theme.text }]}>
              {item.mediaType === 'video' ? 'Video' : 'Photo'}
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    borderTopWidth: 0,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  labelCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    marginRight: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: '55%',
    textAlign: 'right',
  },
});
