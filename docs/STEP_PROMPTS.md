# Wingman: Step Prompts for Claude Code

Paste one prompt per session or per step. Wait for the step to pass its definition of done before moving on. `CLAUDE.md` must be in the repo root first.

---

## Before step 0: your checklist

1. Put `CLAUDE.md` in an empty repo root
2. Add 2 to 3 well-lit front-facing selfies to `fixtures/selfies/` (name one `demo.jpg`)
3. Find the domains for **Earnest & Collective** and **ORSQ** (Google their names)
4. Open `https://DOMAIN/products.json` in a browser for each store in CLAUDE.md section 5b. Keep only ones that return JSON. Aim for at least 8 passing, including at least 1 shoe store and 1 watch store
5. Save the passing stores to `fixtures/stores.json`:
   ```json
   [
     { "domain": "duxton.com", "name": "DUXTON", "fills": ["top"] },
     { "domain": "white-ginger.com", "name": "White Ginger", "fills": ["top", "bottom"] },
     { "domain": "boldrsupply.co", "name": "BOLDR", "fills": ["watch"] }
   ]
   ```
6. Read each store's terms; drop any that forbid reuse
7. Connect the YouCam MCP server to Claude Code using the config on the YouCam developer site (MCP and Agent Skills page) with your API key
8. Create a Supabase project and fill `.env.local`

---

## Step 0: Kickoff (plan mode)

```
Read CLAUDE.md fully. Enter plan mode. Propose:
1. the folder structure
2. the Supabase schema (SQL) for products, render_cache, youcam_usage, selfies
3. any risks you see in the plan
Do not write code yet. Ask me anything unclear.
```

**Done when:** I approve the plan.

---

## Step 1: Scaffold

```
Do step 1 only. Scaffold Next.js 15 (App Router, TypeScript strict), Tailwind, shadcn/ui, Supabase client (server and browser), Zod, Vitest and Playwright. Apply the design tokens from CLAUDE.md section 8 as Tailwind theme and CSS variables, dark by default, Geist fonts. Create .env.example, the Supabase migration SQL and a placeholder home page using the tokens. Commit.
```

**Done when:** `npm run dev` shows a themed home page at 390px, `npm test` passes, migration runs on Supabase.

---

## Step 2: YouCam client and unit guard

```
Do step 2 only. Using the YouCam MCP server or docs (never guess), build lib/youcam/ per CLAUDE.md section 4:
- shared upload, create task, poll helper
- typed functions for clothes VTO, skin analysis, hair style VTO (watch, beard, skin tone after these work)
- render cache, unit guard with youcam_usage logging, typed errors
- MOCK_YOUCAM mode reading fixtures/youcam/
Then write scripts/youcam-smoke.ts that runs ONE real call each for clothes VTO, skin analysis and hair VTO on fixtures/selfies/demo.jpg, saves responses and output images to fixtures/youcam/, and prints units used. Test whether clothes output can be fed into hair VTO and report quality. Add Vitest tests for the unit guard and cache key. Commit.
```

**Done when:** smoke script returns all three real results, fixtures saved, units logged, second run hits cache with zero units, mock mode works.

---

## Step 3: Catalog pipeline

```
Do step 3 only. First write scripts/check-stores.ts: for every store in fixtures/stores.json, request /products.json?limit=1 (2 retries) and run all 3 Shopify verification checks in CLAUDE.md section 5b (JSON shape, Shopify fingerprint, cart permalink). Save the matched fingerprint as shopifyProof. Apply the removal rule in CLAUDE.md section 5b: remove every failing store from fixtures/stores.json and log it to fixtures/stores-removed.json with the reason. Print a table of kept and removed stores with product count estimate and currency. Stop and show me the table before continuing.

Then build scripts/fetch-catalog.ts per CLAUDE.md sections 5, 5b and 2:
- read stores from fixtures/stores.json; page through products.json (limit=250) per store
- filter to menswear (exclude womenswear, kids, gift cards, home goods)
- if a store fails mid-fetch or ends with zero menswear products, remove it per the removal rule and delete any of its products already in Supabase
- tag in batches of 25 with claude-haiku-5-5 (category, colour, formality, occasions), Zod-validated
- convert prices to SGD with lib/catalog/fx.ts, keeping originalPrice and originalCurrency
- assign RELATIVE tiers per category with lib/catalog/tiers.ts (price percentiles, fixed-threshold fallback for categories under 6 items)
- choose the best try-on image per product; skip products with none
- upsert into Supabase; print a summary table (store, fetched, kept) and a tier table (category x tier counts)
Add Vitest tests for relative tier assignment (including ties and small categories), FX conversion and image selection heuristics. Commit.
```

