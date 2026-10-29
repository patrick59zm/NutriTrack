import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, Chip, Divider, IconCircle, Screen, Stepper, type IconName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { DEMO_MODE } from '@/lib/config';
import { success, tap } from '@/lib/haptics';
import { fmt } from '@/lib/nutrition';
import {
  clearAllData,
  getApiKey,
  loadDemoData,
  loadSettings,
  loadUsage,
  resetUsage,
  saveSettings,
  setApiKey,
  type UsageTotals,
} from '@/lib/storage';
import { DEFAULT_SETTINGS, type Currency, type Settings } from '@/lib/types';

const DIET_SUGGESTIONS = ['Vegetarian', 'Vegan', 'Pescatarian', 'High protein', 'Low carb', 'Gluten-free', 'No nuts', 'Lactose-free'];
const COOK_TIMES: (number | null)[] = [null, 15, 30, 45, 60];
const CURRENCIES: [Currency, string][] = [
  ['EUR', '€ Euro'],
  ['CHF', 'CHF'],
  ['USD', '$ Dollar'],
  ['GBP', '£ Pound'],
];

const loadSettingsScreen = async () => {
  const [apiKey, settings, usage] = await Promise.all([getApiKey(), loadSettings(), loadUsage()]);
  return { apiKey, settings, usage };
};

