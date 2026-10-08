import { useTheme, type ThemePreference } from '../theme/ThemeProvider';
import { Icon } from '../ui/Icon';

const NEXT: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const LABEL: Record<ThemePreference, string> = { light: 'Light', dark: 'Dark', system: 'System' };

export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <button
      className={className}
      aria-label={`Theme: ${LABEL[preference]}. Switch to ${LABEL[NEXT[preference]]}`}
      data-tooltip={`Theme: ${LABEL[preference]}`}
      onClick={() => setPreference(NEXT[preference])}
    >
      <Icon name={preference} size={22} />
    </button>
  );
}
