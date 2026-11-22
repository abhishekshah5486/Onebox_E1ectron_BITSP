import { useEffect, useState } from 'react';
import styles from './ProviderMark.module.css';

// LobeHub's icons (MIT), each loaded only when shown. The colour version is used where one exists;
// single-colour ones follow the text colour, so both read in light and dark themes.
const ICONS = import.meta.glob<string>(
  '../../../../node_modules/@lobehub/icons-static-svg/icons/*.svg',
  {
    query: '?raw',
    import: 'default',
  },
);
const iconPath = (name: string) =>
  `../../../../node_modules/@lobehub/icons-static-svg/icons/${name}.svg`;

// Catalogue ids whose LobeHub icon goes by another name.
const ICON_NAME: Record<string, string> = {
  anthropic: 'claude',
  google: 'gemini',
  'google-vertex': 'vertexai',
  'amazon-bedrock': 'bedrock',
  togetherai: 'together',
  'fireworks-ai': 'fireworks',
  'openai-compatible': 'openai',
};

function loaderFor(providerId: string) {
  const name = ICON_NAME[providerId] ?? providerId;
  return ICONS[iconPath(`${name}-color`)] ?? ICONS[iconPath(name)] ?? null;
}

// A provider's logo on a rounded tile: LobeHub's, else the catalogue's, else its initial.
export function ProviderMark({
  providerId,
  logoUrl,
  name,
  size = 40,
}: {
  providerId: string;
  logoUrl: string | null;
  name: string;
  size?: number;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loaderFor(providerId)?.().then((text) => live && setSvg(text));
    return () => {
      live = false;
    };
  }, [providerId]);

  const icon = Math.round(size * 0.6);
  return (
    <span
      className={styles.tile}
      style={{ width: size, height: size, ['--icon' as string]: `${icon}px` }}
      aria-hidden="true"
    >
      {svg ? (
        // Static files from the icon package, not user content.
        <span className={styles.svg} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : loaderFor(providerId) ? null : logoUrl ? (
        <img className={styles.img} src={logoUrl} width={icon} height={icon} alt="" />
      ) : (
        <span className={styles.initial}>{name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
