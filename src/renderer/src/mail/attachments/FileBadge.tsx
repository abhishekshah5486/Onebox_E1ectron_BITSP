import { DriveIcon, driveKindOf, fileColorOf } from './DriveIcons';
import { fileIconName, fileIconUrl } from './fileIcons';
import docsIcon from './google/docs.png';
import sheetsIcon from './google/sheets.png';

// Documents and spreadsheets show Google's own Docs and Sheets icons.
const GOOGLE_ICONS: Partial<Record<string, string>> = { doc: docsIcon, sheet: sheetsIcon };

// Documents, sheets, slides, PDFs, images, audio, video and archives get drive-style icons;
// code and config get their language's icon (Python, Go, JSON, .env…).
export function FileBadge({
  file,
  size = 20,
}: {
  file: { filename: string; contentType: string };
  size?: number;
}) {
  const drive = driveKindOf(file.filename, fileIconName(file.filename, file.contentType));
  if (drive && !GOOGLE_ICONS[drive]) return <DriveIcon kind={drive} size={size} />;
  return (
    <img
      src={(drive && GOOGLE_ICONS[drive]) ?? fileIconUrl(file.filename, file.contentType)}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ flex: 'none' }}
    />
  );
}

// The colour that goes with the file's icon.
export const fileColor = (file: { filename: string; contentType: string }) =>
  fileColorOf(file.filename, fileIconName(file.filename, file.contentType));
