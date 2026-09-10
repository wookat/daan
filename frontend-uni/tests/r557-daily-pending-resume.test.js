// R557：每日一练中途退出后，首页 hero「继续目标」与续练卡「去继续」是两个不同落点（R557 生产游客走查 P2-3）：
// hero → startDaily 重拉当日同一组从第 1 题开始（daily_set 按日固定），续练卡 → resumeNow 接着做；
// 且 pendingSession 不落 _daily/_dailyDate → 续练卡只显「上次练习」、恢复后完成页丢打卡/全站成绩语义。
// 修法：快照加 daily:{date,past}；startDaily 命中同日未做完快照即 adoptLocalPending；恢复还原 _daily 三态；
// 首页 hero 文案「继续今日一练 · 第 k/N 题」、续练卡标题「每日一练 · 今日全站同题」。同轮：错因自评标「（选填）」。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  cnDayOf,
  dailyFromPending,
  dailyPendingFor,
  dailyPendingTitle,
  parsePendingPractice,
  pendingTitle,
  REDO_PENDING_TITLE,
} from '../src/practice-progress.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const practice = read('../src/pages/practice/practice.vue');
const script = practice.slice(practice.indexOf('<script'), practice.indexOf('</script>'));
const tpl = practice.slice(0, practice.indexOf('<script'));
const home = read('../src/pages/home/home.vue');

// 2023-11-14T22:13:20Z = 北京时间 2023-11-15 06:13
const now = 1700000000000;
const TODAY = '2023-11-15';
const q = (id, picked) => ({ id, module: 'yanyu', answer: 'A', options: { A: '1', B: '2' }, ...(picked ? { _picked: picked } : {}) });

describe('R557 pendingSession daily 标记', () => {
  it('dailyFromPending 只认 {date:YYYY-MM-DD}；非当日（东八区）一律归为 past；缺位/坏日期为 null', () => {
    expect(dailyFromPending({ daily: { date: TODAY } }, now)).toEqual({ date: TODAY, past: false });
    expect(dailyFromPending({ daily: { date: '2023-11-01', past: 1 } }, now)).toEqual({ date: '2023-11-01', past: true });
    // 昨晚开的今日一练跨日后接着做：按往期补练处理，不打今日卡、不提交全站成绩
    expect(dailyFromPending({ daily: { date: '2023-11-14' } }, now)).toEqual({ date: '2023-11-14', past: true });
    expect(dailyFromPending({ daily: { date: 'today' } }, now)).toBe(null);
    expect(dailyFromPending({ daily: null }, now)).toBe(null);
    expect(dailyFromPending({}, now)).toBe(null);
    expect(dailyFromPending(null, now)).toBe(null);
  });

  it('parsePendingPractice 透出 daily；旧快照（无 daily 位）为 null，与 redo/ptitle 互不干扰', () => {
    const items = [q(1, 'B'), q(2)];
    expect(parsePendingPractice({ t: now, items, lastModule: null, daily: { date: TODAY } }, now)).toEqual({
      done: 1, next: 2, total: 2, module: '', ptitle: '', redo: false, daily: { date: TODAY, past: false },
    });
    expect(parsePendingPractice({ t: now, items, lastModule: 'yanyu' }, now).daily).toBe(null);
    expect(parsePendingPractice({ t: now, items, redo: 1 }, now)).toMatchObject({ redo: true, daily: null });
  });

  it('续练标题：卷名 > 错题重练 > 每日一练（今日/往期分文案）> 空（调用方回落模块名）', () => {
    expect(dailyPendingTitle({ date: '2026-09-08', past: false })).toBe('每日一练 · 今日全站同题');
    expect(dailyPendingTitle({ date: '2026-09-01', past: true })).toBe('往期每日一练 · 2026-09-01');
    expect(dailyPendingTitle(null)).toBe('');
    expect(pendingTitle({ ptitle: '卷A', daily: { date: TODAY } }, now)).toBe('卷A');
    expect(pendingTitle({ redo: 1, daily: { date: TODAY } }, now)).toBe(REDO_PENDING_TITLE);
    expect(pendingTitle({ daily: { date: TODAY } }, now)).toBe('每日一练 · 今日全站同题');
    expect(pendingTitle({ daily: { date: '2023-11-14' } }, now)).toBe('往期每日一练 · 2023-11-14');
    expect(pendingTitle({ lastModule: 'yanyu' }, now)).toBe('');
  });

  it('cnDayOf 以东八区日界取 YYYY-MM-DD（与 startDaily 拉题的 cnDay 同口径）', () => {
    // 2026-09-08T17:00Z = 09-09 01:00 北京时间
    expect(cnDayOf(Date.UTC(2026, 8, 8, 17))).toBe('2026-09-09');
    expect(cnDayOf(Date.UTC(2026, 8, 8, 15, 59))).toBe('2026-09-08');
  });

  it('dailyPendingFor：仅同日、未做完、24h 内的每日快照命中；异日/做完/普通练习/超期均 null', () => {
    const items = [q(1, 'B'), q(2)];
    const saved = { t: now, items, daily: { date: TODAY } };
    expect(dailyPendingFor(saved, TODAY, now)).toMatchObject({ done: 1, total: 2, daily: { date: TODAY, past: false } });
    // 往期补练同一天也接着做（archiveDate 匹配）
    const past = { t: now, items, daily: { date: '2023-11-01', past: true } };
    expect(dailyPendingFor(past, '2023-11-01', now)).toMatchObject({ daily: { date: '2023-11-01', past: true } });
    expect(dailyPendingFor(saved, '2023-11-14', now)).toBe(null);
    expect(dailyPendingFor({ ...saved, items: [q(1, 'B'), q(2, 'A')] }, TODAY, now)).toBe(null);
    expect(dailyPendingFor({ t: now, items, lastModule: 'yanyu' }, TODAY, now)).toBe(null);
    expect(dailyPendingFor(saved, TODAY, now + 25 * 3600 * 1000)).toBe(null);
    expect(dailyPendingFor(null, TODAY, now)).toBe(null);
  });
});

