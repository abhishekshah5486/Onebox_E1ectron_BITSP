import type { StorageProviderId } from '../api/settings';
import awsLogo from '@lobehub/icons-static-svg/icons/aws-color.svg?url';
import azureLogo from '@lobehub/icons-static-svg/icons/azure-color.svg?url';
import dropboxLogo from './dropbox.svg';
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

// Cloud storage services files can be saved to.
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
  DROPBOX: {
    name: 'Dropbox',
    shortName: 'Dropbox',
    rootName: 'Dropbox',
    logo: dropboxLogo,
  },
  S3: {
    name: 'S3 storage',
    shortName: 'bucket',
    rootName: 'Bucket',
    logo: awsLogo,
  },
  AZURE_BLOB: {
    name: 'Azure Blob Storage',
    shortName: 'Azure',
    rootName: 'Container',
    logo: azureLogo,
  },
};

// Shown in Connect storage as coming soon; none for now.
export const PLANNED_PROVIDERS: string[] = [];

// "OneBox/Receipts" reads as "My Drive / OneBox / Receipts"; empty is the top folder.
export const storagePathLabel = (path: string, provider: StorageProviderId) =>
  [
    STORAGE_PROVIDERS[provider].rootName,
    ...path
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean),
  ].join(' / ');
