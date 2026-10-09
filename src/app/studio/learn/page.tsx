// TA-APP-003 `/studio/learn` — track 1, Learn (FR-STU-019). A short roadmap for a returning
// beginner: warm the hands, read a little, learn the chords that unlock most songs, then
// unwind. Each step opens the tool that already exists; the Hanon drills run slowly by default.

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { generateHanonArrangement, HANON_PATTERNS } from '../../../core/content/hanon';
import { useLearnStore } from '../../../runtime/stores/learnStore';
import { useSessionStore } from '../../../runtime/stores/sessionStore';
import { useGeneratedContentStore } from '../../../runtime/stores/generatedContentStore';
import { useT } from '../../../ui/i18n/useT';
import { PageShell } from '../../../ui/shared/PageShell';
import { Card } from '../../../ui/shared/Card';
import { Button } from '../../../ui/shared/Button';
import { Pill } from '../../../ui/shared/Pill';

const WARM_UP_BPM = 60;

interface Step {
  title: string;
  minutes: string;
  why: string;
  href?: string;
  cta?: string;
}

const STAGES: { label: string; blurb: string; steps: Step[] }[] = [
  {
    label: '1 · Warm the hands',
    blurb: 'Five slow minutes. Even, quiet notes beat fast ones.',
    steps: [],
  },
  {
    label: '2 · Read a little',
    blurb: 'A fresh four-bar phrase each time. Keep it in C until it feels easy.',
    steps: [
      { title: 'Sight-reading, 4 bars in C', minutes: '5 min', why: 'Builds reading without memorising.', href: '/studio/sight-reading', cta: 'Open sight-reading' },
    ],
  },
  {
    label: '3 · Four chords, a hundred songs',
    blurb: 'C, G, Am and F cover most pop songs. Learn them in one hand, then two.',
    steps: [
      { title: 'The chord library in C', minutes: '10 min', why: 'See each chord, play it, and hear how they follow each other.', href: '/studio/chords', cta: 'Open the chord library' },
    ],
  },
  {
    label: '4 · Play to unwind',
    blurb: 'The point of all this. No goals, no score.',
    steps: [
      { title: 'Free play', minutes: 'as long as you like', why: 'The app suggests easy chords and a rhythm; you just play.', href: '/studio/free-play', cta: 'Go to Free play' },
      { title: 'A song you love', minutes: 'a little each day', why: 'Add it to My songs and pick up where you left off.', href: '/studio/songs', cta: 'Go to Songs' },
    ],
  },
];

// A tick is a private note to self (FR-STU-019): one tap on, one tap off, nothing counted.
function TickButton({ stepId }: { stepId: string }) {
  const t = useT();
  const isDone = useLearnStore((s) => s.done.includes(stepId));
  const toggle = useLearnStore((s) => s.toggle);
  return (
    <Button accent="indigo" variant="secondary" onClick={() => void toggle(stepId)} aria-pressed={isDone}>
      {isDone ? t('✓ Done') : t('Mark done')}
    </Button>
  );
}

export default function LearnPage() {
  const t = useT();
  const router = useRouter();
  const put = useGeneratedContentStore((s) => s.put);
  const profileId = useSessionStore((s) => s.profile.id);
  const loadDone = useLearnStore((s) => s.load);

  useEffect(() => {
    void loadDone();
  }, [loadDone, profileId]);

  function startDrill(patternId: string): void {
    const pattern = HANON_PATTERNS.find((p) => p.id === patternId);
    if (!pattern) return;
    const arrangement = generateHanonArrangement(pattern, { tempoBpm: WARM_UP_BPM });
    put(arrangement);
    router.push(`/studio/play/${arrangement.id}`);
  }

  return (
    <PageShell>
      <h1>{t('Learn')}</h1>
      <p>
        {t('A gentle path back to the piano. Do as much or as little as you feel like; there is no order you have to keep.')}{' '}
        <Link href="/studio">{t('Back to Studio')}</Link>
      </p>

      {STAGES.map((stage, i) => (
        <Card key={stage.label}>
          <h2>{t(stage.label)}</h2>
          <p>{t(stage.blurb)}</p>
          {i === 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {HANON_PATTERNS.map((p) => (
                <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <span>
                    <strong>{t(p.title)}</strong> <Pill tone="neutral">{t('{bpm} bpm', { bpm: WARM_UP_BPM })}</Pill>
                  </span>
                  <span style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button accent="indigo" variant="secondary" onClick={() => startDrill(p.id)}>
                      {t('Start')}
                    </Button>
                    <TickButton stepId={`drill:${p.id}`} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {stage.steps.map((step) => (
            <div key={step.title} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
              <strong>
                {t(step.title)} <Pill tone="neutral">{t(step.minutes)}</Pill>
              </strong>
              <span>{t(step.why)}</span>
              {step.href && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link href={step.href}>
                    <Button accent="indigo">{t(step.cta ?? 'Open')}</Button>
                  </Link>
                  <TickButton stepId={`step:${step.title}`} />
                </div>
              )}
            </div>
          ))}
        </Card>
      ))}
    </PageShell>
  );
}
