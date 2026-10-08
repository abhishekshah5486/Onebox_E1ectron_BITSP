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

export const FILE_KINDS: Record<FileKind, { name: string }> = {
  pdf: { name: 'PDF' },
  doc: { name: 'Document' },
  sheet: { name: 'Spreadsheet' },
  csv: { name: 'Spreadsheet' },
  slides: { name: 'Presentation' },
  image: { name: 'Image' },
  video: { name: 'Video' },
  audio: { name: 'Audio' },
  archive: { name: 'Archive' },
  code: { name: 'Code' },
  text: { name: 'Text' },
  calendar: { name: 'Calendar invite' },
  email: { name: 'Email' },
  app: { name: 'App' },
  font: { name: 'Font' },
  file: { name: 'File' },
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
  const name = filename.toLowerCase();
  if (name.startsWith('.env') || name === 'dockerfile' || name === 'makefile') return true;
  const kind = fileKind(filename, contentType);
  return kind === 'code' || kind === 'text' || kind === 'csv' || kind === 'calendar';
};
