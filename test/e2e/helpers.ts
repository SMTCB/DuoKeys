// Shared steps for the TS-E-* end-to-end scenarios (docs/04-TEST-SCENARIOS.md § 10).
//
// Every test starts from an empty browser profile, so IndexedDB and
// localStorage are fresh. Supabase is cut off at the network layer: a local
// `.env.local` may point at the real project, and a test must never push a
// made-up family member into it. The app treats the network as optional
// (ADR-003), so nothing on these paths should notice.

import { expect, type Page } from '@playwright/test';

export async function blockSync(page: Page): Promise<void> {
  await page.route(/supabase\.co/, (route) => route.abort());
}

/** Creates a family member from the home screen and returns its profile id. */
export async function addFamilyMember(
  page: Page,
  displayName: string,
  role: 'Kid' | 'Adult',
  pin: string,
): Promise<string> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Who's playing?" })).toBeVisible();
  await page.getByRole('button', { name: '+ New family member' }).click();
  await page.getByRole('radio', { name: role }).click();
  await page.getByLabel('Name').fill(displayName);
  await page.getByLabel(/digit PIN/).fill(pin);
  await page.getByRole('button', { name: 'Add' }).click();
  await page.waitForURL(role === 'Kid' ? '**/explorer' : '**/studio');
  const id = await page.evaluate(() => window.localStorage.getItem('duokeys.activeProfileId'));
  if (!id) throw new Error('addFamilyMember: no active profile id after Add');
  return id;
}

export interface SeededAttempt {
  id: string;
  profileId: string;
  arrangementId: string;
  sectionId: string;
  stars: 0 | 1 | 2 | 3;
}

/**
 * Writes finished attempts straight into IndexedDB, standing in for a played
 * section until a mock MIDI backend exists. Only the fields progression reads
 * are meaningful; the rest are plausible fillers.
 */
export async function seedAttempts(page: Page, attempts: SeededAttempt[]): Promise<void> {
  await page.evaluate(async (rows) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('duokeys');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('attempts', 'readwrite');
      const store = tx.objectStore('attempts');
      for (const row of rows) {
        store.put(
          {
            id: row.id,
            profileId: row.profileId,
            arrangementId: row.arrangementId,
            sectionId: row.sectionId,
            startedAt: '2026-10-08T12:00:00.000Z',
            durationMs: 20000,
            mode: 'wait',
            tempoScale: 1,
            grade: { stars: row.stars, perNote: [] },
            events: [],
            appVersion: 'e2e',
          },
          row.id,
        );
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, attempts);
}
