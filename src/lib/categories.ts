type CategoryMeta = { emoji: string; label: string; color: string };

export const CATEGORY_META: Record<string, CategoryMeta> = {
  fruit: { emoji: '🍎', label: 'Fruit', color: '#EF6B5B' },
  vegetables: { emoji: '🥦', label: 'Vegetables', color: '#4DAA57' },
  dairy: { emoji: '🥛', label: 'Dairy', color: '#7FB3E8' },
  meat_fish: { emoji: '🍗', label: 'Meat & fish', color: '#C9694A' },
  bakery: { emoji: '🥖', label: 'Bakery', color: '#D9A45B' },
  grains_pasta: { emoji: '🍝', label: 'Grains & pasta', color: '#E8C15A' },
  snacks_sweets: { emoji: '🍫', label: 'Snacks & sweets', color: '#A0674B' },
  drinks: { emoji: '🧃', label: 'Drinks', color: '#F29A3D' },
  frozen: { emoji: '🧊', label: 'Frozen', color: '#6FC3D6' },
  canned_jarred: { emoji: '🥫', label: 'Canned & jarred', color: '#B7584F' },
  spices_sauces: { emoji: '🧂', label: 'Spices & sauces', color: '#9A8C7A' },
  other_food: { emoji: '🍽️', label: 'Other food', color: '#8E9A8E' },
  non_food: { emoji: '🛍️', label: 'Not food', color: '#A3A3A3' },
};

/** The product's own emoji when Claude gave one, otherwise its category's. */
export function itemEmoji(item: { emoji?: string; category: string }) {
  return item.emoji || categoryMeta(item.category).emoji;
}

export function categoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category] ?? CATEGORY_META.other_food;
}
