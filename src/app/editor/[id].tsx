import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import Slider from '@react-native-community/slider';

import { useTheme } from '../../theme/ThemeProvider';
import { useEditorStore } from '../../store/useEditorStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useSearchStore } from '../../store/useSearchStore';
import { useAlbumsStore } from '../../store/useAlbumsStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import PixoraEditorModule from '../../../modules/pixora-editor/src/PixoraEditorModule';
import { mediaStoreService } from '../../services/media/MediaStoreService';
import CropOverlay from '../../components/editor/CropOverlay';

export default function EditorScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const source = Array.isArray(params.source) ? params.source[0] : params.source;

  const { 
    currentState, historyIndex, history, 
    previewUri, originalUri, isExporting,
    initEditor, updateState, undo, redo, reset,
    setPreviewUri
  } = useEditorStore();

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'adjust' | 'transform' | 'filters' | 'crop'>('adjust');

  const previewBaseUriRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imageLayout, setImageLayout] = useState<{width: number, height: number, x: number, y: number} | null>(null);
  
  // Pending state for crop mode
  const [pendingCrop, setPendingCrop] = useState<{ originX: number; originY: number; width: number; height: number } | null>(null);

  const hiddenAlbumIds = usePrivacyStore(state => state.hiddenAlbumIds);

  // Find media item synchronously
  const item = React.useMemo(() => {
    let collection: any[] = [];
    if (source === 'gallery') collection = useMediaStore.getState().media;
    else if (source === 'search') collection = useSearchStore.getState().searchResults;
    else if (source === 'album') collection = useAlbumsStore.getState().activeAlbumMedia;
    else if (source === 'favorites') collection = useFavoritesStore.getState().favoritesMedia;
    
    return collection.find(m => m.id === id);
  }, [id, source]);

  const isHidden = React.useMemo(() => {
    if (!item || !item.albumId) return false;
    return hiddenAlbumIds.includes(item.albumId);
  }, [item, hiddenAlbumIds]);

  useEffect(() => {
    if (!item || isHidden) {
      return;
    }
    if (item.mediaType === 'video') {
      return;
    }

    initEditor(item.id, item.uri);

    // Create a downscaled base for the live preview
    ImageManipulator.manipulateAsync(
      item.uri,
      [{ resize: { width: 800 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    ).then(result => {
      previewBaseUriRef.current = result.uri;
      setPreviewUri(result.uri);
      setIsLoading(false);
    }).catch(e => {
      console.error('Failed to create preview base', e);
      // Fallback to original
      previewBaseUriRef.current = item.uri;
      setIsLoading(false);
    });
  }, [item, initEditor, setPreviewUri, isHidden]);

  // Sync pending crop when entering crop tab or when crop state changes via undo/redo
  useEffect(() => {
    if (activeTab === 'crop') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingCrop(currentState.crop || { originX: 0, originY: 0, width: 1, height: 1 });
    }
  }, [activeTab, currentState.crop]);

  // Live preview processor
  const processPreview = useCallback(async (stateToProcess: any) => {
    if (!previewBaseUriRef.current) return;
    try {
      const resultUri = await PixoraEditorModule.processImageAsync(previewBaseUriRef.current, stateToProcess);
      setPreviewUri(resultUri);
    } catch (e) {
      console.error('Preview processing failed', e);
    }
  }, [setPreviewUri]);

  // Debounce preview updates when sliders change
  useEffect(() => {
    if (isLoading || isExporting) return;
    
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      processPreview(currentState);
    }, 150); // 150ms throttle

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [currentState, isLoading, isExporting, processPreview]);

  const handleExport = async () => {
    if (!originalUri || isExporting) return;
    useEditorStore.getState().setIsExporting(true);

    try {
      // 1. Process full resolution
      const exportUri = await PixoraEditorModule.processImageAsync(originalUri, currentState);
      
      // 2. Insert to MediaStore
      const newMedia = await mediaStoreService.exportImageToMediaStoreAsync(exportUri);
      
      // 3. Cleanup temp file
      try {
        await FileSystem.deleteAsync(exportUri, { idempotent: true });
      } catch {}

      if (newMedia) {
        // Refresh gallery
        await useMediaStore.getState().refreshMedia();
        alert('Edited copy saved to your gallery.');
        router.back();
      } else {
        alert("The edited copy couldn't be saved. Your original is unchanged.");
      }
    } catch {
      alert("We couldn't edit this photo. Your original is safe.");
    } finally {
      useEditorStore.getState().setIsExporting(false);
    }
  };

  if (!item || isHidden) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>This photo is no longer available.</Text>
        <Pressable onPress={() => router.back()} style={{ padding: 16, backgroundColor: theme.surface, borderRadius: 8 }}>
          <Text style={{ color: theme.accent }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (item.mediaType === 'video') {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>Video editing is not supported. Stage 4C is photo editing only.</Text>
        <Pressable onPress={() => router.back()} style={{ padding: 16, backgroundColor: theme.surface, borderRadius: 8 }}>
          <Text style={{ color: theme.accent }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Cancel">
          <Ionicons name="close" size={28} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Edit</Text>
        <Pressable onPress={reset} style={styles.textButton} accessibilityLabel="Reset">
          <Text style={{ color: theme.text, fontSize: 16 }}>Reset</Text>
        </Pressable>
      </View>

      {/* Preview Area */}
      <View style={styles.previewContainer}>
        {previewUri && item && (
          <View 
            style={[styles.imageWrapper, { aspectRatio: item.width / item.height }]}
            onLayout={(e) => {
              setImageLayout({
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
                x: 0,
                y: 0
              });
            }}
          >
            <Image 
              source={previewUri}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              cachePolicy="none"
            />
            {activeTab === 'crop' && imageLayout && pendingCrop && (
              <CropOverlay 
                key="crop-overlay"
                imageLayout={imageLayout}
                initialCrop={pendingCrop}
                onCropChange={setPendingCrop}
              />
            )}
          </View>
        )}
        {isExporting && (
          <View style={styles.exportOverlay}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={{ color: '#FFF', marginTop: 12 }}>Saving Copy...</Text>
          </View>
        )}
      </View>

      {/* History Controls */}
      <View style={styles.historyBar}>
        <Pressable 
          onPress={undo} 
          disabled={historyIndex === 0}
          style={[styles.historyButton, historyIndex === 0 && { opacity: 0.5 }]}
          accessibilityLabel="Undo"
        >
          <Ionicons name="arrow-undo" size={24} color={theme.text} />
        </Pressable>
        <Pressable 
          onPress={redo} 
          disabled={historyIndex === history.length - 1}
          style={[styles.historyButton, historyIndex === history.length - 1 && { opacity: 0.5 }]}
          accessibilityLabel="Redo"
        >
          <Ionicons name="arrow-redo" size={24} color={theme.text} />
        </Pressable>
      </View>

      {/* Tools Menu */}
      <View style={styles.toolTabs}>
        <Pressable onPress={() => setActiveTab('adjust')} style={[styles.tab, activeTab === 'adjust' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}>
          <Text style={{ color: activeTab === 'adjust' ? theme.accent : theme.textMuted }}>Adjust</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('crop')} style={[styles.tab, activeTab === 'crop' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}>
          <Text style={{ color: activeTab === 'crop' ? theme.accent : theme.textMuted }}>Crop</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('transform')} style={[styles.tab, activeTab === 'transform' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}>
          <Text style={{ color: activeTab === 'transform' ? theme.accent : theme.textMuted }}>Transform</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('filters')} style={[styles.tab, activeTab === 'filters' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}>
          <Text style={{ color: activeTab === 'filters' ? theme.accent : theme.textMuted }}>Filters</Text>
        </Pressable>
      </View>

      {/* Tool Content */}
      <View style={styles.toolContent}>
        {activeTab === 'adjust' && (
          <ScrollView style={styles.scrollView}>
            <AdjustmentSlider label="Brightness" value={currentState.brightness} min={-1} max={1} onChange={(v: number) => updateState({ brightness: v })} />
            <AdjustmentSlider label="Contrast" value={currentState.contrast} min={0} max={2} onChange={(v: number) => updateState({ contrast: v })} />
            <AdjustmentSlider label="Saturation" value={currentState.saturation} min={0} max={2} onChange={(v: number) => updateState({ saturation: v })} />
            <AdjustmentSlider label="Warmth" value={currentState.warmth} min={-1} max={1} onChange={(v: number) => updateState({ warmth: v })} />
          </ScrollView>
        )}

        {activeTab === 'crop' && (
          <View style={styles.center}>
            <Text style={{ color: theme.text, marginBottom: 16 }}>Drag the corners on the image to crop.</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable 
                onPress={() => setActiveTab('adjust')} 
                style={{ padding: 12, backgroundColor: theme.surface, borderRadius: 8, flex: 1, alignItems: 'center' }}
              >
                <Text style={{ color: theme.text }}>Cancel</Text>
              </Pressable>
              <Pressable 
                onPress={() => {
                  if (pendingCrop) updateState({ crop: pendingCrop });
                  setActiveTab('adjust');
                }} 
                style={{ padding: 12, backgroundColor: theme.accent, borderRadius: 8, flex: 1, alignItems: 'center' }}
              >
                <Text style={{ color: '#000', fontWeight: 'bold' }}>Apply</Text>
              </Pressable>
            </View>
          </View>
        )}

        {activeTab === 'transform' && (
          <View style={styles.transformRow}>
            <Pressable onPress={() => updateState({ rotation: (currentState.rotation + 90) % 360 })} style={styles.transformButton}>
              <Ionicons name="refresh" size={28} color={theme.text} />
              <Text style={{ color: theme.text, marginTop: 8 }}>Rotate</Text>
            </Pressable>
            <Pressable onPress={() => updateState({ flipX: !currentState.flipX })} style={styles.transformButton}>
              <Ionicons name="swap-horizontal" size={28} color={theme.text} />
              <Text style={{ color: theme.text, marginTop: 8 }}>Flip H</Text>
            </Pressable>
            <Pressable onPress={() => updateState({ flipY: !currentState.flipY })} style={styles.transformButton}>
              <Ionicons name="swap-vertical" size={28} color={theme.text} />
              <Text style={{ color: theme.text, marginTop: 8 }}>Flip V</Text>
            </Pressable>
          </View>
        )}

        {activeTab === 'filters' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
            {['Original', 'Mono', 'Warm', 'Cool', 'Vintage', 'Fade'].map((f) => (
              <Pressable 
                key={f} 
                onPress={() => updateState({ filter: f as any })}
                style={[styles.filterButton, currentState.filter === f && { borderColor: theme.accent, borderWidth: 2 }]}
              >
                <Text style={{ color: theme.text }}>{f}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 20 }]}>
        <Pressable onPress={handleExport} disabled={isExporting} style={[styles.saveButton, { backgroundColor: theme.accent }]}>
          <Text style={styles.saveButtonText}>Save Copy</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Minimal simulated slider since we might not have @react-native-community/slider installed
function AdjustmentSlider({ label, value, min, max, onChange }: any) {
  const theme = useTheme();
  
  return (
    <View style={{ marginBottom: 24, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: theme.text }}>{label}</Text>
        <Text style={{ color: theme.textMuted }}>{value.toFixed(2)}</Text>
      </View>
      <Slider
        style={{ width: '100%', height: 40 }}
        minimumValue={min}
        maximumValue={max}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={theme.accent}
        maximumTrackTintColor={theme.surface}
        thumbTintColor={theme.accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, marginBottom: 16, textAlign: 'center', padding: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  iconButton: { padding: 4 },
  textButton: { padding: 4 },
  title: { fontSize: 18, fontWeight: '600' },
  previewContainer: { flex: 1, backgroundColor: '#000', position: 'relative', alignItems: 'center', justifyContent: 'center' },
  imageWrapper: { width: '100%', maxHeight: '100%' },
  previewImage: { flex: 1 },
  exportOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  historyBar: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 8, gap: 24 },
  historyButton: { padding: 8 },
  toolTabs: { flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: '#333' },
  tab: { paddingVertical: 12, paddingHorizontal: 16 },
  toolContent: { height: 180, paddingTop: 16 },
  scrollView: { flex: 1 },
  transformRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', flex: 1 },
  transformButton: { alignItems: 'center', padding: 16 },
  filtersRow: { paddingHorizontal: 16 },
  filterButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, backgroundColor: '#333', marginRight: 12, height: 48, justifyContent: 'center' },
  bottomBar: { paddingHorizontal: 16, paddingTop: 12 },
  saveButton: { padding: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});
