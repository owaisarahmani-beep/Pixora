import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ActivityIndicator, 
  Alert, 
  ScrollView,
  Image as RNImage
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';

import { useTheme } from '../../theme/ThemeProvider';
import { useMediaStore } from '../../store/useMediaStore';
import CropOverlay, { CropRect } from '../../components/editor/CropOverlay';

type CropRatio = 'original' | '1:1' | '4:5' | '16:9' | '9:16' | '4:3' | '3:4';

const RATIO_PRESETS: { id: CropRatio; label: string; ratio?: number }[] = [
  { id: 'original', label: 'Free' },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
];

export default function EditorScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const { media, refreshMedia } = useMediaStore();

  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Dimensions
  const [originalDims, setOriginalDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [currentDims, setCurrentDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Custom Interactive Crop State - starts at 0, 0, 1, 1 (full image corners)
  const [containerLayout, setContainerLayout] = useState<{ width: number; height: number } | null>(null);
  const [cropRatio, setCropRatio] = useState<CropRatio>('original');
  const [activeCropRect, setActiveCropRect] = useState<CropRect>({
    originX: 0,
    originY: 0,
    width: 1,
    height: 1,
  });

  // Track if any modifications were applied
  const [editCount, setEditCount] = useState<number>(0);

  // Active Bottom Tab: 'crop' or 'transform'
  const [activeTab, setActiveTab] = useState<'crop' | 'transform'>('crop');

  // Initialize media
  useEffect(() => {
    const item = media.find(m => m.id === id);
    if (item && item.mediaType === 'photo') {
      queueMicrotask(() => {
        setOriginalUri(item.uri);
        setCurrentUri(item.uri);
      });
      
      const w = item.width || 0;
      const h = item.height || 0;
      if (w > 0 && h > 0) {
        queueMicrotask(() => {
          setOriginalDims({ width: w, height: h });
          setCurrentDims({ width: w, height: h });
        });
      } else {
        RNImage.getSize(item.uri, (width: number, height: number) => {
          setOriginalDims({ width, height });
          setCurrentDims({ width, height });
        }, () => {});
      }
    } else {
      Alert.alert('Error', 'Unsupported media type for editing.');
      router.back();
    }
  }, [id, media]);

  // Calculate exact position and bounds of the rendered image inside container
  const imageLayout = useMemo(() => {
    if (!containerLayout || containerLayout.width === 0 || containerLayout.height === 0) return null;
    const baseW = currentDims.width || originalDims.width;
    const baseH = currentDims.height || originalDims.height;
    if (baseW === 0 || baseH === 0) return null;

    const containerAspect = containerLayout.width / containerLayout.height;
    const imageAspect = baseW / baseH;

    let w = containerLayout.width;
    let h = containerLayout.height;
    let x = 0;
    let y = 0;

    if (containerAspect > imageAspect) {
      h = containerLayout.height;
      w = h * imageAspect;
      x = (containerLayout.width - w) / 2;
    } else {
      w = containerLayout.width;
      h = w / imageAspect;
      y = (containerLayout.height - h) / 2;
    }

    return { width: w, height: h, x, y };
  }, [containerLayout, currentDims, originalDims]);

  // Aspect ratio preset handler - fits the ratio cleanly to image edges
  const handleSelectCropRatio = (preset: CropRatio) => {
    setCropRatio(preset);
    const baseW = currentDims.width || originalDims.width || 1000;
    const baseH = currentDims.height || originalDims.height || 1000;
    const imageAspect = baseW / baseH;

    if (preset === 'original') {
      // Full image - starts from the exact 4 outer corners
      setActiveCropRect({ originX: 0, originY: 0, width: 1, height: 1 });
      return;
    }

    const found = RATIO_PRESETS.find(p => p.id === preset);
    if (!found || !found.ratio) return;
    const targetRatio = found.ratio;

    let w = 1.0;
    let h = 1.0;

    if (targetRatio > imageAspect) {
      // Wider than image: width spans full image, height is centered
      w = 1.0;
      h = Math.min(1.0, imageAspect / targetRatio);
    } else {
      // Taller than image: height spans full image, width is centered
      h = 1.0;
      w = Math.min(1.0, targetRatio / imageAspect);
    }

    const originX = Math.max(0, (1 - w) / 2);
    const originY = Math.max(0, (1 - h) / 2);

    setActiveCropRect({ originX, originY, width: w, height: h });
  };

  // Apply the interactive crop to the active photo
  const handleApplyCrop = async () => {
    if (!currentUri || !activeCropRect) return;
    
    // If crop covers 100%, nothing to crop
    if (activeCropRect.originX <= 0.005 && activeCropRect.originY <= 0.005 && activeCropRect.width >= 0.99 && activeCropRect.height >= 0.99) {
      return;
    }

    setIsProcessing(true);
    try {
      const baseW = currentDims.width || originalDims.width;
      const baseH = currentDims.height || originalDims.height;

      const originX = Math.max(0, Math.round(activeCropRect.originX * baseW));
      const originY = Math.max(0, Math.round(activeCropRect.originY * baseH));
      const width = Math.min(baseW - originX, Math.round(activeCropRect.width * baseW));
      const height = Math.min(baseH - originY, Math.round(activeCropRect.height * baseH));

      if (width > 20 && height > 20) {
        const result = await ImageManipulator.manipulateAsync(
          currentUri,
          [{ crop: { originX, originY, width, height } }],
          { compress: 1.0, format: ImageManipulator.SaveFormat.JPEG }
        );
        setCurrentUri(result.uri);
        setCurrentDims({ width: result.width, height: result.height });
        // Reset crop box to full corners of the new cropped image
        setActiveCropRect({ originX: 0, originY: 0, width: 1, height: 1 });
        setCropRatio('original');
        setEditCount(prev => prev + 1);
      }
    } catch (e) {
      console.error('Crop failed', e);
      Alert.alert('Error', 'Could not crop the photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Transform Handlers (Rotate 90°, Flip) - operates sequentially on current image
  const handleTransform = async (action: ImageManipulator.Action) => {
    if (!currentUri) return;
    setIsProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        currentUri,
        [action],
        { compress: 1.0, format: ImageManipulator.SaveFormat.JPEG }
      );
      setCurrentUri(result.uri);
      setCurrentDims({ width: result.width, height: result.height });
      setActiveCropRect({ originX: 0, originY: 0, width: 1, height: 1 });
      setEditCount(prev => prev + 1);
    } catch (e) {
      console.error('Transform failed', e);
      Alert.alert('Error', 'Could not transform the photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotateLeft = () => handleTransform({ rotate: -90 });
  const handleRotateRight = () => handleTransform({ rotate: 90 });
  const handleFlipHorizontal = () => handleTransform({ flip: ImageManipulator.FlipType.Horizontal });
  const handleFlipVertical = () => handleTransform({ flip: ImageManipulator.FlipType.Vertical });

  // Reset all edits back to the initial photo
  const handleReset = () => {
    setCurrentUri(originalUri);
    setCurrentDims(originalDims);
    setActiveCropRect({ originX: 0, originY: 0, width: 1, height: 1 });
    setCropRatio('original');
    setEditCount(0);
  };

  // Save copy to device gallery with verified permissions
  const handleSave = async () => {
    if (!currentUri || (!editCount && isCropUnmodified(activeCropRect))) {
      router.back();
      return;
    }
    
    setIsProcessing(true);
    try {
      // 1. Request and verify write permission
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Pixora needs storage permission to save edited photos.');
        setIsProcessing(false);
        return;
      }

      let saveUri = currentUri;

      // 2. If there is an active crop that hasn't been committed, crop it before saving
      if (!isCropUnmodified(activeCropRect)) {
        const baseW = currentDims.width || originalDims.width;
        const baseH = currentDims.height || originalDims.height;
        const originX = Math.max(0, Math.round(activeCropRect.originX * baseW));
        const originY = Math.max(0, Math.round(activeCropRect.originY * baseH));
        const width = Math.min(baseW - originX, Math.round(activeCropRect.width * baseW));
        const height = Math.min(baseH - originY, Math.round(activeCropRect.height * baseH));

        if (width > 20 && height > 20) {
          const cropResult = await ImageManipulator.manipulateAsync(
            saveUri,
            [{ crop: { originX, originY, width, height } }],
            { compress: 1.0, format: ImageManipulator.SaveFormat.JPEG }
          );
          saveUri = cropResult.uri;
        }
      }

      // 3. Create asset in device media library
      const asset = await MediaLibrary.createAssetAsync(saveUri);
      
      // Try to add to Pixora album for clean organization
      try {
        const album = await MediaLibrary.getAlbumAsync('Pixora');
        if (!album) {
          await MediaLibrary.createAlbumAsync('Pixora', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      } catch {
        // Safe fallback if album creation is unsupported
      }

      await refreshMedia();
      Alert.alert('Saved', 'Edited photo saved to Gallery!');
      router.back();
    } catch (e: any) {
      console.error('Failed to save edited photo', e);
      Alert.alert('Save Error', e?.message || 'Could not save the photo to your device gallery.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isCropUnmodified = (rect: CropRect) => {
    return rect.originX <= 0.005 && rect.originY <= 0.005 && rect.width >= 0.99 && rect.height >= 0.99;
  };

  const hasEdits = editCount > 0 || !isCropUnmodified(activeCropRect);

  if (!originalUri) {
    return (
      <View style={[styles.container, { backgroundColor: '#000', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000', paddingTop: insets.top }]}>
      
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="close" size={26} color="#FFF" />
        </Pressable>

        {/* Live Info HUD */}
        <View style={styles.hudContainer}>
          <Text style={styles.hudTitle}>Edit Photo</Text>
          {currentDims.width > 0 && (
            <Text style={styles.hudSubtitle}>
              {currentDims.width} × {currentDims.height}
            </Text>
          )}
        </View>

        <Pressable 
          onPress={handleSave} 
          style={[styles.saveBtn, { opacity: isProcessing ? 0.5 : 1 }]} 
          disabled={isProcessing}
          hitSlop={12}
        >
          <Text style={[styles.saveText, { color: theme.accent }]}>Save Copy</Text>
        </Pressable>
      </View>

      {/* Main Image Viewport */}
      <View
        style={styles.imageContainer}
        onLayout={(e) => setContainerLayout(e.nativeEvent.layout)}
      >
        <Image 
          source={{ uri: showOriginal ? originalUri : (currentUri || originalUri) }} 
          style={styles.image} 
          contentFit="contain"
          transition={0}
        />

        {/* Crop Overlay with full corner & edge handles */}
        {activeTab === 'crop' && (
          <CropOverlay
            imageLayout={imageLayout}
            initialCrop={activeCropRect}
            onCropChange={(rect) => setActiveCropRect(rect)}
          />
        )}
        
        {/* Hold-to-Compare Indicator */}
        {showOriginal && (
          <View style={styles.originalBadge}>
            <Text style={styles.originalBadgeText}>ORIGINAL</Text>
          </View>
        )}

        {/* Processing Spinner */}
        {isProcessing && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}

        {/* Hold to Compare Button */}
        {hasEdits && (
          <Pressable 
            style={styles.compareBtn}
            onPressIn={() => setShowOriginal(true)}
            onPressOut={() => setShowOriginal(false)}
          >
            <Ionicons name="eye-outline" size={18} color="#FFF" />
            <Text style={styles.compareBtnText}>Hold to Compare</Text>
          </Pressable>
        )}
      </View>

      {/* Bottom Controls Panel */}
      <View style={[styles.controlsContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        
        {/* Sub-panel Content based on Active Tab */}
        <View style={styles.tabContentArea}>
          
          {/* TAB 1: CROP & ASPECT */}
          {activeTab === 'crop' && (
            <View style={styles.cropTabContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {RATIO_PRESETS.map(item => (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.chip,
                      cropRatio === item.id && { backgroundColor: theme.accent, borderColor: theme.accent }
                    ]}
                    onPress={() => handleSelectCropRatio(item.id)}
                  >
                    <Text style={[
                      styles.chipText,
                      cropRatio === item.id ? { color: '#000', fontWeight: '700' } : { color: '#FFF' }
                    ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {!isCropUnmodified(activeCropRect) && (
                <Pressable
                  style={[styles.applyCropBtn, { backgroundColor: theme.accent }]}
                  onPress={handleApplyCrop}
                  disabled={isProcessing}
                >
                  <Ionicons name="checkmark" size={18} color="#000" />
                  <Text style={styles.applyCropText}>Apply Crop</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* TAB 2: TRANSFORM (ROTATE & FLIP) */}
          {activeTab === 'transform' && (
            <View style={styles.toolsRow}>
              <Pressable style={styles.toolBtn} onPress={handleRotateLeft} disabled={isProcessing}>
                <Ionicons name="arrow-undo-outline" size={24} color="#FFF" />
                <Text style={styles.toolText}>Rotate L</Text>
              </Pressable>

              <Pressable style={styles.toolBtn} onPress={handleRotateRight} disabled={isProcessing}>
                <Ionicons name="arrow-redo-outline" size={24} color="#FFF" />
                <Text style={styles.toolText}>Rotate R</Text>
              </Pressable>
              
              <Pressable style={styles.toolBtn} onPress={handleFlipHorizontal} disabled={isProcessing}>
                <Ionicons name="swap-horizontal" size={24} color="#FFF" />
                <Text style={styles.toolText}>Flip H</Text>
              </Pressable>
              
              <Pressable style={styles.toolBtn} onPress={handleFlipVertical} disabled={isProcessing}>
                <Ionicons name="swap-vertical" size={24} color="#FFF" />
                <Text style={styles.toolText}>Flip V</Text>
              </Pressable>
            </View>
          )}

        </View>

        {/* Reset Edits Button */}
        {hasEdits && (
          <Pressable style={styles.resetBtn} onPress={handleReset}>
            <Ionicons name="refresh-outline" size={14} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.resetText}>Reset All</Text>
          </Pressable>
        )}

        {/* Tab Navigator Bar (Crop vs Transform) */}
        <View style={styles.tabBar}>
          <Pressable 
            style={[styles.tabItem, activeTab === 'crop' && styles.tabItemActive]}
            onPress={() => setActiveTab('crop')}
          >
            <Ionicons name="scan-outline" size={20} color={activeTab === 'crop' ? theme.accent : '#8E8E93'} />
            <Text style={[styles.tabText, activeTab === 'crop' && { color: theme.accent }]}>Crop & Aspect</Text>
          </Pressable>

          <Pressable 
            style={[styles.tabItem, activeTab === 'transform' && styles.tabItemActive]}
            onPress={() => setActiveTab('transform')}
          >
            <Ionicons name="sync-outline" size={20} color={activeTab === 'transform' ? theme.accent : '#8E8E93'} />
            <Text style={[styles.tabText, activeTab === 'transform' && { color: theme.accent }]}>Rotate & Flip</Text>
          </Pressable>
        </View>

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
    paddingHorizontal: 12,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  hudContainer: {
    alignItems: 'center',
  },
  hudTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  hudSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  iconBtn: {
    padding: 8,
  },
  saveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  originalBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  originalBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compareBtn: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,20,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#444',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  compareBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  controlsContainer: {
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  tabContentArea: {
    minHeight: 64,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toolText: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 4,
  },
  cropTabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  chipScroll: {
    paddingRight: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#222',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  applyCropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  applyCropText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  resetText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabItemActive: {
    opacity: 1,
  },
  tabText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
