import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Pressable, Platform } from 'react-native';
import { usePrivacyStore, LockPolicy } from '../../store/usePrivacyStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacySettingsScreen() {
  const theme = useTheme();
  const { 
    isAppLockEnabled, 
    lockPolicy,
    isSupportedOnDevice,
    enableAppLock, 
    disableAppLock,
    setLockPolicy,
    privateAssetIds,
    hiddenAlbumIds,
    hiddenAssetIds
  } = usePrivacyStore();

  const toggleAppLock = async (value: boolean) => {
    if (value) {
      await enableAppLock(lockPolicy || 'immediate');
    } else {
      await disableAppLock();
    }
  };

  const handleSelectPolicy = async (policy: LockPolicy) => {
    await setLockPolicy(policy);
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Privacy & Security',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }} 
      />
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Security Status Hero Card */}
        <View style={[
          styles.heroCard, 
          { 
            backgroundColor: theme.surface,
            borderColor: isAppLockEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)' 
          }
        ]}>
          <View style={styles.heroHeader}>
            <View style={[
              styles.shieldBadge, 
              { 
                backgroundColor: isAppLockEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                borderColor: isAppLockEnabled ? '#10B981' : '#F59E0B'
              }
            ]}>
              <Ionicons 
                name={isAppLockEnabled ? 'shield-checkmark' : 'shield-outline'} 
                size={32} 
                color={isAppLockEnabled ? '#10B981' : '#F59E0B'} 
              />
            </View>
            <View style={styles.heroText}>
              <View style={styles.heroTitleRow}>
                <Text style={[styles.heroTitle, { color: theme.text }]}>
                  {isAppLockEnabled ? 'Pixora Shield Active' : 'App Lock Disabled'}
                </Text>
                <View style={[
                  styles.statusBadge, 
                  { backgroundColor: isAppLockEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)' }
                ]}>
                  <Text style={[
                    styles.statusBadgeText, 
                    { color: isAppLockEnabled ? '#10B981' : '#F59E0B' }
                  ]}>
                    {isAppLockEnabled ? 'SECURED' : 'UNLOCKED'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.heroDescription, { color: theme.textMuted }]}>
                {isAppLockEnabled 
                  ? 'Your gallery, private vault, and hidden media are protected with biometric authentication.'
                  : 'Enable biometric lock to require fingerprint, Face ID, or device PIN when opening Pixora.'
                }
              </Text>
            </View>
          </View>

          {/* Biometric Capability Chip */}
          <View style={[styles.capabilityChip, { backgroundColor: theme.background }]}>
            <Ionicons 
              name={isSupportedOnDevice ? 'finger-print' : 'alert-circle-outline'} 
              size={18} 
              color={isSupportedOnDevice ? theme.accent : '#F43F5E'} 
            />
            <Text style={[styles.capabilityText, { color: theme.textMuted }]}>
              {isSupportedOnDevice 
                ? 'Device biometrics & hardware PIN ready' 
                : 'Authentication hardware not detected on this device'}
            </Text>
          </View>
        </View>

        {/* SECTION 1: App Lock Controls */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>APP AUTHENTICATION</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
            {/* Toggle Switch Row */}
            <View style={styles.switchRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#06B6D420' }]}>
                <Ionicons name="finger-print-outline" size={20} color="#06B6D4" />
              </View>
              <View style={styles.rowTextContainer}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Require Biometrics / PIN</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Prompt authentication upon launch or resuming
                </Text>
              </View>
              <Switch
                value={isAppLockEnabled}
                onValueChange={toggleAppLock}
                disabled={!isSupportedOnDevice}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.accent }}
                thumbColor={isAppLockEnabled ? '#FFFFFF' : '#94A3B8'}
              />
            </View>

            {/* Lock Policy Options (Visible when enabled) */}
            {isAppLockEnabled && (
              <>
                <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
                <View style={styles.policyContainer}>
                  <Text style={[styles.policyHeader, { color: theme.textMuted }]}>AUTO-LOCK TIMEOUT</Text>
                  <View style={styles.policyRow}>
                    <Pressable
                      style={[
                        styles.policyOption,
                        lockPolicy === 'immediate' && { backgroundColor: theme.accent + '25', borderColor: theme.accent }
                      ]}
                      onPress={() => handleSelectPolicy('immediate')}
                    >
                      <Ionicons 
                        name={lockPolicy === 'immediate' ? 'radio-button-on' : 'radio-button-off'} 
                        size={16} 
                        color={lockPolicy === 'immediate' ? theme.accent : theme.textMuted} 
                      />
                      <View style={styles.policyTextWrapper}>
                        <Text style={[
                          styles.policyTitle, 
                          { color: lockPolicy === 'immediate' ? theme.accent : theme.text }
                        ]}>
                          Immediately
                        </Text>
                        <Text style={[styles.policySubtitle, { color: theme.textMuted }]}>
                          Lock on app switch
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.policyOption,
                        lockPolicy === 'inactivity' && { backgroundColor: theme.accent + '25', borderColor: theme.accent }
                      ]}
                      onPress={() => handleSelectPolicy('inactivity')}
                    >
                      <Ionicons 
                        name={lockPolicy === 'inactivity' ? 'radio-button-on' : 'radio-button-off'} 
                        size={16} 
                        color={lockPolicy === 'inactivity' ? theme.accent : theme.textMuted} 
                      />
                      <View style={styles.policyTextWrapper}>
                        <Text style={[
                          styles.policyTitle, 
                          { color: lockPolicy === 'inactivity' ? theme.accent : theme.text }
                        ]}>
                          1 Min Inactivity
                        </Text>
                        <Text style={[styles.policySubtitle, { color: theme.textMuted }]}>
                          Multitasking grace
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* SECTION 2: Private Vault */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>ZERO-EXPOSURE VAULT</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
            <Pressable 
              style={({ pressed }) => [styles.linkRow, pressed && styles.rowPressed]}
              onPress={() => router.push('/settings/private-vault')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#6366F120' }]}>
                <Ionicons name="lock-closed" size={20} color="#818CF8" />
              </View>
              <View style={styles.rowTextContainer}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Private Vault</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Quarantined photos & videos requiring biometric access
                </Text>
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.counterPill, { backgroundColor: '#6366F120' }]}>
                  <Text style={[styles.counterPillText, { color: '#818CF8' }]}>
                    {privateAssetIds.length} {privateAssetIds.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </Pressable>
          </View>
          <Text style={[styles.footnote, { color: theme.textMuted }]}>
            Files in the Private Vault are strictly hidden from gallery grids, album counts, and search indexing.
          </Text>
        </View>

        {/* SECTION 3: Hidden Content */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>HIDDEN CONTENT</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
            {/* Hidden Photos */}
            <Pressable 
              style={({ pressed }) => [styles.linkRow, pressed && styles.rowPressed]}
              onPress={() => router.push('/settings/hidden-media')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#A855F720' }]}>
                <Ionicons name="images-outline" size={20} color="#C084FC" />
              </View>
              <View style={styles.rowTextContainer}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Hidden Photos & Videos</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Individual media hidden from main browsing
                </Text>
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.counterPill, { backgroundColor: '#A855F720' }]}>
                  <Text style={[styles.counterPillText, { color: '#C084FC' }]}>
                    {hiddenAssetIds.length}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </Pressable>

            <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />

            {/* Hidden Albums */}
            <Pressable 
              style={({ pressed }) => [styles.linkRow, pressed && styles.rowPressed]}
              onPress={() => router.push('/settings/hidden-albums')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#EC489920' }]}>
                <Ionicons name="folder-outline" size={20} color="#F472B6" />
              </View>
              <View style={styles.rowTextContainer}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Hidden Albums</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Entire folders excluded from album lists
                </Text>
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.counterPill, { backgroundColor: '#EC489920' }]}>
                  <Text style={[styles.counterPillText, { color: '#F472B6' }]}>
                    {hiddenAlbumIds.length}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* SECTION 4: Architecture & Trust Guarantee */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>HOW PIXORA PROTECTS YOU</Text>
          <View style={[styles.guaranteeBox, { backgroundColor: theme.surface }]}>
            <View style={styles.guaranteeItem}>
              <View style={[styles.guaranteeIconBadge, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="cloud-offline-outline" size={20} color="#10B981" />
              </View>
              <View style={styles.guaranteeText}>
                <Text style={[styles.guaranteeTitle, { color: theme.text }]}>100% On-Device Storage</Text>
                <Text style={[styles.guaranteeDesc, { color: theme.textMuted }]}>
                  No cloud backups or external servers. Your photos and metadata never leave your phone.
                </Text>
              </View>
            </View>

            <View style={[styles.guaranteeDivider, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />

            <View style={styles.guaranteeItem}>
              <View style={[styles.guaranteeIconBadge, { backgroundColor: '#06B6D420' }]}>
                <Ionicons name="hardware-chip-outline" size={20} color="#06B6D4" />
              </View>
              <View style={styles.guaranteeText}>
                <Text style={[styles.guaranteeTitle, { color: theme.text }]}>Hardware Keystore</Text>
                <Text style={[styles.guaranteeDesc, { color: theme.textMuted }]}>
                  Authentication keys and lock states leverage Android Keystore / iOS Secure Enclave.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  shieldBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 14,
  },
  heroText: {
    flex: 1,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  capabilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  capabilityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  rowTextContainer: {
    flex: 1,
    marginRight: 12,
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
  counterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  policyContainer: {
    padding: 16,
    paddingTop: 12,
  },
  policyHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  policyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  policyOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  policyTextWrapper: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  policySubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  separator: {
    height: 1,
    marginLeft: 68,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
    marginLeft: 6,
  },
  guaranteeBox: {
    borderRadius: 18,
    padding: 16,
  },
  guaranteeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  guaranteeIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  guaranteeText: {
    flex: 1,
  },
  guaranteeTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  guaranteeDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  guaranteeDivider: {
    height: 1,
    marginVertical: 14,
    marginLeft: 48,
  },
});
