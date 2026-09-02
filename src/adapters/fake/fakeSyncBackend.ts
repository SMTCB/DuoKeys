// TA-PORT-004 — deterministic fake SyncBackend. Sprint 1 has no real
// SupabaseBackend (sync flush is explicitly out of scope, docs/03-SPRINT-PLAN.md),
// so this fake is currently the only SyncBackend implementation in the tree.

import type { Cursor, OutboxOp, PullResult, PushResult, SyncBackend, SyncUser } from '../ports';

export class FakeSyncBackend implements SyncBackend {
  private user: SyncUser | null = null;
  readonly pushedOps: OutboxOp[] = [];

  async signIn(email: string): Promise<void> {
    this.user = { id: 'fake-user', email };
  }

  async signOut(): Promise<void> {
    this.user = null;
  }

  async currentUser(): Promise<SyncUser | null> {
    return this.user;
  }

  async push(ops: OutboxOp[]): Promise<PushResult> {
    this.pushedOps.push(...ops);
    return { accepted: ops.length };
  }

  async pull(_since: Cursor): Promise<PullResult> {
    return { cursor: 'fake-cursor', changes: [] };
  }
}
