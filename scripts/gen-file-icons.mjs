// Builds the attachment icon lookup from material-icon-theme's manifest: extension and file name
// to icon, keeping only entries whose icon file exists. Run after upgrading the package.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('material-icon-theme/package.json'));
const manifest = JSON.parse(readFileSync(join(root, 'dist/material-icons.json'), 'utf8'));
const exists = (icon) => existsSync(join(root, 'icons', `${icon}.svg`));
const pick = (map) =>
  Object.fromEntries(
    Object.entries(map)
      .filter(([, icon]) => exists(icon))
      .sort(([a], [b]) => a.localeCompare(b)),
  );

const out = 'src/renderer/src/mail/attachments/file-icons.json';
writeFileSync(
  out,
  `${JSON.stringify({ extensions: pick(manifest.fileExtensions), names: pick(manifest.fileNames) })}\n`,
);
console.log(`wrote ${out}`);
