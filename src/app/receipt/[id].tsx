import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useCallback } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { NutritionSummary } from '@/components/nutrition-summary';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { fmt } from '@/lib/nutrition';
import { deleteReceipt, getReceipt } from '@/lib/storage';
import type { ReceiptItem } from '@/lib/types';

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => getReceipt(id), [id]);
  const { data: receipt, loaded } = useFocusData(load, null);

  if (!loaded) return null;
  if (!receipt) {
    return (
      <Screen>
        <ThemedText>Receipt not found.</ThemedText>
      </Screen>
    );
  }

  const food = receipt.items.filter((i) => i.is_food);
  const other = receipt.items.filter((i) => !i.is_food);

  function confirmDelete() {
    const run = async () => {
      await deleteReceipt(id);
      router.back();
    };
    if (Platform.OS === 'web') {
      run();
      return;
    }
    Alert.alert('Delete receipt?', 'Its items will no longer be used for recipes.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: receipt.store ?? 'Receipt' }} />
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {new Date(receipt.purchasedAt).toLocaleDateString()}
          {receipt.totalPrice != null ? ` · ${fmt(receipt.totalPrice, 2)} ${receipt.currency ?? ''}` : ''}
        </ThemedText>
        <NutritionSummary nutrition={receipt.totals} label="whole purchase" />
      </Card>

      <SectionTitle>Items ({food.length})</SectionTitle>
      {food.map((item, i) => (
        <ItemCard key={`${item.receipt_text}-${i}`} item={item} />
      ))}

      {other.length > 0 && (
        <>
          <SectionTitle>Not food</SectionTitle>
          <Card>
            {other.map((item, i) => (
              <ThemedText key={`${item.receipt_text}-${i}`} type="small" themeColor="textSecondary">
                {item.name}
              </ThemedText>
            ))}
          </Card>
        </>
      )}

      {receipt.notes && (
        <ThemedText type="small" themeColor="textSecondary">
          Note: {receipt.notes}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        Values are estimates from typical products, not from the actual packaging.
      </ThemedText>

      <Button title="Recipe ideas" onPress={() => router.navigate('/recipes')} />
      <Button title="Delete receipt" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}

function ItemCard({ item }: { item: ReceiptItem }) {
  const n = item.nutrition_total;
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">
            {item.quantity > 1 ? `${fmt(item.quantity)} × ` : ''}
            {item.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.receipt_text} · ~{fmt(item.total_weight_g)} g
            {item.confidence === 'low' ? ' · rough guess' : ''}
          </ThemedText>
        </View>
        <ThemedText type="smallBold">{fmt(n.kcal)} kcal</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        P {fmt(n.protein_g)} g · C {fmt(n.carbs_g)} g (sugar {fmt(n.sugar_g)} g) · F {fmt(n.fat_g)} g · Fiber{' '}
        {fmt(n.fiber_g)} g · Salt {fmt(n.salt_g, 1)} g
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        per 100 g: {fmt(item.nutrition_per_100g.kcal)} kcal
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
});
