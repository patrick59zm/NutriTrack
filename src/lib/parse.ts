import { toJSONSchema, type ZodType } from 'zod';

// Pure helpers around Claude's answers. Kept free of app imports so they run in plain Node tests.

export function jsonInstruction(schema: ZodType) {
  return `Reply with only one JSON object that matches this JSON Schema, with no other text:\n${JSON.stringify(toJSONSchema(schema))}`;
}

/**
 * The viewer's Claude returns plain JSON without schema enforcement. Coerce the usual
 * slips (numbers written as strings, a missing optional text) before validating.
 */
export function parseLenient<T>(schema: ZodType<T>, raw: unknown, message: string): T {
  const fixed = coerce(raw);
  const result = schema.safeParse(fixed);
  if (!result.success) throw new Error(message);
  return result.data;
}

const NUMERIC_KEYS = new Set([
  'kcal',
  'protein_g',
  'carbs_g',
  'sugar_g',
  'fat_g',
  'saturated_fat_g',
  'fiber_g',
  'salt_g',
  'quantity',
  'total_weight_g',
  'price',
  'total_price',
  'shelf_life_days',
  'time_minutes',
  'servings',
]);

export function coerce(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => coerce(v));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = coerce(v, k);
    for (const k of ['emoji', 'confidence']) if (k in out && out[k] == null) out[k] = '';
    return out;
  }
  if (NUMERIC_KEYS.has(key) && typeof value === 'string') {
    const n = Number(value.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

/** "2026-09-29" -> local noon that day, so the date never shifts across time zones. */
export function parseLocalDate(value: string | null | undefined) {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}
