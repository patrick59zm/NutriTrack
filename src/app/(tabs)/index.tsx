import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BasketCheck } from '@/components/basket-check';
import { ImageFileInput } from '@/components/image-file-input';
import { NutritionPanel } from '@/components/nutrition-summary';
import { PantryStrip } from '@/components/pantry';
import { ReceiptRow } from '@/components/receipt-row';
import { ScanningOverlay } from '@/components/scanning-overlay';
import { ThemedText } from '@/components/themed-text';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  IconCircle,
  PressableCard,
  Screen,
  SectionHeader,
  StatTile,
  TextLink,
} from '@/components/ui';
import { HeroGradient, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { useScanner } from '@/hooks/use-scanner';
import { DEMO_MODE } from '@/lib/config';
import { success } from '@/lib/haptics';
import { locale, t, useT } from '@/lib/i18n';
import { basketMetrics } from '@/lib/insights';
import { fmt, money, pantryFrom, receiptsWithin, recipesMatchDiet, sum } from '@/lib/nutrition';
import { getApiKey, loadDemoData, loadReceipts, loadRecipes, loadSettings, loadShopping } from '@/lib/storage';
import { DEFAULT_SETTINGS } from '@/lib/types';

const SUMMARY_DAYS = 7;

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 11) return t('home.morning');
  if (h < 17) return t('home.afternoon');
  return t('home.evening');
}

const loadHome = async () => {
  const [receipts, batch, apiKey, settings, shopping] = await Promise.all([
    loadReceipts(),
    loadRecipes(),
    getApiKey(),
    loadSettings(),
    loadShopping(),
  ]);
  // Ideas made for other dietary preferences are not offered.
  const recipes = recipesMatchDiet(batch, settings.diet) ? batch : null;
  return { receipts, recipes, hasKey: !!apiKey, settings, toBuy: shopping.filter((i) => !i.done).length };
};

