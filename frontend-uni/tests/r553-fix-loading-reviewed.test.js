// R553 复验两条既有 P3 实修：
// ① startPaper 复现 R552-fix 同形态 warn「showLoading 与 hideLoading 必须配对使用」（try 内 toast/actionSheet/modal 顶掉 loading 后 finally hideLoading）；
//    同形态还有 startExam / startDaily / startShizheng / reviewShizheng，一并改为「回包后立即 hideLoading，再出交互；catch 先 hide 再 toast」。
//    startDaily 顺带修 catch 内 this.start() 被自身 _starting 互斥挡掉的死回退（改为 finally 复位后再回退）。
// ② 跨 F5 完成页「本组答对 n 道曾错题」少计：_reviewed 只在内存，pendingSession 不存 → 恢复后只剩恢复后作答的部分。
//    现快照带 reviewed，adoptLocalPending 经 reviewedFromPending 还原；answer_log 回包晚于作答时 saveSession 再补写。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reviewedFromPending, reviewedMasteredCount } from '../src/review-advance.js';

const PRACTICE = readFileSync(fileURLToPath(new URL('../src/pages/practice/practice.vue', import.meta.url)), 'utf8');

function fnBody(startMarker, endMarker) {
  const i = PRACTICE.indexOf(startMarker);
  expect(i, startMarker).toBeGreaterThan(0);
  const j = PRACTICE.indexOf(endMarker, i);
  expect(j, endMarker).toBeGreaterThan(i);
  return PRACTICE.slice(i, j);
}

describe('R553-fix ① practice.vue 六处启动器 loading 与交互配对', () => {
  const cases = [
    ['async startPaper(p, untimed = false, wantWrong = false) {', '    async startExam(full) {', "const d = await request('/api/paper_questions?' + paperQuery(p, untimed, anonUid()));\n        uni.hideLoading();", '加载失败：'],
    ['async startExam(full) {', '    finishExam() {', "items = d.items || [];\n        }\n        uni.hideLoading();", '加载失败：'],
    ['async startShizheng(archiveDate) {', '    async reviewShizheng() {', "'/api/shizheng/daily');\n        uni.hideLoading();", '加载失败：'],
    ['async reviewShizheng() {', '    markShizhengDone() {', "const d = await request('/api/shizheng/daily');\n        uni.hideLoading();", '加载失败：'],
  ];
  for (const [start, end, hideAfterRequest, failText] of cases) {
    it(start + ' 回包后先 hideLoading 再交互；catch 先 hide 再 toast；finally 不 hideLoading', () => {
      const fn = fnBody(start, end);
      expect(fn).toContain('uni.showLoading(');
      const hide = fn.indexOf(hideAfterRequest);
      expect(hide).toBeGreaterThan(0);
      for (const ui of ['uni.showToast(', 'uni.showActionSheet(', 'uni.showModal(']) {
        const k = fn.indexOf(ui);
        if (k >= 0) expect(k, ui).toBeGreaterThan(hide);
      }
      expect(fn).toContain("} catch (e) {\n        uni.hideLoading();\n        uni.showToast({ title: '" + failText);
      const fin = fn.indexOf('} finally {');
      if (fin >= 0) expect(fn.slice(fin)).not.toContain('uni.hideLoading()');
      expect((fn.match(/uni\.hideLoading\(\)/g) || []).length).toBe(2);
    });
  }

  it('startDaily：回包后 hideLoading；catch 只置 fallback，finally 复位 _starting 后再 start() 回退（互斥不再挡死）', () => {
    const fn = fnBody('async startDaily(archiveDate, src) {', '    markDailyDone() {');
    expect(fn).toContain('let fallback = false;');
    const hide = fn.indexOf("await request('/api/daily_set');\n        uni.hideLoading();");
    expect(hide).toBeGreaterThan(0);
    expect(fn.indexOf("uni.showToast({ title: this._dailyPast")).toBeGreaterThan(hide);
    expect(fn).toContain('} catch (e) {');
    const c = fn.indexOf('} catch (e) {');
    const body = fn.slice(c);
    expect(body).toContain('uni.hideLoading();');
    expect(body).toContain('fallback = true;');
    expect(body).not.toMatch(/catch \(e\) \{[\s\S]*this\.start\(this\.dailyModule\)[\s\S]*\} finally/);
    expect(body).toContain('} finally {\n        this._starting = false;\n      }\n      if (fallback) this.start(this.dailyModule);');
    expect((fn.match(/uni\.hideLoading\(\)/g) || []).length).toBe(2);
  });

  it('R552-fix startReinforce 形态保持（回归锁）', () => {
    const fn = fnBody('async startReinforce(launch) {', '    loginNudgeGo() {');
    expect(fn).toContain('const d = await request(q);\n        uni.hideLoading();');
    expect(fn).toContain('} finally {\n        this._starting = false;\n      }');
  });
});

