// 错题本归卷：按卷分组错题（服务端 m.paper={pid,title,psource}），fail-closed 纯函数
export const PAPER_GROUP_MAX = 8;

export function mistakePaper(m) {
  const p = m && m.paper;
  if (!p || !Number.isInteger(p.pid) || p.pid <= 0) return null;
  if (typeof p.psource !== 'string' || !p.psource.trim()) return null;
  return { pid: p.pid, psource: p.psource.trim(), title: typeof p.title === 'string' ? p.title : '' };
}

// 各卷错题数，按数量降序（同数按 pid 降序=更新的卷靠前），最多 PAPER_GROUP_MAX 张
export function paperGroups(items, max = PAPER_GROUP_MAX) {
  if (!Array.isArray(items)) return [];
  const map = new Map();
  for (const m of items) {
    const p = mistakePaper(m);
    if (!p) continue;
    const g = map.get(p.pid);
    if (g) g.n++;
    else map.set(p.pid, { ...p, n: 1 });
  }
  return [...map.values()].sort((a, b) => b.n - a.n || b.pid - a.pid).slice(0, max);
}

export function inPaper(m, pid) {
  const p = mistakePaper(m);
  return !!p && p.pid === pid;
}
