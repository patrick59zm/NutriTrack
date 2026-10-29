import { locale, t } from './i18n';
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
    label: t('metric.sugar'),
    value: t('metric.pctOfCalories', { n: Math.round(sugarShare * 100) }),
    target: t('metric.under', { v: '10%' }),
    fill: clamp(sugarShare / 0.3),
    marker: 0.1 / 0.3,
    status: sugarShare <= 0.1 ? 'good' : sugarShare <= 0.15 ? 'watch' : 'high',
    note: t('metric.sugarNote'),
  });

  const satShare = (totals.saturated_fat_g * 9) / kcal;
  out.push({
    key: 'satfat',
    label: t('metric.satfat'),
    value: t('metric.pctOfCalories', { n: Math.round(satShare * 100) }),
    target: t('metric.under', { v: '10%' }),
    fill: clamp(satShare / 0.3),
    marker: 0.1 / 0.3,
    status: satShare <= 0.1 ? 'good' : satShare <= 0.14 ? 'watch' : 'high',
    note: t('metric.satfatNote'),
  });

  const fiber = per1000(totals.fiber_g);
  out.push({
    key: 'fiber',
    label: t('metric.fiber'),
    value: t('metric.gPer1000', { v: fiber.toFixed(1) }),
    target: t('metric.atLeast', { v: '12.5 g' }),
    fill: clamp(fiber / 25),
    marker: 12.5 / 25,
    status: fiber >= 12.5 ? 'good' : fiber >= 9 ? 'watch' : 'high',
    note: t('metric.fiberNote'),
  });

  const salt = per1000(totals.salt_g);
  out.push({
    key: 'salt',
    label: t('metric.salt'),
    value: t('metric.gPer1000', { v: salt.toFixed(1) }),
    target: t('metric.under', { v: '2.5 g' }),
    fill: clamp(salt / 6),
    marker: 2.5 / 6,
    status: salt <= 2.5 ? 'good' : salt <= 3.5 ? 'watch' : 'high',
    note: t('metric.saltNote'),
  });

  const protShare = (totals.protein_g * 4) / kcal;
  out.push({
    key: 'protein',
    label: t('metric.protein'),
    value: t('metric.pctOfCalories', { n: Math.round(protShare * 100) }),
    target: t('metric.proteinTarget'),
    fill: clamp(protShare / 0.4),
    marker: 0.15 / 0.4,
    status: protShare >= 0.1 && protShare <= 0.25 ? 'good' : 'watch',
    note: t('metric.proteinNote'),
  });

  if (opts.days && opts.people) {
    const grams = items
      .filter((i) => i.is_food && (i.category === 'fruit' || i.category === 'vegetables'))
      .reduce((a, i) => a + i.total_weight_g, 0);
    const perPersonDay = grams / opts.days / opts.people;
    out.push({
      key: 'fruitveg',
      label: t('metric.fruitveg'),
      value: t('metric.gPerPersonDay', { v: Math.round(perPersonDay) }),
      target: t('metric.atLeast', { v: '400 g' }),
      fill: clamp(perPersonDay / 800),
      marker: 0.5,
      status: perPersonDay >= 400 ? 'good' : perPersonDay >= 250 ? 'watch' : 'high',
      note: t('metric.fruitvegNote'),
    });
  }
  return out;
}

export function metricSummary(metrics: BasketMetric[]) {
  const good = metrics.filter((m) => m.status === 'good').length;
  const high = metrics.filter((m) => m.status === 'high').length;
  if (metrics.length === 0) return t('summary.notEnough');
  if (high === 0 && good === metrics.length) return t('summary.balanced');
  if (high === 0) return t('summary.partly', { good, total: metrics.length });
  return t('summary.toLook', { n: high });
}

// ---------------------------------------------------------------------------
// Spending

/** Money per product category, from priced lines (discount lines are left out). */
export function spendingByCategory(receipts: Receipt[]) {
  const by = new Map<string, number>();
  for (const r of receipts)
    for (const i of r.items) if (i.price != null && i.price > 0) by.set(i.category, (by.get(i.category) ?? 0) + i.price);
  return [...by.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/** Money per store, from the printed totals (or the lines when none was read). */
export function spendingByStore(receipts: Receipt[]) {
  const by = new Map<string, { store: string | null; amount: number; receipts: number }>();
  for (const r of receipts) {
    const key = (r.store ?? '').trim().toLowerCase();
    const amount = r.totalPrice ?? r.items.reduce((a, i) => a + (i.price ?? 0), 0);
    const entry = by.get(key) ?? { store: r.store, amount: 0, receipts: 0 };
    entry.amount += amount;
    entry.receipts += 1;
    by.set(key, entry);
  }
  return [...by.values()].sort((a, b) => b.amount - a.amount);
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
      label: start.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }),
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
