// R519（R518-1 / R518-3）：讨论页
//  - logged 初值取 token：此前 data.logged=false → onLoad load() 后 onShow 见 token 翻转再 load() → 登录态每次进页同参 GET /api/comments ×2
//  - focus=1（错题详情「抢首评 →」）：登录态聚焦输入框；游客此前静默无提示，现弹同一「需要登录」门，登录回来接上聚焦
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../src/pkgA/social/discuss.vue', import.meta.url), 'utf8');

function pick(re) {
  const m = re.exec(SRC);
  if (!m) throw new Error('source shape changed: ' + re);
  return m[1];
}

// 把 onLoad / onShow / syncLogged / focusCompose / ensureLogin 源文本装进一个最小实例执行
function makePage({ token, qid = 246821, focus }) {
  const calls = { load: 0, loadQuestion: 0, loadInbox: 0, modal: 0, timers: [] };
  const uni = {
    getStorageSync: () => '',
    showModal: () => calls.modal++,
    $on: () => {},
  };
  const getToken = () => token;
  const onLoadBody = pick(/\n {2}onLoad\(opts\) \{\n([\s\S]*?)\n {2}\},\n {2}onUnload/);
  const onShowBody = pick(/\n {2}onShow\(\) \{\n([\s\S]*?)\n {2}\},\n {2}onLoad/);
  const syncBody = pick(/\n {4}syncLogged\(\) \{\n([\s\S]*?)\n {4}\},/);
  const focusBody = pick(/\n {4}focusCompose\(\) \{\n([\s\S]*?)\n {4}\},/);
  const ensureBody = pick(/\n {4}ensureLogin\(\) \{\n([\s\S]*?)\n {4}\},/);
  const loggedInit = pick(/\n {6}logged: ([^\n]*),\n/);
  const page = {
    qid: 0,
    noQid: false,
    loading: true,
    autoFocus: false,
    logged: new Function('getToken', 'return ' + loggedInit)(getToken),
    load() { calls.load++; },
    loadQuestion() { calls.loadQuestion++; },
    loadInbox() { calls.loadInbox++; },
  };
  const mk = (body, args = '') => new Function('uni', 'getToken', 'setTimeout', `return function(${args}){${body}}`)(uni, getToken, (fn) => calls.timers.push(fn));
  page.syncLogged = mk(syncBody);
  page.focusCompose = mk(focusBody);
  page.ensureLogin = mk(ensureBody);
  page.onLoad = mk(onLoadBody, 'opts');
  page.onShow = mk(onShowBody);
  page.onLoad({ qid: String(qid), focus });
  page.onShow(); // uni 生命周期：onLoad → onShow
  return { page, calls, getToken: () => token, setToken: (t) => { token = t; } };
}

describe('discuss.vue R518-1 logged 初值', () => {
  it('源码：data.logged 取 !!getToken()，onShow / authChanged 走同一 syncLogged', () => {
    expect(SRC).toContain('logged: !!getToken(),');
    expect(SRC).not.toContain('logged: false,');
    expect(SRC).toContain('this._onAuth = () => this.syncLogged();');
    expect(SRC).toMatch(/onShow\(\) \{\n {4}this\.syncLogged\(\);\n {4}this\.loadInbox\(\);/);
  });
  it('登录态进页：onLoad + onShow 只发 1 次 load（此前 2 次）', () => {
    const { calls, page } = makePage({ token: 'tok' });
    expect(page.logged).toBe(true);
    expect(calls.load).toBe(1);
    expect(calls.loadInbox).toBe(1);
  });
  it('游客进页：同样 1 次 load；之后 token 出现（authChanged/onShow）才再拉 1 次', () => {
    const t = makePage({ token: '' });
    expect(t.page.logged).toBe(false);
    expect(t.calls.load).toBe(1);
    t.setToken('tok');
    t.page.syncLogged();
    expect(t.page.logged).toBe(true);
    expect(t.calls.load).toBe(2);
    t.page.syncLogged();
    expect(t.calls.load).toBe(2);
  });
});

describe('discuss.vue R518-3 focus=1 落点', () => {
  it('登录态：300ms 后聚焦，不弹登录门', () => {
    const { page, calls } = makePage({ token: 'tok', focus: '1' });
    expect(calls.timers.length).toBe(1);
    calls.timers[0]();
    expect(page.autoFocus).toBe(true);
    expect(calls.modal).toBe(0);
  });
  it('游客：300ms 后弹「需要登录」门、不聚焦、意图保留；登录回来（syncLogged 翻转）接上聚焦并只再 load 1 次', () => {
    const t = makePage({ token: '', focus: '1' });
    t.calls.timers[0]();
    expect(t.calls.modal).toBe(1);
    expect(t.page.autoFocus).toBe(false);
    expect(t.page._wantFocus).toBe(true);
    t.setToken('tok');
    t.page.syncLogged();
    expect(t.page.autoFocus).toBe(true);
    expect(t.page._wantFocus).toBe(false);
    expect(t.calls.load).toBe(2);
    expect(t.calls.modal).toBe(1);
  });
  it('无 focus 参数：游客进页不弹门（只有点输入框/发布才弹）', () => {
    const t = makePage({ token: '' });
    expect(t.calls.timers.length).toBe(0);
    expect(t.calls.modal).toBe(0);
    t.setToken('tok');
    t.page.syncLogged();
    expect(t.page.autoFocus).toBe(false);
  });
  it('源码：ensureLogin 弹层文案不变（与点输入框同一门）', () => {
    expect(SRC).toContain("title: '需要登录',");
    expect(SRC).toContain("content: '发言需登录账号，登录后即可参与讨论',");
    expect(SRC).toContain('@focus="ensureLogin"');
  });
});
