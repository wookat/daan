// R322：普通刷题「未完成练习」跨设备同步——上送收集与恢复归一纯函数。
// 语义：非法输入一律 fail-closed（收集返回 null 不上送、恢复返回 null 不采纳）。

export function collectPracticeProgress(items, idx, right, streak, bestStreak, module, submodule, source, ptitle, daily) {
  if (!Array.isArray(items) || !items.length || items.length > 100) return null;
  const qids = [];
  const picks = {};
  const excl = {};
  for (const q of items) {
    if (!q || !Number.isInteger(q.id) || q.id <= 0) return null;
    qids.push(q.id);
    if (['A','B','C','D'].includes(q._picked)) picks[q.id] = q._picked;
    if (Array.isArray(q._excl)) {
      const letters = q._excl.filter((x) => ['A','B','C','D'].includes(x));
      if (letters.length) excl[q.id] = letters.slice(0, 4);
    }
  }
  const n = qids.length;
  const clamp = (v, hi) => (Number.isInteger(v) && v >= 0 ? Math.min(v, hi) : 0);
  return {
    qids,
    picks,
    excl,
    idx: clamp(idx, n - 1),
    right: clamp(right, n),
    streak: clamp(streak, n),
    best_streak: clamp(bestStreak, 10000),
    module: typeof module === 'string' ? module.slice(0, 64) : '',
    submodule: typeof submodule === 'string' ? submodule.slice(0, 64) : '',
    source: typeof source === 'string' ? source.slice(0, 64) : '',
    ptitle: typeof ptitle === 'string' ? ptitle.slice(0, 80) : '',
    daily: dailyMeta(daily),
  };
}

// 续做落点：快照 idx 停在已作答题（答错看反馈时退出）则接着其后第一道未答题（其后没有再从头找），
// 未答题原地不动；首页「第 k/N 题」、恢复 toast 与落地题号共用此口径。已答题仍可从答题卡回看。
export function resumeIndex(items, idx, picked = (q) => !!(q && q._picked)) {
  const n = Array.isArray(items) ? items.length : 0;
  if (!n) return 0;
  const i = Number.isInteger(idx) && idx >= 0 ? Math.min(idx, n - 1) : 0;
  if (!picked(items[i])) return i;
  const after = items.findIndex((q, k) => k > i && !picked(q));
  if (after !== -1) return after;
  const any = items.findIndex((q) => !picked(q));
  return any !== -1 ? any : i;
}

// R323：首页续练卡数据——本机 pendingSession 快照 -> {done,total,module}（无效/超期/已做完返回 null）
export function parsePendingPractice(saved, now) {
  if (!saved || !Array.isArray(saved.items) || !saved.items.length) return null;
  const t = Number(saved.t);
  if (!Number.isFinite(t) || now - t > 24 * 3600 * 1000) return null;
  const done = saved.items.filter((q) => q && q._picked).length;
  if (done >= saved.items.length) return null;
  return {
    done,
    next: resumeIndex(saved.items, saved.idx) + 1,
    total: saved.items.length,
    module: typeof saved.lastModule === 'string' ? saved.lastModule : '',
    ptitle: typeof saved.ptitle === 'string' ? saved.ptitle : '',
    redo: isRedoPending(saved),
    daily: dailyFromPending(saved, now),
  };
}

// 每日一练场次的 pendingSession 以 daily:{date,past} 标记（无模块、无卷名）；恢复时据此还原打卡/全站成绩语义。
// 跨日后接着做昨天的题组按往期补练处理（不打今日卡、不提交全站成绩）
export function dailyFromPending(saved, now = Date.now()) {
  const d = dailyMeta(saved && saved.daily);
  if (!d) return null;
  return { date: d.date, past: d.past || d.date !== cnDayOf(now) };
}

// 场次标记原样归一（不按今天重算 past）：上送服务端 / 存本机快照用
export function dailyMeta(d) {
  if (!d || typeof d !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ''))) return null;
  return { date: d.date, past: !!d.past };
}

export function dailyPendingTitle(d) {
  if (!d) return '';
  return d.past ? '往期每日一练 · ' + d.date : '每日一练 · 今日全站同题';
}

export function cnDayOf(now) {
  return new Date(now + 8 * 3600e3).toISOString().slice(0, 10);
}

// 开每日一练前先看本机是否已有同一天的未做完题组（daily_set 按日固定，重开会从第 1 题覆盖进度）
export function dailyPendingFor(saved, day, now) {
  const p = parsePendingPractice(saved, now);
  if (!p || !p.daily || p.daily.date !== day) return null;
  return p;
}

// R548：错题重练场次的 pendingSession 以 redo=1 标记（无模块、无卷名，仅靠此位与普通练习区分）
export function isRedoPending(saved) {
  return !!saved && (saved.redo === 1 || saved.redo === true);
}

export const REDO_PENDING_TITLE = '错题重练';

// 续练卡/续练弹窗标题：按卷会话显卷名，错题重练显「错题重练」，普通练习为空（由调用方回落模块名）
export function pendingTitle(saved, now = Date.now()) {
  if (!saved) return '';
  if (typeof saved.ptitle === 'string' && saved.ptitle) return saved.ptitle;
  if (isRedoPending(saved)) return REDO_PENDING_TITLE;
  return dailyPendingTitle(dailyFromPending(saved, now));
}

// 练习页运行时挂在题目上的作答态字段；重练原题集须剥掉后才能作为「再来一组」的干净母本
const PRACTICE_RUNTIME_KEYS = ['_picked', '_secs', '_excl', '_logged', '_saved', '_mid', '_reason', '_reported'];

