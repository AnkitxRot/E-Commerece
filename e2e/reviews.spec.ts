import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@audiocommerce.demo';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!Dev123';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test('customer submits a review, admin approves it, then it is publicly visible', async ({ page, browser }) => {
  const email = `e2e-review-${Date.now()}@example.com`;
  const reviewBody = `Excellent build quality, e2e run ${Date.now()}.`;

  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E Reviewer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto('/p/helix-lineage');
  await expect(page.getByRole('heading', { name: 'Helix Lineage' })).toBeVisible();

  await page.getByRole('radio', { name: '5 of 5 stars' }).click();
  await page.getByLabel('Your review').fill(reviewBody);
  await page.getByRole('button', { name: 'Submit review' }).click();
  await expect(page.getByText('Thanks — your review is awaiting approval.')).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).first().click();
  await loginAsAdmin(page);

  await page.goto('/admin/reviews');
  const row = page.getByRole('listitem').filter({ hasText: reviewBody });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /Approve review/ }).click();
  await expect(page.getByText('Review approved')).toBeVisible();

  // Verified from a brand-new, never-authenticated browser context rather than
  // reusing `page` — the storefront's product-detail response is deliberately
  // sent with `Cache-Control: public, max-age=15` (see cacheControl.ts), and
  // `page` already has a cached response from the earlier visit above. A
  // fresh context has no such cache, so this is a genuine "new visitor" check
  // rather than one that happens to race the cache's freshness window.
  const visitorPage = await (await browser.newContext()).newPage();
  await visitorPage.goto('/p/helix-lineage');
  await expect(visitorPage.getByText(reviewBody)).toBeVisible();
});

test('review submission requires login', async ({ page }) => {
  await page.goto('/p/helix-lineage');
  await expect(page.getByText('Log in to write a review.')).toBeVisible();
});
