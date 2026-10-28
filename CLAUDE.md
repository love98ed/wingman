# Wingman: Project Context for Claude Code

This file is the source of truth for the project. Read it at the start of every session. When a step prompt and this file disagree, ask me.

## 1. Project

**Wingman** is an AI occasion stylist for men, built for the YouCam API Skin AI & eCommerce VTO Hackathon (Perfect Corp, Devpost).

**Deadline:** Nov 3, 2026, 12:45am SGT. Polished golden path beats breadth.

**Tagline:** Tell Wingman the occasion and see yourself ready: a full look from real stores, styled on your selfie and one tap from checkout.

**Flow:** selfie, one sentence about the event, budget tier. The agent builds 2 to 3 full looks (outfit, hairstyle, watch, optional beard) from real Shopify store products, renders them on the selfie with YouCam APIs, scores each with a Fit Check and gives a grooming prep plan from skin analysis. The user can swap items, refine by chat, pick in-stock sizes and tap checkout to open each store's cart pre-filled.

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict |
| Styling | Tailwind CSS + shadcn/ui, mobile-first |
| Database | Supabase Postgres (catalog, render cache, unit log) |
| Storage | Supabase Storage, private buckets, signed URLs |
| LLM | Anthropic Claude via `@anthropic-ai/sdk` |
| Validation | Zod for every API input and every LLM output |
| Vision | YouCam API, server-side only |
| Product data | Shopify public `products.json` feeds |
| Checkout | Shopify cart permalinks |
| Tests | Vitest (unit), Playwright (smoke) |
| Deploy | Vercel |

### LLM models and limits

| Task | Model | Max tokens |
|---|---|---|
| Occasion parsing, look selection, Fit Check, prep plan, refine | `claude-sonnet-5-5` | 1,500 |
| Bulk product tagging (batches of 25) | `claude-haiku-5-5` | 2,000 |

Put model names in `lib/llm/config.ts`, never inline. Log token usage per call in dev.

## 3. Environment variables

```
YOUCAM_API_KEY=
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SHOPIFY_STORES=            # comma-separated, from fixtures/stores.json
MOCK_YOUCAM=true           # true during UI work
YOUCAM_UNIT_LIMIT=700      # hard stop
DEMO_MODE=false            # golden path for video and judges
```

All keys stay server-side. Never import server env into client components.

## 4. YouCam APIs

Never guess endpoints or payloads. Use the YouCam MCP server (if connected) or the docs at https://docs.perfectcorp.com. Save every real response you inspect to `fixtures/youcam/` for mock mode.

| API | Purpose | Priority |
|---|---|---|
| AI Clothes Virtual Try-On (v3, `garment_category: auto`) | Outfit render | Must |
| AI Skin Analysis (SD concerns only, do not mix with HD) | Prep plan | Must |
| AI Hair Style Virtual Try-On | Haircut | Must |
| AI Watch Virtual Try-On | Watch | Should |
| AI Beard Style Virtual Try-On | Beard | Should |
| AI Skin Shade Finder or Skin Tone | Colour matching | Should |
| Eyewear try-on | Glasses | Only if an API exists |

### YouCam client rules (`lib/youcam/`)
- One typed function per API; one shared upload, create task, poll helper with timeout and backoff
- Cache key: hash of (selfie hash + product id + API name + params). Cache hit costs zero units
- **Unit guard:** log every call (API, units, timestamp) to Supabase `youcam_usage`. Before each call, check the total; refuse if it would exceed `YOUCAM_UNIT_LIMIT`. Print a running total in dev logs
- `MOCK_YOUCAM=true` returns fixtures from `fixtures/youcam/` with a short fake delay
- Typed errors: `NO_FACE`, `BAD_LIGHTING`, `TIMEOUT`, `QUOTA`, `UNKNOWN`
- If chained renders degrade quality, show outfit render and grooming render side by side

## 5. Data model

```ts
type Product = {
  id: string;            // `${store}-${shopifyProductId}`
  store: string;
  storeName: string;
  name: string;
  price: number;
  currency: "SGD";
  tier: "budget" | "mid" | "luxury";
  category: "top" | "outerwear" | "bottom" | "shoes" | "watch" | "glasses" | "accessory";
  originalPrice: number;     // in store currency
  originalCurrency: string;  // from the feed
  colour: string;
  formality: "casual" | "smart-casual" | "formal";
  occasions: ("date" | "interview" | "wedding" | "cny" | "dnd" | "night-out")[];
  image: string;         // best try-on image chosen by the pipeline
  images: string[];
  url: string;
  variants: { id: number; size: string; available: boolean }[];
  updatedAt: string;
};
```

