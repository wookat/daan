// R580：全部答完却没走到完成页就离开（顶栏/浏览器返回、页内退出图标）→ 视同完成，落成绩 + 每日一练打卡。
// 生产 375 实拍（r580 w375/02-daily-done → 03-home-after-daily）：今日一练答完第 10 题（错答反馈态）从顶栏返回，
// saveSession 全答即清本机/远端快照，onUnload 不经 quit()/submitResult → answer_log 10 行、daily_set_entries 0、practice_results 0，
// 首页 hero 仍「来做今天第 1 人 · 立即开练」，再点进从第 1 题重来；页内退出图标同样：quitSummary 全答返 null → leave(false) 直接清。
// 修法：finalizeIfAnswered() 挂 onUnload 与 leave() 入口，全答且未 resultSent 即 markDailyDone(true) + submitResult(true)（silent 只落数据）。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { allAnswered, quitSummary } from '../src/quit-summary.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const practice = read('../src/pages/practice/practice.vue') + read('../src/practice/daily-ops.js') + read('../src/practice/session-ops.js');

function fnBody(startMarker, endMarker) {
  const i = practice.indexOf(startMarker);
  expect(i, startMarker).toBeGreaterThan(0);
  const j = practice.indexOf(endMarker, i);
  expect(j, endMarker).toBeGreaterThan(i);
  return practice.slice(i, j);
}

const q = (picked = '') => ({ id: 1, answer: 'A', _picked: picked });

describe('allAnswered', () => {
  it('全部已答为 true；空/非数组/仍有未答为 false', () => {
    expect(allAnswered([q('A'), q('B')])).toBe(true);
    expect(allAnswered([q('A'), q()])).toBe(false);
    expect(allAnswered([])).toBe(false);
    expect(allAnswered(null)).toBe(false);
    expect(allAnswered([q('A'), null])).toBe(false);
  });

  it('与 quitSummary 互补：全答 quitSummary 为 null（无中途退出层），此时由 allAnswered 决定视同完成', () => {
    const items = [q('A'), q('B')];
    expect(quitSummary(items, true)).toBeNull();
    expect(allAnswered(items)).toBe(true);
    const half = [q('A'), q()];
    expect(quitSummary(half, true)).not.toBeNull();
    expect(allAnswered(half)).toBe(false);
  });
});

describe('practice.vue 离页视同完成', () => {
  it('finalizeIfAnswered：会话中、未上报、非模考/背题/时政且全答 → markDailyDone(true) + submitResult(true)', () => {
    const body = fnBody('    finalizeIfAnswered() {', '    async submitResult(silent = false) {');
    expect(body).toContain("if (!this.session || this.resultSent || this.examMode || this.beiMode || this._shizheng) return false;");
    expect(body).toContain('if (!allAnswered(this.items)) return false;');
    expect(body).toContain('this.markDailyDone(true);');
    expect(body).toContain('this.submitResult(true);');
    expect(body).toContain('return true;');
  });

  it('onUnload（顶栏/浏览器返回不经 quit）先 finalizeIfAnswered', () => {
    const body = fnBody('  onUnload() {', '  watch: {');
    expect(body).toContain('this.finalizeIfAnswered();');
  });

  it('leave()：入口先 finalizeIfAnswered，已视同完成则不再推远端进度、不再重复清快照', () => {
    const body = fnBody('    leave(keep) {', '      this.examMode = false;');
    expect(body.indexOf('const done = this.finalizeIfAnswered();')).toBeGreaterThan(0);
    expect(body).toContain('if (done) {');
    expect(body).toContain('} else if (keep) {\n        clearTimeout(this._ppTimer);\n        this.pushPracticeProgress();');
    expect(body).toContain("} else {\n        uni.removeStorageSync('pendingSession');");
    // 视同完成时 leave 自己的 logAttempts 先把待报作答发出（_logged 同步置位），submitResult 里的 logAttempts 不会重复落库
    expect(body.indexOf('const done = this.finalizeIfAnswered();')).toBeLessThan(body.indexOf('this.logAttempts(this.items);'));
  });

  it('submitResult(silent)：仍清快照、写本机历史、POST practice_result、补报作答；silent 不打 login_nudge_show、不拉到期数/推送提示；items 提前取引用不受 leave 清空影响', () => {
    const body = fnBody('    async submitResult(silent = false) {', '    async syncRedoReviews() {');
    expect(body).toContain("if (this.loginNudgeN && !silent) trackEvent('login_nudge_show');");
    expect(body).toContain('const items = this.items;');
    expect(body).toContain("uni.removeStorageSync('pendingSession');\n      this.clearServerProgress();");
    expect(body).toContain("uni.setStorageSync('practiceHistory', hist.slice(0, 100));");
    expect(body).toContain("await request('/api/practice_result', {");
    expect(body).toContain('await this.logAttempts(items);\n      if (silent) return;\n      await this.syncRedoReviews();');
    expect(body).toContain('if (items.length >= 5) this.initPushNudge();');
  });

  it('markDailyDone(silent) 透传到 sendDailyResult；silent 提交成功后不拉榜/不起推送提示（payload 仍先落 dailyPendingSubmit 供首页补传）', () => {
    const md = fnBody('    markDailyDone(silent = false) {', '    sendDailyResult(payload, silent = false) {');
    expect(md).toContain("this.sendDailyResult({ uid: anonUid(), nickname: pkNickname(), date, right: this.right, total: this.items.length, secs: this.totalSecs }, silent);");
    expect(md).toContain("uni.showToast({ title: '今日一练完成，打卡成功！', icon: 'none' });");
    const sd = fnBody('    sendDailyResult(payload, silent = false) {', '    retryDailySubmit() {');
    expect(sd).toContain('return submitDailySet(payload)');
    expect(sd).toContain('this.dailyStats = d;\n          if (silent) return d;');
  });

  it('离页视同完成的 payload 全部在首个 await 之前同步取值（leave()/卸载随后清 items/session 不影响成绩、打卡、作答补报）', () => {
    const sr = fnBody('    async submitResult(silent = false) {', '    async syncRedoReviews() {');
    // submitResult 首个 await 就是 practice_result 请求本身：uid/module/n/correct/secs 在调用时刻求值
    expect(sr.indexOf('await ')).toBe(sr.indexOf("await request('/api/practice_result', {"));
    expect(sr).toContain("data: { uid: anonUid(), module: this.lastModule || '', n: this.items.length, correct: this.right, secs: this.totalSecs }");
    // 作答补报用提前取下的 items 引用，不再读 this.items
    expect(sr).toContain('await this.logAttempts(items);');
    // markDailyDone 同步构造 payload 后才交给 sendDailyResult（其中才有网络等待）
    const md = fnBody('    markDailyDone(silent = false) {', '    sendDailyResult(payload, silent = false) {');
    expect(md).not.toContain('await ');
    // 二次触发（页内退出 leave → navigateBack → onUnload）靠 resultSent 幂等：finalizeIfAnswered 与 submitResult 均以 resultSent 为闸
    const fin = fnBody('    finalizeIfAnswered() {', '    async submitResult(silent = false) {');
    expect(fin).toContain('this.resultSent');
    expect(sr).toContain('if (this.beiMode || this.resultSent || !this.items.length) return;\n');
    expect(sr).toContain('this.resultSent = true;');
  });

  it('自然完成路径（idx 走到末尾）仍按原顺序 markDailyDone → submitResult，不带 silent', () => {
    expect(practice).toContain('this.markDailyDone();\n        this.markShizhengDone();\n        this.submitResult();');
  });
});
