import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useMediaStore } from '../../store/useMediaStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSecureScreen } from '../../hooks/useSecureScreen';
import EmptyStateView from '../../components/common/EmptyStateView';

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
        <Text style={[styles.authTitle, { color: theme.text }]}>Private Vault</Text>
        <Text style={[styles.authSubtitle, { color: theme.textMuted }]}>
          Authentication required to view protected media
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
          title: 'Private Vault',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }} 
      />

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
          <EmptyStateView
            icon="lock-closed-outline"
            title="Vault is Empty"
            description="Items you add to the vault are secured with biometrics and hidden from your main library."
            actionLabel="Return to Gallery"
            onAction={() => router.back()}
          />
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
