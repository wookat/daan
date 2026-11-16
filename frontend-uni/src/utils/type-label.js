// 细分题型名口径与后端 db.norm_qtype 一致：只去「模块名-」前缀（模块归属由 module 字段承担），
// 「法律-个税」这类细分名自带的「-」不再被切——错题本筛选值 / redo qtype 须与库内 question_type 逐字相等。
const QTYPE_MOD_PREFIXES = ['资料分析', '数量关系', '言语理解', '判断推理', '常识判断', '常识', '时政'];

export function qtypeName(qt) {
  const t = typeof qt === 'string' ? qt.trim() : '';
  const i = t.indexOf('-');
  if (i < 0) return t;
  const head = t.slice(0, i);
  const rest = t.slice(i + 1).trim();
  return QTYPE_MOD_PREFIXES.includes(head) && rest ? rest : t;
}

// 错题卡「题型组 + 细分题型」双标签的细分展示文案：细分名以「组名 + 分隔符」开头时去掉组名
// （「法律」+「法律-个税」、「逻辑判断」+「逻辑判断(加强削弱)」并列重复）。仅改展示，筛选值 / redo qtype 仍用完整细分名。
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
