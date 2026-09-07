import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const style = (src) => src.slice(src.indexOf('<style'));
const rule = (css, sel) => (css.match(new RegExp(`\\n\\s*${sel.replace(/[.:]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';
const pages = {
  list: style(read('../src/pkgA/exam/list.vue')),
  exam: style(read('../src/pkgA/exam/exam.vue')),
  report: style(read('../src/pkgA/exam/report.vue')),
  rankCard: style(read('../src/components/rank-card/rank-card.vue')),
};

describe('R470 模考簇（卷库 / 考试 / 成绩报告 / 报告内排名卡组件）字号下限与可点元素热区（源文件锁）', () => {
  for (const [name, css] of Object.entries(pages)) {
    it(`${name} 样式无 <24rpx（375 下 12px）字号`, () => {
      expect(css.match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
    });
  }

  it('卷库页：加载失败「重试」命中高 ≥40px（chip / 按钮 / 卷头 / 记录行原有 44px 保留）', () => {
    const css = pages.list;
    expect(rule(css, '.retry')).toMatch(/min-height:\s*40px/);
    for (const sel of ['.fchip', '.pbtn', '.paper-top', '.arow']) {
      expect(rule(css, sel), sel).toMatch(/min-height:\s*44px/);
    }
  });

  it('考试页：答题卡 ✕ / 题号格 命中高 ≥40px，✕ 用负外边距不抬 sheet 头行', () => {
    const css = pages.exam;
    expect(rule(css, '.sheet-x')).toMatch(/min-height:\s*40px/);
    expect(rule(css, '.sheet-x')).toMatch(/min-width:\s*40px/);
    expect(rule(css, '.sheet-x')).toMatch(/margin:\s*-6px/);
    expect(rule(css, '.acard-n')).toMatch(/min-height:\s*40px/);
    expect(rule(css, '.acard-n')).toMatch(/min-width:\s*40px/);
    expect(rule(css, '.acard-n')).not.toMatch(/line-height/);
    for (const sel of ['.tbtn', '.opt', '.nbtn']) {
      expect(rule(css, sel), sel).toMatch(/min-height:\s*44px/);
    }
  });

  it('报告页：题号格 / 弹层 ✕（收藏·关闭）/ 错因 chip / 练同类题 / AI 详解 / 纠错链接 / 上下题 / 导航模式 / 纠错类型 chip / 重试 命中高 ≥40px', () => {
    const css = pages.report;
    for (const sel of ['.qn', '.sheet-x', '.drz', '.dreinf', '.dask', '.report-link', '.dnav-btn', '.dnav-mid', '.rp-chip', '.retry']) {
      expect(rule(css, sel), sel).toMatch(/min-height:\s*40px/);
    }
    expect(rule(css, '.qn')).toMatch(/min-width:\s*40px/);
    expect(rule(css, '.qn')).not.toMatch(/line-height/);
    expect(rule(css, '.sheet-x')).toMatch(/margin:\s*-6px/);
    // R465 同类：min-height 用 rpx（44rpx = 22px）不是有效热区值
    expect(rule(css, '.rp-chip')).not.toMatch(/min-height:\s*\d+rpx/);
  });
});
