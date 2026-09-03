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
