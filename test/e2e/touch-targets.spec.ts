// TS-E-014 — every interactive target is at least 44 px in both directions
// (NFR-009), checked on the screens a child taps through before the piano
// matters: the family screen, the add form, the piece list and the quest map.

import { test, expect, type Page } from '@playwright/test';
import { addFamilyMember, blockSync } from './helpers';

const MIN_PX = 44;

async function undersizedTargets(page: Page): Promise<string[]> {
  return page.evaluate((min) => {
    const targets = document.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="radio"]',
    );
    const small: string[] = [];
    for (const el of targets) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue; // not rendered
      // Half a pixel of slack for sub-pixel layout rounding.
      if (box.width < min - 0.5 || box.height < min - 0.5) {
        const name = el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName;
        small.push(`${el.tagName.toLowerCase()} "${name.slice(0, 40)}" ${Math.round(box.width)}×${Math.round(box.height)}`);
      }
    }
    return small;
  }, MIN_PX);
}

test.beforeEach(async ({ page }) => {
  await blockSync(page);
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test(`TS-E-014: Explorer path targets are ≥ ${MIN_PX} px at ${viewport.width} wide`, async ({ page }) => {
    await page.setViewportSize(viewport);

    await page.goto('/');
    await page.getByRole('button', { name: '+ New family member' }).waitFor();
    expect(await undersizedTargets(page), 'family screen').toEqual([]);

    await page.getByRole('button', { name: '+ New family member' }).click();
    expect(await undersizedTargets(page), 'add form').toEqual([]);

    await addFamilyMember(page, 'Mia', 'Kid', '1234');
    await page.getByRole('link', { name: 'Hot Cross Buns', exact: true }).waitFor();
    expect(await undersizedTargets(page), 'piece list').toEqual([]);

    await page.getByRole('link', { name: 'Hot Cross Buns', exact: true }).click();
    await page.getByRole('heading', { name: 'Quest Map' }).waitFor();
    expect(await undersizedTargets(page), 'quest map').toEqual([]);
  });
}
