import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Chip, Field, Sheet, SwitchRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { CATEGORY_META, categoryMeta, itemEmoji } from '@/lib/categories';
import { describeError, estimateItem } from '@/lib/claude';
import { failure, success } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
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
  const t = useT();

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
      setError(t('editor.nameRequired'));
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

  const title = item ? t('editor.editTitle') : t('editor.addTitle');
  const per100 = draft?.nutrition_per_100g;

  return (
    <Sheet visible title={title} onClose={onClose}>
      {!draft ? (
        <>
          <Field
            label={t('editor.whatBought')}
            placeholder={t('editor.placeholder')}
            value={description}
            onChangeText={setDescription}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => description.trim() && estimate(description)}
          />
          <ThemedText variant="caption" color="textTertiary">
            {t('editor.claudeFills')}
          </ThemedText>
          <Banner message={error} onDismiss={() => setError(null)} />
          <Button
            title={busy ? t('editor.estimating') : t('editor.estimate')}
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
                {categoryMeta(draft.category).label}
                {per100 ? t('editor.kcalPer100', { kcal: fmt(per100.kcal) }) : ''}
              </ThemedText>
              {draft.receipt_text && draft.receipt_text !== draft.name && (
                <ThemedText variant="caption" color="textTertiary">
                  {t('editor.onReceipt', { text: draft.receipt_text })}
                </ThemedText>
              )}
            </View>
          </View>

          <Field label={t('editor.name')} value={name} onChangeText={setName} autoCapitalize="sentences" />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label={t('editor.quantity')} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
            </View>
            <View style={styles.flex}>
              <Field
                label={t('editor.weight')}
                value={weight}
                onChangeText={setWeight}
                keyboardType="number-pad"
                hint={t('editor.mlHint')}
              />
            </View>
            <View style={styles.flex}>
              <Field label={t('editor.price', { currency: settings.currency })} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
            </View>
          </View>

          <SwitchRow
            label={t('editor.food')}
            detail={t('editor.foodDetail')}
            value={draft.is_food}
            onChange={(is_food) => setDraft({ ...draft, is_food })}
          />

          <View style={styles.categories}>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <Chip
                key={key}
                label={`${meta.emoji} ${t(meta.key)}`}
                selected={draft.category === key}
                onPress={() => setDraft({ ...draft, category: key, is_food: key !== 'non_food' && draft.is_food })}
              />
            ))}
          </View>

          <Banner message={error} onDismiss={() => setError(null)} />

          <Button
            title={busy ? t('editor.estimating') : t('editor.reestimate')}
            icon="sparkles"
            variant="secondary"
            loading={busy}
            disabled={!name.trim()}
            onPress={() => estimate(name)}
          />
          <Button title={item ? t('editor.saveChanges') : t('editor.addToReceipt')} icon="checkmark" onPress={save} />
          {onDelete && <Button title={t('editor.removeItem')} icon="trash-outline" variant="danger" onPress={onDelete} />}
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
