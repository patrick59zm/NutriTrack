import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Card, PressableCard } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { fmt } from '@/lib/nutrition';
import type { Recipe } from '@/lib/types';

const TINTS = {
  light: ['#FDE9D9', '#E3F1E8', '#FFF1CC', '#E6EEFC', '#F7E4EE'],
  dark: ['#3A2618', '#15301F', '#3A3013', '#1B2638', '#35202B'],
};

export function recipeTint(index: number, scheme: 'light' | 'dark') {
  return TINTS[scheme][index % TINTS[scheme].length];
}

export function Meta({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={theme.textSecondary} />
      <ThemedText variant="caption" color="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

export function RecipeCard({ recipe, index }: { recipe: Recipe; index: number }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const extras = recipe.extra_ingredients_needed.length;
  return (
    <PressableCard onPress={() => router.push({ pathname: '/recipe/[index]', params: { index: String(index) } })}>
      <Card padded={false} style={styles.card}>
        <View style={[styles.hero, { backgroundColor: recipeTint(index, scheme) }]}>
          <ThemedText style={styles.emoji}>{recipe.emoji || '🍽️'}</ThemedText>
        </View>
        <View style={styles.body}>
          <ThemedText variant="headline" numberOfLines={2}>
            {recipe.title}
          </ThemedText>
          <View style={styles.metaRow}>
            <Meta icon="time-outline" label={`${recipe.time_minutes} min`} />
            <Meta icon="people-outline" label={`${recipe.servings}`} />
            <Meta icon="flame" label={`${fmt(recipe.nutrition_per_serving.kcal)} kcal`} />
          </View>
          <ThemedText variant="caption" color="brandStrong" numberOfLines={2}>
            {recipe.why}
          </ThemedText>
          <View style={styles.footer}>
            <View style={[styles.badge, { backgroundColor: theme.brandSoft }]}>
              <Ionicons name="checkmark-circle" size={13} color={theme.brandStrong} />
              <ThemedText variant="captionStrong" color="brandStrong" style={styles.badgeText}>
                {recipe.uses_items.length} from your kitchen
              </ThemedText>
            </View>
            {extras > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.surfaceMuted }]}>
                <Ionicons name="cart-outline" size={13} color={theme.textSecondary} />
                <ThemedText variant="captionStrong" color="textSecondary" style={styles.badgeText}>
                  +{extras} to buy
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      </Card>
    </PressableCard>
  );
}

export function RecipeSkeleton() {
  const theme = useTheme();
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const block = (w: number | `${number}%`, h: number) => (
    <View style={{ width: w, height: h, borderRadius: 6, backgroundColor: theme.surfaceMuted }} />
  );
  return (
    <Animated.View style={style}>
      <Card padded={false} style={styles.card}>
        <View style={[styles.hero, { backgroundColor: theme.surfaceMuted }]} />
        <View style={styles.body}>
          {block('80%', 18)}
          {block('55%', 12)}
          {block('95%', 12)}
          {block('40%', 20)}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', overflow: 'hidden' },
  hero: { width: 104, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 48, lineHeight: 58 },
  body: { flex: 1, padding: Spacing.four, gap: Spacing.two },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 12 },
});
