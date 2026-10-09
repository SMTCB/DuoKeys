// TA-APP-003 `/explorer` — the piece list (US-2.09), routing into
// `/explorer/[arrangementId]`'s quest map. Client component: `ContentBackend`
// is fetch-based (TA-PORT-003), same reasoning as the quest map it links
// into.
// US-3.23 / ADR-012 — a bold navigation home: Pop colour tiles. The colours
// cycle for variety; each tile also carries its title and number, so colour is
// never the only cue (NFR-008).

'use client';

import { useEffect, useState } from 'react';
import { getAdapters } from '../../runtime/bootstrap';
import type { ContentIndex } from '../../adapters/ports';
import { useT } from '../../ui/i18n/useT';
import { PageShell } from '../../ui/shared/PageShell';
import { StatusNote } from '../../ui/shared/StatusNote';
import { ActionCard, ActionGrid } from '../../ui/shared/ActionCard';
import type { PopCorner } from '../../ui/shared/ActionCard';
import type { PopColour } from '../../ui/shared/PopShape';

const PIECE_COLOURS: PopColour[] = ['mustard', 'peach', 'cream', 'cornflower'];
const PIECE_CORNERS: PopCorner[] = ['tl', 'tr', 'br', 'bl'];

export default function ExplorerListPage() {
  const t = useT();
  const [index, setIndex] = useState<ContentIndex | undefined>();

  useEffect(() => {
    let cancelled = false;
    getAdapters().content.index().then((i) => {
      if (!cancelled) setIndex(i);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!index) return <PageShell tone="bold"><StatusNote /></PageShell>;

  return (
    <PageShell tone="bold">
      <h1>{t('What shall we play?')}</h1>
      <ActionGrid>
        <ActionCard
          variant="tile"
          colour="tomato"
          shape="circle"
          shapeColour="mustard"
          corner="tl"
          href="/explorer/ninja"
          title={t('Note Ninja')}
          description={t('Find the note, fast!')}
        />
        <ActionCard
          variant="tile"
          colour="cornflower"
          shape="quarter"
          shapeColour="peach"
          corner="tr"
          href="/explorer/free-play"
          title={t('Free Play')}
          description={t('Press any key and make music.')}
        />
      </ActionGrid>
      <h2>{t('Pieces')}</h2>
      <ActionGrid min="small">
        {index.pieces.map((piece, i) => (
          <ActionCard
            key={piece.id}
            variant="tile"
            colour={PIECE_COLOURS[i % PIECE_COLOURS.length] ?? 'mustard'}
            corner={PIECE_CORNERS[i % PIECE_CORNERS.length] ?? 'tl'}
            href={`/explorer/${piece.defaultArrangementId}`}
            icon={i + 1}
            title={t(piece.title)}
          />
        ))}
      </ActionGrid>
    </PageShell>
  );
}
