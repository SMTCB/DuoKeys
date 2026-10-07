// FR-STU-017 — a compressed MusicXML score (.mxl) is a zip holding the score as XML plus
// META-INF/container.xml, which names it. MuseScore, Finale and Sibelius export this form.
// Reading it needs the platform's inflate (DecompressionStream), so it lives with the adapters.

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function listEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('That file is not a valid .mxl (zip) score.');
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) throw new Error('That .mxl file is damaged.');
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    entries.push({
      name: new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)),
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      localHeaderOffset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.localHeaderOffset;
  if (view.getUint32(at, true) !== LOCAL_SIGNATURE) throw new Error('That .mxl file is damaged.');
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const raw = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(raw);
  if (entry.method !== 8) throw new Error('That .mxl file uses a compression this app does not read.');
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

/** The score inside a .mxl, as MusicXML text. */
export async function mxlToMusicXml(bytes: Uint8Array): Promise<string> {
  const entries = listEntries(bytes);
  const container = entries.find((e) => e.name === 'META-INF/container.xml');
  let wanted: string | undefined;
  if (container) {
    wanted = /full-path="([^"]+)"/.exec(await readEntry(bytes, container))?.[1];
  }
  const score =
    entries.find((e) => e.name === wanted) ??
    entries.find((e) => !e.name.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(e.name));
  if (!score) throw new Error('No score was found inside that .mxl file.');
  return readEntry(bytes, score);
}
