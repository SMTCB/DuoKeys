// TA-CNT-001 stage 1 (MusicXML) — pure MusicXML -> SourceInput parser for
// Mutopia/OpenScore solo-piano imports (US-3.12, TA-CNT-004).
// content/build/ingest.ts is the only caller in production (it adds the
// file I/O and the companion-metadata lookup around this); tests call it
// directly against fixture XML strings so the parsing logic itself has no
// I/O to fake.
//
// Scope, deliberately: a single <score-partwise> <part> (solo piano — the
// "Adult module" case TA-CNT-004 describes; four-hands duets stay
// hand-authored JSON for now), up to two staves (treble/bass -> rh/lh), one
// voice per staff (MusicXML's <backup>/<forward> stream-interleaving is what
// lets several voices share a staff; this parser buckets notes by <staff>
// alone, so a second voice on the same staff would silently interleave into
// the wrong sequence — it throws instead), and a single global tempo/time/key
// signature taken from the file's first <attributes>/<sound> (mid-piece
// changes are flattened, matching TA-CNT-001's single tempoMap entry today).
// No grace notes, unpitched (percussion) notes, or double sharps/flats.
// Anything past that scope throws a specific, actionable error rather than
// silently mis-importing — consistent with TA-CNT-005's fail-the-build
// philosophy for licences. `.mxl` (zip-compressed) and `.mid` sources are
// out of scope this slice too; only uncompressed `.musicxml` is read.
//
// <tie> IS handled: a <tie type="stop"> merges into the immediately
// preceding same-pitch note in its staff (extending its durationTicks)
// rather than becoming a second note — silently importing a tie as two
// separate onsets would be a correctness bug, not just a missing feature,
// so this one doesn't get the "throw and move on" treatment above.

import { XMLParser } from 'fast-xml-parser';
import type { SourceInput, SourceNoteInput, SourceTrackInput } from './buildArrangement';
import type { TrackRole } from './types';

const PPQ = 480;

export interface MusicXmlImportOptions {
  id: string;
  barsPerQuest?: number;
}

interface RawPitch {
  step: string;
  alter?: number;
  octave: number;
}

interface RawNote {
  pitch?: RawPitch;
  duration?: number;
  voice?: number | string;
  staff?: number | string;
  [flag: string]: unknown; // presence-only children: rest, chord, grace, unpitched
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'part' || name === 'measure' || name === 'note' || name === 'direction',
});

function hasKey(obj: unknown, key: string): boolean {
  return typeof obj === 'object' && obj !== null && Object.prototype.hasOwnProperty.call(obj, key);
}

// <tie> is presence-of-a-type, not presence-only — a note can carry a
// <tie type="stop"/> (this note continues one), a <tie type="start"/> (a new
// one begins here), or both. fast-xml-parser gives one object for a single
// <tie>, or an array when a note has both.
function tieTypes(note: RawNote): string[] {
  const tie = note['tie'];
  if (tie === undefined) return [];
  const list = Array.isArray(tie) ? tie : [tie];
  return list
    .map((t) => (typeof t === 'object' && t !== null ? (t as Record<string, unknown>)['@_type'] : undefined))
    .filter((t): t is string => typeof t === 'string');
}

function pitchToName(pitch: RawPitch): string {
  const alter = pitch.alter ?? 0;
  if (alter !== 0 && alter !== 1 && alter !== -1) {
    throw new Error(`parseMusicXml: unsupported <alter>${alter}</alter> — only -1/0/1 (no double sharps/flats)`);
  }
  const accidental = alter === 1 ? '#' : alter === -1 ? 'b' : '';
  return `${pitch.step}${accidental}${pitch.octave}`;
}

// Major-key circle of fifths, only as far as TA-CNT-002's DIATONIC_PITCH_CLASSES
// table already covers — an uncovered key still imports (as `keySig`), it just
// gets a neutral accidental-density score until that table is extended.
const FIFTHS_TO_KEY: Record<number, string> = { [-1]: 'F', 0: 'C', 1: 'G' };

