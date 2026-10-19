import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '../theme/ThemeProvider';
import PrivacyGuard from '../components/privacy/PrivacyGuard';
import { NavigationBar } from 'expo-navigation-bar';
import { Platform } from 'react-native';
import { useEffect } from 'react';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setHidden(true);
      } catch (e) {
        console.warn('Failed to set NavigationBar', e);
      }
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <StatusBar style="light" />
        {Platform.OS === 'android' && <NavigationBar hidden={true} />}
        <PrivacyGuard>
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: '#10151F',
              },
              headerTintColor: '#F1F5F9',
              headerTitleStyle: {
                fontWeight: '600',
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
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
