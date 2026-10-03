import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import { useViewerStore } from '../../store/useViewerStore';
import { format } from 'date-fns';

interface Props {
  item: PixoraMediaInfo;
}

export default function MediaDetailsModal({ item }: Props) {
  const { detailsVisible, setDetailsVisible } = useViewerStore();

  if (!item) return null;

  return (
    <Modal
      visible={detailsVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setDetailsVisible(false)}
    >
      <Pressable style={styles.overlay} onPress={() => setDetailsVisible(false)}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.dragHandle} />
          
          <Text style={styles.title}>Details</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Filename</Text>
            <Text style={styles.value}>{item.filename}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>
              {format(new Date(item.creationTime), 'MMM d, yyyy • h:mm a')}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Resolution</Text>
            <Text style={styles.value}>{item.width} x {item.height}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Type</Text>
            <Text style={styles.value}>{item.mediaType}</Text>
          </View>

          <Pressable style={styles.closeButton} onPress={() => setDetailsVisible(false)}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  label: {
    color: '#94A3B8',
    fontSize: 14,
  },
  value: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    marginTop: 24,
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeText: {
    color: '#F1F5F9',
    fontWeight: '600',
  },
});
