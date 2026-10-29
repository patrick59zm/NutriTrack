import { StyleSheet, View } from 'react-native';

import { StoreAvatar } from '@/components/receipt-row';
import { ThemedText } from '@/components/themed-text';
import { Divider } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoryMeta } from '@/lib/categories';
import { useT } from '@/lib/i18n';
import { spendingByCategory, spendingByStore } from '@/lib/insights';
import { money } from '@/lib/nutrition';
import type { Currency, Receipt } from '@/lib/types';

/** Where the money went: a bar by product category, then the stores. */
export function SpendingBreakdown({ receipts, currency }: { receipts: Receipt[]; currency: Currency }) {
  const theme = useTheme();
  const t = useT();
  const categories = spendingByCategory(receipts);
  const total = categories.reduce((a, c) => a + c.amount, 0);
  const stores = spendingByStore(receipts);
  if (total <= 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { backgroundColor: theme.surfaceMuted }]}>
        {categories.map((c) => (
          <View key={c.category} style={{ flex: c.amount / total, backgroundColor: categoryMeta(c.category).color }} />
        ))}
      </View>
      <View style={styles.legend}>
        {categories.slice(0, 8).map((c) => {
          const meta = categoryMeta(c.category);
          return (
            <View key={c.category} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: meta.color }]} />
              <ThemedText variant="caption">
                {meta.emoji} {meta.label}
              </ThemedText>
              <ThemedText variant="captionStrong" color="textSecondary">
                {money(c.amount, currency)}
              </ThemedText>
            </View>
          );
        })}
      </View>
      <ThemedText variant="captionStrong" color="textTertiary" style={styles.storesTitle}>
        {t('spending.byStore')}
      </ThemedText>
      {stores.slice(0, 6).map((s, i) => (
        <View key={`${s.store}-${i}`}>
          {i > 0 && <Divider />}
          <View style={styles.store}>
            <StoreAvatar store={s.store} size={32} />
            <View style={styles.flex}>
              <ThemedText variant="bodyStrong" numberOfLines={1}>
                {s.store ?? t('common.receipt')}
              </ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                {t('common.receipts', { n: s.receipts })}
              </ThemedText>
            </View>
            <ThemedText variant="bodyStrong">{money(s.amount, currency)}</ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: Spacing.three },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.four, rowGap: Spacing.two },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  storesTitle: { marginTop: Spacing.one },
  store: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
});
