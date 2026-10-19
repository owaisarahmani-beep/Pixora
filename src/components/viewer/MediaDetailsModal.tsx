import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import { useViewerStore } from '../../store/useViewerStore';

interface Props {
  item: PixoraMediaInfo;
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

export default function MediaDetailsModal({ item }: Props) {
  const { detailsVisible, setDetailsVisible } = useViewerStore();
  const [fileSize, setFileSize] = useState<number | null>(null);

  useEffect(() => {
    if (!item?.uri || !detailsVisible) return;

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
  }, [item?.uri, detailsVisible]);

  if (!item) return null;

  const megapixels = item.width > 0 && item.height > 0 
    ? ((item.width * item.height) / 1000000).toFixed(1) + ' MP'
    : null;

  return (
    <Modal
      visible={detailsVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setDetailsVisible(false)}
    >
      <Pressable style={styles.overlay} onPress={() => setDetailsVisible(false)}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Top Drag Pill */}
          <View style={styles.dragHandle} />
          
          <View style={styles.headerRow}>
            <Text style={styles.title}>Details & Info</Text>
            <Pressable onPress={() => setDetailsVisible(false)} hitSlop={10}>
              <Ionicons name="close-circle" size={24} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Filename */}
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Ionicons name="document-text-outline" size={18} color="#67E8F9" style={styles.rowIcon} />
              <Text style={styles.label}>File Name</Text>
            </View>
            <Text style={styles.value} numberOfLines={1}>{item.filename || 'Untitled'}</Text>
          </View>

          {/* Date & Time */}
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Ionicons name="calendar-outline" size={18} color="#67E8F9" style={styles.rowIcon} />
              <Text style={styles.label}>Date</Text>
            </View>
            <Text style={styles.value}>
              {format(new Date(item.creationTime), 'EEE, MMM d, yyyy • h:mm a')}
            </Text>
          </View>

          {/* Resolution & Megapixels */}
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Ionicons name="scan-outline" size={18} color="#67E8F9" style={styles.rowIcon} />
              <Text style={styles.label}>Dimensions</Text>
            </View>
            <Text style={styles.value}>
              {item.width} × {item.height}{megapixels ? ` (${megapixels})` : ''}
            </Text>
          </View>

          {/* File Size */}
          {fileSize !== null && fileSize > 0 && (
            <View style={styles.row}>
              <View style={styles.labelCol}>
                <Ionicons name="pie-chart-outline" size={18} color="#67E8F9" style={styles.rowIcon} />
                <Text style={styles.label}>File Size</Text>
              </View>
              <Text style={styles.value}>{formatBytes(fileSize)}</Text>
            </View>
          )}

          {/* Duration if video */}
          {item.mediaType === 'video' && item.duration > 0 && (
            <View style={styles.row}>
              <View style={styles.labelCol}>
                <Ionicons name="time-outline" size={18} color="#67E8F9" style={styles.rowIcon} />
                <Text style={styles.label}>Duration</Text>
              </View>
              <Text style={styles.value}>{formatDuration(item.duration)}</Text>
            </View>
          )}

          {/* Media Type */}
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Ionicons name="film-outline" size={18} color="#67E8F9" style={styles.rowIcon} />
              <Text style={styles.label}>Media Type</Text>
            </View>
            <Text style={styles.value}>
              {item.mediaType === 'video' ? 'Video' : 'Photo'}
            </Text>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#161D2B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  dragHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#334155',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  title: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  labelCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    marginRight: 10,
  },
  label: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
});
