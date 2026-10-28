import { expect, test } from "@playwright/test";

test("home renders themed at phone width", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("occasion");
  await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(14, 15, 17)");
});
