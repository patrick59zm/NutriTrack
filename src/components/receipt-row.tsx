import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { MacroBar } from '@/components/nutrition-summary';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { fmt } from '@/lib/nutrition';
import type { Receipt } from '@/lib/types';

export function ReceiptRow({ receipt }: { receipt: Receipt }) {
  const foodCount = receipt.items.filter((i) => i.is_food).length;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: receipt.id } })}
      style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">{receipt.store ?? 'Receipt'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {new Date(receipt.purchasedAt).toLocaleDateString()} · {foodCount} food items
              {receipt.totalPrice != null ? ` · ${fmt(receipt.totalPrice, 2)} ${receipt.currency ?? ''}` : ''}
            </ThemedText>
          </View>
          <ThemedText type="smallBold">{fmt(receipt.totals.kcal)} kcal</ThemedText>
        </View>
        <MacroBar nutrition={receipt.totals} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
});
