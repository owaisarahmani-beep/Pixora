import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Pressable } from 'react-native';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { toastController } from '../../components/common/Toast';

export default function PrivacySettingsScreen() {
  const theme = useTheme();
  const { 
    isAppLockEnabled, 
    lockPolicy,
    isSupportedOnDevice,
    enableAppLock, 
    disableAppLock,
    setLockPolicy
  } = usePrivacyStore();

  // Re-check hardware / PIN capability whenever privacy settings screen is focused
  useFocusEffect(
    useCallback(() => {
      usePrivacyStore.getState().initialize();
    }, [])
  );

  const toggleAppLock = async (value: boolean) => {
    if (!isSupportedOnDevice) {
      toastController.show({
        message: 'Screen lock required: Set up a PIN, pattern, or biometric in your device Settings to enable App Lock.',
        type: 'error',
      });
      return;
    }
    if (value) {
      const success = await enableAppLock(lockPolicy || 'immediate');
      if (success) {
        toastController.show({ message: 'App Lock enabled', type: 'success' });
      } else {
        toastController.show({ message: 'Authentication required to enable App Lock', type: 'error' });
      }
    } else {
      const success = await disableAppLock();
      if (success) {
        toastController.show({ message: 'App Lock disabled', type: 'success' });
      }
    }
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
        {/* App Lock & Authentication */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>AUTHENTICATION</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              style={styles.row}
              onPress={() => {
                if (!isSupportedOnDevice) {
                  toastController.show({
                    message: 'Screen lock required: Set up a PIN, pattern, or biometric in your device Settings to enable App Lock.',
                    type: 'error',
                  });
                } else {
                  toggleAppLock(!isAppLockEnabled);
                }
              }}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.isDark ? '#1E293B' : '#E2E8F0' }]}>
                <Ionicons name="finger-print-outline" size={19} color={theme.text} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Require Biometrics</Text>
                <Text style={[styles.rowSublabel, { color: theme.textMuted }]}>
                  {isSupportedOnDevice ? 'Fingerprint, Face ID or PIN' : 'Device lock not set up'}
                </Text>
              </View>
              <Switch
                value={isAppLockEnabled}
                onValueChange={toggleAppLock}
                disabled={!isSupportedOnDevice}
                trackColor={{ false: theme.card, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </Pressable>

            {isAppLockEnabled && (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.policyRow}>
                  <Text style={[styles.policyLabel, { color: theme.textMuted }]}>Auto-Lock Timeout</Text>
                  <View style={styles.policySegment}>
                    <Pressable
                      style={[
                        styles.segmentBtn,
                        lockPolicy === 'immediate' && [styles.segmentBtnActive, { backgroundColor: theme.card, borderColor: theme.border }]
                      ]}
                      onPress={() => setLockPolicy('immediate')}
                    >
                      <Text style={[
                        styles.segmentText,
                        { color: lockPolicy === 'immediate' ? theme.text : theme.textMuted }
                      ]}>
                        Immediate
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.segmentBtn,
                        lockPolicy === 'inactivity' && [styles.segmentBtnActive, { backgroundColor: theme.card, borderColor: theme.border }]
                      ]}
                      onPress={() => setLockPolicy('inactivity')}
                    >
                      <Text style={[
                        styles.segmentText,
                        { color: lockPolicy === 'inactivity' ? theme.text : theme.textMuted }
                      ]}>
                        1 Minute
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Private Vault (Zero counts shown for privacy) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>ENCRYPTED VAULT</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            </Pressable>
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
  section: {
    marginBottom: 24,
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
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  policyLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  policySegment: {
    flexDirection: 'row',
    gap: 4,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segmentBtnActive: {
    borderWidth: 1,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
