import { Platform } from 'react-native';

import { ensureItemIds } from './nutrition';
import {
  loadCooked,
  loadFavorites,
  loadReceipts,
  loadRecipes,
  loadSettings,
  loadShopping,
  saveReceipts,
  saveRecipes,
  saveSettings,
  saveShopping,
  saveFavorites,
  saveCooked,
} from './storage';
import type { CookedMeal, Receipt, RecipeBatch, SavedRecipe, Settings, ShoppingItem } from './types';

// Everything the app keeps, as one JSON file, so it can move to a new phone or be kept safe.

export type Backup = {
  app: 'NutriTrack';
  version: 1;
  exportedAt: string;
  receipts: Receipt[];
  recipes: RecipeBatch | null;
  favorites: SavedRecipe[];
  shopping: ShoppingItem[];
  cooked: CookedMeal[];
  settings: Settings;
};

export async function buildBackup(): Promise<Backup> {
  const [receipts, recipes, favorites, shopping, cooked, settings] = await Promise.all([
    loadReceipts(),
    loadRecipes(),
    loadFavorites(),
    loadShopping(),
    loadCooked(),
    loadSettings(),
  ]);
  // Photos stay on the device; the file carries only the data.
  return {
    app: 'NutriTrack',
    version: 1,
    exportedAt: new Date().toISOString(),
    receipts: receipts.map(({ photoUri: _photo, ...r }) => r),
    recipes,
    favorites,
    shopping,
    cooked,
    settings,
  };
}

/** Writes the backup and hands it to the share sheet (native) or the browser's download. */
export async function exportBackup(): Promise<'shared' | 'downloaded'> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 1);
  const name = `nutritrack-backup-${backup.exportedAt.slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your NutriTrack backup' });
  return 'shared';
}

function isBackup(value: unknown): value is Backup {
  const v = value as Partial<Backup> | null;
  return !!v && v.app === 'NutriTrack' && Array.isArray(v.receipts);
}

/**
 * Merges a backup into what is on the device: receipts by id (the file wins), saved
 * recipes and cooked meals by id, open shopping lines by text; settings from the file.
 */
export async function importBackup(text: string): Promise<{ receipts: number; favorites: number; shopping: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This is not a NutriTrack backup file.');
  }
  if (!isBackup(parsed)) throw new Error('This is not a NutriTrack backup file.');

  const [receipts, favorites, shopping, cooked] = await Promise.all([
    loadReceipts(),
    loadFavorites(),
    loadShopping(),
    loadCooked(),
  ]);

  const byId = new Map(receipts.map((r) => [r.id, r]));
  for (const r of parsed.receipts) byId.set(r.id, ensureItemIds({ ...byId.get(r.id), ...r, photoUri: byId.get(r.id)?.photoUri }));
  await saveReceipts([...byId.values()]);

  const favIds = new Set(favorites.map((f) => f.id));
  const newFavs = (parsed.favorites ?? []).filter((f) => !favIds.has(f.id));
  await saveFavorites([...newFavs, ...favorites]);

  const openTexts = new Set(shopping.map((s) => s.text.toLowerCase()));
  const newShopping = (parsed.shopping ?? []).filter((s) => !openTexts.has(s.text.toLowerCase()));
  await saveShopping([...newShopping, ...shopping]);

  const mealIds = new Set(cooked.map((m) => m.id));
  await saveCooked([...(parsed.cooked ?? []).filter((m) => !mealIds.has(m.id)), ...cooked].slice(0, 200));

  if (parsed.recipes) await saveRecipes(parsed.recipes);
  if (parsed.settings) await saveSettings({ ...(await loadSettings()), ...parsed.settings });

  return { receipts: parsed.receipts.length, favorites: newFavs.length, shopping: newShopping.length };
}

/** Lets the person pick a backup file; resolves to its text, or null when they cancel. */
export async function pickBackupFile(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        file.text().then(resolve, () => resolve(null));
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }
  const { File } = await import('expo-file-system');
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
  if (picked.canceled) return null;
  return picked.result.text();
}
