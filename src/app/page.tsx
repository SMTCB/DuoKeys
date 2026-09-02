// TA-APP-003 `/` — profile picker. Sprint 1 has no profile-management story
// (docs/03-SPRINT-PLAN.md), so there is one hardcoded profile and one
// hardcoded arrangement (US-1.13) to link into — a real picker is later work.

import Link from 'next/link';
import { DEFAULT_PROFILE } from '../runtime/defaultProfile';

export default function HomePage() {
  return (
    <main>
      <h1>DuoKeys</h1>
      <p>Welcome, {DEFAULT_PROFILE.displayName} {DEFAULT_PROFILE.avatar}</p>
      <Link href="/explorer">Play Mary Had a Little Lamb</Link>
    </main>
  );
}
