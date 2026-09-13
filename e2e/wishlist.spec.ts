import { expect, test } from '@playwright/test';

test('registers, adds a product to the wishlist, then removes it', async ({ page }) => {
  const email = `e2e-wishlist-${Date.now()}@example.com`;

  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E Wishlister');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto('/p/aurelia-nova');
  await expect(page.getByRole('heading', { name: 'Aurelia Nova' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to wishlist' }).first().click();
  await expect(page.getByRole('button', { name: 'Remove from wishlist' }).first()).toBeVisible();

  await page.goto('/wishlist');
  await expect(page.getByRole('link', { name: /Aurelia Nova/ })).toBeVisible();

  await page.getByRole('button', { name: 'Remove from wishlist' }).first().click();
  await expect(page.getByText('Your wishlist is empty')).toBeVisible();
});

test('wishlist requires login', async ({ page }) => {
  await page.goto('/wishlist');
  await expect(page).toHaveURL(/\/login$/);
});
