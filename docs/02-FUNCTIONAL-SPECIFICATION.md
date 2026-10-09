# DuoKeys — Functional Specification

**Document ID:** FUNC
**Version:** 1.0
**Date:** 2 September 2026
**Status:** Baselined
**Companion to:** [01-TECHNICAL-ARCHITECTURE.md](01-TECHNICAL-ARCHITECTURE.md)

---

## How to read this document

Each requirement has a stable ID, a priority, and a reference to the technical
component that realises it. User stories (`US-*`) implement these; test scenarios
(`TS-*`) verify them.

**Module prefixes:**

| Prefix | Module |
|---|---|
| `FR-EXP-*` | Explorer — the child's experience |
| `FR-STU-*` | Studio — the adult's experience |
| `FR-DUO-*` | Duet — four hands together |
| `FR-PRO-*` | Profiles, progression and rewards |
| `FR-CON-*` | Content and repertoire |
| `FR-SYN-*` | Accounts and sync |
| `FR-SYS-*` | System, device, settings, shell |

**Priorities:** `M` must-have (v1 is not v1 without it) · `S` should-have ·
`C` could-have · `W` won't-have this round.

---

## 0. Product definition

**DuoKeys** is a local-first web application that connects to a digital piano over
USB MIDI and turns daily practice into something a six-year-old will choose to do
and an adult beginner will not outgrow within a month.

**Two users, two experiences, one instrument:**

- **Explorer** (child, 6) — a game. Falling notes, quests, stars, a ninja
  flashcard mini-game. Wait mode by default: nothing moves until the right key is
  down, so there is no failure state, only "not yet".
- **Studio** (adult) — a practice tool. Real notation, A/B looping,
  hands-separate, tempo ramping, Hanon with evenness scoring, generated
  sight-reading, and a dashboard that says *which bar* rushes.
- **Duet** — the reason the project exists. Both sit at the same instrument and
  play four hands, each graded on their own part.

**Explicitly not in scope for v1** (`W`): audio-input pitch detection, multiple
households, a content marketplace, social features, teacher accounts, Android or
iOS shells (see ADR-002 for the iPad path).

---

## 1. Explorer — the child's experience

> Design constraint running through this whole module: the child reads simple
> words, so short text labels are permitted, but icons, colour, animation and
> audio still carry the interface. Reading ability at six is far behind listening
> ability, and the mode must stay usable on a bad day. (`NFR-008`, ADR-008)

### FR-EXP-001 — Quest map (`M`)

**Realised by:** `TA-APP-003`, `TA-DAT-001`

A visual map of available pieces as a progression of nodes. Each node shows: an
icon, a short title, its star rating (0–3), and whether it is locked. Locked nodes
are visible but greyed — the child should see where they are going.

Unlocking follows the `Section` graph (`TA-DAT-001`): completing a section at ≥ 1
star unlocks the next.

### FR-EXP-002 — Falling-notes practice (`M`)

**Realised by:** `TA-REN-001`, `TA-REN-002`, `TA-MAT-002`

Coloured bars descend toward a hit line drawn directly above an on-screen keybed.
The keybed highlights the key each bar will land on. Left and right hands are
distinguished by colour **and** by bar shape (`NFR-008`).

The Explorer play screen also offers a Falling notes / Music score switch (`TA-REN-003`); the score is optional and never replaces the falling view as the default.

The spatial mapping from screen to hands requires no music reading — this is the
on-ramp that makes notation learnable later rather than being a prerequisite now.

### FR-EXP-003 — Wait mode is the default (`M`)

**Realised by:** `TA-MAT-002`

The stream freezes at the hit line until every note of the current group is down.
No timer, no timeout, no penalty. A beginner may take thirty seconds to find F♯.

Timed mode exists (`TA-MAT-003`) but is opt-in and should not be offered to the
child for the first months.

### FR-EXP-004 — Micro-quests (`M`)

**Realised by:** `TA-DAT-001` (`Section`)

Practice is offered in two-bar sections, not whole pieces. A section is a
completable unit in under a minute. Whole-piece play is a reward that unlocks after
its sections are cleared, not the default demand.

### FR-EXP-005 — Note Ninja (`S`)

**Realised by:** `TA-DAT-003` (`flashcards`)

A flashcard mini-game: a note appears on a simplified staff, the child plays it. The card shows the note three ways at once: its letter, the key lit on a two-octave keyboard (the same lit key as the falling view), and the note on a piano score (treble and bass staves).

**Response-time bands replace the spec's 5-second timer:**

