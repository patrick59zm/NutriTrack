import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MacroBar } from '@/components/nutrition-summary';
import { ThemedText } from '@/components/themed-text';
import { Card, PressableCard } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { itemEmoji } from '@/lib/categories';
import { fmt, money, relativeDay } from '@/lib/nutrition';
import type { Receipt } from '@/lib/types';

const STORE_COLORS: Record<string, string> = {
  rewe: '#CC071E',
  edeka: '#1B4E9B',
  lidl: '#0050AA',
  aldi: '#00558F',
  kaufland: '#E10915',
  penny: '#CD1719',
  netto: '#FFD400',
  dm: '#1E3C8C',
};

export function StoreAvatar({ store, size = 46 }: { store: string | null; size?: number }) {
  const key = (store ?? '').toLowerCase().split(/\s+/)[0];
  const bg = STORE_COLORS[key] ?? '#2F6B4F';
  const fg = key === 'netto' ? '#1A1A1A' : '#FFFFFF';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 3, backgroundColor: bg }]}>
      <ThemedText style={{ color: fg, fontWeight: '800', fontSize: size * 0.34 }}>
        {(store ?? '?').slice(0, 2).toUpperCase()}
      </ThemedText>
    </View>
  );
}

export function ReceiptRow({ receipt }: { receipt: Receipt }) {
  const theme = useTheme();
  const food = receipt.items.filter((i) => i.is_food);
  const emojis = [...new Set(food.map(itemEmoji))].slice(0, 7).join(' ');
  return (
    <PressableCard onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: receipt.id } })}>
      <Card>
        <View style={styles.row}>
          <StoreAvatar store={receipt.store} />
          <View style={styles.flex}>
            <ThemedText variant="headline" numberOfLines={1}>
              {receipt.store ?? 'Receipt'}
            </ThemedText>
            <ThemedText variant="caption" color="textSecondary">
              {relativeDay(receipt.purchasedAt)} · {food.length} items
              {receipt.totalPrice != null ? ` · ${money(receipt.totalPrice, receipt.currency)}` : ''}
            </ThemedText>
          </View>
          <View style={styles.right}>
            <ThemedText variant="headline">{fmt(receipt.totals.kcal)}</ThemedText>
            <ThemedText variant="caption" color="textSecondary">
              kcal
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
        </View>
        <MacroBar nutrition={receipt.totals} />
        {emojis ? (
          <ThemedText variant="caption" style={styles.emojis}>
            {emojis}
          </ThemedText>
        ) : null}
      </Card>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end' },
  avatar: { alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  emojis: { letterSpacing: 2 },
});
