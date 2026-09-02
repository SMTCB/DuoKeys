// eslint.config.js — boundary rules per TA-PORT-005 (docs/01-TECHNICAL-ARCHITECTURE.md)
import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

const config = [
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react-*', 'next', 'next/*'], message: 'core must stay pure — see TA-PORT-001' },
          { group: ['@supabase/*', 'idb', 'tone', 'webmidi'], message: 'core must stay pure — use a port (TA-PORT-002)' },
          { group: ['../adapters/*', '../ui/*', '../runtime/*', '**/adapters/*', '**/ui/*', '**/runtime/*'], message: 'dependencies point inward only — see TA-PORT-001' },
        ],
      }],
    },
  },
  {
    files: ['src/adapters/**/*.ts', 'src/adapters/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['../ui/*', '../runtime/*', '**/ui/*', '**/runtime/*'], message: 'adapters must never import ui/ or runtime/ — see TA-PORT-001' },
        ],
      }],
    },
  },
];

export default config;
