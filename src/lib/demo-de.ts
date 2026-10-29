import { getLanguage } from './i18n';
import type { Receipt, ReceiptAnalysis, Recipe, RecipeBatch } from './types';

// German versions of the sample data. The English data in demo.ts stays the single
// source; these tables are applied on the way out when the language is German.

const NAMES: Record<string, string> = {
  'Organic whole milk 3.5%': 'Bio-Vollmilch 3,5%',
  Bananas: 'Bananen',
  'Baby spinach': 'Babyspinat',
  'Chicken breast fillet': 'Hähnchenbrustfilet',
  'Cherry tomatoes': 'Cherrytomaten',
  Mozzarella: 'Mozzarella',
  'Whole-wheat spaghetti': 'Vollkorn-Spaghetti',
  'Greek yogurt 10%': 'Griechisches Joghurt 10%',
  Lemons: 'Zitronen',
  'Bottle deposit': 'Flaschenpfand',
  Garlic: 'Knoblauch',
  'Free-range eggs (10)': 'Freilandeier (10)',
  'Rolled oats': 'Haferflocken',
  'Elstar apples': 'Elstar-Äpfel',
  'Red bell peppers': 'Rote Paprika',
  'Salmon fillet': 'Lachsfilet',
  Zucchini: 'Zucchini',
  'Whole-grain bread': 'Vollkornbrot',
  Butter: 'Butter',
  'Dark chocolate 70%': 'Dunkle Schokolade 70%',
  'Sparkling water': 'Mineralwasser mit Kohlensäure',
  'Waxy potatoes': 'Festkochende Kartoffeln',
  Onions: 'Zwiebeln',
  Carrots: 'Karotten',
  'Red lentils': 'Rote Linsen',
  'Tomato passata': 'Passierte Tomaten',
  'Gouda, medium aged': 'Gouda, mittelalt',
  'Orange juice': 'Orangensaft',
  Hummus: 'Hummus',
  'Shopping bag': 'Einkaufstasche',
  'Organic oat milk': 'Bio-Haferdrink',
  Avocados: 'Avocados',
  'Sweet potatoes': 'Süsskartoffeln',
  'Chickpeas (canned)': 'Kichererbsen (Dose)',
  'Feta cheese': 'Feta',
  'Brown mushrooms': 'Braune Champignons',
  'Vine tomatoes': 'Rispentomaten',
  'Plain yogurt 3.5%': 'Naturjoghurt 3,5%',
  'Chicken legs': 'Hähnchenschenkel',
  'Whole-grain toast bread': 'Vollkorn-Toastbrot',
  Parmesan: 'Parmesan',
  'Fresh basil': 'Frischer Basilikum',
  'Olive oil, salt, pepper': 'Olivenöl, Salz, Pfeffer',
  'Paprika, oil, salt': 'Paprikapulver, Öl, Salz',
  Lemon: 'Zitrone',
  'Curry powder': 'Currypulver',
  'Oat drink': 'Haferdrink',
};

const AMOUNTS: Record<string, string> = {
  'to taste': 'nach Belieben',
  '1 clove': '1 Zehe',
  '2 cloves': '2 Zehen',
  '3 cloves': '3 Zehen',
  '1 large': '1 grosse',
  '4 slices': '4 Scheiben',
  'a few leaves': 'ein paar Blätter',
  '2 ripe': '2 reife',
  'to serve': 'zum Servieren',
  '2 tsp': '2 TL',
};

const DIFFICULTY: Record<string, string> = { easy: 'einfach', medium: 'mittel', hard: 'anspruchsvoll' };

type RecipeText = { title: string; description: string; why: string; steps: string[] };

