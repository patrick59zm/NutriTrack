import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Chip, Field, Sheet, SwitchRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { CATEGORY_META, itemEmoji } from '@/lib/categories';
import { describeError, estimateItem } from '@/lib/claude';
import { failure, success } from '@/lib/haptics';
import { fmt, withTotals } from '@/lib/nutrition';
import type { ReceiptItem, Settings } from '@/lib/types';

const parseNumber = (text: string) => {
  const n = Number(text.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * Edits one receipt item, or adds a new one. Adding starts from a description ("Bananen
 * 1 kg") that Claude turns into an item; the result can still be changed before saving.
 */
export function ItemEditor({
  item,
  settings,
  onSave,
  onDelete,
  onClose,
}: {
  item: ReceiptItem | null;
  settings: Settings;
  onSave: (item: ReceiptItem) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  // The parent mounts a fresh editor per item (keyed by item id), so the form starts from props.
  const [draft, setDraft] = useState<ReceiptItem | null>(item);
  const [description, setDescription] = useState('');
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item ? fmt(item.quantity, 2) : '');
  const [weight, setWeight] = useState(item ? String(Math.round(item.total_weight_g)) : '');
  const [price, setPrice] = useState(item?.price != null ? item.price.toFixed(2) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function estimate(text: string) {
    setError(null);
    setBusy(true);
    try {
      const estimated = await estimateItem(text, settings);
      setDraft(estimated);
      setName(estimated.name);
      setQuantity(fmt(estimated.quantity, 2));
      setWeight(String(Math.round(estimated.total_weight_g)));
      setPrice(estimated.price != null ? estimated.price.toFixed(2) : '');
      success();
    } catch (e) {
      failure();
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!draft) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the item a name.');
      return;
    }
    const q = parseNumber(quantity);
    const w = parseNumber(weight);
    const next: ReceiptItem = withTotals(
      {
        ...draft,
        name: trimmed,
        quantity: q && q > 0 ? q : 1,
        total_weight_g: w && w >= 0 ? w : draft.total_weight_g,
        price: price.trim() ? parseNumber(price) : null,
        edited: true,
      },
      draft.id,
    );
    onSave(next);
  }

  const title = item ? 'Edit item' : 'Add item';
  const per100 = draft?.nutrition_per_100g;

  return (
    <Sheet visible title={title} onClose={onClose}>
      {!draft ? (
        <>
          <Field
            label="What did you buy?"
            placeholder="e.g. Bananen 1 kg, Greek yogurt 500 g"
            value={description}
            onChangeText={setDescription}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => description.trim() && estimate(description)}
          />
          <ThemedText variant="caption" color="textTertiary">
            Claude fills in weight, nutrition and shelf life from the name. You can adjust everything
            afterwards.
          </ThemedText>
          <Banner message={error} onDismiss={() => setError(null)} />
          <Button
            title={busy ? 'Estimating…' : 'Estimate with Claude'}
            icon="sparkles"
            loading={busy}
            disabled={!description.trim()}
            onPress={() => estimate(description)}
          />
        </>
      ) : (
        <>
          <View style={styles.preview}>
            <ThemedText style={styles.previewEmoji}>{itemEmoji(draft)}</ThemedText>
            <View style={styles.flex}>
              <ThemedText variant="caption" color="textSecondary">
                {CATEGORY_META[draft.category]?.label ?? 'Other food'}
                {per100 ? ` · ${fmt(per100.kcal)} kcal per 100 g` : ''}
              </ThemedText>
              {draft.receipt_text && draft.receipt_text !== draft.name && (
                <ThemedText variant="caption" color="textTertiary">
                  On the receipt: {draft.receipt_text}
                </ThemedText>
              )}
            </View>
          </View>

          <Field label="Name" value={name} onChangeText={setName} autoCapitalize="sentences" />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
            </View>
            <View style={styles.flex}>
              <Field
                label="Total weight (g)"
                value={weight}
                onChangeText={setWeight}
                keyboardType="number-pad"
                hint="ml for drinks"
              />
            </View>
            <View style={styles.flex}>
              <Field label={`Price (${settings.currency})`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
            </View>
          </View>

          <SwitchRow
            label="Food"
            detail="Off for deposits, bags, household goods"
            value={draft.is_food}
            onChange={(is_food) => setDraft({ ...draft, is_food })}
          />

          <View style={styles.categories}>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <Chip
                key={key}
                label={`${meta.emoji} ${meta.label}`}
                selected={draft.category === key}
                onPress={() => setDraft({ ...draft, category: key, is_food: key !== 'non_food' && draft.is_food })}
              />
            ))}
          </View>

          <Banner message={error} onDismiss={() => setError(null)} />

          <Button
            title={busy ? 'Estimating…' : 'Re-estimate nutrition from the name'}
            icon="sparkles"
            variant="secondary"
            loading={busy}
            disabled={!name.trim()}
            onPress={() => estimate(name)}
          />
          <Button title={item ? 'Save changes' : 'Add to receipt'} icon="checkmark" onPress={save} />
          {onDelete && <Button title="Remove item" icon="trash-outline" variant="danger" onPress={onDelete} />}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.two },
  preview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  previewEmoji: { fontSize: 36, lineHeight: 44 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
