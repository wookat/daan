/* 资料分析题面切分：材料 + 「问题：」小题干（镜像后端 db._material_key 语义）。 */

export function splitMaterial(text) {
  let t = String(text || '');
  let pre = '';
  const mk = t.indexOf('【资料】');
  if (mk !== -1) {
    pre = t.slice(0, mk + 4);
    t = t.slice(mk + 4);
  }
  const m = t.match(/问题\s*[：:]/);
  if (!m) return null;
  const material = t.slice(0, m.index);
  const stem = t.slice(m.index);
  const key = material.replace(/\s+/g, '');
  if (key.length < 120) return null;
  return { material: pre + material, stem, key: key.slice(0, 400) };
}

export function sameMaterial(a, b) {
  const sa = splitMaterial(a);
  const sb = splitMaterial(b);
  return !!(sa && sb && sa.key === sb.key);
}
