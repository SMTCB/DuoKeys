// US-2.02 — the adult's backup panel: email magic link, calm status, sign out.
// Adult-only (TA-SYN-002) and deliberately free of error language about being
// offline (FR-SYN-005): "waiting to back up" is a state, not a failure.

'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useSyncStore, type SyncStatus } from '../../runtime/stores/syncStore';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';

const STATUS_TEXT: Record<SyncStatus, string> = {
  unavailable: '',
  'signed-out': 'Not backed up yet. Everything is saved on this device.',
  syncing: 'Backing up…',
  'backed-up': 'Backed up.',
  behind: 'Saved on this device. Backup will catch up when the connection returns.',
};

export function SyncPanel() {
  const { configured, status, email, pending, linkSent, signInProblem, init, signIn, signOut } = useSyncStore();
  const [address, setAddress] = useState('');

  useEffect(() => {
    void init();
  }, [init]);

  if (!configured) return null;

  const isSignedIn = email !== undefined;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (address.trim()) void signIn(address);
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: '2.5rem', height: '2.5rem', borderRadius: 'var(--r-md)', background: 'var(--indigo-tint, var(--role-tint))', fontSize: '1.25rem' }}>☁️</span>
        <strong style={{ fontFamily: 'var(--display)', fontSize: '1.05rem' }}>Backup and other devices</strong>
      </div>
      {isSignedIn ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <p style={{ margin: '0.25rem 0 0' }} role="status">
            {email} · {STATUS_TEXT[status]}
            {pending > 0 ? ` ${pending} to go.` : ''}
          </p>
          <Button accent="indigo" variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      ) : linkSent ? (
        <p style={{ margin: '0.25rem 0 0' }} role="status">
          Check your email for the sign-in link, then open it on this device.
        </p>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <label htmlFor="sync-email" style={{ position: 'absolute', left: '-9999px' }}>
            Your email address
          </label>
          <input
            id="sync-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ flex: '1 1 14rem', minWidth: 0 }}
          />
          <Button accent="indigo" type="submit">
            Email me a sign-in link
          </Button>
        </form>
      )}
      {signInProblem !== undefined && !isSignedIn && (
        <p style={{ margin: '0.5rem 0 0' }} role="alert">
          {signInProblem}
        </p>
      )}
      {!isSignedIn && !linkSent && <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>{STATUS_TEXT[status]}</p>}
    </Card>
  );
}
