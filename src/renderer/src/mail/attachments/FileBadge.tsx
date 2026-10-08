import { fileIconUrl } from './fileIcons';

// The file's own icon (PDF, image, the Python or Go logo, Word, Excel, .env…), as code editors show.
export function FileBadge({
  file,
  size = 20,
}: {
  file: { filename: string; contentType: string };
  size?: number;
}) {
  return (
    <img
      src={fileIconUrl(file.filename, file.contentType)}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ flex: 'none' }}
    />
  );
}
