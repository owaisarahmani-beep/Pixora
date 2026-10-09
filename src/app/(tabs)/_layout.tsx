import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import GlobalSelectionBar from '../../components/gallery/GlobalSelectionBar';
import { useSelectionStore } from '../../store/useSelectionStore';

// Tab bar height constant — we push the bottom action bar above this
const TAB_BAR_HEIGHT = 62;

export default function TabsLayout() {
  const theme = useTheme();
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.background,
          },
          headerTintColor: theme.text,
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopColor: theme.surface,
            // Hide tab bar when in selection mode so the action bar takes its place
            display: isSelectionMode ? 'none' : 'flex',
          },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textMuted,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Photos',
            tabBarIcon: ({ color, size }) => <Ionicons name="image" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="albums"
          options={{
            title: 'Albums',
            tabBarIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
          }}
        />
      </Tabs>

      {/* Selection bar rendered here so it sits above the tab bar area correctly */}
      <GlobalSelectionBar tabBarHeight={0} />
    </View>
  );
}
