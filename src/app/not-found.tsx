// US-3.21 — the branded "no page here" screen, instead of the framework's plain
// 404. Calm wording and one way back; nothing here reads as a mistake by the player.

import Link from 'next/link';
import { PageShell } from '../ui/shared/PageShell';
import { Button } from '../ui/shared/Button';
import stage from '../ui/shared/Stage.module.css';

export default function NotFound() {
  return (
    <PageShell>
      <div className={stage.stage}>
        <div className={stage.bigNote} aria-hidden="true">
          𝄽
        </div>
        <h1 className={stage.title}>Nothing to play on this page</h1>
        <p style={{ margin: 0 }}>Let&apos;s go back and pick who is playing.</p>
        <Link href="/">
          <Button>Back to the start</Button>
        </Link>
      </div>
    </PageShell>
  );
}
