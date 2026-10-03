// TA-APP-003 `/studio/sight-reading` — US-3.10. Picks options, generates a
// phrase "never seen before" (FR-STU-010) via generateSightReadingArrangement,
// stashes it in generatedContentStore (not content/sources/ — TA-CNT-004
// keeps sight-reading a runtime generator, not build-time content), then
// routes straight into the ordinary /studio/play/[id] view.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateSightReadingArrangement } from '../../../core/content/sightReading';
import { useGeneratedContentStore } from '../../../runtime/stores/generatedContentStore';
import { PageShell } from '../../../ui/shared/PageShell';
import { Card } from '../../../ui/shared/Card';
import { Button } from '../../../ui/shared/Button';

const KEY_OPTIONS = ['C', 'G', 'F'];
const BAR_OPTIONS = [4, 8, 12];

export default function SightReadingPage() {
  const router = useRouter();
  const put = useGeneratedContentStore((s) => s.put);
  const [keySig, setKeySig] = useState('C');
  const [bars, setBars] = useState(8);
  const [tempoBpm, setTempoBpm] = useState(90);

  function handleGenerate(): void {
    const arrangement = generateSightReadingArrangement(Math.random, {
      id: crypto.randomUUID(),
      keySig,
      bars,
      tempoBpm,
    });
    put(arrangement);
    router.push(`/studio/play/${arrangement.id}`);
  }

  return (
    <PageShell>
      <h1>Sight-Reading</h1>
      <Card>
        <p>A fresh phrase every time — never one you have already memorised.</p>
        <p>
          Key:{' '}
          {KEY_OPTIONS.map((k) => (
            <label key={k} style={{ marginRight: '1rem' }}>
              <input type="radio" name="keySig" value={k} checked={keySig === k} onChange={() => setKeySig(k)} />
              {' '}
              {k}
            </label>
          ))}
        </p>
        <p>
          Length:{' '}
          {BAR_OPTIONS.map((b) => (
            <label key={b} style={{ marginRight: '1rem' }}>
              <input type="radio" name="bars" value={b} checked={bars === b} onChange={() => setBars(b)} />
              {' '}
              {b} bars
            </label>
          ))}
        </p>
        <p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '20rem' }}>
            Tempo {tempoBpm} bpm
            <input
              type="range"
              min={40}
              max={140}
              step={5}
              value={tempoBpm}
              onChange={(e) => setTempoBpm(Number(e.target.value))}
            />
          </label>
        </p>
        <Button accent="indigo" onClick={handleGenerate}>
          Generate
        </Button>
      </Card>
    </PageShell>
  );
}
