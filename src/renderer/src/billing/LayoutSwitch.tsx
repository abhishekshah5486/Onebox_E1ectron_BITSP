import styles from '../ui/VersionSwitch.module.css';

export type PlansLayout = 'classic' | 'showcase';

const LAYOUTS: { id: PlansLayout; label: string; title: string }[] = [
  { id: 'classic', label: 'Classic', title: 'Plans in the style of this interface' },
  { id: 'showcase', label: 'Showcase', title: 'The original plans design' },
];

// Picks how the plans page looks; shaped like the v1/v2 switch.
export function LayoutSwitch({
  layout,
  onChange,
}: {
  layout: PlansLayout;
  onChange: (layout: PlansLayout) => void;
}) {
  return (
    <div className={styles.switch} role="radiogroup" aria-label="Plans layout">
      <span
        className={styles.thumb}
        style={{ transform: layout === 'showcase' ? 'translateX(100%)' : 'none' }}
        aria-hidden="true"
      />
      {LAYOUTS.map(({ id, label, title }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={layout === id}
          title={title}
          className={`${styles.option} ${layout === id ? styles.selected : ''}`}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
