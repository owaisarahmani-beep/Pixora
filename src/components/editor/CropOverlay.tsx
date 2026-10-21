import React, { useEffect } from 'react';
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
  // Normalized coordinates (0 to 1) relative to rendered image.
  // Defaults to 0, 0, 1, 1 so the crop box starts directly at the photo's 4 outer corners!
  const normX = useSharedValue(initialCrop?.originX ?? 0);
  const normY = useSharedValue(initialCrop?.originY ?? 0);
  const normW = useSharedValue(initialCrop?.width ?? 1);
  const normH = useSharedValue(initialCrop?.height ?? 1);

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

  // Edge resizing gestures (Top, Bottom, Left, Right)
  const topEdgeGesture = Gesture.Pan()
    .onChange((e) => {
      if (!imageLayout || imageLayout.height === 0) return;
      const dy = e.changeY / imageLayout.height;
      const newH = Math.max(0.15, normH.value - dy);
      const actualDy = normH.value - newH;
      normY.value = Math.max(0, normY.value + actualDy);
      normH.value = newH;
    })
    .onEnd(() => runOnJS(emitChange)());

  const bottomEdgeGesture = Gesture.Pan()
    .onChange((e) => {
      if (!imageLayout || imageLayout.height === 0) return;
      const dy = e.changeY / imageLayout.height;
      normH.value = Math.max(0.15, Math.min(1 - normY.value, normH.value + dy));
    })
    .onEnd(() => runOnJS(emitChange)());

  const leftEdgeGesture = Gesture.Pan()
    .onChange((e) => {
      if (!imageLayout || imageLayout.width === 0) return;
      const dx = e.changeX / imageLayout.width;
      const newW = Math.max(0.15, normW.value - dx);
      const actualDx = normW.value - newW;
      normX.value = Math.max(0, normX.value + actualDx);
      normW.value = newW;
    })
    .onEnd(() => runOnJS(emitChange)());

  const rightEdgeGesture = Gesture.Pan()
    .onChange((e) => {
      if (!imageLayout || imageLayout.width === 0) return;
      const dx = e.changeX / imageLayout.width;
      normW.value = Math.max(0.15, Math.min(1 - normX.value, normW.value + dx));
    })
    .onEnd(() => runOnJS(emitChange)());

  // Synchronize when initialCrop changes (e.g. aspect ratio chips selected or reset)
  useEffect(() => {
    if (initialCrop) {
      normX.value = initialCrop.originX;
      normY.value = initialCrop.originY;
      normW.value = initialCrop.width;
      normH.value = initialCrop.height;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCrop]);

  const styleBox = useAnimatedStyle(() => {
    if (!imageLayout) return {};
    return {
      left: imageLayout.x + normX.value * imageLayout.width,
      top: imageLayout.y + normY.value * imageLayout.height,
      width: normW.value * imageLayout.width,
      height: normH.value * imageLayout.height,
    };
  });

  // Dimming masks for outside area
  const styleTopMask = useAnimatedStyle(() => {
    if (!imageLayout) return {};
    return {
      top: imageLayout.y,
      left: imageLayout.x,
      width: imageLayout.width,
      height: Math.max(0, normY.value * imageLayout.height),
    };
  });

  const styleBottomMask = useAnimatedStyle(() => {
    if (!imageLayout) return {};
    const topPos = imageLayout.y + (normY.value + normH.value) * imageLayout.height;
    return {
      top: topPos,
      left: imageLayout.x,
      width: imageLayout.width,
      height: Math.max(0, (imageLayout.y + imageLayout.height) - topPos),
    };
  });

  const styleLeftMask = useAnimatedStyle(() => {
    if (!imageLayout) return {};
    return {
      top: imageLayout.y + normY.value * imageLayout.height,
      left: imageLayout.x,
      width: Math.max(0, normX.value * imageLayout.width),
      height: normH.value * imageLayout.height,
    };
  });

  const styleRightMask = useAnimatedStyle(() => {
    if (!imageLayout) return {};
    const leftPos = imageLayout.x + (normX.value + normW.value) * imageLayout.width;
    return {
      top: imageLayout.y + normY.value * imageLayout.height,
      left: leftPos,
      width: Math.max(0, (imageLayout.x + imageLayout.width) - leftPos),
      height: normH.value * imageLayout.height,
    };
  });

  if (!imageLayout) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 4 Dimmed Masks Outside the Crop Boundary */}
      <Animated.View style={[styles.dimMask, styleTopMask]} pointerEvents="none" />
      <Animated.View style={[styles.dimMask, styleBottomMask]} pointerEvents="none" />
      <Animated.View style={[styles.dimMask, styleLeftMask]} pointerEvents="none" />
      <Animated.View style={[styles.dimMask, styleRightMask]} pointerEvents="none" />

      {/* The Active Crop Box */}
      <Animated.View style={[styles.cropBox, styleBox]}>
        {/* Center Draggable Area (Rule of Thirds grid) */}
        <GestureDetector gesture={centerPan}>
          <Animated.View style={styles.gridOverlay}>
            <View style={styles.gridRow}>
              <View style={[styles.gridLineV, { left: '33.33%' }]} />
              <View style={[styles.gridLineV, { left: '66.66%' }]} />
              <View style={[styles.gridLineH, { top: '33.33%' }]} />
              <View style={[styles.gridLineH, { top: '66.66%' }]} />
            </View>
          </Animated.View>
        </GestureDetector>

        {/* 4 Edge Hit Handles */}
        <GestureDetector gesture={topEdgeGesture}>
          <Animated.View style={styles.edgeTop}>
            <View style={styles.edgeBarH} />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={bottomEdgeGesture}>
          <Animated.View style={styles.edgeBottom}>
            <View style={styles.edgeBarH} />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={leftEdgeGesture}>
          <Animated.View style={styles.edgeLeft}>
            <View style={styles.edgeBarV} />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={rightEdgeGesture}>
          <Animated.View style={styles.edgeRight}>
            <View style={styles.edgeBarV} />
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

const CORNER_TOUCH = 48;
const BRACKET_SIZE = 22;
const BRACKET_THICKNESS = 3.5;

const styles = StyleSheet.create({
  dimMask: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
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
    width: 0.75,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.75,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  cornerHitArea: {
    position: 'absolute',
    width: CORNER_TOUCH,
    height: CORNER_TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  topLeft: {
    top: -BRACKET_THICKNESS,
    left: -BRACKET_THICKNESS,
  },
  topRight: {
    top: -BRACKET_THICKNESS,
    right: -BRACKET_THICKNESS,
  },
  bottomLeft: {
    bottom: -BRACKET_THICKNESS,
    left: -BRACKET_THICKNESS,
  },
  bottomRight: {
    bottom: -BRACKET_THICKNESS,
    right: -BRACKET_THICKNESS,
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
  edgeTop: {
    position: 'absolute',
    top: -15,
    left: 0,
    right: 0,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  edgeBottom: {
    position: 'absolute',
    bottom: -15,
    left: 0,
    right: 0,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  edgeLeft: {
    position: 'absolute',
    left: -15,
    top: 0,
    bottom: 0,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  edgeRight: {
    position: 'absolute',
    right: -15,
    top: 0,
    bottom: 0,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  edgeBarH: {
    width: 36,
    height: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  edgeBarV: {
    width: 3,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
});
