import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildTabSvgUri, syncH5TabBarIcons } from '../src/utils/tabbar-icons.js';
import { withBasePath } from '../src/utils/hash-url.js';
import { paperCompleteness, sortPapersCompleteFirst } from '../src/exam/exam-paper-quality.js';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('Q4: tabbar-icons 内联 SVG 生成与主题皮肤联动', () => {
  afterEach(() => {
    delete globalThis.uni;
  });

  it('buildTabSvgUri 输出合法 data:image/svg+xml URI，激活态带微填充与加粗描边', () => {
    const idle = buildTabSvgUri('<circle cx="12" cy="8" r="5"/>', '#6b7280', false);
    const active = buildTabSvgUri('<circle cx="12" cy="8" r="5"/>', '#2e5bff', true);
    expect(idle.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(idle)).toContain('fill="none"');
    expect(decodeURIComponent(idle)).toContain('stroke="#6b7280"');
    expect(decodeURIComponent(active)).toContain('fill="#2e5bff" fill-opacity="0.12"');
    expect(decodeURIComponent(active)).toContain('stroke-width="2.15"');
  });

  it('syncH5TabBarIcons 一次性注入 5 个 Tab 内联 SVG 并同步浅/深与三套皮肤色', () => {
    const setTabBarItem = vi.fn();
    const setTabBarStyle = vi.fn();
    globalThis.uni = { setTabBarItem, setTabBarStyle };

    syncH5TabBarIcons({ dark: false, accent: 'forest' });
    expect(setTabBarItem).toHaveBeenCalledTimes(5);
    expect(setTabBarItem.mock.calls[0][0].iconPath).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(setTabBarItem.mock.calls[0][0].selectedIconPath)).toContain('#16a34a');
    expect(setTabBarStyle).toHaveBeenCalledWith(expect.objectContaining({
      color: '#6b7280',
      selectedColor: '#16a34a',
      backgroundColor: '#ffffff',
    }));

    setTabBarItem.mockClear();
    setTabBarStyle.mockClear();
    syncH5TabBarIcons({ dark: true, accent: 'sunset' });
    expect(setTabBarItem).toHaveBeenCalledTimes(5);
    expect(decodeURIComponent(setTabBarItem.mock.calls[2][0].selectedIconPath)).toContain('#fb923c');
    expect(setTabBarStyle).toHaveBeenCalledWith(expect.objectContaining({
      color: '#8a8ea0',
      selectedColor: '#fb923c',
      backgroundColor: '#1d1f28',
    }));

    // 同时验证启动前直接改写 window.__uniConfig.tabBar.list（首帧即 0 PNG 请求）
    const fakeList = Array.from({ length: 5 }, (_, i) => ({ index: i, iconPath: `static/tab/${i}.png`, selectedIconPath: `static/tab/${i}-on.png` }));
    globalThis.window = { __uniConfig: { tabBar: { list: fakeList } } };
    syncH5TabBarIcons({ dark: false, accent: 'default' });
    expect(fakeList.every((it) => it.iconPath.startsWith('data:image/svg+xml'))).toBe(true);
    expect(fakeList.every((it) => it.selectedIconPath.startsWith('data:image/svg+xml'))).toBe(true);
    delete globalThis.window;
  });
});

