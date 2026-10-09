/**
 * W17-C1 生成型文案快照：docs/iter/workflow/w17c-content-human.md §2 台账 58 条「需改」样本的输入 → 改后文本，
 * 现文（before）作为禁词回归；再锁 H5 模板与小程序同源字符串。来源 prod = 生产 test-w17-copy-* 实测，local = 本地 uvicorn 补样。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  RANK_MIN_SAMPLE,
  rankLine,
  rankCardView,
  reportHeroLine,
  weakNote,
  contestCorrectTotal,
  redoDesc,
  contestHeroLine,
  weeklyMockLine,
  weeklyEmptyDesc,
  weeklyPendingDesc,
  shareBeatLine,
  qShareCopy,
  dailySetLine,
  dailySetShareTail,
  percentileLine,
  percentileShareTail,
} from '../src/exam-copy.js';
import { reviewDoneCopy, reviewVerdict } from '../src/review-summary.js';
import * as mp from '../../miniapp-native/miniprogram/utils/review-verdict.ts';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const U = 'https://kaogong.zalize.com/s/bttwmr74?v=';
const WEAK_OLD = '本卷错题较少，暂未形成薄弱考点结论，继续保持！';
const REDO_OLD = '按刷题模式把本卷答错的题重做一遍';

/** [id, 来源, 位置, 现文, 改后(实际调用)] */
const CASES = [
  ['S01', 'prod', 'report hero 低分 10.6', '答对 7/66（已答 58）· 用时 0 分 0 秒', () => reportHeroLine({ correct: 7, total: 66, answered: 58 }, '0 分 0 秒'), '答对 7/66，8 题未答，用时 0 分 0 秒'],
  ['S02', 'prod', 'report hero 二战 72.7', '答对 48/66（已答 66）· 用时 0 分 0 秒', () => reportHeroLine({ correct: 48, total: 66, answered: 66 }, '0 分 0 秒'), '答对 48/66，用时 0 分 0 秒'],
  ['S03', 'prod', 'report hero 全对', '答对 66/66（已答 66）· 用时 0 分 0 秒', () => reportHeroLine({ correct: 66, total: 66, answered: 66 }, '0 分 0 秒'), '答对 66/66，用时 0 分 0 秒'],
  ['S04', 'prod', 'report hero 迷你模考', '答对 5/30（已答 30）· 用时 0 分 0 秒', () => reportHeroLine({ correct: 5, total: 30, answered: 30 }, '0 分 0 秒'), '答对 5/30，用时 0 分 0 秒'],
  ['S05', 'prod', 'report 无薄弱考点（全对）', WEAK_OLD, () => weakNote(66, 66), '全对，没有薄弱考点'],
  ['S06', 'local', 'report 无薄弱考点（有错题）', WEAK_OLD, () => weakNote(27, 30), '本卷错题少，看不出薄弱考点'],
  ['S07', 'prod', 'report 重练副标 答错 51', REDO_OLD + '（本轮先练前 10 题）', () => redoDesc(51, 10), '答错 51 题，这轮先重练前 10 题'],
  ['S08', 'prod', 'report 重练副标 答错 18', REDO_OLD + '（本轮先练前 10 题）', () => redoDesc(18, 10), '答错 18 题，这轮先重练前 10 题'],
  ['S09', 'prod', 'report 重练副标 答错 5', REDO_OLD, () => redoDesc(5, 5), '答错 5 题，按刷题模式重练一遍'],
  ['S12', 'prod', 'rank-card total=1', '参与人数仍较少（1 人），暂不计算击败比例', () => rankCardView({ total: 1, beaten_pct: 0, small_sample: true }).line, '参与人数还少（1 人），暂不算比例'],
  ['S14', 'prod', 'rank-card total=8', '参与人数仍较少（8 人），暂不计算击败比例', () => rankCardView({ total: 8, beaten_pct: 25, small_sample: true }).line, '参与人数还少（8 人），暂不算比例'],
  ['S16', 'local', 'rank-card 14 人 rank 2', '79% 已击败（样本 14 人）', () => { const v = rankCardView({ total: 14, beaten_pct: 79, small_sample: true }); return v.pct + '% ' + v.label; }, '79% 超过的考友'],
  ['S17', 'local', 'report beatText 14 人 rank 2', '击败 79% 考生', () => rankLine(14, 79), '超过 79% 的考友'],
  ['S18', 'local', 'rank-card 14 人 rank 14 pct 0', '0% 已击败（样本 14 人）', () => rankCardView({ total: 14, beaten_pct: 0, small_sample: true }).line, '还没超过其他考友（共 14 人）'],
  ['S19', 'local', 'report beatText 14 人 pct 0', '击败 0% 考生', () => rankLine(14, 0), '还没超过其他考友（共 14 人）'],
  ['S20', 'local', 'contest hero-beat 90 分 2/14', '击败 79% 考生', () => rankLine(14, 79), '超过 79% 的考友'],
  ['S21', 'local', 'contest hero-line 90 分', '第 2 名 / 14 人 · 全场平均 63.6 分', () => contestHeroLine({ rank: 2, total: 14, avg: 63.6 }), '第 2 名 / 14 人，全场平均 63.6 分'],
  ['S22', 'local', 'contest hero-beat 20 分 14/14', '击败 0% 考生', () => rankLine(14, 0), '还没超过其他考友（共 14 人）'],
  ['S23', 'local', 'contest hero-line 20 分', '第 14 名 / 14 人 · 全场平均 63.6 分', () => contestHeroLine({ rank: 14, total: 14, avg: 63.6 }), '第 14 名 / 14 人，全场平均 63.6 分'],
  ['S24', 'local', 'contest hero-beat 100 分 1/14', '击败 93% 考生', () => rankLine(14, 93), '超过 93% 的考友'],
  ['S25', 'local', 'contest hero-line 100 分', '第 1 名 / 14 人 · 全场平均 63.6 分', () => contestHeroLine({ rank: 1, total: 14, avg: 63.6 }), '第 1 名 / 14 人，全场平均 63.6 分'],
  ['S27', 'local', 'contest 无薄弱考点（全对）', WEAK_OLD, () => weakNote(...contestCorrectTotal({ modules: [{ correct: 6, n: 6 }, { correct: 4, n: 4 }] })), '全对，没有薄弱考点'],
  ['S28', 'local', 'weekly 模考行 无 rank', '全站模考大赛 测试期：击败 79%', () => weeklyMockLine({ event_title: '全站模考大赛 测试期', pct: 79, rank: null }), '全站模考大赛 测试期：超过 79% 的考友'],
  ['S29', 'local', 'weekly 模考行 有 rank', '全站模考大赛 测试期：第 2 名 · 击败 79%', () => weeklyMockLine({ event_title: '全站模考大赛 测试期', pct: 79, rank: 2 }), '全站模考大赛 测试期：第 2 名，超过 79% 的考友'],
  ['S30', 'prod', 'weekly empty desc（B 从未练习）', '2026-08-31 ~ 2026-09-06\n本周刷起来，下周一就能看到你的专属周报', () => weeklyEmptyDesc('2026-08-31 ~ 2026-09-06'), '2026-08-31 ~ 2026-09-06\n这周做过题，下周一这里就有周报'],
  ['S31', 'prod', 'weekly empty desc（A week=2026-08-03）', '2026-08-03 ~ 2026-08-09\n本周刷起来，下周一就能看到你的专属周报', () => weeklyEmptyDesc('2026-08-03 ~ 2026-08-09'), '2026-08-03 ~ 2026-08-09\n这周做过题，下周一这里就有周报'],
  ['S32', 'prod', 'weekly pending desc（A 本周）', '2026-09-07 ~ 2026-09-13\n周报会在下周一自动生成，先看看上一周的吧', () => weeklyPendingDesc('2026-09-07 ~ 2026-09-13'), '2026-09-07 ~ 2026-09-13\n周一再来看，先看上一周的'],
  ['S34', 'prod', 'qShareText 错题分享 variant b', '【言语理解】敢不敢挑战这道题？不少人都做错了，答完立刻看你击败了多少人：' + U + 'b', () => qShareCopy('言语理解', U + 'b', false), '【言语理解】这道题我做错了，你试试：' + U + 'b'],
  ['S35', 'prod', 'qShareText 做对分享 variant a', '【言语理解】我刚做了一道题，你能做对吗？答完就能看到大家选了啥：' + U + 'a', () => qShareCopy('言语理解', U + 'a', true), '【言语理解】这道题我做对了，你试试：' + U + 'a'],
  ['S36', 'prod', 'qShareText 无作答结果', '【言语理解】我刚做了一道题，你能做对吗？答完就能看到大家选了啥：' + U + 'a', () => qShareCopy('言语理解', U + 'a'), '【言语理解】我刚做了这道题，你试试，答完能看到大家选了什么：' + U + 'a'],
  ['S38', 'local', 'share-q beatText 15 人 答对', '🏆 你击败了全站 7% 的作答者（共 15 人做过这题）', () => shareBeatLine({ total: 15, acc: 93, beat_pct: 7 }, { correct: true }), '全站 15 人做过这题，你超过了其中 7%'],
  ['S39', 'local', 'share-q beatText 15 人 答错', '全站共 15 人做过这题，正确率 93%，再战同类题赢回来', () => shareBeatLine({ total: 15, acc: 93, beat_pct: 7 }, { correct: false }), '全站 15 人做过这题，正确率 93%'],
  ['S40', 'local', 'share-q beatText total=3', '🎯 全站第 3 个作答本题的人，把题发给更多考友一起比比', () => shareBeatLine({ total: 3, acc: 67, beat_pct: 33 }, { correct: true }), '全站 3 人做过这题，参与人数还少，先不比'],
  ['S41', 'prod', 'daily set participants=1', '今日全站同题 · 你是今天第 1 位完成者', () => dailySetLine({ participants: 1, beat_pct: null, my_right: 7 }), '今日全站同题，你是今天第 1 个完成的'],
  ['S43', 'local', 'daily set 13 人 beat 75', '今日全站同题 · 13 人完成 · 击败 75%', () => dailySetLine({ participants: 13, beat_pct: 75, my_right: 7 }), '今日全站同题，13 人完成，超过 75% 的考友'],
  ['S44', 'local', 'daily set 分享尾句', '，击败全站 75%', () => dailySetShareTail({ participants: 13, beat_pct: 75 }), '，超过 75% 的考友'],
  ['S45', 'local', 'daily set already', '今日全站同题成绩已记录（首次 7 对） · 13 人完成', () => dailySetLine({ already: true, participants: 13, beat_pct: 75, my_right: 7 }), '今日全站同题成绩已记录（首次 7 对），13 人完成'],
  ['S46', 'local', 'daily set already 分享尾句', '，击败全站 75%', () => dailySetShareTail({ already: true, participants: 13, beat_pct: 75 }), '，超过 75% 的考友'],
  ['S48', 'local', 'practice 百分位 77', '本组正确率击败了 77% 的刷题记录', () => percentileLine(77), '本组正确率超过 77% 的刷题记录'],
  ['S49', 'local', 'practice 百分位分享尾句', '，击败了 77% 的刷题记录', () => percentileShareTail(77), '，超过 77% 的刷题记录'],
  ['S51', 'prod', 'reviewDoneCopy 未清零 8/39', '本组 8 道复习完成 · 还有 39 道到期待复习', () => reviewDoneCopy(8, 39).line, '本组 8 道复习完成，还有 39 道到期'],
  ['S53', 'prod', 'reviewDoneCopy 清零 82', '82 道到期错题全部复习完成，遗忘曲线稳住了', () => reviewDoneCopy(82, 0).line, '82 道到期错题全部复习完成'],
  ['S54', 'prod', 'reviewVerdict 复习答错 next 1 天', '又错了，看讲解（稍后本轮会再出现）（下次复习：1 天后）', () => reviewVerdict({ wasCorrect: false, streak: 0, nextDays: 1 }), '又错了，看讲解，稍后本轮会再出现（下次复习：1 天后）'],
];

