import { describe, expect, it } from 'vitest';
import { isSafeExternalUrl, windowOptions } from './window-options';

describe('windowOptions', () => {
  it('locks down the renderer', () => {
    expect(windowOptions('/preload.cjs').webPreferences).toMatchObject({
      preload: '/preload.cjs',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    });
  });
});

describe('isSafeExternalUrl', () => {
  it.each([
    ['https://onebox.dev', true],
    ['mailto:a@b.co', true],
    ['file:///etc/passwd', false],
    ['javascript:alert(1)', false],
    ['not a url', false],
  ])('%s -> %s', (url, safe) => {
    expect(isSafeExternalUrl(url)).toBe(safe);
  });
});