describe('Q4: withBasePath 保留子路径前缀（防止 replaceState 抹掉 /app/）', () => {
  it('把 /#/... 拼回当前 /app/ pathname，并兼容 / 根路径与非 hash 字符串', () => {
    expect(withBasePath('/#/pages/book/book?mod=yanyu', '/app/')).toBe('/app/#/pages/book/book?mod=yanyu');
    expect(withBasePath('#/pkgA/exam/list?kind=zhenti', '/app/')).toBe('/app/#/pkgA/exam/list?kind=zhenti');
    expect(withBasePath('/#/pages/book/book', '/')).toBe('/#/pages/book/book');
    expect(withBasePath('/plain/path', '/app/')).toBe('/plain/path');
    expect(withBasePath('', '/app/')).toBe('');
  });

  it('全站 6 处 replaceState 页面均通过 withBasePath 保护子路径', () => {
    const pages = [
      '../src/pages/book/book.vue',
      '../src/pkgA/exam/list.vue',
      '../src/pkgA/shenlun/shenlun.vue',
      '../src/pkgA/search/search.vue',
      '../src/pkgA/social/favorites.vue',
      '../src/pkgA/stats/mastery-map.vue',
    ];
    for (const p of pages) {
      const src = read(p);
      expect(src, p).toContain('withBasePath(');
      expect(src, p).not.toMatch(/replaceState\([^)]*,\s*['"]\/#\//);
    }
  });
});

describe('Q5: exam-paper-quality 真题完整度判定与完整卷优先排序', () => {
  const fullMods = { changshi: 20, yanyu: 30, shuliang: 10, panduan: 40, ziliao: 20 };

  it('paperCompleteness 准确区分完整卷、缺模块卷、题量偏少卷与超长合卷', () => {
    expect(paperCompleteness({ n: 120, mods: fullMods })).toEqual({
      complete: true, merged: false, missingMods: [], tagText: '', tagTone: '',
    });

    const noZiliao = paperCompleteness({ n: 81, mods: { changshi: 15, yanyu: 25, shuliang: 10, panduan: 31 } });
    expect(noZiliao.complete).toBe(false);
    expect(noZiliao.missingMods).toEqual(['资料']);
    expect(noZiliao.tagText).toBe('缺资料 · 待补全');
    expect(noZiliao.tagTone).toBe('warn');

    const missModOnly = paperCompleteness({ n: 105, mods: { changshi: 20, yanyu: 35, shuliang: 10, panduan: 40 } });
    expect(missModOnly.tagText).toBe('缺资料');

    const shortAllMods = paperCompleteness({ n: 75, mods: { changshi: 10, yanyu: 20, shuliang: 10, panduan: 20, ziliao: 15 } });
    expect(shortAllMods.complete).toBe(false);
    expect(shortAllMods.tagText).toBe('题量待补全');

    const merged = paperCompleteness({ n: 263, mods: fullMods });
    expect(merged.complete).toBe(false);
    expect(merged.merged).toBe(true);
    expect(merged.tagText).toBe('合卷收录');
    expect(merged.tagTone).toBe('info');
  });

  it('sortPapersCompleteFirst 同年份内把 5 模块完整卷排在残卷之前，同时保持最新年份在前', () => {
    const items = [
      { id: 1, year: 2026, n: 81, mods: { changshi: 15, yanyu: 25, shuliang: 10, panduan: 31 } },
      { id: 2, year: 2026, n: 130, mods: fullMods },
      { id: 3, year: 2025, n: 135, mods: fullMods },
      { id: 4, year: 2026, n: 95, mods: { changshi: 15, yanyu: 30, shuliang: 10, panduan: 25, ziliao: 15 } },
    ];
    const sorted = sortPapersCompleteFirst(items);
    expect(sorted.map((x) => x.id)).toEqual([2, 4, 1, 3]);
  });
});

describe('Q1-Q6: 全站视觉/布局/交互修复回归锁', () => {
  it('Q1+Q4: App.vue 修复 .uni-tabbar-border 拼写、增加 Hero+Card 间距、保护 SVG 不被 filter 叠染并对齐桌面侧栏', () => {
    const app = read('../src/App.vue');
    expect(app).not.toContain('.uni-tabbar__border');
    expect(app).toContain('.uni-tabbar-border');
    expect(app).toContain('.kg-hero + .kg-card');
    expect(app).toContain(":not([src^='data:'])");
    expect(app).toContain('width: 100%');
    expect(app).toContain('router.getRoutes()');
  });

  it('Q1: kg-two-col 移动端使用 --card-gap 且清除栏首多余 margin-top', () => {
    const twoCol = read('../src/components/kg-two-col/kg-two-col.vue');
    expect(twoCol).toContain('gap: var(--card-gap)');
    expect(twoCol).toContain('margin-top: 0 !important');
    expect(twoCol).toContain('calc(var(--sp-24) - var(--card-gap)) !important');
  });

  it('Q2: kg-sheet 与全局 App.vue 带 settled 兜底防止 bottom 抽屉掉出视口外', () => {
    const sheet = read('../src/components/kg-sheet/kg-sheet.vue');
    const app = read('../src/App.vue');
    expect(sheet).toContain('is-settled');
    expect(sheet).toContain('translate3d(0, 0, 0)');
    expect(app).toContain('.wd-popup--bottom.kg-sheet.is-settled');
    expect(app).toContain('translate3d(0, 0, 0) !important');
  });

  it('Q2+Q3: stats 入口图标用 on-brand、home 待办去掉左边框且 resumes 带 kg-cards、pomo 带左右留白', () => {
    const stats = read('../src/pages/stats/stats.vue');
    expect(stats).toContain('name="calendar" :size="20" tone="on-brand"');
    expect(stats).toContain('name="calendar-check" :size="20" tone="on-brand"');
    expect(stats).toContain('name="clock" :size="20" tone="on-brand"');

    const home = read('../src/pages/home/home.vue');
    expect(home).toContain('class="resumes kg-cards"');
    expect(home).toContain('<kg-card v-if="todoRows.length" class="sec todo" variant="flat">');
    expect(home).not.toContain('border-left: 3px solid var(--warn)');
    expect(home).toContain('max-width: 720px');

    const pomo = read('../src/pages/stats/pomo.vue');
    expect(pomo).toContain('padding: var(--sp-16) var(--page-x)');
  });

  it('Q2: shenlun 修复骨架/空态同屏与我的笔记加载更多；team 空态去双 CTA；interview 禁用即将上线；practice 透传 count', () => {
    const sl = read('../src/pkgA/shenlun/shenlun.vue');
    // 热点与我的笔记归入 loading/mErr 之后的同一 v-else-if 链；加载更多只在最后的素材 v-else 分支内
    const hotIdx = sl.indexOf("v-else-if=\"mtype === '热点'\"");
    const noteIdx = sl.indexOf("v-else-if=\"mtype === '我的笔记'\"");
    const emptyIdx = sl.indexOf('v-else-if="!shownMats.length"');
    expect(hotIdx).toBeGreaterThan(-1);
    expect(noteIdx).toBeGreaterThan(hotIdx);
    expect(emptyIdx).toBeGreaterThan(noteIdx);
    expect(sl.slice(noteIdx, emptyIdx)).not.toContain('loadMoreMat');

    const team = read('../src/pkgA/team/team.vue');
    expect(team).toContain(":primary=\"teams.length ? { text: '创建小队' } : null\"");

    const iv = read('../src/pkgA/interview/interview.vue');
    expect(iv).not.toContain('voiceStub');

    const pr = read('../src/pages/practice/practice.vue');
    expect(pr).toContain('const urlCount = rawCnt >= 1 && rawCnt <= 50 ? rawCnt : null;');
  });

  it('Q6: 错题本采用 40px Underline 吸顶切换、sm 齐平工具按钮与并排头卡操作', () => {
    const book = read('../src/pages/book/book.vue');
    expect(book).toContain('class="sticky-bar"');
    expect(book).toContain('class="head-acts"');
    expect(book).toContain('activeFilterCount');
    expect(book).toContain('size="sm" icon="sliders-horizontal"');
    expect(book).toContain('border-bottom: 1px solid var(--line)');
  });
});
