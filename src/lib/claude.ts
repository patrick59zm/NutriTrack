import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { toJSONSchema, type ZodType } from 'zod';

import { DEMO_MODE } from './config';
import { demoRecipesFor, demoScanAnalysis } from './demo';
import type { PreparedImage } from './image';
import { daysSince, withTotals, sum } from './nutrition';
import { getApiKey } from './storage';
import {
  ReceiptAnalysisSchema,
  RecipeSuggestionsSchema,
  type Language,
  type Receipt,
  type ReceiptAnalysis,
  type Recipe,
} from './types';
import { isUnavailable, toBlob, viewerClaude, viewerErrorMessage } from './viewer-claude';

const MODEL = 'claude-opus-5-5';

// Server-side fallback: if the model declines, the API retries on Anthropic's
// recommended fallback model inside the same call.
const fallbackParams = () => ({
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default' as const,
});

export class MissingApiKeyError extends Error {
  constructor() {
    super('Add your Anthropic API key in Settings first.');
  }
}

async function client() {
  const apiKey = await getApiKey();
  if (!apiKey) throw new MissingApiKeyError();
  // The key lives on the user's own device (SecureStore). For a public release,
  // route requests through your own backend instead of shipping keys to clients.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

const languageName = (lang: Language) => (lang === 'de' ? 'German' : 'English');

// ---------------------------------------------------------------------------
// Receipts

const RECEIPT_SYSTEM = `You read photos of supermarket receipts (often German: REWE, EDEKA, Aldi, Lidl, dm, Kaufland, ...) and estimate the nutrition of what was bought.

Read the receipt line by line and transcribe exactly what is printed before interpreting it. Only list products that are actually printed on the receipt; never invent items, and never guess a line you cannot read (mention it in notes instead).

For every purchased line:
- Expand abbreviations into a readable product name (e.g. "BIO VOLLM.3,5%" -> "Bio Vollmilch 3,5%").
- Merge quantity and weight lines ("2 x 1,29", "0,850 kg x 2,80 EUR/kg") into the item they belong to, and use them for quantity and weight.
- Estimate the total weight bought from the product name, pack size or price per kg. Use typical German pack sizes when none is printed.
- Give nutrition per 100 g (or 100 ml) from typical values for that product type.
- Mark deposits (Pfand), bags, discounts, and household or cosmetic products as is_food=false with zero nutrition.
- Skip totals, payment lines, VAT summaries and loyalty points; they are not items.
- Take store, date and total from the receipt when printed.

If the images show no receipt, set is_receipt=false and return no items.`;

function receiptInstruction(imageCount: number, language: Language) {
  const parts =
    imageCount > 1
      ? `The ${imageCount} images are consecutive sections of ONE long receipt, from top to bottom. Neighbouring sections overlap slightly: a line that appears at the bottom of one section and the top of the next is a single line, so count it once.\n\n`
      : '';
  return `${parts}Analyze this receipt. Write product names and notes in ${languageName(language)}.`;
}

export async function analyzeReceipt(images: PreparedImage[], language: Language): Promise<Receipt> {
  const analysis = DEMO_MODE
    ? await analyzeWithViewerClaude(images, language)
    : await requestAnalysis(images, language);
  if (!analysis.is_receipt || analysis.items.length === 0) {
    throw new Error('No receipt found in this photo. Try again with the whole receipt in view.');
  }

  const now = new Date();
  const items = analysis.items.map(withTotals);
  const purchased = parseLocalDate(analysis.purchase_date);
  // Guard against misread dates (future or implausibly old).
  const age = purchased && !isNaN(purchased.getTime()) ? daysSince(purchased.toISOString(), now) : -1;
  const validDate = age >= 0 && age < 365;

  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    purchasedAt: (validDate && purchased ? purchased : now).toISOString(),
    scannedAt: now.toISOString(),
    store: analysis.store,
    currency: analysis.currency,
    totalPrice: analysis.total_price,
    notes: analysis.notes,
    items,
    totals: sum(items.map((i) => i.nutrition_total)),
  };
}

async function requestAnalysis(images: PreparedImage[], language: Language): Promise<ReceiptAnalysis> {
  const anthropic = await client();
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...fallbackParams(),
    output_config: { effort: 'high', format: betaZodOutputFormat(ReceiptAnalysisSchema) },
    system: RECEIPT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          ...images.map((image) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: image.mediaType, data: image.base64 },
          })),
          { type: 'text', text: receiptInstruction(images.length, language) },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error('The request was declined. Try another photo.');
  if (response.stop_reason === 'max_tokens') throw new Error('The receipt was too long to analyze in one go.');
  const analysis = response.parsed_output;
  if (!analysis) throw new Error('Could not read the analysis. Please try again.');
  return analysis;
}

