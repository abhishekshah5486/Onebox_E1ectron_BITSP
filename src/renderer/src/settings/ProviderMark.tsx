import styles from './ProviderMark.module.css';

// A provider's logo from the catalogue, or its initial when it has none.
export function ProviderMark({
  logoUrl,
  name,
  size = 32,
}: {
  logoUrl: string | null;
  name: string;
  size?: number;
}) {
  return logoUrl ? (
    <img className={styles.logo} src={logoUrl} width={size} height={size} alt="" loading="lazy" />
  ) : (
    <span className={styles.initial} style={{ width: size, height: size }} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
