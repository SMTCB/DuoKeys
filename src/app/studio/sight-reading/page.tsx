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
import { Segmented } from '../../../ui/shared/Segmented';
import controls from '../../../ui/shared/Controls.module.css';

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
        <div className={controls.stack}>
          <Segmented
            name="keySig"
            legend="Key"
            options={KEY_OPTIONS.map((k) => ({ value: k, label: k }))}
            value={keySig}
            onChange={setKeySig}
          />
          <Segmented
            name="bars"
            legend="Length"
            options={BAR_OPTIONS.map((b) => ({ value: b, label: `${b} bars` }))}
            value={bars}
            onChange={setBars}
          />
          <label className={controls.tempo}>
            <span className={controls.tempoLabel}>
              Tempo <span className={controls.readout}>{tempoBpm} bpm</span>
            </span>
            <input
              type="range"
              min={40}
              max={140}
              step={5}
              value={tempoBpm}
              onChange={(e) => setTempoBpm(Number(e.target.value))}
            />
          </label>
          <div>
            <Button accent="indigo" onClick={handleGenerate}>
              Generate a phrase
            </Button>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
