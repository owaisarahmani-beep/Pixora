import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';

import { useTheme } from '../../theme/ThemeProvider';
import { useMediaStore } from '../../store/useMediaStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EditorScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const { media, refreshMedia } = useMediaStore();

  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Edit State
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);

  useEffect(() => {
    const item = media.find(m => m.id === id);
    if (item && item.mediaType === 'photo') {
      setOriginalUri(item.uri);
      setCurrentUri(item.uri);
    } else {
      Alert.alert('Error', 'Unsupported media type for editing.');
      router.back();
    }
  }, [id, media]);

  // Apply edits live (debounced visually by the user pressing buttons)
  const applyEdits = async (newRotation: number, newFlipX: boolean, newFlipY: boolean) => {
    if (!originalUri) return;
    setIsProcessing(true);
    try {
      const actions: ImageManipulator.Action[] = [];
      
      if (newFlipX) actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      if (newFlipY) actions.push({ flip: ImageManipulator.FlipType.Vertical });
      if (newRotation !== 0) actions.push({ rotate: newRotation });

      if (actions.length > 0) {
        const result = await ImageManipulator.manipulateAsync(
          originalUri,
          actions,
          { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
        );
        setCurrentUri(result.uri);
      } else {
        setCurrentUri(originalUri);
      }
    } catch (e) {
      console.error('Image manipulation failed', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    applyEdits(nextRot, flipX, flipY);
  };

  const handleFlipHorizontal = () => {
    const nextFlipX = !flipX;
    setFlipX(nextFlipX);
    applyEdits(rotation, nextFlipX, flipY);
  };

  const handleFlipVertical = () => {
    const nextFlipY = !flipY;
    setFlipY(nextFlipY);
    applyEdits(rotation, flipX, nextFlipY);
  };

  const handleReset = () => {
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setCurrentUri(originalUri);
  };

  const handleSave = async () => {
    if (!currentUri || currentUri === originalUri) {
      router.back();
      return;
    }
    
    setIsProcessing(true);
    try {
      // Create new asset in OS media store
      await MediaLibrary.createAssetAsync(currentUri);
      await refreshMedia();
      
      Alert.alert('Success', 'Edited photo saved to Gallery!');
      router.back();
    } catch (e) {
      console.error('Failed to save edited photo', e);
      Alert.alert('Error', 'Could not save the edited photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!originalUri) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const hasEdits = rotation !== 0 || flipX || flipY;

  return (
    <View style={[styles.container, { backgroundColor: '#000', paddingTop: insets.top }]}>
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={28} color="#FFF" />
        </Pressable>
        <Text style={styles.title}>Edit Photo</Text>
        <Pressable onPress={handleSave} style={[styles.saveBtn, { opacity: isProcessing ? 0.5 : 1 }]} disabled={isProcessing}>
          <Text style={[styles.saveText, { color: theme.accent }]}>Save Copy</Text>
        </Pressable>
      </View>

      {/* Main Image Area */}
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: currentUri || originalUri }} 
          style={styles.image} 
          contentFit="contain"
          transition={200}
        />
        {isProcessing && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFF" />
          </View>
        )}
      </View>

      {/* Controls Area */}
      <View style={[styles.controlsContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        
        <View style={styles.toolsRow}>
          <Pressable style={styles.toolBtn} onPress={handleRotate}>
            <Ionicons name="refresh" size={24} color="#FFF" />
            <Text style={styles.toolText}>Rotate</Text>
          </Pressable>
          
          <Pressable style={styles.toolBtn} onPress={handleFlipHorizontal}>
            <Ionicons name="swap-horizontal" size={24} color="#FFF" />
            <Text style={styles.toolText}>Flip H</Text>
          </Pressable>
          
          <Pressable style={styles.toolBtn} onPress={handleFlipVertical}>
            <Ionicons name="swap-vertical" size={24} color="#FFF" />
            <Text style={styles.toolText}>Flip V</Text>
          </Pressable>
        </View>

        {hasEdits && (
          <Pressable style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetText}>Reset Edits</Text>
          </Pressable>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 56,
  },
  iconBtn: {
    padding: 8,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  saveBtn: {
    padding: 8,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  image: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsContainer: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 8,
  },
  resetBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#333',
    borderRadius: 20,
    marginTop: 8,
  },
  resetText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