Other tables: `render_cache`, `youcam_usage`, `selfies` (with `expires_at`, auto-delete after 24 hours).

### Tiers are relative, not fixed (`lib/catalog/tiers.ts`)

Local budget menswear stores are scarce, so tiers are computed from the catalog itself:
1. Convert every price to SGD first (store currency comes from the feed; keep FX rates in `lib/catalog/fx.ts`)
2. Group in-stock products by category
3. Sort by price within each category
4. Cheapest third = `budget`, middle third = `mid`, top third = `luxury` (use price percentiles, not counts, so ties stay in one tier)
5. Recompute tiers every time the catalog refreshes
6. If a category has fewer than 6 items, fall back to these SGD guide thresholds:

| Category | Budget | Mid | Luxury |
|---|---|---|---|
| Top, bottom | < 80 | 80 to 200 | > 200 |
| Outerwear | < 150 | 150 to 400 | > 400 |
| Shoes | < 150 | 150 to 350 | > 350 |
| Watch | < 300 | 300 to 700 | > 700 |
| Accessories | < 50 | 50 to 150 | > 150 |

Log tier counts per category after every refresh so gaps are visible.

## 5b. Store list (`fixtures/stores.json`)

Candidate Singapore stores. Each must pass the `products.json` check before use.

**Shopify verification (all must pass, or the store is removed):**
1. `/products.json?limit=1` returns HTTP 200 with JSON shaped `{ products: [{ id, handle, variants: [{ id, price }], images: [...] }] }`
2. The response or homepage has at least one Shopify fingerprint: header `x-shopid`, `x-shopify-stage` or `powered-by: Shopify`; or homepage HTML containing `cdn.shopify.com`, `/cdn/shop/`, `Shopify.shop` or `shopify-digital-wallet`
3. A test cart permalink `https://{domain}/cart/{variantId}:1` resolves (HTTP 200 or a redirect to `/cart` or `/checkouts/`)

Record which fingerprint matched for each store in `fixtures/stores.json` (`"shopifyProof": "header x-shopid"`). Known confirmed: ruggedgentlemenshoppe.com and cufflinks.com.sg (Powered by Shopify footer, Shopify meta tags, cdn.shopify.com images).

**Removal rule:** if a store fails Shopify verification or returns no usable data (404, non-JSON, blocked, timeout after 2 retries, zero products or zero menswear products after filtering), remove it from `fixtures/stores.json` automatically and append it to `fixtures/stores-removed.json` with the reason and date. Never keep a failing store in the active list. Never try workarounds (HTML scraping, proxies, other endpoints) for a failing store.

| Domain | Name | Fills | Shopify likely |
|---|---|---|---|
| duxton.com | DUXTON | Tops, essentials | Check |
| ingoodcompany.asia | In Good Company | Tops, bottoms, outerwear | Check |
| kerbside-co.com | Kerbside & Co. | Tops, bottoms | Check |
| pharaohshorses.co | Pharaoh's Horses | Streetwear | Check |
| colonyclothing.net | Colony Clothing | Resort shirts, trousers | Check |
| benjaminbarker.co | Benjamin Barker | Smart casual, shirts, chinos | Check |
| the-shirt-bar.com | The Shirt Bar | Shirts | Check |
| white-ginger.com | White Ginger | Menswear, linen | Yes (`/collections/` URLs) |
| senjabalico.com | Senja Bali Co. | Linen shirts | Check |
| kevinseah.com | Kevin Seah | Luxury tailoring, shoes | Check |
| ruggedgentlemenshoppe.com | Rugged Gentlemen Shoppe | Denim, workwear, leather | Yes (`/blogs/` URLs) |
| cufflinks.com.sg | Cufflinks.com.sg | Luxury accessories | Yes (`/pages/` URLs) |
| boldrsupply.co | BOLDR | Watches | Check |
| TBD | Earnest & Collective | Leather shoes | Find domain |
| TBD | ORSQ | Sneakers | Find domain |

Not usable via `products.json`: Suitsupply (not Shopify). If shoes stay thin after the check, flag it before step 4.

### Image selection for try-on
For each product, ask Claude (vision) or use heuristics to pick the cleanest image: plain background, single garment, front view or flat lay. No model wearing other items. Skip products with no usable image.

