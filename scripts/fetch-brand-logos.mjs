// Downloads each model provider's own logo into src/renderer/src/settings/brands, for the
// providers that have no LobeHub icon and no logo there yet. For each one it tries svgl.app (a
// curated library of brand SVGs), then the icons the provider's own website declares. Sources
// are recorded in brands/sources.json. Run when the catalogue grows: `npm run logos`.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const CATALOGUE = process.env.PROVIDER_CATALOG_URL ?? 'https://models.dev/api.json';
const SVGL = 'https://api.svgl.app';
const OUT = 'src/renderer/src/settings/brands';
const MAX_BYTES = 300_000;
const CONCURRENCY = 8;
const TYPES = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};
const HEADERS = { 'user-agent': 'OneBox logo fetcher', accept: '*/*' };

const require = createRequire(import.meta.url);
const lobehubDir = join(
  dirname(require.resolve('@lobehub/icons-static-svg/package.json')),
  'icons',
);
const lobehub = new Set(readdirSync(lobehubDir).map((file) => file.replace(/\.svg$/, '')));
const aliases = JSON.parse(readFileSync(join(OUT, 'lobehub-names.json'), 'utf8'));
const sourcesFile = join(OUT, 'sources.json');
const sources = existsSync(sourcesFile) ? JSON.parse(readFileSync(sourcesFile, 'utf8')) : {};
const haveOwn = (id) => Object.values(TYPES).some((ext) => existsSync(join(OUT, `${id}.${ext}`)));
const hasLobehub = (id) => {
  const name = aliases[id] ?? id;
  return lobehub.has(name) || lobehub.has(`${name}-color`);
};
const squash = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

async function get(url, timeoutMs = 10_000) {
  return fetch(url, {
    headers: HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// An image, small enough, and for SVG nothing that runs (the app shows them as <img> anyway).
async function image(url) {
  try {
    const response = await get(url);
    if (!response.ok) return null;
    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim();
    let ext = TYPES[type];
    const body = Buffer.from(await response.arrayBuffer());
    if (!ext && /\.svg(\?|$)/i.test(url) && body.subarray(0, 300).toString().includes('<svg')) {
      ext = 'svg';
    }
    if (!ext || body.length === 0 || body.length > MAX_BYTES) return null;
    if (
      ext === 'svg' &&
      /<script|\bon[a-z]+\s*=|javascript:|<foreignObject/i.test(body.toString())
    ) {
      return null;
    }
    return { ext, body, url: response.url };
  } catch {
    return null;
  }
}

// The icons a page declares, best first: SVG, then the largest bitmap, apple-touch-icon breaking
// ties; then the usual file names.
async function siteIcons(origin) {
  const found = [];
  try {
    const response = await get(origin);
    const html = response.ok ? (await response.text()).slice(0, 500_000) : '';
    for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
      const attr = (name) =>
        new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1] ?? '';
      const rel = attr('rel').toLowerCase();
      if (!/\bicon\b|apple-touch-icon/.test(rel) || /mask-icon/.test(rel)) continue;
      const href = attr('href');
      if (!href || href.startsWith('data:')) continue;
      const size = Math.max(
        0,
        ...attr('sizes')
          .split(/\s+/)
          .map((s) => Number(s.split('x')[0]) || 0),
      );
      const svg = /\.svg(\?|$)/i.test(href) || /svg/.test(attr('type'));
      const score = (svg ? 10_000 : 0) + (size || (rel.includes('apple') ? 180 : 32));
      found.push({ url: new URL(href, response.url).toString(), score });
    }
  } catch {
    // Unreachable pages fall through to the usual file names.
  }
  found.sort((a, b) => b.score - a.score);
  return [
    ...found.map((entry) => entry.url),
    `${origin}/apple-touch-icon.png`,
    `${origin}/favicon.svg`,
    `${origin}/favicon.ico`,
  ];
}

// The provider's own sites: its docs, the domain they sit under, and its API's domain.
function originsOf(provider) {
  const origins = [];
  for (const link of [provider.doc, provider.api]) {
    try {
      const { protocol, hostname } = new URL(link);
      if (protocol !== 'https:' && protocol !== 'http:') continue;
      origins.push(`https://${hostname}`);
      const labels = hostname.split('.');
      if (labels.length > 2) origins.push(`https://${labels.slice(-2).join('.')}`);
    } catch {
      // No usable link.
    }
  }
  return [...new Set(origins)];
}

async function svglMatch(library, provider) {
  const wanted = [squash(provider.name), squash(provider.id)];
  const hit = library.find((entry) => wanted.includes(squash(entry.title)));
  if (!hit) return null;
  const route = typeof hit.route === 'string' ? hit.route : hit.route.light;
  return image(route);
}

async function logoFor(library, provider) {
  const fromSvgl = await svglMatch(library, provider);
  if (fromSvgl) return fromSvgl;
  for (const origin of originsOf(provider)) {
    for (const url of await siteIcons(origin)) {
      const found = await image(url);
      if (found) return found;
    }
  }
  return null;
}

const catalogue = await (await get(CATALOGUE, 30_000)).json();
const library = await (await get(SVGL, 30_000)).json();
const wanted = Object.values(catalogue).filter((p) => !haveOwn(p.id) && !hasLobehub(p.id));
console.log(`${wanted.length} providers need a logo`);

const missing = [];
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < wanted.length) {
      const provider = wanted[next++];
      const logo = await logoFor(library, provider);
      if (!logo) {
        missing.push(provider.id);
        continue;
      }
      writeFileSync(join(OUT, `${provider.id}.${logo.ext}`), logo.body);
      sources[provider.id] = logo.url;
    }
  }),
);

writeFileSync(
  sourcesFile,
  `${JSON.stringify(Object.fromEntries(Object.entries(sources).sort()), null, 2)}\n`,
);
console.log(
  `saved ${wanted.length - missing.length}; none found for ${missing.length}: ${missing.sort().join(', ')}`,
);
