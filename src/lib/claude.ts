import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { DEMO_MODE } from './config';
import { demoRecipesFor, demoScanAnalysis } from './demo';
import { t } from './i18n';
import type { PreparedImage } from './image';
import { daysSince, newId, normalizeCurrency, priceCheck, priceWarnings, withTotals, sum } from './nutrition';
import { jsonInstruction, parseLenient, parseLocalDate } from './parse';
import { getApiKey, recordUsage } from './storage';
import {
  ReceiptAnalysisSchema,
  ReceiptItemSchema,
  RecipeSuggestionsSchema,
  type Language,
  type Receipt,
  type ReceiptAnalysis,
  type ReceiptItem,
  type ReceiptItemAnalysis,
  type Recipe,
  type Settings,
  type Usage,
} from './types';
import {
  isUnavailable,
  noClaudeHere,
  noPhotosHere,
  toBlob,
  unavailableReason,
  viewerClaude,
  viewerErrorMessage,
} from './viewer-claude';

const MODEL = 'claude-opus-5-5';
// List price of the model above, US dollars per million tokens.
const PRICE_PER_MTOK = { input: 4, output: 20 };

// Server-side fallback: if the model declines, the API retries on Anthropic's
// recommended fallback model inside the same call.
const fallbackParams = () => ({
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default' as const,
});

export class MissingApiKeyError extends Error {
  constructor() {
    super(t('error.noKey'));
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

export const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

function usageOf(response: { usage: { input_tokens: number; output_tokens: number } }): Usage {
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  return {
    inputTokens,
    outputTokens,
    costUsd: (inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output) / 1_000_000,
  };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

export type ScanPhase = 'reading' | 'checking';

export type ScanOptions = {
  signal?: AbortSignal;
  onPhase?: (phase: ScanPhase) => void;
};

// ---------------------------------------------------------------------------
// Receipts

const RECEIPT_SYSTEM = `You read photos of supermarket receipts and estimate the nutrition of what was bought.

Receipts are mostly from Germany (REWE, EDEKA, Aldi, Lidl, Kaufland, Penny, Netto, dm, Rossmann) and Switzerland (Migros, Coop, Denner, Volg, Spar, Aldi Suisse, Lidl Schweiz, Manor), printed in German, French or Italian, in EUR or CHF. Swiss receipts often abbreviate store brands (M-Budget, M-Classic, Prix Garantie, Naturaplan, Qualité & Prix) and print prices with a dot; German ones use a comma.

Read the receipt line by line and transcribe exactly what is printed before interpreting it. Only list products that are actually printed on the receipt; never invent items, and never guess a line you cannot read (mention it in notes instead).

For every purchased line:
- Expand abbreviations into a readable product name (e.g. "BIO VOLLM.3,5%" -> "Bio Vollmilch 3,5%", "M-BUDGET HAFERFL." -> "M-Budget Haferflocken").
- Merge quantity and weight lines ("2 x 1,29", "0,850 kg x 2,80 EUR/kg", "0.412 kg à 12.50/kg") into the item they belong to, and use them for quantity and weight.
- Estimate the total weight bought from the product name, pack size or price per kg. Use typical German or Swiss pack sizes when none is printed.
- Give nutrition per 100 g (or 100 ml) from typical values for that product type.
- Mark deposits (Pfand, Depot), bags, discounts and vouchers (Rabatt, Aktion, Cumulus, Supercard), and household or cosmetic products as is_food=false with zero nutrition. A discount line gets a negative price.
- Skip totals, payment lines, VAT summaries (MwSt, TVA) and loyalty points; they are not items.
- Take store, date, currency and total from the receipt when printed. Use the currency code (EUR or CHF).

If the images show no receipt, set is_receipt=false and return no items.`;

function receiptInstruction(imageCount: number, language: Language) {
  const parts =
    imageCount > 1
      ? `The ${imageCount} images are consecutive sections of ONE long receipt, from top to bottom. Neighbouring sections overlap slightly: a line that appears at the bottom of one section and the top of the next is a single line, so count it once.\n\n`
      : '';
  return `${parts}Analyze this receipt. Write product names and notes in ${languageName(language)}.`;
}

const imageBlocks = (images: PreparedImage[]) =>
  images.map((image) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: image.mediaType, data: image.base64 },
  }));

