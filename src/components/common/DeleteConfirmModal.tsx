import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

interface DeleteConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Move to Trash',
  cancelText = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: theme.isDark ? '#1C1C1E' : '#FFFFFF',
                  borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
            >
              {/* Top Grab Handle */}
              <View
                style={[
                  styles.handle,
                  { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)' },
                ]}
              />

              {/* Icon & Title */}
              <View style={styles.header}>
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: isDestructive
                        ? theme.isDark
                          ? 'rgba(239,68,68,0.15)'
                          : 'rgba(239,68,68,0.1)'
                        : theme.accent + '15',
                    },
                  ]}
                >
                  <Ionicons
                    name={isDestructive ? 'trash' : 'alert-circle'}
                    size={24}
                    color={isDestructive ? '#EF4444' : theme.accent}
                  />
                </View>

                <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                {message ? (
                  <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>
                ) : null}
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: isDestructive ? '#DC2626' : theme.accent,
                      opacity: pressed ? 0.88 : 1,
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                    },
                  ]}
                  onPress={onConfirm}
                >
                  <Text style={styles.primaryBtnText}>{confirmText}</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    {
                      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      opacity: pressed ? 0.75 : 1,
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                    },
                  ]}
                  onPress={onCancel}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.text }]}>{cancelText}</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '400',
  },
  actions: {
    gap: 10,
    width: '100%',
  },
  primaryBtn: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cancelBtn: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
