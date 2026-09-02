// 模考成绩海报数据：纯函数（真实 report/rank 数据，缺数据返回 null 不渲染不伪造）
const SITE_URL = 'https://kaogong.zalize.com';

export function examPosterData(report, rank) {
  const score = report && report.attempt ? report.attempt.score : null;
  if (score == null || !Number.isFinite(Number(score))) return null;
  const total = Number(report.total) || 0;
  if (total <= 0) return null;
  const paper = report.paper || {};
  const kind = paper.kind || '';
  const paperId = Number(paper.id) || 0;
  let beatenPct = null;
  if (rank && Number(rank.total) >= 10 && Number.isFinite(Number(rank.beaten_pct))) {
    beatenPct = Math.round(Number(rank.beaten_pct));
  }
  return {
    title: paper.title || '模拟考试',
    score: Math.round(Number(score) * 10) / 10,
    correct: Number(report.correct) || 0,
    total,
    beatenPct,
    kind,
    paperId,
    qrUrl: kind === 'zhenti' && paperId > 0 ? `${SITE_URL}/tiku/papers/${paperId}` : SITE_URL
  };
}