| Response | Result |
|---|---|
| Under 2 s | Streak continues, bonus |
| 2–6 s | Correct |
| Over 6 s | Hint revealed (key highlights on the keybed), still counts as correct |

Wrong answers show the correct key and re-queue the card. There is no losing.
A countdown timer teaches a six-year-old that reading music is frightening.

Cards are scheduled by a simple spaced-repetition pool (Leitner-style boxes are
sufficient; SM-2 is over-engineered here).

### FR-EXP-006 — Free play (`S`)

An unstructured mode where every key press triggers a visual and a sound with no
grading whatsoever. This is not filler — it is where a six-year-old discovers that
the instrument responds to them, and it costs almost nothing to build. Each note shows its letter, the lit key on a two-octave keyboard and the note on a piano score; they stay on the last note after the key is released.

### FR-EXP-007 — Generous grading (`M`)

**Realised by:** `TA-GRD-002`, `TA-MAT-006`

- Tolerance windows scaled by `Profile.toleranceScale` (default 1.6).
- Any *completed* attempt earns at least 1 star.
- Errors are shown as "try this one again", never as a score deduction.

### FR-EXP-008 — Rewards and session shape (`S`)

**Realised by:** `TA-AUD-001`, `NFR-011`

A session has a deliberate arc: a short warm-up, two or three quests, then a
wind-down (free play or a favourite piece) so practice ends on enjoyment rather
than on the hardest thing attempted.

Rewards are immediate and audio-visual: a sound, a particle burst (suppressed under
`prefers-reduced-motion`), a star landing on the map. No currency, no streak-loss
anxiety, no artificial scarcity (`NFR-012`).

### FR-EXP-009 — Session length guidance (`C`)

A gentle suggestion to stop after a target bench time (default 10 minutes),
presented as a celebration of finishing, never as a lockout.

---

## 2. Studio — the adult's experience

### FR-STU-001 — Notation practice view (`M`)

**Realised by:** `TA-REN-003`

Real notation rendered by OSMD with a cursor driven by the matcher. The cursor
advances as notes are matched; it does not run on a timer in wait mode.

### FR-STU-002 — Post-attempt note colouring (`M`)

**Realised by:** `TA-REN-003`, `TA-GRD-001`

After an attempt, each note in the score is coloured by result: correct, wrong
pitch, missed, extra, late, early. Applied **after** the attempt, not during —
repainting the SVG mid-performance drops frames (`NFR-002`).

### FR-STU-003 — A/B loop (`M`)

Select a start and end measure; loop that range indefinitely. The single most
useful feature in any practice tool and the reason an adult will keep opening it.

### FR-STU-004 — Tempo scaling with auto-ramp (`M`)

**Realised by:** `TA-CLK-002`

Tempo adjustable 30–100% of written. **Auto-ramp:** on a clean pass, raise tempo
5% and repeat; on a failed pass, drop back one step. That single behaviour turns a
set of controls into an actual practice method, and it is about thirty lines on top
of the loop.

### FR-STU-005 — Hands separate (`M`)

**Realised by:** `TA-AUD-002`, `TA-DAT-001` (`Track.hand`)

Practise one hand while the other is muted, silent, or played back by the sampler.
Played-back accompaniment is what makes hands-separate practice musical rather than
lonely.

### FR-STU-006 — Articulation and duration feedback (`S`)

**Realised by:** `TA-MID-004`, `TA-GRD-006`

Using the PedalTracker's distinction between key-up and note-stopped-sounding,
report notes held too short (staccato where legato was written) or too long.

### FR-STU-007 — Hanon generator with evenness scoring (`S`)

**Realised by:** `TA-GRD-003`, `TA-CNT-004`

Hanon 1–20 generated from patterns rather than authored. Graded on
`evennessCv` — the coefficient of variation of inter-onset intervals — which is
the only thing that makes this practice measurable rather than merely endured.

### FR-STU-008 — Rush/drag reporting (`M`)

**Realised by:** `TA-GRD-001`

The dashboard reports the **signed** mean offset: "you are 40 ms ahead of the
beat". Not RMS, which is kept for the consistency trend but is not actionable
advice.

### FR-STU-009 — Per-measure breakdown (`S`)

**Realised by:** `TA-GRD-004`

A bar-by-bar strip showing accuracy and rush/drag per measure, so the answer is
"your left hand rushes bar 5", not "you played it".

### FR-STU-010 — Generated sight-reading (`S`)

**Realised by:** `TA-CNT-004`

Constrained random generation: pick a key, a range, a rhythmic vocabulary and a
difficulty, emit an eight-bar phrase never seen before. Unlimited material at
exactly the right level, and the cheapest content in the project.