describe('W17-C1 生成型文案快照（台账 §2）', () => {
  it('样本量 ≥40 且每条改后 ≠ 现文', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40);
    for (const [id, , , before, , after] of CASES) expect(after, id).not.toBe(before);
  });
  for (const [id, src, where, before, fn, after] of CASES) {
    it(`${id} [${src}] ${where}`, () => {
      const out = fn();
      expect(out).toBe(after);
      expect(out).not.toBe(before);
      expect(out).not.toMatch(/击败|专属|刷起来|继续保持|遗忘曲线|不少人都做错了|专项强化|重做一遍/);
    });
  }
});

describe('W17-C1 保持不改的空串分支（S13/S15/S37/S42/S47）', () => {
  it('样本 <10 hero 不出比例句；分享/每日同题/百分位无数据为空', () => {
    expect(RANK_MIN_SAMPLE).toBe(10);
    expect(rankLine(1, 0)).toBe('参与人数还少（1 人）');
    expect(rankLine(0, null)).toBe('');
    expect(rankCardView(null).line).toBe('');
    expect(shareBeatLine({ total: 0 }, { correct: true })).toBe('');
    expect(shareBeatLine({ total: 15, acc: 93, beat_pct: 7 }, null)).toBe('');
    expect(dailySetShareTail({ participants: 1, beat_pct: null })).toBe('');
    expect(dailySetShareTail({ participants: 3, beat_pct: 50 })).toBe('');
    expect(dailySetLine({ participants: 3, beat_pct: 50, my_right: 5 })).toBe('今日全站同题，3 人完成，参与人数还少');
    expect(percentileLine(null)).toBe('');
    expect(percentileShareTail(undefined)).toBe('');
    expect(weeklyMockLine(null)).toBe('');
    expect(reviewDoneCopy(8, 39).cta).toBe('继续复习下一组（20 道）›');
  });
});