export async function analyzeReceipt(
  images: PreparedImage[],
  settings: Settings,
  options: ScanOptions = {},
): Promise<Receipt> {
  options.onPhase?.('reading');
  const { analysis, usage, sampleReason } = DEMO_MODE
    ? await analyzeWithViewerClaude(images, settings.language, options)
    : await requestAnalysis(images, settings.language, options);
  if (!analysis.is_receipt || analysis.items.length === 0) {
    throw new Error(t('error.noReceipt'));
  }

  const now = new Date();
  const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  const items = analysis.items.map((item, n) => withTotals(item, `${id}-${n}`));
  const purchased = parseLocalDate(analysis.purchase_date);
  // Guard against misread dates (future or implausibly old).
  const age = purchased && !isNaN(purchased.getTime()) ? daysSince(purchased.toISOString(), now) : -1;
  const validDate = age >= 0 && age < 365;
  const warnings = priceWarnings(analysis.items, analysis.total_price);

  return {
    id,
    purchasedAt: (validDate && purchased ? purchased : now).toISOString(),
    scannedAt: now.toISOString(),
    store: analysis.store,
    currency: analysis.currency ? normalizeCurrency(analysis.currency, settings.currency) : settings.currency,
    totalPrice: analysis.total_price,
    notes: analysis.notes,
    items,
    totals: sum(items.map((i) => i.nutrition_total)),
    ...(warnings.length > 0 && { warnings }),
    ...(usage && { usage }),
    ...(sampleReason && { sampleReason }),
  };
}

async function requestAnalysis(
  images: PreparedImage[],
  language: Language,
  options: ScanOptions,
): Promise<{ analysis: ReceiptAnalysis; usage: Usage; sampleReason?: undefined }> {
  const anthropic = await client();
  const run = async (extra: string | null) => {
    const response = await anthropic.beta.messages.parse(
      {
        model: MODEL,
        max_tokens: 16000,
        ...fallbackParams(),
        output_config: { effort: 'high', format: betaZodOutputFormat(ReceiptAnalysisSchema) },
        system: RECEIPT_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              ...imageBlocks(images),
              { type: 'text', text: extra ?? receiptInstruction(images.length, language) },
            ],
          },
        ],
      },
      { signal: options.signal },
    );
    if (response.stop_reason === 'refusal') throw new Error(t('error.declined'));
    if (response.stop_reason === 'max_tokens') throw new Error(t('error.tooLong'));
    const analysis = response.parsed_output;
    if (!analysis) throw new Error(t('error.unreadable'));
    return { analysis, usage: usageOf(response) };
  };

  let { analysis, usage } = await run(null);

  // When the item prices disagree with the printed total, let Claude look again with the
  // draft in front of it. Most misses are a skipped line, a doubled line in an overlap, or
  // a quantity read wrong; a second pass with that hint usually fixes them.
  const first = priceCheck(analysis.items, analysis.total_price);
  if (!first.ok && analysis.is_receipt && analysis.items.length > 0) {
    options.onPhase?.('checking');
    try {
      const hint = `${receiptInstruction(images.length, language)}

A first reading of this receipt is below as JSON. Its item prices add up to ${first.sum.toFixed(2)}, but the printed total is ${first.total?.toFixed(2)} (difference ${first.gap.toFixed(2)}). Re-read the receipt line by line against this draft: find lines that were skipped, counted twice (for example in the overlap between sections), or whose price or quantity was misread, and return the complete corrected analysis. Keep items that were right unchanged.

Draft:
${JSON.stringify(analysis)}`;
      const second = await run(hint);
      usage = addUsage(usage, second.usage);
      const again = second.analysis;
      const usable =
        again.is_receipt && again.items.length > 0 && again.total_price != null && again.items.some((i) => i.price != null);
      const check = priceCheck(again.items, again.total_price);
      if (usable && Math.abs(check.gap) < Math.abs(first.gap)) analysis = again;
    } catch (e) {
      if (e instanceof Anthropic.APIUserAbortError) throw e;
      // The first reading stands; its price warning tells the user to check it.
    }
  }

  await recordUsage('scans', usage);
  return { analysis, usage };
}

