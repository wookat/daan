// AI 问答历史会话跨设备同步（R328）：本机 askSessions 与服务端列表合并的纯函数。
// fail-closed：非法输入按空数组处理；条目必须含正整数 id/ts 且 items 为非空数组。

function valid(s) {
  return (
    s &&
    typeof s === 'object' &&
    typeof s.id === 'number' &&
    Number.isInteger(s.id) &&
    s.id > 0 &&
    typeof s.ts === 'number' &&
    Number.isInteger(s.ts) &&
    s.ts > 0 &&
    Array.isArray(s.items) &&
    s.items.length > 0
  );
}

// 按 id 去重并集（本机优先，本机是最近交互过的副本），ts 降序，上限 20 条
export function mergeAskSessions(local, remote) {
  const loc = Array.isArray(local) ? local.filter(valid) : [];
  const rem = Array.isArray(remote) ? remote.filter(valid) : [];
  const seen = new Set(loc.map((s) => s.id));
  const merged = [...loc];
  for (const s of rem) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      merged.push(s);
    }
  }
  merged.sort((a, b) => b.ts - a.ts || b.id - a.id);
  return merged.slice(0, 20);
}

// 归档写入本机列表（R329）：同 id 去重后置顶，上限 20 条；非法 sess 原样返回副本
export function upsertLocalSession(sessions, sess) {
  const list = Array.isArray(sessions) ? sessions.filter(valid) : [];
  if (!valid(sess)) return list;
  return [sess, ...list.filter((s) => s.id !== sess.id)].slice(0, 20);
}

// 删除墓碑（R330）：{sid: deletedAtMs}，防止服务端 DELETE 失败后 sync 把已删会话并回本机。

const TOMB_TTL = 7 * 24 * 3600 * 1000;
const TOMB_CAP = 40;

function validSid(sid) {
  return typeof sid === 'number' && Number.isInteger(sid) && sid > 0;
}

function normTombs(tombs) {
  const out = {};
  if (!tombs || typeof tombs !== 'object' || Array.isArray(tombs)) return out;
  for (const k of Object.keys(tombs)) {
    const sid = Number(k);
    const at = tombs[k];
    if (validSid(sid) && typeof at === 'number' && Number.isFinite(at) && at > 0) out[sid] = at;
  }
  return out;
}

// 记墓碑：非法 sid 返回规范化副本；超上限剔除最旧
export function addTombstone(tombs, sid, now) {
  const out = normTombs(tombs);
  if (!validSid(sid)) return out;
  out[sid] = typeof now === 'number' && now > 0 ? now : Date.now();
  const keys = Object.keys(out);
  if (keys.length > TOMB_CAP) {
    keys
      .sort((a, b) => out[a] - out[b])
      .slice(0, keys.length - TOMB_CAP)
      .forEach((k) => delete out[k]);
  }
  return out;
}

export function removeTombstone(tombs, sid) {
  const out = normTombs(tombs);
  delete out[Number(sid)];
  return out;
}

// TTL 过期清理：7 天未能送达的墓碑放弃（避免永久膨胀）
export function pruneTombstones(tombs, now) {
  const out = normTombs(tombs);
  const t = typeof now === 'number' && now > 0 ? now : Date.now();
  for (const k of Object.keys(out)) {
    if (t - out[k] > TOMB_TTL) delete out[k];
  }
  return out;
}

// merge 前过滤远端已删条目
export function filterTombstoned(sessions, tombs) {
  const list = Array.isArray(sessions) ? sessions.filter(valid) : [];
  const tb = normTombs(tombs);
  return list.filter((s) => !(s.id in tb));
}
