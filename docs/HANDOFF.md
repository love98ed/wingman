# Wingman: handoff for teammates

Read this first, then `CLAUDE.md` (the project rules) and `docs/STEP_PROMPTS.md` (the build plan).

**Deadline:** 3 Nov 2026, 12:45am SGT
**Live site:** https://wingman-eight-beta.vercel.app
**Repo:** https://github.com/love98ed/wingman (private)

## Where things stand (28 Oct, evening)

| Step | Status |
|---|---|
| 0. Plan | Done |
| 1. Scaffold | Done |
| 2. YouCam client | Done. 19 of 700 YouCam units used |
| 3. Catalog | Done. 4,983 products from 17 stores in Supabase; every tier has 60+ in-stock tops, bottoms, shoes and watches. Tops and outerwear take their colour from the try-on photo |
| Home page redesign | Done and live (design-taste-frontend direction) |
| 4. Style agent | Done. `POST /api/style` returns 2 to 3 looks with renders, Fit Check, totals and prep plan. Try it with `npm run style:demo` |
| 5. Core screens | Done. `/style`: photo, occasion, streamed loading, swipeable looks with Fit Check. Works in mock mode and with real renders |
| 6. Price compare | Done. "Compare prices" on each look shows it at Budget, Mid-range and Luxury side by side, tried on, with real SGD totals; "Wear this version" swaps the look. `npm run style:demo -- --compare` |
| 7. Refine and swap | Done. A chat bar under the looks re-picks all of them ("More casual", "Under S$500", "No white sneakers"); Swap on any piece offers 6 alternatives and tries the look on again. `npm run style:demo -- --refine "more casual" --swap shoes`. 62 of 700 YouCam units used |
| 8. Cart and checkout | Done. "Add this look to cart" on each look; the cart groups pieces by store, offers only in-stock sizes, and "Checkout at {store}" opens that store's cart pre-filled (checked against the live carts of Colony Clothing, Senja Bali Co. and Arden Teal) |
| 9. Prep plan and browse | Done. "Your night-before prep plan" under the looks shows the 3 grooming steps (general when skin analysis couldn't read the photo). "Browse every piece" lists the in-stock catalog with category, budget, price, colour, size and store filters; a piece can go into any look (re-tried on and scored) or the cart |
| 10. Demo mode and privacy | Demo mode dropped (every visitor uses their own selfie, live renders). Renders and cached results are deleted after 24 hours; "Delete my photo" under the looks deletes them at once |
| 11. Polish and deploy | Done. Every screen checked at 390px and 1280px; no API keys in the browser bundle; live site tested end to end (looks, compare, swap, prep, browse, refine, cart) and both checkout links opened real store carts with the exact items |
| 12. README and submission | Done. Judge-first README, screenshots in `docs/screenshots/`, MIT license |

## 1. Get set up (once)

1. **Ask Ritish for access:**
   - GitHub: to be added as a collaborator on the private repo
   - The values for `.env.local`, sent privately (never commit them, never paste them into a chat or an AI tool)
   - Supabase and Vercel access, only if you need the dashboards
2. **Install:** Node 20 or newer and git.
3. **Clone and install:**
   ```bash
   git clone https://github.com/love98ed/wingman.git
   cd wingman
   npm install
   cp .env.example .env.local    # then paste in the values from Ritish
   ```
4. **Check it works:**
   ```bash
   npm test          # all unit tests should pass
   npm run dev       # open http://localhost:3000 at phone width in DevTools
   ```
5. **Optional, for building with Claude Code:** install Claude Code and open it in the `wingman` folder. It reads `CLAUDE.md` automatically. Paste one prompt from `docs/STEP_PROMPTS.md` at a time and check the result before the next.

## 2. Refreshing the catalog

Stock, prices and sizes are as fresh as the last `npm run catalog:fetch`. To refresh:

1. **Use home Wi-Fi or a phone hotspot.** Shopify blocks product feeds on some networks. This should print `200` (a `429` means switch networks):
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" "https://duxton.com/products.json?limit=1"
   ```
2. **Run it:** `npm run catalog:fetch`. Claude's tags and image picks are kept in the `catalog_tags` table, so only new or changed products are tagged, and an interrupted run picks up where it stopped. No YouCam units are used.
3. **Read the two tables at the end:** products kept per store, then in-stock items per category and tier with a "Gaps" line.

**Only one person runs `catalog:fetch` at a time.** Everyone shares the same database.

## 3. After that: steps 4 to 12

Work through `docs/STEP_PROMPTS.md` in order. Each step ends with a commit and a list of things to check by hand. Pull before you start and push when you finish. Tell the group which step you're on so two people don't do the same one.

## Rules that matter

- **YouCam units are limited.** Hard cap of 700 (`YOUCAM_UNIT_LIMIT`), 19 used so far. Keep `MOCK_YOUCAM=true` for all UI work; it uses saved responses and costs nothing. Only run `npm run youcam:smoke` or real renders when you need them.
- **Secrets never go in git.** `.env.local` is ignored; keep it that way.
- **Garment photos must show no bare skin.** YouCam copies a model's bare arms (tattoos included) onto the user. The catalog already filters these out; don't work around it.
- **Skin analysis needs a straight-on, neutral face,** mouth closed. A tilted or grinning photo fails.
- **A 429 from Shopify means our network is rate-limited,** not that the store is broken. Never remove a store for a 429.
- **Don't script lots of requests at the live site.** Vercel's bot protection starts blocking the network (you'll see a "Security Checkpoint" page).
- **Design:** dark luxe, described in `CLAUDE.md` section 8. Reuse the existing components and tokens.
- **README style:** no em dashes, no comma before "and" or "or".

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm test` | Unit tests |
| `npm run test:e2e` | Browser smoke test (Playwright) |
| `npm run typecheck` / `npm run lint` | Checks before committing |
| `npm run stores:check` | Re-verify the store list (about 5 min, needs a non-blocked network) |
| `npm run catalog:fetch` | Build or refresh the catalog (resumable) |
| `npm run photo:check -- path/to/photo.jpg` | Check a photo's face crops before spending YouCam units |
| `npm run youcam:smoke` | One real call per YouCam API (costs units; a second run is free from cache) |

## Open items

- **Demo photo:** `fixtures/selfies/demo.jpg` is a Pexels placeholder. Ritish will replace it with their own photo before the demo video (waist-up, glasses off, plain wall, neutral face, original file not a WhatsApp copy).
- **Store terms:** nobody has checked yet whether any store's terms forbid reusing product images or data (checklist item 6).
- **LICENSE file:** needs the copyright holder's name.
- **Known quirk:** the hair render slightly lightens skin tone. Watch for it on the real photo.
