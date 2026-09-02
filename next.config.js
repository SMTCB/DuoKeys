/** @type {import('next').NextConfig} */
// Must stay `output: 'export'` compatible (TA-APP-001, ADR-002) — no server-only
// APIs (route handlers with server state, middleware) on any route the iPad path
// would need. Not yet switched to static export: dynamic routes under
// src/app/**/[id] don't have generateStaticParams wired up until content exists
// (Sprint 2, US-2.08). Revisit before that lands.
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
