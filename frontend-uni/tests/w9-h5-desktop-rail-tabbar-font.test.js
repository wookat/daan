import { describe, it, expect } from 'vitest';
import { read } from './_w5-hit.js';

// W9-B（源文件锁）：
//   ① 桌面 ≥768 的 208px 侧栏让位只给 tab 页（生产 DOM：tab 页 <uni-page type="tabBar">、非 tab 页 type="" 且 uni-tabbar display:none），
//      非 tab 页（考试列表/报告/提醒设置等）不再留 208px 空栏；
//   ② tabbar label 由 uni-h5 默认 10px 提到 W5 字阶下限 12px（pages.json tabBar.fontSize，桌面 15px !important 不变）；
//   ③ 键盘焦点环颜色走 --brand token，不再硬编码 hex。
describe('W9-B 桌面非 tab 页 208px 让位 / tabbar 字阶 / 焦点环 token', () => {
  const app = read('App.vue');
  const pages = JSON.parse(read('pages.json'));

  it('App.vue 中所有 208px 让位/偏移规则的选择器均以 uni-page[type="tabBar"] 限定', () => {
    // 选择器 = 上一个 } 或 { 之后到本 { 之前的文本（去掉注释）；让位规则 = padding-left 208 / left +208 / left 208
    const layout = [...app.replace(/@media[^{]*\{/g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map((m) => ({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: m[2] }))
      .filter((r) => /padding-left:\s*208px|\+ 208px\)|left:\s*208px !important/.test(r.body));
    expect(layout.length).toBe(4);
    for (const r of layout) {
      const sels = r.sel.split(',').map((s) => s.trim()).filter(Boolean);
      expect(sels.length).toBeGreaterThan(0);
      for (const s of sels) expect(s, r.body.trim()).toMatch(/^uni-page\[type="tabBar"\] uni-page-(wrapper|body)/);
    }
  });

  it('uni-page-wrapper 的 208px padding 只落在 tab 页；不再有裸 uni-page-wrapper / .uni-tabbar-page 让位规则', () => {
    expect(app).toMatch(/uni-page\[type="tabBar"\] uni-page-wrapper \{\s*padding-left: 208px;/);
    expect(app).not.toMatch(/(^|[,\n])\s*uni-page-wrapper\s*[,{]/m);
    expect(app).not.toMatch(/\.uni-tabbar-page/);
  });

  it('≥1280 / ≥1366：固定元素先随壳体（左右壳边），tab 页再 +208px；侧栏 .uni-tabbar 规则不变', () => {
    for (const w of [1140, 1280]) {
      const esc = String(w);
      expect(app).toMatch(new RegExp(`uni-page-body \\.mask[^{]*\\{\\s*left: calc\\(\\(100vw - ${esc}px\\) / 2\\) !important;\\s*right: calc\\(\\(100vw - ${esc}px\\) / 2\\) !important;`));
      expect(app).toMatch(new RegExp(`uni-page\\[type="tabBar"\\] uni-page-body \\.mask[^{]*\\{\\s*left: calc\\(\\(100vw - ${esc}px\\) / 2 \\+ 208px\\) !important;\\s*\\}`));
      expect(app).toMatch(new RegExp(`\\.uni-tabbar \\{\\s*left: calc\\(\\(100vw - ${esc}px\\) / 2\\) !important;`));
    }
    expect(app).toMatch(/\.uni-tabbar \{\s*top: 0 !important;[\s\S]*?width: 208px !important;/);
  });

  it('pages.json tabBar.fontSize === "12px"（W5 字阶下限），高度不另配（保持 uni 默认 50）', () => {
    expect(pages.tabBar.fontSize).toBe('12px');
    expect(pages.tabBar.height).toBeUndefined();
    expect(pages.tabBar.list.map((t) => t.text)).toEqual(['刷题', '错题本', 'AI问答', '统计', '我的']);
    for (const t of pages.tabBar.list) expect(t.text.length).toBeLessThanOrEqual(4);
  });

  it('App.vue 桌面段 .uni-tabbar__label 仍为 15px !important（覆盖 pages.json 内联 12px）', () => {
    expect(app).toMatch(/\.uni-tabbar \.uni-tabbar__label \{[^}]*font-size: 15px !important;/);
  });

  it('a11y-focus.js 焦点环不含 #2e5bff，改用 var(--brand)', () => {
    const focus = read('a11y-focus.js');
    expect(focus).not.toMatch(/#2e5bff/i);
    expect(focus).toMatch(/:focus-visible\{outline:2px solid var\(--brand\);/);
    // --brand 在 :root 镜像上有定义（焦点环可落在 uni-page-body 之外的 tabbar/page-head）
    const tokens = read('styles/tokens.generated.css');
    const root = tokens.slice(tokens.indexOf(':root {'), tokens.indexOf('}', tokens.indexOf(':root {')));
    expect(root).toMatch(/--brand:\s*#2e5bff;/);
  });
});
