import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme, ThemePreference } from '../../theme/ThemeProvider';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useTrashStore } from '../../store/useTrashStore';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { isAppLockEnabled, archivedAssetIds } = usePrivacyStore();
  const trashCount = useTrashStore(state => state.items.length);

  const themeOptions: { label: string; value: ThemePreference; icon: any }[] = [
    { label: 'System', value: 'system', icon: 'phone-portrait-outline' },
    { label: 'Light', value: 'light', icon: 'sunny-outline' },
    { label: 'Dark', value: 'dark', icon: 'moon-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Refined Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
      >
        {/* SECTION: Appearance / Theme Selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.themeSelectorContainer}>
              {themeOptions.map((opt) => {
                const isActive = theme.themePreference === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.themeOptionBtn,
                      isActive && [
                        styles.themeOptionBtnActive,
                        { backgroundColor: theme.card }
                      ],
                    ]}
                    onPress={() => theme.setThemePreference(opt.value)}
                  >
                    <Ionicons 
                      name={opt.icon} 
                      size={18} 
                      color={isActive ? theme.accent : theme.textMuted} 
                    />
                    <Text style={[
                      styles.themeOptionText, 
                      { color: isActive ? theme.text : theme.textMuted }
                    ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* SECTION: Security */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>SECURITY</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {/* App Lock & Privacy */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/settings/privacy')}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
                <Ionicons name="shield-checkmark-outline" size={19} color={theme.text} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>App Lock & Biometrics</Text>
                <Text style={[styles.rowSublabel, { color: theme.textMuted }]}>Fingerprint, Face Unlock & PIN</Text>
              </View>
              <View style={styles.rowEnd}>
                <Text style={[styles.statusHint, { color: isAppLockEnabled ? '#10B981' : theme.textMuted }]}>
                  {isAppLockEnabled ? 'On' : 'Off'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* SECTION: Library & Storage */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>LIBRARY & STORAGE</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {/* Storage Cleaner */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/storage')}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
                <Ionicons name="sparkles-outline" size={19} color={theme.text} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Storage Cleaner</Text>
              </View>
              <View style={styles.rowEnd}>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Recently Deleted */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/trash')}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
                <Ionicons name="trash-outline" size={19} color={theme.text} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Recently Deleted</Text>
              </View>
              <View style={styles.rowEnd}>
                {trashCount > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: theme.card }]}>
                    <Text style={[styles.countText, { color: theme.textMuted }]}>{trashCount}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Archive */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/archive')}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
                <Ionicons name="archive-outline" size={19} color={theme.text} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Archive</Text>
              </View>
              <View style={styles.rowEnd}>
                {archivedAssetIds.length > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: theme.card }]}>
                    <Text style={[styles.countText, { color: theme.textMuted }]}>{archivedAssetIds.length}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* SECTION: Compact About */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>ABOUT</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.aboutRow}>
              <Image
                source={require('../../../assets/icon.png')}
                style={styles.aboutLogo}
                contentFit="cover"
              />
              <View style={styles.aboutBody}>
                <Text style={[styles.aboutName, { color: theme.text }]}>Pixora</Text>
                <Text style={[styles.aboutVersion, { color: theme.textMuted }]}>Version 1.0.0 • Offline & Private</Text>
              </View>
              <View style={[styles.privacyBadge, { backgroundColor: theme.card }]}>
                <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                <Text style={styles.privacyBadgeText}>Verified</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  themeSelectorContainer: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  themeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  themeOptionBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  rowSublabel: {
    fontSize: 12,
    marginTop: 2,
  },
  rowEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusHint: {
    fontSize: 13,
    fontWeight: '500',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 58,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  aboutLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 12,
  },
  aboutBody: {
    flex: 1,
  },
  aboutName: {
    fontSize: 14,
    fontWeight: '600',
  },
  aboutVersion: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  privacyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
});
