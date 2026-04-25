import { test, expect } from '@playwright/test';

test.describe('Smoke — login flow', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('bad@bad.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Backend returns 401 → toast error appears
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 });
  });

  test('demo user can sign in and reach dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@apiforge.local');
    await page.getByLabel(/password/i).fill('apiforge123');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Should redirect away from /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });
});
