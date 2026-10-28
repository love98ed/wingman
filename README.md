# Wingman

Tell Wingman the occasion and see yourself ready: a full look from real stores, styled on your photo and one tap from checkout.

Wingman is an AI occasion stylist for men, built for the YouCam API Skin AI & eCommerce VTO Hackathon (Perfect Corp, Devpost).

> **Status: in progress.** The app shell, the database schema and the YouCam client are built. The catalog, the style agent and the main screens are next. See [Roadmap](#roadmap).

## How it works

1. **Upload one photo.** A waist-up, front-facing shot.
2. **Describe the occasion.** One sentence (for example "First date Friday night, rooftop bar, want to look effortless") and a budget tier.
3. **Get 2 to 3 full looks.** Each look uses real products from Singapore Shopify stores and is rendered on your photo. Each one comes with a Fit Check score and a night-before grooming plan.
4. **Refine and buy.** Swap items, refine by chat, pick an in-stock size and tap checkout to open each store's cart pre-filled.

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

### Unit guard and cache

- Every live YouCam call reserves its units in Supabase first. Wingman refuses any call that would pass `YOUCAM_UNIT_LIMIT` (700 by default).
- YouCam only charges for successful tasks, so failed calls release their units. Timeouts keep them reserved because the task may still finish.
- Results are cached by photo, product, API and settings. A repeat request costs zero units.
- `MOCK_YOUCAM=true` serves saved responses from `fixtures/youcam/` so UI work costs nothing.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict |
| Styling | Tailwind CSS 4 + shadcn/ui, dark luxe theme, Instrument Serif + Geist fonts |
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

```bash
npm run dev
```

Open http://localhost:3000. The UI is designed for a 390px phone screen first.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Smoke test in a phone-sized browser (Playwright) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run youcam:smoke` | One real call per YouCam API on `fixtures/selfies/demo.jpg`. Saves responses for mock mode and prints units used. A second run costs zero units. |

## Project structure

```
app/                     Pages and API routes
components/ui/           shadcn/ui components
lib/
  env.ts                 Server env, validated with Zod
  hash.ts                Shared sha256 helper
  llm/                   Claude model config and JSON-output helper
  photo/                 Face box and crops for each YouCam API
  supabase/              Server client (service role)
  youcam/                YouCam client, unit guard, render cache, mock mode
scripts/                 Command-line scripts (run with tsx)
supabase/migrations/     Database schema
fixtures/                Demo photo, saved YouCam responses, store list
tests/
  unit/                  Vitest, mirrors lib/
  e2e/                   Playwright
```

## Privacy

- Photos are stored in a private bucket and deleted after 24 hours. A "Delete my photo" button removes them sooner.
- Every API key stays on the server.
- Store product images appear only as product cards linking back to the store.
- Grooming plans make no medical claims.

## Roadmap

- [x] Scaffold, theme and database schema
- [x] YouCam client with unit guard, render cache and mock mode
- [ ] First real YouCam run and saved fixtures (waiting on a demo photo)
- [ ] Store checks and catalog pipeline
- [ ] Style agent (occasion parsing, look selection, Fit Check, prep plan)
- [ ] Core screens
- [ ] Budget tiers and price compare
- [ ] Refine and swap
- [ ] Cart and checkout
- [ ] Prep plan and browse screens
- [ ] Demo mode and photo auto-delete
- [ ] Polish and deploy

## License

MIT
