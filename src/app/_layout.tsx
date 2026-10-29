import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import PrivacyGuard from '../components/privacy/PrivacyGuard';
import { ToastProvider } from '../components/common/Toast';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { useEffect } from 'react';
import { mediaStoreService } from '../services/media/MediaStoreService';
import { useMediaStore } from '../store/useMediaStore';
import { useAlbumsStore } from '../store/useAlbumsStore';

function RootNavigation() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <PrivacyGuard>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.background,
            },
            headerTintColor: theme.text,
            headerTitleStyle: {
              fontWeight: '600',
            },
            contentStyle: {
              backgroundColor: theme.background,
            },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="viewer/[id]" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="editor/[id]" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="archive" options={{ title: 'Archive', headerShown: true }} />
          <Stack.Screen name="trash" options={{ title: 'Recently Deleted', headerShown: true }} />
          <Stack.Screen name="trash-viewer" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="slideshow" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="smart-album/[id]" options={{ headerShown: true }} />
          <Stack.Screen name="album/[id]" options={{ headerShown: true }} />
          <Stack.Screen name="search" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="favorites" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="storage" options={{ title: 'Storage Cleaner', headerShown: true }} />
        </Stack>
      </PrivacyGuard>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Initiate early permission check on app launch to prepare media state before tab render
    useMediaStore.getState().checkPermissions();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerGlobalRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const status = useMediaStore.getState().permissionStatus;
        if (status === 'GRANTED' || status === 'LIMITED') {
          useMediaStore.getState().refreshMedia();
          useAlbumsStore.getState().loadAlbums(true);
        }
      }, 700);
    };

    const unsubscribeMedia = mediaStoreService.subscribeToMediaChanges(triggerGlobalRefresh);

    const appStateSub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Re-check permissions so returning from system settings immediately unlocks gallery
        await useMediaStore.getState().checkPermissions();
        const status = useMediaStore.getState().permissionStatus;
        if (status === 'GRANTED' || status === 'LIMITED') {
          useMediaStore.getState().refreshMedia();
          useAlbumsStore.getState().loadAlbums(true);
        }
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeMedia();
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Nav = require('expo-navigation-bar');
        Nav?.setVisibilityAsync?.('hidden').catch(() => {});
      } catch {
        // Safe fallback for builds without navigation bar support
      }
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <RootNavigation />
        <ToastProvider />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
