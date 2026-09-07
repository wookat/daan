// R507：R506 发版把 main W5 首页两处回归带上生产（Lighthouse `/` 0.98→0.78、LCP 1562→5133 ms、a11y 1.00→0.95）。
// 本机同机交替 A/B（bf1807a6 dist / HEAD dist / HEAD+公告置空 各 5 次）归因：
//  - LCP：W5 把公告「标题：正文」拼成一条 3 行横幅（284×75）放在首屏，它比首页壳 splash 的最大文本块还大，
//    而它只能在 JS 启动 + 公告回包后才绘 → LCP 从「壳绘制」变成「应用挂载」（+2.0 s 本机 / +3.5 s 生产）；
//    公告置空后 LCP 回到 A 水平，组件小 chunk 数（18→28 js）不是 LCP 主因（只抬 TTI ~0.5 s）。
//  - a11y：`.searchbar-t` 被 W5 从 --ink-3 改成 --ink-4（#b0b4c0/#fff = 2.07:1 < 4.5:1）。
// 修：横幅首屏只显标题一行 + 「详情」展开正文（展开是用户输入之后的绘制，不计入 LCP）；搜索占位回 --ink-3。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const home = read('../src/pages/home/home.vue');

describe('首页公告横幅（R507 LCP）', () => {
  it('横幅文本只用 announce.title，不再把正文拼进首屏横幅', () => {
    expect(home).toMatch(/<kg-banner[^>]*tone="info"[^>]*icon="megaphone"[^>]*:text="announce\.title"/);
    expect(home).not.toMatch(/announce\.title \+ \(announce\.body/);
  });

  it('有正文时给「详情」动作，展开后正文另起一行并隐藏「详情」', () => {
    expect(home).toMatch(/:action-text="announce\.body && !annOpen \? '详情' : ''"/);
    expect(home).toMatch(/@action="annOpen = true"/);
    expect(home).toMatch(/<text v-if="annOpen && announce\.body" class="ann-body">\{\{ announce\.body \}\}<\/text>/);
    expect(home).toMatch(/^\s*annOpen: false,/m);
    expect(home).toMatch(/^\.ann-body \{[^}]*display: block;[^}]*color: var\(--ink-2\);/m);
  });
});

describe('首页公告占位（R507 CLS：骨架 116px → 横幅 48px 抬升下方内容）', () => {
  it('公告未回包时用 banner 预设（单行等高 48px），不用四行 lines 段落骨架', () => {
    expect(home).toMatch(/<view v-if="announce === undefined" class="strip"><kg-skeleton preset="banner" \/><\/view>/);
    const skel = read('../src/components/kg-skeleton/kg-skeleton.vue');
    expect(skel).toContain("['hero', 'cards', 'lines', 'banner']");
    expect(skel).toMatch(/v-else-if="preset === 'banner'" theme="image" :row-col="\[\{ width: '100%', height: '48px', type: 'rect' \}\]"/);
  });
});

describe('首页搜索占位对比度（R507 a11y color-contrast）', () => {
  it('.searchbar-t 用 --ink-3（#6b7280/#fff ≥ 4.5:1），不用占位灰 --ink-4', () => {
    const m = home.match(/^\.searchbar-t \{([^}]*)\}/m);
    expect(m).not.toBeNull();
    expect(m[1]).toContain('color: var(--ink-3)');
    expect(m[1]).not.toContain('--ink-4');
  });
});
