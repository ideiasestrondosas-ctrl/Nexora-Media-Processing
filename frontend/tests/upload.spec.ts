import { test, expect } from '@playwright/test';

test('navigate to upload and show drag zone', async ({ page }) => {
  await page.goto('/');

  // Navigates using sidebar
  await page.click('text=Upload');

  // Verify page title
  await expect(page.locator('h1')).toContainText('Novo Asset');

  // Verify upload zone text
  await expect(page.getByText('Arrasta e Larga o teu media aqui')).toBeVisible();
});
