// TS-U-CNT-047 — a compressed MusicXML (.mxl) is unzipped to its score, found through container.xml.
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { mxlToMusicXml } from './mxl';

function zip(files: { name: string; text: string }[]): Uint8Array {
  const out: number[] = [];
  const central: number[] = [];
  const u16 = (n: number) => [n & 255, (n >>> 8) & 255];
  const u32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const name = [...Buffer.from(f.name)];
    const data = [...deflateRawSync(Buffer.from(f.text))];
    const offset = out.length;
    out.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(f.text.length), ...u16(name.length), ...u16(0), ...name, ...data);
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(f.text.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name);
  }
  const centralAt = out.length;
  out.push(...central, ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(central.length), ...u32(centralAt), ...u16(0));
  return new Uint8Array(out);
}

describe('mxlToMusicXml (TS-U-CNT-047)', () => {
  it('returns the score the container names, not the first file', async () => {
    const bytes = zip([
      { name: 'META-INF/container.xml', text: '<container><rootfiles><rootfile full-path="score/song.xml"/></rootfiles></container>' },
      { name: 'other.xml', text: '<other/>' },
      { name: 'score/song.xml', text: '<score-partwise/>' },
    ]);
    expect(await mxlToMusicXml(bytes)).toBe('<score-partwise/>');
  });

  it('falls back to the first xml file without a container, and rejects a non-zip', async () => {
    expect(await mxlToMusicXml(zip([{ name: 'a.musicxml', text: '<score-partwise/>' }]))).toBe('<score-partwise/>');
    await expect(mxlToMusicXml(new Uint8Array(40))).rejects.toThrow(/not a valid/);
  });
});
