import { sum, withTotals } from './nutrition';
import type { Nutrition, Receipt, ReceiptAnalysis, ReceiptItemAnalysis, Recipe, RecipeBatch } from './types';

// Sample data so the app can be explored without an API key or a real receipt.

const n = (
  kcal: number,
  protein_g: number,
  carbs_g: number,
  sugar_g: number,
  fat_g: number,
  saturated_fat_g: number,
  fiber_g: number,
  salt_g: number,
): Nutrition => ({ kcal, protein_g, carbs_g, sugar_g, fat_g, saturated_fat_g, fiber_g, salt_g });

const item = (
  emoji: string,
  receipt_text: string,
  name: string,
  category: string,
  total_weight_g: number,
  price: number,
  nutrition_per_100g: Nutrition,
  shelf_life_days: number,
  quantity = 1,
): ReceiptItemAnalysis => ({
  receipt_text,
  name,
  emoji,
  category,
  is_food: category !== 'non_food',
  quantity,
  total_weight_g,
  price,
  nutrition_per_100g,
  shelf_life_days,
  confidence: 'high',
});

const NONE = n(0, 0, 0, 0, 0, 0, 0, 0);

function receipt(
  id: string,
  store: string,
  daysAgo: number,
  totalPrice: number,
  items: ReceiptItemAnalysis[],
): Receipt {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(17, 42, 0, 0);
  const withNutrition = items.map(withTotals);
  return {
    id,
    purchasedAt: d.toISOString(),
    scannedAt: d.toISOString(),
    store,
    currency: 'EUR',
    totalPrice,
    notes: null,
    items: withNutrition,
    totals: sum(withNutrition.map((i) => i.nutrition_total)),
  };
}

