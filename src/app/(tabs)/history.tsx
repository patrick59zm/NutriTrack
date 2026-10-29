import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ReceiptRow } from '@/components/receipt-row';
import { ThemedText } from '@/components/themed-text';
import { TrendsChart } from '@/components/trends-chart';
import { Button, Card, EmptyState, Screen, StatTile } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { searchReceipts, weeklySeries } from '@/lib/insights';
import { daysSince, fmt, money, receiptsWithin, sum } from '@/lib/nutrition';
import { loadDemoData, loadReceipts, loadSettings } from '@/lib/storage';
import { DEFAULT_SETTINGS, type Receipt } from '@/lib/types';

function groupByAge(receipts: Receipt[]) {
  const groups: { title: string; items: Receipt[] }[] = [
    { title: 'This week', items: [] },
    { title: 'Last week', items: [] },
    { title: 'Earlier', items: [] },
  ];
  for (const r of receipts) {
    const d = daysSince(r.purchasedAt);
    groups[d < 7 ? 0 : d < 14 ? 1 : 2].items.push(r);
  }
  return groups.filter((g) => g.items.length > 0);
}

const loadHistory = async () => {
  const [receipts, settings] = await Promise.all([loadReceipts(), loadSettings()]);
  return { receipts, settings };
};

export default function HistoryScreen() {
  const theme = useTheme();
  const { data, loaded, reload } = useFocusData(loadHistory, { receipts: [], settings: DEFAULT_SETTINGS });
  const { receipts, settings } = data;
  const [query, setQuery] = useState('');

  const month = receiptsWithin(receipts, 30);
  const monthTotals = sum(month.map((r) => r.totals));
  const monthSpent = month.reduce((a, r) => a + (r.totalPrice ?? 0), 0);
  const weeks = weeklySeries(receipts, 8);
  const shown = searchReceipts(receipts, query);
  const perPersonDay = monthTotals.kcal / 30 / Math.max(1, settings.householdSize);

  return (
    <Screen
      title="Receipts"
      subtitle={
        receipts.length
          ? `${receipts.length} shopping trip${receipts.length === 1 ? '' : 's'} saved on this device`
          : undefined
      }>
      {loaded && receipts.length === 0 && (
        <EmptyState
          emoji="🧾"
          title="No receipts yet"
          message="Every receipt you scan lands here, with its full nutrition breakdown.">
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
      )}

      {month.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card>
            <ThemedText variant="overline" color="textTertiary">
              Last 30 days
            </ThemedText>
            <View style={styles.stats}>
              <StatTile label="Energy" value={fmt(monthTotals.kcal)} unit="kcal" icon="flame" />
              <StatTile label="Per person" value={fmt(perPersonDay)} unit="kcal/day" icon="person-outline" />
              <StatTile label="Spent" value={money(monthSpent, settings.currency)} icon="wallet-outline" />
            </View>
          </Card>
        </Animated.View>
      )}

      {receipts.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400).delay(60)}>
          <Card>
            <ThemedText variant="headline">Last 8 weeks</ThemedText>
            <TrendsChart points={weeks} value={(p) => p.kcal} format={(n) => `${fmt(n)} kcal`} title="Calories bought per week" />
            <TrendsChart
              points={weeks}
              value={(p) => p.spent}
              format={(n) => money(n, settings.currency)}
              title="Spent per week"
            />
            <ThemedText variant="caption" color="textTertiary">
              Tap a week for its value. Weeks start on Monday.
            </ThemedText>
          </Card>
        </Animated.View>
      )}

      {receipts.length > 2 && (
        <View style={[styles.search, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Ionicons name="search-outline" size={18} color={theme.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search stores and items"
            placeholderTextColor={theme.textTertiary}
            accessibilityLabel="Search receipts"
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
            </Pressable>
          )}
        </View>
      )}

      {query.trim() && shown.length === 0 && (
        <ThemedText variant="body" color="textSecondary">
          Nothing matches “{query.trim()}”.
        </ThemedText>
      )}

      {groupByAge(shown).map((group, gi) => (
        <Animated.View key={group.title} entering={FadeInDown.duration(400).delay(80 * (gi + 1))} style={styles.group}>
          <ThemedText variant="overline" color="textTertiary" style={styles.groupTitle}>
            {group.title}
          </ThemedText>
          {group.items.map((r) => (
            <ReceiptRow key={r.id} receipt={r} />
          ))}
        </Animated.View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: Spacing.two },
  group: { gap: Spacing.three },
  groupTitle: { marginTop: Spacing.two },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.three, fontSize: 16 },
});
