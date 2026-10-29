import { Platform, Share } from 'react-native';

import { t } from './i18n';
import type { Recipe } from './types';

export function recipeToText(recipe: Recipe) {
  const lines = [
    `${recipe.emoji ? `${recipe.emoji} ` : ''}${recipe.title}`,
    `${t('common.min', { n: recipe.time_minutes })} · ${t('common.servings', { n: recipe.servings })} · ${recipe.difficulty}`,
    '',
    recipe.description,
    '',
    t('recipe.ingredients'),
    ...recipe.ingredients.map((i) => `• ${i.amount} ${i.item}`),
    '',
    t('recipe.steps'),
    ...recipe.steps.map((s, n) => `${n + 1}. ${s}`),
    '',
    t('recipe.perServingLine', {
      kcal: Math.round(recipe.nutrition_per_serving.kcal),
      protein: Math.round(recipe.nutrition_per_serving.protein_g),
      carbs: Math.round(recipe.nutrition_per_serving.carbs_g),
      fat: Math.round(recipe.nutrition_per_serving.fat_g),
    }),
    '',
    t('recipe.sharedFrom'),
  ];
  return lines.join('\n');
}

/**
 * Opens the system share sheet. Browsers without one get the text on the clipboard.
 * Resolves to what happened, so the screen can confirm it.
 */
export async function shareText(text: string, title: string): Promise<'shared' | 'copied' | 'dismissed'> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav?.share) {
      try {
        await nav.share({ title, text });
        return 'shared';
      } catch {
        return 'dismissed';
      }
    }
    await nav?.clipboard?.writeText(text);
    return 'copied';
  }
  const result = await Share.share({ message: text, title });
  return result.action === Share.sharedAction ? 'shared' : 'dismissed';
}
