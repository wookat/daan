import { describe, it, expect } from 'vitest';
import { TOAST_KINDS, toastOptions, normalizeToastText } from '../src/toast';

describe('toast 规则层（COMPONENTS §1.10）', () => {
  it('duration 固定：成功 1500 / 提示 2000 / 错误 2500，不随文案长度变化', () => {
    expect(TOAST_KINDS.ok.duration).toBe(1500);
    expect(toastOptions('ok', '已收藏').duration).toBe(1500);
    expect(toastOptions('ok', '这是一条非常非常非常长的成功提示文案').duration).toBe(1500);
    expect(toastOptions('err', '网络开小差').duration).toBe(2500);
    expect(toastOptions('unknown', 'x').duration).toBe(2000);
  });

  it('成功用 success 图标，其余无图标，不遮罩', () => {
    expect(toastOptions('ok', 'x')).toMatchObject({ icon: 'success', mask: false });
    expect(toastOptions('err', 'x').icon).toBe('none');
  });

  it('文案去句号/空白', () => {
    expect(normalizeToastText(' 已复制。')).toBe('已复制');
    expect(normalizeToastText('失败!')).toBe('失败');
    expect(normalizeToastText(null)).toBe('');
  });
});
