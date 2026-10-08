import { fileStyle } from './fileTypes';

// A rounded square in the format's colour with its short name (PDF, DOCX, PY, ENV), like Gmail's.
export function FileBadge({
  file,
  size = 20,
}: {
  file: { filename: string; contentType: string };
  size?: number;
}) {
  const { label, color, ink } = fileStyle(file.filename, file.contentType);
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect width="20" height="20" rx="3" fill={color} />
      <text
        x="10"
        y="13.4"
        textAnchor="middle"
        fill={ink}
        fontSize={label.length >= 4 ? 5 : label.length === 3 ? 6.2 : 7.6}
        fontWeight="700"
        fontFamily="Roboto, Arial, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}
