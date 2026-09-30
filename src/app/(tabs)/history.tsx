import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ReceiptRow } from '@/components/receipt-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Screen, StatTile } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { daysSince, fmt, money, receiptsWithin, sum } from '@/lib/nutrition';
import { loadDemoData, loadReceipts } from '@/lib/storage';
import type { Receipt } from '@/lib/types';

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

export default function HistoryScreen() {
  const { data: receipts, loaded, reload } = useFocusData(loadReceipts, []);

  const month = receiptsWithin(receipts, 30);
  const monthTotals = sum(month.map((r) => r.totals));
  const monthSpent = month.reduce((a, r) => a + (r.totalPrice ?? 0), 0);

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
              <StatTile label="Protein" value={fmt(monthTotals.protein_g)} unit="g" icon="barbell-outline" />
              <StatTile label="Spent" value={money(monthSpent, 'EUR')} icon="wallet-outline" />
            </View>
          </Card>
        </Animated.View>
      )}

      {groupByAge(receipts).map((group, gi) => (
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
});
