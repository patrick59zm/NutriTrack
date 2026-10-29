import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Chip, Field, Sheet } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { normalizeCurrency } from '@/lib/nutrition';
import { parseLocalDate } from '@/lib/parse';
import type { Currency, Receipt } from '@/lib/types';

const CURRENCIES: Currency[] = ['CHF', 'EUR', 'USD', 'GBP'];

export type ReceiptDetails = Pick<Receipt, 'store' | 'purchasedAt' | 'totalPrice' | 'currency'>;

const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const dayOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDay(d);
};

/**
 * Corrects what the scan read about the receipt itself: store, purchase date (which the
 * freshness of every item counts from), the printed total and the currency.
 */
export function ReceiptDetailsEditor({
  receipt,
  onSave,
  onClose,
}: {
  receipt: Receipt;
  onSave: (details: ReceiptDetails) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [store, setStore] = useState(receipt.store ?? '');
  const [date, setDate] = useState(localDay(new Date(receipt.purchasedAt)));
  const [total, setTotal] = useState(receipt.totalPrice != null ? receipt.totalPrice.toFixed(2) : '');
  const [currency, setCurrency] = useState<Currency>(normalizeCurrency(receipt.currency));
  const [error, setError] = useState<string | null>(null);

  function save() {
    const day = parseLocalDate(date.trim());
    if (!day) {
      setError(t('details.invalidDate'));
      return;
    }
    const amount = Number(total.trim().replace(',', '.'));
    onSave({
      store: store.trim() || null,
      purchasedAt: day.toISOString(),
      totalPrice: total.trim() && Number.isFinite(amount) ? amount : null,
      currency,
    });
  }

  return (
    <Sheet visible title={t('details.title')} onClose={onClose}>
      <Field label={t('details.store')} value={store} onChangeText={setStore} autoCapitalize="words" />
      <Field
        label={t('details.date')}
        value={date}
        onChangeText={(v) => {
          setDate(v);
          setError(null);
        }}
        hint={t('details.dateHint')}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
      />
      <View style={styles.chips}>
        <Chip label={t('day.today')} selected={date === dayOffset(0)} onPress={() => setDate(dayOffset(0))} />
        <Chip label={t('day.yesterday')} selected={date === dayOffset(1)} onPress={() => setDate(dayOffset(1))} />
      </View>
      <Field label={t('details.total')} value={total} onChangeText={setTotal} keyboardType="decimal-pad" />
      <ThemedText variant="captionStrong" color="textSecondary">
        {t('settings.currency')}
      </ThemedText>
      <View style={styles.chips}>
        {CURRENCIES.map((code) => (
          <Chip key={code} label={code} selected={currency === code} onPress={() => setCurrency(code)} />
        ))}
      </View>
      <Banner message={error} onDismiss={() => setError(null)} />
      <Button title={t('details.save')} icon="checkmark" onPress={save} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