> Note: **Sight Reading Factory**, listed in the original spec, is a paid
> commercial product with no public API. It can inspire this feature; it cannot be
> a dependency.

### FR-STU-011 — Real repertoire ingest (`C`)

**Realised by:** `TA-CNT-001`, `TA-CNT-004`

Import from Mutopia and OpenScore through the build pipeline, with the licence
gate (`TA-CNT-005`) enforced.

### FR-STU-012 — Chord & progression explorer (`M`)

**Realised by:** `TA-CNT-006`, `TA-MAT-007` · `US-3.13`

A browsable map of chords and progressions in every key: pick a key, see its
diatonic chords and a large catalogue of progressions (1 stock 12-bar blues
turnaround plus 50 major-key and 58 minor-key progressions per key, each
tagged with moods and filterable by mode/mood), and play along with each
chord highlighted on an on-screen keybed as it comes due. Each suggested
chord is validated against what's actually played — `TA-MAT-007`'s
`ChordMatcher` — but there is no timing requirement and no failure state:
this is `FR-EXP-006`'s free-play philosophy applied to harmony instead of
melody, for practice time that isn't in an exercise mood.

> **Content source:** progression sequences and mood tags are ported as text
> data from [ldrolez/free-midi-chords](https://github.com/ldrolez/free-midi-chords)
> (MIT-licensed) — specifically the `prog_maj`/`prog_min` Roman-numeral
> degree/quality token lists in `chords.py`, 108 progression templates in
> total. Chord voicings (`midiNotes`) are this codebase's own generation
> from standard chord-interval formulas, not parsed from any MIDI file —
> `TA-CNT-006` has the full split and the licence-gate entries for both
> parts (`TA-CNT-005`).
> `TA-CNT-006` defines the lighter, parallel ingest path this needs — chords
> have no `Section` or difficulty score, so they deliberately don't fit
> `Arrangement`/`Track` as authored today, and don't reuse the falling-notes
> or OSMD renderers.

### FR-STU-013 — Lead-sheet song mode (`M`)

**Realised by:** `TA-DAT-001` (extended), `TA-REN-001` · `US-3.14`

For a specific song, a simplified practice mode: chord symbols over a beat
grid plus the melody, closer to a lead sheet than a full score. Reuses
`FR-STU-012`'s chord data and playback for the harmony half; the melody half
already fits `TA-DAT-001`'s existing `Track`/`ContentNote` shape at a coarse
difficulty, rendered with the existing falling-notes view (`TA-REN-001`)
rather than a new renderer, with chord symbols overlaid as text at their
tick position. The lead-sheet screen, like every falling-notes screen offers the same Show switch falling-notes screen, can show the melody as a Music score as well as falling notes (`TA-REN-003`). Positioned as the easy on-ramp before `FR-STU-001`'s full
notation view, not a replacement for it — depends on `FR-STU-012` existing
first, and on `FR-STU-011`/`FR-CON-*` for a specific song's melody data if it
isn't already in the catalogue.

### FR-STU-015 — My progressions & falling-notes chord play (`S`)

**Realised by:** `TA-CNT-006`, `TA-REN-001`, `TA-DAT-003` · `US-3.18`

The adult can type or paste a chord progression — chord symbols (`C G Am F`,
`Dm7 G7 Cmaj7`, `Bb/D`) or Roman numerals in a chosen key and mode (`I V vi IV`,
`ii7 V7 I`) — name it, and have it saved to "My progressions" beside the
shipped catalogue. Any progression, shipped or typed, can then be played as
falling notes: each chord is a chord-group on the falling-notes view with its
symbol overlaid, in wait mode (`FR-EXP-003`: no timer, no failure state).

**Chord library and rhythms.** The explorer lists every chord on the chosen
key — 40 qualities, grouped Triads / 7ths & 9ths / Other — and the
progression filter covers the Major, Minor and Modal sets (2,292
progressions across the 12 keys). A progression can be played as block
chords (one bar per chord) or in one of four rhythmic styles (pop, pop 2,
soul, hip-hop) taken from the free-midi-chords style files, transposed to
the chosen key. The 12-bar blues has block chords only.

**Playing aids on the chord screen.** The play screen offers: a "stop notes at
the line until I play them" option (default on; in wait mode the clock is held
on the pending chord, `TA-CLK-002`); a Speed slider (30–100 %, live); played
notes shown green with a tick and the keys on the keybed marked; lanes fitted to
the progression's range so the bars fill the width; and a Show switch between
Falling notes and Music score. The score view (`TA-REN-003`) lays the chords out
as a scrolling grand staff whose cursor advances only on correct notes, for every
rhythm style.

