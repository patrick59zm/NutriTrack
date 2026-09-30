import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { MacroBar } from '@/components/nutrition-summary';
import { Meta, recipeTint } from '@/components/recipe-card';
import { ThemedText } from '@/components/themed-text';
import { Card, Divider, Screen, SectionHeader, StatTile } from '@/components/ui';
import { MacroColors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';
import { EMPTY_NUTRITION, fmt } from '@/lib/nutrition';
import { loadRecipes } from '@/lib/storage';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß ]/g, '').trim();

export default function RecipeScreen() {
  const { index } = useLocalSearchParams<{ index: string }>();
  const i = Number(index);
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { data: batch, loaded } = useFocusData(loadRecipes, null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<number>>(new Set());

  const recipe = batch?.recipes[i];
  if (!loaded) return null;
  if (!recipe) {
    return (
      <Screen topInset={false}>
        <ThemedText>Recipe not found.</ThemedText>
      </Screen>
    );
  }

  const fromKitchen = recipe.uses_items.map(norm);
  const inKitchen = (item: string) => {
    const n = norm(item);
    return fromKitchen.some((k) => k === n || k.includes(n) || n.includes(k));
  };
  const n = recipe.nutrition_per_serving;
  const toggle = <T,>(set: Set<T>, value: T) => {
    tap();
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <Screen topInset={false}>
      <Stack.Screen options={{ title: '' }} />

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

      <SectionHeader title="Ingredients" />
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
                ) : recipe.extra_ingredients_needed.some((e) => norm(e) === norm(ing.item)) ? (
                  <View style={[styles.tag, { backgroundColor: theme.warnSoft }]}>
                    <Ionicons name="cart-outline" size={12} color={theme.warn} />
                    <ThemedText variant="captionStrong" color="warn" style={styles.tagText}>
                      To buy
                    </ThemedText>
                  </View>
                ) : null}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
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
