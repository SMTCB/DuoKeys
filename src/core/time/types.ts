// TA-CLK-001 — three time domains, branded so they can never be silently mixed.

export type Millis = number & { readonly __brand: 'Millis' };
export type Seconds = number & { readonly __brand: 'Seconds' };
export type Ticks = number & { readonly __brand: 'Ticks' };

export const PPQ = 480;

export const asMillis = (n: number): Millis => n as Millis;
export const asSeconds = (n: number): Seconds => n as Seconds;
export const asTicks = (n: number): Ticks => n as Ticks;

export interface TempoPoint {
  atTick: Ticks;
  bpm: number;
}

export type TempoMap = readonly TempoPoint[];