export function parseMusicXml(xml: string, options: MusicXmlImportOptions): SourceInput {
  const doc = xmlParser.parse(xml) as Record<string, unknown>;
  const score = doc['score-partwise'] as Record<string, unknown> | undefined;
  if (!score) throw new Error('parseMusicXml: not a <score-partwise> document (score-timewise is not supported)');

  const parts = score['part'] as Record<string, unknown>[] | undefined;
  if (!parts || parts.length === 0) throw new Error('parseMusicXml: no <part> elements found');
  if (parts.length > 1) {
    throw new Error(
      `parseMusicXml: ${parts.length} <part> elements found — multi-part (duet) MusicXML import isn't supported yet; import a solo part`,
    );
  }
  const measures = (parts[0]!['measure'] as Record<string, unknown>[] | undefined) ?? [];
  if (measures.length === 0) throw new Error('parseMusicXml: the part has no <measure> elements');

  const work = score['work'] as Record<string, unknown> | undefined;
  const title = (work?.['work-title'] as string | undefined) ?? (score['movement-title'] as string | undefined) ?? options.id;

  let divisions = 1;
  let tempoBpm = 100;
  let timeSig: [number, number] = [4, 4];
  let keySig = 'C';
  let capturedTempo = false;
  let capturedTime = false;
  let capturedKey = false;

  const staffNotes = new Map<string, SourceNoteInput[]>();
  const staffVoices = new Map<string, Set<string>>();
  const staffOrder: string[] = [];

  function staffTrack(staffKey: string): SourceNoteInput[] {
    let track = staffNotes.get(staffKey);
    if (!track) {
      track = [];
      staffNotes.set(staffKey, track);
      staffOrder.push(staffKey);
    }
    return track;
  }

  function captureTempo(sound: Record<string, unknown> | undefined): void {
    if (!sound || capturedTempo || sound['@_tempo'] === undefined) return;
    tempoBpm = Number(sound['@_tempo']);
    capturedTempo = true;
  }

  for (const measure of measures) {
    const attributes = measure['attributes'] as Record<string, unknown> | undefined;
    if (attributes) {
      if (typeof attributes['divisions'] === 'number') divisions = attributes['divisions'] as number;
      const time = attributes['time'] as Record<string, unknown> | undefined;
      if (time && !capturedTime && time['beats'] !== undefined && time['beat-type'] !== undefined) {
        timeSig = [Number(time['beats']), Number(time['beat-type'])];
        capturedTime = true;
      }
      const key = attributes['key'] as Record<string, unknown> | undefined;
      if (key && !capturedKey && typeof key['fifths'] === 'number') {
        const mapped = FIFTHS_TO_KEY[key['fifths'] as number];
        if (mapped) keySig = mapped;
        capturedKey = true;
      }
    }

    const directions = (measure['direction'] as Record<string, unknown>[] | undefined) ?? [];
    for (const direction of directions) captureTempo(direction['sound'] as Record<string, unknown> | undefined);
    captureTempo(measure['sound'] as Record<string, unknown> | undefined); // some exporters put <sound> directly on <measure>

    const notes = (measure['note'] as RawNote[] | undefined) ?? [];
    for (const note of notes) {
      if (hasKey(note, 'grace')) {
        throw new Error('parseMusicXml: grace notes are not supported — remove or simplify them before importing');
      }
      if (hasKey(note, 'unpitched')) {
        throw new Error('parseMusicXml: unpitched (percussion) notes are not supported');
      }

      const staffKey = note.staff !== undefined ? String(note.staff) : '1';
      const voiceKey = note.voice !== undefined ? String(note.voice) : '1';
      const seenVoices = staffVoices.get(staffKey) ?? new Set<string>();
      seenVoices.add(voiceKey);
      staffVoices.set(staffKey, seenVoices);
      if (seenVoices.size > 1) {
        throw new Error(
          `parseMusicXml: staff ${staffKey} has more than one voice (${[...seenVoices].join(', ')}) — only one voice per staff is supported; simplify the score before importing`,
        );
      }

      const durationTicks = Math.round(((note.duration ?? 0) * PPQ) / divisions);
      const isChord = hasKey(note, 'chord');
      const isRest = hasKey(note, 'rest');
      const track = staffTrack(staffKey);

      if (isRest) {
        track.push({ durationTicks, rest: true });
      } else if (note.pitch) {
        const pitch = pitchToName(note.pitch);
        const ties = tieTypes(note);
        if (ties.includes('stop')) {
          const previous = track[track.length - 1];
          if (!previous || previous.rest || previous.pitch !== pitch) {
            throw new Error(
              `parseMusicXml: <tie type="stop"> on ${pitch} doesn't follow a matching ${pitch} note — tied notes must be consecutive in the same voice`,
            );
          }
          previous.durationTicks += durationTicks;
        } else {
          track.push(isChord ? { pitch, durationTicks, chord: true } : { pitch, durationTicks });
        }
      } else {
        throw new Error('parseMusicXml: <note> has neither <pitch> nor <rest>');
      }
    }
  }

  if (staffOrder.length === 0) throw new Error('parseMusicXml: no notes found in the part');
  if (staffOrder.length > 2) {
    throw new Error(`parseMusicXml: ${staffOrder.length} staves found — only one or two staves (treble/bass) are supported`);
  }

  const tracks: SourceTrackInput[] = [...staffOrder]
    .sort()
    .map((staffKey, i): SourceTrackInput => {
      const notes = staffNotes.get(staffKey)!;
      if (staffOrder.length === 1) return { id: 'melody', role: 'melody' as TrackRole, notes };
      return i === 0
        ? { id: 'rh', role: 'rh' as TrackRole, hand: 'R', notes }
        : { id: 'lh', role: 'lh' as TrackRole, hand: 'L', notes };
    });

  return {
    id: options.id,
    title: String(title),
    tempoBpm,
    timeSig,
    keySig,
    tracks,
    ...(options.barsPerQuest !== undefined ? { barsPerQuest: options.barsPerQuest } : {}),
  };
}
