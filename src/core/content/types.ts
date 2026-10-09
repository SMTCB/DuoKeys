// TA-DAT-001 — content hierarchy: Piece -> Arrangement -> Track -> Section.
// Mirrors docs/01-TECHNICAL-ARCHITECTURE.md verbatim; grow field-by-field as
// later sprints need more (the content pipeline, DifficultyBreakdown scoring).

import type { MidiPitch } from '../midi/decode';
import type { Ticks, TempoMap } from '../time/types';

export interface ContentNote {
  id: string;
  pitch: MidiPitch;
  startTick: Ticks;
  durationTicks: Ticks;
  groupId: string;
  trackId: string;
  /** Which hand plays it, when the piece says (free-play songs); the falling notes label and shade by it. */
  hand?: 'L' | 'R';
  finger?: 1 | 2 | 3 | 4 | 5;
}

export type TrackRole = 'primo' | 'secondo' | 'lh' | 'rh' | 'melody' | 'accomp';

export interface Track {
  id: string;
  role: TrackRole;
  hand?: 'L' | 'R';
  notes: ContentNote[];
}

export type SectionKind = 'quest' | 'reward';

export interface Section {
  id: string;
  label: string;
  startTick: Ticks;
  endTick: Ticks;
  barRange: [number, number];
  kind: SectionKind;
}

/** TA-CNT-002 — five-axis difficulty scoring, published so a mis-score is diagnosable. */
export interface DifficultyBreakdown {
  pitchRange: number;
  handPositionChanges: number;
  rhythmicVocabulary: number;
  handIndependence: number;
  accidentalDensity: number;
  overall: 1 | 2 | 3 | 4 | 5;
}

/** FR-STU-013 — lead-sheet chord symbols, positioned at a tick like a note. Optional: most content has none. */
export interface ChordMarker {
  atTick: Ticks;
  symbol: string;
}

export interface Arrangement {
  id: string;
  pieceId: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tempoMap: TempoMap;
  timeSig: [number, number];
  keySig: string;
  tracks: Track[];
  sections: Section[];
  analysis: DifficultyBreakdown;
  chordMarkers?: ChordMarker[];
}

export interface Piece {
  id: string;
  title: string;
  composer?: string;
  tags: string[];
  licenceId: string;
}
