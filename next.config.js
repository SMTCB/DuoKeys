/** @type {import('next').NextConfig} */
// Must stay `output: 'export'` compatible (TA-APP-001, ADR-002) — no server-only
// APIs (route handlers with server state, middleware) on any route the iPad path
// would need. Not yet switched to static export: dynamic routes under
// src/app/**/[id] and src/app/explorer/[arrangementId] don't have
// generateStaticParams wired up yet — a separate verification step, deliberately
// not done as a side effect of the content pipeline landing (US-2.07/2.09).
// Revisit before flipping this on.
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
