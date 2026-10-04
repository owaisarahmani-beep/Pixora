import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PixoraMediaInfo } from '../../services/media/mediaTypes';
import { useViewerStore } from '../../store/useViewerStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { useMediaStore } from '../../store/useMediaStore';
import { Alert } from 'react-native';

interface Props {
  item: PixoraMediaInfo;
}

export default function ViewerControls({ item }: Props) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const source = Array.isArray(params.source) ? params.source[0] : (params.source as string) || 'gallery';

  const insets = useSafeAreaInsets();
  const { controlsVisible, setDetailsVisible } = useViewerStore();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { deleteMediaAsync } = useMediaStore();
  
  const opacity = useSharedValue(1);

  const handleDelete = () => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to permanently delete this item?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const success = await deleteMediaAsync(item.id);
            if (success) {
              router.back();
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    opacity.value = withTiming(controlsVisible ? 1 : 0, { duration: 200 });
  }, [controlsVisible, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleShare = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(item.uri);
      }
    } catch (e) {
      console.error('Share failed', e);
    }
  };

  const isFavorite = favorites.has(item.id);

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents={controlsVisible ? 'box-none' : 'none'}>
      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top || 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.title}></Text>
        <View style={styles.placeholder} />
      </View>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 20 }]}>
        {item.mediaType === 'photo' && (
          <Pressable onPress={() => router.push({ pathname: '/editor/[id]', params: { id: item.id, source } })} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Edit">
            <Ionicons name="color-wand-outline" size={24} color="#FFF" />
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
        )}

        <Pressable onPress={handleShare} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Share">
          <Ionicons name="share-outline" size={24} color="#FFF" />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>

        <Pressable onPress={() => toggleFavorite(item.id, item)} style={styles.actionButton} accessibilityRole="button" accessibilityLabel={isFavorite ? "Unfavorite" : "Favorite"}>
          <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={24} color={isFavorite ? "#EF4444" : "#FFF"} />
          <Text style={styles.actionText}>Favorite</Text>
        </Pressable>

        <Pressable onPress={() => setDetailsVisible(true)} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Details">
          <Ionicons name="information-circle-outline" size={24} color="#FFF" />
          <Text style={styles.actionText}>Details</Text>
        </Pressable>

        <Pressable onPress={handleDelete} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Delete">
          <Ionicons name="trash-outline" size={24} color="#EF4444" />
          <Text style={styles.actionText}>Delete</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingBottom: 12,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingTop: 16,
  },
  iconButton: {
    padding: 8,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    maxWidth: '70%',
  },
  placeholder: {
    width: 40,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  actionText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
  },
});
