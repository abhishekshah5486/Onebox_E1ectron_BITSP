// Brand logos from two icon sets, each file loaded only when shown: LobeHub (MIT), which draws
// AI providers in colour, and Simple Icons (CC0), which has most other brands with their colour.
const LOBEHUB = import.meta.glob<string>(
  '../../../../node_modules/@lobehub/icons-static-svg/icons/*.svg',
  { query: '?raw', import: 'default' },
);
const SIMPLE = import.meta.glob<string>('../../../../node_modules/simple-icons/icons/*.svg', {
  query: '?raw',
  import: 'default',
});
const lobehub = (name: string) =>
  LOBEHUB[`../../../../node_modules/@lobehub/icons-static-svg/icons/${name}.svg`];
const simple = (slug: string) => SIMPLE[`../../../../node_modules/simple-icons/icons/${slug}.svg`];

// Official logos kept in ./brands (see SOURCES.md), by id; "<id>-dark" is for dark mode.
const OFFICIAL = import.meta.glob<string>('./brands/*.{svg,png}', {
  query: '?url',
  import: 'default',
  eager: true,
});
const official = (name: string) =>
  OFFICIAL[`./brands/${name}.svg`] ?? OFFICIAL[`./brands/${name}.png`];

// A brand's own logo file, with its dark-mode version where it has one.
export function officialLogo(id: string) {
  const light = official(id);
  return light ? { light, dark: official(`${id}-dark`) ?? light } : null;
}

// Catalogue ids whose LobeHub icon goes by another name.
const LOBEHUB_NAME: Record<string, string> = {
  anthropic: 'claude',
  google: 'gemini',
  'google-vertex': 'vertexai',
  'amazon-bedrock': 'bedrock',
  togetherai: 'together',
  'fireworks-ai': 'fireworks',
  'openai-compatible': 'openai',
};

// Simple Icons' brand colours, by brand title (each of its SVGs carries the title).
let hexes: Promise<Map<string, string>> | null = null;
const brandHexes = () =>
  (hexes ??= import('simple-icons/icons.json').then(
    (data) => new Map(data.default.map((icon) => [icon.title, icon.hex])),
  ));

const titleOf = (svg: string) =>
  (/<title>([^<]*)<\/title>/.exec(svg)?.[1] ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

// Relative luminance, for contrast against the tile in both themes.
function luminance(hex: string) {
  const [r, g, b] = [0, 2, 4].map((at) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
// The light and dark tile backgrounds in ProviderMark.module.css.
const TILES = [luminance('f2f3f3'), luminance('232b37')];
const MIN_CONTRAST = 1.5;

// A brand colour that reads on both tiles; black or white brands keep the text colour.
async function usableColour(svg: string | null) {
  if (!svg) return null;
  const hex = (await brandHexes()).get(titleOf(svg));
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return null;
  const own = luminance(hex);
  return TILES.every((tile) => contrast(own, tile) >= MIN_CONTRAST) ? `#${hex}` : null;
}

export interface BrandMark {
  svg: string;
  // Single-colour, drawn in `colour`, or the text colour when that's null.
  mono: boolean;
  colour: string | null;
}

const slugOf = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, '');

export function hasBrandMark(id: string, icon?: string | null) {
  const name = LOBEHUB_NAME[id] ?? id;
  return Boolean(
    lobehub(`${name}-color`) ?? lobehub(name) ?? simple(icon ?? slugOf(id)) ?? simple(slugOf(name)),
  );
}

// LobeHub's colour logo, else a single-colour one in the brand's colour where that reads well.
export async function loadBrandMark(id: string, icon?: string | null): Promise<BrandMark | null> {
  const name = LOBEHUB_NAME[id] ?? id;
  const colourful = lobehub(`${name}-color`);
  if (colourful) return { svg: await colourful(), mono: false, colour: null };
  const simpleLoader = simple(icon ?? slugOf(id)) ?? simple(slugOf(name));
  const simpleSvg = simpleLoader ? await simpleLoader() : null;
  const mono = lobehub(name);
  const svg = mono ? await mono() : simpleSvg;
  if (!svg) return null;
  return { svg, mono: true, colour: await usableColour(simpleSvg ?? svg) };
}
