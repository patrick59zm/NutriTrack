import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconCircle } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { itemEmoji } from '@/lib/categories';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { freshnessLabel, freshnessTone, type PantryItem } from '@/lib/nutrition';

export function FreshnessPill({ daysLeft }: { daysLeft: number }) {
  const theme = useTheme();
  useT();
  const tone = freshnessTone(daysLeft);
  const colors = {
    danger: [theme.dangerSoft, theme.danger],
    warn: [theme.warnSoft, theme.warn],
    brand: [theme.brandSoft, theme.brandStrong],
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors[0] }]}>
      <View style={[styles.pillDot, { backgroundColor: colors[1] }]} />
      <ThemedText variant="captionStrong" style={{ color: colors[1], fontSize: 12 }}>
        {freshnessLabel(daysLeft)}
      </ThemedText>
    </View>
  );
}

function PantryTile({ item }: { item: PantryItem }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <IconCircle emoji={itemEmoji(item)} size={40} background={theme.surfaceMuted} />
      <ThemedText variant="captionStrong" numberOfLines={2} style={styles.tileName}>
        {item.name}
      </ThemedText>
      <FreshnessPill daysLeft={item.daysLeft} />
    </View>
  );
}

/** Horizontal strip of pantry items, most urgent first. */
export function PantryStrip({ items }: { items: PantryItem[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      style={styles.stripOuter}>
      {items.map((item, i) => (
        <PantryTile key={`${item.receiptId}-${item.name}-${i}`} item={item} />
      ))}
    </ScrollView>
  );
}

/**
 * Compact list row, used for the full pantry. `onConsume` adds a "used up" button and
 * `onPress` makes the item itself tappable (to cook with it).
 */
export function PantryRow({ item, onConsume, onPress }: { item: PantryItem; onConsume?: () => void; onPress?: () => void }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? t('pantry.cookWith', { name: item.name }) : undefined}
        style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.6 }]}>
        <IconCircle emoji={itemEmoji(item)} size={36} />
        <View style={styles.flex}>
          <ThemedText variant="bodyStrong" numberOfLines={1}>
            {item.name}
          </ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {item.boughtDaysAgo === 0 ? t('pantry.boughtToday') : t('pantry.boughtAgo', { n: item.boughtDaysAgo })}
            {item.grams > 0 ? ` · ${Math.round(item.grams)} g` : ''}
          </ThemedText>
        </View>
      </Pressable>
      <FreshnessPill daysLeft={item.daysLeft} />
      {onConsume && (
        <Pressable
          onPress={() => {
            tap();
            onConsume();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('pantry.usedUpA11y', { name: item.name })}
          style={({ pressed }) => [styles.consume, { backgroundColor: theme.surfaceMuted, opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="checkmark-done-outline" size={18} color={theme.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  stripOuter: { marginHorizontal: -Spacing.four },
  strip: { paddingHorizontal: Spacing.four, gap: Spacing.three, paddingVertical: 2 },
  tile: {
    width: 124,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  tileName: { minHeight: 36 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  consume: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
