import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ReceiptRow } from '@/components/receipt-row';
import { SpendingBreakdown } from '@/components/spending';
import { ThemedText } from '@/components/themed-text';
import { TrendsChart } from '@/components/trends-chart';
import { Button, Card, EmptyState, Screen, StatTile } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { t, useT } from '@/lib/i18n';
import { searchReceipts, weeklySeries } from '@/lib/insights';
import { daysSince, fmt, money, receiptSpend, receiptsWithin, sum } from '@/lib/nutrition';
import { loadDemoData, loadReceipts, loadSettings } from '@/lib/storage';
import { DEFAULT_SETTINGS, type Receipt } from '@/lib/types';

function groupByAge(receipts: Receipt[]) {
  const groups: { title: string; items: Receipt[] }[] = [
    { title: t('history.thisWeek'), items: [] },
    { title: t('history.lastWeek'), items: [] },
    { title: t('history.earlier'), items: [] },
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
  const t = useT();
  const { data, loaded, reload } = useFocusData(loadHistory, { receipts: [], settings: DEFAULT_SETTINGS });
  const { receipts, settings } = data;
  const [query, setQuery] = useState('');

  const month = receiptsWithin(receipts, 30);
  const monthTotals = sum(month.map((r) => r.totals));
  const monthSpent = month.reduce((a, r) => a + receiptSpend(r), 0);
  const weeks = weeklySeries(receipts, 8);
  const shown = searchReceipts(receipts, query);
  const perPersonDay = monthTotals.kcal / 30 / Math.max(1, settings.householdSize);

  return (
    <Screen
      title={t('history.title')}
      subtitle={receipts.length ? t('history.subtitle', { n: receipts.length }) : undefined}>
      {loaded && receipts.length === 0 && (
        <EmptyState
          emoji="🧾"
          title={t('history.emptyTitle')}
          message={t('history.emptyMessage')}>
          <Button title={t('common.scanReceipt')} icon="scan" onPress={() => router.navigate('/')} />
          <Button
            title={t('common.loadSample')}
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
              {t('history.last30')}
            </ThemedText>
            <View style={styles.stats}>
              <StatTile label={t('common.energy')} value={fmt(monthTotals.kcal)} unit="kcal" icon="flame" />
              <StatTile label={t('history.perPerson')} value={fmt(perPersonDay)} unit={t('history.perDayUnit')} icon="person-outline" />
              <StatTile label={t('home.spent')} value={money(monthSpent, settings.currency)} icon="wallet-outline" />
            </View>
          </Card>
        </Animated.View>
      )}

      {monthSpent > 0 && (
        <Animated.View entering={FadeInDown.duration(400).delay(40)}>
          <Card>
            <ThemedText variant="headline">{t('spending.title')}</ThemedText>
            <ThemedText variant="caption" color="textSecondary">
              {t('spending.total', { amount: money(monthSpent, settings.currency) })}
            </ThemedText>
            <SpendingBreakdown receipts={month} currency={settings.currency} />
          </Card>
        </Animated.View>
      )}

      {receipts.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400).delay(60)}>
          <Card>
            <ThemedText variant="headline">{t('history.last8weeks')}</ThemedText>
            <TrendsChart points={weeks} value={(p) => p.kcal} format={(n) => `${fmt(n)} kcal`} title={t('history.kcalPerWeek')} />
            <TrendsChart
              points={weeks}
              value={(p) => p.spent}
              format={(n) => money(n, settings.currency)}
              title={t('history.spentPerWeek')}
            />
            <TrendsChart
              points={weeks}
              value={(p) => (p.nutrition.kcal > 0 ? ((p.nutrition.sugar_g * 4) / p.nutrition.kcal) * 100 : 0)}
              format={(n) => `${Math.round(n)}%`}
              title={t('history.sugarPerWeek')}
            />
            <ThemedText variant="caption" color="textTertiary">
              {t('history.chartHint')}
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
            placeholder={t('history.searchPlaceholder')}
            placeholderTextColor={theme.textTertiary}
            accessibilityLabel={t('history.search')}
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('history.clearSearch')}>
              <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
            </Pressable>
          )}
        </View>
      )}

      {query.trim() && shown.length === 0 && (
        <ThemedText variant="body" color="textSecondary">
          {t('history.noMatch', { q: query.trim() })}
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