export default function TodayScreen() {
  const theme = useTheme();
  const t = useT();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { data, loaded, reload } = useFocusData(loadHome, {
    receipts: [],
    recipes: null,
    hasKey: false,
    settings: DEFAULT_SETTINGS,
    toBuy: 0,
  });

  const scanner = useScanner({
    onDone: (receipt) => router.push({ pathname: '/receipt/[id]', params: { id: receipt.id, fresh: '1' } }),
  });

  const { receipts, recipes, hasKey, settings, toBuy } = data;
  const recent = receiptsWithin(receipts, SUMMARY_DAYS);
  const weekTotals = sum(recent.map((r) => r.totals));
  const spent = recent.reduce((a, r) => a + (r.totalPrice ?? 0), 0);
  const foodCount = recent.reduce((a, r) => a + r.items.filter((i) => i.is_food).length, 0);
  const perPersonDay = weekTotals.kcal / SUMMARY_DAYS / Math.max(1, settings.householdSize);
  const metrics = basketMetrics(
    weekTotals,
    recent.flatMap((r) => r.items),
    { days: SUMMARY_DAYS, people: settings.householdSize },
  );
  const pantry = pantryFrom(receipts, SUMMARY_DAYS);
  const urgent = pantry.filter((p) => p.daysLeft <= 4);
  const strip = (urgent.length >= 3 ? urgent : pantry).slice(0, 10);
  const today = new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

  let section = 0;
  const enter = () => FadeInDown.duration(420).delay(60 * section++);

  return (
    <Screen overline={today} title={greeting()}>
      <ScanningOverlay visible={scanner.busy} imageUri={scanner.preview} phase={scanner.phase} onCancel={scanner.cancel} />

      <Animated.View entering={enter()}>
        <LinearGradient colors={HeroGradient[scheme]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <ThemedText style={styles.heroEmoji}>🧾</ThemedText>
          <View style={styles.heroText}>
            <ThemedText variant="title" style={styles.white}>
              {t('home.heroTitle')}
            </ThemedText>
            <ThemedText variant="body" style={styles.heroSub}>
              {t('home.heroSub')}
            </ThemedText>
          </View>
          <View style={styles.heroButtons}>
            {!scanner.isWeb && (
              <View style={styles.flex}>
                <Button title={t('common.takePhoto')} icon="camera" variant="onBrand" onPress={() => scanner.pick('camera')} />
              </View>
            )}
            <View style={styles.flex}>
              {scanner.isWeb ? (
                <ImageFileInput onPick={scanner.analyzePhoto}>
                  <Button title={t('home.upload')} icon="cloud-upload-outline" variant="onBrand" onPress={() => {}} />
                </ImageFileInput>
              ) : (
                <Button title={t('common.gallery')} icon="images-outline" variant="onBrandGhost" onPress={() => scanner.pick('library')} />
              )}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Banner message={scanner.error} onDismiss={scanner.clearError} />
      {DEMO_MODE && (
        <Banner
          tone="warn"
          icon="flask-outline"
          message={t('home.demoBanner')}
        />
      )}

      {loaded && !hasKey && (
        <Animated.View entering={enter()}>
          <PressableCard onPress={() => router.navigate('/settings')}>
            <Card style={styles.keyCard}>
              <IconCircle icon="key-outline" background={theme.warnSoft} color={theme.warn} size={40} />
              <View style={styles.flex}>
                <ThemedText variant="bodyStrong">{t('home.connectTitle')}</ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  {t('home.connectSub')}
                </ThemedText>
              </View>
              <IconCircle icon="chevron-forward" size={28} background="transparent" color={theme.textTertiary} />
            </Card>
          </PressableCard>
        </Animated.View>
      )}

      {loaded && receipts.length === 0 && (
        <Animated.View entering={enter()}>
          <EmptyState
            emoji="🥕"
            title={t('home.emptyTitle')}
            message={t('home.emptyMessage')}>
            <Button
              title={t('home.trySample')}
              icon="sparkles"
              variant="secondary"
              onPress={async () => {
                await loadDemoData();
                success();
                reload();
              }}
            />
          </EmptyState>
        </Animated.View>
      )}

      {recent.length > 0 && (
        <Animated.View entering={enter()} style={styles.section}>
          <SectionHeader title={t('home.thisWeek')} />
          <Card>
            <NutritionPanel nutrition={weekTotals} caption={t('home.kcalBought')} />
            <View style={styles.stats}>
              <StatTile label={t('home.receipts')} value={String(recent.length)} icon="receipt-outline" />
              <StatTile label={t('home.items')} value={String(foodCount)} icon="basket-outline" />
              <StatTile label={t('home.spent')} value={money(spent, settings.currency)} icon="wallet-outline" />
            </View>
            <View style={[styles.perPerson, { backgroundColor: theme.brandSoft }]}>
              <ThemedText variant="headline" color="brandStrong">
                ≈ {fmt(perPersonDay)} kcal
              </ThemedText>
              <ThemedText variant="caption" color="textSecondary" style={styles.flex}>
                {t('home.perPerson', { n: settings.householdSize })}
                {' · '}
                <ThemedText variant="caption" color="brand" onPress={() => router.navigate('/settings')}>
                  {t('common.change')}
                </ThemedText>
              </ThemedText>
            </View>
          </Card>
        </Animated.View>
      )}

      {metrics.length > 0 && (
        <Animated.View entering={enter()} style={styles.section}>
          <SectionHeader title={t('home.basketCheck')} />
          <Card>
            <BasketCheck metrics={metrics} />
          </Card>
        </Animated.View>
      )}

      {strip.length > 0 && (
        <Animated.View entering={enter()} style={styles.section}>
          <SectionHeader
            title={urgent.length >= 3 ? t('home.useSoon') : t('home.inKitchen')}
            action={<TextLink title={t('home.cookWithIt')} onPress={() => router.navigate('/recipes')} />}
          />
          <PantryStrip items={strip} />
        </Animated.View>
      )}

      {recent.length > 0 && (
        <Animated.View entering={enter()}>
          <PressableCard onPress={() => router.navigate('/recipes')}>
            <Card style={[styles.recipeTeaser, { backgroundColor: theme.brandSoft, borderColor: 'transparent' }]}>
              <ThemedText style={styles.teaserEmoji}>
                {recipes?.recipes.slice(0, 3).map((r) => r.emoji).join('') || '🍳'}
              </ThemedText>
              <View style={styles.flex}>
                <ThemedText variant="headline" color="brandStrong">
                  {recipes?.recipes.length ? t('home.ideasReady', { n: recipes.recipes.length }) : t('home.whatToCook')}
                </ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  {recipes?.recipes.length ? recipes.recipes[0].title : t('home.getRecipes')}
                </ThemedText>
              </View>
              <IconCircle icon="chevron-forward" size={28} background="transparent" color={theme.brandStrong} />
            </Card>
          </PressableCard>
        </Animated.View>
      )}

      {toBuy > 0 && (
        <Animated.View entering={enter()}>
          <PressableCard onPress={() => router.navigate('/shopping')}>
            <Card style={styles.keyCard}>
              <IconCircle icon="cart-outline" size={40} />
              <View style={styles.flex}>
                <ThemedText variant="bodyStrong">
                  {t('home.shoppingCount', { n: toBuy })}
                </ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  {t('home.tickOff')}
                </ThemedText>
              </View>
              <IconCircle icon="chevron-forward" size={28} background="transparent" color={theme.textTertiary} />
            </Card>
          </PressableCard>
        </Animated.View>
      )}

      {receipts.length > 0 && (
        <Animated.View entering={enter()} style={styles.section}>
          <SectionHeader
            title={t('home.recentReceipts')}
            action={<TextLink title={t('home.seeAll')} onPress={() => router.navigate('/history')} />}
          />
          {receipts.slice(0, 3).map((r) => (
            <ReceiptRow key={r.id} receipt={r} />
          ))}
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  white: { color: '#FFFFFF' },
  section: { gap: Spacing.three },
  hero: { borderRadius: Radius.xl, padding: Spacing.five, gap: Spacing.five, overflow: 'hidden' },
  heroEmoji: {
    position: 'absolute',
    right: -8,
    top: -6,
    fontSize: 96,
    lineHeight: 110,
    opacity: 0.18,
    transform: [{ rotate: '12deg' }],
  },
  heroText: { gap: Spacing.one, paddingRight: Spacing.eight },
  heroSub: { color: 'rgba(255,255,255,0.82)' },
  heroButtons: { flexDirection: 'row', gap: Spacing.two },
  keyCard: { flexDirection: 'row', alignItems: 'center' },
  stats: { flexDirection: 'row', gap: Spacing.two },
  perPerson: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  recipeTeaser: { flexDirection: 'row', alignItems: 'center' },
  teaserEmoji: { fontSize: 28, lineHeight: 36, letterSpacing: -4 },
});
