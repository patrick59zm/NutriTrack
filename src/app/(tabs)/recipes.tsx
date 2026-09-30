import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ErrorText, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { describeError, suggestRecipes } from '@/lib/claude';
import { daysSince, fmt, receiptsWithin } from '@/lib/nutrition';
import { loadReceipts, loadRecipes, loadSettings, saveRecipes, saveSettings } from '@/lib/storage';
import { DEFAULT_SETTINGS, type Recipe } from '@/lib/types';

const WINDOWS = [3, 5, 7, 14];

export default function RecipesScreen() {
  const theme = useTheme();
  const { data: receipts } = useFocusData(loadReceipts, []);
  const { data: settings, setData: setSettings } = useFocusData(loadSettings, DEFAULT_SETTINGS);
  const { data: batch, setData: setBatch } = useFocusData(loadRecipes, null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const windowDays = settings.recipeWindowDays;
  const inWindow = receiptsWithin(receipts, windowDays);
  const now = new Date();
  const pantry = inWindow
    .flatMap((r) =>
      r.items
        .filter((i) => i.is_food)
        .map((i) => ({ name: i.name, daysLeft: i.shelf_life_days - daysSince(r.purchasedAt, now) })),
    )
    .sort((a, b) => a.daysLeft - b.daysLeft);

  async function changeWindow(days: number) {
    const next = { ...settings, recipeWindowDays: days };
    setSettings(next);
    await saveSettings(next);
  }

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      const recipes = await suggestRecipes({
        receipts: inWindow,
        language: settings.language,
        diet: settings.diet,
      });
      const next = { createdAt: new Date().toISOString(), windowDays, recipes };
      await saveRecipes(next);
      setBatch(next);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <ThemedText type="smallBold">Cook with what you bought</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Uses food from receipts in the last {windowDays} days and prioritizes what spoils first.
        </ThemedText>
        <View style={styles.chips}>
          {WINDOWS.map((d) => (
            <Chip key={d} label={`${d} days`} selected={d === windowDays} onPress={() => changeWindow(d)} />
          ))}
        </View>
        <Button
          title={busy ? 'Thinking…' : 'Suggest recipes'}
          loading={busy}
          disabled={pantry.length === 0}
          onPress={generate}
        />
        {pantry.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Scan a receipt first. Nothing was bought in this window.
          </ThemedText>
        )}
        <ErrorText message={error} />
      </Card>

      {pantry.length > 0 && (
        <>
          <SectionTitle>Your pantry ({pantry.length})</SectionTitle>
          <View style={styles.chips}>
            {pantry.map((p, i) => (
              <View key={`${p.name}-${i}`} style={[styles.pantryItem, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small">{p.name}</ThemedText>
                {p.daysLeft <= 2 && (
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {p.daysLeft < 0 ? 'maybe expired' : 'use soon'}
                  </ThemedText>
                )}
              </View>
            ))}
          </View>
        </>
      )}

      {batch && batch.recipes.length > 0 && (
        <>
          <SectionTitle>
            Suggestions · {new Date(batch.createdAt).toLocaleDateString()}
          </SectionTitle>
          {batch.recipes.map((r, i) => (
            <RecipeCard key={`${r.title}-${i}`} recipe={r} />
          ))}
        </>
      )}
    </Screen>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false);
  const n = recipe.nutrition_per_serving;
  return (
    <Pressable onPress={() => setOpen((o) => !o)}>
      <Card>
        <ThemedText type="smallBold" style={styles.recipeTitle}>
          {recipe.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {recipe.time_minutes} min · {recipe.servings} servings · {recipe.difficulty} · {fmt(n.kcal)} kcal/serving
        </ThemedText>
        <ThemedText type="small">{recipe.description}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {recipe.why}
        </ThemedText>
        <View style={styles.chips}>
          {recipe.uses_items.map((item) => (
            <Chip key={item} label={item} selected />
          ))}
          {recipe.extra_ingredients_needed.map((item) => (
            <Chip key={item} label={`+ ${item}`} />
          ))}
        </View>
        {open ? (
          <View style={styles.details}>
            <ThemedText type="smallBold">Ingredients</ThemedText>
            {recipe.ingredients.map((ing, i) => (
              <ThemedText key={i} type="small">
                • {ing.amount} {ing.item}
              </ThemedText>
            ))}
            <ThemedText type="smallBold">Steps</ThemedText>
            {recipe.steps.map((step, i) => (
              <ThemedText key={i} type="small">
                {i + 1}. {step}
              </ThemedText>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Per serving: P {fmt(n.protein_g)} g · C {fmt(n.carbs_g)} g · F {fmt(n.fat_g)} g
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Tap for ingredients and steps
          </ThemedText>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pantryItem: {
    flexDirection: 'row',
    gap: Spacing.one,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  recipeTitle: { fontSize: 18, lineHeight: 24 },
  details: { gap: Spacing.one, marginTop: Spacing.two },
});
