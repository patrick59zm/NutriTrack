import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, StyleSheet, type ColorValue } from 'react-native';

import type { IconName } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/lib/i18n';

const icon = (name: IconName, focusedName: IconName) =>
  function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Ionicons name={focused ? focusedName : name} size={24} color={color} />;
  };

export default function TabLayout() {
  const theme = useTheme();
  const t = useT();
  // German labels are longer; a smaller, tighter label keeps "Einstellungen" on one line on narrow phones.
  const german = useLanguage() === 'de';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarLabelStyle: { fontSize: german ? 9 : 11, lineHeight: 14, fontWeight: '600', letterSpacing: german ? -0.3 : 0 },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(Platform.OS === 'web' && { height: 70, paddingTop: 6, paddingBottom: 10 }),
        },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.today'), tabBarIcon: icon('scan-outline', 'scan') }} />
      <Tabs.Screen name="history" options={{ title: t('tabs.receipts'), tabBarIcon: icon('receipt-outline', 'receipt') }} />
      <Tabs.Screen name="recipes" options={{ title: t('tabs.recipes'), tabBarIcon: icon('restaurant-outline', 'restaurant') }} />
      <Tabs.Screen name="shopping" options={{ title: t('tabs.shopping'), tabBarIcon: icon('cart-outline', 'cart') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
