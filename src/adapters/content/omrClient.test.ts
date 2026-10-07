// TS-U-CNT-050 — the local score reader client: reports "not running" without throwing, passes
// the file name to the service, and unzips what comes back.
import { describe, expect, it, vi } from 'vitest';

vi.mock('./mxl', () => ({ mxlToMusicXml: vi.fn(async () => '<score-partwise/>') }));

import { isScoreReaderRunning, scanScore } from './omrClient';

const pdf = new File([new Uint8Array([37, 80, 68, 70])], 'Let It Be.pdf', { type: 'application/pdf' });

describe('omrClient (TS-U-CNT-050)', () => {
  it('says the reader is not running when nothing answers, and never throws', async () => {
    const refuse = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await isScoreReaderRunning('http://localhost:1', refuse)).toBe(false);
    const result = await scanScore(pdf, 'http://localhost:1', refuse);
    expect(result).toEqual({ ok: false, reason: 'unavailable', message: expect.stringContaining('not running') });
  });

  it('posts the file under its own name and returns the unzipped score', async () => {
    const answer = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })) as unknown as typeof fetch;
    const result = await scanScore(pdf, 'http://localhost:8765', answer);
    expect(result).toEqual({ ok: true, musicXml: '<score-partwise/>' });
    const [url, init] = (answer as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe('http://localhost:8765/convert?name=Let%20It%20Be.pdf');
    expect(init.method).toBe('POST');
  });

  it('turns a refusal from the service into a plain message', async () => {
    const refuse = vi.fn(async () => new Response('no music could be read from that file.', { status: 422 })) as unknown as typeof fetch;
    expect(await scanScore(pdf, 'http://localhost:8765', refuse)).toEqual({
      ok: false,
      reason: 'failed',
      message: 'no music could be read from that file.',
    });
  });
});
