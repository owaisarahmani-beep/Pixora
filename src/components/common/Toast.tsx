/**
 * Pixora Toast — lightweight transient notification component.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast({ message: 'Archived', type: 'success' });
 *   // Or statically:
 *   toastController.show({ message: 'Saved', type: 'success' });
 */

import React, { useEffect, useRef } from 'react';
import {
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  /** Duration in ms before auto-dismiss. Default 2800. */
  duration?: number;
}

export interface ActiveToast extends ToastOptions {
  id: number;
}

interface ToastStoreState {
  currentToast: ActiveToast | null;
  show: (opts: ToastOptions) => void;
  dismiss: () => void;
}

let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let currentId = 0;

export const useToastStore = create<ToastStoreState>((set) => ({
  currentToast: null,
  show: (opts: ToastOptions) => {
    if (dismissTimer) clearTimeout(dismissTimer);
    const id = ++currentId;
    const duration = opts.duration ?? 2800;
    set({ currentToast: { ...opts, type: opts.type ?? 'info', id } });
    dismissTimer = setTimeout(() => {
      set({ currentToast: null });
    }, duration);
    (dismissTimer as any)?.unref?.();
  },
  dismiss: () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    set({ currentToast: null });
  },
}));

export const toastController = {
  show: (opts: ToastOptions) => useToastStore.getState().show(opts),
  dismiss: () => useToastStore.getState().dismiss(),
};

/** Convenience hook for components */
export function useToast() {
  return {
    showToast: toastController.show,
    dismissToast: toastController.dismiss,
  };
}

// ---------------------------------------------------------------------------
// Toast UI component
// ---------------------------------------------------------------------------
const ICON: Record<ToastType, React.ComponentProps<typeof Ionicons>['name']> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const COLOR: Record<ToastType, string> = {
  success: '#10B981',
  error: '#EF4444',
  info: '#6B7280',
};

export function ToastProvider() {
  const insets = useSafeAreaInsets();
  const toast = useToastStore(state => state.currentToast);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  // Animate in/out when toast changes
  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 16, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [toast, opacity, translateY]);

  if (!toast) return null;

  const type = toast.type ?? 'info';
  const color = COLOR[type];
  const icon = ICON[type];
  const bottomOffset = Math.max(insets.bottom, 12) + 72; // 72 ≈ tab bar height

  return (
    <Animated.View
      testID="toast-pill"
      style={[
        styles.pill,
        {
          bottom: bottomOffset,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.message} numberOfLines={2}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(28, 28, 30, 0.94)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 9999,
    elevation: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  message: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
});
