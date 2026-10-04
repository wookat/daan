// 模考成绩报告 → 「邀考友挑战本卷」分享文案（真题卷 SSR 页作抗截断落点）
export function buildExamReportShareText(report, origin) {
  const paper = report && report.paper;
  if (!paper || paper.kind !== 'zhenti' || !paper.id || !paper.title) return '';
  const correct = Number(report.correct) || 0;
  const total = Number(report.total) || 0;
  const base = origin || '';
  return `我在岸上见模考《${paper.title}》答对 ${correct}/${total} 题，敢来挑战吗？同卷在线模考：${base}/tiku/papers/${paper.id}`;
}
