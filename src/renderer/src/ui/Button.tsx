import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';

type Variant = 'primary' | 'text';

const classes = (variant: Variant, className?: string) =>
  `${styles.button} ${styles[variant]} ${className ?? ''}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return <button type="button" {...props} className={classes(variant, className)} />;
}

export function ButtonLink({
  variant = 'primary',
  className,
  ...props
}: LinkProps & { variant?: Variant }) {
  return <Link {...props} className={classes(variant, className)} />;
}
