// TA-APP-003 `/` — the profile picker (US-2.01). Client component: switching
// or adding a profile is one tap, no password (FR-PRO-001) — this is a
// family device. Selecting a profile propagates it into sessionStore, which
// every Explorer page already reads reactively.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfileStore, MAX_PROFILES } from '../runtime/stores/profileStore';
import type { Profile } from '../core/profile/types';
import { PageShell } from '../ui/shared/PageShell';
import { Card } from '../ui/shared/Card';
import { Button } from '../ui/shared/Button';

const AVATARS = ['🎹', '🐣', '🦊', '🐢', '🌟', '🎧'];

export default function HomePage() {
  const router = useRouter();
  const profiles = useProfileStore((s) => s.profiles);
  const loaded = useProfileStore((s) => s.loaded);
  const loadProfiles = useProfileStore((s) => s.loadProfiles);
  const addProfile = useProfileStore((s) => s.addProfile);
  const selectProfile = useProfileStore((s) => s.selectProfile);

  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Profile['role']>('explorer');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  function choose(profile: Profile): void {
    selectProfile(profile.id);
    router.push(profile.role === 'student' ? '/studio' : '/explorer');
  }

  async function handleAdd(): Promise<void> {
    const name = displayName.trim();
    if (!name || !avatar) return;
    const profile = await addProfile(name, role, avatar);
    setDisplayName('');
    choose(profile);
  }

  return (
    <PageShell>
      <h1>DuoKeys</h1>

      {!loaded && <p>Loading…</p>}

      {loaded && profiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {profiles.map((p) => (
            <Button
              key={p.id}
              accent={p.role === 'student' ? 'indigo' : 'amber'}
              onClick={() => choose(p)}
            >
              {p.avatar} {p.displayName}
            </Button>
          ))}
        </div>
      )}

      {loaded && profiles.length === 0 && <p>Who&apos;s playing? Add your first profile below.</p>}

      {loaded && profiles.length < MAX_PROFILES && (
        <Card>
          <h2>Add a profile</h2>
          <p>
            <label>
              Name{' '}
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="First name"
              />
            </label>
          </p>

          <p>Choose an avatar:</p>
          <p style={{ display: 'flex', gap: '0.5rem' }}>
            {AVATARS.map((a) => (
              <Button
                key={a}
                type="button"
                variant={avatar === a ? 'primary' : 'secondary'}
                onClick={() => setAvatar(a)}
                aria-pressed={avatar === a}
              >
                {a}
              </Button>
            ))}
          </p>

          <p>
            <label>
              <input
                type="radio"
                name="role"
                value="explorer"
                checked={role === 'explorer'}
                onChange={() => setRole('explorer')}
              />
              Explorer (kid)
            </label>{' '}
            <label>
              <input
                type="radio"
                name="role"
                value="student"
                checked={role === 'student'}
                onChange={() => setRole('student')}
              />
              Studio (grown-up)
            </label>
          </p>

          <Button
            accent={role === 'student' ? 'indigo' : 'amber'}
            onClick={() => void handleAdd()}
            disabled={!displayName.trim()}
          >
            Add profile
          </Button>
        </Card>
      )}
    </PageShell>
  );
}
