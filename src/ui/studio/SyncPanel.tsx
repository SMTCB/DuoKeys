// US-2.02 — the adult's backup panel: household username and password, calm status, sign out.
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
  const { configured, status, email, pending, linkSent, signInProblem, init, signInWithPassword, signOut } = useSyncStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    void init();
  }, [init]);

  if (!configured) return null;

  const isSignedIn = email !== undefined;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (username.trim() && password) void signInWithPassword(username, password);
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
          <label htmlFor="sync-user" style={{ position: 'absolute', left: '-9999px' }}>
            Household username
          </label>
          <input
            id="sync-user"
            required
            autoComplete="username"
            autoCapitalize="none"
            placeholder="Household username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ flex: '1 1 10rem', minWidth: 0 }}
          />
          <label htmlFor="sync-pass" style={{ position: 'absolute', left: '-9999px' }}>
            Password
          </label>
          <input
            id="sync-pass"
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ flex: '1 1 10rem', minWidth: 0 }}
          />
          <Button accent="indigo" type="submit">
            Sign in or create
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