To make a chord findable on the real piano, every falling bar and wanted key
carries its letter name (middle C = C4), every C on the keybed is named as a
landmark, and a "Play now" line lists the notes still needed. An "Any octave
counts" option (default on here, `TA-MAT-002` `anyOctave`) accepts the right
letter wherever it is played; a chord that wants one letter twice needs two
presses. Songs keep the exact pitch.

On the chord screen, chords still to come are pale with a dashed outline, and a
chord just played stays green at the line until the next chord has fallen in and
turned the pending colour.

A progression bar above the canvas shows every chord of the progression as a
chip, the one being played marked (bold, outlined, `aria-current`), finished
ones ticked, and the round of the loop ("Round 1 of 2"). The keyboard keeps the keys
of the chord just played green for about half a second, then clears. A Key picker on the
chord screen, before and during play, moves the same progression to another key
(same degrees, so the same mood); during play it restarts on the new notes.
Progressions typed in by the adult stay in their own key.

> **No web chord search.** Searching chord sites and auto-importing was
> considered and declined: there is no public chord API, scraping breaches the
> sites' terms and copyright, and a network read on the practice path would
> break `ADR-003`. Typed text is the substitute. User progressions live on the
> profile's `settings` record, so they sync like any other setting and need no
> migration. A slash chord's bass note is dropped (the matcher checks pitch
> classes). In minor mode Roman numerals follow the natural minor scale, as the
> shipped catalogue does.

### FR-STU-016 — Song library (`S`)

**Realised by:** `TA-CNT-004`, `TA-CNT-005`, `TA-CNT-006`, `TA-REN-001`, `TA-DAT-003` · `US-3.19`

The adult can search a library of real piano pieces, add the ones they want to
"my songs", and play any of them as falling notes at the instrument, in wait
mode (`FR-EXP-003`: no timer, no failure state) or timed, with the hand
selector, A/B loop, auto-ramp and tempo scale of `FR-STU-003`–`005`.

**Where the pieces come from.** The Mutopia Project's solo keyboard pieces —
piano, harpsichord and clavichord, 576 at the time of writing: 377 public
domain, 128 CC BY-SA, 71 CC BY. Duets, voice and other instruments are left out.
Their MIDI files are mirrored into the repository once
(`content/build/crawlMutopia.ts`, `fetchMutopiaMidi.ts`) and shipped as static
assets with a searchable index (`content/build/ingestSongs.ts`), so nothing is
fetched from Mutopia while practising (`ADR-003`). Every piece has its own entry
in `content/licences.json` (`TA-CNT-005`) and every row of the library shows its
licence and links to the piece's own Mutopia page, which is how attribution is
met.

**Search and "add to my songs".** Search matches every typed word against title,
composer, opus and style, ignoring accents and punctuation, with a style filter and a difficulty filter (Beginner to Expert). Difficulty is an estimate from how many notes each bar holds, not a rating from the publisher, and the screen says so.
"Add" saves the song's id on the profile's `settings` record — the same place
as `FR-STU-015`'s progressions, so it syncs with no new table. The MIDI bytes
stay static assets, downloaded on play.

**Playing a piece.** The file's notes become an arrangement with tracks Both
hands, Right hand and Left hand (two note tracks are read as right then left;
a single track is split at middle C). Notes that begin together form one
group, so a chord, or both hands landing together, is one decision in wait mode.
The play screen shows the piece in one of two views, switched by a "Show" control: falling notes, or Music score. The score is a grand staff that slides from right to left, the note being waited for sitting on a dashed line; it steps along each time a chord is played, and notes already played fade, so it works for chords and two hands as well as a single line. Spacing follows time, so a quarter note is always the same width. The hand being practised is drawn solid and the other hand lighter. Rests are not drawn and note lengths are shown by head and stem only, with no beams or key signature (each sharp or flat is written beside its note). The piece's key is worked out from its notes (Krumhansl–Schmuckler, longest notes counting most) and shown beside a Key control that moves the whole piece up or down by up to twelve semitones, staying on the keyboard; moving it mid-play starts again on the moved notes. The key is a best guess: a MusicXML key signature is not read and a MIDI file has none.

> **Limits.** Only MIDI is mirrored, so there is no engraved score for a
> song — MIDI carries no beaming, voices or articulation marks. Mutopia's MIDI
> is machine-generated from the score: the tempo is the score's marking, and
> dynamics are flat. Pieces are classical, Baroque, folk and a little jazz; a
> pop song would need a source with a licence that allows it.

