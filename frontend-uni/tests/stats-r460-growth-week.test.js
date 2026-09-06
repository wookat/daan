import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cnWeekKey } from '../src/checkin.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const stats = read('../src/pages/stats/stats.vue');
const style = stats.slice(stats.indexOf('<style'));
const mm = read('../src/pkgA/stats/mastery-map.vue');
const mmStyle = mm.slice(mm.indexOf('<style'));

describe('R460 成长轨迹周口径 / 热力图合计窗口 / 周 tab 热区', () => {
  it('cnWeekKey 与 SQLite/Python strftime(%Y-%W) 同口径（周一起算，首周一前为第 00 周）', () => {
    // 期望值由 python `date.strftime("%Y-%W")` 生成
    const table = [
      ['2026-01-01', '2026-00'], // 周四，首个周一（01-05）之前
      ['2026-01-04', '2026-00'],
      ['2026-01-05', '2026-01'],
      ['2026-09-06', '2026-35'], // 周日
      ['2026-09-07', '2026-36'], // 周一
      ['2026-12-31', '2026-52'],
      ['2024-12-30', '2024-53'], // 周一，闰年尾巴
      ['2025-01-01', '2025-00'],
      ['2027-01-04', '2027-01'],
    ];
    for (const [d, w] of table) {
      const [y, m, day] = d.split('-').map(Number);
      expect(cnWeekKey(new Date(y, m - 1, day))).toBe(w);
    }
  });
  it('「本周比上周」只在末两周确为本周/上周时使用，否则点名两周（服务端 weeks 只含有作答的周）', () => {
    expect(stats).not.toMatch(/\n\s*本周比上周\{\{/);
    expect(stats).toMatch(/\{\{ growthDeltaLabel \}\}\{\{ growthDelta >= 0 \? '提升' : '下降' \}\}/);
    const fn = stats.match(/growthDeltaLabel\(\) \{([\s\S]*?)\n {4}\},/);
    expect(fn).toBeTruthy();
    expect(fn[1]).toMatch(/last\.week === cnWeekKey\(today\) && prev\.week === cnWeekKey\(lastWeek\)/);
    expect(fn[1]).toMatch(/return '本周比上周';/);
    expect(fn[1]).toMatch(/return last\.label \+ '比' \+ prev\.label;/);
  });
  it('热力图「学习 N 次」合计窗口与 12 列格子同起点（本周周一往前 11 周），不多算格子外的 0–6 天', () => {
    const fn = stats.match(/hmTotal\(\) \{([\s\S]*?)\n {4}\},/);
    expect(fn).toBeTruthy();
    expect(fn[1]).toMatch(/const dow = \(today\.getDay\(\) \+ 6\) % 7;/);
    expect(fn[1]).toMatch(/today\.getDate\(\) - dow - 77\)/);
    expect(fn[1]).not.toMatch(/- 83\)/);
  });
  it('周标签 / 百分比列不折行且宽度容得下「26年第52周」「100%（9999题）」；模块 tab 纵向热区 ≥40px', () => {
    expect(style).toMatch(/\.gw-wk\s*\{[^}]*width:\s*150rpx;[^}]*white-space:\s*nowrap;/);
    expect(style).toMatch(/\.gw-pct\s*\{[^}]*width:\s*180rpx;[^}]*white-space:\s*nowrap;/);
    const tab = style.match(/\.gw-tab\s*\{([^}]*)\}/);
    expect(tab).toBeTruthy();
    expect(tab[1]).toMatch(/min-height:\s*40px;/);
    expect(tab[1]).toMatch(/box-sizing:\s*border-box;/);
    expect(tab[1]).toMatch(/display:\s*inline-flex;[^}]*align-items:\s*center;/);
  });
  it('知识点地图模块 tab（375 手机态横滑行）纵向热区 ≥40px', () => {
    const tab = mmStyle.match(/\n\.tab\s*\{([^}]*)\}/);
    expect(tab).toBeTruthy();
    expect(tab[1]).toMatch(/min-height:\s*40px;/);
    expect(tab[1]).toMatch(/box-sizing:\s*border-box;/);
    expect(tab[1]).toMatch(/display:\s*inline-flex;[^}]*align-items:\s*center;/);
  });
});