export function demoReceipts(): Receipt[] {
  return [
    receipt('demo-rewe', 'REWE', 1, 24.63, [
      item('🥛', 'BIO VOLLMILCH 3,5%', 'Organic whole milk 3.5%', 'dairy', 1000, 1.49, n(64, 3.3, 4.8, 4.8, 3.5, 2.3, 0, 0.13), 7),
      item('🍌', 'BANANE CHIQUITA KG', 'Bananas', 'fruit', 1120, 1.95, n(89, 1.1, 23, 12, 0.3, 0.1, 2.6, 0), 5),
      item('🥬', 'BLATTSPINAT 250G', 'Baby spinach', 'vegetables', 250, 1.99, n(23, 2.9, 3.6, 0.4, 0.4, 0.1, 2.2, 0.2), 3),
      item('🍗', 'HAEHN.BRUSTFILET', 'Chicken breast fillet', 'meat_fish', 400, 5.49, n(110, 23, 0, 0, 1.5, 0.4, 0, 0.15), 3),
      item('🍅', 'CHERRYROMA 250G', 'Cherry tomatoes', 'vegetables', 250, 1.79, n(20, 0.9, 3.1, 2.6, 0.2, 0, 1.2, 0.01), 6),
      item('🧀', 'MOZZARELLA 125G', 'Mozzarella', 'dairy', 250, 1.58, n(254, 18, 1, 1, 20, 14, 0, 0.5), 10, 2),
      item('🍝', 'VK SPAGHETTI 500G', 'Whole-wheat spaghetti', 'grains_pasta', 500, 1.29, n(352, 13, 64, 3.5, 2.5, 0.5, 8, 0.01), 365),
      item('🥣', 'GRIECH.JOGHURT 10%', 'Greek yogurt 10%', 'dairy', 500, 1.99, n(133, 4.8, 3.7, 3.7, 10, 7, 0, 0.1), 14),
      item('🍋', 'ZITRONEN 500G', 'Lemons', 'fruit', 500, 1.49, n(29, 1.1, 3.2, 2.5, 0.3, 0, 2.8, 0), 14),
      item('♻️', 'PFAND 0,25', 'Bottle deposit', 'non_food', 0, 0.25, NONE, 0),
      item('🧄', 'KNOBLAUCH', 'Garlic', 'vegetables', 60, 0.69, n(149, 6.4, 33, 1, 0.5, 0.1, 2.1, 0.04), 30),
    ]),
    receipt('demo-lidl', 'Lidl', 3, 21.87, [
      item('🥚', 'EIER BODENH. 10ST', 'Free-range eggs (10)', 'dairy', 600, 2.89, n(143, 13, 0.7, 0.4, 9.5, 3.1, 0, 0.35), 21),
      item('🌾', 'HAFERFLOCKEN 500G', 'Rolled oats', 'grains_pasta', 500, 0.89, n(372, 13.5, 58.7, 0.7, 7, 1.3, 10, 0.02), 300),
      item('🍎', 'AEPFEL ELSTAR 1KG', 'Elstar apples', 'fruit', 1000, 2.29, n(52, 0.3, 14, 10, 0.2, 0, 2.4, 0), 21),
      item('🫑', 'PAPRIKA ROT 500G', 'Red bell peppers', 'vegetables', 500, 1.99, n(31, 1, 6, 4.2, 0.3, 0, 2.1, 0.01), 7),
      item('🐟', 'LACHSFILET 250G', 'Salmon fillet', 'meat_fish', 250, 4.99, n(208, 20, 0, 0, 13, 3.1, 0, 0.12), 4),
      item('🥒', 'ZUCCHINI', 'Zucchini', 'vegetables', 420, 1.12, n(17, 1.2, 3.1, 2.5, 0.3, 0.1, 1, 0.02), 7),
      item('🍞', 'VOLLKORNBROT 500G', 'Whole-grain bread', 'bakery', 500, 1.49, n(219, 8, 38, 3, 1.8, 0.3, 8, 1.1), 6),
      item('🧈', 'BUTTER 250G', 'Butter', 'dairy', 250, 2.19, n(741, 0.7, 0.6, 0.6, 82, 53, 0, 0.02), 45),
      item('🍫', 'ZARTBITTER 70% 100G', 'Dark chocolate 70%', 'snacks_sweets', 100, 1.29, n(566, 9, 34, 28, 42, 25, 11, 0.02), 300),
      item('♻️', 'PFAND', 'Bottle deposit', 'non_food', 0, 0.25, NONE, 0),
      item('💧', 'MINERALWASSER 1,5L', 'Sparkling water', 'drinks', 1500, 0.19, NONE, 365),
    ]),
    receipt('demo-edeka', 'EDEKA', 9, 18.34, [
      item('🥔', 'KARTOFFELN FK 2KG', 'Waxy potatoes', 'vegetables', 2000, 2.49, n(77, 2, 17, 0.8, 0.1, 0, 2.2, 0.01), 30),
      item('🧅', 'ZWIEBELN 1KG', 'Onions', 'vegetables', 1000, 1.29, n(40, 1.1, 9.3, 4.2, 0.1, 0, 1.7, 0.01), 30),
      item('🥕', 'KAROTTEN 1KG', 'Carrots', 'vegetables', 1000, 1.19, n(41, 0.9, 9.6, 4.7, 0.2, 0, 2.8, 0.17), 21),
      item('🫘', 'ROTE LINSEN 500G', 'Red lentils', 'grains_pasta', 500, 1.79, n(358, 24, 60, 2, 1.5, 0.2, 11, 0.02), 365),
      item('🥫', 'PASSATA 500G', 'Tomato passata', 'canned_jarred', 500, 0.99, n(34, 1.4, 5.5, 4.6, 0.2, 0, 1.4, 0.3), 365),
      item('🧀', 'GOUDA MITTELALT', 'Gouda, medium aged', 'dairy', 400, 3.49, n(356, 25, 0, 0, 28, 18, 0, 1.8), 30),
      item('🧃', 'ORANGENSAFT 1L', 'Orange juice', 'drinks', 1000, 1.99, n(45, 0.7, 10, 9, 0.2, 0, 0.2, 0), 10),
      item('🫙', 'HUMMUS NATUR 200G', 'Hummus', 'spices_sauces', 200, 1.69, n(290, 7.5, 12, 0.5, 23, 2.5, 6, 1.1), 14),
      item('🛍️', 'TRAGETASCHE', 'Shopping bag', 'non_food', 0, 0.2, NONE, 0),
    ]),
  ];
}

