import { describe, it, expect } from 'vitest';
import { fontSizes, normFontLv } from '../src/font-size.js';

describe('normFontLv', () => {
  it('valid levels pass through', () => {
    expect(normFontLv(0)).toBe(0);
    expect(normFontLv(1)).toBe(1);
    expect(normFontLv(2)).toBe(2);
  });
  it('invalid values fall back to 1', () => {
    expect(normFontLv(-1)).toBe(1);
    expect(normFontLv(3)).toBe(1);
    expect(normFontLv('2')).toBe(1);
    expect(normFontLv(null)).toBe(1);
    expect(normFontLv(undefined)).toBe(1);
    expect(normFontLv(true)).toBe(1);
  });
});

describe('fontSizes', () => {
  it('three levels', () => {
    expect(fontSizes(0)).toEqual({ q: '26rpx', opt: '25rpx' });
    expect(fontSizes(1)).toEqual({ q: '30rpx', opt: '29rpx' });
    expect(fontSizes(2)).toEqual({ q: '34rpx', opt: '33rpx' });
  });
  it('invalid level uses standard', () => {
    expect(fontSizes('big')).toEqual({ q: '30rpx', opt: '29rpx' });
  });
});
