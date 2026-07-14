import { test, expect } from "@playwright/test";

test.describe("CRO Audit AI - smoke", () => {
  test("landing page renders hero and URL input", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Isn't Converting/i })
    ).toBeVisible();
    await expect(page.getByPlaceholder(/Enter your website URL/i)).toBeVisible();
  });

  test("rejects an obviously invalid URL", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/Enter your website URL/i).fill("not a url");
    await page.getByRole("button", { name: /Analyze/i }).first().click();
    // Either an inline validation error or the API rejects it.
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
  });

  test("navigates to the sign in page", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: /Welcome back/i })
    ).toBeVisible();
  });
});
