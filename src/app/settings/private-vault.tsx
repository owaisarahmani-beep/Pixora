import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
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
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ title: 'Private Vault', headerBackTitle: 'Back' }} />
        <Ionicons name="lock-closed" size={48} color={theme.textMuted} />
        <Text style={{ color: theme.textMuted, marginTop: 16 }}>Authenticating...</Text>
      </View>
    );
  }

  // Phase 5: Filter media ONLY after auth
  const vaultPhotos = allMedia.filter(m => privateAssetIds.includes(m.id));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Private Vault', headerBackTitle: 'Back' }} />
      
      <View style={[styles.infoBanner, { backgroundColor: theme.surface }]}>
        <Ionicons name="shield-checkmark" size={24} color={theme.accent} />
        <Text style={[styles.infoText, { color: theme.text }]}>
          These items are strictly protected and never appear in public views or search results.
        </Text>
      </View>

      <FlatList
        data={vaultPhotos}
        numColumns={3}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.photoContainer}>
            <Pressable 
              style={{ flex: 1 }} 
              onPress={() => router.push({ pathname: `/viewer/[id]`, params: { id: item.id, source: 'private' } })}
            >
              <Image source={{ uri: item.uri }} style={styles.photo} />
            </Pressable>
            
            {/* Quick Un-Private Action */}
            <Pressable style={styles.removeOverlay} onPress={() => removeAssetsFromPrivate([item.id])}>
              <Ionicons name="lock-open" size={20} color="#FFF" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: theme.textMuted, padding: 16 }}>Your Private Vault is empty.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  infoBanner: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)'
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  photoContainer: {
    flex: 1,
    aspectRatio: 1,
    margin: 1,
    position: 'relative'
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 6,
    borderRadius: 20
  }
});