## 6. Agent

Routes: `app/api/style`, `app/api/refine`, `app/api/swap`.

1. Parse occasion to `{ occasion, formality, setting, timeOfDay, budgetTier, maxBudget?, constraints[] }`
2. Skin analysis and skin tone (cached per selfie)
3. Select 2 to 3 coherent looks from in-stock catalog items matching tier, formality and occasion; colours complement skin tone
4. Render: clothes VTO, then hair, watch, beard
5. Fit Check: score out of 10 plus 1 to 2 sentences of reasoning
6. Prep plan: 3-step night-before grooming routine, no medical claims

Refine re-runs steps 3 to 5 with updated constraints. Swap returns alternatives for one slot and re-renders. Retry once on invalid LLM JSON.

## 7. Checkout

`https://{store}/cart/{variantId}:{qty},{variantId}:{qty}` per store. Cart groups items by store with one button each. Only in-stock variants are selectable.

## 8. Design direction

Follows the `design-taste-frontend` skill (tasteskill v2): its house rules win over older notes here. Direction dealt: "The object, large" (seed in `.taste-skill/direction.json`).

- **Feel:** the user's own render is the object, shown bigger than seems reasonable and cropped by the edges. Lead with real try-on imagery (before/after), not text
- **Theme:** dark only
- **Palette:** background `#0A0A0B`, surface `#141416`, raised `#1C1C1F`, text `#ECEBE8` (full ink for running text), muted `#9C978E` (secondary notes only), brass `#C8A96A` on the primary action and one other thing (the score), hover brass `#D9BD85`, success `#5FB58A`, danger `#E06C5F`. Surfaces separate by a tone step, never a line or shadow
- **Type:** two faces. Panchang 700 uppercase for display and section headings (tracking -0.02em, leading 1), Switzer 400/500 for everything else, self-hosted in `app/fonts/`. Five steps only: small, body (16px+), lead, head, display. Prices and scores use tabular figures, not monospace
- **Components:** one button (`.btn`): flat brass, square corners. Radius 0 everywhere. Text links underline on hover
- **Motion:** scroll-opening hero window (signature), masked headline line rise, staggered `data-reveal` / `data-shutter` entrances once per section, press and hover feedback, slider hint nudge. Transform and opacity only; reduced motion drops the travel and keeps the content
- **Layout:** designed at 390px first and composed again for desktop (full-width sections on one pair of margins, `--margin`); large tap targets (min 44px); headlines two lines or fewer at every width; a heading on every section
- **Banned (skill house rules):** glass / backdrop blur, gradients (except a neutral scrim over a photo), glows, shadows at rest, italic or coloured accent words in headlines, eyebrow labels, tiny uppercase tracked labels, monospace, 01/02/03 numbering, hairline dividers and 1px outlined boxes, rows of identical cards, emoji
- **Check:** `node ~/.agents/skills/design-taste-frontend/scripts/inspect.mjs <url>` on a production build (0 FAIL), then look at the screenshots
- No brand logos in our UI. Store names as plain text only

## 9. Privacy and content rules
- Selfies private, auto-deleted after 24 hours, with a "Delete my photo" button
- Store product images shown only as product cards linking to the store; renders are our output
- No medical claims in prep plans

## 10. Working rules
- **Commit after every step** with a clear message (`feat: style agent route`)
- **Time box:** if any task takes more than 2 hours, stop and tell me with options
- **Do not build:** auth, accounts, payments, admin panel, order history, analytics, i18n
- Prefer the simplest thing that works for the demo
- After each step: run it, run tests, tell me exactly what to check manually
- Ask before adding any dependency not listed above

## 11. Testing
- Vitest: cart permalink builder, tier assignment, image selection heuristics, all Zod schemas, unit guard
- Playwright: one smoke test of the full flow in `MOCK_YOUCAM=true` and `DEMO_MODE=true`

## 12. Demo mode (`DEMO_MODE=true`)
- Uses `fixtures/selfies/demo.jpg`, occasion "First date Friday night, rooftop bar, want to look effortless", Mid-range tier
- All renders served from cache; zero live YouCam calls
- Deterministic looks so the demo video and judges' first try never fail
- A "Try the demo" button on the home page

## 13. Hackathon submission
- Public GitHub repo, MIT license, all source
- Judge-first README (see step 12 prompt)
- Screenshots in `docs/screenshots/`
- Demo video 1 to 3 min on YouTube naming the YouCam APIs used
