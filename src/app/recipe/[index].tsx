import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { MacroBar } from '@/components/nutrition-summary';
import { Meta, recipeTint } from '@/components/recipe-card';
import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, Divider, Screen, SectionHeader, Sheet, StatTile } from '@/components/ui';
import { MacroColors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { success, tap } from '@/lib/haptics';
import { EMPTY_NUTRITION, fmt, pantryFrom, type PantryItem } from '@/lib/nutrition';
import { syncReminders } from '@/lib/reminders';
import { recipeToText, shareText } from '@/lib/share';
import {
  addToShopping,
  loadFavorites,
  loadReceipts,
  loadRecipes,
  loadSettings,
  recipeKey,
  recordCooked,
  setItemsConsumed,
  toggleFavorite,
} from '@/lib/storage';
import { DEFAULT_SETTINGS, type Recipe } from '@/lib/types';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß ]/g, '').trim();
const matches = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
};

const loadRecipeScreen = async () => {
  const [batch, favorites, receipts, settings] = await Promise.all([
    loadRecipes(),
    loadFavorites(),
    loadReceipts(),
    loadSettings(),
  ]);
  return { batch, favorites, receipts, settings };
};

export default function RecipeScreen() {
  const { index, source } = useLocalSearchParams<{ index: string; source?: string }>();
  const i = Number(index);
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { data, setData, loaded } = useFocusData(loadRecipeScreen, {
    batch: null,
    favorites: [],
    receipts: [],
    settings: DEFAULT_SETTINGS,
  });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<number>>(new Set());
  const [cooking, setCooking] = useState<{ chosen: Set<string> } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { batch, favorites, receipts, settings } = data;
  const recipe: Recipe | undefined = source === 'saved' ? favorites[i]?.recipe : batch?.recipes[i];
  const saved = !!recipe && favorites.some((f) => recipeKey(f.recipe) === recipeKey(recipe));

  const onToggleFavorite = useCallback(async () => {
    if (!recipe) return;
    tap();
    const nowSaved = await toggleFavorite(recipe);
    setData((d) => ({
      ...d,
      favorites: nowSaved
        ? [{ id: 'pending', savedAt: new Date().toISOString(), recipe }, ...d.favorites]
        : d.favorites.filter((f) => recipeKey(f.recipe) !== recipeKey(recipe)),
    }));
    setToast(nowSaved ? 'Saved to your recipes.' : 'Removed from your saved recipes.');
  }, [recipe, setData]);

  if (!loaded) return null;
  if (!recipe) {
    return (
      <Screen topInset={false}>
        <ThemedText>Recipe not found.</ThemedText>
      </Screen>
    );
  }

  const pantry = pantryFrom(receipts, 30);
  const inKitchen = (item: string) => recipe.uses_items.some((k) => matches(k, item)) || pantry.some((p) => matches(p.name, item));
  const missing = recipe.ingredients.filter((ing) => !inKitchen(ing.item)).map((ing) => ing.item);
  const extras = [...new Set([...recipe.extra_ingredients_needed, ...missing])];
  // Pantry items this recipe uses, for "I cooked this".
  const usedPantry: PantryItem[] = pantry.filter((p) => recipe.uses_items.some((u) => matches(u, p.name)));

  const n = recipe.nutrition_per_serving;
  const toggle = <T,>(set: Set<T>, value: T) => {
    tap();
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  async function share() {
    const result = await shareText(recipeToText(recipe!), recipe!.title);
    if (result === 'copied') setToast('Recipe copied to the clipboard.');
  }

  async function addMissing() {
    const added = await addToShopping(extras, recipe!.title);
    success();
    setToast(added ? `${added} item${added === 1 ? '' : 's'} added to your shopping list.` : 'Everything is already on your list.');
  }

  async function confirmCooked() {
    const chosen = cooking?.chosen ?? new Set<string>();
    const refs = usedPantry.filter((p) => chosen.has(p.itemId)).map((p) => ({ receiptId: p.receiptId, itemId: p.itemId }));
    if (refs.length) await setItemsConsumed(refs, true);
    syncReminders();
    await recordCooked(recipe!);
    setCooking(null);
    success();
    setToast(
      refs.length
        ? `Enjoy! ${refs.length} item${refs.length === 1 ? '' : 's'} marked as used up.`
        : 'Enjoy! Logged as cooked.',
    );
  }

  return (
    <Screen topInset={false}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={share} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share recipe">
                <Ionicons name="share-outline" size={24} color={theme.brand} />
              </Pressable>
              <Pressable
                onPress={onToggleFavorite}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Remove from saved recipes' : 'Save recipe'}>
                <Ionicons name={saved ? 'heart' : 'heart-outline'} size={24} color={saved ? theme.danger : theme.brand} />
              </Pressable>
            </View>
          ),
        }}
      />

      {cooking && (
        <Sheet visible title="I cooked this" onClose={() => setCooking(null)}>
          {usedPantry.length > 0 ? (
            <>
              <ThemedText variant="body" color="textSecondary">
                Which of these are used up now? They leave your kitchen and future recipe ideas.
              </ThemedText>
              <Card padded={false}>
                {usedPantry.map((p, idx) => {
                  const on = cooking.chosen.has(p.itemId);
                  return (
                    <View key={p.itemId}>
                      {idx > 0 && <Divider />}
                      <Pressable
                        onPress={() => setCooking({ chosen: toggle(cooking.chosen, p.itemId) })}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        style={styles.ingredient}>
                        <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? theme.brand : theme.textTertiary} />
                        <ThemedText variant="bodyStrong" style={styles.flex}>
                          {p.emoji ? `${p.emoji} ` : ''}
                          {p.name}
                        </ThemedText>
                        <ThemedText variant="caption" color="textSecondary">
                          {Math.round(p.grams)} g
                        </ThemedText>
                      </Pressable>
                    </View>
                  );
                })}
              </Card>
            </>
          ) : (
            <ThemedText variant="body" color="textSecondary">
              None of the ingredients are in your kitchen right now, so nothing needs to be marked as used up.
            </ThemedText>
          )}
          <Button title="Done cooking" icon="checkmark" onPress={confirmCooked} />
        </Sheet>
      )}

      <Animated.View entering={FadeInDown.duration(400)} style={[styles.hero, { backgroundColor: recipeTint(i, scheme) }]}>
        <ThemedText style={styles.emoji}>{recipe.emoji || '🍽️'}</ThemedText>
      </Animated.View>

      <View style={styles.titleBlock}>
        <ThemedText variant="display" style={styles.title}>
          {recipe.title}
        </ThemedText>
        <ThemedText variant="body" color="textSecondary">
          {recipe.description}
        </ThemedText>
        <View style={styles.metaRow}>
          <Meta icon="time-outline" label={`${recipe.time_minutes} min`} />
          <Meta icon="people-outline" label={`${recipe.servings} servings`} />
          <Meta icon="bar-chart-outline" label={recipe.difficulty} />
        </View>
      </View>

      <Banner tone="brand" message={toast} onDismiss={() => setToast(null)} />

      <View style={[styles.why, { backgroundColor: theme.brandSoft }]}>
        <Ionicons name="leaf-outline" size={18} color={theme.brandStrong} />
        <ThemedText variant="captionStrong" color="brandStrong" style={styles.flex}>
          {recipe.why}
        </ThemedText>
      </View>

      <Card>
        <ThemedText variant="overline" color="textTertiary">
          Per serving
        </ThemedText>
        <View style={styles.tiles}>
          <StatTile label="kcal" value={fmt(n.kcal)} />
          <StatTile label="Protein" value={fmt(n.protein_g)} unit="g" />
          <StatTile label="Carbs" value={fmt(n.carbs_g)} unit="g" />
          <StatTile label="Fat" value={fmt(n.fat_g)} unit="g" />
        </View>
        <MacroBar nutrition={{ ...EMPTY_NUTRITION, ...n }} height={8} />
        <View style={styles.legend}>
          {(['protein', 'carbs', 'fat'] as const).map((k) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: MacroColors[k] }]} />
              <ThemedText variant="caption" color="textSecondary">
                {k[0].toUpperCase() + k.slice(1)}
              </ThemedText>
            </View>
          ))}
        </View>
      </Card>

      <SectionHeader
        title="Ingredients"
        action={extras.length > 0 ? <Pressable onPress={addMissing} hitSlop={8} accessibilityRole="button"><ThemedText variant="captionStrong" color="brand">Add missing to list</ThemedText></Pressable> : undefined}
      />
      <Card padded={false}>
        {recipe.ingredients.map((ing, idx) => {
          const have = inKitchen(ing.item);
          const isChecked = checked.has(idx.toString());
          return (
            <View key={`${ing.item}-${idx}`}>
              {idx > 0 && <Divider />}
              <Pressable
                onPress={() => setChecked((s) => toggle(s, idx.toString()))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
                accessibilityLabel={`${ing.amount} ${ing.item}`}
                style={styles.ingredient}>
                <Ionicons
                  name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isChecked ? theme.brand : theme.textTertiary}
                />
                <View style={styles.flex}>
                  <ThemedText
                    variant="bodyStrong"
                    style={isChecked && { textDecorationLine: 'line-through', opacity: 0.5 }}>
                    {ing.item}
                  </ThemedText>
                  <ThemedText variant="caption" color="textSecondary">
                    {ing.amount}
                  </ThemedText>
                </View>
                {have ? (
                  <View style={[styles.tag, { backgroundColor: theme.brandSoft }]}>
                    <ThemedText variant="captionStrong" color="brandStrong" style={styles.tagText}>
                      In kitchen
                    </ThemedText>
                  </View>
                ) : (
                  <View style={[styles.tag, { backgroundColor: theme.warnSoft }]}>
                    <Ionicons name="cart-outline" size={12} color={theme.warn} />
                    <ThemedText variant="captionStrong" color="warn" style={styles.tagText}>
                      To buy
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}
      </Card>

      <SectionHeader title="Steps" />
      <View style={styles.steps}>
        {recipe.steps.map((step, idx) => {
          const isDone = done.has(idx);
          return (
            <Pressable
              key={idx}
              onPress={() => setDone((s) => toggle(s, idx))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone }}
              accessibilityLabel={`Step ${idx + 1}`}
              style={styles.step}>
              <View
                style={[
                  styles.stepNum,
                  { backgroundColor: isDone ? theme.brand : theme.surfaceMuted },
                ]}>
                {isDone ? (
                  <Ionicons name="checkmark" size={16} color={theme.onBrand} />
                ) : (
                  <ThemedText variant="captionStrong">{idx + 1}</ThemedText>
                )}
              </View>
              <ThemedText variant="body" style={[styles.flex, styles.stepText, isDone && { opacity: 0.45 }]}>
                {step}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedText variant="caption" color="textTertiary" style={styles.center}>
        Tap ingredients and steps to tick them off while you cook.
      </ThemedText>

      <Button title="I cooked this" icon="restaurant" onPress={() => setCooking({ chosen: new Set(usedPantry.map((p) => p.itemId)) })} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button title={saved ? 'Saved' : 'Save recipe'} icon={saved ? 'heart' : 'heart-outline'} variant="secondary" onPress={onToggleFavorite} />
        </View>
        <View style={styles.flex}>
          <Button title="Share" icon="share-outline" variant="secondary" onPress={share} />
        </View>
      </View>
      {settings.householdSize !== recipe.servings && (
        <ThemedText variant="caption" color="textTertiary" style={styles.center}>
          Written for {recipe.servings} servings; your household is set to {settings.householdSize}.{' '}
          <ThemedText variant="caption" color="brand" onPress={() => router.navigate('/settings')}>
            Change
          </ThemedText>
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: Spacing.two },
  headerActions: { flexDirection: 'row', gap: Spacing.four, alignItems: 'center' },
  hero: { height: 180, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 96, lineHeight: 112 },
  titleBlock: { gap: Spacing.two },
  title: { fontSize: 28, lineHeight: 34 },
  metaRow: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.one },
  why: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, alignItems: 'center' },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  legend: { flexDirection: 'row', gap: Spacing.four },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 12 },
  steps: { gap: Spacing.four },
  step: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  stepNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepText: { paddingTop: 4 },
});
