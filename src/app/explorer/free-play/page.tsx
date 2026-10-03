// TA-APP-003 `/explorer/free-play` — US-2.19. Ungraded (FR-EXP-006): every
// key on the connected piano just sounds, no Attempt is ever written.

'use client';

import { FreePlay } from '../../../ui/explorer/FreePlay';
import { PageShell } from '../../../ui/shared/PageShell';

export default function FreePlayPage() {
  return (
    <PageShell>
      <h1>Free Play</h1>
      <FreePlay />
    </PageShell>
  );
}
