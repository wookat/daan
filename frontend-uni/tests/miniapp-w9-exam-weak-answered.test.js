import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { weakModule } from '../../miniapp-native/miniprogram/utils/kg-exam-report.ts';

const mpPath = (p) => fileURLToPath(new URL('../../miniapp-native/miniprogram/' + p, import.meta.url));
const mp = (p) => readFileSync(mpPath(p), 'utf8');

const row = (key, pct, avgPct, extra = {}) => ({ key, name: key + '名', n: 10, correct: 0, pct, avgPct, ...extra });

// W9-C：小程序薄弱模块与 H5 W9-B 同口径——按已答题数/已答正确率判定，整模块未答不出「薄弱模块」；
// practice_result 带 uid；退出登录后重拉我的页数据；删除零引用 utils/exam-progress.ts。
describe('W9-C kg-exam-report.weakModule：按已答判定', () => {
  it('answered=0（整模块未答）不判：即便 pct 0 / 低于均值也不出薄弱模块', () => {
    expect(weakModule([row('shuliang', 0, 70, { answered: 0, ansPct: undefined })])).toBe(null);
    expect(weakModule([row('shuliang', 0, 70, { answered: 0 }), row('yanyu', 90, 80, { answered: 10, ansPct: 90 })])).toBe(null);
  });
  it('answered < MIN_N(3) 不判；answered ≥ 3 按 ansPct 判', () => {
    expect(weakModule([row('ziliao', 20, 70, { answered: 2, ansPct: 100 })])).toBe(null);
    const r = weakModule([row('ziliao', 20, 70, { answered: 4, ansPct: 50 })]);
    expect(r).toEqual({ key: 'ziliao', name: 'ziliao名', reason: '低于全站均值 20 个百分点' });
  });
  it('已答正确率高于全卷正确率时不误判：pct 30（未答拖低）但 ansPct 100 → 不薄弱', () => {
    expect(weakModule([row('panduan', 30, 70, { answered: 3, ansPct: 100 })])).toBe(null);
  });
  it('兜底文案：ansPct 口径写「本卷已答正确率」，无 answered 字段回落 n/pct 写「本卷正确率」', () => {
    expect(weakModule([row('yanyu', 40, null, { answered: 5, ansPct: 40 })])).toEqual({
      key: 'yanyu',
      name: 'yanyu名',
      reason: '本卷已答正确率 40%，全卷最低',
    });
    expect(weakModule([row('yanyu', 40, null)])).toEqual({ key: 'yanyu', name: 'yanyu名', reason: '本卷正确率 40%，全卷最低' });
  });
  it('缺省回落与 H5 exam-weak.js 既有断言一致：n<3 不判 / 5pt 边界 / 60% 边界 / 非法 pct', () => {
    expect(weakModule([row('yanyu', 10, 80, { n: 2 })])).toBe(null);
    expect(weakModule([row('yanyu', 55, 60)]).reason).toBe('低于全站均值 5 个百分点');
    expect(weakModule([row('yanyu', 70, 74.9)])).toBe(null);
    expect(weakModule([row('yanyu', 60, null), row('panduan', 95, null)])).toBe(null);
    expect(weakModule([row('yanyu', NaN, 80)])).toBe(null);
    expect(weakModule([row('xingce_unknown', 10, 80)])).toBe(null);
  });
  it('源锁：ModuleRow 声明 answered/ansPct；report.ts 映射补 answered 与按已答折算的 ansPct', () => {
    const ts = mp('utils/kg-exam-report.ts');
    expect(ts).toMatch(/export interface ModuleRow \{[\s\S]*?answered\?: number;\s*ansPct\?: number;\s*\}/);
    expect(ts).toMatch(/const cnt = m\.answered == null \? m\.n : m\.answered;/);
    expect(ts).toMatch(/const pct = m\.ansPct == null \? m\.pct : m\.ansPct;/);
    const rep = mp('pkgExam/report/report.ts');
    expect(rep).toMatch(/answered: pm\[k\]\.answered,\s*ansPct: pm\[k\]\.answered \? Math\.round\(\(pm\[k\]\.correct \/ pm\[k\]\.answered\) \* 100\) : undefined,/);
  });
});

describe('W9-C 小程序：practice_result 带 uid / 退出登录后刷新 / exam-progress.ts 已删', () => {
  it('api/index.ts postPracticeResult data 含 uid: anonUid()', () => {
    const api = mp('api/index.ts');
    expect(api).toMatch(/'\/api\/practice_result', \{\s*method: 'POST',\s*data: \{ uid: anonUid\(\), module, n, correct, secs \},/);
  });
  it('profile.ts：onShow 与 onLogout 共用 refresh()；退出后先清服务端派生态再重拉', () => {
    const ts = mp('pages/profile/profile.ts');
    expect(ts).toMatch(/onShow\(\) \{\s*syncTabBar\(this, 4\);\s*this\.refresh\(\);\s*\}/);
    expect(ts).toMatch(/refresh\(\) \{[\s\S]*?this\.loadBadges\(\);\s*this\.loadGrowth\(\);\s*this\.loadReminder\(\);\s*this\.loadMistakes\(\);\s*this\.loadSocial\(\);\s*\}/);
    expect(ts).toMatch(
      /clearAuth\(\);\s*this\.setData\(\{ badgeInfo: null, nextMilestone: null, inboxUnread: 0, pkN: 0, mistakeN: 0, mastered: 0 \}\);\s*this\.refresh\(\);/
    );
    expect(ts).not.toMatch(/this\.setData\(\{ user: null, uid: anonUid\(\) \}\)/);
  });
  it('utils/exam-progress.ts 已删除且仓库内无引用（kg-exam-progress.ts 承担）', () => {
    expect(existsSync(mpPath('utils/exam-progress.ts'))).toBe(false);
    expect(existsSync(mpPath('utils/kg-exam-progress.ts'))).toBe(true);
    for (const p of ['pkgExam/exam/exam.ts', 'pkgExam/list/list.ts', 'pages/home/home.ts', 'pages/exam/exam.ts', 'pkgExam/contest-report/contest-report.ts']) {
      expect(mp(p)).not.toMatch(/utils\/exam-progress'/);
    }
  });
});
