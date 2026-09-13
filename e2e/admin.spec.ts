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

test('admin can view the dashboard and update an order status', async ({ page }) => {
  const email = `e2e-admin-order-${Date.now()}@example.com`;

  // A customer places a fresh order the admin can then manage.
  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E Order Customer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto('/p/aurelia-nova');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText('Added 1 to your cart')).toBeVisible();
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Proceed to checkout' }).click();
  await page.getByLabel('Full name').fill('E2E Order Customer');
  await page.getByLabel('Address line 1').fill('221B Baker Street');
  await page.getByLabel('City').fill('Mumbai');
  await page.getByLabel('State').fill('Maharashtra');
  await page.getByLabel('Postal code').fill('400001');
  await page.getByLabel('Phone').fill('9876543210');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page).toHaveURL(/\/orders\/.+\?confirmed=1$/);

  await page.getByRole('button', { name: 'Log out' }).first().click();
  await loginAsAdmin(page);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Recent orders')).toBeVisible();

  await page.goto('/admin/orders');
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toBeVisible();
  await row.getByRole('link').first().click();

  await expect(page.getByText(email)).toBeVisible();
  await page.getByLabel('Update status').selectOption('PROCESSING');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('PROCESSING', { exact: true })).toBeVisible();
});

test('admin can create a new product', async ({ page }) => {
  await loginAsAdmin(page);
  const unique = Date.now();

  await page.goto('/admin/products/new');
  await page.getByLabel('Name', { exact: true }).fill(`E2E Test Speaker ${unique}`);
  await page.getByLabel('Description').fill('A speaker created by an end-to-end test.');
  await page.getByLabel('Category').selectOption({ index: 1 });
  await page.getByLabel('Base price (₹)').fill('4999.00');
  await page.getByLabel('SKU').fill(`E2E-SKU-${unique}`);
  await page.getByLabel('Stock quantity').fill('15');
  await page.getByRole('button', { name: 'Create product' }).click();

  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByRole('link', { name: `E2E Test Speaker ${unique}` })).toBeVisible();
});

test('admin can create a category and a brand, use them on a product, then deactivate the category', async ({
  page,
}) => {
  await loginAsAdmin(page);
  const unique = Date.now();
  const categoryName = `E2E Category ${unique}`;
  const brandName = `E2E Brand ${unique}`;

  await page.goto('/admin/categories');
  await page.getByLabel('Name', { exact: true }).fill(categoryName);
  await page.getByRole('button', { name: 'Create category' }).click();
  await expect(page.getByText('Category created')).toBeVisible();
  await expect(page.getByRole('cell', { name: categoryName })).toBeVisible();

  await page.goto('/admin/brands');
  await page.getByLabel('Name', { exact: true }).fill(brandName);
  await page.getByRole('button', { name: 'Create brand' }).click();
  await expect(page.getByText('Brand created')).toBeVisible();
  await expect(page.getByRole('cell', { name: brandName })).toBeVisible();

  await page.goto('/admin/products/new');
  await page.getByLabel('Name', { exact: true }).fill(`E2E Category Product ${unique}`);
  await page.getByLabel('Description').fill('A product created to exercise category/brand selection.');
  await page.getByLabel('Category').selectOption({ label: categoryName });
  await page.getByLabel('Brand (optional)').selectOption({ label: brandName });
  await page.getByLabel('Base price (₹)').fill('2999.00');
  await page.getByLabel('SKU').fill(`E2E-CAT-SKU-${unique}`);
  await page.getByLabel('Stock quantity').fill('5');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByRole('link', { name: `E2E Category Product ${unique}` })).toBeVisible();

  await page.goto('/admin/categories');
  const row = page.getByRole('row').filter({ hasText: categoryName });
  await row.getByRole('button', { name: 'Deactivate' }).click();
  await expect(row.getByText('Inactive')).toBeVisible();

  // The public storefront nav (built from the active-only category tree) no longer links to it.
  await page.goto('/');
  await expect(page.getByRole('link', { name: categoryName })).toHaveCount(0);
});
