// SEO 题目页「做这道题」深链：/practice?qid=N[&tag3=…][&module=…]&source=seo_q
// 访客刚读的那道题放到第一题（领跑），其后接原题包（同考点/模块随机），去重。

export function leadQidOf(query) {
  const raw = query && query.qid;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function mergeLead(lead, items) {
  const list = Array.isArray(items) ? items : [];
  if (!lead || !lead.id || lead.disabled) return list;
  return [lead, ...list.filter((q) => q && q.id !== lead.id)];
}
