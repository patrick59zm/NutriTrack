import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  daysSince,
  ensureItemIds,
  macroSplit,
  money,
  normalizeCurrency,
  pantryFrom,
  priceCheck,
  recipesMatchDiet,
  recomputeReceipt,
  scale,
  sum,
  withTotals,
} from '../nutrition';
import type { Nutrition, Receipt, ReceiptItemAnalysis } from '../types';

const n = (kcal: number, protein = 0, carbs = 0, fat = 0): Nutrition => ({
  kcal,
  protein_g: protein,
  carbs_g: carbs,
  sugar_g: 0,
  fat_g: fat,
  saturated_fat_g: 0,
  fiber_g: 0,
  salt_g: 0,
});

const item = (over: Partial<ReceiptItemAnalysis> = {}): ReceiptItemAnalysis => ({
  receipt_text: 'BANANE',
  name: 'Bananas',
  emoji: '🍌',
  category: 'fruit',
  is_food: true,
  quantity: 1,
  total_weight_g: 500,
  price: 1.5,
  nutrition_per_100g: n(89, 1.1, 23, 0.3),
  shelf_life_days: 5,
  confidence: 'high',
  ...over,
});

test('scale multiplies per-100g values by the weight', () => {
  assert.deepEqual(scale(n(100, 10, 20, 5), 250), n(250, 25, 50, 12.5));
  assert.equal(scale(n(100), -50).kcal, 0);
});

test('sum adds every nutrient', () => {
  const total = sum([n(100, 1), n(50, 2)]);
  assert.equal(total.kcal, 150);
  assert.equal(total.protein_g, 3);
});

test('withTotals computes the bought amount and skips non-food', () => {
  const food = withTotals(item(), 'a');
  assert.equal(food.id, 'a');
  assert.equal(Math.round(food.nutrition_total.kcal), 445);
  const deposit = withTotals(item({ is_food: false, name: 'Pfand' }));
  assert.equal(deposit.nutrition_total.kcal, 0);
  assert.match(deposit.id, /^item-/);
});

test('macroSplit shares energy 4/4/9', () => {
  const split = macroSplit(n(0, 10, 10, 10)); // 40 + 40 + 90 = 170
  assert.ok(Math.abs(split.fat - 90 / 170) < 1e-9);
  assert.deepEqual(macroSplit(n(0)), { protein: 0, carbs: 0, fat: 0 });
});

test('daysSince counts calendar days, not 24-hour blocks', () => {
  const now = new Date(2026, 9, 29, 8, 0); // 08:00
  assert.equal(daysSince(new Date(2026, 9, 28, 23, 30).toISOString(), now), 1);
  assert.equal(daysSince(new Date(2026, 9, 29, 0, 5).toISOString(), now), 0);
  assert.equal(daysSince(new Date(2026, 9, 22, 12, 0).toISOString(), now), 7);
});

test('priceCheck accepts small gaps and flags large ones', () => {
  assert.equal(priceCheck([{ price: 10 }, { price: 5.3 }], 15.3).ok, true);
  assert.equal(priceCheck([{ price: 10 }, { price: 5 }], 15.4).ok, true); // within 0.50
  const bad = priceCheck([{ price: 10 }, { price: 10 }], 15);
  assert.equal(bad.ok, false);
  assert.equal(bad.gap, 5);
  assert.equal(priceCheck([{ price: null }], 9).ok, true); // nothing to compare
  assert.equal(priceCheck([{ price: 1 }], null).ok, true);
});

test('currency normalization and formatting', () => {
  assert.equal(normalizeCurrency('Fr.'), 'CHF');
  assert.equal(normalizeCurrency('SFr'), 'CHF');
  assert.equal(normalizeCurrency('€'), 'EUR');
  assert.equal(normalizeCurrency(null, 'CHF'), 'CHF');
  assert.equal(money(12.3, 'CHF'), 'CHF 12.30');
  assert.equal(money(5, 'USD'), '$5.00');
  assert.ok(money(2.5, 'EUR').endsWith('€'));
});

test('recomputeReceipt rebuilds item totals and the receipt total', () => {
  const receipt: Receipt = {
    id: 'r1',
    purchasedAt: new Date().toISOString(),
    scannedAt: new Date().toISOString(),
    store: 'Migros',
    currency: 'CHF',
    totalPrice: 3,
    notes: null,
    items: [withTotals(item(), 'i1'), withTotals(item({ total_weight_g: 100 }), 'i2')],
    totals: n(0),
  };
  const changed = recomputeReceipt({ ...receipt, items: receipt.items.map((i) => ({ ...i, total_weight_g: 1000 })) });
  assert.equal(Math.round(changed.items[0].nutrition_total.kcal), 890);
  assert.equal(Math.round(changed.totals.kcal), 1780);
});

test('ensureItemIds gives old receipts stable ids once', () => {
  const legacy = { id: 'r9', items: [{ name: 'A' }, { name: 'B' }] } as unknown as Receipt;
  const fixed = ensureItemIds(legacy);
  assert.deepEqual(fixed.items.map((i) => i.id), ['r9-0', 'r9-1']);
  assert.equal(ensureItemIds(fixed), fixed);
});

test('pantryFrom skips consumed items and sorts by days left', () => {
  const today = new Date().toISOString();
  const receipt: Receipt = {
    id: 'r',
    purchasedAt: today,
    scannedAt: today,
    store: null,
    currency: null,
    totalPrice: null,
    notes: null,
    items: [
      withTotals(item({ name: 'Milk', shelf_life_days: 7 }), 'm'),
      withTotals(item({ name: 'Fish', shelf_life_days: 2 }), 'f'),
      { ...withTotals(item({ name: 'Gone', shelf_life_days: 1 }), 'g'), consumed: true },
      withTotals(item({ name: 'Bag', is_food: false }), 'b'),
    ],
    totals: n(0),
  };
  const pantry = pantryFrom([receipt], 7);
  assert.deepEqual(pantry.map((p) => p.name), ['Fish', 'Milk']);
  assert.equal(pantry[0].daysLeft, 2);
});

test('recipesMatchDiet compares preferences loosely', () => {
  const batch = { createdAt: '', windowDays: 5, diet: 'Vegan ', recipes: [] };
  assert.equal(recipesMatchDiet(batch, 'vegan'), true);
  assert.equal(recipesMatchDiet(batch, 'vegetarian'), false);
  assert.equal(recipesMatchDiet(null, ''), false);
});
