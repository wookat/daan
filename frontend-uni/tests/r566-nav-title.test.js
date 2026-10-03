// R566：H5 练习页导航栏标题随会话来源（R565-1：按卷练习顶栏静态「刷题」，小程序早已显示卷名）。
// 生产 375 截图（r565 prod paper-complete）：顶栏「刷题」+ 内容头「本卷练完 · <卷名>」；小程序 navTitleFor 返回 ptitle。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { practiceNavTitle, practicePageOnTop, PRACTICE_TITLE_DEFAULT } from '../src/practice-title.js';

const PRACTICE = readFileSync(new URL('../src/pages/practice/practice.vue', import.meta.url), 'utf8');
const PAGES = JSON.parse(readFileSync(new URL('../src/pages.json', import.meta.url), 'utf8'));
const mod = (m) => ({ yanyu: '言语理解', shuliang: '数量关系' })[m] || m;

describe('practiceNavTitle', () => {
  it('非会话态回落 pages.json 的静态标题「刷题」', () => {
    expect(PRACTICE_TITLE_DEFAULT).toBe('刷题');
    expect(PAGES.pages.find((p) => p.path === 'pages/practice/practice').style.navigationBarTitleText).toBe('刷题');
    expect(practiceNavTitle({ session: false, ptitle: '2023 国考行测' }, mod)).toBe('刷题');
    expect(practiceNavTitle(null, mod)).toBe('刷题');
  });
  it('按卷：卷名优先，trim；真实卷名（≈22 字）不硬截交给顶栏 ellipsis，仅对异常长串 40 字兑底', () => {
    expect(practiceNavTitle({ session: true, ptitle: ' 2023 国考行测 ', module: 'yanyu' }, mod)).toBe('2023 国考行测');
    const real = '2025年四川省考/选调公务员录用考试《行测》';
    expect(practiceNavTitle({ session: true, ptitle: real }, mod)).toBe(real);
    const long = '卷'.repeat(60);
    expect(practiceNavTitle({ session: true, ptitle: long }, mod).length).toBe(40);
  });
  it('uni-h5 顶栏标题容器自带 nowrap + ellipsis（不硬截的依据，vendor 升级时重核）', () => {
    const css = readFileSync(new URL('../node_modules/@dcloudio/uni-h5/style/framework/pageHead.css', import.meta.url), 'utf8');
    const i = css.indexOf('.uni-page-head__title {');
    const block = css.slice(i, css.indexOf('}', i));
    expect(block).toContain('white-space: nowrap;');
    expect(block).toContain('text-overflow: ellipsis;');
  });
  it('每日一练 / 往期每日一练 / 时政 / 错题重练 优先级在模块之前', () => {
    expect(practiceNavTitle({ session: true, daily: true, module: 'yanyu' }, mod)).toBe('每日一练');
    expect(practiceNavTitle({ session: true, daily: true, dailyPast: true }, mod)).toBe('往期每日一练');
    expect(practiceNavTitle({ session: true, shizheng: true }, mod)).toBe('时政每日一练');
    expect(practiceNavTitle({ session: true, shizheng: true, szPast: true }, mod)).toBe('往期时政补练');
    expect(practiceNavTitle({ session: true, source: 'redo', module: 'yanyu' }, mod)).toBe('错题重练');
  });
  it('普通练习：模块 · 子模块 / 模块 · 专项练习 / 模块 · 强化练习；无模块回「综合」', () => {
    expect(practiceNavTitle({ session: true, module: 'yanyu', submodule: '逻辑填空' }, mod)).toBe('言语理解 · 逻辑填空');
    expect(practiceNavTitle({ session: true, module: 'shuliang' }, mod)).toBe('数量关系 · 专项练习');
    expect(practiceNavTitle({ session: true, module: 'yanyu', reinforce: true, submodule: '逻辑填空' }, mod)).toBe('言语理解 · 强化练习');
    expect(practiceNavTitle({ session: true }, mod)).toBe('综合 · 专项练习');
    expect(practiceNavTitle({ session: true, module: 'yanyu' })).toBe('综合 · 专项练习');
  });
  it('与小程序 navTitleFor 同口径：卷名优先 / 错题重练 / 强化练习 / 模块 · 子模块 / 专项练习', () => {
    const mini = readFileSync(new URL('../../miniapp-native/miniprogram/pages/practice/practice.ts', import.meta.url), 'utf8');
    expect(mini).toContain('if (a.ptitle) return a.ptitle;');
    expect(mini).toContain("if (a.mode === 'redo' || a.mode === 'redoset') return '错题重练';");
    expect(mini).toContain("if (a.mode === 'reinforce') return '强化练习';");
    expect(mini).toContain("if (a.submodule) return mod + ' · ' + a.submodule;");
    expect(mini).toContain("return mod + (a.real ? ' · 真题' : ' · 专项练习');");
  });
});

