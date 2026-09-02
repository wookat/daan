import { describe, expect, it } from 'vitest';
import { MASTERY_PATH, buildMasteryUrl, parseMasteryOpts } from '../src/mastery-url.js';

describe('buildMasteryUrl', () => {
  it('无模块回落基础路径', () => {
    expect(buildMasteryUrl({})).toBe(MASTERY_PATH);
    expect(buildMasteryUrl(null)).toBe(MASTERY_PATH);
    expect(buildMasteryUrl({ mod: '' })).toBe(MASTERY_PATH);
    expect(buildMasteryUrl({ mod: '  ' })).toBe(MASTERY_PATH);
  });
  it('模块编码', () => {
    expect(buildMasteryUrl({ mod: 'ziliao' })).toBe(MASTERY_PATH + '?mod=ziliao');
    expect(buildMasteryUrl({ mod: '时政' })).toBe(MASTERY_PATH + '?mod=' + encodeURIComponent('时政'));
  });
});

describe('parseMasteryOpts', () => {
  it('解码恢复', () => {
    expect(parseMasteryOpts({ mod: 'ziliao' })).toEqual({ mod: 'ziliao' });
    expect(parseMasteryOpts({ mod: encodeURIComponent('时政') })).toEqual({ mod: '时政' });
  });
  it('缺省与 malformed 安全返回空', () => {
    expect(parseMasteryOpts()).toEqual({ mod: '' });
    expect(parseMasteryOpts({})).toEqual({ mod: '' });
    expect(parseMasteryOpts({ mod: '%zz' })).toEqual({ mod: '' });
  });
});
