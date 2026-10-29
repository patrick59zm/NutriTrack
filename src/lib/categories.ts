import { t, type Key } from './i18n';

type CategoryMeta = { emoji: string; color: string; key: Key };

export const CATEGORY_META: Record<string, CategoryMeta> = {
  fruit: { emoji: '🍎', color: '#EF6B5B', key: 'category.fruit' },
  vegetables: { emoji: '🥦', color: '#4DAA57', key: 'category.vegetables' },
  dairy: { emoji: '🥛', color: '#7FB3E8', key: 'category.dairy' },
  meat_fish: { emoji: '🍗', color: '#C9694A', key: 'category.meat_fish' },
  bakery: { emoji: '🥖', color: '#D9A45B', key: 'category.bakery' },
  grains_pasta: { emoji: '🍝', color: '#E8C15A', key: 'category.grains_pasta' },
  snacks_sweets: { emoji: '🍫', color: '#A0674B', key: 'category.snacks_sweets' },
  drinks: { emoji: '🧃', color: '#F29A3D', key: 'category.drinks' },
  frozen: { emoji: '🧊', color: '#6FC3D6', key: 'category.frozen' },
  canned_jarred: { emoji: '🥫', color: '#B7584F', key: 'category.canned_jarred' },
  spices_sauces: { emoji: '🧂', color: '#9A8C7A', key: 'category.spices_sauces' },
  other_food: { emoji: '🍽️', color: '#8E9A8E', key: 'category.other_food' },
  non_food: { emoji: '🛍️', color: '#A3A3A3', key: 'category.non_food' },
};

/** The product's own emoji when Claude gave one, otherwise its category's. */
export function itemEmoji(item: { emoji?: string; category: string }) {
  return item.emoji || categoryMeta(item.category).emoji;
}

export function categoryMeta(category: string): CategoryMeta & { label: string } {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.other_food;
  return { ...meta, label: t(meta.key) };
}
