import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EMPTY_NUTRITION, findDuplicate } from '../nutrition';
import { reminderPlan } from '../reminder-plan';
import type { Receipt, ReceiptItem } from '../types';

const item = (name: string, shelf: number, consumed = false): ReceiptItem => ({
  id: name,
  receipt_text: name,
  name,
  emoji: '',
  category: 'vegetables',
  is_food: true,
  quantity: 1,
  total_weight_g: 100,
  price: 1,
  nutrition_per_100g: EMPTY_NUTRITION,
  nutrition_total: EMPTY_NUTRITION,
  shelf_life_days: shelf,
  confidence: 'high',
  consumed,
});

const receipt = (id: string, purchasedAt: string, items: ReceiptItem[], store = 'Coop', total: number | null = 10): Receipt => ({
  id,
  purchasedAt,
  scannedAt: purchasedAt,
  store,
  currency: 'CHF',
  totalPrice: total,
  notes: null,
  items,
  totals: EMPTY_NUTRITION,
});

test('reminderPlan names the items whose last good day is that day or the next, once each', () => {
  const now = new Date(2026, 9, 29, 9, 0, 0); // 09:00, before the 17:00 reminder
  const bought = new Date(2026, 9, 28, 12).toISOString();
  const plan = reminderPlan([receipt('r', bought, [item('Spinach', 2), item('Milk', 3), item('Rice', 300), item('Fish', 2, true)])], now);
  // Spinach lasts until the 30th, milk until the 31st; fish is used up already.
  assert.deepEqual(plan.map((p) => [p.date.getDate(), p.date.getHours(), p.items]), [
    [29, 17, ['Spinach']],
    [30, 17, ['Spinach', 'Milk']],
    [31, 17, ['Milk']],
  ]);
});

test('reminderPlan skips today once the reminder time has passed', () => {
  const now = new Date(2026, 9, 29, 18, 0, 0);
  const bought = new Date(2026, 9, 28, 12).toISOString();
  const plan = reminderPlan([receipt('r', bought, [item('Spinach', 2)])], now);
  assert.deepEqual(plan.map((p) => p.date.getDate()), [30]);
});

test('findDuplicate matches store, day and total, whatever the case or time of day', () => {
  const saved = receipt('old', new Date(2026, 9, 28, 9).toISOString(), [item('Milk', 3)], 'Coop City', 24.6);
  const fresh = receipt('new', new Date(2026, 9, 28, 19).toISOString(), [item('Milk', 3)], 'coop city ', 24.6);
  assert.equal(findDuplicate(fresh, [saved])?.id, 'old');
  assert.equal(findDuplicate({ ...fresh, totalPrice: 24.7 }, [saved]), null);
  assert.equal(findDuplicate({ ...fresh, purchasedAt: new Date(2026, 9, 27, 19).toISOString() }, [saved]), null);
  assert.equal(findDuplicate({ ...fresh, store: null }, [saved]), null);
  assert.equal(findDuplicate(fresh, [fresh]), null); // never itself
});
