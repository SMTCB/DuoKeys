// TA-APP-003 `/` — the family screen (US-2.01). Everyone in the family is a tile; tapping one asks
// for that person's four-digit PIN, and "New family member" makes another (emoji, name, kid or
// adult, PIN). The PIN is a door-latch on a shared screen, not security (FR-PRO-001). Selecting a
// profile propagates it into sessionStore, which every Explorer page already reads reactively.
// US-3.23 / ADR-012 — a bold navigation home: each person is a Pop colour tile.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfileStore, MAX_PROFILES } from '../runtime/stores/profileStore';
import type { Profile } from '../core/profile/types';
import { PIN_LENGTH, isValidPin } from '../core/profile/pin';
import { PageShell } from '../ui/shared/PageShell';
import { StatusNote } from '../ui/shared/StatusNote';
import { Card } from '../ui/shared/Card';
import { Button } from '../ui/shared/Button';
import { AVATARS } from '../ui/shared/avatars';
import { useSyncStore } from '../runtime/stores/syncStore';
import styles from './family.module.css';

const fieldStyle = { font: 'inherit', padding: '0.7rem 0.9rem', minHeight: '44px', width: '100%', boxSizing: 'border-box' } as const;
const pinStyle = { ...fieldStyle, fontSize: '1.5rem', letterSpacing: '0.5rem', maxWidth: '10rem' } as const;

export default function HomePage() {
  const router = useRouter();
  const profiles = useProfileStore((s) => s.profiles);
  const loaded = useProfileStore((s) => s.loaded);
  const loadProfiles = useProfileStore((s) => s.loadProfiles);
  const addProfile = useProfileStore((s) => s.addProfile);
  const checkPin = useProfileStore((s) => s.checkPin);
  const selectProfile = useProfileStore((s) => s.selectProfile);
  const syncRound = useSyncStore((s) => s.syncRound);

  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Profile['role']>('explorer');
  const [avatar, setAvatar] = useState<string>(AVATARS[0]?.emoji ?? '🎹');
  const [newPin, setNewPin] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [asking, setAsking] = useState<Profile | undefined>();
  const [typedPin, setTypedPin] = useState('');
  const [isWrongPin, setIsWrongPin] = useState(false);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  // A sync can pull family members in from another device; show them without a reload.
  useEffect(() => {
    if (syncRound > 0) void loadProfiles();
  }, [syncRound, loadProfiles]);

  function enter(profile: Profile): void {
    selectProfile(profile.id);
    router.push(profile.role === 'student' ? '/studio' : '/explorer');
  }

  async function submitPin(pin: string): Promise<void> {
    if (!asking) return;
    if (await checkPin(asking.id, pin)) {
      enter(asking);
    } else {
      setIsWrongPin(true);
      setTypedPin('');
    }
  }

  function onPinChange(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setTypedPin(digits);
    setIsWrongPin(false);
    if (digits.length === PIN_LENGTH) void submitPin(digits);
  }

  async function handleAdd(): Promise<void> {
    const name = displayName.trim();
    if (!name || !avatar || !isValidPin(newPin)) return;
    const profile = await addProfile(name, role, avatar, newPin);
    setDisplayName('');
    setNewPin('');
    setIsAdding(false);
    enter(profile);
  }

  const canAdd = profiles.length < MAX_PROFILES;
  const roleChoices: { value: Profile['role']; icon: string; label: string }[] = [
    { value: 'explorer', icon: '🎮', label: 'Kid' },
    { value: 'student', icon: '🎼', label: 'Adult' },
  ];

  return (
    <PageShell tone={asking || isAdding ? 'calm' : 'bold'}>
      {loaded ? <h1>Who&apos;s playing?</h1> : <h1>DuoKeys</h1>}

      {!loaded && <StatusNote />}

      {loaded && !isAdding && !asking && (
        <>
          <div className={styles.people}>
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                className={[styles.person, p.role === 'student' ? styles.adult : styles.kid].join(' ')}
                onClick={() => {
                  setAsking(p);
                  setTypedPin('');
                  setIsWrongPin(false);
                }}
              >
                <span className={styles.avatar} aria-hidden="true">{p.avatar}</span>
                <span className={styles.name}>{p.displayName}</span>
              </button>
            ))}
          </div>
          {canAdd && (
            <div>
              <Button accent="coral" variant="secondary" onClick={() => setIsAdding(true)}>
                + New family member
              </Button>
            </div>
          )}
        </>
      )}

      {asking && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '2.5rem', lineHeight: 1 }} aria-hidden="true">{asking.avatar}</span>
            <h2 style={{ margin: 0 }}>{asking.displayName}</h2>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1rem' }}>
            Type your PIN
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              value={typedPin}
              onChange={(e) => onPinChange(e.target.value)}
              style={pinStyle}
            />
          </label>
          {isWrongPin && <p role="status">Not that one. Try again.</p>}
          <div style={{ marginTop: '1rem' }}>
            <Button variant="secondary" accent="coral" onClick={() => setAsking(undefined)}>
              Back
            </Button>
          </div>
        </Card>
      )}

      {loaded && isAdding && (
        <Card>
          <h2>New family member</h2>

          <p>Choose an emoji:</p>
          <div role="group" aria-label="Emoji" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1rem' }}>
            Name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="First name" style={fieldStyle} />
          </label>

          <p>Kid or adult?</p>
          <div role="radiogroup" aria-label="Kid or adult" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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
              </Button>
            ))}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1rem' }}>
            Choose a {PIN_LENGTH}-digit PIN
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
              style={pinStyle}
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '1rem' }}>
            <Button accent={role === 'student' ? 'indigo' : 'amber'} onClick={() => void handleAdd()} disabled={!displayName.trim() || !isValidPin(newPin)}>
              Add
            </Button>
            <Button variant="secondary" accent="coral" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}
    </PageShell>
  );
}
