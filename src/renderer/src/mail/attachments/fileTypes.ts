// What kind of file an attachment is, from its type and name, for its badge and preview.
export type FileKind =
  | 'pdf'
  | 'doc'
  | 'sheet'
  | 'csv'
  | 'slides'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | 'text'
  | 'calendar'
  | 'email'
  | 'app'
  | 'font'
  | 'file';

export const FILE_KINDS: Record<FileKind, { label: string; color: string; name: string }> = {
  pdf: { label: 'PDF', color: '#d93025', name: 'PDF' },
  doc: { label: 'DOC', color: '#4285f4', name: 'Document' },
  sheet: { label: 'XLS', color: '#188038', name: 'Spreadsheet' },
  csv: { label: 'CSV', color: '#188038', name: 'Spreadsheet' },
  slides: { label: 'PPT', color: '#e8710a', name: 'Presentation' },
  image: { label: 'IMG', color: '#d93025', name: 'Image' },
  video: { label: 'VID', color: '#c5221f', name: 'Video' },
  audio: { label: 'AUD', color: '#9334e6', name: 'Audio' },
  archive: { label: 'ZIP', color: '#5f6368', name: 'Archive' },
  code: { label: '</>', color: '#12a4af', name: 'Code' },
  text: { label: 'TXT', color: '#5f6368', name: 'Text' },
  calendar: { label: 'ICS', color: '#1a73e8', name: 'Calendar invite' },
  email: { label: 'EML', color: '#1a73e8', name: 'Email' },
  app: { label: 'APP', color: '#5f6368', name: 'App' },
  font: { label: 'Aa', color: '#5f6368', name: 'Font' },
  file: { label: 'FILE', color: '#80868b', name: 'File' },
};

const BY_EXTENSION: Record<string, FileKind> = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'doc',
  odt: 'doc',
  rtf: 'doc',
  pages: 'doc',
  xls: 'sheet',
  xlsx: 'sheet',
  xlsm: 'sheet',
  ods: 'sheet',
  numbers: 'sheet',
  csv: 'csv',
  tsv: 'csv',
  ppt: 'slides',
  pptx: 'slides',
  odp: 'slides',
  key: 'slides',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  avif: 'image',
  heic: 'image',
  heif: 'image',
  tif: 'image',
  tiff: 'image',
  svg: 'image',
  ico: 'image',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mkv: 'video',
  avi: 'video',
  m4v: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  aac: 'audio',
  ogg: 'audio',
  flac: 'audio',
  opus: 'audio',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  tgz: 'archive',
  bz2: 'archive',
  xz: 'archive',
  js: 'code',
  ts: 'code',
  tsx: 'code',
  jsx: 'code',
  json: 'code',
  html: 'code',
  htm: 'code',
  css: 'code',
  py: 'code',
  java: 'code',
  c: 'code',
  cpp: 'code',
  h: 'code',
  go: 'code',
  rs: 'code',
  rb: 'code',
  php: 'code',
  sh: 'code',
  sql: 'code',
  xml: 'code',
  yaml: 'code',
  yml: 'code',
  ipynb: 'code',
  kt: 'code',
  swift: 'code',
  cs: 'code',
  dart: 'code',
  scala: 'code',
  lua: 'code',
  r: 'code',
  vue: 'code',
  svelte: 'code',
  toml: 'code',
  ini: 'code',
  conf: 'code',
  cfg: 'code',
  env: 'code',
  gradle: 'code',
  ps1: 'code',
  bat: 'code',
  txt: 'text',
  md: 'text',
  log: 'text',
  ics: 'calendar',
  vcs: 'calendar',
  eml: 'email',
  msg: 'email',
  apk: 'app',
  exe: 'app',
  dmg: 'app',
  msi: 'app',
  pkg: 'app',
  deb: 'app',
  ttf: 'font',
  otf: 'font',
  woff: 'font',
  woff2: 'font',
};

// Names that are a format by themselves.
const SPECIAL_NAMES: Record<string, { kind: FileKind; label: string; color: string }> = {
  dockerfile: { kind: 'code', label: 'DOCK', color: '#2496ed' },
  makefile: { kind: 'code', label: 'MAKE', color: '#6d8086' },
  license: { kind: 'text', label: 'LIC', color: '#5f6368' },
  readme: { kind: 'text', label: 'MD', color: '#083fa1' },
};

