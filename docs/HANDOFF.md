# Wingman: handoff for teammates

Read this first, then `CLAUDE.md` (the project rules) and `STEP_PROMPTS.md` (the build plan).

**Deadline:** 3 Nov 2026, 12:45am SGT
**Live site:** https://wingman-eight-beta.vercel.app
**Repo:** https://github.com/love98ed/wingman (private)

## Where things stand (28 Oct, evening)

| Step | Status |
|---|---|
| 0. Plan | Done |
| 1. Scaffold | Done |
| 2. YouCam client | Done. 19 of 700 YouCam units used |
| 3. Catalog | **In progress.** 17 stores verified. Catalog fetch paused: 8 of 17 stores fully tagged and cached, Rugged Gentlemen about half done, 8 not started. Nothing is in the database yet |
| Home page redesign | Done and live (dark luxe theme) |
| 4 to 12 | Not started |

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
5. **Optional, for building with Claude Code:** install Claude Code and open it in the `wingman` folder. It reads `CLAUDE.md` automatically. Paste one prompt from `STEP_PROMPTS.md` at a time and check the result before the next.

## 2. Next job: finish the catalog (step 3)

1. **Use home Wi-Fi or a phone hotspot.** Shopify blocks product feeds on some networks (it did on the office network). Quick test, which should print `200`:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" "https://duxton.com/products.json?limit=1"
   ```
   If it prints `429`, switch networks.
2. **Pull the latest code and cache:** `git pull`
3. **Run the fetch:**
   ```bash
   npm run catalog:fetch
   ```
   - It resumes from `fixtures/catalog-cache/`: finished stores are skipped in seconds, Rugged Gentlemen continues where it stopped, then it does the 8 stores not started (Cufflinks.com.sg, BOLDR, WHY&CO, Arden Teal, The Jacket Maker, Zelos, Vario, Red Army Watches). Duxton gets re-tagged once (about 2 minutes) because its cache came from an older copy of the feed.
   - Expect about 30 to 40 minutes and about US$1 of Claude usage. No YouCam units are used.
   - It prints progress (`tagged 75/120`, `images 40/88`). If it stops or you press Ctrl+C, run the same command again and it picks up where it left off.
4. **Read the two tables at the end:**
   - Products kept per store
   - In-stock items per category and tier, plus a "Gaps" line. Step 3 is done when tops, bottoms and shoes each have at least 5 items per tier and there are at least 3 watches.
5. **Commit the updated cache** so nobody repeats the work:
   ```bash
   git add fixtures/catalog-cache
   git commit -m "chore: catalog cache after full fetch"
   git push
   ```
6. Share the two tables with the team. If there are gaps, decide which store to add before step 4.

**Only one person runs `catalog:fetch` at a time.** Everyone shares the same database and cache files.

## 3. After that: steps 4 to 12

Work through `STEP_PROMPTS.md` in order. Each step ends with a commit and a list of things to check by hand. Pull before you start and push when you finish. Tell the group which step you're on so two people don't do the same one.

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
