import type { CSSProperties } from 'react';
import type { PaymentProvider } from '../api/payments';
import razorpayLogo from './logos/razorpay.png';
import styles from './ProviderLogo.module.css';

// Razorpay's two-tone mark on white, and Stripe's from its brand assets (via Simple Icons).
const BRAND: Record<
  PaymentProvider,
  { name: string; tile: string } & ({ image: string } | { mark: string; path: string })
> = {
  RAZORPAY: { name: 'Razorpay', tile: '#FFFFFF', image: razorpayLogo },
  STRIPE: {
    name: 'Stripe',
    tile: '#635BFF',
    mark: '#FFFFFF',
    path: 'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z',
  },
};

export function ProviderLogo({
  provider,
  size = 32,
  label = true,
}: {
  provider: PaymentProvider;
  size?: number;
  // False when the name is written next to it.
  label?: boolean;
}) {
  const brand = BRAND[provider];
  return (
    <span
      className={`${styles.tile} ${'image' in brand ? styles.light : ''}`}
      style={{ width: size, height: size, background: brand.tile }}
      {...(label ? { role: 'img', 'aria-label': brand.name } : { 'aria-hidden': true })}
    >
      {'image' in brand ? (
        <img src={brand.image} alt="" width={size} height={size} />
      ) : (
        <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill={brand.mark}>
          <path d={brand.path} />
        </svg>
      )}
    </span>
  );
}

// Both marks, the second overlapping the first and sliding beside it on hover; the ring
// matches the surface behind them.
export function ProviderLogos({ size = 40, ring }: { size?: number; ring: string }) {
  return (
    <span
      className={styles.stack}
      role="img"
      aria-label="Razorpay and Stripe"
      style={{ '--overlap': `${-size * 0.22}px`, '--apart': `${size * 0.15}px` } as CSSProperties}
    >
      {(['RAZORPAY', 'STRIPE'] as const).map((provider) => (
        <span key={provider} className={styles.ring} style={{ boxShadow: `0 0 0 3px ${ring}` }}>
          <ProviderLogo provider={provider} size={size} label={false} />
        </span>
      ))}
    </span>
  );
}
