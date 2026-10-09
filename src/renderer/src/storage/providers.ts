import type { StorageProviderId } from '../api/settings';
import googleDriveLogo from './google-drive.png';
import oneDriveLogo from './onedrive.svg';

export interface StorageProviderInfo {
  name: string;
  // For buttons, e.g. "Add to Drive".
  shortName: string;
  // What the top folder is called, e.g. "My Drive".
  rootName: string;
  logo: string;
}

// Cloud storage services files can be saved to. Dropbox is planned.
export const STORAGE_PROVIDERS: Record<StorageProviderId, StorageProviderInfo> = {
  GOOGLE_DRIVE: {
    name: 'Google Drive',
    shortName: 'Drive',
    rootName: 'My Drive',
    logo: googleDriveLogo,
  },
  ONEDRIVE: {
    name: 'OneDrive',
    shortName: 'OneDrive',
    rootName: 'My files',
    logo: oneDriveLogo,
  },
};

export const PLANNED_PROVIDERS = ['Dropbox'];

// "OneBox/Receipts" reads as "My Drive / OneBox / Receipts"; empty is the top folder.
export const storagePathLabel = (path: string, provider: StorageProviderId) =>
  [
    STORAGE_PROVIDERS[provider].rootName,
    ...path
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean),
  ].join(' / ');
