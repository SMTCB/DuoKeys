// TA-PORT-003 v1 adapter — Tone.js, bound to a natively-created AudioContext
// so `now()` (the master clock, ADR-006) is available immediately at
// construction, before Tone.js has been lazily imported for playback
// (TA-REN-004-style code splitting: nothing Tone-shaped loads until a note
// actually needs to sound).
//
// TA-AUD-002 specs a sampled piano set; no licensed piano samples exist in
// this repo yet, so this adapter uses Tone's built-in synth voices instead.
// Swapping the voice source to a real Sampler is contained to ensureSynth()
// — the AudioBackend contract does not change (TA-PORT-002).

import type { AudioBackend, SampleId, VoiceHandle } from '../ports';
import type { MidiPitch } from '../../core/midi/decode';
import { asSeconds, type Seconds } from '../../core/time/types';

type ToneNamespace = typeof import('tone');
type Synth = InstanceType<ToneNamespace['PolySynth']>;

function midiToNoteName(pitch: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const name = names[((pitch % 12) + 12) % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${name}${octave}`;
}

// One-shot cue definitions for playSample (rewards, section-complete) — short
// built-in arpeggios rather than licensed audio assets (none exist yet).
const CUES: Readonly<Record<string, readonly string[]>> = {
  'star-earned': ['C5', 'E5', 'G5'],
  'section-complete': ['C5', 'G5'],
};

export class WebAudioBackend implements AudioBackend {
  private readonly ctx: AudioContext = new AudioContext();
  private tone: ToneNamespace | undefined;
  private synth: Synth | undefined;
  private nextVoiceId = 0;
  private readonly activeVoices = new Map<number, string>();

  private async ensureSynth(): Promise<{ tone: ToneNamespace; synth: Synth }> {
    if (!this.tone) {
      this.tone = await import('tone');
      this.tone.setContext(this.ctx);
    }
    if (!this.synth) {
      this.synth = new this.tone.PolySynth(this.tone.Synth).toDestination();
    }
    return { tone: this.tone, synth: this.synth };
  }

  now(): Seconds {
    return asSeconds(this.ctx.currentTime);
  }

  playNote(pitch: MidiPitch, velocity: number, at?: Seconds): VoiceHandle {
    const handle: VoiceHandle = { id: this.nextVoiceId++ };
    const note = midiToNoteName(pitch as number);
    this.activeVoices.set(handle.id, note);
    void this.ensureSynth().then(({ synth }) => {
      synth.triggerAttack(note, at ?? this.ctx.currentTime, Math.max(0.05, velocity / 127));
    });
    return handle;
  }

  stopNote(h: VoiceHandle, at?: Seconds): void {
    const note = this.activeVoices.get(h.id);
    if (!note) return;
    this.activeVoices.delete(h.id);
    void this.ensureSynth().then(({ synth }) => {
      synth.triggerRelease(note, at ?? this.ctx.currentTime);
    });
  }

  playSample(id: SampleId, at?: Seconds): void {
    const notes = CUES[id];
    if (!notes) return;
    void this.ensureSynth().then(({ synth }) => {
      const startAt = at ?? this.ctx.currentTime;
      notes.forEach((note, i) => synth.triggerAttackRelease(note, '16n', startAt + i * 0.08));
    });
  }

  setMasterGain(g: number): void {
    void this.ensureSynth().then(({ tone, synth }) => {
      synth.volume.value = tone.gainToDb(Math.max(0.0001, g));
    });
  }

  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }
}
