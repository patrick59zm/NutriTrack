import { locale, t } from './i18n';
import type { Currency, Nutrition, Receipt, RecipeBatch, ReceiptItem, ReceiptItemAnalysis } from './types';

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

type ItemInput = ReceiptItemAnalysis & { id?: string; consumed?: boolean; edited?: boolean };

export function withTotals(item: ItemInput, id?: string): ReceiptItem {
  return {
    ...item,
    id: id ?? item.id ?? newId('item'),
    nutrition_total: item.is_food ? scale(item.nutrition_per_100g, item.total_weight_g) : EMPTY_NUTRITION,
  };
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Re-derives every computed field after items were changed by hand. */
export function recomputeReceipt(receipt: Receipt): Receipt {
  const items = receipt.items.map((i) => withTotals(i, i.id));
  return { ...receipt, items, totals: sum(items.map((i) => i.nutrition_total)) };
}

/** Receipts saved by older versions have no item ids; give them stable ones once. */
export function ensureItemIds(receipt: Receipt): Receipt {
  if (receipt.items.every((i) => i.id)) return receipt;
  return { ...receipt, items: receipt.items.map((i, n) => ({ ...i, id: i.id ?? `${receipt.id}-${n}` })) };
}

/**
 * Item prices should add up to the printed total. A clear gap means lines were missed,
 * read twice or misread, which is worth a second look.
 */
export function priceCheck(items: { price: number | null }[], total: number | null) {
  const priced = items.filter((i) => i.price != null);
  const sum = priced.reduce((a, i) => a + (i.price ?? 0), 0);
  if (total == null || total <= 0 || priced.length === 0) return { sum, total, gap: 0, ok: true };
  const gap = sum - total;
  const ok = Math.abs(gap) <= Math.max(0.5, total * 0.07);
  return { sum, total, gap, ok };
}

/** What a receipt cost: the printed total, or the sum of its lines when none was read. */
export function receiptSpend(receipt: Pick<Receipt, 'totalPrice' | 'items'>) {
  return receipt.totalPrice ?? receipt.items.reduce((a, i) => a + (i.price ?? 0), 0);
}

/** The warning shown on a receipt whose item prices do not add up to the printed total. */
export function priceWarnings(items: { price: number | null }[], total: number | null): string[] {
  const check = priceCheck(items, total);
  if (check.ok) return [];
  return [
    t('error.priceGap', {
      sum: check.sum.toFixed(2),
      gap: Math.abs(check.gap).toFixed(2),
      direction: t(check.gap > 0 ? 'error.more' : 'error.less'),
      total: check.total?.toFixed(2) ?? '?',
    }),
  ];
}

const sameDay = (a: string, b: string) => {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

/**
 * A receipt scanned twice: same store, same day and the same printed total as one that
 * is already saved. Returns that earlier receipt, so the person can decide.
 */
export function findDuplicate(candidate: Receipt, existing: Receipt[]): Receipt | null {
  if (!candidate.store || candidate.totalPrice == null) return null;
  const store = candidate.store.trim().toLowerCase();
  return (
    existing.find(
      (r) =>
        r.id !== candidate.id &&
        r.store?.trim().toLowerCase() === store &&
        r.totalPrice != null &&
        Math.abs(r.totalPrice - candidate.totalPrice!) < 0.01 &&
        sameDay(r.purchasedAt, candidate.purchasedAt),
    ) ?? null
  );
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
  return n.toLocaleString(locale(), { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export type PantryItem = {
  name: string;
  emoji?: string;
  category: string;
  grams: number;
  boughtDaysAgo: number;
  daysLeft: number;
  receiptId: string;
  itemId: string;
};

/** Food bought within the window, most urgent (fewest days left) first. */
export function pantryFrom(receipts: Receipt[], windowDays: number, now = new Date()): PantryItem[] {
  return receiptsWithin(receipts, windowDays, now)
    .flatMap((r) => {
      const age = daysSince(r.purchasedAt, now);
      return r.items
        .filter((i) => i.is_food && !i.consumed)
        .map((i) => ({
          name: i.name,
          emoji: i.emoji,
          category: i.category,
          grams: i.total_weight_g,
          boughtDaysAgo: age,
          daysLeft: Math.round(i.shelf_life_days) - age,
          receiptId: r.id,
          itemId: i.id,
        }));
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function freshnessLabel(daysLeft: number) {
  if (daysLeft < 0) return t('pantry.checkIt');
  if (daysLeft === 0) return t('pantry.today');
  if (daysLeft > 60) return t('pantry.months');
  return t('common.days', { n: daysLeft });
}

export function freshnessTone(daysLeft: number): 'danger' | 'warn' | 'brand' {
  if (daysLeft <= 1) return 'danger';
  if (daysLeft <= 3) return 'warn';
  return 'brand';
}

export function relativeDay(iso: string, now = new Date()) {
  const d = daysSince(iso, now);
  if (d <= 0) return t('day.today');
  if (d === 1) return t('day.yesterday');
  if (d < 7) return new Date(iso).toLocaleDateString(locale(), { weekday: 'long' });
  return new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

/** Turns whatever a receipt printed ("EUR", "€", "Fr.", "CHF", "SFr") into a currency code. */
export function normalizeCurrency(value: string | null | undefined, fallback: Currency = 'EUR'): Currency {
  const v = (value ?? '').trim().toUpperCase();
  if (/CHF|SFR|FR\.?$|FRANKEN|FRANC/.test(v)) return 'CHF';
  if (/USD|\$/.test(v)) return 'USD';
  if (/GBP|£/.test(v)) return 'GBP';
  if (/EUR|€/.test(v)) return 'EUR';
  return fallback;
}

export function money(value: number, currency: string | null | undefined, fallback: Currency = 'EUR') {
  const code = normalizeCurrency(currency, fallback);
  const amount = value.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  switch (code) {
    case 'CHF':
      return `CHF ${amount}`;
    case 'USD':
      return `$${amount}`;
    case 'GBP':
      return `£${amount}`;
    default:
      return `${amount} €`;
  }
}

/** Saved recipe ideas only count while the dietary preferences they were made for still apply. */
export function recipesMatchDiet(batch: RecipeBatch | null, diet: string) {
  return !!batch && (batch.diet ?? '').trim().toLowerCase() === diet.trim().toLowerCase();
}
