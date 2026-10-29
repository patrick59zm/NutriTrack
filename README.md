# NutriTrack

Take a photo of a supermarket receipt (Kassenzettel). NutriTrack lists every product with its estimated nutrition, sums up the whole purchase, keeps a picture of what is in your kitchen, and suggests recipes that use what you bought in the last few days, starting with whatever spoils first.

Built with Expo (React Native, SDK 57). Claude (`claude-opus-5-5`) reads the receipts, estimates items you add by hand and writes the recipes. The interface is in English or German (Swiss spelling), and light and dark mode follow the device.

## What it does

**Scanning**
- Camera or gallery on the phone, file upload in the browser. Long receipts are cut into overlapping tiles so every line is read at full resolution, and a very long one can be photographed in up to four parts that are read as one receipt; the scan can be cancelled.
- Swiss and German stores (Migros, Coop, Denner, Volg, REWE, Lidl, Aldi, …), CHF and EUR, deposits (Depot/Pfand) and discounts handled as non-food.
- The item prices are checked against the printed total. When they do not add up, Claude reads the receipt a second time and the receipt carries a warning until you have checked the items.
- The photo is kept with the receipt and can be viewed full screen; every item is editable (name, quantity, weight, price, category, food or not), items can be added by description ("Bananen 1 kg") and estimated by Claude, the store, purchase date, printed total and currency can be corrected, and a receipt can be scanned again.

**Nutrition**
- Calories, protein, carbs, fat, sugar, saturated fat, fiber and salt per item (per 100 g and for the amount bought), per receipt, per week and per 30 days, plus the figure per person and day for your household.
- **Basket check**: sugar, saturated fat, fiber, salt, protein and fruit & vegetables compared with WHO guideline values, as meters with a word and an icon, not just a color.
- **Trends**: calories and spending per week for the last eight weeks, and where the money went in the last 30 days, by product category and by store.

**Kitchen and recipes**
- Everything bought in the last 3, 5, 7 or 14 days with a freshness label from the estimated shelf life. Tick off what is used up.
- Recipe ideas from Claude for what is in the kitchen, honoring dietary preferences, household size, a cooking-time limit and a wish of the day ("something light", "one pot"). Ingredients are marked "In kitchen" or "To buy"; the missing ones go to the shopping list with one tap.
- Save recipes, share them as text, and log "I cooked this", which marks the ingredients as used up.
- Opt-in reminder at 17:00 on days when something in the kitchen is about to go off.

**Keeping things**
- Receipts, recipes, lists and settings stay on the device. A backup can be exported as one JSON file and imported on another phone, every item can be exported as a CSV file for spreadsheets, and the Claude usage (tokens and list-price cost) is counted per device.

## Screens

- **Today**: scan, the week's nutrition with the macro ring, per-person figure and basket check, items to use soon, recipe and shopping teasers, recent receipts.
- **Receipts**: 30-day totals, where the money goes, the weekly trends, search by store or item, and every receipt grouped by week.
- **Receipt**: the purchase's totals, where the calories come from by category, basket check, every item with its own emoji and the printed line it came from, editing, re-scan and delete.
- **Recipes**: your kitchen, the mood chips and the ideas; saved recipes underneath. A recipe opens with nutrition per serving, ingredients and steps you can tick off while cooking.
- **Shopping**: a list fed by recipes or typed by hand, with a share button.
- **Settings**: Anthropic API key (device keychain) and usage, language, currency, household size, cooking-time limit, dietary preferences, reminders, backup export and import, CSV export, sample data, delete all.

## Install on Android

Every push to `main` (and to the development branch) builds an installable Android app on GitHub and publishes it under [Releases](https://github.com/patrick59zm/NutriTrack/releases).

1. On your Android phone, open the newest release and tap **NutriTrack.apk**.
2. Open the downloaded file. Android asks to allow installs from your browser the first time; allow it, then tap **Install**.
3. Open NutriTrack, go to **Settings** and paste your Anthropic API key.

Newer builds install over the old one and keep your receipts. The APK is signed with a development key: fine for installing directly, not for the Play Store. The workflow (`.github/workflows/android.yml`) typechecks, runs the unit tests and then builds.

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
npm test
```

The unit tests (`src/lib/__tests__`) cover the nutrition maths, the price check, the basket metrics, the spending helpers, the CSV export, the lenient JSON parsing of Claude's answers and the English/German dictionary.

## Demo build

`npm run export:demo` builds a web version into `dist-demo/` that preloads sample data. Hosted as a claude.ai artifact it reads photos and writes recipes with the viewer's own Claude; where that is unavailable it shows sample results and says why. It needs no API key, so it can be shared as a clickable demo. The switch is the `EXPO_PUBLIC_DEMO=1` environment variable, which is inlined at build time. Regular builds never contain demo behavior.

## Project layout

```
src/app/(tabs)/index.tsx       Today: scan, weekly summary, basket check, use-soon items
src/app/(tabs)/history.tsx     Receipts, 30-day totals, trends, search
src/app/(tabs)/recipes.tsx     Kitchen and recipe suggestions
src/app/(tabs)/shopping.tsx    Shopping list
src/app/(tabs)/settings.tsx    API key and usage, preferences, reminders, backup
src/app/receipt/[id].tsx       Receipt detail and editing
src/app/recipe/[index].tsx     Recipe detail, shopping, "I cooked this"
src/components/                Design system (ui.tsx), charts, cards, item and receipt editors, photo sheet, scan overlay
src/constants/theme.ts         Colors (light/dark), spacing, radii
src/hooks/use-scanner.ts       The scan flow (pick, prepare, analyze, save)
src/lib/claude.ts              Claude calls (receipt analysis, item estimate, recipes)
src/lib/parse.ts               Lenient parsing of structured answers
src/lib/types.ts               Zod schemas used for structured output
src/lib/nutrition.ts           Scaling, totals, price check, pantry and freshness
src/lib/insights.ts            Basket check, weekly series, search
src/lib/i18n.ts                English and German strings
src/lib/storage.ts             AsyncStorage / SecureStore persistence
src/lib/backup.ts              Backup export and import, file delivery
src/lib/csv.ts                 Items as a spreadsheet
src/lib/reminders.ts           Use-soon notifications
src/lib/demo.ts                Sample data and demo-build results
```

## Notes

- Nutrition values are estimates for typical products, not read from the packaging; the basket check compares what was bought, not what was eaten.
- The app calls the Anthropic API directly with the user's own key, which is fine for personal use. Before publishing it to other people, put a small backend in front of the API so no key ships in the app.
- Receipts and recipes stay on the device. Only the receipt photo (or the typed description of an item) and the list of foods are sent to the API.
