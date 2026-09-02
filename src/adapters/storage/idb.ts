// TA-PORT-003 v1 adapter — IndexedDB via `idb`. TA-DAT-002/003.
//
// Every object store is created without an inline keyPath: the StorageBackend
// contract's put<T>(store, value) has no separate key parameter, and two
// stores (progression, flashcards) use compound keys that don't exist as a
// single field on the value. Keys are derived once, via the same keyOf() the
// fake uses, and passed explicitly to IDB's put(value, key) — this is what
// keeps FakeStorageBackend and IdbBackend behaviorally identical (TA-PORT-004).

import { openDB, type IDBPDatabase } from 'idb';
import type { KeyRange, StorageBackend, StoreName, Tx } from '../ports';
import { keyOf } from './keyOf';
import { matchesRange } from './queryFilter';

const DB_NAME = 'duokeys';
const DB_VERSION = 1;

const STORES: readonly StoreName[] = [
  'profiles',
  'arrangements',
  'attempts',
  'progression',
  'flashcards',
  'settings',
  'outbox',
];

export class IdbBackend implements StorageBackend {
  private dbPromise: Promise<IDBPDatabase> | undefined;

  private db(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          for (const store of STORES) {
            if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
          }
        },
      });
    }
    return this.dbPromise;
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.db();
    return db.get(store, key) as Promise<T | undefined>;
  }

  async put<T>(store: StoreName, value: T): Promise<void> {
    const db = await this.db();
    await db.put(store, value, keyOf(store, value));
  }

  async query<T>(store: StoreName, index: string, range: KeyRange): Promise<T[]> {
    const db = await this.db();
    const all = (await db.getAll(store)) as T[];
    return all.filter((v) => matchesRange(v, index, range));
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.db();
    await db.delete(store, key);
  }

  async transaction<T>(stores: StoreName[], fn: (tx: Tx) => Promise<T>): Promise<T> {
    const db = await this.db();
    const idbTx = db.transaction(stores, 'readwrite');
    const tx: Tx = {
      get: async (store, key) => idbTx.objectStore(store).get(key),
      put: async (store, value) => {
        await idbTx.objectStore(store).put(value, keyOf(store, value));
      },
      delete: async (store, key) => {
        await idbTx.objectStore(store).delete(key);
      },
    };
    const result = await fn(tx);
    await idbTx.done;
    return result;
  }
}
