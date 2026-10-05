import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

import { useViewerStore } from '../../store/useViewerStore';

interface Props {
  children: React.ReactNode;
}

import { useWindowDimensions } from 'react-native';

export default function ZoomableView({ children }: Props) {
  const { width, height } = useWindowDimensions();
  const { isZoomed, setIsZoomed, toggleControls } = useViewerStore();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setIsZoomed)(false);
      } else {
        savedScale.value = scale.value;
        runOnJS(setIsZoomed)(true);
      }
    });

  const pan = Gesture.Pan()
    .enabled(isZoomed)
    .onUpdate((event) => {
      if (scale.value > 1) {
        const maxTx = (width * scale.value - width) / 2;
        const maxTy = (height * scale.value - height) / 2;
        
        let newTx = savedTranslateX.value + event.translationX;
        let newTy = savedTranslateY.value + event.translationY;
        
        newTx = Math.max(-maxTx, Math.min(newTx, maxTx));
        newTy = Math.max(-maxTy, Math.min(newTy, maxTy));
        
        translateX.value = newTx;
        translateY.value = newTy;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setIsZoomed)(false);
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
        runOnJS(setIsZoomed)(true);
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(toggleControls)();
    });

  const taps = Gesture.Exclusive(doubleTap, singleTap);

  // Pan and pinch can happen simultaneously, and taps can happen alongside them.
  const composed = Gesture.Simultaneous(Gesture.Simultaneous(pinch, pan), taps);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.container, { width, height }, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
