import assert from 'node:assert/strict';
import { test } from 'node:test';

import { KEYS, everyLanguage, getLanguage, locale, setLanguage, t } from '../i18n';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('both languages carry every key, non-empty and with the same placeholders', () => {
  assert.ok(KEYS.length > 300);
  for (const key of KEYS) {
    const [en, de] = everyLanguage(key);
    assert.ok(en.trim().length > 0, `${key} is empty in English`);
    assert.ok(de.trim().length > 0, `${key} is empty in German`);
    assert.deepEqual(placeholders(de), placeholders(en), `${key} placeholders differ`);
  }
});

test('plurals, placeholders and the language switch', () => {
  setLanguage('en');
  assert.equal(t('common.items', { n: 1 }), '1 item');
  assert.equal(t('common.items', { n: 3 }), '3 items');
  assert.equal(t('shopping.for', { recipe: 'Dal' }), 'for Dal');
  assert.equal(t('shopping.for'), 'for {recipe}'); // nothing to fill in stays visible
  assert.equal(locale(), 'en-GB');

  setLanguage('de');
  assert.equal(getLanguage(), 'de');
  assert.equal(t('common.receipts', { n: 1 }), '1 Beleg');
  assert.equal(t('common.receipts', { n: 2 }), '2 Belege');
  assert.equal(t('tabs.settings'), 'Einstellungen');
  assert.equal(locale(), 'de-CH');
  assert.deepEqual(everyLanguage('diet.vegetarian'), ['Vegetarian', 'Vegetarisch']);
  setLanguage('en');
});

test('German uses Swiss spelling: no ß anywhere', () => {
  for (const key of KEYS) {
    const [, de] = everyLanguage(key);
    assert.ok(!de.includes('ß'), `${key} uses ß`);
  }
});