### FR-STU-017 — Custom songs — "my songs" you bring yourself (`S`)

**Realised by:** `TA-CNT-007`, `TA-APP-003`, `TA-DAT-003` · `US-3.22`

The adult can add a song that is not in the library, such as a pop song they want to learn, and it is kept in "my songs" with the library pieces so they can come back to it. The Songs screen shows five tiles: the song library, paste chords, upload MIDI, upload a score, and the starter pieces; the three that add a song open a short form below the tiles. The ways to add one, all from material the user already has: paste a chord chart (section headings such as Verse and Chorus, chord symbols above or between the lyrics), upload a MIDI file, or upload a score exported as MusicXML (`.musicxml`, `.xml`) or compressed MusicXML (`.mxl`). A pasted chart shows "Found N chords in M sections" before it is saved; lyric lines are skipped, and chords the app cannot read are listed rather than guessed.

A chart plays as one bar per chord at 70 bpm in the same wait-mode falling-notes view as every other song; a MIDI or MusicXML file plays as its notes, with the same hand selector, loop and tempo controls. A `.mxl` file is unzipped in the browser (`adapters/content/mxl.ts`) and stored as plain MusicXML. The song, its source (the chart text or the file bytes, base64) and its title are stored on the profile's settings record beside saved library songs, so it syncs with no new table and is capped at 400 KB per song. A saved song's name and artist can be changed from its row in My songs (Rename); the notes are not editable. A file that does not parse, or has no notes, is refused when it is added, with a plain message, instead of being saved and failing later at the piano.

Limits: DuoKeys does not fetch or bundle charts or scores. The user brings the content. Turning a recording into MIDI is not offered. A PDF or a photo of a score (`.pdf`, `.png`, `.jpg`) is read by the optional local score reader (`ADR-010`): Audiveris in Docker on the user's own computer. It is not needed for anything else; when it is not running, the screen says how to start it. Before saving, a check screen shows how many bars and notes were read, lists bars whose beats do not add up, and asks for a speed when the scan found none. Scanning is a draft: pitches are usually right, rhythm in busy bars and the tempo often are not, so exporting MusicXML from a notation program (MuseScore) remains the more accurate route. The page goes only to localhost.

### FR-STU-018 — Free play — "play something for me" (`S`)

**Realised by:** `TA-CNT-007`, `TA-CNT-006`, `TA-APP-003` · `US-3.22`

The adult can sit down at the piano and be given something easy to play with no decisions. Free play opens as three tiles, in the Studio home's style: "Make me a song", "Just the chords" and "Chord library". The first two are choices (a ticked outline marks the chosen one) and open their own settings below, so each screen asks one thing at a time; the third is a link to the chord library. For "Just the chords": pick a feeling or leave it on "Surprise me", and the app chooses a short progression of at most four easy chords (major, minor, seventh, suspended) and a rhythm to play them in. "Another one" never repeats the last suggestion. Playing opens the chord-progression page with the rhythm already chosen; the chords fall and wait, there is no score and no timer. A Key picker ("Any key" or one of the twelve) fixes the scale of the suggestion; choosing a key after a suggestion moves that same progression there, so the mood is kept, and the suggestion names its key. The suggestion is labelled in plain words (the key, what it feels like, the rhythm and what a rhythm is), and says so when the chosen feeling has no easy chords in the chosen key. The chord-progression page repeats the key and feeling, and explains the Roman numerals in the progression's name. The piano line says "found, not started yet" until a piano is tapped, never "disconnected".

Limits: this is a suggestion generator over the shipped progression catalogue, not a composer; the longer, written-out song is `FR-STU-020`. There is no mode in which the app plays the other hand.

### FR-STU-020 — Free play — "make me a song" (`S`)

**Realised by:** `TA-CNT-008`, `TA-REN-001`, `TA-APP-003` · `US-3.25`

The adult can ask Free play for a whole simple song instead of one short progression. They pick a feeling and a key (or leave both on "Surprise me" / "Any key"), how long ("Short" about a minute, "A song" about three, "Long" about four) and how busy ("Simple" or "Fuller"), and the app writes a song from the shipped progression catalogue: an intro, verses and choruses that come back, a bridge in the long forms, and an ending that slows down. Every part stays in one key; the chorus and bridge use other progressions from the same key so the song moves without leaving home.