export function demoRecipes(): RecipeBatch {
  return {
    createdAt: new Date().toISOString(),
    windowDays: 5,
    recipes: [
      {
        title: 'Lemon Salmon with Zucchini & Peppers',
        emoji: '🐟',
        description: 'Crispy-skinned salmon on a tray of blistered peppers and zucchini with a squeeze of lemon.',
        time_minutes: 25,
        servings: 2,
        difficulty: 'easy',
        uses_items: ['Salmon fillet', 'Zucchini', 'Red bell peppers', 'Lemons', 'Garlic'],
        extra_ingredients_needed: [],
        ingredients: [
          { item: 'Salmon fillet', amount: '250 g' },
          { item: 'Zucchini', amount: '1 large' },
          { item: 'Red bell peppers', amount: '2' },
          { item: 'Lemons', amount: '1' },
          { item: 'Garlic', amount: '2 cloves' },
          { item: 'Olive oil, salt, pepper', amount: 'to taste' },
        ],
        steps: [
          'Heat the oven to 220 °C. Slice zucchini and peppers into strips.',
          'Toss the vegetables with oil, sliced garlic, salt and pepper; roast for 12 minutes.',
          'Season the salmon, place it skin-side up on the vegetables and roast 10 more minutes.',
          'Finish with lemon juice and zest before serving.',
        ],
        nutrition_per_serving: { kcal: 410, protein_g: 29, carbs_g: 14, fat_g: 26 },
        why: 'Salmon only keeps about two days, so it goes first — the peppers and zucchini come along.',
      },
      {
        title: 'Creamy Spinach Chicken Pasta',
        emoji: '🍝',
        description: 'Whole-wheat spaghetti with seared chicken, wilted spinach and burst cherry tomatoes.',
        time_minutes: 30,
        servings: 3,
        difficulty: 'easy',
        uses_items: ['Chicken breast fillet', 'Baby spinach', 'Cherry tomatoes', 'Whole-wheat spaghetti', 'Greek yogurt 10%', 'Garlic'],
        extra_ingredients_needed: ['Parmesan'],
        ingredients: [
          { item: 'Whole-wheat spaghetti', amount: '300 g' },
          { item: 'Chicken breast fillet', amount: '400 g' },
          { item: 'Baby spinach', amount: '250 g' },
          { item: 'Cherry tomatoes', amount: '250 g' },
          { item: 'Greek yogurt 10%', amount: '150 g' },
          { item: 'Garlic', amount: '3 cloves' },
          { item: 'Parmesan', amount: '30 g' },
        ],
        steps: [
          'Cook the spaghetti in salted water; keep a cup of pasta water.',
          'Sear bite-sized chicken pieces in a hot pan until golden, then set aside.',
          'Soften garlic and halved tomatoes in the same pan, add the spinach and let it wilt.',
          'Off the heat, stir in yogurt and a splash of pasta water, then add pasta and chicken.',
          'Season and top with grated Parmesan.',
        ],
        nutrition_per_serving: { kcal: 620, protein_g: 49, carbs_g: 68, fat_g: 14 },
        why: 'Uses the spinach and chicken, which both expire in about three days.',
      },
      {
        title: 'Caprese Toast',
        emoji: '🍅',
        description: 'Toasted whole-grain bread with mozzarella, cherry tomatoes and a drizzle of oil.',
        time_minutes: 10,
        servings: 2,
        difficulty: 'easy',
        uses_items: ['Whole-grain bread', 'Mozzarella', 'Cherry tomatoes'],
        extra_ingredients_needed: ['Fresh basil'],
        ingredients: [
          { item: 'Whole-grain bread', amount: '4 slices' },
          { item: 'Mozzarella', amount: '125 g' },
          { item: 'Cherry tomatoes', amount: '100 g' },
          { item: 'Fresh basil', amount: 'a few leaves' },
        ],
        steps: [
          'Toast the bread until crisp.',
          'Top with sliced mozzarella and halved tomatoes.',
          'Finish with basil, olive oil, salt and pepper.',
        ],
        nutrition_per_serving: { kcal: 390, protein_g: 20, carbs_g: 39, fat_g: 16 },
        why: 'A quick lunch that uses the bread before it goes stale.',
      },
      {
        title: 'Banana Oat Pancakes',
        emoji: '🥞',
        description: 'Fluffy three-ingredient pancakes, sweet from ripe bananas, with yogurt on top.',
        time_minutes: 15,
        servings: 2,
        difficulty: 'easy',
        uses_items: ['Bananas', 'Rolled oats', 'Free-range eggs (10)', 'Organic whole milk 3.5%', 'Greek yogurt 10%'],
        extra_ingredients_needed: [],
        ingredients: [
          { item: 'Bananas', amount: '2 ripe' },
          { item: 'Rolled oats', amount: '100 g' },
          { item: 'Free-range eggs (10)', amount: '2' },
          { item: 'Organic whole milk 3.5%', amount: '80 ml' },
          { item: 'Greek yogurt 10%', amount: 'to serve' },
        ],
        steps: [
          'Blend bananas, oats, eggs and milk into a thick batter.',
          'Cook small pancakes in a buttered pan, about 2 minutes per side.',
          'Serve stacked with a spoon of Greek yogurt.',
        ],
        nutrition_per_serving: { kcal: 430, protein_g: 17, carbs_g: 63, fat_g: 12 },
        why: 'Bananas are getting spotty — perfect for pancakes.',
      },
    ],
  };
}


