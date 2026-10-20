import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';

export interface CropRect {
  originX: number; // 0 to 1 normalized
  originY: number; // 0 to 1 normalized
  width: number;   // 0 to 1 normalized
  height: number;  // 0 to 1 normalized
}

interface CropOverlayProps {
  imageLayout: { width: number; height: number; x: number; y: number } | null;
  initialCrop?: CropRect | null;
  onCropChange: (crop: CropRect) => void;
}

export default function CropOverlay({ imageLayout, initialCrop, onCropChange }: CropOverlayProps) {
  // Normalized coordinates (0 to 1) relative to rendered image
  const normX = useSharedValue(initialCrop?.originX ?? 0.05);
  const normY = useSharedValue(initialCrop?.originY ?? 0.05);
  const normW = useSharedValue(initialCrop?.width ?? 0.9);
  const normH = useSharedValue(initialCrop?.height ?? 0.9);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const emitChange = () => {
    onCropChange({
      originX: Math.max(0, Math.min(1, normX.value)),
      originY: Math.max(0, Math.min(1, normY.value)),
      width: Math.max(0.1, Math.min(1 - normX.value, normW.value)),
      height: Math.max(0.1, Math.min(1 - normY.value, normH.value)),
    });
  };

  // Center pan: moves the entire crop box across the photo
  const centerPan = Gesture.Pan()
    .onBegin(() => {
      startX.value = normX.value;
      startY.value = normY.value;
    })
    .onUpdate((e) => {
      if (!imageLayout || imageLayout.width === 0 || imageLayout.height === 0) return;
      const dx = e.translationX / imageLayout.width;
      const dy = e.translationY / imageLayout.height;

      const maxX = 1 - normW.value;
      const maxY = 1 - normH.value;

      normX.value = Math.max(0, Math.min(maxX, startX.value + dx));
      normY.value = Math.max(0, Math.min(maxY, startY.value + dy));
    })
    .onEnd(() => {
      runOnJS(emitChange)();
    });

  // Corner resizing gesture
  const createCornerGesture = (isLeft: boolean, isTop: boolean) => {
    return Gesture.Pan()
      .onChange((e) => {
        if (!imageLayout || imageLayout.width === 0 || imageLayout.height === 0) return;
        const dx = e.changeX / imageLayout.width;
        const dy = e.changeY / imageLayout.height;

        let curX = normX.value;
        let curY = normY.value;
        let curW = normW.value;
        let curH = normH.value;

        if (isLeft) {
          const newW = Math.max(0.15, curW - dx);
          const actualDx = curW - newW;
          curX = Math.max(0, curX + actualDx);
          curW = newW;
        } else {
          curW = Math.max(0.15, Math.min(1 - curX, curW + dx));
        }

        if (isTop) {
          const newH = Math.max(0.15, curH - dy);
          const actualDy = curH - newH;
          curY = Math.max(0, curY + actualDy);
          curH = newH;
        } else {
          curH = Math.max(0.15, Math.min(1 - curY, curH + dy));
        }

        normX.value = curX;
        normY.value = curY;
        normW.value = curW;
        normH.value = curH;
      })
      .onEnd(() => {
        runOnJS(emitChange)();
      });
  };

  const styleBox = useAnimatedStyle(() => {
    if (!imageLayout) return {};
    return {
      left: imageLayout.x + normX.value * imageLayout.width,
      top: imageLayout.y + normY.value * imageLayout.height,
      width: normW.value * imageLayout.width,
      height: normH.value * imageLayout.height,
    };
  });

  if (!imageLayout) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.cropBox, styleBox]}>
        {/* Center Draggable Area (Rule of Thirds grid) */}
        <GestureDetector gesture={centerPan}>
          <Animated.View style={styles.gridOverlay}>
            {/* Rule of thirds grid lines */}
            <View style={styles.gridRow}>
              <View style={[styles.gridLineV, { left: '33.33%' }]} />
              <View style={[styles.gridLineV, { left: '66.66%' }]} />
              <View style={[styles.gridLineH, { top: '33.33%' }]} />
              <View style={[styles.gridLineH, { top: '66.66%' }]} />
            </View>
          </Animated.View>
        </GestureDetector>

        {/* 4 Corner Touch Handles */}
        <GestureDetector gesture={createCornerGesture(true, true)}>
          <Animated.View style={[styles.cornerHitArea, styles.topLeft]}>
            <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={createCornerGesture(false, true)}>
          <Animated.View style={[styles.cornerHitArea, styles.topRight]}>
            <View style={[styles.cornerBracket, styles.bracketTopRight]} />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={createCornerGesture(true, false)}>
          <Animated.View style={[styles.cornerHitArea, styles.bottomLeft]}>
            <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={createCornerGesture(false, false)}>
          <Animated.View style={[styles.cornerHitArea, styles.bottomRight]}>
            <View style={[styles.cornerBracket, styles.bracketBottomRight]} />
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const CORNER_TOUCH = 44;
const BRACKET_SIZE = 18;
const BRACKET_THICKNESS = 3;

const styles = StyleSheet.create({
  cropBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill as any,
  },
  gridRow: {
    ...StyleSheet.absoluteFill as any,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  cornerHitArea: {
    position: 'absolute',
    width: CORNER_TOUCH,
    height: CORNER_TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  topLeft: {
    top: -CORNER_TOUCH / 2,
    left: -CORNER_TOUCH / 2,
  },
  topRight: {
    top: -CORNER_TOUCH / 2,
    right: -CORNER_TOUCH / 2,
  },
  bottomLeft: {
    bottom: -CORNER_TOUCH / 2,
    left: -CORNER_TOUCH / 2,
  },
  bottomRight: {
    bottom: -CORNER_TOUCH / 2,
    right: -CORNER_TOUCH / 2,
  },
  cornerBracket: {
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
    borderColor: '#FFFFFF',
  },
  bracketTopLeft: {
    borderTopWidth: BRACKET_THICKNESS,
    borderLeftWidth: BRACKET_THICKNESS,
  },
  bracketTopRight: {
    borderTopWidth: BRACKET_THICKNESS,
    borderRightWidth: BRACKET_THICKNESS,
  },
  bracketBottomLeft: {
    borderBottomWidth: BRACKET_THICKNESS,
    borderLeftWidth: BRACKET_THICKNESS,
  },
  bracketBottomRight: {
    borderBottomWidth: BRACKET_THICKNESS,
    borderRightWidth: BRACKET_THICKNESS,
  },
});
