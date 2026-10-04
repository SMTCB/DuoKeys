// Starts background sync once for the whole app, so attempts played in
// Explorer are backed up even if the adult never opens Studio (US-2.03).
// Also re-activates the profile chosen before a reload. Renders nothing.

'use client';

import { useEffect } from 'react';
import { useSyncStore } from '../../runtime/stores/syncStore';
import { useProfileStore } from '../../runtime/stores/profileStore';

export function SyncBoot() {
  const init = useSyncStore((s) => s.init);
  const restoreActiveProfile = useProfileStore((s) => s.restoreActiveProfile);
  useEffect(() => {
    void init();
    void restoreActiveProfile();
  }, [init, restoreActiveProfile]);
  return null;
}
