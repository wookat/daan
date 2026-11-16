// 卷卡模块构成外显：服务端 mods {changshi: n, ...} → 「常识 31 · 言语 24 · 数量 5 · 判断 21 · 缺资料」
// fail-closed：非对象 / 无任何正整数计数 → ''；缺项只在至少有一个模块有题时列出（回忆版卷如实标缺）
const MODS = [
  ['changshi', '常识'],
  ['yanyu', '言语'],
  ['shuliang', '数量'],
  ['panduan', '判断'],
  ['ziliao', '资料'],
];

export function paperModsText(mods) {
  if (!mods || typeof mods !== 'object') return '';
  const have = [];
  const miss = [];
  for (const [key, name] of MODS) {
    const n = mods[key];
    if (Number.isInteger(n) && n > 0) have.push(`${name} ${n}`);
    else miss.push(name);
  }
  if (!have.length) return '';
  return have.join(' · ') + (miss.length ? ` · 缺${miss.join('/')}` : '');
}
