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
  /** Nutrition for the whole purchased amount, computed locally from per-100g values. */
  nutrition_total: Nutrition;
};

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
  recipes: Recipe[];
};

export type Language = 'en' | 'de';

export type Settings = {
  language: Language;
  diet: string;
  recipeWindowDays: number;
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  diet: '',
  recipeWindowDays: 5,
};
