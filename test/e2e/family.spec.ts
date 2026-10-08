// TS-E-005 — profile switch (FR-PRO-001). Since the family screen landed, a
// switch is one tap on the person's tile plus their four-digit PIN — a
// door-latch, not a password — and the wrong PIN only asks again.

import { test, expect } from '@playwright/test';
import { addFamilyMember, blockSync } from './helpers';

test.beforeEach(async ({ page }) => {
  await blockSync(page);
});

test('TS-E-005: a new kid lands in Explorer, and their tile plus PIN brings them back', async ({ page }) => {
  await addFamilyMember(page, 'Mia', 'Kid', '1234');
  await expect(page.getByRole('heading', { name: 'What shall we play?' })).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: 'Mia' }).click();
  const pin = page.getByLabel('Type your PIN');

  await pin.fill('9999');
  await expect(page.getByRole('status')).toHaveText('Not that one. Try again.');
  await expect(page).toHaveURL(/\/$/);

  await pin.fill('1234');
  await page.waitForURL('**/explorer');
});

test('TS-E-005: an adult goes to Studio, and each person keeps their own tile', async ({ page }) => {
  await addFamilyMember(page, 'Mia', 'Kid', '1234');
  await addFamilyMember(page, 'Sam', 'Adult', '4321');

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Mia' })).toBeVisible();
  await page.getByRole('button', { name: 'Sam' }).click();
  await page.getByLabel('Type your PIN').fill('4321');
  await page.waitForURL('**/studio');
});
