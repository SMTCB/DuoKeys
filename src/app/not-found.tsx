// US-3.21 — the branded "no page here" screen, instead of the framework's plain
// 404. Calm wording and one way back; nothing here reads as a mistake by the player.
// US-3.24 / ADR-012 — a navigation surface, so it is bold: a cluster of Pop
// shapes takes the place of the rest sign.

'use client';

import Link from 'next/link';
import { PageShell } from '../ui/shared/PageShell';
import { Button } from '../ui/shared/Button';
import { PopShape } from '../ui/shared/PopShape';
import { useT } from '../ui/i18n/useT';
import stage from '../ui/shared/Stage.module.css';

export default function NotFound() {
  const t = useT();
  return (
    <PageShell tone="bold">
      <div className={stage.stage}>
        <div className={stage.popCluster} aria-hidden="true">
          <PopShape shape="arch" colour="tomato" size={88} />
          <PopShape shape="circle" colour="mustard" size={60} />
          <PopShape shape="quarter" colour="cornflower" size={72} />
        </div>
        <h1 className={stage.title}>{t('Nothing to play on this page')}</h1>
        <p style={{ margin: 0 }}>{t("Let's go back and pick who is playing.")}</p>
        <Link href="/">
          <Button>{t('Back to the start')}</Button>
        </Link>
      </div>
    </PageShell>
  );
}
