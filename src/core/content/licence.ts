// TA-CNT-005 — licence gate. The full ingest pipeline is out of scope for
// Sprint 1 (US-1.13's tune is hand-authored, not ingested), but the rule that
// every piece needs a verifiable licence entry is a CLAUDE.md product rule,
// not a pipeline implementation detail — so it is enforced here too.

export interface LicenceEntry {
  licenceId: string;
  work: string;
  status: 'public-domain' | 'cc0' | 'cc-by' | 'cc-by-sa' | 'licensed';
  sourceUrl: string;
  verifiedDate: string; // ISO date
}

export function findLicence(
  licenceId: string,
  licences: readonly LicenceEntry[],
): LicenceEntry | undefined {
  return licences.find((l) => l.licenceId === licenceId);
}

export function assertLicenced(licenceId: string, licences: readonly LicenceEntry[]): LicenceEntry {
  const entry = findLicence(licenceId, licences);
  if (!entry) {
    throw new Error(`TA-CNT-005: no licence entry for "${licenceId}" in content/licences.json`);
  }
  return entry;
}