export default function SettingsScreen() {
  const theme = useTheme();
  const { data, setData, reload } = useFocusData(loadSettingsScreen, {
    apiKey: null as string | null,
    settings: DEFAULT_SETTINGS,
    usage: null as UsageTotals | null,
  });
  const [keyInput, setKeyInput] = useState('');
  // Local draft while typing; falls back to the stored value.
  const [dietDraft, setDiet] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { apiKey, settings, usage } = data;
  const diet = dietDraft ?? settings.diet;

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
  ];

  async function saveKey(value: string) {
    await setApiKey(value);
    setKeyInput('');
    await reload();
    success();
    setToast(value ? 'API key saved on this device.' : 'API key removed.');
  }

  async function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setData({ ...data, settings: next });
    await saveSettings(next);
  }

  function toggleDiet(tag: string) {
    const parts = diet
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const has = parts.some((p) => p.toLowerCase() === tag.toLowerCase());
    const next = (has ? parts.filter((p) => p.toLowerCase() !== tag.toLowerCase()) : [...parts, tag]).join(', ');
    setDiet(null);
    update({ diet: next });
  }

  function confirmClear() {
    const run = async () => {
      await clearAllData();
      setToast('All receipts and recipes deleted.');
    };
    if (Platform.OS === 'web') {
      run();
      return;
    }
    Alert.alert('Delete all data?', 'This removes every scanned receipt and saved recipe.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  }

  const activeDiet = diet.toLowerCase();

  return (
    <Screen title="Settings">
      <Banner tone="brand" message={toast} onDismiss={() => setToast(null)} />

      <Group title="Claude">
        <Card>
          <View style={styles.row}>
            <IconCircle icon="sparkles" background={theme.brandSoft} color={theme.brandStrong} size={40} />
            <View style={styles.flex}>
              <ThemedText variant="bodyStrong">Anthropic API key</ThemedText>
              <View style={styles.status}>
                <View style={[styles.statusDot, { backgroundColor: apiKey ? theme.brand : theme.textTertiary }]} />
                <ThemedText variant="caption" color="textSecondary">
                  {DEMO_MODE
                    ? 'Demo version: no key needed'
                    : apiKey
                      ? `Connected · ••••${apiKey.slice(-4)}`
                      : 'Not connected'}
                </ThemedText>
              </View>
            </View>
          </View>
          <TextInput
            value={keyInput}
            onChangeText={setKeyInput}
            placeholder={apiKey ? 'Paste a new key to replace it' : 'sk-ant-…'}
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={inputStyle}
          />
          <View style={styles.buttonRow}>
            <View style={styles.flex}>
              <Button
                title="Save key"
                compact
                disabled={!keyInput.trim()}
                onPress={() => saveKey(keyInput.trim())}
              />
            </View>
            {apiKey && (
              <View style={styles.flex}>
                <Button title="Remove" compact variant="secondary" onPress={() => saveKey('')} />
              </View>
            )}
          </View>
          <Pressable onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}>
            <ThemedText variant="caption" color="brand">
              Get a key at console.anthropic.com →
            </ThemedText>
          </Pressable>
          <ThemedText variant="caption" color="textTertiary">
            The key is stored in this device&apos;s secure storage and only sent to Anthropic.
          </ThemedText>
        </Card>
        {usage && usage.scans + usage.recipeRequests + usage.estimates > 0 && (
          <Card>
            <View style={styles.row}>
              <IconCircle icon="wallet-outline" size={40} />
              <View style={styles.flex}>
                <ThemedText variant="bodyStrong">Claude usage on this device</ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  {usage.scans} scan{usage.scans === 1 ? '' : 's'} · {usage.recipeRequests} recipe round
                  {usage.recipeRequests === 1 ? '' : 's'} · {usage.estimates} item estimate
                  {usage.estimates === 1 ? '' : 's'}
                </ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  {fmt(usage.inputTokens + usage.outputTokens)} tokens, about ${usage.costUsd.toFixed(2)} at list price
                </ThemedText>
              </View>
            </View>
            <Button
              title="Reset counter"
              compact
              variant="secondary"
              onPress={async () => {
                await resetUsage();
                reload();
              }}
            />
          </Card>
        )}
      </Group>

      <Group title="Preferences">
        <Card>
          <ThemedText variant="bodyStrong">Language for products & recipes</ThemedText>
          <Segmented
            value={settings.language}
            options={[
              ['en', 'English'],
              ['de', 'Deutsch'],
            ]}
            onChange={(language) => update({ language })}
          />
          <Divider />
          <ThemedText variant="bodyStrong">Currency</ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            For totals across receipts and items you add by hand. Each receipt keeps its own.
          </ThemedText>
          <View style={styles.chips}>
            {CURRENCIES.map(([code, label]) => (
              <Chip key={code} label={label} selected={settings.currency === code} onPress={() => update({ currency: code })} />
            ))}
          </View>
          <Divider />
          <View style={styles.row}>
            <View style={styles.flex}>
              <ThemedText variant="bodyStrong">People in your household</ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                Sets recipe servings and the per-person figures.
              </ThemedText>
            </View>
            <Stepper
              label="People in your household"
              value={settings.householdSize}
              min={1}
              max={8}
              onChange={(householdSize) => update({ householdSize })}
            />
          </View>
          <Divider />
          <ThemedText variant="bodyStrong">Longest cooking time for recipe ideas</ThemedText>
          <View style={styles.chips}>
            {COOK_TIMES.map((minutes) => (
              <Chip
                key={String(minutes)}
                label={minutes ? `${minutes} min` : 'Any'}
                selected={settings.maxCookMinutes === minutes}
                onPress={() => update({ maxCookMinutes: minutes })}
              />
            ))}
          </View>
          <Divider />
          <ThemedText variant="bodyStrong">Dietary preferences</ThemedText>
          <View style={styles.chips}>
            {DIET_SUGGESTIONS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                selected={activeDiet.split(',').some((p) => p.trim() === tag.toLowerCase())}
                onPress={() => toggleDiet(tag)}
              />
            ))}
          </View>
          <TextInput
            value={diet}
            onChangeText={setDiet}
            onBlur={() => {
              if (diet !== settings.diet) update({ diet });
              setDiet(null);
            }}
            placeholder="Anything else? e.g. no mushrooms"
            placeholderTextColor={theme.textTertiary}
            style={inputStyle}
          />
        </Card>
      </Group>

      <Group title="Data">
        <Card padded={false}>
          <SettingsRow
            icon="sparkles"
            label="Load sample data"
            detail="Three shopping trips and recipe ideas"
            onPress={async () => {
              await loadDemoData();
              success();
              setToast('Sample data loaded. Have a look around!');
            }}
          />
          <Divider />
          <SettingsRow icon="trash-outline" label="Delete all receipts" danger onPress={confirmClear} />
        </Card>
      </Group>

      <View style={styles.about}>
        <ThemedText variant="captionStrong" color="textTertiary">
          NutriTrack 1.0
        </ThemedText>
        <ThemedText variant="caption" color="textTertiary" style={styles.center}>
          Nutrition values are estimates, not medical advice. Receipts stay on your device.
        </ThemedText>
      </View>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <ThemedText variant="overline" color="textTertiary" style={styles.groupTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  detail,
  danger,
  onPress,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = danger ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.settingsRow, pressed && { backgroundColor: theme.surfaceMuted }]}>
      <IconCircle
        icon={icon}
        size={34}
        background={danger ? theme.dangerSoft : theme.surfaceMuted}
        color={color}
      />
      <View style={styles.flex}>
        <ThemedText variant="bodyStrong" style={{ color }}>
          {label}
        </ThemedText>
        {detail && (
          <ThemedText variant="caption" color="textSecondary">
            {detail}
          </ThemedText>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
    </Pressable>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surfaceMuted }]}>
      {options.map(([v, label]) => {
        const active = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => {
              tap();
              onChange(v);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              active && {
                backgroundColor: theme.surface,
                boxShadow: `0 1px 3px ${theme.shadow}`,
              },
            ]}>
            <ThemedText variant="captionStrong" color={active ? 'text' : 'textSecondary'}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  buttonRow: { flexDirection: 'row', gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  group: { gap: Spacing.two },
  groupTitle: { marginLeft: Spacing.one },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  segmented: { flexDirection: 'row', borderRadius: Radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.sm },
  about: { alignItems: 'center', gap: 4, marginTop: Spacing.four, paddingHorizontal: Spacing.six },
});
