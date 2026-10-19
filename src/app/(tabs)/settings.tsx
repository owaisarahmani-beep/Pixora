import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useTrashStore } from '../../store/useTrashStore';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { isAppLockEnabled, privateAssetIds, hiddenAlbumIds, hiddenAssetIds, archivedAssetIds } = usePrivacyStore();
  const media = useMediaStore(state => state.media);
  const permissionStatus = useMediaStore(state => state.permissionStatus);
  const trashCount = useTrashStore(state => state.items.length);

  const hiddenTotalCount = hiddenAlbumIds.length + hiddenAssetIds.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Hero App Branding Card */}
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: 'rgba(255,255,255,0.06)' }]}>
          <View style={styles.heroLeft}>
            <View style={[styles.heroIconBadge, { backgroundColor: theme.accent + '20', borderColor: theme.accent + '40' }]}>
              <Ionicons name="sparkles" size={28} color={theme.accent} />
            </View>
            <View style={styles.heroTextContainer}>
              <View style={styles.heroTitleRow}>
                <Text style={[styles.heroTitle, { color: theme.text }]}>Pixora Gallery</Text>
                <View style={[styles.proBadge, { backgroundColor: theme.accent + '25' }]}>
                  <Text style={[styles.proBadgeText, { color: theme.accent }]}>v1.0</Text>
                </View>
              </View>
              <Text style={[styles.heroSubtitle, { color: theme.textMuted }]}>
                Private • Fast • Zero Cloud Telemetry
              </Text>
            </View>
          </View>

          {/* Quick Metrics Capsule Bar */}
          <View style={[styles.metricsBar, { backgroundColor: theme.background, borderColor: 'rgba(255,255,255,0.05)' }]}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: theme.text }]}>{media.length}</Text>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Photos</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: isAppLockEnabled ? '#10B981' : theme.accent }]}>
                {privateAssetIds.length}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Vault</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: '#F59E0B' }]}>{hiddenTotalCount}</Text>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Hidden</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: '#F43F5E' }]}>{trashCount}</Text>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Trash</Text>
            </View>
          </View>
        </View>

        {/* SECTION: Privacy & Security */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>SECURITY & PRIVACY</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
            {/* Privacy Center */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/settings/privacy')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#06B6D420' }]}>
                <Ionicons name="shield-checkmark" size={20} color="#06B6D4" />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Privacy & App Lock</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Biometric lock, inactivity timeout & safeguards
                </Text>
              </View>
              <View style={styles.rowRight}>
                <View style={[
                  styles.statusPill, 
                  { backgroundColor: isAppLockEnabled ? '#10B98120' : 'rgba(255,255,255,0.08)' }
                ]}>
                  <Text style={[
                    styles.statusPillText, 
                    { color: isAppLockEnabled ? '#10B981' : theme.textMuted }
                  ]}>
                    {isAppLockEnabled ? 'Active' : 'Off'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </Pressable>

            <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />

            {/* Private Vault */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/settings/private-vault')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#6366F120' }]}>
                <Ionicons name="lock-closed" size={20} color="#818CF8" />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Private Vault</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Encrypted personal media space
                </Text>
              </View>
              <View style={styles.rowRight}>
                {privateAssetIds.length > 0 && (
                  <View style={[styles.counterBadge, { backgroundColor: '#6366F120' }]}>
                    <Text style={[styles.counterText, { color: '#818CF8' }]}>{privateAssetIds.length}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </Pressable>

            <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />

            {/* Hidden Media */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/settings/hidden-media')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#A855F720' }]}>
                <Ionicons name="eye-off" size={20} color="#C084FC" />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Hidden Media & Albums</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Manage hidden photos and folders
                </Text>
              </View>
              <View style={styles.rowRight}>
                {hiddenTotalCount > 0 && (
                  <View style={[styles.counterBadge, { backgroundColor: '#A855F720' }]}>
                    <Text style={[styles.counterText, { color: '#C084FC' }]}>{hiddenTotalCount}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* SECTION: Storage & Utilities */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>STORAGE & UTILITIES</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
            {/* Storage Cleaner */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/storage')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="server-outline" size={20} color="#34D399" />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Storage Cleaner</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Find videos &gt; 500 MB & free up space
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </Pressable>

            <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />

            {/* Slideshow */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push({ pathname: '/slideshow', params: { source: 'all' } })}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="play-circle-outline" size={20} color="#FBBF24" />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Slideshow Player</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Auto-advance through your memories
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </Pressable>

            <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />

            {/* Recently Deleted */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/trash')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#F43F5E20' }]}>
                <Ionicons name="trash-outline" size={20} color="#FB7185" />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Recently Deleted</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  30-day trash protection
                </Text>
              </View>
              <View style={styles.rowRight}>
                {trashCount > 0 && (
                  <View style={[styles.counterBadge, { backgroundColor: '#F43F5E20' }]}>
                    <Text style={[styles.counterText, { color: '#FB7185' }]}>{trashCount}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </Pressable>

            <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />

            {/* Archive */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push('/archive')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#0EA5E920' }]}>
                <Ionicons name="archive-outline" size={20} color="#38BDF8" />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Archive</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Organize away from main timeline
                </Text>
              </View>
              <View style={styles.rowRight}>
                {archivedAssetIds.length > 0 && (
                  <View style={[styles.counterBadge, { backgroundColor: '#0EA5E920' }]}>
                    <Text style={[styles.counterText, { color: '#38BDF8' }]}>{archivedAssetIds.length}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* SECTION: Preferences & System */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>SYSTEM & ABOUT</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
            {/* Theme */}
            <View style={styles.row}>
              <View style={[styles.iconContainer, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="moon-outline" size={20} color="#A78BFA" />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Appearance</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  OLED Deep Dark
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Text style={[styles.statusPillText, { color: theme.accent }]}>Dark</Text>
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />

            {/* Media Permissions */}
            <View style={styles.row}>
              <View style={[styles.iconContainer, { backgroundColor: '#14B8A620' }]}>
                <Ionicons name="key-outline" size={20} color="#2DD4BF" />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Media Permissions</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Android MediaStore Access
                </Text>
              </View>
              <View style={[
                styles.statusPill, 
                { backgroundColor: permissionStatus === 'GRANTED' ? '#10B98120' : 'rgba(255,255,255,0.08)' }
              ]}>
                <Text style={[
                  styles.statusPillText, 
                  { color: permissionStatus === 'GRANTED' ? '#10B981' : theme.accent }
                ]}>
                  {permissionStatus === 'GRANTED' ? 'Granted' : permissionStatus}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer Guarantee */}
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.textMuted} style={styles.footerIcon} />
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Pixora operates completely offline. No tracking, no cloud sync, your media remains 100% on your device.
          </Text>
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
    paddingBottom: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 14,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroSubtitle: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '400',
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  metricDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  cardGroup: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  counterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    marginLeft: 68,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  footerIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
