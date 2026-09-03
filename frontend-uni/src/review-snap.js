// 复习会话本机快照（fail-closed 纯函数）：中断/刷新后可恢复本轮复习

const TTL_S = 2 * 3600;
const MAX_BYTES = 200 * 1024;
const MAX_ITEMS = 80;

function validItems(items) {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.length <= MAX_ITEMS &&
    items.every((x) => x && typeof x === 'object' && typeof x.question_text === 'string' && x.question_text)
  );
}

/** 复习内存态 → 可持久化快照；无有效条目/超大返回 null。 */
export function buildReviewSnap(state, uid, now) {
  if (!state || typeof state !== 'object' || !uid) return null;
  const items = (state.rItems || []).map((x) => {
    const { open, html, ...rest } = x || {};
    void open;
    void html;
    return rest;
  });
  if (!validItems(items)) return null;
  const rIdx = Number(state.rIdx);
  if (!Number.isInteger(rIdx) || rIdx < 0 || rIdx >= items.length) return null;
  const snap = {
    v: 1,
    uid: String(uid),
    ts: Math.floor(Number(now) || 0),
    rIdx,
    items,
    picked: typeof state.picked === 'string' ? state.picked : null,
    answered: state.answered === true,
    wasCorrect: state.wasCorrect === true,
    nextDays: Number(state.nextDays) || 0,
  };
  try {
    if (JSON.stringify(snap).length > MAX_BYTES) return null;
  } catch (e) {
    return null;
  }
  return snap;
}

/** storage 原始值 → 恢复态；uid 不符/过期/形状非法一律 null。 */
export function parseReviewSnap(raw, uid, now) {
  let s = raw;
  if (typeof s === 'string') {
    try {
      s = JSON.parse(s);
    } catch (e) {
      return null;
    }
  }
  if (!s || typeof s !== 'object' || s.v !== 1 || !uid || s.uid !== String(uid)) return null;
  const ts = Number(s.ts);
  const t = Math.floor(Number(now) || 0);
  if (!Number.isInteger(ts) || ts <= 0 || t - ts > TTL_S || ts > t + 60) return null;
  if (!validItems(s.items)) return null;
  const rIdx = Number(s.rIdx);
  if (!Number.isInteger(rIdx) || rIdx < 0 || rIdx >= s.items.length) return null;
  return {
    rIdx,
    items: s.items,
    picked: typeof s.picked === 'string' ? s.picked : null,
    answered: s.answered === true,
    wasCorrect: s.wasCorrect === true,
    nextDays: Number(s.nextDays) || 0,
  };
}