const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** What a scan returns in demo builds, whatever photo was chosen. */
export async function demoScanAnalysis(): Promise<ReceiptAnalysis> {
  await wait(6500);
  return {
    is_receipt: true,
    store: 'Frischmarkt',
    purchase_date: isoToday(),
    currency: 'EUR',
    total_price: 22.03,
    notes: "Chicken leg weight excludes bones (about 30%).",
    items: [
    {"receipt_text": "BIO HAFERMILCH 1L", "name": "Organic oat milk", "emoji": "🥛", "category": "drinks", "is_food": true, "quantity": 1, "total_weight_g": 1000, "price": 1.79, "nutrition_per_100g": {"kcal": 46, "protein_g": 1, "carbs_g": 6.7, "sugar_g": 3.3, "fat_g": 1.5, "saturated_fat_g": 0.2, "fiber_g": 0.8, "salt_g": 0.1}, "shelf_life_days": 7, "confidence": "high"},
    {"receipt_text": "AVOCADO ST", "name": "Avocados", "emoji": "🥑", "category": "fruit", "is_food": true, "quantity": 3, "total_weight_g": 510, "price": 3.87, "nutrition_per_100g": {"kcal": 160, "protein_g": 2, "carbs_g": 8.5, "sugar_g": 0.7, "fat_g": 14.7, "saturated_fat_g": 2.1, "fiber_g": 6.7, "salt_g": 0.02}, "shelf_life_days": 4, "confidence": "high"},
    {"receipt_text": "SUESSKARTOFFEL KG", "name": "Sweet potatoes", "emoji": "🍠", "category": "vegetables", "is_food": true, "quantity": 1, "total_weight_g": 850, "price": 2.38, "nutrition_per_100g": {"kcal": 86, "protein_g": 1.6, "carbs_g": 20, "sugar_g": 4.2, "fat_g": 0.1, "saturated_fat_g": 0, "fiber_g": 3, "salt_g": 0.14}, "shelf_life_days": 21, "confidence": "high"},
    {"receipt_text": "KICHERERBSEN 400G", "name": "Chickpeas (canned)", "emoji": "🫘", "category": "canned_jarred", "is_food": true, "quantity": 1, "total_weight_g": 240, "price": 0.89, "nutrition_per_100g": {"kcal": 139, "protein_g": 7, "carbs_g": 17, "sugar_g": 0.4, "fat_g": 2.8, "saturated_fat_g": 0.3, "fiber_g": 6, "salt_g": 0.6}, "shelf_life_days": 365, "confidence": "high"},
    {"receipt_text": "FETA 200G", "name": "Feta cheese", "emoji": "🧀", "category": "dairy", "is_food": true, "quantity": 1, "total_weight_g": 200, "price": 1.99, "nutrition_per_100g": {"kcal": 264, "protein_g": 14, "carbs_g": 4, "sugar_g": 4, "fat_g": 21, "saturated_fat_g": 15, "fiber_g": 0, "salt_g": 2.7}, "shelf_life_days": 14, "confidence": "high"},
    {"receipt_text": "BRAUNE CHAMPIGNONS", "name": "Brown mushrooms", "emoji": "🍄", "category": "vegetables", "is_food": true, "quantity": 1, "total_weight_g": 250, "price": 1.99, "nutrition_per_100g": {"kcal": 22, "protein_g": 3.1, "carbs_g": 0.5, "sugar_g": 0.2, "fat_g": 0.3, "saturated_fat_g": 0.1, "fiber_g": 2, "salt_g": 0.01}, "shelf_life_days": 4, "confidence": "high"},
    {"receipt_text": "RISPENTOMATEN 500G", "name": "Vine tomatoes", "emoji": "🍅", "category": "vegetables", "is_food": true, "quantity": 1, "total_weight_g": 500, "price": 1.69, "nutrition_per_100g": {"kcal": 18, "protein_g": 0.9, "carbs_g": 3.9, "sugar_g": 2.6, "fat_g": 0.2, "saturated_fat_g": 0, "fiber_g": 1.2, "salt_g": 0.01}, "shelf_life_days": 6, "confidence": "high"},
    {"receipt_text": "NATURJOGH. 3,5% 500G", "name": "Plain yogurt 3.5%", "emoji": "🥣", "category": "dairy", "is_food": true, "quantity": 1, "total_weight_g": 500, "price": 0.99, "nutrition_per_100g": {"kcal": 64, "protein_g": 3.8, "carbs_g": 4.4, "sugar_g": 4.4, "fat_g": 3.5, "saturated_fat_g": 2.3, "fiber_g": 0, "salt_g": 0.13}, "shelf_life_days": 14, "confidence": "high"},
    {"receipt_text": "HAEHN.SCHENKEL 1KG", "name": "Chicken legs", "emoji": "🍗", "category": "meat_fish", "is_food": true, "quantity": 1, "total_weight_g": 700, "price": 4.99, "nutrition_per_100g": {"kcal": 215, "protein_g": 18, "carbs_g": 0, "sugar_g": 0, "fat_g": 15.5, "saturated_fat_g": 4.3, "fiber_g": 0, "salt_g": 0.2}, "shelf_life_days": 3, "confidence": "medium"},
    {"receipt_text": "VOLLKORN TOAST", "name": "Whole-grain toast bread", "emoji": "🍞", "category": "bakery", "is_food": true, "quantity": 1, "total_weight_g": 500, "price": 1.49, "nutrition_per_100g": {"kcal": 246, "protein_g": 9, "carbs_g": 41, "sugar_g": 4, "fat_g": 3.8, "saturated_fat_g": 0.7, "fiber_g": 7, "salt_g": 1.1}, "shelf_life_days": 7, "confidence": "high"},
    {"receipt_text": "PFAND 0,25", "name": "Bottle deposit", "emoji": "♻️", "category": "non_food", "is_food": false, "quantity": 1, "total_weight_g": 0, "price": 0.25, "nutrition_per_100g": {"kcal": 0, "protein_g": 0, "carbs_g": 0, "sugar_g": 0, "fat_g": 0, "saturated_fat_g": 0, "fiber_g": 0, "salt_g": 0}, "shelf_life_days": 0, "confidence": "high"},
    ],
  };
}