const RECIPES: Record<string, RecipeText> = {
  'Lemon Salmon with Zucchini & Peppers': {
    title: 'Zitronenlachs mit Zucchini & Paprika',
    description: 'Lachs mit knuspriger Haut auf einem Blech mit gerösteter Paprika und Zucchini, mit einem Spritzer Zitrone.',
    why: 'Lachs hält nur etwa zwei Tage, darum kommt er zuerst dran – Paprika und Zucchini gleich mit.',
    steps: [
      'Den Ofen auf 220 °C heizen. Zucchini und Paprika in Streifen schneiden.',
      'Das Gemüse mit Öl, Knoblauchscheiben, Salz und Pfeffer mischen und 12 Minuten rösten.',
      'Den Lachs würzen, mit der Haut nach oben auf das Gemüse legen und 10 Minuten weiterrösten.',
      'Vor dem Servieren mit Zitronensaft und -abrieb abschmecken.',
    ],
  },
  'Creamy Spinach Chicken Pasta': {
    title: 'Cremige Spinat-Hähnchen-Pasta',
    description: 'Vollkorn-Spaghetti mit angebratenem Hähnchen, zusammengefallenem Spinat und geplatzten Cherrytomaten.',
    why: 'Verwertet Spinat und Hähnchen, die beide in etwa drei Tagen ablaufen.',
    steps: [
      'Die Spaghetti in Salzwasser kochen; eine Tasse Nudelwasser aufheben.',
      'Mundgerechte Hähnchenstücke in einer heissen Pfanne goldbraun anbraten und beiseitestellen.',
      'Knoblauch und halbierte Tomaten in derselben Pfanne weich dünsten, den Spinat dazugeben und zusammenfallen lassen.',
      'Vom Herd nehmen, Joghurt und einen Schuss Nudelwasser einrühren, dann Pasta und Hähnchen dazugeben.',
      'Abschmecken und mit geriebenem Parmesan servieren.',
    ],
  },
  'Caprese Toast': {
    title: 'Caprese-Toast',
    description: 'Geröstetes Vollkornbrot mit Mozzarella, Cherrytomaten und etwas Olivenöl.',
    why: 'Ein schnelles Mittagessen, das das Brot verwertet, bevor es altbacken wird.',
    steps: [
      'Das Brot knusprig toasten.',
      'Mit Mozzarellascheiben und halbierten Tomaten belegen.',
      'Mit Basilikum, Olivenöl, Salz und Pfeffer abschmecken.',
    ],
  },
  'Banana Oat Pancakes': {
    title: 'Bananen-Hafer-Pancakes',
    description: 'Luftige Pancakes aus drei Zutaten, süss von reifen Bananen, mit Joghurt obendrauf.',
    why: 'Die Bananen bekommen Flecken – perfekt für Pancakes.',
    steps: [
      'Bananen, Haferflocken, Eier und Milch zu einem dicken Teig mixen.',
      'Kleine Pancakes in einer gebutterten Pfanne backen, etwa 2 Minuten pro Seite.',
      'Gestapelt mit einem Löffel griechischem Joghurt servieren.',
    ],
  },
  'Crispy Chicken Legs with Sweet Potato Wedges': {
    title: 'Knusprige Hähnchenschenkel mit Süsskartoffel-Wedges',
    description: 'Im Ofen gebratene Hähnchenschenkel mit Paprika-Süsskartoffeln und einem Knoblauch-Joghurt-Dip.',
    why: 'Hähnchen hält nur etwa drei Tage, darum ist es zuerst dran.',
    steps: [
      'Den Ofen auf 210 °C heizen.',
      'Die Hähnchenschenkel mit Öl, Paprikapulver und Salz einreiben; die Süsskartoffeln in Spalten schneiden.',
      'Alles auf einem Blech 40–45 Minuten knusprig rösten.',
      'Geriebenen Knoblauch und Salz in das Joghurt rühren und als Dip servieren.',
    ],
  },
  'Mushroom & Feta Toast with Smashed Avocado': {
    title: 'Pilz-Feta-Toast mit zerdrückter Avocado',
    description: 'Knuspriger Toast mit zerdrückter Avocado, angebratenen Pilzen und zerbröckeltem Feta.',
    why: 'Avocados und Pilze kippen beide in etwa vier Tagen.',
    steps: [
      'Die Pilzscheiben in einer heissen Pfanne goldbraun anbraten und würzen.',
      'Die Avocados mit Zitronensaft, Salz und Pfeffer zerdrücken.',
      'Das Brot toasten, mit Avocado bestreichen und mit Pilzen, Tomate und Feta belegen.',
    ],
  },
  'Roasted Chickpea & Tomato Bowl': {
    title: 'Bowl mit gerösteten Kichererbsen & Tomaten',
    description: 'Warme Bowl mit knusprigen Kichererbsen, gerösteter Süsskartoffel und Tomaten, dazu Feta und Joghurt.',
    why: 'Verwertet Vorräte plus die Tomaten, bevor sie weich werden.',
    steps: [
      'Gewürfelte Süsskartoffel und abgetropfte Kichererbsen mit Öl und Kreuzkümmel bei 220 °C 25 Minuten rösten.',
      'Die halbierten Tomaten für die letzten 10 Minuten dazugeben.',
      'Mit zerbröckeltem Feta und einem Löffel Joghurt servieren.',
    ],
  },
  'Red Lentil & Carrot Dal': {
    title: 'Dal mit roten Linsen & Karotten',
    description: 'Ein wärmendes, cremiges Dal aus roten Linsen, Karotten und Tomate, fertig in einem Topf.',
    why: 'Pflanzliches Eiweiss aus den Linsen, und die Karotten werden verwertet, bevor sie weich werden.',
    steps: [
      'Die gehackte Zwiebel, den Knoblauch und die geriebenen Karotten 5 Minuten in Öl andünsten.',
      'Das Currypulver einrühren, dann Linsen, passierte Tomaten und 750 ml Wasser dazugeben.',
      '20 Minuten köcheln lassen und ab und zu umrühren, bis es dick und cremig ist. Abschmecken.',
    ],
  },
  'Roasted Pepper & Zucchini Spaghetti': {
    title: 'Spaghetti mit gerösteter Paprika & Zucchini',
    description: 'Vollkorn-Spaghetti mit gerösteter Paprika, Zucchini, Tomaten, Knoblauch und Zitrone.',
    why: 'Paprika und Zucchini sind das nächste Gemüse, das dran ist.',
    steps: [
      'Paprika-, Zucchini- und Tomatenstücke mit Öl und Salz bei 220 °C 20 Minuten rösten.',
      'Die Spaghetti kochen; eine Tasse Nudelwasser aufheben.',
      'Knoblauchscheiben in Öl anbraten, Gemüse, Pasta und einen Schuss Nudelwasser dazugeben.',
      'Mit Zitronensaft und -abrieb abschmecken.',
    ],
  },
  'Chickpea, Sweet Potato & Avocado Bowl': {
    title: 'Kichererbsen-Süsskartoffel-Bowl mit Avocado',
    description: 'Geröstete Süsskartoffel und knusprige Kichererbsen mit Tomaten und Avocadoscheiben.',
    why: 'Die Avocado ist jetzt reif, und die Kichererbsen machen satt.',
    steps: [
      'Gewürfelte Süsskartoffel und abgetropfte Kichererbsen mit Öl, Kreuzkümmel und Salz bei 220 °C 25 Minuten rösten.',
      'Tomaten und Avocado in Scheiben schneiden.',
      'Alles in Schüsseln anrichten, mit einem Spritzer Zitrone oder etwas Öl.',
    ],
  },
  'Apple Cinnamon Overnight Oats': {
    title: 'Overnight Oats mit Apfel und Zimt',
    description: 'Cremige Haferflocken, über Nacht eingeweicht mit geriebenem Apfel, Banane und Zimt.',
    why: 'Ein Frühstück ohne Kochen für die Bananen und Äpfel.',
    steps: [
      'Haferflocken, Haferdrink, geriebenen Apfel und eine Prise Zimt mischen.',
      'Über Nacht in den Kühlschrank stellen.',
      'Am Morgen mit Bananenscheiben belegen.',
    ],
  },
};

