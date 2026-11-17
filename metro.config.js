const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

// The backend (server/) is a separate Node project: never bundle or watch it.
// Its node_modules would otherwise double Metro's file-watching memory.
// Escape each path segment (the project path contains "(1)") and accept / or \ between them.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const serverDir = path
  .resolve(__dirname, 'server')
  .split(/[/\\]/)
  // Windows may report the drive as "C:" or "c:"; Metro forbids regex flags here, so match both.
  .map((seg, i) => (i === 0 && /^[A-Za-z]:$/.test(seg) ? `[${seg[0].toUpperCase()}${seg[0].toLowerCase()}]:` : escapeRe(seg)))
  .join('[/\\\\]');
const serverPattern = new RegExp(`^${serverDir}[/\\\\].*`);
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  serverPattern,
];

// ── Development API proxy ─────────────────────────────────────────────────────
// Phones often cannot reach the laptop directly (Wi-Fi client isolation), but they can
// reach this Metro dev server (LAN or Expo tunnel). Requests to /v1/* and /uploads/*
// are forwarded to the local API, so the app needs no second tunnel or extra account.
// Development only — production builds talk to EXPO_PUBLIC_API_URL directly.
const http = require('http');
const API_TARGET = new URL(process.env.MANUVER_API_PROXY_TARGET || 'http://127.0.0.1:4000');
const PROXIED = /^\/(v1|uploads)(\/|$)/;

function proxyToApi(req, res) {
  const upstream = http.request(
    {
      hostname: API_TARGET.hostname,
      port: API_TARGET.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: API_TARGET.host },
    },
    (apiRes) => {
      res.writeHead(apiRes.statusCode || 502, apiRes.headers);
      apiRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'api_unreachable', message: 'The Manuver API is not running (cd server && npm run dev)' } }));
  });
  req.pipe(upstream);
}

const previousEnhance = config.server && config.server.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware, server) => {
    const inner = previousEnhance ? previousEnhance(metroMiddleware, server) : metroMiddleware;
    return (req, res, next) => (PROXIED.test(req.url || '') ? proxyToApi(req, res) : inner(req, res, next));
  },
};

module.exports = config;
