# NutriTrack

Take a photo of a supermarket receipt (Kassenzettel). NutriTrack lists every product with its estimated nutrition, sums up the whole purchase, and suggests recipes that use what you bought in the last few days, starting with whatever spoils first.

Built with Expo (React Native, SDK 57). Claude (`claude-opus-5-5`) reads the receipts and writes the recipes.

## Screens

- **Today**: scan a receipt (camera or gallery), see the week's nutrition as a macro ring, the items to use soon, recipe ideas and recent receipts.
- **Receipt**: the purchase's calories and macros, where the calories come from by category, and every item with its own emoji. Tap an item to compare its values per 100 g with the amount bought.
- **Receipts**: all scans grouped by week, with 30-day totals.
- **Recipes**: your kitchen for the last 3, 5, 7 or 14 days, with freshness labels ("1 day", "3 days") based on estimated shelf life. Tap **Suggest recipes** to get dishes built mainly from those items. A recipe opens with nutrition per serving, ingredients marked "In kitchen" or "To buy", and steps you can tick off while cooking.
- **Settings**: Anthropic API key (kept in the device keychain), language for product names and recipes (English or German), dietary preferences, sample data, delete all.

Light and dark mode follow the device setting.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press `w` for the browser. Then either:

- open **Settings** and paste an Anthropic API key from https://console.anthropic.com, or
- tap **Try with sample data** on the Today screen to explore with three example shopping trips.

Checks:

```bash
npm run typecheck
npm run lint
```

## Demo build

`npm run export:demo` builds a web version into `dist-demo/` that preloads sample data and answers scans and recipe requests with sample results. It needs no API key and makes no network calls, so it can be shared as a clickable demo. The switch is the `EXPO_PUBLIC_DEMO=1` environment variable, which is inlined at build time. Regular builds never contain demo behavior.

## Project layout

```
src/app/(tabs)/index.tsx       Today: scan, weekly summary, use-soon items
src/app/(tabs)/history.tsx     All receipts
src/app/(tabs)/recipes.tsx     Kitchen and recipe suggestions
src/app/(tabs)/settings.tsx    API key, language, diet, data
src/app/receipt/[id].tsx       Receipt detail
src/app/recipe/[index].tsx     Recipe detail
src/components/                Design system (ui.tsx), charts, cards, scan overlay
src/constants/theme.ts         Colors (light/dark), spacing, radii
src/lib/claude.ts              Claude calls (receipt analysis, recipes)
src/lib/types.ts               Zod schemas used for structured output
src/lib/nutrition.ts           Scaling, totals, pantry and freshness
src/lib/storage.ts             AsyncStorage / SecureStore persistence
src/lib/demo.ts                Sample data and demo-build results
```

## Notes

- Nutrition values are estimates for typical products, not read from the packaging.
- The app calls the Anthropic API directly with the user's own key, which is fine for personal use. Before publishing it to other people, put a small backend in front of the API so no key ships in the app.
- Receipts and recipes stay on the device. Only the receipt photo and the list of foods are sent to the API.
