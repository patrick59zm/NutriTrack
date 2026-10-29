import { z } from 'zod';

export const NutritionSchema = z.object({
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  sugar_g: z.number(),
  fat_g: z.number(),
  saturated_fat_g: z.number(),
  fiber_g: z.number(),
  salt_g: z.number(),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

export const CATEGORIES = [
  'fruit',
  'vegetables',
  'dairy',
  'meat_fish',
  'bakery',
  'grains_pasta',
  'snacks_sweets',
  'drinks',
  'frozen',
  'canned_jarred',
  'spices_sauces',
  'other_food',
  'non_food',
] as const;

export const ReceiptItemSchema = z.object({
  receipt_text: z.string().describe('The line exactly as printed on the receipt'),
  name: z.string().describe('Readable product name, e.g. "Vollmilch 3,5%" or "Bananas"'),
  emoji: z.string().describe('One emoji that best depicts this product, e.g. 🍌 for bananas'),
  category: z.string().describe(`One of: ${CATEGORIES.join(', ')}`),
  is_food: z.boolean().describe('false for deposits (Pfand), bags, household goods, cosmetics'),
  quantity: z.number().describe('Number of units bought'),
  total_weight_g: z
    .number()
    .describe('Estimated total edible weight (or ml for drinks) across all units; 0 if not food'),
  price: z.number().nullable(),
  nutrition_per_100g: NutritionSchema,
  shelf_life_days: z
    .number()
    .describe('Typical days the product stays good after purchase (unopened, stored normally)'),
  confidence: z.string().describe('One of: high, medium, low'),
});
export type ReceiptItemAnalysis = z.infer<typeof ReceiptItemSchema>;

export const ReceiptAnalysisSchema = z.object({
  is_receipt: z.boolean(),
  store: z.string().nullable(),
  purchase_date: z.string().nullable().describe('ISO date YYYY-MM-DD if printed on the receipt'),
  currency: z.string().nullable(),
  total_price: z.number().nullable(),
  items: z.array(ReceiptItemSchema),
  notes: z.string().nullable().describe('Short remark about unreadable lines or assumptions'),
});
export type ReceiptAnalysis = z.infer<typeof ReceiptAnalysisSchema>;

export type ReceiptItem = ReceiptItemAnalysis & {
  /** Stable id for edits and pantry state, assigned when the receipt is saved. */
  id: string;
  /** Nutrition for the whole purchased amount, computed locally from per-100g values. */
  nutrition_total: Nutrition;
  /** Set once the item has been eaten or thrown away; it then leaves the kitchen. */
  consumed?: boolean;
  /** Set for items the user typed in or changed by hand. */
  edited?: boolean;
};

/** Tokens spent on Claude calls and their estimated price in US dollars. */
export type Usage = { inputTokens: number; outputTokens: number; costUsd: number };

export type Receipt = {
  id: string;
  /** When the purchase happened (receipt date, falls back to scan time). ISO string. */
  purchasedAt: string;
  scannedAt: string;
  store: string | null;
  currency: string | null;
  totalPrice: number | null;
  notes: string | null;
  items: ReceiptItem[];
  totals: Nutrition;
  /** Local copy of the photo (native builds only). */
  photoUri?: string;
  /** Problems found after the scan, e.g. item prices that do not add up to the printed total. */
  warnings?: string[];
  /** What the scan (and any correction pass) cost. */
  usage?: Usage;
  /** Demo build only: set when a sample was shown instead of reading the photo, with the reason. */
  sampleReason?: string;
};

export const RecipeSchema = z.object({
  title: z.string(),
  emoji: z.string().describe('One food emoji that best represents the finished dish'),
  description: z.string(),
  time_minutes: z.number(),
  servings: z.number(),
  difficulty: z.string().describe('One of: easy, medium, hard'),
  uses_items: z.array(z.string()).describe('Names of pantry items this recipe uses'),
  extra_ingredients_needed: z
    .array(z.string())
    .describe('Ingredients not in the pantry (excluding assumed basics)'),
  ingredients: z.array(z.object({ item: z.string(), amount: z.string() })),
  steps: z.array(z.string()),
  nutrition_per_serving: z.object({
    kcal: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
  why: z.string().describe('One sentence: why this recipe fits what the user bought'),
});
export type Recipe = z.infer<typeof RecipeSchema>;

export const RecipeSuggestionsSchema = z.object({ recipes: z.array(RecipeSchema) });

export type RecipeBatch = {
  createdAt: string;
  windowDays: number;
  /** Dietary preferences the recipes were made for; ideas are stale once they change. */
  diet?: string;
  recipes: Recipe[];
  /** Demo build only: set when sample ideas were shown instead of asking Claude, with the reason. */
  sampleReason?: string;
};

/** A recipe the user kept; survives new suggestion rounds. */
export type SavedRecipe = { id: string; savedAt: string; recipe: Recipe };

/** One line on the shopping list. */
export type ShoppingItem = {
  id: string;
  text: string;
  done: boolean;
  addedAt: string;
  /** Recipe the line came from, when it was added from one. */
  from?: string;
};

/** A meal the user marked as cooked. */
export type CookedMeal = { id: string; title: string; emoji: string; cookedAt: string };

export type Language = 'en' | 'de';
export type Currency = 'EUR' | 'CHF' | 'USD' | 'GBP';

export type Settings = {
  language: Language;
  diet: string;
  recipeWindowDays: number;
  /** Currency for totals across receipts and for items added by hand. */
  currency: Currency;
  /** People eating from these groceries; used for per-person figures and recipe servings. */
  householdSize: number;
  /** Longest cooking time wanted for recipe ideas, in minutes; null for no limit. */
  maxCookMinutes: number | null;
};

/** Swiss devices start with francs, everyone else with euros; both can be changed in Settings. */
function defaultCurrency(): Currency {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    if (/-CH\b/i.test(locale)) return 'CHF';
    if (/-(US|CA)\b/i.test(locale)) return 'USD';
    if (/-GB\b/i.test(locale)) return 'GBP';
  } catch {}
  return 'EUR';
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  diet: '',
  recipeWindowDays: 5,
  currency: defaultCurrency(),
  householdSize: 2,
  maxCookMinutes: null,
};
