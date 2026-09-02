// TA-PORT-004 — deterministic in-memory StorageBackend (TA-DAT-003 stores).
// Key derivation and range filtering are shared with IdbBackend so a fixture
// written through this fake reads back exactly as the real adapter would.

import type { KeyRange, StorageBackend, StoreName, Tx } from '../ports';
import { keyOf } from '../storage/keyOf';
import { matchesRange } from '../storage/queryFilter';

export class FakeStorageBackend implements StorageBackend {
  private readonly data = new Map<StoreName, Map<string, unknown>>();

  private storeFor(store: StoreName): Map<string, unknown> {
    let m = this.data.get(store);
    if (!m) {
      m = new Map();
      this.data.set(store, m);
    }
    return m;
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return this.storeFor(store).get(key) as T | undefined;
  }

  async put<T>(store: StoreName, value: T): Promise<void> {
    this.storeFor(store).set(keyOf(store, value), value);
  }

  async query<T>(store: StoreName, index: string, range: KeyRange): Promise<T[]> {
    const values = [...this.storeFor(store).values()] as T[];
    return values.filter((v) => matchesRange(v, index, range));
  }

  async delete(store: StoreName, key: string): Promise<void> {
    this.storeFor(store).delete(key);
  }

  async transaction<T>(_stores: StoreName[], fn: (tx: Tx) => Promise<T>): Promise<T> {
    // A fake has no real isolation to offer — every op already lands
    // directly on the same maps `get`/`put`/`delete` use.
    const tx: Tx = {
      get: (store, key) => this.get(store, key),
      put: (store, value) => this.put(store, value),
      delete: (store, key) => this.delete(store, key),
    };
    return fn(tx);
  }
}
