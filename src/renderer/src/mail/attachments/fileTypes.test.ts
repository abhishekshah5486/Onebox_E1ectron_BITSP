import { describe, expect, it } from 'vitest';
import { fileIconName } from './fileIcons';
import { canPreview, readsAsText } from './fileTypes';

describe('file icons', () => {
  it('picks each format its own icon', () => {
    const icon = (name: string, type = 'application/octet-stream') => fileIconName(name, type);
    expect(icon('MarksheetCumCertificate2020.pdf', 'application/pdf')).toBe('pdf');
    expect(icon('photo.JPG', 'image/jpeg')).toBe('image');
    expect(icon('report.docx')).toBe('word');
    expect(icon('main.py')).toBe('python');
    expect(icon('server.go')).toBe('go');
    expect(icon('.env.local')).toBe('tune');
    expect(icon('Dockerfile')).toBe('docker');
    expect(icon('backup.tar.gz')).toBe('zip');
    expect(icon('scan', 'image/png')).toBe('image');
    expect(icon('blob.weirdformat')).toBe('file');
  });

  it('previews code as text but never renders it', () => {
    expect(readsAsText('main.py', 'application/octet-stream')).toBe(true);
    expect(readsAsText('.env.example', 'application/octet-stream')).toBe(true);
    expect(canPreview('text/html')).toBe(false);
    expect(canPreview('application/pdf')).toBe(true);
  });
});