const german = () => getLanguage() === 'de';

/** The German name of a sample item or ingredient; unknown names pass through. */
export const germanName = (name: string) => NAMES[name] ?? name;

/** Everything the tables know, for the test that keeps them complete. */
export const SAMPLE_TRANSLATIONS = { names: NAMES, recipes: RECIPES };

export function localizeRecipe(recipe: Recipe): Recipe {
  if (!german()) return recipe;
  const text = RECIPES[recipe.title];
  return {
    ...recipe,
    ...(text && { title: text.title, description: text.description, why: text.why, steps: text.steps }),
    difficulty: DIFFICULTY[recipe.difficulty] ?? recipe.difficulty,
    uses_items: recipe.uses_items.map(germanName),
    extra_ingredients_needed: recipe.extra_ingredients_needed.map(germanName),
    ingredients: recipe.ingredients.map((i) => ({ item: germanName(i.item), amount: AMOUNTS[i.amount] ?? i.amount })),
  };
}

export function localizeBatch(batch: RecipeBatch): RecipeBatch {
  return german() ? { ...batch, recipes: batch.recipes.map(localizeRecipe) } : batch;
}

export function localizeReceipt(receipt: Receipt): Receipt {
  return german() ? { ...receipt, items: receipt.items.map((i) => ({ ...i, name: germanName(i.name) })) } : receipt;
}

export function localizeAnalysis(analysis: ReceiptAnalysis): ReceiptAnalysis {
  return german() ? { ...analysis, items: analysis.items.map((i) => ({ ...i, name: germanName(i.name) })) } : analysis;
}
