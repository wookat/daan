// SEO 题目页「做这道题」深链：/practice?qid=N[&tag3=…][&module=…]&source=seo_q
// 访客刚读的那道题放到第一题（领跑），其后接原题包（同考点/模块随机），去重。

export function leadQidOf(query) {
  const raw = query && query.qid;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// 落地页上直接点了某个选项（&pick=A）：只接单个大写字母，其余一律当没选
export function leadPickOf(query) {
  const raw = query && query.pick;
  return typeof raw === 'string' && /^[A-H]$/.test(raw) ? raw : null;
}

export function mergeLead(lead, items) {
  const list = Array.isArray(items) ? items : [];
  if (!lead || !lead.id || lead.disabled) return list;
  return [lead, ...list.filter((q) => q && q.id !== lead.id)];
}

// 第 1 题就是访客刚在搜索结果里读的那题——页面上要说出来，否则用户不知道 CTA 承诺兑现了。
// 有考点标签才能说「同考点」，否则后续只是同模块随机题，不能夸大。
export function leadHintText(tag3, total) {
  const rest = Math.max(0, (Number(total) || 0) - 1);
  const tail = rest ? `，之后 ${rest} 题${tag3 ? '同考点' : '同模块'}练习` : '';
  return `刚才那题在这里作答${tail}`;
}
