import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
import { analyzeReceipt, describeError } from '@/lib/claude';
import { DEMO_MODE } from '@/lib/config';
import { failure, success } from '@/lib/haptics';
import { prepareReceiptImages } from '@/lib/image';
import { money, pantryFrom, receiptsWithin, recipesMatchDiet, sum } from '@/lib/nutrition';
import { getApiKey, loadDemoData, loadReceipts, loadRecipes, loadSettings, saveReceipt } from '@/lib/storage';

const SUMMARY_DAYS = 7;

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 11) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const loadHome = async () => {
  const [receipts, batch, apiKey, settings] = await Promise.all([
    loadReceipts(),
    loadRecipes(),
    getApiKey(),
    loadSettings(),
  ]);
  // Ideas made for other dietary preferences are not offered.
  const recipes = recipesMatchDiet(batch, settings.diet) ? batch : null;
  return { receipts, recipes, hasKey: !!apiKey };
};

export default function TodayScreen() {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { data, loaded, reload } = useFocusData(loadHome, { receipts: [], recipes: null, hasKey: false });
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(async (source: 'camera' | 'library') => {
    setError(null);
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph receipts.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPreview(asset.uri);
    setBusy(true);
    try {
      const [images, settings] = await Promise.all([prepareReceiptImages(asset), loadSettings()]);
      const receipt = await analyzeReceipt(images, settings.language);
      await saveReceipt(receipt);
      success();
      router.push({ pathname: '/receipt/[id]', params: { id: receipt.id, fresh: '1' } });
    } catch (e) {
      failure();
      setError(describeError(e));
    } finally {
      setBusy(false);
      setPreview(null);
    }
  }, []);

  const { receipts, recipes, hasKey } = data;
  const recent = receiptsWithin(receipts, SUMMARY_DAYS);
  const weekTotals = sum(recent.map((r) => r.totals));
  const spent = recent.reduce((a, r) => a + (r.totalPrice ?? 0), 0);
  const foodCount = recent.reduce((a, r) => a + r.items.filter((i) => i.is_food).length, 0);
  const pantry = pantryFrom(receipts, SUMMARY_DAYS);
  const urgent = pantry.filter((p) => p.daysLeft <= 4);
  const strip = (urgent.length >= 3 ? urgent : pantry).slice(0, 10);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  let section = 0;
  const enter = () => FadeInDown.duration(420).delay(60 * section++);

  return (
    <Screen overline={today} title={greeting()}>
      <ScanningOverlay visible={busy} imageUri={preview} />

      <Animated.View entering={enter()}>
        <LinearGradient colors={HeroGradient[scheme]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <ThemedText style={styles.heroEmoji}>🧾</ThemedText>
          <View style={styles.heroText}>
            <ThemedText variant="title" style={styles.white}>
              Scan a receipt
            </ThemedText>
            <ThemedText variant="body" style={styles.heroSub}>
              Snap your Kassenzettel and get the nutrition of every item — plus recipes for what you bought.
            </ThemedText>
          </View>
          <View style={styles.heroButtons}>
            {Platform.OS !== 'web' && (
              <View style={styles.flex}>
                <Button title="Take photo" icon="camera" variant="onBrand" onPress={() => pick('camera')} />
              </View>
            )}
            <View style={styles.flex}>
              <Button
                title={Platform.OS === 'web' ? 'Upload receipt photo' : 'Gallery'}
                icon={Platform.OS === 'web' ? 'cloud-upload-outline' : 'images-outline'}
                variant={Platform.OS === 'web' ? 'onBrand' : 'onBrandGhost'}
                onPress={() => pick('library')}
              />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Banner message={error} onDismiss={() => setError(null)} />
      {DEMO_MODE && (
        <Banner
          tone="warn"
          icon="flask-outline"
          message="Demo version: allow Claude when asked and it reads your own receipt on your Claude account. Otherwise you get a sample result."
        />
      )}

      {loaded && !hasKey && (
        <Animated.View entering={enter()}>
          <PressableCard onPress={() => router.navigate('/settings')}>
            <Card style={styles.keyCard}>
              <IconCircle icon="key-outline" background={theme.warnSoft} color={theme.warn} size={40} />
              <View style={styles.flex}>
                <ThemedText variant="bodyStrong">Connect Claude to scan</ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  Add your Anthropic API key in Settings. Takes 30 seconds.
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
            title="Your kitchen starts here"
            message="Scan your first receipt, or explore NutriTrack with a few sample shopping trips.">
            <Button
              title="Try with sample data"
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
          <SectionHeader title="This week" />
          <Card>
            <NutritionPanel nutrition={weekTotals} caption="kcal bought" />
            <View style={styles.stats}>
              <StatTile label="Receipts" value={String(recent.length)} icon="receipt-outline" />
              <StatTile label="Items" value={String(foodCount)} icon="basket-outline" />
              <StatTile label="Spent" value={money(spent, 'EUR')} icon="wallet-outline" />
            </View>
          </Card>
        </Animated.View>
      )}

      {strip.length > 0 && (
        <Animated.View entering={enter()} style={styles.section}>
          <SectionHeader
            title={urgent.length >= 3 ? 'Use soon' : 'In your kitchen'}
            action={<TextLink title="Cook with it" onPress={() => router.navigate('/recipes')} />}
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
                  {recipes?.recipes.length ? `${recipes.recipes.length} recipe ideas ready` : 'What should I cook?'}
                </ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  {recipes?.recipes.length
                    ? recipes.recipes[0].title
                    : 'Get recipes that use up what you just bought'}
                </ThemedText>
              </View>
              <IconCircle icon="chevron-forward" size={28} background="transparent" color={theme.brandStrong} />
            </Card>
          </PressableCard>
        </Animated.View>
      )}

      {receipts.length > 0 && (
        <Animated.View entering={enter()} style={styles.section}>
          <SectionHeader
            title="Recent receipts"
            action={<TextLink title="See all" onPress={() => router.navigate('/history')} />}
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
  recipeTeaser: { flexDirection: 'row', alignItems: 'center' },
  teaserEmoji: { fontSize: 28, lineHeight: 36, letterSpacing: -4 },
});
