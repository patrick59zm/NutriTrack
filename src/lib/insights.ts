import { daysSince, sum } from './nutrition';
import type { Nutrition, Receipt, ReceiptItem } from './types';

/**
 * Guideline comparisons for a basket of groceries. The reference values are WHO
 * population targets expressed per 1000 kcal so they apply to any amount of food:
 * free sugars under 10% of energy, saturated fat under 10%, fiber 25 g a day,
 * salt under 5 g a day (both at roughly 2000 kcal), and 400 g of fruit and
 * vegetables a day. Groceries are not meals, so the result is a tendency, not a verdict.
 */
export type MetricStatus = 'good' | 'watch' | 'high';

export type BasketMetric = {
  key: 'sugar' | 'satfat' | 'fiber' | 'salt' | 'fruitveg' | 'protein';
  label: string;
  /** The measured value, formatted. */
  value: string;
  /** Where the guideline sits, formatted. */
  target: string;
  /** 0..1 position of the value on the meter; 1 = the meter's right end. */
  fill: number;
  /** 0..1 position of the guideline marker on the meter. */
  marker: number;
  status: MetricStatus;
  note: string;
};

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

export function basketMetrics(
  totals: Nutrition,
  items: ReceiptItem[],
  opts: { days?: number; people?: number } = {},
): BasketMetric[] {
  const kcal = totals.kcal;
  if (kcal < 200) return [];
  const per1000 = (g: number) => g / (kcal / 1000);
  const out: BasketMetric[] = [];

  const sugarShare = (totals.sugar_g * 4) / kcal;
  out.push({
    key: 'sugar',
    label: 'Sugar',
    value: `${Math.round(sugarShare * 100)}% of calories`,
    target: 'under 10%',
    fill: clamp(sugarShare / 0.3),
    marker: 0.1 / 0.3,
    status: sugarShare <= 0.1 ? 'good' : sugarShare <= 0.15 ? 'watch' : 'high',
    note: 'Counts all sugar, including the natural sugar in fruit and milk, so this reads strict.',
  });

  const satShare = (totals.saturated_fat_g * 9) / kcal;
  out.push({
    key: 'satfat',
    label: 'Saturated fat',
    value: `${Math.round(satShare * 100)}% of calories`,
    target: 'under 10%',
    fill: clamp(satShare / 0.3),
    marker: 0.1 / 0.3,
    status: satShare <= 0.1 ? 'good' : satShare <= 0.14 ? 'watch' : 'high',
    note: 'Mostly from butter, cheese, cream, fatty meat and baked goods.',
  });

  const fiber = per1000(totals.fiber_g);
  out.push({
    key: 'fiber',
    label: 'Fiber',
    value: `${fiber.toFixed(1)} g per 1000 kcal`,
    target: 'at least 12.5 g',
    fill: clamp(fiber / 25),
    marker: 12.5 / 25,
    status: fiber >= 12.5 ? 'good' : fiber >= 9 ? 'watch' : 'high',
    note: 'Whole grains, legumes, vegetables and fruit raise it.',
  });

  const salt = per1000(totals.salt_g);
  out.push({
    key: 'salt',
    label: 'Salt',
    value: `${salt.toFixed(1)} g per 1000 kcal`,
    target: 'under 2.5 g',
    fill: clamp(salt / 6),
    marker: 2.5 / 6,
    status: salt <= 2.5 ? 'good' : salt <= 3.5 ? 'watch' : 'high',
    note: 'Bread, cheese, cured meat and ready meals carry most of it.',
  });

  const protShare = (totals.protein_g * 4) / kcal;
  out.push({
    key: 'protein',
    label: 'Protein',
    value: `${Math.round(protShare * 100)}% of calories`,
    target: '10–20%',
    fill: clamp(protShare / 0.4),
    marker: 0.15 / 0.4,
    status: protShare >= 0.1 && protShare <= 0.25 ? 'good' : 'watch',
    note: 'A share between 10 and 20% covers most people; athletes often aim higher.',
  });

  if (opts.days && opts.people) {
    const grams = items
      .filter((i) => i.is_food && (i.category === 'fruit' || i.category === 'vegetables'))
      .reduce((a, i) => a + i.total_weight_g, 0);
    const perPersonDay = grams / opts.days / opts.people;
    out.push({
      key: 'fruitveg',
      label: 'Fruit & vegetables',
      value: `${Math.round(perPersonDay)} g per person and day`,
      target: 'at least 400 g',
      fill: clamp(perPersonDay / 800),
      marker: 0.5,
      status: perPersonDay >= 400 ? 'good' : perPersonDay >= 250 ? 'watch' : 'high',
      note: 'Potatoes do not count; frozen and canned vegetables do.',
    });
  }
  return out;
}

export function metricSummary(metrics: BasketMetric[]) {
  const good = metrics.filter((m) => m.status === 'good').length;
  const high = metrics.filter((m) => m.status === 'high').length;
  if (metrics.length === 0) return 'Not enough food in this period for a check.';
  if (high === 0 && good === metrics.length) return 'A well-balanced basket. Keep it up.';
  if (high === 0) return `${good} of ${metrics.length} in the green, the rest close.`;
  return `${high} thing${high === 1 ? '' : 's'} to look at this time.`;
}

// ---------------------------------------------------------------------------
// Weekly trends

export type WeekPoint = {
  /** Monday of the week, ISO date. */
  start: string;
  label: string;
  kcal: number;
  spent: number;
  receipts: number;
  nutrition: Nutrition;
};

/** Monday-based week start, at local midnight. */
export function weekStart(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

/** Totals for the last `weeks` calendar weeks, oldest first; weeks without receipts are zero. */
export function weeklySeries(receipts: Receipt[], weeks = 8, now = new Date()): WeekPoint[] {
  const thisWeek = weekStart(now);
  const points: WeekPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - 7 * w);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const inWeek = receipts.filter((r) => {
      const t = new Date(r.purchasedAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    points.push({
      start: start.toISOString(),
      label: start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      kcal: inWeek.reduce((a, r) => a + r.totals.kcal, 0),
      spent: inWeek.reduce((a, r) => a + (r.totalPrice ?? 0), 0),
      receipts: inWeek.length,
      nutrition: sum(inWeek.map((r) => r.totals)),
    });
  }
  return points;
}

/** Receipts whose store or items match the query, case-insensitively. */
export function searchReceipts(receipts: Receipt[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return receipts;
  return receipts.filter(
    (r) =>
      (r.store ?? '').toLowerCase().includes(q) ||
      r.items.some((i) => i.name.toLowerCase().includes(q) || i.receipt_text.toLowerCase().includes(q)),
  );
}

export function isThisWeek(iso: string, now = new Date()) {
  return daysSince(iso, now) < 7;
}