describe('R553-fix ② reviewedFromPending 纯函数', () => {
  it('非法/缺失快照 → []', () => {
    expect(reviewedFromPending(null)).toEqual([]);
    expect(reviewedFromPending({})).toEqual([]);
    expect(reviewedFromPending({ reviewed: 'x' })).toEqual([]);
    expect(reviewedFromPending({ reviewed: [null, {}, { mistake_id: 0 }, { mistake_id: -1 }, { mistake_id: '3' }] })).toEqual([]);
  });
  it('合法项归一 + 按 mistake_id 去重，mastered 仅 true 计', () => {
    const out = reviewedFromPending({ reviewed: [
      { mistake_id: 3637, streak: 1, mastered: false },
      { mistake_id: 3638, streak: 6, mastered: true },
      { mistake_id: 3637, streak: 2, mastered: false },
      { mistake_id: 3639, streak: 'x', mastered: 1 },
    ] });
    expect(out).toEqual([
      { mistake_id: 3637, streak: 1, mastered: false },
      { mistake_id: 3638, streak: 6, mastered: true },
      { mistake_id: 3639, streak: 0, mastered: false },
    ]);
    expect(reviewedMasteredCount(out)).toBe(1);
  });
});

describe('R553-fix ② practice.vue reviewed 随 pendingSession 持久', () => {
  it('saveSession 快照带 reviewed；adoptLocalPending 经 reviewedFromPending 还原', () => {
    expect(PRACTICE).toContain("import { reviewedMasteredCount, fixReportText, reviewedFromPending } from '../../review-advance.js';");
    const save = fnBody('    saveSession() {', '    pushPracticeProgress() {');
    expect(save).toContain("redo: this._redoItems && this._redoItems.length && !this.lastModule ? 1 : 0,\n        reviewed: this._reviewed || [],\n      });");
    const adopt = fnBody('    adoptLocalPending(s) {', '    adoptRemoteSnap(snap) {');
    expect(adopt).toContain('this._redoItems = redoItemsFromPending(s);\n      this._reviewed = reviewedFromPending(s);');
  });
  it('answer_log 回包 concat reviewed 后未答完则 saveSession 补写快照；start() 清 _reviewed', () => {
    const log = fnBody('    async logAttempts(qs) {', '    quit() {');
    expect(log).toContain("this._reviewed = (this._reviewed || []).concat(r.reviewed);\n              // 回包晚于作答时的 saveSession，补写快照让 reviewed 跨刷新不丢；已全答完则不重复清快照\n              if (this.session && this.items.some((q) => !q._picked)) this.saveSession();");
    const start = fnBody('    async start(module, submodule, count, adaptive, forceReal, tag3, source, year) {', '      this.beginLoadState();');
    expect(start).toContain('this._reviewed = [];');
  });
  it('syncRedoReviews 仍以内存 _reviewed 汇总并清空（完成页口径不变）', () => {
    const sync = fnBody('    async syncRedoReviews() {', '    async loadDueReview() {');
    expect(sync).toContain('const reviewed = this._reviewed || [];\n      this._reviewed = [];');
    expect(sync).toContain('if (reviewed.length) this.fixReport = { n: reviewed.length, mastered: reviewedMasteredCount(reviewed) };');
  });
});
