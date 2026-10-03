import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../theme/ThemeProvider';
import PrivacyGuard from '../components/privacy/PrivacyGuard';

export default function RootLayout() {
  return (
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
        </Stack>
      </PrivacyGuard>
    </ThemeProvider>
  );
}