/** Demo build: read the photo with the viewer's own Claude when the page offers it. */
async function analyzeWithViewerClaude(images: PreparedImage[], language: Language) {
  const claude = await viewerClaude();
  const limits = claude && (await claude.limits().catch(() => null));
  if (!claude || !limits?.images) return demoScanAnalysis();

  const sent = images.slice(0, limits.images.maxCount);
  const prompt = `${RECEIPT_SYSTEM}\n\n${receiptInstruction(sent.length, language)}\n\n${jsonInstruction(ReceiptAnalysisSchema)}`;
  try {
    const raw = await claude.json(prompt, { images: sent.map(toBlob), cache: false });
    return parseLenient(ReceiptAnalysisSchema, raw, 'Could not read the receipt analysis. Please try again.');
  } catch (e) {
    if (isUnavailable(e)) return demoScanAnalysis();
    if (e instanceof Error) throw e;
    throw new Error(viewerErrorMessage(e));
  }
}

// ---------------------------------------------------------------------------
// Recipes

const RECIPE_SYSTEM = `You are a practical home cook. You suggest recipes that use up groceries the user recently bought.

- The dietary preferences are strict requirements. Every ingredient of every recipe, pantry items included, must fit all of them. Leave out pantry items that do not fit (vegan: no meat, fish, seafood, eggs, dairy, honey or gelatine; vegetarian: no meat, fish or seafood). If only a few pantry items fit, suggest simpler recipes or add a few ingredients to buy, but never break a preference.
- Build each recipe mainly from the pantry items that fit. Assume salt, pepper, oil, water, and basic dried herbs are available.
- Prefer items that are close to the end of their shelf life (days_left is low) so nothing goes to waste.
- Keep extra_ingredients_needed short; zero is best.
- Keep steps concise and concrete, suitable for a phone screen.
- Nutrition per serving is an estimate.`;

export async function suggestRecipes(opts: {
  receipts: Receipt[];
  language: Language;
  diet: string;
  count?: number;
}): Promise<Recipe[]> {
  const now = new Date();
  const pantry = opts.receipts.flatMap((r) =>
    r.items
      .filter((i) => i.is_food)
      .map((i) => ({
        name: i.name,
        category: i.category,
        amount_g: Math.round(i.total_weight_g),
        bought_days_ago: daysSince(r.purchasedAt, now),
        days_left: i.shelf_life_days - daysSince(r.purchasedAt, now),
      })),
  );
  if (pantry.length === 0) throw new Error('No food items in the selected time window yet.');

  const diet = opts.diet.trim();
  const request = `Pantry (JSON):
${JSON.stringify(pantry)}

Dietary preferences (must be followed): ${diet || 'none'}
Suggest ${opts.count ?? 4} varied recipes. Write everything in ${languageName(opts.language)}.`;

  if (DEMO_MODE) return recipesWithViewerClaude(request, pantry.map((p) => p.name), diet);

  const anthropic = await client();
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...fallbackParams(),
    output_config: { effort: 'medium', format: betaZodOutputFormat(RecipeSuggestionsSchema) },
    system: RECIPE_SYSTEM,
    messages: [{ role: 'user', content: request }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The request was declined. Try again.');
  const result = response.parsed_output;
  if (!result) throw new Error('Could not read the recipe suggestions. Please try again.');
  return result.recipes;
}

async function recipesWithViewerClaude(request: string, pantryNames: string[], diet: string) {
  const claude = await viewerClaude();
  if (!claude) return demoRecipesFor(pantryNames, diet);
  const prompt = `${RECIPE_SYSTEM}\n\n${request}\n\n${jsonInstruction(RecipeSuggestionsSchema)}`;
  try {
    const raw = await claude.json(prompt, { cache: false });
    return parseLenient(RecipeSuggestionsSchema, raw, 'Could not read the recipe ideas. Please try again.').recipes;
  } catch (e) {
    if (isUnavailable(e)) return demoRecipesFor(pantryNames, diet);
    if (e instanceof Error) throw e;
    throw new Error(viewerErrorMessage(e));
  }
}

// ---------------------------------------------------------------------------
// Helpers

function jsonInstruction(schema: ZodType) {
  return `Reply with only one JSON object that matches this JSON Schema, with no other text:\n${JSON.stringify(toJSONSchema(schema))}`;
}

/**
 * The viewer's Claude returns plain JSON without schema enforcement. Coerce the usual
 * slips (numbers written as strings, a missing optional text) before validating.
 */
function parseLenient<T>(schema: ZodType<T>, raw: unknown, message: string): T {
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

function coerce(value: unknown, key = ''): unknown {
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
function parseLocalDate(value: string | null) {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

export function describeError(e: unknown): string {
  if (e instanceof MissingApiKeyError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return 'Your API key was rejected. Check it in Settings.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limit reached. Wait a moment and try again.';
  if (e instanceof Anthropic.APIConnectionError) return 'No connection to the API. Check your internet.';
  if (e instanceof Anthropic.APIError) return `API error (${e.status ?? '?'}): ${e.message}`;
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
