import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSecureScreen } from '../../hooks/useSecureScreen';

export default function PrivateVaultScreen() {
  const theme = useTheme();
  const { isVaultUnlocked, unlockVault, privateAssetIds, removeAssetsFromPrivate } = usePrivacyStore();
  const allMedia = useMediaStore(state => state.media);
  const [authAttempted, setAuthAttempted] = useState(false);

  // Phase 4: Secure screen in background
  useSecureScreen(true);

  // Phase 4: Authentication Session
  useEffect(() => {
    if (!isVaultUnlocked && !authAttempted) {
      setAuthAttempted(true);
      unlockVault().then(success => {
        if (!success) {
          router.back();
        }
      });
    }
  }, [isVaultUnlocked, authAttempted]);

  if (!isVaultUnlocked) {
    return (
      <View style={[styles.authContainer, { backgroundColor: theme.background }]}>
        <Stack.Screen 
          options={{ 
            title: 'Private Vault',
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            headerShadowVisible: false,
          }} 
        />
        <View style={[styles.lockIconBadge, { backgroundColor: '#6366F120', borderColor: '#818CF8' }]}>
          <Ionicons name="lock-closed" size={44} color="#818CF8" />
        </View>
        <Text style={[styles.authTitle, { color: theme.text }]}>Private Vault Locked</Text>
        <Text style={[styles.authSubtitle, { color: theme.textMuted }]}>
          Biometric authentication required to view quarantined media
        </Text>
        <ActivityIndicator size="small" color={theme.accent} style={{ marginTop: 20 }} />
      </View>
    );
  }

  // Filter media ONLY after auth
  const vaultPhotos = allMedia.filter(m => privateAssetIds.includes(m.id));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen 
        options={{ 
          title: `Private Vault (${vaultPhotos.length})`,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }} 
      />
      
      {/* Sleek Info Banner */}
      <View style={[styles.infoBanner, { backgroundColor: theme.surface, borderColor: 'rgba(255,255,255,0.06)' }]}>
        <View style={[styles.infoIconBadge, { backgroundColor: '#6366F125' }]}>
          <Ionicons name="shield-checkmark" size={20} color="#818CF8" />
        </View>
        <View style={styles.infoTextWrapper}>
          <Text style={[styles.infoTitle, { color: theme.text }]}>Zero-Exposure Storage</Text>
          <Text style={[styles.infoText, { color: theme.textMuted }]}>
            These items are quarantined from gallery timelines, album counts, and search results.
          </Text>
        </View>
      </View>

      <FlatList
        data={vaultPhotos}
        numColumns={3}
        keyExtractor={item => item.id}
        contentContainerStyle={vaultPhotos.length === 0 ? styles.emptyContainer : styles.gridContainer}
        renderItem={({ item }) => (
          <View style={styles.photoContainer}>
            <Pressable 
              style={styles.photoPressable} 
              onPress={() => router.push({ pathname: `/viewer/[id]`, params: { id: item.id, source: 'private' } })}
            >
              <Image source={{ uri: item.uri }} style={styles.photo} contentFit="cover" />
            </Pressable>
            
            {/* Quick Un-Private Action */}
            <Pressable 
              style={styles.removeOverlay} 
              onPress={() => removeAssetsFromPrivate([item.id])}
              hitSlop={8}
            >
              <Ionicons name="lock-open-outline" size={16} color="#FFF" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBadge, { backgroundColor: '#6366F115' }]}>
              <Ionicons name="shield-outline" size={48} color="#818CF8" />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Vault is Empty</Text>
            <Text style={[styles.emptyDescription, { color: theme.textMuted }]}>
              Select photos in your gallery, tap the action menu, and choose "Make Private" to safely quarantine them here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIconBadge: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  infoIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextWrapper: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoText: { 
    fontSize: 12, 
    lineHeight: 16 
  },
  gridContainer: {
    paddingHorizontal: 1,
    paddingBottom: 40,
  },
  photoContainer: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 1.5,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  photoPressable: {
    width: '100%',
    height: '100%',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 40,
  },
  emptyIconBadge: {
    width: 90,
    height: 90,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
