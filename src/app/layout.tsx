import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import './globals.css';
import { SyncBoot } from '../ui/shared/SyncBoot';

export const metadata: Metadata = {
  title: 'DuoKeys',
  description: 'A shared piano practice app for a child and an adult.',
};

// US-3.16 — the three DuoKeys Design Reference typefaces, loaded as CSS
// variables and consumed by globals.css's --display/--ui/--mono tokens.
// Self-hosted from @fontsource packages: a build never depends on reaching
// Google Fonts (a failed fetch there broke the first Vercel deploy), and no
// visitor's browser contacts a third party (NFR-010).
const displayFont = localFont({
  src: '../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--font-display',
});
const uiFont = localFont({
  src: [
    { path: '../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
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
