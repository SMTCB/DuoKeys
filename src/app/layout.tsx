import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'DuoKeys',
  description: 'A shared piano practice app for a child and an adult.',
};

// Styling is out of scope for Sprint 1 (docs/03-SPRINT-PLAN.md) — this is the
// minimal shell App Router requires, nothing more.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
