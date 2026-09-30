import type { Nutrition, Receipt, ReceiptItem, ReceiptItemAnalysis } from './types';

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

export function daysSince(iso: string, now = new Date()) {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
}

export function receiptsWithin(receipts: Receipt[], days: number, now = new Date()) {
  return receipts.filter((r) => daysSince(r.purchasedAt, now) <= days);
}

export function fmt(n: number, digits = 0) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