Both hands are written out. The left hand plays the chords as a bass line below middle C, in a pattern chosen by part and busyness (held roots, halves, a walk, a broken chord). The right hand plays a simple tune between middle C and G5 that lands on a chord note at the start of every bar and moves mostly by step; a section that comes back is played the same way, so by the second verse the tune is familiar. The same request and seed always give the same song; "New song, same feeling" draws another.

The page names the song, its key and feeling, roughly how long it lasts, and the form as a strip of parts with the current part marked by a symbol as well as by colour (`NFR-008`). Two switches can be flipped at any point while playing:

- **Keep going (don't wait for me).** Off, the notes wait at the line as everywhere else. On, the music plays in time and does not wait; switching back holds the stream at the next note not yet played. Notes already played keep counting either way, and the attempt ends on its own once the music passes the last note.
- **Make up my own right hand.** On, only the left hand is asked for, the written tune is hidden, and the keys that fit the current bar glow: the chord's notes with a filled dot, the other pentatonic notes that do not rub against the chord with a ring. This restarts the song from the beginning.

Limits: the song is generated by fixed rules from the catalogue, not by a language model, and it has no lyrics. The app never plays either hand for the user. The tune is deliberately plain: no syncopation, no leaps wider than a fifth on a strong beat.

### FR-STU-019 — Learn — a gentle path back (`S`)

**Realised by:** `TA-APP-003`, `TA-CNT-007` · `US-3.22`

The adult returning to the piano can open one page that lays out a short route: warm the hands with the slow Hanon drills (60 bpm), read a little (sight-reading), learn four chords that cover most pop songs (the chord library), then play to unwind (Free play and Songs). Every step opens a tool that already exists, in any order; the page has no scores or streaks (NFR-012). Each drill and step has a "Mark done" button: a private note to self, one tap to undo, never counted, timed or expired, kept on the profile's settings record.

Limits: the route itself is fixed text; the ticks do not unlock or reorder anything.

### FR-STU-014 — Personal score import (`C`)

**Status:** Future roadmap — deliberately out of MVP (v1) scope. Raised by
the adult user and confirmed as a nice-to-have, not a blocker; revisit after
v1 ships. Flagged as an open architecture question below, not only an
unscheduled story.

The end state: the adult receives an already-digitised sheet from a teacher
(MusicXML, or a scan run through OMR) and brings it into DuoKeys to practise
against — the same idea as `FR-STU-011`'s Mutopia/OpenScore ingest, but for
one personal file rather than the shared catalogue.

> Two separable questions here, not one. **Rendering it once it's in the
> app** is already solved — OSMD (`TA-REN-003`, already chosen, BSD-3-Clause)
> renders MusicXML directly, which is also the standard output of most
> open-source OMR tools (e.g. Audiveris) and of MuseScore's export. **Getting
> a personal file into the app is not solved.** The five-port architecture
> (`TA-PORT-002`) has no upload-capable port: `ContentBackend` fetches build
> output, not user-supplied files, and `StorageBackend` is IndexedDB, not a
> file-drop target. Two paths exist and neither is chosen:
> 1. **Build-time**, matching `US-3.12`'s existing pattern — drop a MusicXML
>    file into `content/sources/`, let `TA-CNT-001`'s pipeline ingest it like
>    any other piece. Cheapest, reuses everything, but needs a rebuild per
>    song — a poor fit for "a new sheet every week."
> 2. **Runtime upload** — a real new capability: a file picker, in-browser
>    parsing, and storage for the result. Needs a new port method or adapter;
>    this is genuine architecture work, not wiring.
>
> Licensing is also different in kind: `TA-CNT-005`'s gate assumes
> redistributable content with a public source URL. A teacher's personal
> handout has neither, and isn't being redistributed — the gate as written
> doesn't obviously apply to one household's own copy, but this is an
> open policy question, not a decision already made.

---

## 3. Duet — four hands

### FR-DUO-001 — Split keyboard with octave transposition (`M`)

**Realised by:** `TA-DAT-001` (`Track.role`)

The keyboard splits at a configurable point (default MIDI 60). Critically, this is
**split plus transposition**, not split alone: each half is transposed so both
players get their own middle C in the middle of their own region. Splitting without
transposing gives the child a part in the wrong octave and it will feel wrong to
them without their being able to say why.

If the instrument has a native Duo/Twin mode, prefer it and disable the app-side
transposition — but do not depend on it (`ADR-009` did not confirm one).

### FR-DUO-002 — Dual independent matchers (`M`)

**Realised by:** `TA-MAT-001`

Two matcher instances, one per part, each fed only the notes from its own keyboard
region. Each player is graded on their own part; one player's mistakes never fail
the other.

### FR-DUO-003 — Asymmetric difficulty (`M`)

**Realised by:** `TA-DAT-001` (`Track.role`)

The primo part is five notes in one hand position; the secondo carries the harmony
and the pulse. Modelled as two `Track`s in one `Arrangement` with a `role` field,
so the same piece can also be practised alone by either player.

### FR-DUO-004 — Shared result screen (`S`)

Both players see their own accuracy and stars side by side, plus a single "together"
score. The together score is celebratory, not competitive.

---

## 4. Profiles, progression and rewards

### FR-PRO-001 — Multiple local profiles (`M`)

**Realised by:** `TA-DAT-004`

Two to four family members, each with an emoji, a name, a role (`explorer` for a kid,
`student` for an adult), a four-digit PIN, calibration offset and tolerance scale. The home
screen is "Who's playing?": one tile per member and a "New family member" button (emoji, name,
kid or adult, PIN). Tapping a tile asks for that member's PIN. The PIN is a door-latch on a
shared screen, not security; it is kept in the member's `settings` record (`settings.pin`) so it
syncs with no schema change. A member with no PIN set (older data) lets anyone in.

### FR-PRO-002 — Per-profile progression (`M`)

**Realised by:** `TA-DAT-003` (`progression`)

Unlock state, best grade per section, and spaced-repetition schedules are all
per-profile. Progression is **derived from attempts**, never stored as primary
state (`TA-SYN-003`) — it can always be recomputed.

### FR-PRO-003 — Practice history (`M`)

**Realised by:** `TA-DAT-002`

Every attempt is recorded immutably with its full per-note event array. This is
what makes the dashboard possible and what makes sync trivial.

### FR-PRO-004 — Dashboard (`S`)

Streaks, bench time per day/week, accuracy trend per piece, and the per-measure
rush/drag strip (`FR-STU-009`). Explorer sees a simplified, celebratory version;
Studio sees the numbers.

### FR-PRO-005 — Recording and playback (`C`)

Capture a performance as a note stream and play it back through the sampler, with
the score or falling notes following along. Useful for "listen to what you did"
and delightful for a child.

A recorded performance should also be exportable as a `.mid` file, written from the
piano's own note and sustain events with no audio model (`ADR-011`). Not scheduled.

### FR-PRO-006 — Saved / in-progress repertoire (`M`)

**Realised by:** `TA-DAT-007` · `US-3.15`

A short per-profile list of pieces currently being worked on — something the
adult can add a piece to and find again, distinct from `FR-PRO-002`'s derived
unlock/best-grade state. `TA-DAT-007` adds the `library` store this needs
(`TA-DAT-003` previously had nothing shaped like a saved list). Small in
scope: one new IndexedDB store, an add/remove action, and a filtered view of
the piece list.

---

## 5. Content

### FR-CON-001 — Static versioned content (`M`)

**Realised by:** `TA-DAT-005`, `TA-CNT-001`

Arrangements ship as immutable versioned JSON. No database read is ever required to
start practising.

### FR-CON-002 — Beginner catalogue, v1 (`M`)

**Realised by:** `TA-CNT-003`, `TA-CNT-004`

Eight to twelve hand-authored pieces spanning difficulty 1–2, sequenced per
ADR-008's four-stage progression. Traditional and folk melodies, public domain by
age.

### FR-CON-003 — Section segmentation (`M`)

**Realised by:** `TA-CNT-001` (stage 5)

Every arrangement is segmented into playable sections at phrase boundaries, falling
back to two bars. This is the unit `FR-EXP-004` operates on.

### FR-CON-004 — Licence provenance (`M`)

**Realised by:** `TA-CNT-005`

Every piece has a licence entry with source URL and verification date. The build
fails without one.

### FR-CON-005 — Fingering annotations (`C`)

Where the source provides them, carry fingerings through to the renderer. Do not
invent them algorithmically — bad fingering advice is worse than none.

---

## 6. Accounts and sync

### FR-SYN-001 — Household account (`M`)

**Realised by:** `TA-SYN-002`

There is no sign-in screen. The app signs in silently as one household account (name `family`, key baked into the build as `NEXT_PUBLIC_HOUSEHOLD_KEY`), so any copy built with the same Supabase project and key — localhost and the deployed site — shares one library: family members, PINs, progress and saved songs. The first use creates the account. The household key is not a secret from anyone with the build; it is a family door-latch, not real security (the per-member PIN is separate, `FR-PRO-001`). The username is wrapped in an address that cannot receive mail (`name@household.duokeys`) because Supabase Auth wants an email.

### FR-SYN-002 — Background sync (`M`)

**Realised by:** `TA-SYN-001`, `TA-SYN-004`

Attempts, settings and profiles sync in the background when online. Sync never
blocks, interrupts or delays a practice session. Failure is silent and retried.

### FR-SYN-003 — Restore on a new device (`M`)

**Realised by:** `TA-SYN-001` (pull)

Signing in on a fresh device pulls all profiles and history. This is the entire
point of ADR-004 — a lost laptop must not cost a year of progress.

### FR-SYN-004 — Sync status visibility (`S`)

A quiet indicator in settings: last synced, pending items, signed-in identity.
Never a modal, never a blocking spinner.

### FR-SYN-005 — Offline is not an error state (`M`)

**Realised by:** `ADR-003`, `NFR-005`

No warning banner, no degraded-mode messaging. The app is designed to be offline;
the network is the exception.

---

## 7. System, device and settings

### FR-SYS-001 — MIDI device selection (`M`)

**Realised by:** `TA-PORT-002`, `TA-MID-005`

List available inputs, remember the chosen one per profile, reconnect automatically
on next launch.

### FR-SYS-002 — Latency calibration wizard (`M`)

**Realised by:** `TA-CLK-004`

Tap-along against a click for sixteen beats; store the median offset. Offered on
first run, on instrument change, and on demand.

### FR-SYS-003 — First-run setup (`M`)

Connect instrument → choose or create profile → calibrate → play something within
three minutes. Nothing else is asked before the first note.

### FR-SYS-004 — Graceful disconnect handling (`M`)

**Realised by:** `TA-MID-005`

On mid-session disconnect: pause, preserve the in-progress attempt, show a calm
reconnect prompt. Never lose work, never show a stack trace.

### FR-SYS-005 — Missing Web MIDI support (`M`)

If `navigator.requestMIDIAccess` is absent (Safari, Firefox without the flag), show
a plain explanation and the list of browsers that work. Do not let a child arrive
at a blank screen.

### FR-SYS-006 — PWA install and wake lock (`S`)

**Realised by:** `TA-APP-004`

Installable to the desktop; screen wake lock held during an active session so the
display never sleeps mid-piece.

### FR-SYS-007 — Accessibility baseline (`M`)

**Realised by:** `NFR-008`, `NFR-009`, `NFR-011`

Colour is never the only signal. Touch targets ≥ 44 px. `prefers-reduced-motion`
honoured. Keyboard focus visible.

### FR-SYS-008 — Privacy posture (`M`)

**Realised by:** `NFR-010`

First names only, no child email address, no third-party analytics, no audio ever
leaves the device.

### FR-SYS-009 — Portuguese (`M`)

**Realised by:** `TA-APP-007`, `NFR-008` · `US-3.26`

The children do not read English, so the whole app can be shown in Brazilian
Portuguese. The family screen offers "English" and "Português" side by side, each named
in its own language; the first visit follows the browser's language (anything starting
`pt`), and the choice is remembered on that device. Every screen is covered: the
Explorer quest map, games and results, and the Studio home, Learn, Free play, Songs,
the chord library and sight-reading, plus text that comes from data (feelings such as
"Joyful", rhythm names, piece and generated-song titles, grading sentences, import
errors). Note names are written in solfège (Dó Ré Mi Fá Sol Lá Si); chord symbols such
as "Am7" and key letters stay as letters. Changing language never changes saved data,
progress or profiles. A phrase with no translation shows in English rather than blank.
The no-failure rule is unchanged: encouragement and "try this one again" wording are
translated, not softened or hardened.

Limits: two languages only (no per-profile language, no right-to-left, no plural
engine); the browser tab title and the page's initial `lang` attribute are English
until the app has started; music-theory and licence text from third parties (composer
names, Mutopia licence labels) is shown as published.

---

## 8. Requirement summary

| Module | Must | Should | Could | Total |
|---|---|---|---|---|
| Explorer | 5 | 3 | 1 | 9 |
| Studio | 8 | 10 | 2 | 20 |
| Duet | 3 | 1 | 0 | 4 |
| Profiles | 4 | 1 | 1 | 6 |
| Content | 4 | 0 | 1 | 5 |
| Sync | 4 | 1 | 0 | 5 |
| System | 8 | 1 | 0 | 9 |
| **Total** | **36** | **17** | **5** | **58** |

*(System's Must count was previously misstated as 6/8 — corrected to 7/8 here;
`FR-SYS-001`–`005` and `007`–`008` are all `M`, only `FR-SYS-006` is `S`.)*
