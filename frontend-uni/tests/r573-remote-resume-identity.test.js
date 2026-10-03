// R573：首页「有一组未做完的练习」远端续练卡的两处失真（生产 practice_progress 6 行非测试进度，含 link/redo 与无 source 场次）
// ① 服务端快照不带 daily:{date,past}，跨设备/清本机后恢复每日一练会变成普通练习（不打卡、不提交全站成绩、顶栏无「每日一练」）；
//    首页 prLabel 依赖 r.redo / r.daily，parseRemotePractice 却从不给出 → 远端重练/每日一练场次卡面只显「上次练习」
// ② request() 网络失败以 apiSnap 旧快照 resolve，parseRemotePractice 新造对象丢 staleAt 身份 → 旧进度当实时进度陈述
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  collectPracticeProgress, parseRemotePractice, adoptPracticeResume, markRemoteResume, dailyMeta, cnDayOf,
} from '../src/practice-progress.js';
import { snapshotProgressNote, netOnlineNow } from '../src/snapshot-notice.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const home = read('../src/pages/home/home.vue');
const practice = read('../src/pages/practice/practice.vue');
const method = (src, name) => {
  const m = src.match(new RegExp(`\\n {4}(?:async )?${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, name).toBeTruthy();
  return m[1];
};

const NOW = 1_800_000_000_000;
const today = cnDayOf(NOW);
const items = [{ id: 1, _picked: 'A' }, { id: 2 }];

describe('dailyMeta / collectPracticeProgress 上送 daily', () => {
  it('合法 {date,past} 原样归一（不按今天重算 past）；形状不对 → null', () => {
    expect(dailyMeta({ date: '2026-09-01', past: 1 })).toEqual({ date: '2026-09-01', past: true });
    expect(dailyMeta({ date: '2026-09-01' })).toEqual({ date: '2026-09-01', past: false });
    expect(dailyMeta({ date: '09-01' })).toBeNull();
    expect(dailyMeta('2026-09-01')).toBeNull();
    expect(dailyMeta(null)).toBeNull();
  });

  it('payload 带 daily；不传/非法为 null（老形状不受影响）', () => {
    const p = collectPracticeProgress(items, 0, 1, 1, 1, '', '', 'daily', '', { date: today, past: false });
    expect(p.daily).toEqual({ date: today, past: false });
    expect(collectPracticeProgress(items, 0, 1, 1, 1, 'm', '', '', '').daily).toBeNull();
    expect(collectPracticeProgress(items, 0, 1, 1, 1, 'm', '', '', '', { date: 'x' }).daily).toBeNull();
  });
});

describe('parseRemotePractice 透出场次身份（与 parsePendingPractice 同口径）', () => {
  it('source=redo → redo:true；daily 按今天重算 past；普通场次 redo:false/daily:null', () => {
    const redo = parseRemotePractice({ items: [{ id: 1 }], source: 'redo' }, NOW);
    expect(redo.redo).toBe(true);
    expect(redo.daily).toBeNull();
    const todayDaily = parseRemotePractice({ items: [{ id: 1 }], source: 'daily', daily: { date: today, past: false } }, NOW);
    expect(todayDaily).toMatchObject({ redo: false, daily: { date: today, past: false } });
    const crossDay = parseRemotePractice({ items: [{ id: 1 }], source: 'daily', daily: { date: '2020-01-01', past: false } }, NOW);
    expect(crossDay.daily).toEqual({ date: '2020-01-01', past: true });
    expect(parseRemotePractice({ items: [{ id: 1 }], source: 'link', daily: null }, NOW)).toMatchObject({ redo: false, daily: null });
  });

  it('adoptPracticeResume：redo 场次给出剥离作答态的 redoItems 母本；daily 同口径；普通场次 redoItems null', () => {
    const s = adoptPracticeResume({ items: [{ id: 1, stem: 's' }, { id: 2, stem: 't' }], picks: { 1: 'A' }, source: 'redo' }, NOW);
    expect(s.redoItems).toEqual([{ id: 1, stem: 's' }, { id: 2, stem: 't' }]);
    expect(s.items[0]._picked).toBe('A');
    expect(s.daily).toBeNull();
    const d = adoptPracticeResume({ items: [{ id: 1 }], source: 'daily', daily: { date: today } }, NOW);
    expect(d.redoItems).toBeNull();
    expect(d.daily).toEqual({ date: today, past: false });
    expect(adoptPracticeResume({ items: [{ id: 1 }], module: 'yanyu' }, NOW).redoItems).toBeNull();
  });
});

describe('markRemoteResume + snapshotProgressNote', () => {
  it('真实回包 snapAt=0；旧快照带 snapAt 与 netOnline；null 透传 null', () => {
    const r = parseRemotePractice({ items: [{ id: 1 }] }, NOW);
    expect(markRemoteResume(r, 0, true)).toMatchObject({ snapAt: 0, netOnline: true });
    expect(markRemoteResume(r, NOW - 60_000, undefined)).toMatchObject({ snapAt: NOW - 60_000, netOnline: null });
    expect(markRemoteResume(null, NOW, true)).toBeNull();
  });

  it('文案：真离线 / 网络不稳定 + 快照时刻，不含「同步」类实时陈述', () => {
    expect(snapshotProgressNote(NOW - 5 * 60_000, false, NOW)).toBe('当前离线 · 以上为5 分钟前缓存的进度');
    expect(snapshotProgressNote(NOW - 3_600_000, true, NOW)).toBe('网络不稳定 · 以上为1 小时前缓存的进度');
    expect(snapshotProgressNote(NOW - 3_600_000, null, NOW)).toBe('网络不稳定 · 以上为1 小时前缓存的进度');
    expect(netOnlineNow()).toBe(typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : null);
  });
});

describe('源锁：home.vue 远端续练卡 / practice.vue 上送与远端采纳', () => {
  it('home loadPracticeResume 在转换前取 staleAt(d) 并经 markRemoteResume 挂到卡数据；本机 pendingSession 仍优先', () => {
    const body = method(home, 'loadPracticeResume');
    expect(body).toMatch(/const local = parsePendingPractice\(uni\.getStorageSync\('pendingSession'\), Date\.now\(\)\);[\s\S]*if \(local\) \{[\s\S]*this\.practiceResume = local;[\s\S]*return;/);
    expect(body).toContain("this.practiceResume = markRemoteResume(parseRemotePractice(d), staleAt(d), netOnlineNow());");
    expect(home).toMatch(/import \{[^}]*\bstaleAt\b[^}]*\} from '\.\.\/\.\.\/api\.js'/);
  });

  it('home 卡面：snapAt 非 0 才出旧快照注（warn 色），标题/计数行不变', () => {
    expect(home).toContain('<text class="rs-s">{{ prLabel(practiceResume) }} · 已做 {{ practiceResume.done }}/{{ practiceResume.total }} 题</text>');
    expect(home).toContain('<text v-if="practiceResume.snapAt" class="rs-s rs-stale">{{ snapshotProgressNote(practiceResume.snapAt, practiceResume.netOnline) }}</text>');
    expect(home).toMatch(/\.rs-stale \{ color: var\(--warn\); \}/);
  });

  it('practice pushPracticeProgress 带 daily；adoptRemoteSnap 还原 redoItems/daily 三字段并与本机采纳同 toast 文案', () => {
    const push = method(practice, 'pushPracticeProgress');
    expect(push).toContain("this._daily && this._dailyDate ? { date: this._dailyDate, past: !!this._dailyPast } : null");
    const adopt = method(practice, 'adoptRemoteSnap');
    expect(adopt).toContain('this._redoItems = snap.redoItems;');
    expect(adopt).toContain('this._daily = !!snap.daily;');
    expect(adopt).toContain("this._dailyDate = snap.daily ? snap.daily.date : '';");
    expect(adopt).toContain('this._dailyPast = snap.daily ? snap.daily.past : false;');
    expect(adopt).toContain("if (this._redoItems) uni.showToast({ title: '继续' + REDO_PENDING_TITLE, icon: 'none' });");
    expect(adopt).toContain("else if (snap.daily) uni.showToast({ title: '继续' + (snap.daily.past ? '往期每日一练' : '今日一练') + ' · 第 ' + (this.idx + 1) + '/' + this.items.length + ' 题', icon: 'none' });");
  });
});
