/**
 * Captures every screen of the flow at 390px into docs/screenshots/.
 * Start the app first (npm run dev), then: npm run screenshots (--url for another server).
 * With MOCK_YOUCAM=true every try-on is the same saved sample; live renders of the demo photo
 * are cached, so a second run costs few or no units.
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";

const url = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:3000";
const OUT = "docs/screenshots";
const SLOW = 240_000; // the style agent streams its first look in 20 to 50 s, longer on a cold dev server

async function shot(page: Page, name: string, { settle = true } = {}) {
  // The style stream keeps the network busy, so the loading shot skips the idle wait
  if (settle) await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }); // dev badge
  await page.waitForTimeout(800); // let entrance motion settle
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}.png`);
}

async function backToLooks(page: Page) {
  await page.getByRole("button", { name: /Back to your looks|Keep the current/ }).click();
  await page.getByRole("button", { name: "Compare prices" }).first().waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(60_000);
  console.log(`Capturing ${url} at 390px`);

  await page.goto(url);
  await shot(page, "home");

  await page.goto(`${url}/style?o=date`);
  await page.locator("input[type=file]").setInputFiles("fixtures/selfies/demo.jpg");
  await page.getByRole("button", { name: "Use this photo" }).waitFor();
  await shot(page, "photo");

  await page.getByRole("button", { name: "Use this photo" }).click();
  await page.getByRole("heading", { level: 1, name: "The occasion" }).waitFor();
  await page.getByRole("radio", { name: "Mid-range" }).click();
  await shot(page, "occasion");

  await page.getByRole("button", { name: "Style me" }).click();
  await page.waitForTimeout(3_000);
  await shot(page, "loading", { settle: false });

  await page.getByRole("button", { name: "Compare prices" }).first().waitFor({ timeout: SLOW });
  await page.getByRole("button", { name: "Your night-before prep plan" }).waitFor({ timeout: SLOW });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "looks");

  await page.getByRole("button", { name: "Compare prices" }).first().click();
  await page.getByRole("button", { name: "Wear this version" }).first().waitFor({ timeout: SLOW });
  await page.getByText("Scoring…").first().waitFor({ state: "detached", timeout: SLOW });
  await shot(page, "compare");
  await backToLooks(page);

  await page.getByRole("button", { name: /^Swap the / }).first().click();
  await page.getByRole("heading", { name: "Alternatives" }).waitFor();
  await page.getByRole("list").locator("li button").first().waitFor({ timeout: SLOW });
  await shot(page, "swap");
  await backToLooks(page);

  await page.getByRole("button", { name: "Your night-before prep plan" }).click();
  await page.getByRole("heading", { level: 1, name: "The night before" }).waitFor();
  await shot(page, "prep");
  await backToLooks(page);

  await page.getByRole("button", { name: "Browse every piece" }).click();
  await page.getByText(/^\d+ pieces?$/).waitFor();
  await shot(page, "browse");
  await backToLooks(page);

  await page.getByRole("button", { name: "Add this look to cart" }).first().click();
  const cart = page.getByRole("heading", { level: 1, name: "Your cart" });
  if (!(await cart.isVisible())) await page.getByRole("button", { name: /View cart/ }).first().click();
  await cart.waitFor();
  // Pick the first in-stock size of each piece so every checkout button is live
  for (const group of await page.getByRole("radiogroup", { name: /^Size for / }).all()) {
    await group.getByRole("radio").first().click();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "cart");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