describe('W17-C1 小程序纯函数同文', () => {
  it('review-verdict.ts 与 review-summary.js 同句（标题保留小程序「！」）', () => {
    expect(mp.reviewDoneCopy(8, 39).line).toBe(reviewDoneCopy(8, 39).line);
    expect(mp.reviewDoneCopy(82, 0).line).toBe(reviewDoneCopy(82, 0).line);
    expect(mp.reviewVerdict({ wasCorrect: false, nextDays: 1 })).toBe('又错了，看解析，稍后本轮会再出现（下次复习：1 天后）');
  });
});

describe('W17-C1 源锁：H5 模板与小程序同源字符串', () => {
  const H5 = {
    report: read('../src/pkgA/exam/report.vue'),
    contest: read('../src/pkgA/exam/contest-report.vue'),
    weekly: read('../src/pkgA/stats/weekly-report.vue'),
    rank: read('../src/components/rank-card/rank-card.vue'),
    poster: read('../src/pkgA/social/poster.vue'),
    shareQ: read('../src/pkgA/share/share-q.vue'),
    api: readdirSync(fileURLToPath(new URL('../src/api/', import.meta.url))).filter((f)=>f.endsWith('.js')).sort().map((f)=>readFileSync(fileURLToPath(new URL('../src/api/'+f, import.meta.url)),'utf8')).join('\n'),
    book: read('../src/pages/book/book.vue'),
    practice: read('../src/pages/practice/practice.vue'),
  };
  const MP = {
    reportTs: read('../../miniapp-native/miniprogram/pkgExam/report/report.ts'),
    reportWxml: read('../../miniapp-native/miniprogram/pkgExam/report/report.wxml'),
    contestTs: read('../../miniapp-native/miniprogram/pkgExam/contest-report/contest-report.ts'),
    contestWxml: read('../../miniapp-native/miniprogram/pkgExam/contest-report/contest-report.wxml'),
    weeklyTs: read('../../miniapp-native/miniprogram/pkgGrow/weekly-report/weekly-report.ts'),
    weeklyWxml: read('../../miniapp-native/miniprogram/pkgGrow/weekly-report/weekly-report.wxml'),
    reminders: read('../../miniapp-native/miniprogram/pkgSocial/reminders/reminders.wxml'),
  };
  const ALL = { ...H5, ...MP };

  it('禁词在范围内文件 0 命中', () => {
    const banned = /去专项强化|专项突破|击败 .{0,6}考生|已击败|击败全站|你击败了|击败 \$\{|击败 \{\{|专属周报|遗忘曲线稳住|不少人都做错了|继续保持！|强化 5 道新题|重做一遍|守住连续打卡|保持手感再练一组/;
    for (const [k, src] of Object.entries(ALL)) expect(src, k).not.toMatch(banned);
  });

  it('H5 走 exam-copy 纯函数', () => {
    expect(H5.report).toContain('{{ heroLine }}');
    expect(H5.report).toContain('{{ weakNoteText }}');
    expect(H5.report).toContain('{{ redoDescText }}');
    expect(H5.report).toContain('去专项练习');
    expect(H5.report).toContain('练同考点');
    expect(H5.rank).toContain('{{ beatView.label }}');
    expect(H5.rank).toContain('{{ beatView.line }}');
    expect(H5.contest).toContain('{{ rankLine(r.total, r.pct) }}');
    expect(H5.contest).toContain('{{ contestHeroLine(r) }}');
    expect(H5.contest).toContain("label: '超过考友'");
    expect(H5.weekly).toContain('title="这一周没有练题记录"');
    expect(H5.weekly).toContain('title="这周还没过完"');
    expect(H5.weekly).toContain('weeklyMockLine(r.mock)');
    // 模板直接调用的纯函数必须挂到 methods（否则运行时 "t.xxx is not a function"，本地 dist 截图曾复现）
    expect(H5.weekly).toMatch(/methods: \{\s*weeklyMockLine,\s*weeklyEmptyDesc,\s*weeklyPendingDesc,/);
    expect(H5.contest).toMatch(/\n {4}rankLine,\n {4}contestHeroLine,\n/);
    expect(H5.practice).toMatch(/methods: \{\s*percentileLine,/);
    expect(H5.poster).toContain("'超过的考友'");
    expect(H5.shareQ).toContain('shareBeatLine(this.qStats, this.myResult)');
    expect(H5.api).toContain('return qShareCopy(mod, url, correct);');
    expect(H5.api).toContain('?v=${shareVariant()}');
    expect(H5.book).toContain('练同考点：5 道没做过的题 ›');
    expect(H5.book).toContain('重练待掌握的错题，一次最多 10 题');
    expect(H5.book).toContain("qShareText(mod, d.sid, false)");
    expect(H5.practice).toContain('{{ percentileLine(percentile) }}');
    expect(H5.practice).toContain('dailySetLine(d)');
    expect(H5.practice).toContain('dailySetShareTail(ds)');
    expect(H5.practice).toContain('percentileShareTail(this.percentile)');
  });

  it('小程序同文', () => {
    for (const ts of [MP.reportTs, MP.contestTs]) {
      expect(ts).toContain('return `参与人数还少（${total} 人）`;');
      expect(ts).toContain('return `还没超过其他考友（共 ${total} 人）`;');
      expect(ts).toContain('return `超过 ${pct}% 的考友`;');
      expect(ts).toContain("'全对，没有薄弱考点' : '本卷错题少，看不出薄弱考点'");
    }
    expect(MP.reportTs).toContain('return `答对 ${r.correct}/${r.total}${blank}，用时 ${usedTime}`;');
    expect(MP.reportTs).toContain('`答错 ${wrongTotal} 题，这轮先重练前 ${redoCount} 题` : `答错 ${wrongTotal} 题，按刷题模式重练一遍`');
    expect(MP.reportTs).toContain('参与人数还少（${rank.total} 人），暂不算比例');
    expect(MP.reportWxml).toContain('{{heroLine}}');
    expect(MP.reportWxml).toContain('<text class="r-beat-l">超过的考友</text>');
    expect(MP.reportWxml).toContain('{{rankCardLine}}');
    expect(MP.reportWxml).toContain('去专项练习');
    expect(MP.reportWxml).toContain('{{weakNote}}');
    expect(MP.reportWxml).toContain('{{redoDesc}}');
    expect(MP.reportWxml).toContain('练同考点');
    expect(MP.contestTs).toContain('heroLine: `第 ${r.rank} 名 / ${r.total} 人，全场平均 ${r.avg} 分`');
    expect(MP.contestTs).toContain("label: '超过考友'");
    expect(MP.contestWxml).toContain('{{heroBeat}}');
    expect(MP.contestWxml).toContain('{{weakNote}}');
    expect(MP.weeklyTs).toContain("'\\n这周做过题，下周一这里就有周报'");
    expect(MP.weeklyTs).toContain("'\\n周一再来看，先看上一周的'");
    expect(MP.weeklyTs).toContain('`第 ${d.mock.rank} 名，` : \'\') + `超过 ${d.mock.pct}% 的考友`');
    expect(MP.weeklyWxml).toContain('title="这一周没有练题记录"');
    expect(MP.weeklyWxml).toContain('title="这周还没过完"');
    expect(MP.reminders).toContain("'今日目标已完成' : '今天还差 ' + left + ' 题到目标'");
    expect(MP.reminders).toContain('今日目标 {{goal}} 题，已做 {{done}} 题');
  });
});
