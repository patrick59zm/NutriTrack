import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, Chip, ConfirmSheet, Divider, IconCircle, Screen, Stepper, SwitchRow, type IconName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { DEMO_MODE } from '@/lib/config';
import { success, tap } from '@/lib/haptics';
import { exportBackup, exportCsv, importBackup, pickBackupFile } from '@/lib/backup';
import { everyLanguage, locale, useT, type Key } from '@/lib/i18n';
import { fmt } from '@/lib/nutrition';
import { REMINDER_HOURS, reminderPlan, reminderTime, requestReminderPermission, syncReminders } from '@/lib/reminders';
import {
  clearAllData,
  getApiKey,
  loadDemoData,
  loadReceipts,
  loadSettings,
  loadUsage,
  resetUsage,
  saveSettings,
  setApiKey,
  type UsageTotals,
} from '@/lib/storage';
import { DEFAULT_SETTINGS, type Currency, type Settings } from '@/lib/types';

const DIET_SUGGESTIONS: Key[] = [
  'diet.vegetarian',
  'diet.vegan',
  'diet.pescatarian',
  'diet.highProtein',
  'diet.lowCarb',
  'diet.glutenFree',
  'diet.noNuts',
  'diet.lactoseFree',
];
const COOK_TIMES: (number | null)[] = [null, 15, 30, 45, 60];
const CURRENCIES: [Currency, Key][] = [
  ['EUR', 'settings.currencyEur'],
  ['CHF', 'settings.currencyChf'],
  ['USD', 'settings.currencyUsd'],
  ['GBP', 'settings.currencyGbp'],
];

/** A diet chip's word in either language, so the chips stay in step with the stored text after a language switch. */
const dietWords = (tag: Key) => new Set(everyLanguage(tag).map((w) => w.toLowerCase()));

const loadSettingsScreen = async () => {
  const [apiKey, settings, usage, receipts] = await Promise.all([getApiKey(), loadSettings(), loadUsage(), loadReceipts()]);
  return { apiKey, settings, usage, upcoming: reminderPlan(receipts, new Date(), settings.reminderHour).slice(0, 3) };
};

