// TA-APP-003 `/studio` — the adult home, three tracks (FR-STU-017/018/019):
// Learn (a roadmap and exercises), Free play (chords and "play something for me"),
// and Songs (My songs, adding your own, the library). Sight-reading and the chord
// library stay one tap away from inside their tracks; backup lives here.
// US-3.21 — tracks drawn as picture-led cards.

'use client';

import { PageShell } from '../../ui/shared/PageShell';
import { ActionCard } from '../../ui/shared/ActionCard';
import { SyncPanel } from '../../ui/studio/SyncPanel';

export default function StudioHomePage() {
  return (
    <PageShell>
      <h1>Studio</h1>
      <ActionCard href="/studio/learn" icon="🎓" title="Learn" description="A gentle roadmap back to the piano, with warm-ups and exercises." />
      <ActionCard href="/studio/free-play" icon="🌿" title="Free play" description="Sit down and unwind. Chords, and something easy suggested for you." />
      <ActionCard href="/studio/songs" icon="🎵" title="Songs" description="My songs, add one you love, and the song library." />
      <SyncPanel />
    </PageShell>
  );
}
