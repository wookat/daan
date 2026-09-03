import { describe, it, expect } from 'vitest';
import { dayKey } from '../src/checkin.js';

describe('dayKey 本地日语义（pstats.days 读写同键）', () => {
  it('用本地年月日拼 key，两位补零', () => {
    const d = new Date(2026, 0, 5, 1, 30); // 本地 2026-01-05 01:30
    expect(dayKey(d)).toBe('2026-01-05');
  });

  it('本地零点后仍是本地「今天」，不随 UTC 回退到昨天', () => {
    // UTC+8 场景：本地 00:30 时 toISOString() 仍是前一天，dayKey 必须给本地日
    const d = new Date(2026, 7, 30, 0, 30);
    expect(dayKey(d)).toBe('2026-08-30');
  });

  it('默认取当前时间且格式合法', () => {
    expect(dayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