/**
 * Demo build: read the photo with the viewer's own Claude when the page offers it. When it
 * cannot, a sample receipt is shown together with the reason, never silently.
 */
async function analyzeWithViewerClaude(
  images: PreparedImage[],
  language: Language,
  options: ScanOptions = {},
): Promise<{ analysis: ReceiptAnalysis; usage?: Usage; sampleReason?: string }> {
  const claude = await viewerClaude();
  if (!claude) return { analysis: await demoScanAnalysis(), sampleReason: noClaudeHere() };
  const limits = await claude.limits().catch(() => null);
  if (!limits?.images) return { analysis: await demoScanAnalysis(), sampleReason: noPhotosHere() };

  const sent = images.slice(0, limits.images.maxCount);
  const prompt = `${RECEIPT_SYSTEM}\n\n${receiptInstruction(sent.length, language)}\n\n${jsonInstruction(ReceiptAnalysisSchema)}`;
  try {
    const raw = await claude.json(prompt, { images: sent.map(toBlob), cache: false, signal: options.signal });
    return {
      analysis: parseLenient(ReceiptAnalysisSchema, raw, t('error.unreadable')),
    };
  } catch (e) {
    if (isUnavailable(e)) return { analysis: await demoScanAnalysis(), sampleReason: unavailableReason(e) };
    if (e instanceof Error || isCancelled(e)) throw e;
    throw new Error(viewerErrorMessage(e));
  }
}

// ---------------------------------------------------------------------------
// Single items (added or corrected by hand)

const ITEM_SYSTEM = `You estimate the nutrition of one grocery item from its name, the way it would appear on a German or Swiss supermarket receipt. Give typical values per 100 g (or 100 ml for drinks), a sensible total weight for the amount described (default: one typical pack), the usual shelf life, and a fitting emoji. receipt_text is the name as given.`;

/** Nutrition and details for an item typed in by the user, e.g. "Bananen 1 kg". */
export async function estimateItem(description: string, settings: Settings): Promise<ReceiptItem> {
  const text = description.trim();
  if (!text) throw new Error(t('error.typeFirst'));
  const request = `Item: ${text}\nWrite the product name in ${languageName(settings.language)}.`;

  let estimate: ReceiptItemAnalysis | null = null;
  if (DEMO_MODE) {
    const claude = await viewerClaude();
    if (claude) {
      try {
        const raw = await claude.json(`${ITEM_SYSTEM}\n\n${request}\n\n${jsonInstruction(ReceiptItemSchema)}`, {
          cache: false,
          modelTier: 'quick',
        });
        estimate = parseLenient(ReceiptItemSchema, raw, t('error.estimateFailed'));
      } catch (e) {
        if (!isUnavailable(e)) throw e instanceof Error ? e : new Error(viewerErrorMessage(e));
      }
    }
  } else {
    const anthropic = await client();
    const response = await anthropic.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      ...fallbackParams(),
      output_config: { effort: 'low', format: betaZodOutputFormat(ReceiptItemSchema) },
      system: ITEM_SYSTEM,
      messages: [{ role: 'user', content: request }],
    });
    if (!response.parsed_output) throw new Error(t('error.estimateFailed'));
    estimate = response.parsed_output;
    await recordUsage('estimates', usageOf(response));
  }

  // Without Claude (demo page without access), the item is still added, just without values.
  const item = estimate ?? {
    receipt_text: text,
    name: text,
    emoji: '',
    category: 'other_food',
    is_food: true,
    quantity: 1,
    total_weight_g: 0,
    price: null,
    nutrition_per_100g: { kcal: 0, protein_g: 0, carbs_g: 0, sugar_g: 0, fat_g: 0, saturated_fat_g: 0, fiber_g: 0, salt_g: 0 },
    shelf_life_days: 7,
    confidence: 'low',
  };
  return { ...withTotals({ ...item, receipt_text: text }, newId('item')), edited: true };
}

// ---------------------------------------------------------------------------
// Recipes

/** `sampleReason` is set only in the demo build, when sample ideas stand in for Claude's. */
export type RecipeSuggestions = { recipes: Recipe[]; usage?: Usage; sampleReason?: string };

