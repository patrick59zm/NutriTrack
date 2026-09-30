import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DEFAULT_SETTINGS, type RecipeBatch, type Receipt, type Settings } from './types';

const RECEIPTS_KEY = 'nutritrack.receipts.v1';
const RECIPES_KEY = 'nutritrack.recipes.v1';
const SETTINGS_KEY = 'nutritrack.settings.v1';
const API_KEY_KEY = 'nutritrack.anthropicApiKey';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadReceipts(): Promise<Receipt[]> {
  const list = await readJson<Receipt[]>(RECEIPTS_KEY, []);
  return list.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
}

export async function saveReceipt(receipt: Receipt) {
  const list = await loadReceipts();
  await AsyncStorage.setItem(
    RECEIPTS_KEY,
    JSON.stringify([receipt, ...list.filter((r) => r.id !== receipt.id)]),
  );
}

export async function deleteReceipt(id: string) {
  const list = await loadReceipts();
  await AsyncStorage.setItem(RECEIPTS_KEY, JSON.stringify(list.filter((r) => r.id !== id)));
}

export async function getReceipt(id: string) {
  return (await loadReceipts()).find((r) => r.id === id) ?? null;
}

export async function loadRecipes() {
  return readJson<RecipeBatch | null>(RECIPES_KEY, null);
}

export async function saveRecipes(batch: RecipeBatch) {
  await AsyncStorage.setItem(RECIPES_KEY, JSON.stringify(batch));
}

export async function loadSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await readJson<Partial<Settings>>(SETTINGS_KEY, {})) };
}

export async function saveSettings(settings: Settings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function clearAllData() {
  await AsyncStorage.multiRemove([RECEIPTS_KEY, RECIPES_KEY]);
}

// SecureStore is native-only; on web the key falls back to AsyncStorage (localStorage).
export async function getApiKey() {
  if (Platform.OS === 'web') return AsyncStorage.getItem(API_KEY_KEY);
  return SecureStore.getItemAsync(API_KEY_KEY);
}

export async function setApiKey(value: string) {
  const key = value.trim();
  if (Platform.OS === 'web') {
    return key ? AsyncStorage.setItem(API_KEY_KEY, key) : AsyncStorage.removeItem(API_KEY_KEY);
  }
  return key ? SecureStore.setItemAsync(API_KEY_KEY, key) : SecureStore.deleteItemAsync(API_KEY_KEY);
}
