import lookup from './file-icons.json';

// File icons from material-icon-theme (MIT): one per format, e.g. the Python and Go logos.
// Each SVG is its own asset, fetched only when shown.
const ICON_URLS = import.meta.glob<string>(
  '../../../../../node_modules/material-icon-theme/icons/*.svg',
  { eager: true, query: '?no-inline', import: 'default' },
);

const urlOf = (icon: string) =>
  ICON_URLS[`../../../../../node_modules/material-icon-theme/icons/${icon}.svg`];

const { extensions, names } = lookup as {
  extensions: Record<string, string>;
  names: Record<string, string>;
};

// When the name says nothing, the declared type still tells images, audio, video and PDFs apart.
function byType(contentType: string) {
  const type = contentType.toLowerCase();
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type === 'text/calendar' || type === 'message/rfc822') return 'email';
  if (type.startsWith('text/')) return 'document';
  return 'file';
}

// The icon for an attachment: its exact name (Dockerfile, .env.local, package.json), then its
// longest known extension (tar.gz before gz), then its type.
export function fileIconName(filename: string, contentType: string) {
  const name = filename.toLowerCase();
  if (names[name]) return names[name];
  const parts = name.split('.');
  for (let i = 1; i < parts.length; i++) {
    const icon = extensions[parts.slice(i).join('.')];
    if (icon) return icon;
  }
  return byType(contentType);
}

export const fileIconUrl = (filename: string, contentType: string) =>
  urlOf(fileIconName(filename, contentType)) ?? urlOf('file');
