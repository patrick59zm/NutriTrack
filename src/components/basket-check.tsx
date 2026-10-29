import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';
import { metricSummary, type BasketMetric, type MetricStatus } from '@/lib/insights';

const STATUS: Record<MetricStatus, { icon: 'checkmark-circle' | 'alert-circle' | 'warning'; label: string }> = {
  good: { icon: 'checkmark-circle', label: 'Good' },
  watch: { icon: 'alert-circle', label: 'Close' },
  high: { icon: 'warning', label: 'Look at this' },
};

/**
 * Meters comparing the basket with guideline values. Each row keeps its state in an
 * icon and a word as well as a color, and tapping it explains what the value means.
 */
export function BasketCheck({ metrics }: { metrics: BasketMetric[] }) {
  const theme = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const colors: Record<MetricStatus, string> = { good: theme.brand, watch: theme.warn, high: theme.danger };

  return (
    <View style={styles.list}>
      <ThemedText variant="caption" color="textSecondary">
        {metricSummary(metrics)}
      </ThemedText>
      {metrics.map((m) => {
        const color = colors[m.status];
        const isOpen = open === m.key;
        return (
          <Pressable
            key={m.key}
            onPress={() => {
              tap();
              setOpen(isOpen ? null : m.key);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${m.label}: ${m.value}, guideline ${m.target}, ${STATUS[m.status].label}`}
            accessibilityState={{ expanded: isOpen }}
            style={styles.row}>
            <View style={styles.head}>
              <ThemedText variant="bodyStrong" style={styles.flex}>
                {m.label}
              </ThemedText>
              <View style={styles.status}>
                <Ionicons name={STATUS[m.status].icon} size={14} color={color} />
                <ThemedText variant="captionStrong" style={{ color }}>
                  {STATUS[m.status].label}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
              <View style={[styles.fill, { width: `${Math.max(2, m.fill * 100)}%`, backgroundColor: color }]} />
              <View style={[styles.marker, { left: `${m.marker * 100}%`, backgroundColor: theme.text }]} />
            </View>
            <View style={styles.head}>
              <ThemedText variant="caption" color="textSecondary" style={styles.flex}>
                {m.value}
              </ThemedText>
              <ThemedText variant="caption" color="textTertiary">
                guideline {m.target}
              </ThemedText>
            </View>
            {isOpen && (
              <ThemedText variant="caption" color="textSecondary" style={styles.note}>
                {m.note}
              </ThemedText>
            )}
          </Pressable>
        );
      })}
      <ThemedText variant="caption" color="textTertiary">
        Guidelines from WHO population targets, applied to what was bought, not what was eaten. The black
        tick marks the guideline.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: Spacing.three },
  row: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  track: { height: 8, borderRadius: 4, overflow: 'visible', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  marker: { position: 'absolute', top: -3, width: 2, height: 14, borderRadius: 1, marginLeft: -1 },
  note: { paddingTop: 2, paddingBottom: Spacing.one, borderRadius: Radius.sm },
});
