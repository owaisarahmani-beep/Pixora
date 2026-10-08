import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '../theme/ThemeProvider';
import PrivacyGuard from '../components/privacy/PrivacyGuard';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <StatusBar style="light" />
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
          </Stack>
        </PrivacyGuard>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
