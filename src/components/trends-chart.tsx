import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';
import type { WeekPoint } from '@/lib/insights';

const HEIGHT = 150;
const TOP = 22; // room for the value label above the tallest bar
const BOTTOM = 22; // week labels
const BAR_MAX = 24;
const RADIUS = 4;
// SVG text does not inherit the app font on web and would fall back to a serif.
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;

/** A column with rounded top corners and a square base. */
function column(x: number, y: number, w: number, h: number) {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x} ${y + h} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h} Z`;
}

/**
 * One series of weekly totals as columns: the current week in the accent color, past
 * weeks lighter. Tapping a column shows its value; the current week is always labelled.
 */
export function TrendsChart({
  points,
  value,
  format,
  title,
}: {
  points: WeekPoint[];
  value: (p: WeekPoint) => number;
  format: (n: number) => string;
  title: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const values = points.map(value);
  const max = Math.max(1, ...values);
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const band = width / Math.max(1, points.length);
  const barWidth = Math.min(BAR_MAX, Math.max(8, band - 8));
  const shown = selected ?? points.length - 1;
  const gridSteps = [0.5, 1];
  // Keep the value label inside the chart: anchor it to the edge when the bar is near one.
  const labelCenter = shown * band + band / 2;
  const labelHalf = (format(values[shown] ?? 0).length * 6.5) / 2;
  const labelAnchor = labelCenter + labelHalf > width ? 'end' : labelCenter - labelHalf < 0 ? 'start' : 'middle';
  const labelX = labelAnchor === 'end' ? width - 2 : labelAnchor === 'start' ? 2 : labelCenter;

  return (
    <View style={styles.wrap} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.titleRow}>
        <ThemedText variant="captionStrong" color="textSecondary" style={styles.flex}>
          {title}
        </ThemedText>
        <ThemedText variant="caption" color="textTertiary">
          {points[shown]?.label}
          {points[shown]?.receipts ? ` · ${points[shown].receipts} receipt${points[shown].receipts === 1 ? '' : 's'}` : ''}
        </ThemedText>
      </View>
      {width > 0 && (
        <View>
          <Svg width={width} height={HEIGHT} accessibilityLabel={`${title}: ${points.map((p) => `${p.label} ${format(value(p))}`).join(', ')}`}>
            {gridSteps.map((g) => {
              const y = TOP + plotHeight - g * plotHeight;
              return (
                <Line key={g} x1={0} x2={width} y1={y} y2={y} stroke={theme.border} strokeWidth={1} strokeDasharray={g === 1 ? '3 4' : undefined} />
              );
            })}
            {points.map((p, i) => {
              const v = values[i];
              if (v <= 0) return null;
              const h = Math.max(3, (v / max) * plotHeight);
              const x = i * band + (band - barWidth) / 2;
              const current = i === points.length - 1;
              return (
                <Path
                  key={p.start}
                  d={column(x, TOP + plotHeight - h, barWidth, h)}
                  fill={theme.brand}
                  opacity={current || i === shown ? 1 : 0.38}
                />
              );
            })}
            <Line x1={0} x2={width} y1={TOP + plotHeight} y2={TOP + plotHeight} stroke={theme.border} strokeWidth={1} />
            {points.map((p, i) => (
              <SvgText
                key={`${p.start}-label`}
                x={i * band + band / 2}
                y={HEIGHT - 6}
                fontSize={10}
                fontFamily={FONT}
                fill={i === shown ? theme.text : theme.textTertiary}
                fontWeight={i === shown ? '600' : '400'}
                textAnchor="middle">
                {p.label}
              </SvgText>
            ))}
            {values[shown] > 0 && (
              <SvgText
                x={labelX}
                y={TOP + plotHeight - Math.max(3, (values[shown] / max) * plotHeight) - 6}
                fontSize={11}
                fontWeight="700"
                fontFamily={FONT}
                fill={theme.text}
                textAnchor={labelAnchor}>
                {format(values[shown])}
              </SvgText>
            )}
          </Svg>
          <View style={[StyleSheet.absoluteFill, styles.hits]} pointerEvents="box-none">
            {points.map((p, i) => (
              <Pressable
                key={p.start}
                onPress={() => {
                  tap();
                  setSelected(i === selected ? null : i);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Week of ${p.label}: ${format(values[i])}`}
                style={styles.hit}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: Spacing.one },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hits: { flexDirection: 'row' },
  hit: { flex: 1 },
});
