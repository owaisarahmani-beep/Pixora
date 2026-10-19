import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ActivityIndicator, 
  Alert, 
  Dimensions, 
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type CropRatio = 'original' | '1:1' | '4:5' | '16:9' | '9:16' | '4:3' | '3:4';
type ScaleOption = 'original' | '1080p' | '720p' | '50%';
type QualityOption = 1.0 | 0.85 | 0.70;
type FormatOption = ImageManipulator.SaveFormat.JPEG | ImageManipulator.SaveFormat.PNG | ImageManipulator.SaveFormat.WEBP;

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

  // Edit Parameters
  const [rotation, setRotation] = useState<number>(0);
  const [flipX, setFlipX] = useState<boolean>(false);
  const [flipY, setFlipY] = useState<boolean>(false);
  const [cropRatio, setCropRatio] = useState<CropRatio>('original');
  const [scaleOption, setScaleOption] = useState<ScaleOption>('original');
  const [quality, setQuality] = useState<QualityOption>(1.0);
  const [format, setFormat] = useState<FormatOption>(ImageManipulator.SaveFormat.JPEG);

  // Active Bottom Tab
  const [activeTab, setActiveTab] = useState<'transform' | 'crop' | 'export'>('transform');

  // Initialize media
  useEffect(() => {
    const item = media.find(m => m.id === id);
    if (item && item.mediaType === 'photo') {
      setOriginalUri(item.uri);
      setCurrentUri(item.uri);
      
      const w = item.width || 0;
      const h = item.height || 0;
      if (w > 0 && h > 0) {
        setOriginalDims({ width: w, height: h });
        setCurrentDims({ width: w, height: h });
      } else {
        // Fallback size detection
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

  // Apply all edit transformations
  const applyEdits = useCallback(async (
    newRot: number,
    newFlipX: boolean,
    newFlipY: boolean,
    newCrop: CropRatio,
    newScale: ScaleOption,
    newQuality: QualityOption,
    newFormat: FormatOption
  ) => {
    if (!originalUri) return;
    setIsProcessing(true);

    try {
      const actions: ImageManipulator.Action[] = [];
      const baseW = originalDims.width || 1000;
      const baseH = originalDims.height || 1000;

      // 1. Crop
      if (newCrop !== 'original') {
        let targetRatio = 1;
        switch (newCrop) {
          case '1:1': targetRatio = 1; break;
          case '4:5': targetRatio = 4 / 5; break;
          case '16:9': targetRatio = 16 / 9; break;
          case '9:16': targetRatio = 9 / 16; break;
          case '4:3': targetRatio = 4 / 3; break;
          case '3:4': targetRatio = 3 / 4; break;
        }

        const currentRatio = baseW / baseH;
        let cropW = baseW;
        let cropH = baseH;
        let originX = 0;
        let originY = 0;

        if (currentRatio > targetRatio) {
          cropW = Math.round(baseH * targetRatio);
          originX = Math.round((baseW - cropW) / 2);
        } else {
          cropH = Math.round(baseW / targetRatio);
          originY = Math.round((baseH - cropH) / 2);
        }

        actions.push({
          crop: { originX, originY, width: cropW, height: cropH }
        });
      }

      // 2. Flip
      if (newFlipX) actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      if (newFlipY) actions.push({ flip: ImageManipulator.FlipType.Vertical });

      // 3. Rotation
      if (newRot !== 0) actions.push({ rotate: newRot });

      // 4. Resize / Scale
      if (newScale !== 'original') {
        if (newScale === '1080p') {
          actions.push({ resize: { width: 1080 } });
        } else if (newScale === '720p') {
          actions.push({ resize: { width: 720 } });
        } else if (newScale === '50%') {
          const targetW = Math.round(baseW * 0.5);
          actions.push({ resize: { width: targetW } });
        }
      }

      if (actions.length > 0 || newQuality !== 1.0 || newFormat !== ImageManipulator.SaveFormat.JPEG) {
        const result = await ImageManipulator.manipulateAsync(
          originalUri,
          actions,
          { compress: newQuality, format: newFormat }
        );
        setCurrentUri(result.uri);
        setCurrentDims({ width: result.width, height: result.height });
      } else {
        setCurrentUri(originalUri);
        setCurrentDims(originalDims);
      }
    } catch (e) {
      console.error('Image edit failed', e);
    } finally {
      setIsProcessing(false);
    }
  }, [originalUri, originalDims]);

  // Handlers for Transform
  const handleRotateRight = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    applyEdits(nextRot, flipX, flipY, cropRatio, scaleOption, quality, format);
  };

  const handleRotateLeft = () => {
    const nextRot = (rotation - 90 + 360) % 360;
    setRotation(nextRot);
    applyEdits(nextRot, flipX, flipY, cropRatio, scaleOption, quality, format);
  };

  const handleFlipHorizontal = () => {
    const nextFlipX = !flipX;
    setFlipX(nextFlipX);
    applyEdits(rotation, nextFlipX, flipY, cropRatio, scaleOption, quality, format);
  };

  const handleFlipVertical = () => {
    const nextFlipY = !flipY;
    setFlipY(nextFlipY);
    applyEdits(rotation, flipX, nextFlipY, cropRatio, scaleOption, quality, format);
  };

  // Handlers for Crop
  const handleSelectCrop = (crop: CropRatio) => {
    setCropRatio(crop);
    applyEdits(rotation, flipX, flipY, crop, scaleOption, quality, format);
  };

  // Handlers for Scale & Quality
  const handleSelectScale = (scale: ScaleOption) => {
    setScaleOption(scale);
    applyEdits(rotation, flipX, flipY, cropRatio, scale, quality, format);
  };

  const handleSelectQuality = (q: QualityOption) => {
    setQuality(q);
    applyEdits(rotation, flipX, flipY, cropRatio, scaleOption, q, format);
  };

  const handleSelectFormat = (fmt: FormatOption) => {
    setFormat(fmt);
    applyEdits(rotation, flipX, flipY, cropRatio, scaleOption, quality, fmt);
  };

  // Reset to original
  const handleReset = () => {
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setCropRatio('original');
    setScaleOption('original');
    setQuality(1.0);
    setFormat(ImageManipulator.SaveFormat.JPEG);
    setCurrentUri(originalUri);
    setCurrentDims(originalDims);
  };

  // Save copy to device gallery
  const handleSave = async () => {
    if (!currentUri || currentUri === originalUri) {
      router.back();
      return;
    }
    
    setIsProcessing(true);
    try {
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
      <View style={[styles.container, { backgroundColor: '#000', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const hasEdits = rotation !== 0 || flipX || flipY || cropRatio !== 'original' || scaleOption !== 'original' || quality !== 1.0;

  return (
    <View style={[styles.container, { backgroundColor: '#000', paddingTop: insets.top }]}>
      
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={26} color="#FFF" />
        </Pressable>

        {/* Live Info HUD */}
        <View style={styles.hudContainer}>
          <Text style={styles.hudTitle}>Edit Photo</Text>
          {currentDims.width > 0 && (
            <Text style={styles.hudSubtitle}>
              {currentDims.width} × {currentDims.height} • {format.toUpperCase()}
            </Text>
          )}
        </View>

        <Pressable 
          onPress={handleSave} 
          style={[styles.saveBtn, { opacity: isProcessing ? 0.5 : 1 }]} 
          disabled={isProcessing}
        >
          <Text style={[styles.saveText, { color: theme.accent }]}>Save Copy</Text>
        </Pressable>
      </View>

      {/* Main Image Viewport */}
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: showOriginal ? originalUri : (currentUri || originalUri) }} 
          style={styles.image} 
          contentFit="contain"
          transition={0}
        />
        
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

        {/* Quick Compare Button (floating above bottom controls) */}
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
          {activeTab === 'transform' && (
            <View style={styles.toolsRow}>
              <Pressable style={styles.toolBtn} onPress={handleRotateLeft}>
                <Ionicons name="arrow-undo-outline" size={24} color="#FFF" />
                <Text style={styles.toolText}>Rotate L</Text>
              </Pressable>

              <Pressable style={styles.toolBtn} onPress={handleRotateRight}>
                <Ionicons name="arrow-redo-outline" size={24} color="#FFF" />
                <Text style={styles.toolText}>Rotate R</Text>
              </Pressable>
              
              <Pressable style={[styles.toolBtn, flipX && styles.toolBtnActive]} onPress={handleFlipHorizontal}>
                <Ionicons name="swap-horizontal" size={24} color={flipX ? theme.accent : "#FFF"} />
                <Text style={[styles.toolText, flipX && { color: theme.accent }]}>Flip H</Text>
              </Pressable>
              
              <Pressable style={[styles.toolBtn, flipY && styles.toolBtnActive]} onPress={handleFlipVertical}>
                <Ionicons name="swap-vertical" size={24} color={flipY ? theme.accent : "#FFF"} />
                <Text style={[styles.toolText, flipY && { color: theme.accent }]}>Flip V</Text>
              </Pressable>
            </View>
          )}

          {activeTab === 'crop' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {[
                { id: 'original', label: 'Full' },
                { id: '1:1', label: '1:1 Square' },
                { id: '4:5', label: '4:5 Portrait' },
                { id: '16:9', label: '16:9 Cinema' },
                { id: '9:16', label: '9:16 Story' },
                { id: '4:3', label: '4:3 Standard' },
                { id: '3:4', label: '3:4 Classic' },
              ].map(item => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.chip,
                    cropRatio === item.id && { backgroundColor: theme.accent, borderColor: theme.accent }
                  ]}
                  onPress={() => handleSelectCrop(item.id as CropRatio)}
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
          )}

          {activeTab === 'export' && (
            <View style={styles.exportSection}>
              {/* Scale / Resize */}
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Size:</Text>
                <View style={styles.chipRow}>
                  {(['original', '1080p', '720p', '50%'] as ScaleOption[]).map(s => (
                    <Pressable
                      key={s}
                      style={[styles.smallChip, scaleOption === s && { backgroundColor: theme.accent }]}
                      onPress={() => handleSelectScale(s)}
                    >
                      <Text style={[styles.smallChipText, scaleOption === s ? { color: '#000' } : { color: '#FFF' }]}>
                        {s === 'original' ? 'Max' : s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Quality */}
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Quality:</Text>
                <View style={styles.chipRow}>
                  {[
                    { q: 1.0, label: '100%' },
                    { q: 0.85, label: '85%' },
                    { q: 0.70, label: '70%' },
                  ].map(item => (
                    <Pressable
                      key={item.label}
                      style={[styles.smallChip, quality === item.q && { backgroundColor: theme.accent }]}
                      onPress={() => handleSelectQuality(item.q as QualityOption)}
                    >
                      <Text style={[styles.smallChipText, quality === item.q ? { color: '#000' } : { color: '#FFF' }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Format */}
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Format:</Text>
                <View style={styles.chipRow}>
                  {[
                    { fmt: ImageManipulator.SaveFormat.JPEG, label: 'JPEG' },
                    { fmt: ImageManipulator.SaveFormat.PNG, label: 'PNG' },
                    { fmt: ImageManipulator.SaveFormat.WEBP, label: 'WEBP' },
                  ].map(item => (
                    <Pressable
                      key={item.label}
                      style={[styles.smallChip, format === item.fmt && { backgroundColor: theme.accent }]}
                      onPress={() => handleSelectFormat(item.fmt)}
                    >
                      <Text style={[styles.smallChipText, format === item.fmt ? { color: '#000' } : { color: '#FFF' }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Reset Edits Bar */}
        {hasEdits && (
          <Pressable style={styles.resetBtn} onPress={handleReset}>
            <Ionicons name="refresh-outline" size={14} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.resetText}>Reset All</Text>
          </Pressable>
        )}

        {/* Tab Navigator Bar */}
        <View style={styles.tabBar}>
          <Pressable 
            style={[styles.tabItem, activeTab === 'transform' && styles.tabItemActive]}
            onPress={() => setActiveTab('transform')}
          >
            <Ionicons name="crop" size={20} color={activeTab === 'transform' ? theme.accent : '#8E8E93'} />
            <Text style={[styles.tabText, activeTab === 'transform' && { color: theme.accent }]}>Transform</Text>
          </Pressable>

          <Pressable 
            style={[styles.tabItem, activeTab === 'crop' && styles.tabItemActive]}
            onPress={() => setActiveTab('crop')}
          >
            <Ionicons name="scan-outline" size={20} color={activeTab === 'crop' ? theme.accent : '#8E8E93'} />
            <Text style={[styles.tabText, activeTab === 'crop' && { color: theme.accent }]}>Aspect Crop</Text>
          </Pressable>

          <Pressable 
            style={[styles.tabItem, activeTab === 'export' && styles.tabItemActive]}
            onPress={() => setActiveTab('export')}
          >
            <Ionicons name="options-outline" size={20} color={activeTab === 'export' ? theme.accent : '#8E8E93'} />
            <Text style={[styles.tabText, activeTab === 'export' && { color: theme.accent }]}>Size & Quality</Text>
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
    fontSize: 11,
    marginTop: 2,
  },
  iconBtn: {
    padding: 8,
  },
  saveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    position: 'relative',
  },
  image: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  originalBadge: {
    position: 'absolute',
    top: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  originalBadgeText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compareBtn: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  compareBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  controlsContainer: {
    backgroundColor: '#141416',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#262628',
  },
  tabContentArea: {
    minHeight: 70,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  toolBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toolText: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
  },
  chipScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#202024',
    marginRight: 10,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  exportSection: {
    paddingVertical: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optionLabel: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
    width: 65,
  },
  chipRow: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'flex-end',
  },
  smallChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#252528',
    marginLeft: 6,
  },
  smallChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#2A2A2E',
    borderRadius: 14,
    marginVertical: 8,
  },
  resetText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 10,
    marginTop: 4,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  tabItemActive: {},
  tabText: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
});
