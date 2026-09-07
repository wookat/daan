import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// R497：提醒设置页「提醒时间 20:30 ›」的可点区曾只是 <picker> 包住的 .time-v 本体（53×16px）。
// W5 起整行 wd-cell（is-link、clickable）就是 wd-datetime-picker 的触发槽，可点区 = 整行 ≥56px。
const src = readFileSync(new URL('../src/pkgA/settings/reminders.vue', import.meta.url), 'utf8');
const css = src.slice(src.indexOf('<style'));
const cellScss = readFileSync(new URL('../node_modules/wot-design-uni/components/wd-cell/index.scss', import.meta.url), 'utf8');
const vars = readFileSync(new URL('../node_modules/wot-design-uni/components/common/abstracts/variable.scss', import.meta.url), 'utf8');

describe('R497 提醒设置页 picker 触发区热区（源文件锁）', () => {
  it('wd-datetime-picker 的触发槽是整行 wd-cell（is-link + :clickable="on"），.time-v 只是右侧取值文字', () => {
    expect(src).toMatch(/<wd-datetime-picker\s+type="time"\s+:model-value="time"\s+:disabled="!on"[\s\S]*?>\s*<wd-cell title="提醒时间" label="[^"]+" is-link :clickable="on" center[^>]*>[\s\S]*?<text class="time-v num">\{\{ time \}\}<\/text>\s*<\/wd-cell>\s*<\/wd-datetime-picker>/);
    expect(src).not.toMatch(/<picker mode="time"/);
  });

  it('.time-v 不再自撑热区（整行承担），字号走 token body（≥14px）', () => {
    const r = (css.match(/\n\.time-v \{([^}]*)\}/) || [])[1] || '';
    expect(r).toMatch(/font-size:\s*var\(--fs-body\)/);
    expect(r).not.toMatch(/min-height/);
  });

  it('wd-cell 带 label 的行：上下 padding 16 + 标题行高 24 + label → 整行 ≥56px', () => {
    expect(vars).toMatch(/\$-cell-wrapper-padding-with-label:\s*var\(--wot-cell-wrapper-padding-with-label,\s*16px\)/);
    expect(vars).toMatch(/\$-cell-line-height:\s*var\(--wot-cell-line-height,\s*24px\)/);
    expect(cellScss).toMatch(/padding:\s*\$-cell-wrapper-padding-with-label \$-cell-padding \$-cell-wrapper-padding-with-label 0/);
    // 页面没有把这两个变量改小
    expect(css).not.toMatch(/--wot-cell-wrapper-padding-with-label|--wot-cell-line-height/);
  });
});
