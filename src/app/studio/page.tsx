// TA-APP-003 `/studio` — the adult home, three tracks (FR-STU-017/018/019):
// Learn (a roadmap and exercises), Free play (chords and "play something for me"),
// and Songs (My songs, adding your own, the library). Sight-reading and the chord
// library stay one tap away from inside their tracks; backup lives here.
// US-3.21 — tracks drawn as picture-led cards.
// US-3.23 / ADR-012 — a bold navigation home on the cornflower ground; Pop
// shapes replace the emoji pictures.

'use client';

import { useT } from '../../ui/i18n/useT';
import { PageShell } from '../../ui/shared/PageShell';
import { ActionCard, ActionList } from '../../ui/shared/ActionCard';

export default function StudioHomePage() {
  const t = useT();
  return (
    <PageShell tone="bold">
      <h1>{t('Studio')}</h1>
      <ActionList>
        <ActionCard href="/studio/learn" shape="circle" shapeColour="tomato" corner="tl" title={t('Learn')} description={t('A gentle roadmap back to the piano, with warm-ups and exercises.')} />
        <ActionCard href="/studio/free-play" shape="square" shapeColour="mustard" corner="br" title={t('Free play')} description={t('Sit down and unwind. Chords, and something easy suggested for you.')} />
        <ActionCard href="/studio/songs" shape="arch" shapeColour="peach" corner="tr" title={t('Songs')} description={t('My songs, add one you love, and the song library.')} />
      </ActionList>
    </PageShell>
  );
}
