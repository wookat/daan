// R322：普通刷题「未完成练习」跨设备同步——上送收集与恢复归一纯函数。
// 语义：非法输入一律 fail-closed（收集返回 null 不上送、恢复返回 null 不采纳）。

export function collectPracticeProgress(items, idx, right, streak, bestStreak, module, submodule, source, ptitle) {
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
  };
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
    total: saved.items.length,
    module: typeof saved.lastModule === 'string' ? saved.lastModule : '',
    ptitle: typeof saved.ptitle === 'string' ? saved.ptitle : '',
    redo: isRedoPending(saved),
  };
}

// R548：错题重练场次的 pendingSession 以 redo=1 标记（无模块、无卷名，仅靠此位与普通练习区分）
export function isRedoPending(saved) {
  return !!saved && (saved.redo === 1 || saved.redo === true);
}

export const REDO_PENDING_TITLE = '错题重练';

// 续练卡/续练弹窗标题：按卷会话显卷名，错题重练显「错题重练」，普通练习为空（由调用方回落模块名）
export function pendingTitle(saved) {
  if (!saved) return '';
  if (typeof saved.ptitle === 'string' && saved.ptitle) return saved.ptitle;
  return isRedoPending(saved) ? REDO_PENDING_TITLE : '';
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

// R323：首页续练卡数据——/api/practice/resume 应答 -> {done,total,module}（无效/空/已做完返回 null）
export function parseRemotePractice(d) {
  if (!d || !Array.isArray(d.items) || !d.items.length) return null;
  const picks = d.picks && typeof d.picks === 'object' ? d.picks : {};
  const done = d.items.filter(
    (q) => q && (picks[q.id] != null || picks[String(q.id)] != null)
  ).length;
  if (done >= d.items.length) return null;
  return {
    done,
    total: d.items.length,
    module: typeof d.module === 'string' ? d.module : '',
    ptitle: typeof d.ptitle === 'string' ? d.ptitle : '',
  };
}

export function adoptPracticeResume(d) {
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
    idx: clamp(d.idx, n - 1),
    right: clamp(d.right, n),
    streak: clamp(d.streak, n),
    bestStreak: clamp(d.best_streak, 10000),
    module: typeof d.module === 'string' ? d.module : '',
    submodule: typeof d.submodule === 'string' ? d.submodule : '',
    source: typeof d.source === 'string' ? d.source : '',
    ptitle: typeof d.ptitle === 'string' ? d.ptitle : '',
  };
}
