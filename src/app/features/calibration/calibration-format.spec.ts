import { describe, expect, it } from 'vitest';
import { eyebrowLabel } from './calibration-format';

describe('eyebrowLabel', () => {
  it('gives a plain instruction for each format instead of the manifest string', () => {
    expect(eyebrowLabel('two-way')).toBe('Pick one');
    expect(eyebrowLabel('four-way')).toBe('Judge each option');
  });
});
