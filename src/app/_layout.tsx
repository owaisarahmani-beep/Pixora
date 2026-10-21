import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import PrivacyGuard from '../components/privacy/PrivacyGuard';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';

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
    if (Platform.OS === 'android') {
      try {
        if (NavigationBar?.setVisibilityAsync) {
          NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        }
      } catch {
        // Safe fallback for builds without navigation bar support
      }
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <RootNavigation />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
