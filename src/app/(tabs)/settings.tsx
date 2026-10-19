import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme, ThemePreference } from '../../theme/ThemeProvider';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useTrashStore } from '../../store/useTrashStore';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { isAppLockEnabled, privateAssetIds, hiddenAlbumIds, hiddenAssetIds, archivedAssetIds } = usePrivacyStore();
  const trashCount = useTrashStore(state => state.items.length);
  const hiddenTotalCount = hiddenAlbumIds.length + hiddenAssetIds.length;

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
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
                        { backgroundColor: theme.card, borderColor: theme.border }
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
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
              </View>
              <View style={styles.rowEnd}>
                <Text style={[styles.statusHint, { color: isAppLockEnabled ? '#10B981' : theme.textMuted }]}>
                  {isAppLockEnabled ? 'On' : 'Off'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Private Vault */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/settings/private-vault')}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
                <Ionicons name="lock-closed-outline" size={19} color={theme.text} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Private Vault</Text>
              </View>
              <View style={styles.rowEnd}>
                {privateAssetIds.length > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: theme.card }]}>
                    <Text style={[styles.countText, { color: theme.textMuted }]}>{privateAssetIds.length}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Hidden Content */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/settings/hidden-media')}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
                <Ionicons name="eye-off-outline" size={19} color={theme.text} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Hidden Media & Albums</Text>
              </View>
              <View style={styles.rowEnd}>
                {hiddenTotalCount > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: theme.card }]}>
                    <Text style={[styles.countText, { color: theme.textMuted }]}>{hiddenTotalCount}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* SECTION: Library & Storage */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>LIBRARY & STORAGE</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
                <Text style={[styles.rowSublabel, { color: theme.textMuted }]}>Clean &gt; 500 MB videos & junk</Text>
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

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Slideshow */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push({ pathname: '/slideshow', params: { source: 'all' } })}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
                <Ionicons name="play-outline" size={19} color={theme.text} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Slideshow</Text>
              </View>
              <View style={styles.rowEnd}>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            </Pressable>
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
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 6,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  themeSelectorContainer: {
    flexDirection: 'row',
    padding: 6,
    gap: 6,
  },
  themeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  themeOptionBtnActive: {
    borderWidth: 1,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
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
    fontSize: 14,
    fontWeight: '500',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
});
