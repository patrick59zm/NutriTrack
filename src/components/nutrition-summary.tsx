import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { StatTile } from '@/components/ui';
import { MacroColors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoryMeta } from '@/lib/categories';
import { fmt, macroSplit } from '@/lib/nutrition';
import type { Nutrition, ReceiptItem } from '@/lib/types';

const MACROS = [
  { key: 'protein', label: 'Protein', grams: 'protein_g' },
  { key: 'carbs', label: 'Carbs', grams: 'carbs_g' },
  { key: 'fat', label: 'Fat', grams: 'fat_g' },
] as const;

/** Donut showing the energy split between protein, carbs and fat, with kcal in the middle. */
export function MacroRing({
  nutrition,
  size = 132,
  stroke = 14,
  caption = 'kcal',
}: {
  nutrition: Nutrition;
  size?: number;
  stroke?: number;
  caption?: string;
}) {
  const theme = useTheme();
  const split = macroSplit(nutrition);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const hasData = nutrition.kcal > 0;
  const gap = hasData ? Math.min(6, c * 0.015) : 0;

  let offset = 0;
  const arcs = MACROS.map((m) => {
    const len = split[m.key] * c;
    const arc = { key: m.key, color: MacroColors[m.key], len: Math.max(len - gap, 0), offset };
    offset += len;
    return arc;
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.surfaceMuted} strokeWidth={stroke} fill="none" />
          {hasData &&
            arcs.map((a) =>
              a.len > 0 ? (
                <Circle
                  key={a.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={a.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${a.len} ${c}`}
                  strokeDashoffset={-a.offset}
                />
              ) : null,
            )}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <ThemedText variant="number" style={{ fontSize: size * 0.2, lineHeight: size * 0.24 }}>
          {fmt(nutrition.kcal)}
        </ThemedText>
        <ThemedText variant="caption" color="textSecondary">
          {caption}
        </ThemedText>
      </View>
    </View>
  );
}

export function MacroBar({ nutrition, height = 6 }: { nutrition: Nutrition; height?: number }) {
  const theme = useTheme();
  const split = macroSplit(nutrition);
  return (
    <View style={[styles.bar, { height, borderRadius: height / 2, backgroundColor: theme.surfaceMuted }]}>
      {nutrition.kcal > 0 &&
        MACROS.map((m) => (
          <View key={m.key} style={{ flex: split[m.key] || 0.0001, backgroundColor: MacroColors[m.key] }} />
        ))}
    </View>
  );
}

function MacroLegend({ nutrition }: { nutrition: Nutrition }) {
  const split = macroSplit(nutrition);
  return (
    <View style={styles.legend}>
      {MACROS.map((m) => (
        <View key={m.key} style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: MacroColors[m.key] }]} />
          <View style={styles.flex}>
            <ThemedText variant="caption" color="textSecondary">
              {m.label}
            </ThemedText>
            <ThemedText variant="bodyStrong">
              {fmt(nutrition[m.grams])} g{' '}
              <ThemedText variant="caption" color="textTertiary">
                {nutrition.kcal > 0 ? `${Math.round(split[m.key] * 100)}%` : ''}
              </ThemedText>
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Ring, macro legend and the secondary nutrients as tiles. */
export function NutritionPanel({ nutrition, caption }: { nutrition: Nutrition; caption?: string }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelTop}>
        <MacroRing nutrition={nutrition} caption={caption} />
        <MacroLegend nutrition={nutrition} />
      </View>
      <View style={styles.tiles}>
        <StatTile label="Sugar" value={fmt(nutrition.sugar_g)} unit="g" />
        <StatTile label="Fiber" value={fmt(nutrition.fiber_g)} unit="g" />
        <StatTile label="Sat. fat" value={fmt(nutrition.saturated_fat_g)} unit="g" />
        <StatTile label="Salt" value={fmt(nutrition.salt_g, 1)} unit="g" />
      </View>
    </View>
  );
}

/** Where the calories come from, by product category. */
export function CategoryBreakdown({ items }: { items: ReceiptItem[] }) {
  const theme = useTheme();
  const byCategory = new Map<string, number>();
  for (const i of items) {
    if (!i.is_food) continue;
    byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + i.nutrition_total.kcal);
  }
  const total = [...byCategory.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const rows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.breakdown}>
      <View style={[styles.bar, { height: 12, borderRadius: 6, backgroundColor: theme.surfaceMuted }]}>
        {rows.map(([cat, kcal]) => (
          <View key={cat} style={{ flex: kcal / total, backgroundColor: categoryMeta(cat).color }} />
        ))}
      </View>
      <View style={styles.breakdownLegend}>
        {rows.map(([cat, kcal]) => {
          const meta = categoryMeta(cat);
          return (
            <View key={cat} style={styles.breakdownItem}>
              <View style={[styles.dot, { backgroundColor: meta.color }]} />
              <ThemedText variant="caption">
                {meta.emoji} {meta.label}
              </ThemedText>
              <ThemedText variant="caption" color="textTertiary">
                {Math.round((kcal / total) * 100)}%
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', overflow: 'hidden', gap: 2 },
  panel: { gap: Spacing.four },
  panelTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.five },
  legend: { flex: 1, gap: Spacing.two },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  breakdown: { gap: Spacing.three },
  breakdownLegend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.four, rowGap: Spacing.two },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.sm },
});
