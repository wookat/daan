export function countAnswered(items) {
  return (Array.isArray(items) ? items : []).filter((q) => q && q._picked).length;
}

// 一题未答时不往服务端写进度（进过页面就走不算一场模考；只打旗标不算作答，与服务端回收空场次的
// picks 口径一致）；写过一次后就一直同步，这样「全部取消作答」也会覆盖掉服务端旧进度。
export function shouldPushProgress(picks, pushedBefore) {
  if (pushedBefore) return true;
  return !!picks && Object.keys(picks).length > 0;
}

// 未交卷模考进度解析：exam.vue examProgress 快照 -> 卷库续考横幅数据（无效/过期/一题未答返回 null）
export function parseExamProgress(saved, now) {
  if (!saved || !saved.attemptId) return null;
  const items = Array.isArray(saved.items) ? saved.items : [];
  if (!items.length) return null;
  const endAt = Number(saved.endAt);
  if (!Number.isFinite(endAt) || endAt <= now) return null;
  const answered = countAnswered(items);
  if (!answered) return null;
  const mini = !!saved.mini;
  const title = (saved.paper && saved.paper.title) || (mini ? '迷你模考' : '真题模考');
  return {
    attemptId: Number(saved.attemptId) || 0,
    paperId: mini ? 0 : Number(saved.paperId) || 0,
    mini,
    title,
    answered,
    total: items.length,
    leftSecs: Math.floor((endAt - now) / 1000),
  };
}

export function fmtLeftSecs(s) {
  const v = Math.max(0, Number(s) || 0);
  return Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0');
}
