// R562（R560-1）：全站 29 处 <kg-sheet>（wd-popup 封装）+ wd-datetime-picker 不在 a11y 弹层栈里——
// 生产走查：更多操作层 Escape 不关、Tab 落到背景页、无 dialog 语义；.mask 只剩 export-confirm 1 处。
// 修法：栈同时收 .wd-popup，Esc 点同级 .wd-overlay（wot closeOnClickModal 默认 true ⇒ 等价用户点遮罩），
// Tab 圈在 .wd-popup 内，打开焦点移入、关闭归还；KgSheet 内层加 role=dialog/aria-modal/aria-label。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { modalEntry, modalKeyAction, isTextWithValue, pickRestoreTarget } from '../src/modal-policy.js';
import { popAction, validMarker, markerOf, canPush } from '../src/sheet-history.js';

const A11Y = readFileSync(new URL('../src/a11y-focus.js', import.meta.url), 'utf8');
const SHEET = readFileSync(new URL('../src/components/kg-sheet/kg-sheet.vue', import.meta.url), 'utf8');
const POPUP_TYPES = readFileSync(new URL('../node_modules/wot-design-uni/components/wd-popup/types.ts', import.meta.url), 'utf8');
const POPUP = readFileSync(new URL('../node_modules/wot-design-uni/components/wd-popup/wd-popup.vue', import.meta.url), 'utf8');

const el = (classes) => ({ classList: { contains: (c) => classes.includes(c) } });

describe('modalEntry：两类弹层归一为 { box, hit, layers }', () => {
  it('.mask 自身即遮罩：box=hit=mask，仅提自身 z-index', () => {
    const m = el(['mask']);
    expect(modalEntry(m, null)).toEqual({ box: m, hit: m, layers: [m] });
  });

  it('wd-popup：焦点圈在 popup，Esc 点同级 .wd-overlay，overlay+popup 一起提 z-index（保持 DOM 序 overlay 在下）', () => {
    const p = el(['wd-transition', 'kg-sheet', 'wd-popup', 'wd-popup--bottom']);
    const ov = el(['wd-transition', 'wd-overlay']);
    expect(modalEntry(p, ov)).toEqual({ box: p, hit: ov, layers: [ov, p] });
  });

  it('无遮罩 popup（modal=false）：只圈定焦点，Esc 不关（hit=null）', () => {
    const p = el(['wd-popup']);
    expect(modalEntry(p, null)).toEqual({ box: p, hit: null, layers: [p] });
  });

  it('classList 缺失的节点按 .mask 语义兜底（不抛）', () => {
    const m = {};
    expect(modalEntry(m, null)).toEqual({ box: m, hit: m, layers: [m] });
  });
});

describe('modalKeyAction：只处理 Escape/Tab，IME 组合中放行', () => {
  it('Escape → dismiss，Tab → cycle，其余 null', () => {
    expect(modalKeyAction('Escape', false)).toBe('dismiss');
    expect(modalKeyAction('Tab', false)).toBe('cycle');
    for (const k of ['Enter', ' ', 'a', '?', 'ArrowDown', 'Esc']) expect(modalKeyAction(k, false), k).toBeNull();
  });

  it('中文输入法组合中按 Escape/Tab 不当弹层键（否则取消候选词会把手录表单整层关掉）', () => {
    expect(modalKeyAction('Escape', true)).toBeNull();
    expect(modalKeyAction('Tab', true)).toBeNull();
  });

  it('焦点在有内容的文本控件：首次 Escape 只 blur（保手录草稿），空控件/非文本控件照旧 dismiss', () => {
    expect(modalKeyAction('Escape', false, true)).toBe('blur');
    expect(modalKeyAction('Escape', false, false)).toBe('dismiss');
    expect(modalKeyAction('Tab', false, true)).toBe('cycle');
    expect(isTextWithValue({ tagName: 'TEXTAREA', value: '题干' })).toBe(true);
    expect(isTextWithValue({ tagName: 'INPUT', value: '' })).toBe(false);
    expect(isTextWithValue({ tagName: 'UNI-VIEW', value: 'x' })).toBe(false);
    expect(isTextWithValue(null)).toBe(false);
  });
});

