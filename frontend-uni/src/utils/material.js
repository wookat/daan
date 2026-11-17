/* 资料分析题面切分：材料 + 「问题：」小题干（镜像后端 db._material_key 语义）。
 * xt 导入格式为 `（材料 N）材料\n题干` 或无编号 `材料\n题干`，
 * 以 material_hash 存在/（材料前缀判定"含材料"，取最后一个换行符作材料|题干边界。 */

export function splitMaterial(text, hasMatHash) {
  let t = String(text || '');
  let pre = '';
  const mk = t.indexOf('【资料】');
  if (mk !== -1) {
    pre = t.slice(0, mk + 4);
    t = t.slice(mk + 4);
  }
  const m = t.match(/问题\s*[：:]/);
  if (m) {
    const material = t.slice(0, m.index);
    const stem = t.slice(m.index);
    const key = material.replace(/\s+/g, '');
    if (key.length < 120) return null;
    return { material: pre + material, stem, key: key.slice(0, 400) };
  }
  // xt 拼接格式：材料\n题干（题干多为单行问句，取末个换行为界）
  if (hasMatHash || /^[（(]材料/.test(t)) {
    const i = t.lastIndexOf('\n');
    if (i > 0) {
      const material = t.slice(0, i);
      const stem = t.slice(i + 1);
      const key = material.replace(/\s+/g, '');
      if (key.length >= 120 && stem.trim()) {
        return { material: pre + material, stem, key: key.slice(0, 400) };
      }
    }
  }
  return null;
}

export function sameMaterial(a, b, ha, hb) {
  if (ha && hb) return ha === hb;
  const sa = splitMaterial(a);
  const sb = splitMaterial(b);
  return !!(sa && sb && sa.key === sb.key);
}
