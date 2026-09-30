import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

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

const RECEIPT_SYSTEM = `You read photos of supermarket receipts (often German: REWE, EDEKA, Aldi, Lidl, dm, Kaufland, ...) and estimate the nutrition of what was bought.

For every purchased line:
- Expand abbreviations into a readable product name (e.g. "BIO VOLLM.3,5%" -> "Bio Vollmilch 3,5%").
- Merge quantity lines ("2 x 1,29") into the item they belong to.
- Estimate the total weight bought from the product name, pack size or price per kg. Use typical German pack sizes when none is printed.
- Give nutrition per 100 g (or 100 ml) from typical values for that product type.
- Mark deposits (Pfand), bags, discounts, and household or cosmetic products as is_food=false with zero nutrition.
- Skip totals, payment lines, VAT summaries and loyalty points; they are not items.

If the image is not a receipt, set is_receipt=false and return no items.`;

export async function analyzeReceipt(image: PreparedImage, language: Language): Promise<Receipt> {
  const analysis = DEMO_MODE ? await demoScanAnalysis() : await requestAnalysis(image, language);
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

async function requestAnalysis(image: PreparedImage, language: Language): Promise<ReceiptAnalysis> {
  const anthropic = await client();
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...fallbackParams(),
    output_config: { effort: 'medium', format: betaZodOutputFormat(ReceiptAnalysisSchema) },
    system: RECEIPT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
          {
            type: 'text',
            text: `Analyze this receipt. Write product names and notes in ${languageName(language)}.`,
          },
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

const RECIPE_SYSTEM = `You are a practical home cook. You suggest recipes that use up groceries the user recently bought.

- Build each recipe mainly from the pantry list. Assume salt, pepper, oil, water, and basic dried herbs are available.
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
  if (DEMO_MODE) return demoRecipesFor(pantry.map((p) => p.name));

  const anthropic = await client();
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...fallbackParams(),
    output_config: { effort: 'medium', format: betaZodOutputFormat(RecipeSuggestionsSchema) },
    system: RECIPE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Pantry (JSON):
${JSON.stringify(pantry)}

Dietary preferences: ${opts.diet.trim() || 'none'}
Suggest ${opts.count ?? 4} varied recipes. Write everything in ${languageName(opts.language)}.`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error('The request was declined. Try again.');
  const result = response.parsed_output;
  if (!result) throw new Error('Could not read the recipe suggestions. Please try again.');
  return result.recipes;
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