const SCAN_RECIPES: Recipe[] = [
  {
    "title": "Crispy Chicken Legs with Sweet Potato Wedges",
    "emoji": "🍗",
    "description": "Oven-roasted chicken legs with paprika sweet potatoes and a garlicky yogurt dip.",
    "time_minutes": 50,
    "servings": 3,
    "difficulty": "easy",
    "uses_items": [
      "Chicken legs",
      "Sweet potatoes",
      "Plain yogurt 3.5%",
      "Garlic"
    ],
    "extra_ingredients_needed": [],
    "ingredients": [
      {
        "item": "Chicken legs",
        "amount": "700 g"
      },
      {
        "item": "Sweet potatoes",
        "amount": "600 g"
      },
      {
        "item": "Plain yogurt 3.5%",
        "amount": "150 g"
      },
      {
        "item": "Garlic",
        "amount": "1 clove"
      },
      {
        "item": "Paprika, oil, salt",
        "amount": "to taste"
      }
    ],
    "steps": [
      "Heat the oven to 210 °C.",
      "Rub chicken legs with oil, paprika and salt; cut sweet potatoes into wedges.",
      "Roast everything on one tray for 40–45 minutes until crisp.",
      "Stir grated garlic and salt into the yogurt and serve as a dip."
    ],
    "nutrition_per_serving": {
      "kcal": 610,
      "protein_g": 42,
      "carbs_g": 44,
      "fat_g": 28
    },
    "why": "Chicken keeps only about three days, so it is up first."
  },
  {
    "title": "Mushroom & Feta Toast with Smashed Avocado",
    "emoji": "🥑",
    "description": "Crunchy toast with smashed avocado, seared mushrooms and crumbled feta.",
    "time_minutes": 15,
    "servings": 2,
    "difficulty": "easy",
    "uses_items": [
      "Avocados",
      "Brown mushrooms",
      "Feta cheese",
      "Whole-grain toast bread",
      "Vine tomatoes"
    ],
    "extra_ingredients_needed": [
      "Lemon"
    ],
    "ingredients": [
      {
        "item": "Whole-grain toast bread",
        "amount": "4 slices"
      },
      {
        "item": "Avocados",
        "amount": "2"
      },
      {
        "item": "Brown mushrooms",
        "amount": "250 g"
      },
      {
        "item": "Feta cheese",
        "amount": "80 g"
      },
      {
        "item": "Vine tomatoes",
        "amount": "1"
      },
      {
        "item": "Lemon",
        "amount": "½"
      }
    ],
    "steps": [
      "Sear sliced mushrooms in a hot pan until golden; season.",
      "Mash avocados with lemon juice, salt and pepper.",
      "Toast the bread, spread avocado, top with mushrooms, tomato and feta."
    ],
    "nutrition_per_serving": {
      "kcal": 520,
      "protein_g": 19,
      "carbs_g": 38,
      "fat_g": 32
    },
    "why": "Avocados and mushrooms both turn in about four days."
  },
  {
    "title": "Roasted Chickpea & Tomato Bowl",
    "emoji": "🥗",
    "description": "Warm bowl of crispy chickpeas, roasted sweet potato and tomatoes with feta and yogurt.",
    "time_minutes": 35,
    "servings": 2,
    "difficulty": "easy",
    "uses_items": [
      "Chickpeas (canned)",
      "Sweet potatoes",
      "Vine tomatoes",
      "Feta cheese",
      "Plain yogurt 3.5%"
    ],
    "extra_ingredients_needed": [],
    "ingredients": [
      {
        "item": "Chickpeas (canned)",
        "amount": "240 g"
      },
      {
        "item": "Sweet potatoes",
        "amount": "250 g"
      },
      {
        "item": "Vine tomatoes",
        "amount": "300 g"
      },
      {
        "item": "Feta cheese",
        "amount": "60 g"
      },
      {
        "item": "Plain yogurt 3.5%",
        "amount": "100 g"
      }
    ],
    "steps": [
      "Roast cubed sweet potato and drained chickpeas with oil and cumin at 220 °C for 25 minutes.",
      "Add halved tomatoes for the last 10 minutes.",
      "Serve topped with crumbled feta and a spoon of yogurt."
    ],
    "nutrition_per_serving": {
      "kcal": 480,
      "protein_g": 20,
      "carbs_g": 58,
      "fat_g": 17
    },
    "why": "Uses pantry staples plus the tomatoes before they soften."
  }
];

/** Recipe ideas in demo builds: fitted to the demo scan when it is in the pantry. */
export async function demoRecipesFor(pantryNames: string[]): Promise<Recipe[]> {
  await wait(4000);
  const base = demoRecipes().recipes;
  return pantryNames.includes('Chicken legs') ? [...SCAN_RECIPES, base[0]] : base;
}
