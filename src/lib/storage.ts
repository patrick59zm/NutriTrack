import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DEMO_MODE } from './config';
import { demoReceipts, demoRecipes } from './demo';
import { setLanguage } from './i18n';
import { ensureItemIds } from './nutrition';
import { deleteReceiptPhoto } from './photos';
import {
  DEFAULT_SETTINGS,
  type CookedMeal,
  type Recipe,
  type RecipeBatch,
  type Receipt,
  type SavedRecipe,
  type Settings,
  type ShoppingItem,
  type Usage,
} from './types';

const RECEIPTS_KEY = 'nutritrack.receipts.v1';
const RECIPES_KEY = 'nutritrack.recipes.v1';
const SETTINGS_KEY = 'nutritrack.settings.v1';
const USAGE_KEY = 'nutritrack.usage.v1';
const FAVORITES_KEY = 'nutritrack.favorites.v1';
const SHOPPING_KEY = 'nutritrack.shopping.v1';
const COOKED_KEY = 'nutritrack.cooked.v1';
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
  return list.map(ensureItemIds).sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
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
  await deleteReceiptPhoto(list.find((r) => r.id === id)?.photoUri);
  await saveReceipts(list.filter((r) => r.id !== id));
}

/** Applies a change to one stored receipt and returns the result (null if it is gone). */
export async function updateReceipt(id: string, change: (receipt: Receipt) => Receipt): Promise<Receipt | null> {
  const list = await loadReceipts();
  const current = list.find((r) => r.id === id);
  if (!current) return null;
  const next = change(current);
  await saveReceipts(list.map((r) => (r.id === id ? next : r)));
  return next;
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
  const settings = { ...DEFAULT_SETTINGS, ...(await readJson<Partial<Settings>>(SETTINGS_KEY, {})) };
  setLanguage(settings.language);
  return settings;
}

export async function saveSettings(settings: Settings) {
  setLanguage(settings.language);
  await kv.set(SETTINGS_KEY, JSON.stringify(settings));
}

/** Marks items (by receipt and item id) as used up, or back in the kitchen. */
export async function setItemsConsumed(refs: { receiptId: string; itemId: string }[], consumed: boolean) {
  const byReceipt = new Map<string, Set<string>>();
  for (const ref of refs) {
    if (!byReceipt.has(ref.receiptId)) byReceipt.set(ref.receiptId, new Set());
    byReceipt.get(ref.receiptId)!.add(ref.itemId);
  }
  const list = await loadReceipts();
  await saveReceipts(
    list.map((r) => {
      const ids = byReceipt.get(r.id);
      if (!ids) return r;
      return { ...r, items: r.items.map((i) => (ids.has(i.id) ? { ...i, consumed } : i)) };
    }),
  );
}

// Saved recipes

export async function loadFavorites(): Promise<SavedRecipe[]> {
  return readJson<SavedRecipe[]>(FAVORITES_KEY, []);
}

export function recipeKey(recipe: Recipe) {
  return recipe.title.trim().toLowerCase();
}

export async function saveFavorites(list: SavedRecipe[]) {
  await kv.set(FAVORITES_KEY, JSON.stringify(list));
}

export async function toggleFavorite(recipe: Recipe): Promise<boolean> {
  const list = await loadFavorites();
  const key = recipeKey(recipe);
  const exists = list.some((f) => recipeKey(f.recipe) === key);
  const next = exists
    ? list.filter((f) => recipeKey(f.recipe) !== key)
    : [{ id: `fav-${Date.now().toString(36)}`, savedAt: new Date().toISOString(), recipe }, ...list];
  await kv.set(FAVORITES_KEY, JSON.stringify(next));
  return !exists;
}

// Shopping list

export async function loadShopping(): Promise<ShoppingItem[]> {
  return readJson<ShoppingItem[]>(SHOPPING_KEY, []);
}

export async function saveShopping(items: ShoppingItem[]) {
  await kv.set(SHOPPING_KEY, JSON.stringify(items));
}

/** Adds lines that are not already open on the list; returns how many were new. */
export async function addToShopping(texts: string[], from?: string): Promise<number> {
  const list = await loadShopping();
  const open = new Set(list.filter((i) => !i.done).map((i) => i.text.trim().toLowerCase()));
  const fresh = texts
    .map((t) => t.trim())
    .filter((t) => t && !open.has(t.toLowerCase()))
    .map((text, n) => ({
      id: `shop-${Date.now().toString(36)}-${n}`,
      text,
      done: false,
      addedAt: new Date().toISOString(),
      ...(from && { from }),
    }));
  if (fresh.length) await saveShopping([...fresh, ...list]);
  return fresh.length;
}

// Cooked meals

export async function loadCooked(): Promise<CookedMeal[]> {
  return readJson<CookedMeal[]>(COOKED_KEY, []);
}

export async function saveCooked(list: CookedMeal[]) {
  await kv.set(COOKED_KEY, JSON.stringify(list));
}

export async function recordCooked(recipe: Recipe) {
  const list = await loadCooked();
  const meal: CookedMeal = {
    id: `meal-${Date.now().toString(36)}`,
    title: recipe.title,
    emoji: recipe.emoji,
    cookedAt: new Date().toISOString(),
  };
  await kv.set(COOKED_KEY, JSON.stringify([meal, ...list].slice(0, 200)));
}

// Running total of what Claude calls have cost, kept even when receipts are deleted.
export type UsageTotals = Usage & { scans: number; recipeRequests: number; estimates: number };

const EMPTY_USAGE: UsageTotals = {
  scans: 0,
  recipeRequests: 0,
  estimates: 0,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
};

export async function loadUsage(): Promise<UsageTotals> {
  return { ...EMPTY_USAGE, ...(await readJson<Partial<UsageTotals>>(USAGE_KEY, {})) };
}

export async function recordUsage(kind: 'scans' | 'recipeRequests' | 'estimates', usage: Usage) {
  const totals = await loadUsage();
  totals[kind] += 1;
  totals.inputTokens += usage.inputTokens;
  totals.outputTokens += usage.outputTokens;
  totals.costUsd += usage.costUsd;
  await kv.set(USAGE_KEY, JSON.stringify(totals));
}

export async function resetUsage() {
  await kv.remove(USAGE_KEY);
}

export async function loadDemoData() {
  await saveReceipts(demoReceipts());
  await saveRecipes(demoRecipes());
}

/** Removes receipts, recipe ideas, saved recipes, the shopping list, cooked meals and the usage counter; settings and the key stay. */
export async function clearAllData() {
  for (const r of await loadReceipts()) await deleteReceiptPhoto(r.photoUri);
  await Promise.all([
    saveReceipts([]),
    kv.remove(RECIPES_KEY),
    kv.remove(COOKED_KEY),
    kv.remove(FAVORITES_KEY),
    kv.remove(SHOPPING_KEY),
    kv.remove(USAGE_KEY),
  ]);
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
