// 未交卷模考进度解析：exam.vue examProgress 快照 -> 卷库续考横幅数据（无效/过期返回 null）
export function parseExamProgress(saved, now) {
  if (!saved || !saved.attemptId) return null;
  const items = Array.isArray(saved.items) ? saved.items : [];
  if (!items.length) return null;
  const endAt = Number(saved.endAt);
  if (!Number.isFinite(endAt) || endAt <= now) return null;
  const mini = !!saved.mini;
  const title = (saved.paper && saved.paper.title) || (mini ? '迷你模考' : '真题模考');
  return {
    paperId: mini ? 0 : Number(saved.paperId) || 0,
    mini,
    title,
    answered: items.filter((q) => q && q._picked).length,
    total: items.length,
    leftSecs: Math.floor((endAt - now) / 1000),
  };
}

export function fmtLeftSecs(s) {
  const v = Math.max(0, Number(s) || 0);
  return Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0');
}
