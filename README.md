# Wingman

Tell Wingman the occasion and see yourself ready: a full look from real stores, styled on your photo and one tap from checkout.

Wingman is an AI occasion stylist for men, built for the YouCam API Skin AI & eCommerce VTO Hackathon (Perfect Corp, Devpost).

**Live:** https://wingman-eight-beta.vercel.app (try-ons there use saved sample renders for now, so the live site spends no YouCam units)

> **Teammates:** start with [docs/HANDOFF.md](docs/HANDOFF.md).
>
> **Status: in progress.** You can upload a photo, describe the occasion and get 2 to 3 looks from real stores, tried on your photo and scored, compare any look at three price tiers, refine by chat, swap single pieces, check out at each store with the cart pre-filled, browse the whole catalog, and read a night-before prep plan. Demo mode is next. See [Roadmap](#roadmap).

## How it works

1. **Upload one photo.** A waist-up, front-facing shot. Glasses are fine.
2. **Describe the occasion.** Pick an occasion, adjust the one-sentence description (for example "First date Friday night, rooftop bar, want to look effortless") and choose Budget, Mid-range or Luxury.
3. **Get 2 to 3 full looks.** Claude picks in-stock products from Singapore Shopify stores, choosing colours for your skin tone. YouCam renders each look on your photo, and each one gets a Fit Check score out of 10. A night-before grooming plan comes with them.
4. **Compare prices.** Tap "Compare prices" on any look to see the same look at Budget, Mid-range and Luxury side by side: same colours and cut, each piece from its own price tier, tried on your photo, with the real SGD total under each. Tap "Wear this version" to switch.
5. **Refine and swap.** Tell Wingman what to change in the chat bar ("more casual", "under S$300", "no white sneakers") and it re-picks every look. Or tap Swap on any piece to choose from 6 alternatives that go with the rest of the look; totals update at once and the look is tried on again.
6. **Browse and prep.** Browse every in-stock piece by category, budget, price, colour, size and store, and drop any of them into a look. "Your night-before prep plan" has three grooming steps for the evening before.
7. **Buy.** Add a look to the cart, pick an in-stock size for each piece, and tap "Checkout at {store}". Each store's own cart opens with your pieces and sizes already in it; you pay there.

The first look appears as soon as its try-on is ready (usually 20 to 50 seconds, mostly YouCam render time). The rest fill in as they finish.

### The style agent

`POST /api/style` takes the photo, the sentence and the tier, and streams its progress back as newline-delimited JSON:

1. Claude reads the occasion (type, formality, setting, time of day, any constraints) while the photo is cropped for each API.
2. Skin analysis runs in the background. It never blocks: if it fails (a tilted face, glasses), the grooming plan is simply more general.
3. Claude picks the looks from up to about 90 in-stock candidates in the tier. Every product id and the budget are checked, with one retry if something is off.
4. YouCam renders the outfit, then the hairstyle on that render, then the beard.
5. Claude scores each render with a Fit Check and writes the prep plan.

`npm run style:demo` calls it with the demo photo and prints every step.

### Price Compare

`POST /api/compare` takes the photo and one look, and streams the same look rebuilt at the other two tiers:

1. For each slot, the in-stock products of the target tier in the same category, ranked by colour, then cut (shared name words like "linen" or "loafer"), then formality.
2. Claude picks the closest stand-in per slot from those candidates and writes one sentence on what changes at that price. A pick that isn't on the list falls back to the top-ranked candidate.
3. Each version is tried on and gets its own Fit Check.

Caching keeps it cheap: a shared garment hits the render cache (zero units), and the tier picks, Fit Checks and the face box are cached per photo, so reopening a comparison takes about 2 seconds. A fresh compare costs 4 YouCam units.

### Refine and swap

- **`POST /api/refine`** takes the photo, the request and the current looks. Claude updates the brief (formality, constraints, a budget cap for "under S$300" or "cheaper"), then steps 3 to 5 run again with the previous looks as context. A budget cap also opens the cheaper tiers, and each piece is capped at its share of the budget so a full look can fit. If nothing fits, the old looks stay and Wingman says why.
- **`POST /api/swap/options`** returns 6 in-stock alternatives for one slot: same tier, suitable formality, cheap enough for any budget cap. Claude picks a varied set that goes with the rest of the look (at most two of the same product in different colours). Cached per look and slot.
- **`POST /api/swap`** tries the look on again and re-scores it. Only the top layer shows in the try-on, so swapping trousers, shoes or a watch hits the render cache and costs nothing.

## YouCam APIs

| API | What it does in Wingman | Units per call |
|---|---|---|
| AI Clothes Virtual Try-On (v3, `garment_category: auto`) | Renders the top or outerwear on your photo | 2 |
| AI Hairstyle Generator (preset styles) | Shows a new haircut | 1 |
| AI Beard Style Generator | Shows a beard style | 2 |
| AI Skin Analysis (SD concerns) | Drives the grooming prep plan | 9 for 4 concerns |

Bottoms, shoes and watches appear as product cards rather than renders. A waist-up photo hides legs and feet. YouCam's watch try-on needs a separate back-of-hand photo.

### Using one photo for every API

Each API needs different framing. Wingman takes one photo and the server prepares it:

- **Full photo** for clothes try-on
- **Head and shoulders** crop for hair try-on (it fails without shoulders)
- **Close face** crop for beard try-on and skin analysis (the face must be large in the frame)

Claude finds the face so the crops land in the right place. Location data is stripped from the photo before anything leaves the server.

### Browse

`GET /api/browse` filters the in-stock catalog (held in memory for 10 minutes) by category, tier, price band, colour family, size and store, 24 pieces at a time. Colours are grouped into families ("walnut" and "chestnut" are Brown, stripes and prints are Pattern) and sizes are normalised ("M/46" and "MEDIUM" are M, "EU 42" is 42) in [`lib/catalog/browse.ts`](lib/catalog/browse.ts). Each filter's options are counted against the other filters, so picking a colour doesn't hide the other colours.

### Checkout

Wingman never takes payment. The cart groups pieces by store and builds one Shopify cart permalink per store, `https://{store}/cart/{variantId}:{qty},{variantId}:{qty}` ([`lib/cart.ts`](lib/cart.ts)), which opens that store's checkout with the exact variants. The size picker offers in-stock variants only. When a product repeats a size across colours, the picker shows the full variant title ("White / Small") so the right colour lands in the cart.

### Unit guard and cache

- Every live YouCam call reserves its units in Supabase first. Wingman refuses any call that would pass `YOUCAM_UNIT_LIMIT` (700 by default).
- YouCam only charges for successful tasks, so failed calls release their units. Timeouts keep them reserved because the task may still finish.
- Results are cached by photo, product, API and settings. A repeat request costs zero units.
- `MOCK_YOUCAM=true` serves saved responses from `fixtures/youcam/` so UI work costs nothing.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict |
| Styling | Tailwind CSS 4, Panchang + Switzer fonts (self-hosted), design rules from the design-taste-frontend skill |
| Database and storage | Supabase Postgres + private storage buckets |
| AI | Claude via `@anthropic-ai/sdk` (Sonnet 5.5 for styling, Haiku 5.5 for product tagging) |
| Vision | YouCam API, server-side only |
| Images | sharp |
| Validation | Zod |
| Products and checkout | Shopify `products.json` feeds and cart permalinks |
| Tests | Vitest (unit) and Playwright (smoke) |
| Deploy | Vercel |

## Setup

You need Node 20 or newer, a Supabase project, a YouCam API key and an Anthropic API key.

```bash
git clone https://github.com/love98ed/wingman.git
cd wingman
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `YOUCAM_API_KEY` | YouCam API console, API Keys page (the API key, not the secret key) |
| `ANTHROPIC_API_KEY` | Claude Console |
| `SUPABASE_URL` | Supabase: Project Settings, then API |
| `SUPABASE_ANON_KEY` | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (keep this secret) |
| `MOCK_YOUCAM` | `true` to use saved fixtures instead of live calls |
| `YOUCAM_UNIT_LIMIT` | Hard cap on YouCam units (default 700) |
| `DEMO_MODE` | `true` for the fixed demo flow |

Then create the database. In the Supabase SQL Editor, run all of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It creates the tables, the unit-reserve function and two private storage buckets.

Build the product catalog (only one person at a time; it fills the shared database):

```bash
npm run stores:check      # verify each store is a working Shopify store
npm run catalog:fetch     # fetch, tag, price and tier every product (resumable)
```

The tagging cache in `fixtures/catalog-cache/` is committed, so a fresh run mostly reuses it.

Start the app:

```bash
npm run dev
```

Open http://localhost:3000 at phone width. Tap an occasion, or go straight to http://localhost:3000/style.

**Deploying:** the Vercel project needs the same variables (Production). Keep `MOCK_YOUCAM=true` there until demo mode is built, so visitors can't spend YouCam units.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Smoke test in a phone-sized browser (Playwright) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run stores:check` | Verifies every store in `fixtures/stores.json` (products feed, Shopify fingerprint, cart link). Failing stores move to `fixtures/stores-removed.json`. |
| `npm run catalog:fetch` | Builds the catalog: fetches feeds, keeps menswear, tags with Claude, converts to SGD, picks try-on images and colours, assigns relative tiers, writes to Supabase. Resumable. `--store <domain>` for one store, `--dry-run` to skip writes. |
| `npm run photo:check` | Checks a photo before spending YouCam units: finds the face and writes the crops each API would get. |
| `npm run style:demo` | Calls `POST /api/style` with the demo photo and prints the looks, Fit Checks and prep plan. Start `npm run dev` first; `MOCK_YOUCAM` decides mock or live renders. Flags: `--tier`, `--occasion`, `--max-budget`, `--photo`, `--url`, `--compare` to also price-compare the first look, `--refine "more casual"` to refine the looks, `--swap shoes` to swap a piece of the first look. |
| `npm run catalog:colours` | Re-tags the colour of tops and outerwear from their try-on photo (text tags miss multi-colour products). Safe to re-run; new catalog runs already do this. |
| `npm run youcam:smoke` | One real call per YouCam API on `fixtures/selfies/demo.jpg`. Saves responses for mock mode and prints units used. A second run costs zero units. |

## Project structure

```
app/                     Routes (App Router): / home, /style flow, /demo (placeholder),
                         /occasion (redirects to /style), /api/style (style agent, streamed),
                         /api/compare (Price Compare, streamed), /api/refine (chat refine, streamed),
                         /api/swap (swap one piece, streamed), /api/swap/options,
                         /api/browse (catalog filters)
  fonts/                 Panchang and Switzer, self-hosted
  globals.css            Design tokens, type steps, motion
components/
  style/                 The style flow at /style: photo, occasion, loading (streamed progress), looks, price compare,
                         swap, refine bar, cart, prep plan, browse
  home/                  Home page sections: hero window, occasion list, look frames, Fit Check, how it works, footer
  shared/                Used across routes: placeholder screen, scroll-entrance helper
lib/
  agent/                 Style agent: occasion parsing, candidate pool, look selection, renders, Fit Check,
                         prep plan, refine (style.ts), swap (swap.ts) and Price Compare
                         (match.ts ranks tier stand-ins, compare.ts runs it)
  catalog/               Shopify feeds: fetch, filter, Claude tagging, prices in SGD, relative tiers, store checks,
                         browse filters (colour families, sizes)
  youcam/                YouCam client, unit guard, render cache, mock mode (index.ts is the entry point)
  llm/                   Claude model config and JSON-output helper
  photo/                 Face box and crops for each YouCam API; in-browser photo shrinking
  occasions.ts           Occasion choices and tier labels shared by home and the flow
  cart.ts                Cart permalinks per store, grouping, in-stock size choices
  supabase/              Server client (service role)
  env.ts, env.server.ts  Env validated with Zod; import env.server.ts from server code only
  hash.ts, pool.ts       sha256 helper, small concurrency limiter
  utils.ts               Tailwind class merging
scripts/                 Command-line tools (run with tsx, see Scripts)
supabase/migrations/     Database schema
fixtures/
  stores.json            Verified Shopify stores (failures go to stores-removed.json)
  catalog-cache/         Resumable tagging cache, one file per store
  shopify/               Saved products.json feed for tests
  youcam/                Saved YouCam responses for MOCK_YOUCAM
  selfies/               Demo photo and its credit
public/demo/             Before and after images for the home page
tests/
  unit/                  Vitest, mirrors lib/
  e2e/                   Playwright smoke tests
  stubs/                 Stand-ins for server-only modules under Vitest
docs/                    HANDOFF.md, STEP_PROMPTS.md (build plan), screenshots/
.taste-skill/            Design direction used by the design-taste-frontend skill
CLAUDE.md                Project rules for Claude Code
```

## Privacy

- Your photo is sent to the server only to style you. Location data is stripped before anything goes to YouCam.
- Try-on renders are kept in a private bucket and shown through links that expire after an hour.
- Planned (demo mode step): photos and renders deleted after 24 hours, and a "Delete my photo" button.
- Every API key stays on the server.
- Store product images appear only as product cards linking back to the store.
- Grooming plans make no medical claims.

## Roadmap

- [x] Scaffold, theme and database schema
- [x] YouCam client with unit guard, render cache and mock mode
- [x] First real YouCam runs and saved fixtures
- [x] Store checks and catalog pipeline (17 stores, about 5,000 products, colours read from photos)
- [x] Style agent (occasion parsing, look selection, renders, Fit Check, prep plan), streamed
- [x] Home page and core screens (photo, occasion, loading, looks)
- [x] Budget tiers and price compare
- [x] Refine and swap
- [x] Cart and checkout
- [x] Prep plan and browse screens
- [ ] Demo mode, photo auto-delete, real demo photo
- [ ] Polish and deploy

## License

MIT
