import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { describeError, suggestRecipes } from '@/lib/claude';
import { failure, success } from '@/lib/haptics';
import { pantryFrom, receiptsWithin } from '@/lib/nutrition';
import { loadDemoData, loadReceipts, loadRecipes, loadSettings, saveRecipes, saveSettings } from '@/lib/storage';
import { DEFAULT_SETTINGS } from '@/lib/types';

const WINDOWS = [3, 5, 7, 14];
const PANTRY_PREVIEW = 5;

const loadRecipesScreen = async () => {
  const [receipts, batch, settings] = await Promise.all([loadReceipts(), loadRecipes(), loadSettings()]);
  return { receipts, batch, settings };
};

export default function RecipesScreen() {
  const { data, setData, loaded, reload } = useFocusData(loadRecipesScreen, {
    receipts: [],
    batch: null,
    settings: DEFAULT_SETTINGS,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { receipts, batch, settings } = data;
  const windowDays = settings.recipeWindowDays;
  const pantry = pantryFrom(receipts, windowDays);
  const urgentCount = pantry.filter((p) => p.daysLeft <= 3).length;

  async function changeWindow(days: number) {
    const next = { ...settings, recipeWindowDays: days };
    setData({ ...data, settings: next });
    await saveSettings(next);
  }

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      const recipes = await suggestRecipes({
        receipts: receiptsWithin(receipts, windowDays),
        language: settings.language,
        diet: settings.diet,
      });
      const next = { createdAt: new Date().toISOString(), windowDays, recipes };
      await saveRecipes(next);
      setData({ ...data, batch: next });
      success();
    } catch (e) {
      failure();
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

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
              </ThemedText>
            </View>
          </View>
          <View style={styles.chips}>
            {WINDOWS.map((d) => (
              <Chip key={d} label={`${d} days`} selected={d === windowDays} onPress={() => changeWindow(d)} />
            ))}
          </View>

          {pantry.length > 0 ? (
            <View>
              {visiblePantry.map((item, i) => (
                <View key={`${item.receiptId}-${item.name}-${i}`}>
                  {i > 0 && <Divider />}
                  <PantryRow item={item} />
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
            </View>
          ) : (
            <ThemedText variant="caption" color="textSecondary">
              Nothing bought in this window. Pick a longer one or scan a new receipt.
            </ThemedText>
          )}

          <Button
            title={busy ? 'Cooking up ideas…' : batch ? 'Suggest new recipes' : 'Suggest recipes'}
            icon="sparkles"
            loading={busy}
            disabled={pantry.length === 0}
            onPress={generate}
          />
          {settings.diet ? (
            <ThemedText variant="caption" color="textTertiary">
              Preferences: {settings.diet}
            </ThemedText>
          ) : null}
        </Card>
      </Animated.View>

      <Banner message={error} onDismiss={() => setError(null)} />

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
          {batch.recipes.map((r, i) => (
            <Animated.View key={`${r.title}-${i}`} entering={FadeInDown.duration(400).delay(70 * i)}>
              <RecipeCard recipe={r} index={i} />
            </Animated.View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  kitchenHead: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  showAll: { alignItems: 'center', paddingTop: Spacing.two },
  list: { gap: Spacing.three },
});
