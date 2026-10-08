// TS-E-004 — completing a section unlocks the next node (FR-PRO-002). The
// finished attempt is seeded into IndexedDB rather than played: there is no
// mock MIDI backend yet, so TS-E-003 (playing a section and watching the star
// land) is still open.

import { test, expect, type Page } from '@playwright/test';
import { addFamilyMember, blockSync, seedAttempts } from './helpers';

const ARRANGEMENT = 'hot-cross-buns-d1';

function stop(page: Page, label: string) {
  return page.getByRole('listitem').filter({ hasText: label });
}

test.beforeEach(async ({ page }) => {
  await blockSync(page);
});

test('TS-E-004: a fresh map opens on the first stop with everything after it locked', async ({ page }) => {
  await addFamilyMember(page, 'Mia', 'Kid', '1234');
  await page.getByRole('link', { name: 'Hot Cross Buns', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quest Map' })).toBeVisible();

  await expect(stop(page, 'Bars 1–2')).toContainText('Start here');
  await expect(page.getByRole('link', { name: /Bars 1–2/ })).toBeVisible();
  for (const label of ['Bars 3–4', 'Bars 5–6', 'Bars 7–8']) {
    await expect(stop(page, label)).toContainText('Locked');
    await expect(page.getByRole('link', { name: new RegExp(label) })).toHaveCount(0);
  }
});

test('TS-E-004: a starred section unlocks the next stop and shows its stars', async ({ page }) => {
  const profileId = await addFamilyMember(page, 'Mia', 'Kid', '1234');
  await seedAttempts(page, [
    { id: 'e2e-1', profileId, arrangementId: ARRANGEMENT, sectionId: 'bars-1-2', stars: 2 },
  ]);
  await page.goto(`/explorer/${ARRANGEMENT}`);

  await expect(stop(page, 'Bars 1–2')).toContainText('Play again');
  await expect(stop(page, 'Bars 1–2').getByRole('img', { name: '2 of 3 stars' })).toBeVisible();
  await expect(stop(page, 'Bars 3–4')).toContainText('Start here');
  await expect(page.getByRole('link', { name: /Bars 3–4/ })).toHaveAttribute(
    'href',
    `/explorer/play/${ARRANGEMENT}?section=bars-3-4`,
  );
  await expect(stop(page, 'Bars 5–6')).toContainText('Locked');
});

test('TS-E-004: clearing every quest stop unlocks the reward', async ({ page }) => {
  const profileId = await addFamilyMember(page, 'Mia', 'Kid', '1234');
  await seedAttempts(
    page,
    ['bars-1-2', 'bars-3-4', 'bars-5-6', 'bars-7-8'].map((sectionId, i) => ({
      id: `e2e-${i}`,
      profileId,
      arrangementId: ARRANGEMENT,
      sectionId,
      stars: 1 as const,
    })),
  );
  await page.goto(`/explorer/${ARRANGEMENT}`);

  const reward = page.getByRole('listitem').last();
  await expect(reward).toContainText('Hot Cross Buns');
  await expect(reward).toContainText('Reward');
  await expect(reward.getByRole('link')).toBeVisible();
});

test('TS-E-004: another family member’s stars do not unlock this map', async ({ page }) => {
  await addFamilyMember(page, 'Sam', 'Adult', '4321');
  const samId = await page.evaluate(() => window.localStorage.getItem('duokeys.activeProfileId'));
  await addFamilyMember(page, 'Mia', 'Kid', '1234');
  await seedAttempts(page, [
    { id: 'e2e-sam', profileId: samId ?? 'missing', arrangementId: ARRANGEMENT, sectionId: 'bars-1-2', stars: 3 },
  ]);
  await page.goto(`/explorer/${ARRANGEMENT}`);

  await expect(stop(page, 'Bars 1–2')).toContainText('Start here');
  await expect(stop(page, 'Bars 3–4')).toContainText('Locked');
});
