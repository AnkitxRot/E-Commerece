import { expect, test } from '@playwright/test';

test('registers, adds an in-stock product to cart, and completes demo checkout', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E Shopper');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto('/p/aurelia-nova');
  await expect(page.getByRole('heading', { name: 'Aurelia Nova' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText('Added 1 to your cart')).toBeVisible();

  await page.goto('/cart');
  await expect(page.getByText('Aurelia Nova')).toBeVisible();
  await page.getByRole('button', { name: 'Proceed to checkout' }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await page.getByLabel('Full name').fill('E2E Shopper');
  await page.getByLabel('Address line 1').fill('221B Baker Street');
  await page.getByLabel('City').fill('Mumbai');
  await page.getByLabel('State').fill('Maharashtra');
  await page.getByLabel('Postal code').fill('400001');
  await page.getByLabel('Phone').fill('9876543210');
  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page).toHaveURL(/\/orders\/.+\?confirmed=1$/);
  await expect(page.getByText(/your order is confirmed/i)).toBeVisible();
  await expect(page.getByText('Aurelia Nova')).toBeVisible();

  await page.goto('/account/orders');
  await expect(page.getByRole('link', { name: /Order #/ })).toBeVisible();
});

test('cart requires login', async ({ page }) => {
  await page.goto('/cart');
  await expect(page).toHaveURL(/\/login$/);
});
