// 模考同卷排行榜展示行：纯函数，便于测试。
// rank 为 /api/exam/rank/{attempt_id} 响应；board 缺失或样本 <2 返回 null 不渲染。
function num(v) {
  return v == null || v === '' ? NaN : Number(v);
}

export function examBoardRows(rank) {
  if (!rank || !Array.isArray(rank.board)) return null;
  const rows = rank.board
    .filter((r) => r && Number.isFinite(num(r.score)))
    .map((r) => ({
      rank: Number(r.rank) || 0,
      name: String(r.name || ''),
      score: num(r.score),
      me: !!r.me
    }));
  if (rows.length < 2) return null;
  const inTop = rows.some((r) => r.me);
  if (!inTop && num(rank.rank) > 0 && Number.isFinite(num(rank.score))) {
    rows.push({ rank: Number(rank.rank), name: '我', score: num(rank.score), me: true });
  }
  return rows;
}
