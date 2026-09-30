import type { Nutrition, Receipt, RecipeBatch, ReceiptItem, ReceiptItemAnalysis } from './types';

export const EMPTY_NUTRITION: Nutrition = {
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  sugar_g: 0,
  fat_g: 0,
  saturated_fat_g: 0,
  fiber_g: 0,
  salt_g: 0,
};

const KEYS = Object.keys(EMPTY_NUTRITION) as (keyof Nutrition)[];

export function scale(per100g: Nutrition, grams: number): Nutrition {
  const factor = Math.max(grams, 0) / 100;
  const out = { ...EMPTY_NUTRITION };
  for (const k of KEYS) out[k] = per100g[k] * factor;
  return out;
}

export function sum(list: Nutrition[]): Nutrition {
  const out = { ...EMPTY_NUTRITION };
  for (const n of list) for (const k of KEYS) out[k] += n[k];
  return out;
}

export function withTotals(item: ReceiptItemAnalysis): ReceiptItem {
  return {
    ...item,
    nutrition_total: item.is_food ? scale(item.nutrition_per_100g, item.total_weight_g) : EMPTY_NUTRITION,
  };
}

/** Share of energy from protein / carbs / fat (4 / 4 / 9 kcal per gram). */
export function macroSplit(n: Nutrition) {
  const p = n.protein_g * 4;
  const c = n.carbs_g * 4;
  const f = n.fat_g * 9;
  const total = p + c + f || 1;
  return { protein: p / total, carbs: c / total, fat: f / total };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole calendar days between the date and now (0 = today, 1 = yesterday). */
export function daysSince(iso: string, now = new Date()) {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
}

export function receiptsWithin(receipts: Receipt[], days: number, now = new Date()) {
  return receipts.filter((r) => daysSince(r.purchasedAt, now) <= days);
}

export function fmt(n: number, digits = 0) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export type PantryItem = {
  name: string;
  emoji?: string;
  category: string;
  grams: number;
  boughtDaysAgo: number;
  daysLeft: number;
  receiptId: string;
};

/** Food bought within the window, most urgent (fewest days left) first. */
export function pantryFrom(receipts: Receipt[], windowDays: number, now = new Date()): PantryItem[] {
  return receiptsWithin(receipts, windowDays, now)
    .flatMap((r) => {
      const age = daysSince(r.purchasedAt, now);
      return r.items
        .filter((i) => i.is_food)
        .map((i) => ({
          name: i.name,
          emoji: i.emoji,
          category: i.category,
          grams: i.total_weight_g,
          boughtDaysAgo: age,
          daysLeft: Math.round(i.shelf_life_days) - age,
          receiptId: r.id,
        }));
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function freshnessLabel(daysLeft: number) {
  if (daysLeft < 0) return 'Check it';
  if (daysLeft === 0) return 'Today';
  if (daysLeft === 1) return '1 day';
  if (daysLeft > 60) return 'Months';
  return `${daysLeft} days`;
}

export function freshnessTone(daysLeft: number): 'danger' | 'warn' | 'brand' {
  if (daysLeft <= 1) return 'danger';
  if (daysLeft <= 3) return 'warn';
  return 'brand';
}

export function relativeDay(iso: string, now = new Date()) {
  const d = daysSince(iso, now);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return new Date(iso).toLocaleDateString(undefined, { weekday: 'long' });
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function money(value: number, currency: string | null) {
  const symbol = !currency || /eur|€/i.test(currency) ? '€' : currency;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

/** Saved recipe ideas only count while the dietary preferences they were made for still apply. */
export function recipesMatchDiet(batch: RecipeBatch | null, diet: string) {
  return !!batch && (batch.diet ?? '').trim().toLowerCase() === diet.trim().toLowerCase();
}
