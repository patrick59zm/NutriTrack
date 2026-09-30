import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, StyleSheet, type ColorValue } from 'react-native';

import type { IconName } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

const icon = (name: IconName, focusedName: IconName) =>
  function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Ionicons name={focused ? focusedName : name} size={24} color={color} />;
  };

export default function TabLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(Platform.OS === 'web' && { height: 70, paddingTop: 6, paddingBottom: 10 }),
        },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('scan-outline', 'scan') }} />
      <Tabs.Screen name="history" options={{ title: 'Receipts', tabBarIcon: icon('receipt-outline', 'receipt') }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recipes', tabBarIcon: icon('restaurant-outline', 'restaurant') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
