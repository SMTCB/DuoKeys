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
import { StatusNote } from '../ui/shared/StatusNote';
import { Card } from '../ui/shared/Card';
import { Button } from '../ui/shared/Button';
import { AVATARS } from '../ui/shared/avatars';
import { SyncPanel } from '../ui/studio/SyncPanel';
import { useSyncStore } from '../runtime/stores/syncStore';

export default function HomePage() {
  const router = useRouter();
  const profiles = useProfileStore((s) => s.profiles);
  const loaded = useProfileStore((s) => s.loaded);
  const loadProfiles = useProfileStore((s) => s.loadProfiles);
  const addProfile = useProfileStore((s) => s.addProfile);
  const selectProfile = useProfileStore((s) => s.selectProfile);

  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Profile['role']>('explorer');
  const [avatar, setAvatar] = useState<string>(AVATARS[0]?.emoji ?? '🎹');
  const [isAdding, setIsAdding] = useState(false);

  const syncRound = useSyncStore((s) => s.syncRound);
  const isSyncSignedIn = useSyncStore((s) => s.email !== undefined);
  const isSyncConfigured = useSyncStore((s) => s.configured);
  const [restoredCount, setRestoredCount] = useState(0);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  // A sync can pull profiles in from another device; show them without a reload.
  useEffect(() => {
    if (syncRound === 0) return;
    const before = useProfileStore.getState().profiles.length;
    void loadProfiles().then(() => {
      const gained = useProfileStore.getState().profiles.length - before;
      if (gained > 0) setRestoredCount((n) => n + gained);
    });
  }, [syncRound, loadProfiles]);

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

  const canAdd = profiles.length < MAX_PROFILES;
  const isFormShown = loaded && canAdd && isAdding;
  const roleChoices: { value: Profile['role']; icon: string; label: string; hint: string }[] = [
    { value: 'explorer', icon: '🎮', label: 'Explorer', hint: 'for kids' },
    { value: 'student', icon: '🎼', label: 'Studio', hint: 'for grown-ups' },
  ];

  return (
    <PageShell>
      {loaded ? <h1>Who&apos;s playing?</h1> : <h1>DuoKeys</h1>}

      {!loaded && <StatusNote />}

      {loaded && profiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {profiles.map((p) => (
            <Button
              key={p.id}
              accent={p.role === 'student' ? 'indigo' : 'amber'}
              onClick={() => choose(p)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.2rem',
                minWidth: '7rem',
                borderRadius: '1.5rem',
                padding: '1rem 1.25rem',
              }}
            >
              <span style={{ fontSize: '2.5rem', lineHeight: 1 }} aria-hidden="true">{p.avatar}</span>
              <span>{p.displayName}</span>
            </Button>
          ))}
        </div>
      )}

      {loaded && restoredCount > 0 && (
        <p role="status">
          ✓ Brought {restoredCount === 1 ? 'one profile' : `${restoredCount} profiles`} over from your other device.
        </p>
      )}

      {loaded && canAdd && !isFormShown && (
        <div>
          <Button accent="coral" variant="secondary" onClick={() => setIsAdding(true)}>
            + Add a profile
          </Button>
        </div>
      )}

      {isFormShown && (
        <Card>
          <h2>Add a profile</h2>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            Name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="First name"
              style={{ font: 'inherit', padding: '0.7rem 0.9rem', minHeight: '44px', width: '100%', boxSizing: 'border-box' }}
            />
          </label>

          <p>Choose an avatar:</p>
          <div role="group" aria-label="Avatar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {AVATARS.map((a) => (
              <Button
                key={a.emoji}
                type="button"
                variant={avatar === a.emoji ? 'primary' : 'secondary'}
                onClick={() => setAvatar(a.emoji)}
                aria-pressed={avatar === a.emoji}
                aria-label={a.name}
              >
                {a.emoji}
              </Button>
            ))}
          </div>

          <p>Who is it for?</p>
          <div role="radiogroup" aria-label="Who is it for?" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {roleChoices.map((choice) => (
              <Button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={role === choice.value}
                accent={choice.value === 'student' ? 'indigo' : 'amber'}
                variant={role === choice.value ? 'primary' : 'secondary'}
                onClick={() => setRole(choice.value)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '8rem', borderRadius: '1.25rem' }}
              >
                <span style={{ fontSize: '1.75rem', lineHeight: 1 }} aria-hidden="true">{choice.icon}</span>
                <span>{choice.label}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>{choice.hint}</span>
              </Button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '1rem' }}>
            <Button
              accent={role === 'student' ? 'indigo' : 'amber'}
              onClick={() => void handleAdd()}
              disabled={!displayName.trim()}
            >
              Add profile
            </Button>
            {!displayName.trim() && <span style={{ opacity: 0.75 }}>Type a name to start</span>}
          </div>
        </Card>
      )}

      {loaded && isSyncConfigured && (
        <details open={profiles.length === 0 && !isSyncSignedIn} className="restore">
          <summary style={{ minHeight: '44px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>
            {profiles.length === 0 ? 'Used DuoKeys on another device? Bring your profiles over' : 'Backup and other devices (grown-ups)'}
          </summary>
          <SyncPanel />
        </details>
      )}
    </PageShell>
  );
}