describe('pickRestoreTarget：关层后焦点归还（触发元素已卸掉时不落 body）', () => {
  const trig = { id: 'trig' };
  const menu = { id: 'menu' };
  const page = { id: 'page' };
  const fabMain = { id: 'fab' };

  it('触发元素仍在且可见 → 原样归还', () => {
    expect(pickRestoreTarget([trig, menu, page], () => true, () => [])).toBe(trig);
  });

  it('触发元素已卸（实测手录：fab 菜单项 v-if=fabOpen 随点击收起）→ 最近仍在祖先内首个可聚焦项（fab 主按钮）', () => {
    const alive = (n) => n !== trig;
    const focusablesIn = (n) => (n === menu ? [fabMain] : []);
    expect(pickRestoreTarget([trig, menu, page], alive, focusablesIn)).toBe(fabMain);
  });

  it('最近祖先也卸了 → 继续往上；全链无可聚焦项 → null（调用方不动焦点）', () => {
    const alive = (n) => n === page;
    expect(pickRestoreTarget([trig, menu, page], alive, (n) => (n === page ? [fabMain] : []))).toBe(fabMain);
    expect(pickRestoreTarget([trig, menu, page], alive, () => [])).toBe(null);
    expect(pickRestoreTarget([], () => true, () => [])).toBe(null);
  });
});

// 浏览器 Back 先关层：弹层打开 pushState 一条带 __kgSheet:{t,u} 的同 URL 条目；X/Esc 关后不 back（避免与同手势 navigateTo 竞争），
// 留下的哑条目由 popstate 补一次 back。决策表以真实发生过的历史序列为样本。
describe('sheet-history popAction 决策表', () => {
  const openSet = (...ts) => (t) => ts.includes(t);

  it('弹层开着按 Back：离开弹层条目 → 关该弹层，不离页', () => {
    expect(popAction(1, null, openSet(1), false)).toEqual({ type: 'close', token: 1, skipping: false });
  });

  it('X/Esc 关后再 Back：离开哑条目落到页面原条目 → 再补一次 back（一次 Back 仍离页）', () => {
    expect(popAction(1, null, openSet(), false)).toEqual({ type: 'back', skipping: false });
  });

  it('从更深页面返回落到哑条目（弹层已关）→ 跳过它，且下一跳不再被【离开哑条目】规则叠加 back（否则从练习页 Back 会直接递到首页）', () => {
    const a = popAction(null, 1, openSet(), false);
    expect(a).toEqual({ type: 'back', skipping: true });
    expect(popAction(1, null, openSet(), a.skipping)).toEqual({ type: 'none', skipping: false });
  });

  it('从更深页面返回落到弹层条目且弹层仍开（KeepAlive 页保留 moreSheet，实测 Forward 回来层还在）→ 不动', () => {
    expect(popAction(null, 1, openSet(1), false)).toEqual({ type: 'none', skipping: false });
    expect(popAction(1, 1, openSet(1), false)).toEqual({ type: 'none', skipping: false });
    expect(popAction(1, 1, openSet(), false)).toEqual({ type: 'back', skipping: true });
  });

  it('嵌套：上层已 X 关、下层还开 → 先跳哑条目，再一跳关下层', () => {
    const a = popAction(2, 1, openSet(1), false);
    expect(a).toEqual({ type: 'back', skipping: false });
    expect(popAction(1, null, openSet(1), a.skipping)).toEqual({ type: 'close', token: 1, skipping: false });
  });

  it('无标记普通历史移动不干预', () => {
    expect(popAction(null, null, openSet(), false)).toEqual({ type: 'none', skipping: false });
  });
});

describe('sheet-history 标记有效性', () => {
  it('标记只对推入时的 URL 有效（vue-router replace 会把旧 state 整体拷到新条目，switchTab 后首页条目带着错题本的标记）', () => {
    const st = { position: 3, __id__: 2, __kgSheet: { t: 7, u: 'http://x/#/pages/book/book' } };
    expect(markerOf(st)).toEqual({ t: 7, u: 'http://x/#/pages/book/book' });
    expect(validMarker(st, 'http://x/#/pages/book/book')).toBe(7);
    expect(validMarker(st, 'http://x/#/pages/home/home')).toBeNull();
    expect(validMarker({ position: 1 }, 'http://x/')).toBeNull();
    expect(validMarker(null, 'http://x/')).toBeNull();
  });

  it('只在 vue-router 已写入 position 的 state 上叠条目（否则 delta 计算为 NaN）', () => {
    expect(canPush({ position: 0 })).toBe(true);
    expect(canPush(null)).toBe(false);
    expect(canPush({})).toBe(false);
  });
});

