import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  overline,
  title,
  subtitle,
  right,
  topInset = true,
}: {
  children: ReactNode;
  overline?: string;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  /** Tab screens draw their own header and need the status-bar inset; stack screens do not. */
  topInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topInset ? insets.top + Spacing.four : Spacing.four,
          paddingBottom: Spacing.twelve,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {title && (
            <View style={styles.header}>
              <View style={styles.flex}>
                {overline && (
                  <ThemedText variant="overline" color="textTertiary">
                    {overline}
                  </ThemedText>
                )}
                <ThemedText variant="display">{title}</ThemedText>
                {subtitle && (
                  <ThemedText variant="body" color="textSecondary" style={styles.subtitle}>
                    {subtitle}
                  </ThemedText>
                )}
              </View>
              {right}
            </View>
          )}
          {children}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        padded && styles.cardPadded,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          boxShadow: `0 1px 2px ${theme.shadow}, 0 6px 20px ${theme.shadow}`,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Pressable with a subtle press-in scale and a light haptic tick. */
export function PressableCard({
  children,
  style,
  onPress,
  ...rest
}: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={(e) => {
        tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }], opacity: pressed ? 0.92 : 1 }, style]}
      {...rest}>
      {children}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onBrand' | 'onBrandGhost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  compact,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const theme = useTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.brand, fg: theme.onBrand },
    secondary: { bg: theme.surfaceMuted, fg: theme.text },
    ghost: { bg: 'transparent', fg: theme.brand },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
    onBrand: { bg: '#FFFFFF', fg: '#0F5E3A' },
    onBrandGhost: { bg: 'rgba(255,255,255,0.16)', fg: '#FFFFFF', border: 'rgba(255,255,255,0.28)' },
  };
  const { bg, fg, border } = palette[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={() => {
        tap();
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: bg,
          borderColor: border ?? 'transparent',
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={compact ? 16 : 19} color={fg} />}
          <ThemedText variant={compact ? 'captionStrong' : 'bodyStrong'} style={{ color: fg }}>
            {title}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  tone = 'neutral',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  tone?: 'neutral' | 'brand' | 'warn' | 'danger';
}) {
  const theme = useTheme();
  const tones = {
    neutral: { bg: theme.surfaceMuted, fg: theme.text },
    brand: { bg: theme.brandSoft, fg: theme.brandStrong },
    warn: { bg: theme.warnSoft, fg: theme.warn },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
  };
  const { bg, fg } = selected ? { bg: theme.brand, fg: theme.onBrand } : tones[tone];
  return (
    <Pressable
      onPress={
        onPress &&
        (() => {
          tap();
          onPress();
        })
      }
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      style={[styles.chip, { backgroundColor: bg }]}>
      {icon && <ThemedText variant="caption">{icon}</ThemedText>}
      <ThemedText variant="captionStrong" style={{ color: fg }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText variant="title" style={styles.flex}>
        {title}
      </ThemedText>
      {action}
    </View>
  );
}

export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <ThemedText variant="captionStrong" color="brand">
        {title}
      </ThemedText>
    </Pressable>
  );
}

export function IconCircle({
  icon,
  emoji,
  size = 44,
  background,
  color,
}: {
  icon?: IconName;
  emoji?: string;
  size?: number;
  background?: string;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.6,
        backgroundColor: background ?? theme.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {emoji ? (
        <ThemedText style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{emoji}</ThemedText>
      ) : (
        icon && <Ionicons name={icon} size={size * 0.48} color={color ?? theme.text} />
      )}
    </View>
  );
}

export function Banner({
  message,
  tone = 'danger',
  icon,
  onDismiss,
}: {
  message: string | null;
  tone?: 'danger' | 'brand' | 'warn';
  icon?: IconName;
  onDismiss?: () => void;
}) {
  const theme = useTheme();
  if (!message) return null;
  const colors = {
    danger: { bg: theme.dangerSoft, fg: theme.danger, icon: 'alert-circle-outline' as const },
    warn: { bg: theme.warnSoft, fg: theme.warn, icon: 'alert-circle-outline' as const },
    brand: { bg: theme.brandSoft, fg: theme.brandStrong, icon: 'checkmark-circle' as const },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: colors.bg }]}>
      <Ionicons name={icon ?? colors.icon} size={20} color={colors.fg} />
      <ThemedText variant="captionStrong" style={[styles.flex, { color: colors.fg }]}>
        {message}
      </ThemedText>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={18} color={colors.fg} />
        </Pressable>
      )}
    </View>
  );
}

export function StatTile({
  label,
  value,
  unit,
  icon,
  color = 'text',
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: IconName;
  color?: ThemeColor;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.statTile, { backgroundColor: theme.surfaceMuted }]}>
      <View style={styles.statLabel}>
        {icon && <Ionicons name={icon} size={14} color={theme.textSecondary} />}
        <ThemedText variant="caption" color="textSecondary">
          {label}
        </ThemedText>
      </View>
      <ThemedText variant="headline" color={color}>
        {value}
        {unit && (
          <ThemedText variant="caption" color="textSecondary">
            {' '}
            {unit}
          </ThemedText>
        )}
      </ThemedText>
    </View>
  );
}

export function EmptyState({
  emoji,
  title,
  message,
  children,
}: {
  emoji: string;
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <Card style={styles.empty}>
      <ThemedText style={styles.emptyEmoji}>{emoji}</ThemedText>
      <ThemedText variant="headline" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText variant="body" color="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      {children && <View style={styles.emptyActions}>{children}</View>}
    </Card>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three, marginBottom: Spacing.two },
  subtitle: { marginTop: Spacing.one },
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  cardPadded: { padding: Spacing.four, gap: Spacing.three },
  button: {
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.five,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: Radius.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingVertical: 6,
    paddingHorizontal: Spacing.three,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.three },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  statTile: { flex: 1, minWidth: 64, borderRadius: Radius.md, padding: Spacing.three, gap: 2 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { alignItems: 'center', paddingVertical: Spacing.eight, gap: Spacing.two },
  emptyEmoji: { fontSize: 48, lineHeight: 58 },
  emptyActions: { alignSelf: 'stretch', gap: Spacing.two, marginTop: Spacing.three },
});
