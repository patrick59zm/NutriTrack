import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PantryRow } from '@/components/pantry';
import { RecipeCard, RecipeSkeleton } from '@/components/recipe-card';
import { ThemedText } from '@/components/themed-text';
import {
  Banner,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Screen,
  SectionHeader,
  TextLink,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { describeError, suggestRecipes } from '@/lib/claude';
import { failure, success } from '@/lib/haptics';
import { daysSince, pantryFrom, receiptsWithin, recipesMatchDiet, type PantryItem } from '@/lib/nutrition';
import {
  loadCooked,
  loadDemoData,
  loadFavorites,
  loadReceipts,
  loadRecipes,
  loadSettings,
  recipeKey,
  saveRecipes,
  saveSettings,
  setItemsConsumed,
} from '@/lib/storage';
import { DEFAULT_SETTINGS, type SavedRecipe } from '@/lib/types';

const WINDOWS = [3, 5, 7, 14];
const PANTRY_PREVIEW = 5;
const WISHES = ['Quick lunch', 'Comfort food', 'Something light', 'Meal prep', 'Kids will eat it', 'One pot'];

const loadRecipesScreen = async () => {
  const [receipts, batch, settings, favorites, cooked] = await Promise.all([
    loadReceipts(),
    loadRecipes(),
    loadSettings(),
    loadFavorites(),
    loadCooked(),
  ]);
  return { receipts, batch, settings, favorites, cooked };
};

export default function RecipesScreen() {
  const theme = useTheme();
  const { data, setData, loaded, reload } = useFocusData(loadRecipesScreen, {
    receipts: [],
    batch: null,
    settings: DEFAULT_SETTINGS,
    favorites: [] as SavedRecipe[],
    cooked: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [wish, setWish] = useState('');
  const [undo, setUndo] = useState<PantryItem | null>(null);

  const { receipts, batch: saved, settings, favorites, cooked } = data;
  // Ideas made for other dietary preferences are hidden until new ones are suggested.
  const batch = recipesMatchDiet(saved, settings.diet) ? saved : null;
  const staleForDiet = !!saved && !batch;
  const windowDays = settings.recipeWindowDays;
  const pantry = pantryFrom(receipts, windowDays);
  const urgentCount = pantry.filter((p) => p.daysLeft <= 3).length;
  const cookedThisWeek = cooked.filter((m) => daysSince(m.cookedAt) < 7).length;
  const savedKeys = new Set(favorites.map((f) => recipeKey(f.recipe)));

  async function changeWindow(days: number) {
    const next = { ...settings, recipeWindowDays: days };
    setData({ ...data, settings: next });
    await saveSettings(next);
  }

  async function consume(item: PantryItem, consumed: boolean) {
    await setItemsConsumed([{ receiptId: item.receiptId, itemId: item.itemId }], consumed);
    setUndo(consumed ? item : null);
    reload();
  }

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      const { recipes, sampleReason } = await suggestRecipes({
        receipts: receiptsWithin(receipts, windowDays),
        settings,
        wish,
      });
      const next = {
        createdAt: new Date().toISOString(),
        windowDays,
        diet: settings.diet,
        recipes,
        ...(sampleReason && { sampleReason }),
      };
      await saveRecipes(next);
      setData((d) => ({ ...d, batch: next }));
      success();
    } catch (e) {
      failure();
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const savedSection = favorites.length > 0 && (
    <View style={styles.list}>
      <SectionHeader
        title={`Saved recipes · ${favorites.length}`}
        action={<TextLink title={showSaved ? 'Hide' : 'Show'} onPress={() => setShowSaved((s) => !s)} />}
      />
      {showSaved &&
        favorites.map((f, i) => (
          <Animated.View key={f.id} entering={FadeInDown.duration(300).delay(50 * i)}>
            <RecipeCard recipe={f.recipe} index={i} source="saved" saved />
          </Animated.View>
        ))}
    </View>
  );

  if (loaded && receipts.length === 0) {
    return (
      <Screen title="Recipes" subtitle="Ideas that use up what you bought">
        <EmptyState
          emoji="🍳"
          title="Nothing in your kitchen yet"
          message="Scan a receipt and NutriTrack suggests dishes that use your groceries before they spoil.">
          <Button title="Scan a receipt" icon="scan" onPress={() => router.navigate('/')} />
          <Button
            title="Load sample data"
            icon="sparkles"
            variant="secondary"
            onPress={async () => {
              await loadDemoData();
              reload();
            }}
          />
        </EmptyState>
        {savedSection}
      </Screen>
    );
  }

  const visiblePantry = showAll ? pantry : pantry.slice(0, PANTRY_PREVIEW);

  return (
    <Screen title="Recipes" subtitle="Ideas that use up what you bought">
      <Animated.View entering={FadeInDown.duration(400)}>
        <Card>
          <View style={styles.kitchenHead}>
            <View style={styles.flex}>
              <ThemedText variant="headline">Your kitchen</ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                {pantry.length} items bought in the last {windowDays} days
                {urgentCount > 0 ? ` · ${urgentCount} to use soon` : ''}
                {cookedThisWeek > 0 ? ` · ${cookedThisWeek} meal${cookedThisWeek === 1 ? '' : 's'} cooked this week` : ''}
              </ThemedText>
            </View>
          </View>
          <View style={styles.chips}>
            {WINDOWS.map((d) => (
              <Chip key={d} label={`${d} days`} selected={d === windowDays} onPress={() => changeWindow(d)} />
            ))}
          </View>

          {undo && (
            <Banner
              tone="brand"
              icon="checkmark-done-outline"
              message={`${undo.name} marked as used up.`}
              onDismiss={() => setUndo(null)}
            />
          )}
          {undo && <TextLink title="Undo" onPress={() => consume(undo, false)} />}

          {pantry.length > 0 ? (
            <View>
              {visiblePantry.map((item, i) => (
                <View key={item.itemId}>
                  {i > 0 && <Divider />}
                  <PantryRow item={item} onConsume={() => consume(item, true)} />
                </View>
              ))}
              {pantry.length > PANTRY_PREVIEW && (
                <View style={styles.showAll}>
                  <TextLink
                    title={showAll ? 'Show less' : `Show all ${pantry.length} items`}
                    onPress={() => setShowAll((s) => !s)}
                  />
                </View>
              )}
              <ThemedText variant="caption" color="textTertiary">
                Tap the tick on an item once it is used up, and it leaves the recipe ideas.
              </ThemedText>
            </View>
          ) : (
            <ThemedText variant="caption" color="textSecondary">
              Nothing bought in this window. Pick a longer one or scan a new receipt.
            </ThemedText>
          )}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(60)}>
        <Card>
          <ThemedText variant="headline">What are you in the mood for?</ThemedText>
          <View style={styles.chips}>
            {WISHES.map((w) => (
              <Chip key={w} label={w} selected={wish === w} onPress={() => setWish(wish === w ? '' : w)} />
            ))}
          </View>
          <TextInput
            value={wish}
            onChangeText={setWish}
            placeholder="Optional, e.g. something with the salmon tonight"
            placeholderTextColor={theme.textTertiary}
            accessibilityLabel="What are you in the mood for?"
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          />
          <Button
            title={busy ? 'Cooking up ideas…' : batch ? 'Suggest new recipes' : 'Suggest recipes'}
            icon="sparkles"
            loading={busy}
            disabled={pantry.length === 0}
            onPress={generate}
          />
          <ThemedText variant="caption" color="textTertiary">
            {settings.householdSize} serving{settings.householdSize === 1 ? '' : 's'}
            {settings.maxCookMinutes ? ` · up to ${settings.maxCookMinutes} min` : ''}
            {settings.diet ? ` · ${settings.diet}` : ''}
            {' · '}
            <ThemedText variant="caption" color="brand" onPress={() => router.navigate('/settings')}>
              Change
            </ThemedText>
          </ThemedText>
        </Card>
      </Animated.View>

      <Banner message={error} onDismiss={() => setError(null)} />
      {staleForDiet && !busy && (
        <Banner
          tone="warn"
          icon="leaf-outline"
          message={
            settings.diet
              ? `Your dietary preferences changed. Tap Suggest recipes for ideas that fit: ${settings.diet}.`
              : 'Your dietary preferences changed. Tap Suggest recipes for new ideas.'
          }
        />
      )}

      {busy && (
        <View style={styles.list}>
          <RecipeSkeleton />
          <RecipeSkeleton />
          <RecipeSkeleton />
        </View>
      )}

      {!busy && batch && batch.recipes.length > 0 && (
        <View style={styles.list}>
          <SectionHeader
            title="Ideas for you"
            action={
              <ThemedText variant="caption" color="textTertiary">
                {new Date(batch.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </ThemedText>
            }
          />
          {batch.sampleReason && (
            <Banner tone="warn" icon="flask-outline" message={`Sample ideas, not from Claude. ${batch.sampleReason}`} />
          )}
          {batch.recipes.map((r, i) => (
            <Animated.View key={`${r.title}-${i}`} entering={FadeInDown.duration(400).delay(70 * i)}>
              <RecipeCard recipe={r} index={i} saved={savedKeys.has(recipeKey(r))} />
            </Animated.View>
          ))}
        </View>
      )}

      {savedSection}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  kitchenHead: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  showAll: { alignItems: 'center', paddingTop: Spacing.two },
  list: { gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
});
