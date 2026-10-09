import type { StorageProviderId } from '../api/settings';
import googleDriveLogo from './google-drive.png';

export interface StorageProviderInfo {
  name: string;
  // For buttons, e.g. "Add to Drive".
  shortName: string;
  // What the top folder is called, e.g. "My Drive".
  rootName: string;
  logo: string;
}

// Cloud storage services files can be saved to. OneDrive and Dropbox are planned.
export const STORAGE_PROVIDERS: Record<StorageProviderId, StorageProviderInfo> = {
  GOOGLE_DRIVE: {
    name: 'Google Drive',
    shortName: 'Drive',
    rootName: 'My Drive',
    logo: googleDriveLogo,
  },
};

export const PLANNED_PROVIDERS = ['OneDrive', 'Dropbox'];

// "OneBox/Receipts" reads as "My Drive / OneBox / Receipts"; empty is the top folder.
export const storagePathLabel = (path: string, provider: StorageProviderId) =>
  [
    STORAGE_PROVIDERS[provider].rootName,
    ...path
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean),
  ].join(' / ');
