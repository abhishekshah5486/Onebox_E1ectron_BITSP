import { describe, expect, it } from 'vitest';
import { oneboxCloudscapeTheme } from './cloudscape-theme';
import rawTokens from './tokens.css?raw';

const tokensCss = rawTokens.toLowerCase();

describe('cloudscape theme', () => {
  it('only uses colours from the OneBox palette', () => {
    for (const [token, value] of Object.entries(oneboxCloudscapeTheme.tokens)) {
      const { light, dark } = value as { light: string; dark: string };
      for (const colour of [light, dark]) {
        expect(tokensCss, `${token} uses ${colour}`).toContain(colour.toLowerCase());
      }
    }
  });
});