export function stripPracticeRuntime(q) {
  if (!q || typeof q !== 'object') return q;
  const out = { ...q };
  for (const k of PRACTICE_RUNTIME_KEYS) delete out[k];
  return out;
}

// 从 pendingSession 恢复错题重练母本（_redoItems）；非重练快照返回 null
export function redoItemsFromPending(saved) {
  if (!isRedoPending(saved) || !Array.isArray(saved.items) || !saved.items.length) return null;
  return saved.items.map(stripPracticeRuntime);
}

// 恢复的会话里「已答错但没有错题 id」的题：POST /api/mistakes 回包前就退出/刷新，快照没来得及带上 _mid
export function unlinkedWrongItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((q) => q && q._picked && q.answer && q._picked !== q.answer && !q._mid);
}

// 用本人错题本回填 _mid/_saved/_reason（题库题按 question_id，内联题按题干首行）；返回回填条数
export function relinkMistakeIds(items, mistakes) {
  const lost = unlinkedWrongItems(items);
  if (!lost.length || !Array.isArray(mistakes)) return 0;
  const byQid = new Map();
  const byText = new Map();
  for (const m of mistakes) {
    if (!m || !Number.isInteger(m.id) || m.id <= 0) continue;
    if (Number.isInteger(m.question_id) && m.question_id > 0 && !byQid.has(m.question_id)) byQid.set(m.question_id, m);
    const head = typeof m.question_text === 'string' ? m.question_text.split('\n')[0].trim() : '';
    if (head && !byText.has(head)) byText.set(head, m);
  }
  let n = 0;
  for (const q of lost) {
    const m = (!q._sz && Number.isInteger(q.id) && byQid.get(q.id)) || byText.get(String(q.question || '').split('\n')[0].trim()) || null;
    if (!m) continue;
    q._mid = m.id;
    q._saved = true;
    if (!q._reason && typeof m.error_reason === 'string' && m.error_reason) q._reason = m.error_reason;
    n++;
  }
  return n;
}

// 「退出并保留」后 POST 才回包：把 _mid/_saved 直接补进已存快照（找不到该题/快照已清则返回 null 不写）
export function patchPendingMistake(saved, q) {
  if (!saved || !Array.isArray(saved.items) || !q || !Number.isInteger(q._mid) || q._mid <= 0) return null;
  const i = saved.items.findIndex((it) => it && (it === q || (Number.isInteger(q.id) && it.id === q.id) || (q.question && it.question === q.question)));
  if (i < 0 || saved.items[i]._mid) return null;
  const items = saved.items.slice();
  items[i] = { ...items[i], _mid: q._mid, _saved: true };
  return { ...saved, items };
}

// R323：首页续练卡数据——/api/practice/resume 应答 -> {done,total,module}（无效/空/已做完返回 null）
// 服务端快照的场次身份：psource 'redo' → 错题重练；daily:{date,past} → 每日一练（与本机 pendingSession 同口径）
export function parseRemotePractice(d, now = Date.now()) {
  if (!d || !Array.isArray(d.items) || !d.items.length) return null;
  const picks = d.picks && typeof d.picks === 'object' ? d.picks : {};
  const picked = (q) => !!q && (picks[q.id] != null || picks[String(q.id)] != null);
  const done = d.items.filter(picked).length;
  if (done >= d.items.length) return null;
  return {
    done,
    next: resumeIndex(d.items, d.idx, picked) + 1,
    total: d.items.length,
    module: typeof d.module === 'string' ? d.module : '',
    ptitle: typeof d.ptitle === 'string' ? d.ptitle : '',
    redo: d.source === 'redo',
    daily: dailyFromPending(d, now),
  };
}

// 首页续练卡：远端应答若是 apiSnap 旧快照兜底（staleAt 非 0），卡面要如实标出快照时刻与网络态，不当实时进度陈述
export function markRemoteResume(r, snapAt, online) {
  if (!r) return null;
  return { ...r, snapAt: Number(snapAt) || 0, netOnline: typeof online === 'boolean' ? online : null };
}

export function adoptPracticeResume(d, now = Date.now()) {
  if (!d || !Array.isArray(d.items) || !d.items.length) return null;
  const picks = d.picks && typeof d.picks === 'object' ? d.picks : {};
  const excl = d.excl && typeof d.excl === 'object' ? d.excl : {};
  const items = d.items.map((q) => {
    const p = picks[q.id] != null ? picks[q.id] : picks[String(q.id)];
    const e = excl[q.id] != null ? excl[q.id] : excl[String(q.id)];
    const picked = ['A','B','C','D'].includes(p) ? p : '';
    const letters = Array.isArray(e)
      ? e.filter((x) => ['A','B','C','D'].includes(x)).slice(0, 4)
      : [];
    return { ...q, _picked: picked, _excl: letters, _logged: !!picked, _secs: 0 };
  });
  const n = items.length;
  const clamp = (v, hi) => (Number.isInteger(v) && v >= 0 ? Math.min(v, hi) : 0);
  return {
    items,
    idx: resumeIndex(items, d.idx),
    right: clamp(d.right, n),
    streak: clamp(d.streak, n),
    bestStreak: clamp(d.best_streak, 10000),
    module: typeof d.module === 'string' ? d.module : '',
    submodule: typeof d.submodule === 'string' ? d.submodule : '',
    source: typeof d.source === 'string' ? d.source : '',
    ptitle: typeof d.ptitle === 'string' ? d.ptitle : '',
    redoItems: d.source === 'redo' ? items.map(stripPracticeRuntime) : null,
    daily: dailyFromPending(d, now),
  };
}