export default function SettingsScreen() {
  const theme = useTheme();
  const t = useT();
  const { data, setData, reload } = useFocusData(loadSettingsScreen, {
    apiKey: null as string | null,
    settings: DEFAULT_SETTINGS,
    usage: null as UsageTotals | null,
    upcoming: [] as { date: Date; items: string[] }[],
  });
  const [keyInput, setKeyInput] = useState('');
  // Local draft while typing; falls back to the stored value.
  const [dietDraft, setDiet] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const { apiKey, settings, usage, upcoming } = data;
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
    setToast(value ? t('settings.keySaved') : t('settings.keyRemoved'));
  }

  async function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setData({ ...data, settings: next });
    await saveSettings(next);
  }

  function toggleDiet(tag: Key) {
    const words = dietWords(tag);
    const parts = diet
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const has = parts.some((p) => words.has(p.toLowerCase()));
    const next = (has ? parts.filter((p) => !words.has(p.toLowerCase())) : [...parts, t(tag)]).join(', ');
    setDiet(null);
    update({ diet: next });
  }

  async function toggleReminders(on: boolean) {
    if (on) {
      const granted = await requestReminderPermission();
      if (!granted) {
        setToast(Platform.OS === 'web' ? t('settings.remindersWeb') : t('settings.remindersDenied'));
        return;
      }
    }
    await update({ remindersEnabled: on });
    await syncReminders();
    setToast(on ? t('settings.remindersOn', { time: reminderTime(settings.reminderHour) }) : t('settings.remindersOff'));
  }

  async function doExport() {
    try {
      const how = await exportBackup();
      setToast(how === 'downloaded' ? t('settings.backupDownloaded') : t('settings.backupReady'));
    } catch (e) {
      setToast(e instanceof Error ? e.message : t('settings.exportFailed'));
    }
  }

  async function doCsv() {
    try {
      const how = await exportCsv();
      setToast(how === 'downloaded' ? t('settings.csvDownloaded') : t('settings.backupReady'));
    } catch (e) {
      setToast(e instanceof Error ? e.message : t('settings.exportFailed'));
    }
  }

  async function doImport() {
    try {
      const text = await pickBackupFile();
      if (!text) return;
      const result = await importBackup(text);
      await syncReminders();
      success();
      setToast(
        t('settings.imported', {
          receipts: t('common.receipts', { n: result.receipts }),
          favorites: t('settings.importedFavorites', { n: result.favorites }),
          shopping: t('settings.importedShopping', { n: result.shopping }),
        }),
      );
      reload();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t('settings.importFailed'));
    }
  }

  const confirmClear = () => setConfirmingClear(true);
  async function clearEverything() {
    await clearAllData();
    reload();
    setToast(t('settings.allDeleted'));
  }

  const activeDiet = diet.toLowerCase();

  return (
    <Screen title={t('settings.title')}>
      <Banner tone="brand" message={toast} onDismiss={() => setToast(null)} />
      <ConfirmSheet
        visible={confirmingClear}
        title={t('settings.deleteAllTitle')}
        message={t('settings.deleteAllMessage')}
        confirmLabel={t('common.delete')}
        onConfirm={clearEverything}
        onClose={() => setConfirmingClear(false)}
      />

      <Group title={t('settings.claude')}>
        <Card>
          <View style={styles.row}>
            <IconCircle icon="sparkles" background={theme.brandSoft} color={theme.brandStrong} size={40} />
            <View style={styles.flex}>
              <ThemedText variant="bodyStrong">{t('settings.apiKey')}</ThemedText>
              <View style={styles.status}>
                <View style={[styles.statusDot, { backgroundColor: apiKey ? theme.brand : theme.textTertiary }]} />
                <ThemedText variant="caption" color="textSecondary">
                  {DEMO_MODE
                    ? t('settings.demoNoKey')
                    : apiKey
                      ? t('settings.connected', { last4: apiKey.slice(-4) })
                      : t('settings.notConnected')}
                </ThemedText>
              </View>
            </View>
          </View>
          <TextInput
            value={keyInput}
            onChangeText={setKeyInput}
            placeholder={apiKey ? t('settings.pasteNewKey') : 'sk-ant-…'}
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={inputStyle}
          />
          <View style={styles.buttonRow}>
            <View style={styles.flex}>
              <Button
                title={t('settings.saveKey')}
                compact
                disabled={!keyInput.trim()}
                onPress={() => saveKey(keyInput.trim())}
              />
            </View>
            {apiKey && (
              <View style={styles.flex}>
                <Button title={t('common.remove')} compact variant="secondary" onPress={() => saveKey('')} />
              </View>
            )}
          </View>
          <Pressable onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}>
            <ThemedText variant="caption" color="brand">
              {t('settings.getKey')}
            </ThemedText>
          </Pressable>
          <ThemedText variant="caption" color="textTertiary">
            {t('settings.keyNote')}
          </ThemedText>
        </Card>
        <Card>
          <ThemedText variant="bodyStrong">{t('settings.model')}</ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {t('settings.modelNote')}
          </ThemedText>
          <Segmented
            value={settings.model}
            options={[
              ['best', t('settings.modelBest')],
              ['fast', t('settings.modelFast')],
            ]}
            onChange={(model) => update({ model })}
          />
        </Card>
        {usage && usage.scans + usage.recipeRequests + usage.estimates > 0 && (
          <Card>
            <View style={styles.row}>
              <IconCircle icon="wallet-outline" size={40} />
              <View style={styles.flex}>
                <ThemedText variant="bodyStrong">{t('settings.usageTitle')}</ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  {t('settings.usageScans', { n: usage.scans })} · {t('settings.usageRounds', { n: usage.recipeRequests })} ·{' '}
                  {t('settings.usageEstimates', { n: usage.estimates })}
                </ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  {t('settings.usageTokens', { tokens: fmt(usage.inputTokens + usage.outputTokens), cost: usage.costUsd.toFixed(2) })}
                </ThemedText>
              </View>
            </View>
            <Button
              title={t('settings.resetCounter')}
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

      <Group title={t('settings.preferences')}>
        <Card>
          <ThemedText variant="bodyStrong">{t('settings.language')}</ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {t('settings.languageNote')}
          </ThemedText>
          <Segmented
            value={settings.language}
            options={[
              ['en', 'English'],
              ['de', 'Deutsch'],
            ]}
            onChange={(language) => update({ language })}
          />
          <Divider />
          <ThemedText variant="bodyStrong">{t('settings.currency')}</ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {t('settings.currencyNote')}
          </ThemedText>
          <View style={styles.chips}>
            {CURRENCIES.map(([code, label]) => (
              <Chip key={code} label={t(label)} selected={settings.currency === code} onPress={() => update({ currency: code })} />
            ))}
          </View>
          <Divider />
          <View style={styles.row}>
            <View style={styles.flex}>
              <ThemedText variant="bodyStrong">{t('settings.household')}</ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                {t('settings.householdNote')}
              </ThemedText>
            </View>
            <Stepper
              label={t('settings.household')}
              value={settings.householdSize}
              min={1}
              max={8}
              onChange={(householdSize) => update({ householdSize })}
            />
          </View>
          <Divider />
          <ThemedText variant="bodyStrong">{t('settings.cookTime')}</ThemedText>
          <View style={styles.chips}>
            {COOK_TIMES.map((minutes) => (
              <Chip
                key={String(minutes)}
                label={minutes ? t('common.min', { n: minutes }) : t('settings.any')}
                selected={settings.maxCookMinutes === minutes}
                onPress={() => update({ maxCookMinutes: minutes })}
              />
            ))}
          </View>
          <Divider />
          <ThemedText variant="bodyStrong">{t('settings.diet')}</ThemedText>
          <View style={styles.chips}>
            {DIET_SUGGESTIONS.map((tag) => (
              <Chip
                key={tag}
                label={t(tag)}
                selected={activeDiet.split(',').some((p) => dietWords(tag).has(p.trim()))}
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
            placeholder={t('settings.dietPlaceholder')}
            placeholderTextColor={theme.textTertiary}
            style={inputStyle}
          />
        </Card>
      </Group>

      <Group title={t('settings.reminders')}>
        <Card>
          <SwitchRow
            label={t('settings.useSoonLabel')}
            detail={t('settings.useSoonDetail', { time: reminderTime(settings.reminderHour) })}
            value={settings.remindersEnabled}
            onChange={toggleReminders}
          />
          {settings.remindersEnabled && (
            <>
              <ThemedText variant="captionStrong" color="textSecondary">
                {t('settings.reminderHour')}
              </ThemedText>
              <View style={styles.chips}>
                {REMINDER_HOURS.map((hour) => (
                  <Chip
                    key={hour}
                    label={reminderTime(hour)}
                    selected={settings.reminderHour === hour}
                    onPress={async () => {
                      await update({ reminderHour: hour });
                      await syncReminders();
                      reload();
                    }}
                  />
                ))}
              </View>
            </>
          )}
          {settings.remindersEnabled && upcoming.length > 0 && (
            <View style={styles.upcoming}>
              {upcoming.map((u) => (
                <ThemedText key={u.date.toISOString()} variant="caption" color="textSecondary">
                  {u.date.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })}: {u.items.join(', ')}
                </ThemedText>
              ))}
            </View>
          )}
          {settings.remindersEnabled && upcoming.length === 0 && (
            <ThemedText variant="caption" color="textTertiary">
              {t('settings.nothingClose')}
            </ThemedText>
          )}
        </Card>
      </Group>

      <Group title={t('settings.data')}>
        <Card padded={false}>
          <SettingsRow icon="download-outline" label={t('settings.export')} detail={t('settings.exportDetail')} onPress={doExport} />
          <Divider />
          <SettingsRow icon="cloud-upload-outline" label={t('settings.import')} detail={t('settings.importDetail')} onPress={doImport} />
          <Divider />
          <SettingsRow icon="grid-outline" label={t('settings.csv')} detail={t('settings.csvDetail')} onPress={doCsv} />
          <Divider />
          <SettingsRow
            icon="sparkles"
            label={t('common.loadSample')}
            detail={t('settings.sampleDetail')}
            onPress={async () => {
              await loadDemoData();
              success();
              setToast(t('settings.sampleLoaded'));
            }}
          />
          <Divider />
          <SettingsRow icon="trash-outline" label={t('settings.deleteAll')} danger onPress={confirmClear} />
        </Card>
      </Group>

      <View style={styles.about}>
        <ThemedText variant="captionStrong" color="textTertiary">
          NutriTrack {Constants.expoConfig?.version ?? '1.0'}
          {Constants.expoConfig?.android?.versionCode ? ` · ${t('settings.build', { n: Constants.expoConfig.android.versionCode })}` : ''}
        </ThemedText>
        <ThemedText variant="caption" color="textTertiary" style={styles.center}>
          {t('settings.disclaimer')}
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
  upcoming: { gap: 2 },
});
