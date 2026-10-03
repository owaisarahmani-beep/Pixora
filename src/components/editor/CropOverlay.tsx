import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';

interface CropOverlayProps {
  imageLayout: { width: number; height: number; x: number; y: number } | null;
  initialCrop?: { originX: number; originY: number; width: number; height: number } | null;
  onCropChange: (crop: { originX: number; originY: number; width: number; height: number }) => void;
}

export default function CropOverlay({ imageLayout, initialCrop, onCropChange }: CropOverlayProps) {
  // Normalized values (0 to 1)
  const normX = useSharedValue(initialCrop?.originX ?? 0);
  const normY = useSharedValue(initialCrop?.originY ?? 0);
  const normW = useSharedValue(initialCrop?.width ?? 1);
  const normH = useSharedValue(initialCrop?.height ?? 1);

  // We need to map normalized values back to JS side on end
  const emitChange = () => {
    onCropChange({
      originX: normX.value,
      originY: normY.value,
      width: normW.value,
      height: normH.value,
    });
  };

  const createCornerGesture = (isLeft: boolean, isTop: boolean) => {
    return Gesture.Pan()
      .onChange((e) => {
        if (!imageLayout) return;
        // Delta in normalized space
        const dx = e.changeX / imageLayout.width;
        const dy = e.changeY / imageLayout.height;

        let newX = normX.value;
        let newY = normY.value;
        let newW = normW.value;
        let newH = normH.value;

        if (isLeft) {
          const deltaX = Math.min(dx, normW.value - 0.1); // min width 10%
          newX += deltaX;
          newW -= deltaX;
        } else {
          newW = Math.max(0.1, Math.min(normW.value + dx, 1 - normX.value));
        }

        if (isTop) {
          const deltaY = Math.min(dy, normH.value - 0.1); // min height 10%
          newY += deltaY;
          newH -= deltaY;
        } else {
          newH = Math.max(0.1, Math.min(normH.value + dy, 1 - normY.value));
        }

        // Clamp
        normX.value = Math.max(0, Math.min(newX, 1 - newW));
        normY.value = Math.max(0, Math.min(newY, 1 - newH));
        normW.value = newW;
        normH.value = newH;
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
        <GestureDetector gesture={createCornerGesture(true, true)}>
          <Animated.View style={[styles.corner, styles.topLeft]} />
        </GestureDetector>
        <GestureDetector gesture={createCornerGesture(false, true)}>
          <Animated.View style={[styles.corner, styles.topRight]} />
        </GestureDetector>
        <GestureDetector gesture={createCornerGesture(true, false)}>
          <Animated.View style={[styles.corner, styles.bottomLeft]} />
        </GestureDetector>
        <GestureDetector gesture={createCornerGesture(false, false)}>
          <Animated.View style={[styles.corner, styles.bottomRight]} />
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const CORNER_SIZE = 30;

const styles = StyleSheet.create({
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  topLeft: { top: -CORNER_SIZE/2, left: -CORNER_SIZE/2 },
  topRight: { top: -CORNER_SIZE/2, right: -CORNER_SIZE/2 },
  bottomLeft: { bottom: -CORNER_SIZE/2, left: -CORNER_SIZE/2 },
  bottomRight: { bottom: -CORNER_SIZE/2, right: -CORNER_SIZE/2 },
});
