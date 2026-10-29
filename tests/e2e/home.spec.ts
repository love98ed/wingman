import { expect, test } from "@playwright/test";

test("home renders themed at phone width", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("See it");
  await expect(page.getByRole("slider", { name: /Compare original photo/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Style me" }).first()).toHaveAttribute("href", "/style");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(10, 10, 11)");
});

test("occasion list drives the primary action", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Wedding guest" }).click();
  const cta = page.getByRole("link", { name: /Style me for the wedding/ });
  await expect(cta).toHaveAttribute("href", "/style?o=wedding");
  await cta.click();
  await expect(page.getByRole("heading", { level: 1, name: "Your photo" })).toBeVisible();
  await expect(page).toHaveURL(/\/style\?o=wedding/);
});

test("photo then occasion, with the occasion carried over", async ({ page }) => {
  await page.goto("/style?o=wedding");
  await expect(page.getByRole("button", { name: "Use this photo" })).toHaveCount(0);
  await page.locator("input[type=file]").setInputFiles("fixtures/selfies/demo.jpg");
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "The occasion" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wedding guest" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox")).toHaveValue(/wedding/i);
  await page.getByRole("radio", { name: "Luxury" }).click();
  await expect(page.getByRole("radio", { name: "Luxury" })).toHaveAttribute("aria-checked", "true");
});

test("the old /occasion link redirects to the flow", async ({ page }) => {
  await page.goto("/occasion?o=cny");
  await expect(page).toHaveURL(/\/style\?o=cny/);
});
