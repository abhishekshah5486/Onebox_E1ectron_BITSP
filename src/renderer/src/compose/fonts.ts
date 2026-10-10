import { useCallback, useState } from 'react';

export interface FontChoice {
  label: string;
  // A CSS font-family with a generic fallback, so recipients without the font still see text.
  value: string;
}

// CSS's generic families: always available, and what every other choice falls back to.
const GENERIC: FontChoice[] = [
  { label: 'Sans Serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Fixed width', value: 'monospace' },
];

interface LocalFont {
  family: string;
}

const fallbackFor = (family: string) =>
  /mono|code|courier|console/i.test(family)
    ? 'monospace'
    : /serif/i.test(family) && !/sans/i.test(family)
      ? 'serif'
      : 'sans-serif';

// The fonts installed on this computer, read with the Local Font Access API the first time the
// menu opens (it needs a click); the generic families until then, or where it isn't available.
export function useFonts() {
  const [fonts, setFonts] = useState<FontChoice[]>(GENERIC);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (loaded) return;
    setLoaded(true);
    const query = (window as { queryLocalFonts?: () => Promise<LocalFont[]> }).queryLocalFonts;
    if (!query) return;
    try {
      const families = [...new Set((await query()).map((font) => font.family))]
        .filter((family) => !family.startsWith('.'))
        .sort((a, b) => a.localeCompare(b));
      setFonts([
        ...GENERIC,
        ...families.map((family) => ({
          label: family,
          value: `"${family.replace(/"/g, '')}", ${fallbackFor(family)}`,
        })),
      ]);
    } catch {
      // Permission refused: the generic families still work.
    }
  }, [loaded]);

  return { fonts, load };
}
