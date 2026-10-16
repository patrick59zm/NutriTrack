import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DEMO_MODE } from './config';
import { demoReceipts, demoRecipes } from './demo';
import { DEFAULT_SETTINGS, type RecipeBatch, type Receipt, type Settings } from './types';

const RECEIPTS_KEY = 'nutritrack.receipts.v1';
const RECIPES_KEY = 'nutritrack.recipes.v1';
const SETTINGS_KEY = 'nutritrack.settings.v1';
const API_KEY_KEY = 'nutritrack.anthropicApiKey';

// Storage can be unavailable on web (private windows, sandboxed iframes). Fall back to
// memory so the app still works for the session instead of crashing.
const memory = new Map<string, string>();
const kv = {
  async get(key: string) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  async set(key: string, value: string) {
    memory.set(key, value);
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  async remove(key: string) {
    memory.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadReceipts(): Promise<Receipt[]> {
  // Demo builds start with sample data on the very first launch.
  if (DEMO_MODE && (await kv.get(RECEIPTS_KEY)) === null) await loadDemoData();
  const list = await readJson<Receipt[]>(RECEIPTS_KEY, []);
  return list.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
}

export async function saveReceipts(receipts: Receipt[]) {
  await kv.set(RECEIPTS_KEY, JSON.stringify(receipts));
}

export async function saveReceipt(receipt: Receipt) {
  const list = await loadReceipts();
  await saveReceipts([receipt, ...list.filter((r) => r.id !== receipt.id)]);
}

export async function deleteReceipt(id: string) {
  const list = await loadReceipts();
  await saveReceipts(list.filter((r) => r.id !== id));
}

export async function getReceipt(id: string) {
  return (await loadReceipts()).find((r) => r.id === id) ?? null;
}

export async function loadRecipes() {
  return readJson<RecipeBatch | null>(RECIPES_KEY, null);
}

export async function saveRecipes(batch: RecipeBatch) {
  await kv.set(RECIPES_KEY, JSON.stringify(batch));
}

export async function loadSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await readJson<Partial<Settings>>(SETTINGS_KEY, {})) };
}

export async function saveSettings(settings: Settings) {
  await kv.set(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadDemoData() {
  await saveReceipts(demoReceipts());
  await saveRecipes(demoRecipes());
}

export async function clearAllData() {
  await Promise.all([saveReceipts([]), kv.remove(RECIPES_KEY)]);
}

// SecureStore is native-only; on web the key falls back to browser storage.
export async function getApiKey() {
  if (DEMO_MODE) return 'demo';
  if (Platform.OS === 'web') return kv.get(API_KEY_KEY);
  return SecureStore.getItemAsync(API_KEY_KEY);
}

export async function setApiKey(value: string) {
  const key = value.trim();
  if (Platform.OS === 'web') return key ? kv.set(API_KEY_KEY, key) : kv.remove(API_KEY_KEY);
  return key ? SecureStore.setItemAsync(API_KEY_KEY, key) : SecureStore.deleteItemAsync(API_KEY_KEY);
}
