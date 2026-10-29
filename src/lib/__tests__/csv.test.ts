import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCsv } from '../csv';
import { spendingByCategory, spendingByStore } from '../insights';
import { EMPTY_NUTRITION } from '../nutrition';
import type { Receipt, ReceiptItem } from '../types';

const item = (name: string, category: string, price: number | null, extra: Partial<ReceiptItem> = {}): ReceiptItem => ({
  id: name,
  receipt_text: name.toUpperCase(),
  name,
  emoji: '',
  category,
  is_food: category !== 'non_food',
  quantity: 1,
  total_weight_g: 100,
  price,
  nutrition_per_100g: { ...EMPTY_NUTRITION, kcal: 50 },
  nutrition_total: { ...EMPTY_NUTRITION, kcal: 50 },
  shelf_life_days: 5,
  confidence: 'high',
  ...extra,
});

const receipt = (id: string, store: string | null, total: number | null, items: ReceiptItem[]): Receipt => ({
  id,
  purchasedAt: '2026-10-28T12:00:00.000Z',
  scannedAt: '2026-10-28T12:00:00.000Z',
  store,
  currency: 'CHF',
  totalPrice: total,
  notes: null,
  items,
  totals: EMPTY_NUTRITION,
});

test('buildCsv writes one row per item, quotes what needs quoting and starts with a byte-order mark', () => {
  const csv = buildCsv([
    receipt('r1', 'Coop', 12.5, [item('Milk, whole', 'dairy', 1.95), item('Bag "big"', 'non_food', 0.1), item('=SUM(A1)', 'other_food', -0.5)]),
  ]);
  const lines = csv.split('\r\n');
  assert.ok(lines[0].startsWith('﻿date,store,currency,receipt_total,item,'));
  assert.equal(lines.length, 4);
  assert.ok(lines[1].startsWith('2026-10-28,Coop,CHF,12.5,"Milk, whole",'));
  assert.ok(lines[2].includes('"Bag ""big"""'));
  assert.ok(lines[2].endsWith(',false'));
  assert.ok(lines[3].includes(",'=SUM(A1),'=SUM(A1),"), 'formula triggers are neutralized in text cells');
  assert.ok(lines[3].includes(',-0.5,'), 'negative numbers stay numbers');
});

test('spending by category ignores discount lines and sorts by amount; stores sum their totals', () => {
  const receipts = [
    receipt('r1', 'Coop', 10, [item('Apples', 'fruit', 3), item('Cheese', 'dairy', 6), item('Rabatt', 'non_food', -1)]),
    receipt('r2', 'coop', null, [item('Bread', 'bakery', 4)]),
    receipt('r3', 'Migros', 7.5, [item('Pasta', 'grains_pasta', 2)]),
  ];
  assert.deepEqual(spendingByCategory(receipts), [
    { category: 'dairy', amount: 6 },
    { category: 'bakery', amount: 4 },
    { category: 'fruit', amount: 3 },
    { category: 'grains_pasta', amount: 2 },
  ]);
  const stores = spendingByStore(receipts);
  assert.equal(stores.length, 2);
  assert.deepEqual(stores[0], { store: 'Coop', amount: 14, receipts: 2 }); // the printed total, or the lines when none
  assert.deepEqual(stores[1], { store: 'Migros', amount: 7.5, receipts: 1 });
});
