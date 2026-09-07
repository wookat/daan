// R498：首页 / 错题本是常驻 tab 页，账号态失效（非 auth 接口 401/403 → api.js clearAuth()）
// 发生在页面停留中（改学习重点 / 标为已掌握等写请求撞 403）时，今日已练·连续打卡·考试·今日计划 /
// 错题列表·到期数·掌握度仍留在屏上，要再切一次 tab 才回到匿名态（R497 只补了个人页/统计页）。
// 修法同 R497：onLoad $on('authChanged')，uid 真变才 resetAccountState()（清字段 → 按当前 uid 重拉）。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const home = readFileSync(new URL('../src/pages/home/home.vue', import.meta.url), 'utf8');
const book = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');

function block(src, name, indent) {
  const m = src.match(new RegExp(`\\n {${indent}}(?:async )?${name}\\([^)]*\\) \\{[\\s\\S]*?\\n {${indent}}\\},`));
  expect(m, name).not.toBeNull();
  return m[0];
}

function authListener(src) {
  const m = src.match(/this\._onAuth = \(\) => \{([\s\S]*?)\n {4}\};\n {4}uni\.\$on\('authChanged', this\._onAuth\);/);
  expect(m, 'authChanged 监听').not.toBeNull();
  return m[1];
}

describe('home.vue 登录态变化后账号派生字段不留屏', () => {
  it('onLoad 挂 authChanged 监听、onUnload 摘除；uid 变了才 resetAccountState()', () => {
    const h = authListener(home);
    expect(h).toMatch(/if \(anonUid\(\) === this\._acctUid\) return;/);
    expect(h).toMatch(/this\.resetAccountState\(\);/);
    expect(block(home, 'onUnload', 2)).toMatch(/uni\.\$off\('authChanged', this\._onAuth\)/);
  });

  it('onShow 的 uid 专属拉取收拢到 refreshAccountData()（记录 _acctUid），onShow 不再各自散调', () => {
    const onShow = block(home, 'onShow', 2);
    expect(onShow).toMatch(/this\.refreshAccountData\(\)\.then\(/);
    for (const l of ['loadExamResume', 'loadPracticeResume', 'loadReviewResume', 'loadHome', 'loadSzDaily']) expect(onShow, l).not.toMatch(new RegExp(`${l}\\(`));
    const refresh = block(home, 'refreshAccountData', 4);
    expect(refresh).toMatch(/this\._acctUid = anonUid\(\);/);
    expect(refresh).toMatch(/this\.szDaily = loadSzDaily\(this\._acctUid\);/);
    for (const l of ['loadExamResume', 'loadPracticeResume', 'loadReviewResume', 'syncDsDone']) expect(refresh, l).toMatch(new RegExp(`this\\.${l}\\(\\);`));
    expect(refresh).toMatch(/return this\.loadHome\(\);/);
  });

  it('resetAccountState() 先清 plan/planToday/profile/badgeInfo/svTodayN/dsDone 再 refreshAccountData()', () => {
    const reset = block(home, 'resetAccountState', 4);
    for (const c of ['plan = null', 'planFetched = false', 'planToday = null', 'profile = undefined', 'profileFetched = false', 'badgeInfo = null', 'svTodayN = null', 'dsDone = null']) expect(reset, c).toContain(`this.${c};`);
    expect(reset.indexOf('this.refreshAccountData();')).toBeGreaterThan(reset.indexOf('this.dsDone = null;'));
  });
});

describe('book.vue 登录态变化后错题/到期/掌握度不留屏', () => {
  it('onLoad 挂 authChanged 监听、onUnload 摘除；onShow 记录 _acctUid', () => {
    const h = authListener(book);
    expect(h).toMatch(/if \(anonUid\(\) === this\._acctUid\) return;/);
    expect(h).toMatch(/this\.resetAccountState\(\);/);
    expect(block(book, 'onUnload', 2)).toMatch(/uni\.\$off\('authChanged', this\._onAuth\)/);
    expect(block(book, 'onShow', 2)).toMatch(/this\._acctUid = anonUid\(\);/);
  });

  it('resetAccountState() 清列表/到期/掌握度/AI 分析/复习态并按当前 uid 重拉（load + 远端复习快照）', () => {
    const reset = block(book, 'resetAccountState', 4);
    for (const c of ['items = []', 'due = []', 'dueTotal = 0', 'masteryMods = {}', 'masteryT3 = {}', 'aiOpen = false', "aiHtml = ''", "aiErr = ''", 'moreSheet = null', 'batchMode = false', 'reviewing = false']) expect(reset, c).toContain(`this.${c};`);
    expect(reset).toContain('setBookBadge(0);');
    expect(reset).toMatch(/this\._acctUid = anonUid\(\);/);
    expect(reset).toMatch(/this\.restoreRemoteSnap\(\);/);
    expect(reset).toMatch(/this\.load\(\);\n {4}\},$/);
    // 不主动 POST review/cur snap:null（那会清掉新身份自己的远端快照）
    expect(reset).not.toMatch(/clearReviewSnap|exitReview/);
  });

  it('标为已掌握 / 删除的写请求失败有用户可见反馈，不再以未捕获 rejection 进 monitor 上报', () => {
    const master = block(book, 'master', 4);
    expect(master).toMatch(/try \{\n\s*await request\('\/api\/mistakes\/' \+ m\.id, \{ method: 'PATCH'/);
    expect(master).toMatch(/catch \(e\) \{\n\s*uni\.showToast\(\{ title: '操作失败：' \+ \(e\.message \|\| '请稍后重试'\), icon: 'none' \}\);\n\s*return;/);
    const del = block(book, 'del', 4);
    expect(del).toMatch(/try \{\n\s*await request\('\/api\/mistakes\/' \+ m\.id \+ '\?uid='/);
    expect(del).toMatch(/catch \(e\) \{\n\s*uni\.showToast\(\{ title: '删除失败：'/);
  });
});
