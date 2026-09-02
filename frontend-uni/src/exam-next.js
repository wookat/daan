// 报告页「继续模考」下一卷推荐：从卷库挑一张本人未考过的卷，fail-closed。
function posInt(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

export function nextPaper(papers, attempts, cur) {
  if (!Array.isArray(papers) || !cur || !posInt(cur.id)) return null;
  const done = new Set([cur.id]);
  if (Array.isArray(attempts)) {
    for (const a of attempts) {
      if (a && posInt(a.paper_id)) done.add(a.paper_id);
    }
  }
  const rows = papers.filter(
    (p) => p && posInt(p.id) && typeof p.title === 'string' && p.title.trim() && !done.has(p.id)
  );
  if (!rows.length) return null;
  const yearOf = (p) => (posInt(p.year) ? p.year : 0);
  const takersOf = (p) => (typeof p.takers === 'number' && Number.isFinite(p.takers) && p.takers > 0 ? p.takers : 0);
  const sameRegion = (p) => (cur.region && p.region === cur.region ? 1 : 0);
  const best = rows.slice().sort(
    (a, b) =>
      sameRegion(b) - sameRegion(a) ||
      yearOf(b) - yearOf(a) ||
      takersOf(b) - takersOf(a) ||
      b.id - a.id
  )[0];
  return {
    id: best.id,
    title: best.title.trim(),
    year: posInt(best.year) ? best.year : null,
    region: best.region || '',
    takers: takersOf(best),
    avgScore:
      typeof best.avg_score === 'number' && Number.isFinite(best.avg_score) ? best.avg_score : null,
  };
}
