import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import GlobalSelectionBar from '../../components/gallery/GlobalSelectionBar';
import { useSelectionStore } from '../../store/useSelectionStore';

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isSelectionMode = useSelectionStore(state => state.isSelectionMode);

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#111726',
            borderTopColor: 'rgba(255, 255, 255, 0.08)',
            borderTopWidth: 1,
            height: 60 + bottomPadding,
            paddingBottom: bottomPadding,
            paddingTop: 8,
            display: isSelectionMode ? 'none' : 'flex',
            elevation: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
          },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: '#8E9BAE',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Photos',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrapper, focused && styles.iconWrapperFocused]}>
                <Ionicons 
                  name={focused ? 'images' : 'images-outline'} 
                  size={21} 
                  color={focused ? theme.accent : color} 
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="albums"
          options={{
            title: 'Albums',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrapper, focused && styles.iconWrapperFocused]}>
                <Ionicons 
                  name={focused ? 'albums' : 'albums-outline'} 
                  size={21} 
                  color={focused ? theme.accent : color} 
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrapper, focused && styles.iconWrapperFocused]}>
                <Ionicons 
                  name={focused ? 'settings' : 'settings-outline'} 
                  size={21} 
                  color={focused ? theme.accent : color} 
                />
              </View>
            ),
          }}
        />
      </Tabs>

      {/* Global Selection Bar */}
      <GlobalSelectionBar tabBarHeight={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperFocused: {
    backgroundColor: 'rgba(103, 232, 249, 0.14)',
  },
});
