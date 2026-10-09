import type { ButtonHTMLAttributes, MouseEvent, ReactElement } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './IconButton.module.css';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  // A Material icon by name, or an image such as a provider logo.
  icon: IconName | ReactElement;
  label: string;
  // Tooltip, when it should differ from the accessible name.
  tooltip?: string;
  size?: 'small' | 'normal';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

// Gmail's round icon button: a soft circle on hover and its name shown at once as a tooltip.
export function IconButton({ icon, label, tooltip, size = 'normal', className, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tooltip={tooltip ?? label}
      className={`${styles.button} ${styles[size]} ${className ?? ''}`}
      {...rest}
    >
      {typeof icon === 'string' ? <Icon name={icon} size={size === 'small' ? 18 : 20} /> : icon}
    </button>
  );
}
