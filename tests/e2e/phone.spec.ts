import path from 'node:path';
import { expect, test } from '@playwright/test';

test('phone: register with name, department and selfie, answer, see thanks', async ({ page }) => {
  await page.goto('/e/dev');
  await page.getByRole('button', { name: /join event|continue/i }).click();

  await page.getByPlaceholder('Your name').fill('E2E Tester');
  // Searchable department: type part of the name, pick the suggestion.
  await page.getByPlaceholder('Search your department').fill('quality');
  await page.getByRole('option', { name: 'Quality Assurance' }).click();
  await expect(page.getByPlaceholder('Search your department')).toHaveValue('Quality Assurance');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /add your selfie/i }).click();
  await (await chooser).setFiles(path.join(__dirname, 'fixtures', 'selfie.jpg'));
  await page.getByRole('button', { name: /^submit$/i }).click();
  await expect(page.getByText(/look at the big screen/i)).toBeVisible({ timeout: 30_000 });

  // All questions on one page: pick the first option of each, then submit once.
  await expect(page.getByText('Question 1 of 5')).toBeVisible({ timeout: 10_000 });
  for (let i = 1; i <= 5; i++) {
    await page.locator('section', { hasText: `Question ${i} of 5` }).locator('button[aria-pressed]').first().click();
  }
  await page.getByRole('button', { name: /submit answers/i }).click();
  await expect(page.getByText(/thank you/i)).toBeVisible({ timeout: 20_000 });
});
