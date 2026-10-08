import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import './globals.css';
import { SyncBoot } from '../ui/shared/SyncBoot';

export const metadata: Metadata = {
  title: 'DuoKeys',
  description: 'A shared piano practice app for a child and an adult.',
};

// US-3.16 — the DuoKeys typefaces, loaded as CSS variables and consumed by
// globals.css's --display/--ui/--mono tokens. ADR-012 / US-3.23 — Bagel Fat One
// (display, one weight) and Nunito (UI, variable) replace Bricolage Grotesque
// and Plus Jakarta Sans; IBM Plex Mono stays for numbers.
// Self-hosted from @fontsource packages: a build never depends on reaching
// Google Fonts (a failed fetch there broke the first Vercel deploy), and no
// visitor's browser contacts a third party (NFR-010).
const displayFont = localFont({
  src: '../../node_modules/@fontsource/bagel-fat-one/files/bagel-fat-one-latin-400-normal.woff2',
  weight: '400',
  variable: '--font-display',
});
const uiFont = localFont({
  src: '../../node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2',
  weight: '200 1000',
  variable: '--font-ui',
});
const monoFont = localFont({
  src: [
    { path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-mono',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${uiFont.variable} ${monoFont.variable}`}>
      <body>
        <SyncBoot />
        {children}
      </body>
    </html>
  );
}
