/**
 * 相对排名 / 成绩报告 / 每日同题 / 分享的生成型文案（纯函数，H5 各页共用，小程序同文）。
 * 口径：样本 <RANK_MIN_SAMPLE 只说「参与人数还少」，不算比例；比例一律写「超过 P% 的考友」。
 */
export const RANK_MIN_SAMPLE = 10;

export function rankLine(total, pct) {
  const n = Number(total) || 0;
  if (n <= 0) return '';
  if (n < RANK_MIN_SAMPLE || pct == null) return `参与人数还少（${n} 人）`;
  if (pct <= 0) return `还没超过其他考友（共 ${n} 人）`;
  return `超过 ${pct}% 的考友`;
}

/** rank-card 头部：大字比例 + 小字标签；样本不足或比例为 0 时只给一句话 */
export function rankCardView(data) {
  const n = Number(data && data.total) || 0;
  const pct = data ? data.beaten_pct : null;
  if (n >= RANK_MIN_SAMPLE && pct > 0) return { pct, label: '超过的考友', line: '' };
  if (n > 0 && n < RANK_MIN_SAMPLE) return { pct: null, label: '', line: `参与人数还少（${n} 人），暂不算比例` };
  return { pct: null, label: '', line: rankLine(n, pct) };
}

export function reportHeroLine(report, usedTime) {
  const total = Number(report.total) || 0;
  const answered = report.answered == null ? total : Number(report.answered);
  const blank = answered < total ? `，${total - answered} 题未答` : '';
  return `答对 ${report.correct}/${total}${blank}，用时 ${usedTime}`;
}

/** weak_tags 为空时的结论句；correct/total 为本卷题数口径 */
export function weakNote(correct, total) {
  const t = Number(total) || 0;
  return t > 0 && Number(correct) >= t ? '全对，没有薄弱考点' : '本卷错题少，看不出薄弱考点';
}

/** 大赛报告没有 correct/total，按 modules 求和 */
export function contestCorrectTotal(r) {
  const mods = (r && r.modules) || [];
  return mods.reduce(
    (acc, m) => [acc[0] + (Number(m.correct) || 0), acc[1] + (Number(m.n) || 0)],
    [0, 0]
  );
}

export function redoDesc(wrongTotal, redoCount) {
  const w = Number(wrongTotal) || 0;
  const n = Number(redoCount) || 0;
  return w > n ? `答错 ${w} 题，这轮先重练前 ${n} 题` : `答错 ${w} 题，按刷题模式重练一遍`;
}

export function contestHeroLine(r) {
  return `第 ${r.rank} 名 / ${r.total} 人，全场平均 ${r.avg} 分`;
}

export function weeklyMockLine(mock) {
  if (!mock || !mock.event_title) return '';
  return mock.event_title + '：' + (mock.rank ? `第 ${mock.rank} 名，` : '') + `超过 ${mock.pct}% 的考友`;
}

export function weeklyEmptyDesc(range) {
  return (range || '') + '\n这周做过题，下周一这里就有周报';
}

export function weeklyPendingDesc(range) {
  return (range || '') + '\n周一再来看，先看上一周的';
}

export function shareBeatLine(stats, myResult) {
  const s = stats;
  if (!s || !s.total || !myResult) return '';
  if (s.total < RANK_MIN_SAMPLE) return `全站 ${s.total} 人做过这题，参与人数还少，先不比`;
  if (myResult.correct && s.beat_pct != null) return `全站 ${s.total} 人做过这题，你超过了其中 ${s.beat_pct}%`;
  if (s.acc != null) return `全站 ${s.total} 人做过这题，正确率 ${s.acc}%`;
  return '';
}

export function qShareCopy(mod, url, correct) {
  if (correct === true) return `【${mod}】这道题我做对了，你试试：${url}`;
  if (correct === false) return `【${mod}】这道题我做错了，你试试：${url}`;
  return `【${mod}】我刚做了这道题，你试试，答完能看到大家选了什么：${url}`;
}

export function dailySetLine(d) {
  if (!d) return '';
  if (d.already) return `今日全站同题成绩已记录（首次 ${d.my_right} 对），${d.participants} 人完成`;
  if (d.beat_pct == null) return '今日全站同题，你是今天第 1 个完成的';
  if (d.participants < RANK_MIN_SAMPLE) return `今日全站同题，${d.participants} 人完成，参与人数还少`;
  return `今日全站同题，${d.participants} 人完成，超过 ${d.beat_pct}% 的考友`;
}

export function dailySetShareTail(d) {
  if (!d || d.beat_pct == null || !(d.participants >= RANK_MIN_SAMPLE)) return '';
  return `，超过 ${d.beat_pct}% 的考友`;
}

export function percentileLine(percentile) {
  return percentile == null ? '' : `本组正确率超过 ${percentile}% 的刷题记录`;
}

export function percentileShareTail(percentile) {
  return percentile == null ? '' : `，超过 ${percentile}% 的刷题记录`;
}
