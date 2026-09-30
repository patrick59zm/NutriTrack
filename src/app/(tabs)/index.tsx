import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { NutritionSummary } from '@/components/nutrition-summary';
import { ReceiptRow } from '@/components/receipt-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useFocusData } from '@/hooks/use-focus-data';
import { analyzeReceipt, describeError } from '@/lib/claude';
import { prepareReceiptImage } from '@/lib/image';
import { receiptsWithin, sum } from '@/lib/nutrition';
import { getApiKey, loadReceipts, loadSettings, saveReceipt } from '@/lib/storage';

const SUMMARY_DAYS = 7;

export default function ScanScreen() {
  const { data: receipts } = useFocusData(loadReceipts, []);
  const { data: apiKey, loaded: keyLoaded } = useFocusData(getApiKey, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to photograph receipts.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPreview(asset.uri);
    setBusy(true);
    try {
      const [image, settings] = await Promise.all([prepareReceiptImage(asset), loadSettings()]);
      const receipt = await analyzeReceipt(image, settings.language);
      await saveReceipt(receipt);
      setPreview(null);
      router.push({ pathname: '/receipt/[id]', params: { id: receipt.id } });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const recent = receiptsWithin(receipts, SUMMARY_DAYS);
  const weekTotals = sum(recent.map((r) => r.totals));

  return (
    <Screen>
      {keyLoaded && !apiKey && (
        <Card>
          <ThemedText type="smallBold">Almost ready</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            NutriTrack uses Claude to read receipts. Add your Anthropic API key in Settings.
          </ThemedText>
          <Button title="Open Settings" variant="secondary" onPress={() => router.navigate('/settings')} />
        </Card>
      )}

      <Card>
        <ThemedText type="smallBold">Scan a receipt</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Photograph the whole Kassenzettel, flat and well lit. NutriTrack lists every product with its
          nutrition and adds it to your pantry for recipe ideas.
        </ThemedText>
        {preview && <Image source={{ uri: preview }} style={styles.preview} contentFit="contain" />}
        {busy ? (
          <Button title="Analyzing…" loading onPress={() => {}} />
        ) : (
          <View style={styles.buttons}>
            {Platform.OS !== 'web' && <Button title="Take photo" onPress={() => pick('camera')} />}
            <Button
              title="Choose from gallery"
              variant={Platform.OS === 'web' ? 'primary' : 'secondary'}
              onPress={() => pick('library')}
            />
          </View>
        )}
        {busy && (
          <ThemedText type="small" themeColor="textSecondary">
            Reading items and estimating nutrition. This can take up to a minute.
          </ThemedText>
        )}
        <ErrorText message={error} />
      </Card>

      {recent.length > 0 && (
        <>
          <SectionTitle>Last {SUMMARY_DAYS} days</SectionTitle>
          <Card>
            <NutritionSummary
              nutrition={weekTotals}
              label={`${recent.length} receipt${recent.length === 1 ? '' : 's'}`}
            />
          </Card>
          <SectionTitle>Recent receipts</SectionTitle>
          {recent.slice(0, 3).map((r) => (
            <ReceiptRow key={r.id} receipt={r} />
          ))}
          <Button title="Get recipe ideas" variant="secondary" onPress={() => router.navigate('/recipes')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: Spacing.two },
  preview: { width: '100%', height: 240, borderRadius: Spacing.two },
});