**Done when:** every tier has at least 5 in-stock items in tops, bottoms and shoes, plus at least 3 watches. If shoes or any tier fall short, Claude reports which and stops for you to add a store.

---

## Step 4: Style agent (backend)

```
Do step 4 only. Build app/api/style per CLAUDE.md section 6 steps 1 to 6 with claude-sonnet-5-5, Zod-validated JSON and one retry. Selection must only use in-stock products and respect tier and maxBudget. Return looks with items, render URLs, Fit Check, total price and prep plan. Write a script that calls the route with the demo selfie and prints the result. Commit.
```

**Done when:** the script returns 2 to 3 coherent looks with renders in mock mode and in one real run, and total prices match the tier.

---

## Step 5: Core screens

```
Do step 5 only. Build Home, Selfie, Occasion (text box, occasion chips, budget toggle), Loading (step-by-step progress) and Looks (swipeable cards with render, Fit Check, item list with prices, total) per CLAUDE.md section 8. Show the outfit render first and stream other renders in. Handle every typed YouCam error with a friendly message and retry. Commit.
```

**Done when:** full flow works on a phone-sized viewport in mock mode, and once with real APIs.

---

## Step 6: Budget tiers and price compare

```
Do step 6 only. Add the budget toggle effect and a Price Compare view showing the same look at Budget, Mid-range and Luxury side by side, keeping style direction (colour, cut, formality) consistent across tiers. Tiers are relative per category (CLAUDE.md section 5), so pick each slot from its own category tier. Show the real SGD total under each column. Cache aggressively; reuse renders where items are shared. Commit.
```

**Done when:** one look shows at three price points with clearly different totals and visibly similar style.

---

## Step 7: Refine and swap

```
Do step 7 only. Build app/api/refine (chat bar: "more casual", "under $150", "no white sneakers") and app/api/swap (tap an item, see 6 alternatives in the same slot, pick one, re-render). Update totals live. Commit.
```

**Done when:** "more casual" visibly changes the look; swapping shoes re-renders with the new pair.

---

## Step 8: Cart and checkout

```
Do step 8 only. Build the cart: items grouped by store, size picker showing only in-stock variants, "Checkout at {store}" per store using cart permalinks (CLAUDE.md section 7). Add Vitest tests for the permalink builder. Commit.
```

**Done when:** tapping checkout opens a real store cart with the exact items and sizes.

---

## Step 9: Prep plan and browse

```
Do step 9 only. Build the Prep Plan screen (3 steps from skin analysis, no medical claims) and a Browse screen with the full catalog and filters for tier, price, colour, size, category and store. Tapping a browsed item lets me add it to a look. Commit.
```

**Done when:** both screens work at 390px with real catalog data.

---

## Step 10: Demo mode and privacy

```
Do step 10 only. Implement DEMO_MODE per CLAUDE.md section 12 with a "Try the demo" button. Implement selfie auto-delete after 24 hours and a "Delete my photo" button. Write the Playwright smoke test for the full flow in mock and demo mode. Commit.
```

**Done when:** demo mode runs the full flow with zero live YouCam calls; Playwright passes.

---

## Step 11: Polish and deploy

```
Do step 11 only. Audit every screen at 390px and 1280px, fix spacing, loading states, empty states and error states. Check no API keys reach the client bundle. Deploy to Vercel, run the catalog script against production Supabase, and verify the live URL end to end. Commit.
```

**Done when:** the live Vercel URL works on my phone, including checkout.

---

## Step 12: Judge-first README and submission assets

```
Do step 12 only. Write README.md in this order:
1. One-line tagline and live demo link
2. "Try it in 60 seconds": open link, tap Try the demo (or upload a selfie), what to look for
3. Screenshot strip
4. YouCam APIs used and what each does in Wingman
5. How the agent works (short diagram in Mermaid)
6. Tech stack
7. Setup: clone, env vars, migration, catalog script, mock mode, demo mode
8. Limitations and future work (Wingman Pay, affiliate links, more stores)
9. License (MIT)
Capture screenshots of every screen at 390px into docs/screenshots/. Commit.
```

**Done when:** a stranger can run the app from the README alone.

---

## Anytime prompts

- **Stuck:** `Stop. Summarise what's blocking you, what you tried and 2 to 3 options with time estimates.`
- **Units check:** `Show total YouCam units used so far by API and what remains before the limit.`
- **Scope creep:** `Is this in CLAUDE.md? If not, don't build it.`
