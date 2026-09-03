// AI 问答会话与题库题目关联（qid 挂在会话 item 上，fail-closed）
export function askQid(v) {
  let n = 0;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d+$/.test(v.trim())) n = Number(v.trim());
  return Number.isInteger(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER ? n : 0;
}

function hasQid(items, q) {
  return Array.isArray(items) && items.some((it) => it && typeof it === 'object' && !Array.isArray(it) && askQid(it.qid) === q);
}

// 会话讲解条目回到题目本体的搜索深链（code_hit 直达 + ?qid 自动展开详情）
export function askViewUrl(qid) {
  const q = askQid(qid);
  return q ? '/pkgA/search/search?q=' + q + '&qid=' + q : null;
}

// 返回 {sid}：sid=0 表示命中进行中会话；无命中返回 null
export function findAskSid(sessions, curItems, qid) {
  const q = askQid(qid);
  if (!q) return null;
  if (hasQid(curItems, q)) return { sid: 0 };
  if (!Array.isArray(sessions)) return null;
  for (const s of sessions) {
    if (s && typeof s === 'object' && !Array.isArray(s) && hasQid(s.items, q)) {
      const sid = s.id;
      if (Number.isInteger(sid) && sid > 0) return { sid };
    }
  }
  return null;
}
