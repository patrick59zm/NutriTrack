import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { fmt, macroSplit } from '@/lib/nutrition';
import type { Nutrition } from '@/lib/types';

const MACRO_COLORS = { protein: '#E5484D', carbs: '#F5A524', fat: '#3E7BFA' };

export function MacroBar({ nutrition }: { nutrition: Nutrition }) {
  const split = macroSplit(nutrition);
  return (
    <View style={styles.bar}>
      {(['protein', 'carbs', 'fat'] as const).map((k) => (
        <View key={k} style={{ flex: split[k] || 0.0001, backgroundColor: MACRO_COLORS[k] }} />
      ))}
    </View>
  );
}

export function NutritionSummary({ nutrition, label }: { nutrition: Nutrition; label?: string }) {
  const split = macroSplit(nutrition);
  return (
    <View style={styles.container}>
      <View style={styles.headline}>
        <ThemedText type="subtitle">{fmt(nutrition.kcal)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          kcal{label ? ` · ${label}` : ''}
        </ThemedText>
      </View>
      <MacroBar nutrition={nutrition} />
      <View style={styles.legend}>
        <Legend color={MACRO_COLORS.protein} label="Protein" grams={nutrition.protein_g} share={split.protein} />
        <Legend color={MACRO_COLORS.carbs} label="Carbs" grams={nutrition.carbs_g} share={split.carbs} />
        <Legend color={MACRO_COLORS.fat} label="Fat" grams={nutrition.fat_g} share={split.fat} />
      </View>
      <View style={styles.grid}>
        <Stat label="Sugar" value={`${fmt(nutrition.sugar_g)} g`} />
        <Stat label="Sat. fat" value={`${fmt(nutrition.saturated_fat_g)} g`} />
        <Stat label="Fiber" value={`${fmt(nutrition.fiber_g)} g`} />
        <Stat label="Salt" value={`${fmt(nutrition.salt_g, 1)} g`} />
      </View>
    </View>
  );
}

function Legend({ color, label, grams, share }: { color: string; label: string; grams: number; share: number }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small">
        {label} {fmt(grams)} g
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {Math.round(share * 100)}%
      </ThemedText>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  stat: { minWidth: 70 },
});
