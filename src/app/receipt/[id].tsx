import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { CategoryBreakdown, MacroBar, NutritionPanel } from '@/components/nutrition-summary';
import { StoreAvatar } from '@/components/receipt-row';
import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, Divider, IconCircle, Screen, SectionHeader } from '@/components/ui';
import { Fonts, MacroColors, Radius, Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { itemEmoji } from '@/lib/categories';
import { tap } from '@/lib/haptics';
import { fmt, money } from '@/lib/nutrition';
import { deleteReceipt, getReceipt } from '@/lib/storage';
import type { Nutrition, ReceiptItem } from '@/lib/types';

export default function ReceiptScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const load = useCallback(() => getReceipt(id), [id]);
  const { data: receipt, loaded } = useFocusData(load, null);
  const [showFresh, setShowFresh] = useState(fresh === '1');
  const theme = useTheme();

  if (!loaded) return null;
  if (!receipt) {
    return (
      <Screen topInset={false}>
        <ThemedText>Receipt not found.</ThemedText>
      </Screen>
    );
  }

  const food = receipt.items.filter((i) => i.is_food);
  const other = receipt.items.filter((i) => !i.is_food);
  const date = new Date(receipt.purchasedAt);

  function confirmDelete() {
    const run = async () => {
      await deleteReceipt(id);
      router.back();
    };
    if (Platform.OS === 'web') {
      run();
      return;
    }
    Alert.alert('Delete receipt?', 'Its items will no longer be used for recipe ideas.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  }

  return (
    <Screen topInset={false}>

      <Animated.View entering={FadeInDown.duration(400)} style={styles.head}>
        <StoreAvatar store={receipt.store} size={60} />
        <View style={styles.flex}>
          <ThemedText variant="title">{receipt.store ?? 'Receipt'}</ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </ThemedText>
        </View>
        {receipt.totalPrice != null && (
          <View style={styles.price}>
            <ThemedText variant="headline">{money(receipt.totalPrice, receipt.currency)}</ThemedText>
            <ThemedText variant="caption" color="textSecondary">
              {receipt.items.length} lines
            </ThemedText>
          </View>
        )}
      </Animated.View>

      {showFresh && (
        <Banner
          tone="brand"
          message={`Added ${food.length} food items to your kitchen`}
          onDismiss={() => setShowFresh(false)}
        />
      )}

      <Animated.View entering={FadeInDown.duration(400).delay(60)}>
        <Card>
          <NutritionPanel nutrition={receipt.totals} caption="kcal total" />
        </Card>
      </Animated.View>

      {food.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400).delay(120)}>
          <Card>
            <ThemedText variant="headline">Where the calories come from</ThemedText>
            <CategoryBreakdown items={receipt.items} />
          </Card>
        </Animated.View>
      )}

      <SectionHeader title={`Items · ${food.length}`} />
      <Animated.View entering={FadeInDown.duration(400).delay(180)}>
        <Card padded={false} style={styles.list}>
          {food.map((item, i) => (
            <View key={`${item.receipt_text}-${i}`}>
              {i > 0 && <Divider />}
              <ItemRow item={item} />
            </View>
          ))}
        </Card>
      </Animated.View>

      {other.length > 0 && (
        <>
          <SectionHeader title="Not food" />
          <Card padded={false} style={styles.list}>
            {other.map((item, i) => (
              <View key={`${item.receipt_text}-${i}`}>
                {i > 0 && <Divider />}
                <View style={styles.itemHead}>
                  <IconCircle emoji={itemEmoji(item)} size={36} />
                  <ThemedText variant="body" color="textSecondary" style={styles.flex}>
                    {item.name}
                  </ThemedText>
                  {item.price != null && (
                    <ThemedText variant="caption" color="textSecondary">
                      {money(item.price, receipt.currency)}
                    </ThemedText>
                  )}
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={16} color={theme.textTertiary} />
        <ThemedText variant="caption" color="textTertiary" style={styles.flex}>
          {receipt.notes ? `${receipt.notes} ` : ''}Values are estimates for typical products, not read from
          the packaging.
        </ThemedText>
      </View>

      <Button title="Cook with these" icon="restaurant" onPress={() => router.navigate('/recipes')} />
      <Button title="Delete receipt" icon="trash-outline" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}

function ItemRow({ item }: { item: ReceiptItem }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const n = item.nutrition_total;

  return (
    <Pressable
      onPress={() => {
        tap();
        setOpen((o) => !o);
      }}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.surfaceMuted : 'transparent' })}>
      <View style={styles.itemHead}>
        <IconCircle emoji={itemEmoji(item)} size={42} />
        <View style={styles.flex}>
          <ThemedText variant="bodyStrong" numberOfLines={open ? undefined : 1}>
            {item.quantity > 1 ? `${fmt(item.quantity)}× ` : ''}
            {item.name}
          </ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            ~{fmt(item.total_weight_g)} g{item.price != null ? ` · ${money(item.price, null)}` : ''}
            {item.confidence === 'low' ? ' · rough estimate' : ''}
          </ThemedText>
        </View>
        <View style={styles.kcal}>
          <ThemedText variant="bodyStrong">{fmt(n.kcal)}</ThemedText>
          <ThemedText variant="caption" color="textTertiary">
            kcal
          </ThemedText>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textTertiary} />
      </View>
      {!open && (
        <View style={styles.miniBar}>
          <MacroBar nutrition={n} height={4} />
        </View>
      )}
      {open && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.details}>
          <View style={[styles.receiptLine, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="receipt-outline" size={13} color={theme.textSecondary} />
            <ThemedText variant="caption" color="textSecondary" style={{ fontFamily: Fonts.mono }}>
              {item.receipt_text}
            </ThemedText>
          </View>
          <NutrientTable total={n} per100={item.nutrition_per_100g} />
        </Animated.View>
      )}
    </Pressable>
  );
}

const ROWS: { key: keyof Nutrition; label: string; unit: string; color?: string; digits?: number }[] = [
  { key: 'kcal', label: 'Energy', unit: 'kcal' },
  { key: 'protein_g', label: 'Protein', unit: 'g', color: MacroColors.protein },
  { key: 'carbs_g', label: 'Carbs', unit: 'g', color: MacroColors.carbs },
  { key: 'sugar_g', label: '  of which sugar', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g', color: MacroColors.fat },
  { key: 'saturated_fat_g', label: '  of which saturated', unit: 'g' },
  { key: 'fiber_g', label: 'Fiber', unit: 'g' },
  { key: 'salt_g', label: 'Salt', unit: 'g', digits: 1 },
];

function NutrientTable({ total, per100 }: { total: Nutrition; per100: Nutrition }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <ThemedText variant="caption" color="textTertiary" style={styles.flex} />
        <ThemedText variant="captionStrong" color="textTertiary" style={styles.cell}>
          per 100 g
        </ThemedText>
        <ThemedText variant="captionStrong" color="textTertiary" style={styles.cell}>
          bought
        </ThemedText>
      </View>
      {ROWS.map((r) => (
        <View key={r.key} style={styles.tableRow}>
          <View style={[styles.flex, styles.tableLabel]}>
            {r.color && <View style={[styles.dot, { backgroundColor: r.color }]} />}
            <ThemedText variant="caption" color={r.label.startsWith(' ') ? 'textSecondary' : 'text'}>
              {r.label.trim()}
            </ThemedText>
          </View>
          <ThemedText variant="caption" color="textSecondary" style={styles.cell}>
            {fmt(per100[r.key], r.digits ?? 1)} {r.unit}
          </ThemedText>
          <ThemedText variant="captionStrong" style={styles.cell}>
            {fmt(total[r.key], r.digits ?? 0)} {r.unit}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  price: { alignItems: 'flex-end' },
  list: { overflow: 'hidden' },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  kcal: { alignItems: 'flex-end' },
  miniBar: {
    paddingLeft: 42 + Spacing.four + Spacing.three,
    paddingRight: Spacing.four,
    marginTop: -4,
    paddingBottom: Spacing.three,
  },
  details: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.three },
  receiptLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  table: { gap: 6 },
  tableRow: { flexDirection: 'row', alignItems: 'center' },
  tableLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cell: { width: 88, textAlign: 'right' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  note: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
});
