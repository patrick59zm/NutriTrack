import type { Receipt } from './types';

// Every item of every receipt as one spreadsheet row.

const CSV_COLUMNS = [
  'date',
  'store',
  'currency',
  'receipt_total',
  'item',
  'receipt_text',
  'category',
  'is_food',
  'quantity',
  'weight_g',
  'price',
  'kcal',
  'protein_g',
  'carbs_g',
  'sugar_g',
  'fat_g',
  'saturated_fat_g',
  'fiber_g',
  'salt_g',
  'shelf_life_days',
  'consumed',
];

const csvCell = (value: unknown) => {
  const text = value == null ? '' : typeof value === 'number' ? String(Math.round(value * 100) / 100) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Every item of every receipt as one row, for spreadsheets. */
export function buildCsv(receipts: Receipt[]) {
  const rows = receipts.flatMap((r) =>
    r.items.map((i) => [
      r.purchasedAt.slice(0, 10),
      r.store,
      r.currency,
      r.totalPrice,
      i.name,
      i.receipt_text,
      i.category,
      i.is_food,
      i.quantity,
      i.total_weight_g,
      i.price,
      i.nutrition_total.kcal,
      i.nutrition_total.protein_g,
      i.nutrition_total.carbs_g,
      i.nutrition_total.sugar_g,
      i.nutrition_total.fat_g,
      i.nutrition_total.saturated_fat_g,
      i.nutrition_total.fiber_g,
      i.nutrition_total.salt_g,
      i.shelf_life_days,
      !!i.consumed,
    ]),
  );
  // The byte-order mark makes spreadsheet apps read umlauts correctly.
  return '\uFEFF' + [CSV_COLUMNS, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
