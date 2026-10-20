import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

interface EmptyStateViewProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyStateView({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateViewProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Sleek Minimalist Icon Squircle */}
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          },
        ]}
      >
        <Ionicons name={icon} size={32} color={theme.textMuted} />
      </View>

      {/* Typography */}
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>
      ) : null}

      {/* Optional Pill Action Button */}
      {actionLabel && onAction && (
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
              borderColor: theme.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          onPress={onAction}
        >
          <Text style={[styles.actionButtonText, { color: theme.text }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingVertical: 48,
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 20,
    fontWeight: '400',
  },
  actionButton: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
