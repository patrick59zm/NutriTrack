import { useState } from 'react';
import { Alert, Platform, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { clearAllData, getApiKey, loadSettings, saveSettings, setApiKey } from '@/lib/storage';
import { DEFAULT_SETTINGS, type Language } from '@/lib/types';

export default function SettingsScreen() {
  const theme = useTheme();
  const { data: storedKey, reload: reloadKey } = useFocusData(getApiKey, null);
  const { data: settings, setData: setSettings } = useFocusData(loadSettings, DEFAULT_SETTINGS);
  const [keyInput, setKeyInput] = useState('');
  // Local draft while typing; falls back to the stored value.
  const [dietDraft, setDiet] = useState<string | null>(null);
  const diet = dietDraft ?? settings.diet;
  const [saved, setSaved] = useState<string | null>(null);

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
  ];

  async function saveKey() {
    await setApiKey(keyInput);
    setKeyInput('');
    await reloadKey();
    setSaved(keyInput.trim() ? 'API key saved.' : 'API key removed.');
  }

  async function update(patch: Partial<typeof settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
    setSaved('Preferences saved.');
  }

  function confirmClear() {
    const run = async () => {
      await clearAllData();
      setSaved('All receipts and recipes deleted.');
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

  return (
    <Screen>
      <Card>
        <ThemedText type="smallBold">Anthropic API key</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {storedKey
            ? `Saved (…${storedKey.slice(-4)}). Stored only on this device.`
            : 'Create one at console.anthropic.com. It is stored only on this device.'}
        </ThemedText>
        <TextInput
          value={keyInput}
          onChangeText={setKeyInput}
          placeholder="sk-ant-…"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={inputStyle}
        />
        <Button
          title={storedKey && !keyInput ? 'Remove key' : 'Save key'}
          variant="secondary"
          disabled={!storedKey && !keyInput.trim()}
          onPress={saveKey}
        />
      </Card>

      <Card>
        <ThemedText type="smallBold">Language for product names and recipes</ThemedText>
        <View style={styles.chips}>
          {(
            [
              ['en', 'English'],
              ['de', 'Deutsch'],
            ] as [Language, string][]
          ).map(([code, label]) => (
            <Chip
              key={code}
              label={label}
              selected={settings.language === code}
              onPress={() => update({ language: code })}
            />
          ))}
        </View>
      </Card>

      <Card>
        <ThemedText type="smallBold">Dietary preferences</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          e.g. vegetarian, high protein, no nuts, cooking for 2
        </ThemedText>
        <TextInput
          value={diet}
          onChangeText={setDiet}
          onBlur={() => {
            if (diet !== settings.diet) update({ diet });
            setDiet(null);
          }}
          placeholder="None"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />
      </Card>

      {saved && (
        <ThemedText type="small" themeColor="textSecondary">
          {saved}
        </ThemedText>
      )}

      <Button title="Delete all receipts" variant="danger" onPress={confirmClear} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', gap: Spacing.two },
});
