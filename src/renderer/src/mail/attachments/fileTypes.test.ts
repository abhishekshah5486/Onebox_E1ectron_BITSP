import { describe, expect, it } from 'vitest';
import { canPreview, fileStyle, readsAsText } from './fileTypes';

describe('fileStyle', () => {
  it('labels files by their own format, with readable ink', () => {
    const label = (name: string, type = 'application/octet-stream') => fileStyle(name, type).label;
    expect(label('MarksheetCumCertificate2020.pdf', 'application/pdf')).toBe('PDF');
    expect(label('report.docx')).toBe('DOCX');
    expect(label('main.py')).toBe('PY');
    expect(label('server.go')).toBe('GO');
    expect(label('package.json')).toBe('JSON');
    expect(label('.env.local')).toBe('ENV');
    expect(label('Dockerfile')).toBe('DOCK');
    expect(label('photo', 'image/jpeg')).toBe('IMG');
    expect(label('blob.weirdformat')).toBe('FILE');
    expect(fileStyle('app.js', 'text/javascript').ink).toBe('#1f1f1f');
  });

  it('previews code as text but never renders it', () => {
    expect(readsAsText('main.py', 'application/octet-stream')).toBe(true);
    expect(canPreview('text/html')).toBe(false);
    expect(canPreview('application/pdf')).toBe(true);
  });
});
