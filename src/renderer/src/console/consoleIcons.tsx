// Icons Cloudscape lacks, drawn its way: 16px grid, 2px strokes, no fills.
const stroke = (paths: string[]) => (
  <svg
    viewBox="0 0 16 16"
    focusable="false"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinejoin="round"
    strokeLinecap="round"
  >
    {paths.map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
);

export const CONSOLE_ICONS = {
  archive: stroke(['M1 2h14v4H1z', 'M2 6v8h12V6', 'M6 9h4']),
  spam: stroke(['M5 1h6l4 4v6l-4 4H5l-4-4V5z', 'M8 4.5v4', 'M8 11.5v.01']),
  inbox: stroke(['M1 9h4l1 2h4l1-2h4', 'M3 2h10l2 7v5H1V9z']),
  deleteForever: stroke([
    'M2 4h12',
    'M6 4V2h4v2',
    'M3 4l1 10h8l1-10',
    'M6.5 7.5l3 3',
    'M9.5 7.5l-3 3',
  ]),
  label: stroke(['M1 4.5V13h10l4-4.25L11 4.5z']),
};
