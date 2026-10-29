import 'react-native-url-polyfill/auto';

import { DarkTheme, DefaultTheme, router, ThemeProvider, usePathname } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';

import { AppErrorBoundary } from '@/components/app-error-boundary';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage, useT } from '@/lib/i18n';
import { prepareReminders, syncReminders } from '@/lib/reminders';
import { loadSettings } from '@/lib/storage';

// Keep the splash screen up until the stored settings (and with them the language) are in.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const t = useT();
  const language = useLanguage();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  // A language change remounts every screen (the tree below is keyed by language), so no
  // memoized text survives in the old language; afterwards the person is put back where they were.
  const lastPath = useRef(pathname);
  useEffect(() => {
    lastPath.current = pathname;
  }, [pathname]);
  const shownLanguage = useRef(language);
  useEffect(() => {
    if (shownLanguage.current === language) return;
    shownLanguage.current = language;
    const path = lastPath.current;
    const timer = setTimeout(() => router.replace(path as never), 50);
    return () => clearTimeout(timer);
  }, [language]);
  useEffect(() => {
    loadSettings()
      .catch(() => {})
      .then(() => setReady(true));
    prepareReminders().then(syncReminders);
  }, []);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  const colors = Colors[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.brand,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  if (!ready) return null;
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="auto" />
      <AppErrorBoundary>
        <Stack
          key={language}
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.brand,
            headerTitleStyle: { color: colors.text, fontWeight: '600' },
            headerBackTitle: t('common.back'),
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="receipt/[id]" options={{ title: '' }} />
          <Stack.Screen name="recipe/[index]" options={{ title: '' }} />
        </Stack>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
