import assert from 'node:assert/strict';
import { test } from 'node:test';

import { coerce, jsonInstruction, parseLenient, parseLocalDate } from '../parse';
import { ReceiptItemSchema, RecipeSuggestionsSchema } from '../types';

test('coerce turns numeric strings into numbers only where numbers belong', () => {
  const fixed = coerce({ price: '1,29', quantity: '2', name: '1234', emoji: null, nested: [{ kcal: '89.5' }] }) as Record<
    string,
    unknown
  >;
  assert.equal(fixed.price, 1.29);
  assert.equal(fixed.quantity, 2);
  assert.equal(fixed.name, '1234'); // a receipt line can look like a number
  assert.equal(fixed.emoji, '');
  assert.deepEqual(fixed.nested, [{ kcal: 89.5 }]);
});

test('parseLenient validates after coercion and reports with the given message', () => {
  const raw = {
    receipt_text: 'BANANE',
    name: 'Bananas',
    emoji: null,
    category: 'fruit',
    is_food: 'true',
    quantity: '1',
    total_weight_g: '500',
    price: null,
    nutrition_per_100g: { kcal: '89', protein_g: '1.1', carbs_g: '23', sugar_g: '12', fat_g: '0.3', saturated_fat_g: '0.1', fiber_g: '2.6', salt_g: '0' },
    shelf_life_days: '5',
    confidence: 'high',
  };
  // is_food stays a string, so this must fail cleanly rather than crash.
  assert.throws(() => parseLenient(ReceiptItemSchema, raw, 'nope'), /nope/);
  const ok = parseLenient(ReceiptItemSchema, { ...raw, is_food: true }, 'nope');
  assert.equal(ok.total_weight_g, 500);
  assert.equal(ok.nutrition_per_100g.kcal, 89);
  assert.equal(ok.emoji, '');
});

test('jsonInstruction embeds a JSON schema', () => {
  const text = jsonInstruction(RecipeSuggestionsSchema);
  assert.match(text, /^Reply with only one JSON object/);
  assert.ok(text.includes('"recipes"'));
  assert.doesNotThrow(() => JSON.parse(text.slice(text.indexOf('\n') + 1)));
});

test('parseLocalDate reads ISO dates at local noon and rejects junk', () => {
  const d = parseLocalDate('2026-09-29');
  assert.ok(d);
  assert.equal(d!.getFullYear(), 2026);
  assert.equal(d!.getMonth(), 8);
  assert.equal(d!.getDate(), 29);
  assert.equal(d!.getHours(), 12);
  assert.equal(parseLocalDate('29.09.2026'), null);
  assert.equal(parseLocalDate(null), null);
  assert.ok(parseLocalDate('2026-09-29T10:00:00Z'));
});
