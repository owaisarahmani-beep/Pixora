import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Pressable } from 'react-native';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacySettingsScreen() {
  const theme = useTheme();
  const { 
    isAppLockEnabled, 
    isSupportedOnDevice,
    enableAppLock, 
    disableAppLock,
    hiddenAlbumIds
  } = usePrivacyStore();

  const toggleAppLock = async (value: boolean) => {
    if (value) {
      await enableAppLock('immediate');
    } else {
      await disableAppLock();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Privacy Settings' }} />
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
        
        {/* App Lock Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.accent }]}>App Lock</Text>
          <Text style={[styles.description, { color: theme.textMuted }]}>
            Require authentication when Pixora starts or returns from the background. 
            This does not encrypt your media files.
          </Text>
          
          <View style={[styles.row, { backgroundColor: theme.surface }]}>
            <View style={styles.rowTextContainer}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Enable App Lock</Text>
              {!isSupportedOnDevice && (
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                  Not supported on this device.
                </Text>
              )}
            </View>
            <Switch
              value={isAppLockEnabled}
              onValueChange={toggleAppLock}
              disabled={!isSupportedOnDevice}
              trackColor={{ false: '#333333', true: theme.accent }}
              thumbColor="#FFF"
            />
          </View>
        </View>

        {/* Hidden Media Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.accent }]}>Hidden Media</Text>
          <Text style={[styles.description, { color: theme.textMuted }]}>
            Photos and albums hidden here will not appear in the normal Pixora gallery, search, or favorites.
            The files are NOT encrypted or hidden from other apps.
          </Text>
          
          <Link href="/settings/hidden-media" asChild>
            <Pressable style={[styles.linkRow, { backgroundColor: theme.surface }]}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Manage Hidden Media</Text>
              <View style={styles.badgeContainer}>
                <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
              </View>
            </Pressable>
          </Link>
        </View>
        
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  rowTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  rowTitle: {
    fontSize: 16,
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  }
});