describe('依赖前提（wot-design-uni 安装版本）', () => {
  it('wd-popup closeOnClickModal 默认 true，点遮罩 → close() → update:modelValue false（Esc 点 overlay 的等价性成立）', () => {
    expect(POPUP_TYPES).toMatch(/closeOnClickModal:\s*makeBooleanProp\(true\)/);
    expect(POPUP).toContain('if (props.closeOnClickModal) {');
    expect(POPUP).toMatch(/function close\(\) \{\s*emit\('close'\)\s*emit\('update:modelValue', false\)/);
    expect(POPUP).toContain('@click="handleClickModal"');
  });

  it('wd-popup 自身无键盘/焦点/历史处理（修在 a11y-focus 栈而非 fork 组件）', () => {
    expect(POPUP).not.toMatch(/keydown|Escape|focus\(|popstate/);
  });
});

describe('a11y-focus 源锁：栈收 .mask 与 .wd-popup，Esc 点 hit、Tab 圈 box', () => {
  it('入栈选择器同时含两类；wd-popup 用同级 .wd-overlay 作 hit', () => {
    expect(A11Y).toContain("document.querySelectorAll('.mask, .wd-popup')");
    expect(A11Y).toContain("modalEntry(node, node.classList.contains('wd-popup') ? overlayOf(node) : null)");
    expect(A11Y).toMatch(/function overlayOf\(popup\)[\s\S]*c\.classList\.contains\('wd-overlay'\)/);
  });

  it('Esc：hit 为空不吞键（modal=false popup 交回页面），否则 preventDefault + 点 hit', () => {
    expect(A11Y).toContain("if (action === 'dismiss') {\n        if (!top.hit) return");
    expect(A11Y).toContain('top.hit.click()');
    expect(A11Y).toContain('const items = maskFocusables(top.box)');
    expect(A11Y).toContain('modalKeyAction(e.key, e.isComposing, isTextWithValue(document.activeElement))');
  });

  it('Tab 序含原生文本控件（实测手录层两个 <textarea> 无 tabindex，仅 [tabindex] 会把题干/解析跳过）', () => {
    expect(A11Y).toContain("export const FOCUSABLE_SEL = '[tabindex], input, textarea, select, button, a[href]'");
    expect(A11Y).toContain('mask.querySelectorAll(FOCUSABLE_SEL)');
    expect(A11Y).toContain('&& !el.disabled');
  });

  it('z-index 提升写到 layers 每一层（overlay 与 popup 同值，R520b 锁行保留）', () => {
    expect(A11Y).toContain('entry.layers.forEach((m) => {\n        m.style.zIndex = String(zIndexFor(stack.length, overlayBase()))');
  });
});

describe('KgSheet dialog 语义', () => {
  it('内层容器 role=dialog + aria-modal + 以 title 作 aria-label（无标题不写空串）', () => {
    expect(SHEET).toContain('class="kg-sheet__in" :class="{ \'is-dialog\': position === \'center\' }" role="dialog" aria-modal="true" :aria-label="title || undefined"');
  });

  it('KgSheet 不传 closeOnClickModal（沿用 wot 默认 true），Esc 等价性不被调用方关掉', () => {
    expect(SHEET).not.toMatch(/close-on-click-modal|closeOnClickModal/);
  });

  it('KgSheet H5 接 sheet-history：打开登记（Back 回调 = update:modelValue false），关闭/卸载登出；非 H5 不引入', () => {
    expect(SHEET).toContain("// #ifdef H5\nimport { sheetOpened, sheetClosed } from '../../sheet-history.js';\n// #endif");
    expect(SHEET).toContain("if (this._histTok == null) this._histTok = sheetOpened(() => this.$emit('update:modelValue', false));");
    expect(SHEET.match(/sheetClosed\(this\._histTok\)/g)).toHaveLength(2);
  });
});
