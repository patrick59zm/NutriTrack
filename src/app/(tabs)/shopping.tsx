import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Divider, EmptyState, Screen, SectionHeader, TextLink } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { success, tap } from '@/lib/haptics';
import { shareText } from '@/lib/share';
import { addToShopping, loadShopping, saveShopping } from '@/lib/storage';
import type { ShoppingItem } from '@/lib/types';

export default function ShoppingScreen() {
  const theme = useTheme();
  const { data: items, setData, loaded, reload } = useFocusData(loadShopping, [] as ShoppingItem[]);
  const [text, setText] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  async function persist(next: ShoppingItem[]) {
    setData(next);
    await saveShopping(next);
  }

  async function add() {
    const value = text.trim();
    if (!value) return;
    setText('');
    await addToShopping([value]);
    success();
    reload();
  }

  const toggle = (item: ShoppingItem) => {
    tap();
    persist(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
  };
  const remove = (item: ShoppingItem) => persist(items.filter((i) => i.id !== item.id));
  const clearDone = () => persist(items.filter((i) => !i.done));

  async function share() {
    const lines = open.map((i) => `☐ ${i.text}`).join('\n');
    const result = await shareText(`Shopping list\n${lines}\n\nShared from NutriTrack`, 'Shopping list');
    if (result === 'copied') setToast('List copied to the clipboard.');
  }

  return (
    <Screen
      title="Shopping"
      subtitle={open.length ? `${open.length} thing${open.length === 1 ? '' : 's'} to buy` : 'Nothing to buy right now'}>
      <Card>
        <View style={styles.addRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={add}
            placeholder="Add something, e.g. fresh basil"
            placeholderTextColor={theme.textTertiary}
            returnKeyType="done"
            blurOnSubmit={false}
            accessibilityLabel="Add to the shopping list"
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          />
          <Pressable
            onPress={add}
            disabled={!text.trim()}
            accessibilityRole="button"
            accessibilityLabel="Add"
            style={[styles.addButton, { backgroundColor: theme.brand, opacity: text.trim() ? 1 : 0.4 }]}>
            <Ionicons name="add" size={24} color={theme.onBrand} />
          </Pressable>
        </View>
        <ThemedText variant="caption" color="textTertiary">
          Recipes add what you are missing with one tap. Check things off as you shop.
        </ThemedText>
      </Card>

      {toast && (
        <ThemedText variant="caption" color="brandStrong">
          {toast}
        </ThemedText>
      )}

      {loaded && items.length === 0 && (
        <EmptyState emoji="🛒" title="Your list is empty" message="Open a recipe and tap “Add missing to list”, or type what you need above.">
          <Button title="Browse recipes" icon="restaurant-outline" variant="secondary" onPress={() => router.navigate('/recipes')} />
        </EmptyState>
      )}

      {open.length > 0 && (
        <Animated.View entering={FadeInDown.duration(350)} style={styles.section}>
          <SectionHeader title="To buy" action={<TextLink title="Share" onPress={share} />} />
          <Card padded={false}>
            {open.map((item, i) => (
              <View key={item.id}>
                {i > 0 && <Divider />}
                <Row item={item} onToggle={() => toggle(item)} onRemove={() => remove(item)} />
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {done.length > 0 && (
        <Animated.View entering={FadeInDown.duration(350)} style={styles.section}>
          <SectionHeader title="In the basket" action={<TextLink title="Clear" onPress={clearDone} />} />
          <Card padded={false}>
            {done.map((item, i) => (
              <View key={item.id}>
                {i > 0 && <Divider />}
                <Row item={item} onToggle={() => toggle(item)} onRemove={() => remove(item)} />
              </View>
            ))}
          </Card>
        </Animated.View>
      )}
    </Screen>
  );
}

function Row({ item, onToggle, onRemove }: { item: ShoppingItem; onToggle: () => void; onRemove: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.text}
        style={styles.rowMain}>
        <Ionicons
          name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={item.done ? theme.brand : theme.textTertiary}
        />
        <View style={styles.flex}>
          <ThemedText variant="bodyStrong" style={item.done && styles.done}>
            {item.text}
          </ThemedText>
          {item.from && (
            <ThemedText variant="caption" color="textTertiary">
              for {item.from}
            </ThemedText>
          )}
        </View>
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${item.text}`}>
        <Ionicons name="close" size={18} color={theme.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Spacing.three },
  addRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  addButton: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  done: { textDecorationLine: 'line-through', opacity: 0.5 },
});
