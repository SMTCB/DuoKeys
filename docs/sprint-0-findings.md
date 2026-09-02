# Sprint 0 — Findings

**Date:** 2026-09-02  
**Answers:** `RISK-001` · `PRE-001` · `PRE-002` · `PRE-003` · `PRE-008`  
**Stories:** `US-0.01` … `US-0.05`

## Instrument

| Field | Value |
|---|---|
| Model | _fill in_ |
| Connection | _USB-B to USB-A direct / via hub — fill in_ |
| Enumerated as | `USB MIDI Interface` |
| Manufacturer string | `QinHeng Electronics` |
| Class-compliant, no driver | _yes / no_ |

## Latency  (`RISK-001` — the go/no-go)

| Measure | Value |
|---|---|
| Median tap offset | 45.9 ms |
| Mean (for contrast) | 47.2 ms |
| IQR spread | 16.5 ms |
| Min / max | 23.4 / 64.0 ms |
| Taps | 16 |
| AudioContext baseLatency | 10.0 ms |
| AudioContext outputLatency | — |
| Sample rate | 48000 Hz |

**Verdict:** **Go.** Median 45.9 ms and IQR 16.5 ms both sit inside `TA-CLK-004`'s
"typically 15–60 ms" expectation and comfortably under the ~80 ms after-calibration
gate in `00-INDEX.md`'s build sequence. No architecture change needed.

**Visual latency by eye (`NFR-001`):** _does the block feel attached to the key? — fill in_

**Audio latency by ear (`NFR-003`):** _does the app note flam against the piano's own? — fill in_

## MIDI dialect  (`US-0.05`)

| Question | Observed |
|---|---|
| Note-off arrives as | 0x80 |
| Active sensing rate | 4.0 per second |
| Running status seen | no |
| CC64 sustain works | _confirm — fill in_ |
| Velocity range observed | 44 … 69 |
| Total messages | 112 |

## Decisions this settles

- `PRE-008` default audio path: _headphones / instrument speakers_ — 
- `TA-MID-002` decoder must handle: 0x80 note-off, active sensing suppression
- Per-profile calibration offset to seed: -46 ms

## Anything surprising

_This is the most valuable section. Write down what you did not expect,
however small — an odd CC on power-on, a burst of messages when the pedal
is half-down, a device name that changes between reconnects._
