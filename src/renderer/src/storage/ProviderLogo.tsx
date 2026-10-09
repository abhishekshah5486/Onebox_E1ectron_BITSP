import type { StorageProviderId } from '../api/settings';
import { STORAGE_PROVIDERS } from './providers';

export function ProviderLogo({
  provider,
  size = 20,
}: {
  provider: StorageProviderId;
  size?: number;
}) {
  return (
    <img
      src={STORAGE_PROVIDERS[provider].logo}
      width={size}
      height={size}
      alt=""
      style={{ display: 'block', flex: 'none', objectFit: 'contain' }}
    />
  );
}
