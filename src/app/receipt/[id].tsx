import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BasketCheck } from '@/components/basket-check';
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
import { locale, useT, type Key } from '@/lib/i18n';
import { basketMetrics } from '@/lib/insights';
import { fmt, money, priceCheck, recomputeReceipt } from '@/lib/nutrition';
import { syncReminders } from '@/lib/reminders';
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
  const t = useT();

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
      syncReminders();
    },
    [id, setData],
  );

  if (!loaded) return null;
  if (!receipt) {
    return (
      <Screen topInset={false}>
        <ThemedText>{t('receipt.notFound')}</ThemedText>
      </Screen>
    );
  }

  const food = receipt.items.filter((i) => i.is_food);
  const other = receipt.items.filter((i) => !i.is_food);
  const date = new Date(receipt.purchasedAt);
  const check = priceCheck(receipt.items, receipt.totalPrice);
  const cost = receipt.usage;
  const metrics = basketMetrics(receipt.totals, receipt.items);

  function confirmDelete() {
    const run = async () => {
      await deleteReceipt(id);
      syncReminders();
      router.back();
    };
    if (Platform.OS === 'web') {
      run();
      return;
    }
    Alert.alert(t('receipt.deleteTitle'), t('receipt.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: run },
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
            <Button title={t('receipt.uploadNew')} icon="cloud-upload-outline" variant="secondary" onPress={() => {}} />
          </ImageFileInput>
        </View>
      ) : (
        <>
          <View style={styles.flex}>
            <Button title={t('common.takePhoto')} icon="camera" variant="secondary" onPress={() => scanner.pick('camera')} />
          </View>
          <View style={styles.flex}>
            <Button title={t('common.gallery')} icon="images-outline" variant="secondary" onPress={() => scanner.pick('library')} />
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
            accessibilityLabel={t('receipt.showPhoto')}
            style={[styles.thumb, { borderColor: theme.border }]}>
            <Image source={{ uri: receipt.photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
          </Pressable>
        ) : (
          <StoreAvatar store={receipt.store} size={60} />
        )}
        <View style={styles.flex}>
          <ThemedText variant="title">{receipt.store ?? t('common.receipt')}</ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}
          </ThemedText>
        </View>
        {receipt.totalPrice != null && (
          <View style={styles.price}>
            <ThemedText variant="headline">{money(receipt.totalPrice, receipt.currency, settings.currency)}</ThemedText>
            <ThemedText variant="caption" color="textSecondary">
              {t('receipt.lines', { n: receipt.items.length })}
            </ThemedText>
          </View>
        )}
      </Animated.View>

      <Banner message={scanner.error} onDismiss={scanner.clearError} />
      {receipt.sampleReason && (
        <Banner tone="warn" icon="flask-outline" message={t('receipt.sample', { reason: receipt.sampleReason })} />
      )}
      {receipt.warnings?.map((w) => (
        <Banner key={w} tone="warn" message={w} />
      ))}
      {showFresh && !receipt.sampleReason && (
        <Banner
          tone="brand"
          message={t('receipt.added', { n: food.length })}
          onDismiss={() => setShowFresh(false)}
        />
      )}

      <Animated.View entering={FadeInDown.duration(400).delay(60)}>
        <Card>
          <NutritionPanel nutrition={receipt.totals} caption={t('receipt.kcalTotal')} />
        </Card>
      </Animated.View>

      {food.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400).delay(120)}>
          <Card>
            <ThemedText variant="headline">{t('receipt.whereFrom')}</ThemedText>
            <CategoryBreakdown items={receipt.items} />
          </Card>
        </Animated.View>
      )}

      {metrics.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400).delay(150)}>
          <Card>
            <ThemedText variant="headline">{t('receipt.basketCheck')}</ThemedText>
            <BasketCheck metrics={metrics} />
          </Card>
        </Animated.View>
      )}

      <SectionHeader
        title={t('receipt.itemsCount', { n: food.length })}
        action={<TextLink title={t('receipt.addItem')} onPress={() => setEditing({ kind: 'add' })} />}
      />
      <Animated.View entering={FadeInDown.duration(400).delay(180)}>
        <Card padded={false} style={styles.list}>
          {food.length === 0 && (
            <ThemedText variant="caption" color="textSecondary" style={styles.emptyList}>
              {t('receipt.noFood')}
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
          <SectionHeader title={t('receipt.notFood')} />
          <Card padded={false} style={styles.list}>
            {other.map((item, i) => (
              <View key={item.id}>
                {i > 0 && <Divider />}
                <Pressable
                  onPress={() => setEditing({ kind: 'edit', item })}
                  accessibilityRole="button"
                  accessibilityLabel={t('receipt.editItem', { name: item.name })}
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
          {check.ok
            ? t('receipt.sumMatch', { sum: money(check.sum, receipt.currency, settings.currency) })
            : t('receipt.sumMismatch', {
                sum: money(check.sum, receipt.currency, settings.currency),
                total: money(check.total ?? 0, receipt.currency, settings.currency),
              })}
        </ThemedText>
      )}

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={16} color={theme.textTertiary} />
        <ThemedText variant="caption" color="textTertiary" style={styles.flex}>
          {receipt.notes ? `${receipt.notes} ` : ''}
          {t('receipt.estimatesNote')}
          {cost ? t('receipt.scanCost', { tokens: fmt(cost.inputTokens + cost.outputTokens), cost: cost.costUsd.toFixed(2) }) : ''}
        </ThemedText>
      </View>

      <Button title={t('receipt.cookWith')} icon="restaurant" onPress={() => router.navigate('/recipes')} />
      {rescanOpen ? (
        <Card>
          <ThemedText variant="bodyStrong">{t('receipt.rescanTitle')}</ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {t('receipt.rescanNote')}
          </ThemedText>
          {rescanButtons}
          <TextLink title={t('common.cancel')} onPress={() => setRescanOpen(false)} />
        </Card>
      ) : (
        <Button title={t('receipt.scanAgain')} icon="camera-reverse-outline" variant="secondary" onPress={() => setRescanOpen(true)} />
      )}
      <Button title={t('receipt.delete')} icon="trash-outline" variant="danger" onPress={confirmDelete} />
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
  const t = useT();
  const [open, setOpen] = useState(false);
  const n = item.nutrition_total;

  return (
    <Pressable
      onPress={() => {
        tap();
        setOpen((o) => !o);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('receipt.itemA11y', { name: item.name, kcal: fmt(n.kcal) })}
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
            {item.confidence === 'low' ? t('receipt.roughEstimate') : ''}
            {item.edited ? t('receipt.edited') : ''}
            {item.consumed ? t('receipt.usedUp') : ''}
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
            <Button title={t('common.edit')} icon="create-outline" variant="secondary" compact onPress={onEdit} />
            <Button title={t('receipt.notFoodButton')} icon="bag-outline" variant="secondary" compact onPress={onToggleFood} />
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const ROWS: { key: keyof Nutrition; label: Key; sub?: boolean; unit: string; color?: string; digits?: number }[] = [
  { key: 'kcal', label: 'common.energy', unit: 'kcal' },
  { key: 'protein_g', label: 'common.protein', unit: 'g', color: MacroColors.protein },
  { key: 'carbs_g', label: 'common.carbs', unit: 'g', color: MacroColors.carbs },
  { key: 'sugar_g', label: 'receipt.ofWhichSugar', sub: true, unit: 'g' },
  { key: 'fat_g', label: 'common.fat', unit: 'g', color: MacroColors.fat },
  { key: 'saturated_fat_g', label: 'receipt.ofWhichSaturated', sub: true, unit: 'g' },
  { key: 'fiber_g', label: 'common.fiber', unit: 'g' },
  { key: 'salt_g', label: 'common.salt', unit: 'g', digits: 1 },
];

function NutrientTable({ total, per100 }: { total: Nutrition; per100: Nutrition }) {
  const t = useT();
  return (
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <ThemedText variant="caption" color="textTertiary" style={styles.flex} />
        <ThemedText variant="captionStrong" color="textTertiary" style={styles.cell}>
          {t('receipt.per100')}
        </ThemedText>
        <ThemedText variant="captionStrong" color="textTertiary" style={styles.cell}>
          {t('receipt.bought')}
        </ThemedText>
      </View>
      {ROWS.map((r) => (
        <View key={r.key} style={styles.tableRow}>
          <View style={[styles.flex, styles.tableLabel]}>
            {r.color && <View style={[styles.dot, { backgroundColor: r.color }]} />}
            <ThemedText variant="caption" color={r.sub ? 'textSecondary' : 'text'}>
              {t(r.label)}
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
