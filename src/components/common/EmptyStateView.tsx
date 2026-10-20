import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

interface EmptyStateViewProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
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
      {/* Layered Icon Halo */}
      <View style={[styles.outerHalo, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.innerHalo, { backgroundColor: theme.accent + '15' }]}>
          <Ionicons name={icon} size={38} color={theme.accent} />
        </View>
      </View>

      {/* Typography */}
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>

      {/* Optional Action Button */}
      {actionLabel && onAction && (
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pressed && styles.actionButtonPressed,
          ]}
          onPress={onAction}
        >
          <Text style={[styles.actionButtonText, { color: theme.accent }]}>{actionLabel}</Text>
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
  outerHalo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  innerHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 290,
    marginBottom: 24,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionButtonPressed: {
    opacity: 0.75,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
