import { expect, test } from "@playwright/test";

test("home renders themed at phone width", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dressed for");
  await expect(page.getByRole("slider", { name: /Compare original photo/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /try the demo/i })).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(10, 10, 11)");
});

test("occasion chips drive the primary action", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Wedding guest" }).click();
  const cta = page.getByRole("link", { name: /Style me for the wedding/ });
  await expect(cta).toHaveAttribute("href", "/occasion?o=wedding");
  await cta.click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/occasion/);
});
