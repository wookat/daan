// 模考低时预警：按阈值表判断计时 tick 是否向下穿越提醒节点
export const TIME_ALERTS = [
  { secs: 300, label: '剩余 5 分钟' },
  { secs: 60, label: '剩余 1 分钟，时间到将自动交卷' },
];

export function crossedTimeAlert(prevSecs, curSecs) {
  if (!Number.isFinite(prevSecs) || !Number.isFinite(curSecs)) return null;
  if (curSecs <= 0 || curSecs >= prevSecs) return null;
  for (const a of TIME_ALERTS) {
    if (prevSecs > a.secs && curSecs <= a.secs) return a;
  }
  return null;
}
