import type { ReactElement } from 'react';

// Our own icons in the style of a cloud drive's file types: a coloured tile or page with a
// white glyph. Drawn here (no third-party marks) on a 24 × 24 grid.
export type DriveKind =
  'image' | 'doc' | 'sheet' | 'slides' | 'pdf' | 'video' | 'audio' | 'archive';

// A page with its top-right corner folded over.
const page = (color: string, glyph: ReactElement) => (
  <>
    <path d="M5 2h10l5 5v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill={color} />
    <path d="M15 2l5 5h-3a2 2 0 0 1-2-2z" fill="#fff" fillOpacity="0.45" />
    {glyph}
  </>
);

// A rounded tile.
const tile = (color: string, glyph: ReactElement) => (
  <>
    <rect x="2" y="2" width="20" height="20" rx="3" fill={color} />
    {glyph}
  </>
);

const ICONS: Record<DriveKind, ReactElement> = {
  image: tile(
    '#d93025',
    <>
      <circle cx="8.5" cy="8.5" r="1.8" fill="#fff" />
      <path d="M5 18l4.5-5.5 3 3.5 2.5-3 4 5z" fill="#fff" />
    </>,
  ),
  doc: page(
    '#4285f4',
    <path d="M7 11h10M7 14h10M7 17h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />,
  ),
  sheet: page(
    '#0f9d58',
    <path d="M7 10.5h10v7H7zM7 14h10M11.5 10.5v7" fill="none" stroke="#fff" strokeWidth="1.5" />,
  ),
  slides: page(
    '#f4b400',
    <rect
      x="7"
      y="10.5"
      width="10"
      height="6.5"
      rx="0.8"
      fill="none"
      stroke="#fff"
      strokeWidth="1.6"
    />,
  ),
  pdf: tile(
    '#ea4335',
    <text
      x="12"
      y="15.6"
      textAnchor="middle"
      fill="#fff"
      fontSize="7.4"
      fontWeight="700"
      fontFamily="Roboto, Arial, sans-serif"
    >
      PDF
    </text>,
  ),
  video: tile('#d93025', <path d="M9.5 7.5v9l7-4.5z" fill="#fff" />),
  audio: tile(
    '#d93025',
    <path
      d="M10 16.5V8l7-1.5v8.5M10 16.5a2 2 0 1 1-2-2 2 2 0 0 1 2 2zm7-1.5a2 2 0 1 1-2-2 2 2 0 0 1 2 2z"
      fill="none"
      stroke="#fff"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />,
  ),
  archive: tile(
    '#5f6368',
    <path d="M11 4h2v2h-2zm0 4h2v2h-2zm0 4h2v2h-2zm-1 3h4v3.5h-4z" fill="#fff" />,
  ),
};

export function DriveIcon({ kind, size }: { kind: DriveKind; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {ICONS[kind]}
    </svg>
  );
}

// Which formats get these icons, by the icon the general mapping picked.
export const DRIVE_KINDS: Record<string, DriveKind> = {
  image: 'image',
  svg: 'image',
  word: 'doc',
  table: 'sheet',
  powerpoint: 'slides',
  pdf: 'pdf',
  video: 'video',
  audio: 'audio',
  zip: 'archive',
};

// The tile colour of each kind, also used for a card's folded corner.
export const DRIVE_COLORS: Record<DriveKind, string> = {
  image: '#d93025',
  doc: '#4285f4',
  sheet: '#23a566',
  slides: '#f4b400',
  pdf: '#ea4335',
  video: '#d93025',
  audio: '#d93025',
  archive: '#5f6368',
};

// Apple's formats, which the general mapping leaves out.
const BY_EXTENSION: Record<string, DriveKind> = { numbers: 'sheet', pages: 'doc', key: 'slides' };

// Code and config icons' main colours, for the folded corner.
const ICON_COLORS: Record<string, string> = {
  python: '#3776ab',
  go: '#00add8',
  json: '#f9a825',
  javascript: '#f7df1e',
  typescript: '#3178c6',
  react: '#61dafb',
  rust: '#dea584',
  java: '#e76f00',
  kotlin: '#7f52ff',
  swift: '#f05138',
  ruby: '#cc342d',
  php: '#777bb4',
  html: '#e34c26',
  css: '#42a5f5',
  docker: '#2496ed',
  tune: '#fbc02d',
  yaml: '#ef5350',
  toml: '#9c4121',
  markdown: '#42a5f5',
  database: '#ffca28',
  console: '#ff7043',
  nodejs: '#8bc34a',
  xml: '#8bc34a',
  document: '#42a5f5',
  email: '#42a5f5',
  c: '#0277bd',
  cpp: '#0277bd',
  csharp: '#0277bd',
};

export function driveKindOf(filename: string, icon: string): DriveKind | undefined {
  const ext = filename.toLowerCase().split('.').at(-1) ?? '';
  return BY_EXTENSION[ext] ?? DRIVE_KINDS[icon];
}

export function fileColorOf(filename: string, icon: string) {
  const kind = driveKindOf(filename, icon);
  return kind ? DRIVE_COLORS[kind] : (ICON_COLORS[icon] ?? '#80868b');
}
