import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ImageFileInput } from '@/components/image-file-input';
import { ItemEditor } from '@/components/item-editor';
import { CategoryBreakdown, MacroBar, NutritionPanel } from '@/components/nutrition-summary';
import { PhotoViewer } from '@/components/photo-viewer';
import { StoreAvatar } from '@/components/receipt-row';
import { ScanningOverlay } from '@/components/scanning-overlay';
import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, Divider, IconCircle, Screen, SectionHeader, TextLink } from '@/components/ui';
import { Fonts, MacroColors, Radius, Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useScanner } from '@/hooks/use-scanner';
import { useTheme } from '@/hooks/use-theme';
import { itemEmoji } from '@/lib/categories';
import { tap } from '@/lib/haptics';
import { fmt, money, priceCheck, recomputeReceipt } from '@/lib/nutrition';
import { deleteReceipt, getReceipt, loadSettings, updateReceipt } from '@/lib/storage';
import { DEFAULT_SETTINGS, type Nutrition, type Receipt, type ReceiptItem } from '@/lib/types';

type Editing = { kind: 'edit'; item: ReceiptItem } | { kind: 'add' } | null;

export default function ReceiptScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const load = useCallback(async () => {
    const [receipt, settings] = await Promise.all([getReceipt(id), loadSettings()]);
    return { receipt, settings };
  }, [id]);
  const { data, setData, loaded, reload } = useFocusData(load, { receipt: null as Receipt | null, settings: DEFAULT_SETTINGS });
  const [showFresh, setShowFresh] = useState(fresh === '1');
  const [editing, setEditing] = useState<Editing>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [rescanOpen, setRescanOpen] = useState(false);
  const theme = useTheme();

  const scanner = useScanner({
    replaceId: id,
    onDone: () => {
      setRescanOpen(false);
      setShowFresh(true);
      reload();
    },
  });

  const { receipt, settings } = data;

  const apply = useCallback(
    async (change: (r: Receipt) => Receipt) => {
      const next = await updateReceipt(id, (r) => recomputeReceipt(change(r)));
      if (next) setData((d) => ({ ...d, receipt: next }));
    },
    [id, setData],
  );

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
  const check = priceCheck(receipt.items, receipt.totalPrice);
  const cost = receipt.usage;

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

  const saveItem = (item: ReceiptItem) => {
    apply((r) => {
      const exists = r.items.some((i) => i.id === item.id);
      return {
        ...r,
        items: exists ? r.items.map((i) => (i.id === item.id ? item : i)) : [...r.items, item],
        // Hand-checked items settle the price question.
        warnings: undefined,
      };
    });
    setEditing(null);
  };
  const removeItem = (itemId: string) => {
    apply((r) => ({ ...r, items: r.items.filter((i) => i.id !== itemId), warnings: undefined }));
    setEditing(null);
  };
  const toggleFood = (item: ReceiptItem) =>
    apply((r) => ({
      ...r,
      items: r.items.map((i) => (i.id === item.id ? { ...i, is_food: !i.is_food, edited: true } : i)),
    }));

  const rescanButtons = (
    <View style={styles.rescanRow}>
      {scanner.isWeb ? (
        <View style={styles.flex}>
          <ImageFileInput onPick={scanner.analyzePhoto}>
            <Button title="Upload a new photo" icon="cloud-upload-outline" variant="secondary" onPress={() => {}} />
          </ImageFileInput>
        </View>
      ) : (
        <>
          <View style={styles.flex}>
            <Button title="Take photo" icon="camera" variant="secondary" onPress={() => scanner.pick('camera')} />
          </View>
          <View style={styles.flex}>
            <Button title="Gallery" icon="images-outline" variant="secondary" onPress={() => scanner.pick('library')} />
          </View>
        </>
      )}
    </View>
  );

  return (
    <Screen topInset={false}>
      <ScanningOverlay visible={scanner.busy} imageUri={scanner.preview} phase={scanner.phase} onCancel={scanner.cancel} />
      <PhotoViewer uri={viewPhoto} onClose={() => setViewPhoto(null)} />
      {editing && (
        <ItemEditor
          key={editing.kind === 'edit' ? editing.item.id : 'add'}
          item={editing.kind === 'edit' ? editing.item : null}
          settings={settings}
          onSave={saveItem}
          onDelete={editing.kind === 'edit' ? () => removeItem(editing.item.id) : undefined}
          onClose={() => setEditing(null)}
        />
      )}

      <Animated.View entering={FadeInDown.duration(400)} style={styles.head}>
        {receipt.photoUri ? (
          <Pressable
            onPress={() => setViewPhoto(receipt.photoUri!)}
            accessibilityRole="imagebutton"
            accessibilityLabel="Show the receipt photo"
            style={[styles.thumb, { borderColor: theme.border }]}>
            <Image source={{ uri: receipt.photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
          </Pressable>
        ) : (
          <StoreAvatar store={receipt.store} size={60} />
        )}
        <View style={styles.flex}>
          <ThemedText variant="title">{receipt.store ?? 'Receipt'}</ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </ThemedText>
        </View>
        {receipt.totalPrice != null && (
          <View style={styles.price}>
            <ThemedText variant="headline">{money(receipt.totalPrice, receipt.currency, settings.currency)}</ThemedText>
            <ThemedText variant="caption" color="textSecondary">
              {receipt.items.length} lines
            </ThemedText>
          </View>
        )}
      </Animated.View>

      <Banner message={scanner.error} onDismiss={scanner.clearError} />
      {receipt.sampleReason && (
        <Banner tone="warn" icon="flask-outline" message={`Sample receipt, not your photo. ${receipt.sampleReason}`} />
      )}
      {receipt.warnings?.map((w) => (
        <Banner key={w} tone="warn" message={w} />
      ))}
      {showFresh && !receipt.sampleReason && (
        <Banner
          tone="brand"
          message={`Added ${food.length} food items to your kitchen. Tap an item to check or correct it.`}
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

      <SectionHeader
        title={`Items · ${food.length}`}
        action={<TextLink title="Add item" onPress={() => setEditing({ kind: 'add' })} />}
      />
      <Animated.View entering={FadeInDown.duration(400).delay(180)}>
        <Card padded={false} style={styles.list}>
          {food.length === 0 && (
            <ThemedText variant="caption" color="textSecondary" style={styles.emptyList}>
              No food items. Add one or scan the receipt again.
            </ThemedText>
          )}
          {food.map((item, i) => (
            <View key={item.id}>
              {i > 0 && <Divider />}
              <ItemRow
                item={item}
                currency={receipt.currency ?? settings.currency}
                onEdit={() => setEditing({ kind: 'edit', item })}
                onToggleFood={() => toggleFood(item)}
              />
            </View>
          ))}
        </Card>
      </Animated.View>

      {other.length > 0 && (
        <>
          <SectionHeader title="Not food" />
          <Card padded={false} style={styles.list}>
            {other.map((item, i) => (
              <View key={item.id}>
                {i > 0 && <Divider />}
                <Pressable
                  onPress={() => setEditing({ kind: 'edit', item })}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                  style={({ pressed }) => [styles.itemHead, pressed && { backgroundColor: theme.surfaceMuted }]}>
                  <IconCircle emoji={itemEmoji(item)} size={36} />
                  <ThemedText variant="body" color="textSecondary" style={styles.flex}>
                    {item.name}
                  </ThemedText>
                  {item.price != null && (
                    <ThemedText variant="caption" color="textSecondary">
                      {money(item.price, receipt.currency, settings.currency)}
                    </ThemedText>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}

      {receipt.totalPrice != null && check.sum > 0 && (
        <ThemedText variant="caption" color={check.ok ? 'textTertiary' : 'warn'}>
          Items add up to {money(check.sum, receipt.currency, settings.currency)}
          {check.ok ? ', matching the printed total.' : ` against ${money(check.total ?? 0, receipt.currency, settings.currency)} printed.`}
        </ThemedText>
      )}

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={16} color={theme.textTertiary} />
        <ThemedText variant="caption" color="textTertiary" style={styles.flex}>
          {receipt.notes ? `${receipt.notes} ` : ''}Values are estimates for typical products, not read from the
          packaging.
          {cost ? ` This scan used ${fmt(cost.inputTokens + cost.outputTokens)} tokens (about $${cost.costUsd.toFixed(2)}).` : ''}
        </ThemedText>
      </View>

      <Button title="Cook with these" icon="restaurant" onPress={() => router.navigate('/recipes')} />
      {rescanOpen ? (
        <Card>
          <ThemedText variant="bodyStrong">Scan this receipt again</ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            A new photo replaces the items below. Lay the receipt flat, fill the frame and avoid shadows.
          </ThemedText>
          {rescanButtons}
          <TextLink title="Cancel" onPress={() => setRescanOpen(false)} />
        </Card>
      ) : (
        <Button title="Scan again" icon="camera-reverse-outline" variant="secondary" onPress={() => setRescanOpen(true)} />
      )}
      <Button title="Delete receipt" icon="trash-outline" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}

function ItemRow({
  item,
  currency,
  onEdit,
  onToggleFood,
}: {
  item: ReceiptItem;
  currency: string;
  onEdit: () => void;
  onToggleFood: () => void;
}) {
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
      accessibilityLabel={`${item.name}, ${fmt(n.kcal)} kilocalories`}
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
            ~{fmt(item.total_weight_g)} g{item.price != null ? ` · ${money(item.price, currency)}` : ''}
            {item.confidence === 'low' ? ' · rough estimate' : ''}
            {item.edited ? ' · edited' : ''}
            {item.consumed ? ' · used up' : ''}
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
          <View style={styles.actions}>
            <Button title="Edit" icon="create-outline" variant="secondary" compact onPress={onEdit} />
            <Button title="Not food" icon="bag-outline" variant="secondary" compact onPress={onToggleFood} />
          </View>
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
  thumb: { width: 60, height: 76, borderRadius: Radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  price: { alignItems: 'flex-end' },
  list: { overflow: 'hidden' },
  emptyList: { padding: Spacing.four },
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
  actions: { flexDirection: 'row', gap: Spacing.two },
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
  rescanRow: { flexDirection: 'row', gap: Spacing.two },
});
