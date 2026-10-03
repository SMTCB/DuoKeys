import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

export const metadata: Metadata = {
  title: 'DuoKeys',
  description: 'A shared piano practice app for a child and an adult.',
};

// US-3.16 — the three DuoKeys Design Reference typefaces, loaded as CSS
// variables and consumed by globals.css's --display/--ui/--mono tokens.
const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
});
const uiFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
});
const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-mono',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${uiFont.variable} ${monoFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
