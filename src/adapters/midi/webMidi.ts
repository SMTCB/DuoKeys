// TA-PORT-003 v1 adapter — Web MIDI API. US-1.07/1.08.

import type { MidiBackend, MidiConnectionState, MidiInputInfo, RawMidiMessage, Unsubscribe } from '../ports';
import { asMillis } from '../../core/time/types';

export class WebMidiBackend implements MidiBackend {
  private access: MIDIAccess | undefined;
  private input: MIDIInput | undefined;
  private readonly messageCbs = new Set<(msg: RawMidiMessage) => void>();
  private readonly stateCbs = new Set<(s: MidiConnectionState) => void>();

  private readonly handleMessage = (ev: MIDIMessageEvent): void => {
    if (!ev.data) return;
    const msg: RawMidiMessage = { data: ev.data, timeStamp: asMillis(ev.timeStamp) };
    this.messageCbs.forEach((cb) => cb(msg));
  };

  private async ensureAccess(): Promise<MIDIAccess> {
    if (!this.access) {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    }
    return this.access;
  }

  async listInputs(): Promise<MidiInputInfo[]> {
    const access = await this.ensureAccess();
    const inputs: MidiInputInfo[] = [];
    access.inputs.forEach((input) => {
      inputs.push({ id: input.id, name: input.name ?? 'Unknown device', manufacturer: input.manufacturer ?? '' });
    });
    return inputs;
  }

  async open(id: string): Promise<void> {
    const access = await this.ensureAccess();
    let found: MIDIInput | undefined;
    access.inputs.forEach((input) => {
      if (input.id === id) found = input;
    });
    if (!found) throw new Error(`WebMidiBackend: no input with id "${id}"`);

    if (this.input) this.input.removeEventListener('midimessage', this.handleMessage);
    this.input = found;
    this.input.addEventListener('midimessage', this.handleMessage);
    await this.input.open();
    this.stateCbs.forEach((cb) => cb('connected'));
  }

  async close(): Promise<void> {
    if (!this.input) return;
    this.input.removeEventListener('midimessage', this.handleMessage);
    await this.input.close();
    this.input = undefined;
    this.stateCbs.forEach((cb) => cb('disconnected'));
  }

  onMessage(cb: (msg: RawMidiMessage) => void): Unsubscribe {
    this.messageCbs.add(cb);
    return () => this.messageCbs.delete(cb);
  }

  onStateChange(cb: (s: MidiConnectionState) => void): Unsubscribe {
    this.stateCbs.add(cb);
    return () => this.stateCbs.delete(cb);
  }
}