describe('R557 practice.vue 每日一练续练源锁', () => {
  it('startDaily 在无活动会话且本机有同日未做完快照时 adoptLocalPending 并返回，不重拉题组', () => {
    const i = script.indexOf('async startDaily(');
    const body = script.slice(i, script.indexOf('async start(', i));
    expect(body).toContain('const cnDay = cnDayOf(Date.now());');
    expect(body).toMatch(/if \(!this\.session && dailyPendingFor\(pend, archiveDate \|\| cnDay, Date\.now\(\)\)\) \{\s*this\.adoptLocalPending\(pend\);\s*return;/);
    // 守卫先于 _starting 互斥与 showLoading，命中时不留下未配对的 loading
    expect(body.indexOf('dailyPendingFor(pend')).toBeLessThan(body.indexOf("uni.showLoading({ title: '出题中…'"));
  });

  it('每日一练启动成功即 saveSession（未答刷新可恢复，与 R548 普通/重练启动同口径），source=daily 随 answer_log 落库', () => {
    const i = script.indexOf('async startDaily(');
    const body = script.slice(i, script.indexOf('async start(', i));
    expect(body).toContain("this._source = 'daily';");
    expect(body).toMatch(/this\.session = true;\s*this\.startQTimer\(\);\s*this\.saveSession\(\);/);
  });

  it('saveSession 快照带 daily:{date,past}（仅每日一练且拉题成功；回退普通练习为 null）', () => {
    expect(script).toContain('daily: this._daily && this._dailyDate ? { date: this._dailyDate, past: !!this._dailyPast } : null,');
  });

  it('adoptLocalPending 按 daily 位还原 _daily/_dailyDate/_dailyPast（完成页打卡/全站成绩语义不丢），toast 报待续题号', () => {
    const i = script.indexOf('adoptLocalPending(s) {');
    const body = script.slice(i, script.indexOf('adoptPracticeResume', i) > 0 ? script.indexOf('    },', i) : i + 3000);
    expect(body).toContain('const daily = dailyFromPending(s, Date.now());');
    expect(body).toContain('this._daily = !!daily;');
    expect(body).toContain("this._dailyDate = daily ? daily.date : '';");
    expect(body).toContain('this._dailyPast = daily ? daily.past : false;');
    expect(body).toContain("else if (daily) uni.showToast({ title: '继续' + (daily.past ? '往期每日一练' : '今日一练') + ' · 第 ' + (this.idx + 1) + '/' + this.items.length + ' 题', icon: 'none' });");
  });

  it('错因自评标题标明「（选填）」（生产走查确认未选错因也可下一题，但界面未告知）', () => {
    expect(tpl).toContain('<text class="rz-t">错因自评（选填）</text>');
    expect(tpl).toContain('aria-label="错因自评"');
  });
});

describe('R557 home.vue hero 与续练卡同落点', () => {
  it('hero 主按钮文案：今日已完成「再练 10 题」> 同日未做完每日快照「继续今日一练 · 第 k/N 题」> 「继续目标」', () => {
    expect(home).toContain(':primary="{ text: heroPrimaryText }"');
    expect(home).toContain("if (this.todayDone) return '再练 10 题';");
    expect(home).toContain("return r ? '继续今日一练 · 第 ' + r.next + '/' + r.total + ' 题' : '继续目标';");
    expect(home).toMatch(/dailyPendingToday\(\) \{\s*const r = this\.practiceResume;\s*return r && r\.daily && !r\.daily\.past && r\.daily\.date === cnDayOf\(Date\.now\(\)\) \? r : null;/);
  });

  it('续练卡标题：卷名 > 错题重练 > 每日一练 > 模块名/上次练习', () => {
    expect(home).toMatch(/if \(r\.redo\) return REDO_PENDING_TITLE;\s*if \(r\.daily\) return dailyPendingTitle\(r\.daily\);\s*return this\.prModName\(r\.module\);/);
  });
});
