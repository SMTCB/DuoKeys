// TA-CNT-007 (ADR-010) — the optional local score reader. A PDF or a picture of a score is sent
// to the Audiveris service from `tools/omr` running on this same machine (Docker, port 8765),
// and the MusicXML that comes back goes through the same import as any other score. The
// service is never needed to practise: if it is not running, the caller is told so and the
// app carries on. The page is not sent anywhere but localhost.

import { mxlToMusicXml } from './mxl';

export const OMR_ENDPOINT = 'http://localhost:8765';
export const MAX_SCAN_BYTES = 20 * 1024 * 1024;
const HEALTH_TIMEOUT_MS = 1500;
const CONVERT_TIMEOUT_MS = 300_000;

export type ScanResult =
  | { ok: true; musicXml: string }
  | { ok: false; reason: 'unavailable' | 'failed'; message: string };

type FetchLike = typeof fetch;

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** True when the local score reader answers. Never throws. */
export async function isScoreReaderRunning(endpoint = OMR_ENDPOINT, fetchFn: FetchLike = fetch): Promise<boolean> {
  try {
    const response = await withTimeout(HEALTH_TIMEOUT_MS, (signal) => fetchFn(`${endpoint}/health`, { signal }));
    return response.ok;
  } catch {
    return false;
  }
}

/** Read a PDF or image of a score into MusicXML text. */
export async function scanScore(file: File, endpoint = OMR_ENDPOINT, fetchFn: FetchLike = fetch): Promise<ScanResult> {
  if (file.size > MAX_SCAN_BYTES) return { ok: false, reason: 'failed', message: 'That file is too big (the limit is 20 MB).' };
  let response: Response;
  try {
    response = await withTimeout(CONVERT_TIMEOUT_MS, async (signal) =>
      fetchFn(`${endpoint}/convert?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file, signal }),
    );
  } catch {
    return { ok: false, reason: 'unavailable', message: 'The score reader is not running on this computer.' };
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).trim().split('\n')[0] ?? '';
    return { ok: false, reason: 'failed', message: detail || 'The score reader could not read that file.' };
  }
  try {
    return { ok: true, musicXml: await mxlToMusicXml(new Uint8Array(await response.arrayBuffer())) };
  } catch (e) {
    return { ok: false, reason: 'failed', message: e instanceof Error ? e.message : 'The reader sent back something unreadable.' };
  }
}