describe('practice.vue 接线', () => {
  it('session 变化与 onShow 都同步标题；同值不重复调 setNavigationBarTitle', () => {
    expect(PRACTICE).toContain("import { practiceNavTitle, practicePageOnTop } from '../../practice-title.js';");
    expect(PRACTICE).toContain('    session() {\n      this.syncNavTitle();\n    },');
    expect(PRACTICE).toContain("    this.backLabel = backLabel(getCurrentPages());\n    this._navTitle = '';\n    this.syncNavTitle();\n");
    expect(PRACTICE).toContain('if (title === this._navTitle) return;\n      if (!practicePageOnTop(getCurrentPages())) return;\n      this._navTitle = title;\n      uni.setNavigationBarTitle({ title, fail: () => {} });');
  });
  it('R566-fix：leave() navigateBack 后 session→false 的 watcher 不再改标题（生产 setNavigationBarTitle:fail page not found）', () => {
    const practice = { route: 'pages/practice/practice' };
    expect(practicePageOnTop([{ route: 'pages/home/home' }, practice])).toBe(true);
    expect(practicePageOnTop([{ $page: { route: '/pages/practice/practice?x=1' } }])).toBe(true);
    expect(practicePageOnTop([{ route: 'pages/book/book' }])).toBe(false);
    expect(practicePageOnTop([practice, { route: 'pkgA/exam/list' }])).toBe(false);
    expect(practicePageOnTop([])).toBe(false);
    expect(practicePageOnTop(null)).toBe(false);
  });
  it('syncNavTitle 取实例上下文：ptitle/source/daily/shizheng/reinforce/lastModule/lastSubmodule', () => {
    const i = PRACTICE.indexOf('    syncNavTitle() {');
    const body = PRACTICE.slice(i, PRACTICE.indexOf('    },', i));
    for (const k of ['session: this.session', 'ptitle: this._ptitle', 'source: this._source', 'daily: this._daily', 'dailyPast: this._dailyPast', 'shizheng: this._shizheng', 'szPast: this._szPast', 'reinforce: !!this._reinforce', 'module: this.lastModule', 'submodule: this.lastSubmodule']) {
      expect(body).toContain(k);
    }
  });
  it('_reinforce 在其它启动/恢复路径清空，避免「再来一组」后仍标「强化练习」', () => {
    expect(PRACTICE.match(/this\._reinforce = null;/g).length).toBe(6);
    expect(PRACTICE).toContain("      this._source = 'redo';\n      this._ptitle = null;\n      this._reinforce = null;");
    expect(PRACTICE).toContain("      this._source = source || null;\n      this._ptitle = null;\n      this._reinforce = null;");
  });

  it('按卷（不计时）启动即落 pendingSession：0 答 F5 不再回落默认专项练习（与 R548 redo / R557 daily 同口径）', () => {
    expect(PRACTICE).toContain("          this.startQTimer();\n          this.saveSession();\n          uni.showToast({ title: wrongOnly ?");
  });
});
