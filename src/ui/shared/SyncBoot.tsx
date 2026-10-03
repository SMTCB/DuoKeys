// Starts background sync once for the whole app, so attempts played in
// Explorer are backed up even if the adult never opens Studio (US-2.03).
// Renders nothing.

'use client';

import { useEffect } from 'react';
import { useSyncStore } from '../../runtime/stores/syncStore';

export function SyncBoot() {
  const init = useSyncStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);
  return null;
}
