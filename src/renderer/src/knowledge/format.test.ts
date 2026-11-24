import { describe, expect, it } from 'vitest';
import { terms } from './format';

describe('terms', () => {
  it('keeps the words of a question worth marking, once each', () => {
    expect(terms("What's the CGPA in BITS? the cgpa")).toEqual(['cgpa', 'bits']);
  });
});
