import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SAMPLE_TRANSLATIONS, localizeRecipe } from '../demo-de';
import { allSampleItemNames, allSampleRecipes, demoReceipts, demoRecipes } from '../demo';
import { setLanguage } from '../i18n';

test('every sample item, ingredient and recipe has a German version', () => {
  for (const name of allSampleItemNames()) assert.ok(SAMPLE_TRANSLATIONS.names[name], `no German name for "${name}"`);
  for (const recipe of allSampleRecipes()) {
    const de = SAMPLE_TRANSLATIONS.recipes[recipe.title];
    assert.ok(de, `no German recipe for "${recipe.title}"`);
    assert.equal(de.steps.length, recipe.steps.length, `${recipe.title}: step count differs`);
    for (const text of [de.title, de.description, de.why, ...de.steps]) assert.ok(!text.includes('ß'), `${recipe.title} uses ß`);
  }
});

test('sample data comes out in German when the language is German, and unchanged in English', () => {
  setLanguage('de');
  try {
    const receipts = demoReceipts();
    assert.ok(receipts[0].items.some((i) => i.name === 'Bio-Vollmilch 3,5%'));
    const batch = demoRecipes();
    assert.equal(batch.recipes[0].title, 'Zitronenlachs mit Zucchini & Paprika');
    assert.equal(batch.recipes[0].difficulty, 'einfach');
    assert.deepEqual(batch.recipes[0].ingredients[4], { item: 'Knoblauch', amount: '2 Zehen' });
    // Recipe ingredients and kitchen items share the same names, so "In kitchen" keeps matching.
    const kitchen = new Set(receipts.flatMap((r) => r.items.map((i) => i.name)));
    assert.ok(batch.recipes[0].uses_items.every((u) => kitchen.has(u)), 'uses_items are kitchen names');
  } finally {
    setLanguage('en');
  }
  assert.equal(demoRecipes().recipes[0].title, 'Lemon Salmon with Zucchini & Peppers');
  assert.equal(localizeRecipe(allSampleRecipes()[0]).title, 'Crispy Chicken Legs with Sweet Potato Wedges');
});
