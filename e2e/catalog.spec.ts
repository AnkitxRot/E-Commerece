import { expect, test } from '@playwright/test';

test('home shows seeded featured nova', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /nova/i }).first()).toBeVisible();
});

test('product detail shows known SKU', async ({ page }) => {
  await page.goto('/p/aurelia-nova');
  await expect(page.getByText('NOV-BLK-00')).toBeVisible();
});

test('search finds nova by SKU fragment', async ({ page }) => {
  await page.goto('/products?q=NOV-BLK');
  await expect(page.getByRole('link', { name: /nova/i })).toBeVisible();
});

test('draft slug is not found', async ({ page }) => {
  await page.goto('/p/aurelia-lab-prototype');
  await expect(page.getByText(/not found/i)).toBeVisible();
});
