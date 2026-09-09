// 错题卡「题型组 + 细分题型」双标签的细分展示文案：细分名以「组名 + 分隔符」开头时去掉组名
// （来源站题型如「常识-法律-个税」经 tagName 只去首段成「法律-个税」，与组标签「法律」并列重复；
// 「逻辑判断(加强削弱)」同理）。仅改展示，筛选值 / redo qtype 仍用完整细分名。
// 无分隔符的前缀（「政治常识」「增长率比较」）不切，切掉会失义。
const SEPS = '-·/:：(（';

export function fineTypeLabel(group, fine) {
  const g = typeof group === 'string' ? group.trim() : '';
  const f = typeof fine === 'string' ? fine.trim() : '';
  if (!g || !f || f === g) return f;
  if (!f.startsWith(g) || f.length <= g.length) return f;
  const sep = f[g.length];
  if (!SEPS.includes(sep)) return f;
  let rest = f.slice(g.length + 1).trim();
  if ((sep === '(' && rest.endsWith(')')) || (sep === '（' && rest.endsWith('）'))) rest = rest.slice(0, -1).trim();
  return rest || f;
}
