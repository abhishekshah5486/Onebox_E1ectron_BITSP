import CloudscapeIcon, { type IconProps } from '@cloudscape-design/components/icon';
import { Icon, type IconName } from '../ui/Icon';
import type { FeatureKind } from './plans';

// v1 uses our Material-style icons.
export const GMAIL_FEATURE_ICON: Record<FeatureKind, IconName> = {
  inbox: 'inbox',
  storage: 'cloudUpload',
  ai: 'sparkle',
  draft: 'edit',
  model: 'tune',
  credit: 'credit',
  automation: 'bolt',
  support: 'headset',
  new: 'star',
  everything: 'check',
};

// v2 uses Cloudscape's own icons; credits keep our coin.
const CONSOLE_FEATURE_ICON: Record<Exclude<FeatureKind, 'credit'>, IconProps.Name> = {
  inbox: 'envelope',
  storage: 'upload',
  ai: 'gen-ai',
  draft: 'edit',
  model: 'settings',
  automation: 'notification',
  support: 'contact',
  new: 'star',
  everything: 'check',
};

export function ConsoleFeatureIcon({ kind }: { kind: FeatureKind }) {
  return kind === 'credit' ? (
    <CloudscapeIcon svg={<Icon name="credit" size={16} />} />
  ) : (
    <CloudscapeIcon name={CONSOLE_FEATURE_ICON[kind]} />
  );
}