const RECIPE_SYSTEM = `You are a practical home cook. You suggest recipes that use up groceries the user recently bought.

- The dietary preferences are strict requirements. Every ingredient of every recipe, pantry items included, must fit all of them. Leave out pantry items that do not fit (vegan: no meat, fish, seafood, eggs, dairy, honey or gelatine; vegetarian: no meat, fish or seafood). If only a few pantry items fit, suggest simpler recipes or add a few ingredients to buy, but never break a preference.
- Build each recipe mainly from the pantry items that fit. Assume salt, pepper, oil, water, and basic dried herbs are available.
- Prefer items that are close to the end of their shelf life (days_left is low) so nothing goes to waste.
- Respect the requested number of servings and the time limit when one is given.
- Keep extra_ingredients_needed short; zero is best.
- Keep steps concise and concrete, suitable for a phone screen.
- Nutrition per serving is an estimate.`;

export async function suggestRecipes(opts: {
  receipts: Receipt[];
  settings: Settings;
  count?: number;
  /** Extra wish for this round, e.g. "something quick for lunch". */
  wish?: string;
}): Promise<RecipeSuggestions> {
  const { settings } = opts;
  const now = new Date();
  const pantry = opts.receipts.flatMap((r) =>
    r.items
      .filter((i) => i.is_food && !i.consumed)
      .map((i) => ({
        name: i.name,
        category: i.category,
        amount_g: Math.round(i.total_weight_g),
        bought_days_ago: daysSince(r.purchasedAt, now),
        days_left: i.shelf_life_days - daysSince(r.purchasedAt, now),
      })),
  );
  if (pantry.length === 0) throw new Error(t('error.noFoodInWindow'));

  const diet = settings.diet.trim();
  const wish = opts.wish?.trim();
  const request = `Pantry (JSON):
${JSON.stringify(pantry)}

Dietary preferences (must be followed): ${diet || 'none'}
Servings per recipe: ${settings.householdSize}
Time limit: ${settings.maxCookMinutes ? `at most ${settings.maxCookMinutes} minutes` : 'none'}
${wish ? `Today's wish: ${wish}\n` : ''}Suggest ${opts.count ?? 4} varied recipes. Write everything in ${languageName(settings.language)}.`;

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

  if (response.stop_reason === 'refusal') throw new Error(t('error.declinedRecipes'));
  const result = response.parsed_output;
  if (!result) throw new Error(t('error.recipesUnreadable'));
  const usage = usageOf(response);
  await recordUsage('recipeRequests', usage);
  return { recipes: result.recipes, usage };
}

async function recipesWithViewerClaude(
  request: string,
  pantryNames: string[],
  diet: string,
): Promise<RecipeSuggestions> {
  const claude = await viewerClaude();
  if (!claude) return { recipes: await demoRecipesFor(pantryNames, diet), sampleReason: noClaudeHere() };
  const prompt = `${RECIPE_SYSTEM}\n\n${request}\n\n${jsonInstruction(RecipeSuggestionsSchema)}`;
  try {
    const raw = await claude.json(prompt, { cache: false });
    return {
      recipes: parseLenient(RecipeSuggestionsSchema, raw, t('error.recipesUnreadable')).recipes,
    };
  } catch (e) {
    if (isUnavailable(e)) return { recipes: await demoRecipesFor(pantryNames, diet), sampleReason: unavailableReason(e) };
    if (e instanceof Error) throw e;
    throw new Error(viewerErrorMessage(e));
  }
}

// ---------------------------------------------------------------------------
// Helpers

export function isCancelled(e: unknown) {
  return (
    e instanceof Anthropic.APIUserAbortError ||
    (e instanceof Error && e.name === 'AbortError') ||
    (e as { code?: string } | null)?.code === 'cancelled'
  );
}

export function describeError(e: unknown): string {
  if (e instanceof MissingApiKeyError) return e.message;
  if (isCancelled(e)) return t('error.cancelled');
  if (e instanceof Anthropic.AuthenticationError) return t('error.keyRejected');
  if (e instanceof Anthropic.RateLimitError) return t('error.rateLimit');
  if (e instanceof Anthropic.APIConnectionError) return t('error.noConnection');
  if (e instanceof Anthropic.APIError) return t('error.api', { status: e.status ?? '?', message: e.message });
  if (e instanceof Error) return e.message;
  return t('error.generic');
}
