import { useEffect, useState } from 'react';
import { hasBrandMark, loadBrandMark, officialLogo, type BrandMark } from './brand-icons';
import styles from './ProviderMark.module.css';

// A brand's logo on a rounded tile: its official file, else one from the icon sets, else the
// catalogue's, else its initial.
// `icon` names the Simple Icons logo where the id alone doesn't.
export function ProviderMark({
  providerId,
  logoUrl,
  name,
  icon,
  size = 40,
}: {
  providerId: string;
  logoUrl: string | null;
  name: string;
  icon?: string | null;
  size?: number;
}) {
  // Kept with the brand it was loaded for, so a reused tile never shows the last one's logo.
  const key = `${providerId}|${icon ?? ''}`;
  const [loaded, setLoaded] = useState<{ key: string; mark: BrandMark | null } | null>(null);
  useEffect(() => {
    if (officialLogo(providerId)) return;
    let live = true;
    void loadBrandMark(providerId, icon).then((mark) => live && setLoaded({ key, mark }));
    return () => {
      live = false;
    };
  }, [providerId, icon, key]);
  const mark = loaded?.key === key ? loaded.mark : null;
  const logo = officialLogo(providerId);

  const size60 = Math.round(size * 0.6);
  return (
    <span
      className={styles.tile}
      style={{ width: size, height: size, ['--icon' as string]: `${size60}px` }}
      aria-hidden="true"
    >
      {logo ? (
        <>
          <img className={styles.light} src={logo.light} width={size60} height={size60} alt="" />
          <img className={styles.dark} src={logo.dark} width={size60} height={size60} alt="" />
        </>
      ) : mark ? (
        // Static files from the icon packages, not user content.
        <span
          className={mark.mono ? `${styles.svg} ${styles.mono}` : styles.svg}
          style={mark.colour ? { color: mark.colour } : undefined}
          dangerouslySetInnerHTML={{ __html: mark.svg }}
        />
      ) : hasBrandMark(providerId, icon) ? null : logoUrl ? (
        <img className={styles.img} src={logoUrl} width={size60} height={size60} alt="" />
      ) : (
        <span className={styles.initial}>{name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
