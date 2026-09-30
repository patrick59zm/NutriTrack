# NutriTrack

Take a photo of a supermarket receipt (Kassenzettel). NutriTrack lists every product with its estimated nutrition, sums up the whole purchase, and suggests recipes that use what you bought over the last few days, starting with whatever spoils first.

Built with Expo (React Native, SDK 57) and Claude (`claude-opus-5-5`) for reading receipts and suggesting recipes.

## Features

- **Scan**: take a photo or pick one from the gallery. Claude reads each line, expands abbreviations (`BIO VOLLM.3,5%` → `Bio Vollmilch 3,5%`), estimates pack weight and nutrition per 100 g, and flags non-food lines (Pfand, bags, cosmetics).
- **Receipt detail**: kcal, protein, carbs, sugar, fat, saturated fat, fiber and salt, for each item and for the whole receipt. Totals are computed on the device from the per-100 g values.
- **History**: every scanned receipt, stored locally, plus a 7-day summary on the Scan tab.
- **Recipes**: builds a pantry from receipts in the last 3/5/7/14 days, marks items to "use soon" based on estimated shelf life, and asks Claude for recipes that mostly use those items. Dietary preferences are taken into account.
- **Settings**: API key (stored in the device keychain with `expo-secure-store`), output language (English/German), dietary preferences, delete all data.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS), or press `w` for the web version. Then open **Settings** and paste an Anthropic API key from https://console.anthropic.com.

Other checks:

```bash
npm run typecheck
npm run lint
```

## Project layout

```
src/app/(tabs)/index.tsx      Scan screen + 7-day summary
src/app/(tabs)/history.tsx    All receipts
src/app/(tabs)/recipes.tsx    Pantry + recipe suggestions
src/app/(tabs)/settings.tsx   API key, language, diet
src/app/receipt/[id].tsx      Receipt detail with per-item nutrition
src/lib/claude.ts             Claude calls (receipt analysis, recipes)
src/lib/types.ts              Zod schemas used for structured output
src/lib/nutrition.ts          Scaling, totals, macro split
src/lib/storage.ts            AsyncStorage / SecureStore persistence
src/lib/image.ts              Resize + base64 before upload
```

## Notes

- Nutrition values are estimates for typical products, not from the actual packaging.
- The app calls the Anthropic API directly with the user's own key, which is fine for personal use. Before publishing it to other people, put a small backend in front of the API so no key ships in the app.
- Data (receipts and recipes) stays on the device. Only the receipt photo and the pantry list are sent to the API.
