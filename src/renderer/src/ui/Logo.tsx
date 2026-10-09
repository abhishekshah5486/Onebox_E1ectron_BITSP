export function Logo({
  size = 32,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="onebox-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#onebox-mark)" />
        <rect
          x="7"
          y="10"
          width="18"
          height="13"
          rx="2.5"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        />
        <path
          d="M8 11.5l8 6 8-6"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>OneBox</span>
      )}
    </span>
  );
}
