import assert from 'node:assert/strict';
import { test } from 'node:test';

import { basketMetrics, searchReceipts, weekStart, weeklySeries } from '../insights';
import { withTotals } from '../nutrition';
import type { Nutrition, Receipt, ReceiptItemAnalysis } from '../types';

const n = (over: Partial<Nutrition> = {}): Nutrition => ({
  kcal: 2000,
  protein_g: 75,
  carbs_g: 250,
  sugar_g: 40,
  fat_g: 70,
  saturated_fat_g: 20,
  fiber_g: 30,
  salt_g: 4,
  ...over,
});

const veg = (grams: number): ReceiptItemAnalysis => ({
  receipt_text: 'KAROTTEN',
  name: 'Carrots',
  emoji: '🥕',
  category: 'vegetables',
  is_food: true,
  quantity: 1,
  total_weight_g: grams,
  price: 1,
  nutrition_per_100g: n({ kcal: 41 }),
  shelf_life_days: 14,
  confidence: 'high',
});

const receipt = (id: string, daysAgo: number, kcal: number, price: number): Receipt => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id,
    purchasedAt: d.toISOString(),
    scannedAt: d.toISOString(),
    store: id.startsWith('m') ? 'Migros' : 'Coop',
    currency: 'CHF',
    totalPrice: price,
    notes: null,
    items: [withTotals(veg(300), `${id}-0`)],
    totals: n({ kcal }),
  };
};

test('basketMetrics reads a balanced basket as good', () => {
  const metrics = basketMetrics(n(), [withTotals(veg(6000), 'v')], { days: 7, people: 2 });
  const byKey = Object.fromEntries(metrics.map((m) => [m.key, m]));
  assert.equal(byKey.sugar.status, 'good'); // 8% of energy
  assert.equal(byKey.satfat.status, 'good'); // 9%
  assert.equal(byKey.fiber.status, 'good'); // 15 g / 1000 kcal
  assert.equal(byKey.salt.status, 'good'); // 2 g / 1000 kcal
  assert.equal(byKey.fruitveg.status, 'good'); // 6000 g / 7 / 2 = 429 g
  assert.equal(byKey.fruitveg.value, '429 g per person and day');
});

test('basketMetrics flags high sugar and salt', () => {
  const metrics = basketMetrics(n({ sugar_g: 120, salt_g: 9 }), []);
  const byKey = Object.fromEntries(metrics.map((m) => [m.key, m]));
  assert.equal(byKey.sugar.status, 'high'); // 24% of energy
  assert.equal(byKey.salt.status, 'high'); // 4.5 g / 1000 kcal
  assert.equal(metrics.some((m) => m.key === 'fruitveg'), false); // no period given
});

test('basketMetrics needs a minimum of food', () => {
  assert.deepEqual(basketMetrics(n({ kcal: 100 }), []), []);
});

test('weekStart is the local Monday', () => {
  const wed = new Date(2026, 9, 28, 15, 0); // Wednesday
  const start = weekStart(wed);
  assert.equal(start.getDay(), 1);
  assert.equal(start.getDate(), 26);
  assert.equal(start.getHours(), 0);
  assert.equal(weekStart(new Date(2026, 9, 26, 0, 0)).getDate(), 26); // Monday stays
  assert.equal(weekStart(new Date(2026, 10, 1, 12, 0)).getDate(), 26); // Sunday belongs to that Monday
});

test('weeklySeries buckets receipts into calendar weeks, oldest first', () => {
  const now = new Date(2026, 9, 29, 12, 0);
  const receipts = [receipt('m1', 0, 1000, 10), receipt('c1', 1, 500, 5), receipt('m2', 8, 700, 7)];
  const series = weeklySeries(receipts, 4, now);
  assert.equal(series.length, 4);
  assert.equal(series[3].kcal, 1500);
  assert.equal(series[3].receipts, 2);
  assert.equal(series[3].spent, 15);
  assert.equal(series[2].kcal, 700);
  assert.equal(series[0].kcal, 0);
  assert.ok(series[0].start < series[3].start);
});

test('searchReceipts matches stores, names and receipt text', () => {
  const receipts = [receipt('m1', 0, 1, 1), receipt('c1', 0, 1, 1)];
  assert.deepEqual(searchReceipts(receipts, 'migros').map((r) => r.id), ['m1']);
  assert.equal(searchReceipts(receipts, 'karot').length, 2);
  assert.equal(searchReceipts(receipts, 'CARROT').length, 2);
  assert.equal(searchReceipts(receipts, 'zzz').length, 0);
  assert.equal(searchReceipts(receipts, '  ').length, 2);
});