// Each language or app family in its own colour, as editors and Drive show them.
const EXTENSION_COLORS: Record<string, string> = {
  doc: '#2b579a',
  docx: '#2b579a',
  odt: '#2b579a',
  rtf: '#2b579a',
  pages: '#f28c28',
  xls: '#217346',
  xlsx: '#217346',
  xlsm: '#217346',
  ods: '#217346',
  numbers: '#28a745',
  csv: '#217346',
  tsv: '#217346',
  ppt: '#d24726',
  pptx: '#d24726',
  odp: '#d24726',
  key: '#1a73e8',
  py: '#3776ab',
  ipynb: '#f37626',
  go: '#00add8',
  js: '#f7df1e',
  jsx: '#61dafb',
  ts: '#3178c6',
  tsx: '#3178c6',
  json: '#cb8a2c',
  env: '#ecd53f',
  html: '#e34c26',
  htm: '#e34c26',
  css: '#264de4',
  java: '#e76f00',
  kt: '#7f52ff',
  swift: '#f05138',
  c: '#555555',
  h: '#555555',
  cpp: '#00599c',
  cs: '#239120',
  rs: '#dea584',
  rb: '#cc342d',
  php: '#777bb4',
  dart: '#0175c2',
  scala: '#dc322f',
  lua: '#000080',
  r: '#276dc3',
  vue: '#41b883',
  svelte: '#ff3e00',
  sh: '#4eaa25',
  ps1: '#012456',
  bat: '#4d4d4d',
  sql: '#e38c00',
  xml: '#0060ac',
  yaml: '#cb171e',
  yml: '#cb171e',
  toml: '#9c4121',
  ini: '#6d8086',
  conf: '#6d8086',
  cfg: '#6d8086',
  gradle: '#02303a',
  md: '#083fa1',
  svg: '#ffb13b',
};

// Dark text on light colours (JavaScript yellow, .env), white elsewhere.
function inkFor(color: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  return 0.299 * r! + 0.587 * g! + 0.114 * b! > 160 ? '#1f1f1f' : '#ffffff';
}

export interface FileStyle {
  kind: FileKind;
  // Up to four letters, usually the extension: PDF, DOCX, PY, GO, JSON, ENV.
  label: string;
  color: string;
  ink: string;
}

export function fileStyle(filename: string, contentType: string): FileStyle {
  const name = filename.toLowerCase();
  const special = name.startsWith('.env')
    ? { kind: 'code' as const, label: 'ENV', color: '#ecd53f' }
    : SPECIAL_NAMES[name.split('.')[0]!];
  if (special) return { ...special, ink: inkFor(special.color) };
  const kind = fileKind(filename, contentType);
  const ext = name.includes('.') ? name.split('.').at(-1)! : '';
  const known = ext && ext.length <= 4 && (BY_EXTENSION[ext] || EXTENSION_COLORS[ext]);
  const color = (known && EXTENSION_COLORS[ext]) || FILE_KINDS[kind].color;
  return {
    kind,
    label: known ? ext.toUpperCase() : FILE_KINDS[kind].label,
    color,
    ink: inkFor(color),
  };
}

export function fileKind(filename: string, contentType: string): FileKind {
  const ext = filename.toLowerCase().split('.').at(-1) ?? '';
  if (filename.includes('.') && BY_EXTENSION[ext]) return BY_EXTENSION[ext];
  const type = contentType.toLowerCase();
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type.includes('spreadsheet') || type.includes('excel')) return 'sheet';
  if (type.includes('presentation') || type.includes('powerpoint')) return 'slides';
  if (type.includes('word') || type.includes('opendocument.text')) return 'doc';
  if (type.includes('zip') || type.includes('compressed') || type.includes('tar')) return 'archive';
  if (type === 'text/calendar') return 'calendar';
  if (type === 'message/rfc822') return 'email';
  if (type === 'text/csv') return 'csv';
  if (type.startsWith('text/')) return 'text';
  return 'file';
}

// The server shows these in place; everything else is a download.
const PREVIEW_TYPES =
  /^(image\/(png|jpeg|gif|webp|bmp|avif)|application\/pdf|text\/plain|audio\/[\w.+-]+|video\/[\w.+-]+)$/;

export const canPreview = (contentType: string) => PREVIEW_TYPES.test(contentType.toLowerCase());

// Code, config and text read fine as plain text, whatever type the sender gave them.
export const readsAsText = (filename: string, contentType: string) => {
  const kind = fileStyle(filename, contentType).kind;
  return kind === 'code' || kind === 'text' || kind === 'csv' || kind === 'calendar';
};
