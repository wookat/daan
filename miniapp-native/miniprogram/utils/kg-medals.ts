// 成就勋章（8 枚，本机 + 服务端口径混合）：与 H5 stats.vue 勋章规则一致，供「我的」页展示
export interface Medal {
  icon: string;
  name: string;
  got: boolean;
  progress: string;
  pct: number;
}

export interface MedalInput {
  totalDone: number;
  streak: number;
  bestStreak: number;
  mastered: number;
}

function medal(icon: string, name: string, cur: number, target: number, unit: string): Medal {
  const got = cur >= target;
  const pct = got ? 100 : Math.min(100, Math.round((cur / target) * 100));
  return { icon, name, got, progress: got ? '已达成' : cur + '/' + target + ' ' + unit, pct };
}

export function buildMedals(i: MedalInput): Medal[] {
  return [
    medal('sprout', '初战告捷', i.totalDone, 10, '题'),
    medal('dumbbell', '小有所成', i.totalDone, 100, '题'),
    medal('trophy', '刷题大师', i.totalDone, 500, '题'),
    medal('flame', '三日不辍', i.streak, 3, '天'),
    medal('zap', '七日连环', i.streak, 7, '天'),
    medal('target', '十连对', i.bestStreak, 10, '连对'),
    medal('swords', '斩题十道', i.mastered, 10, '道'),
    medal('crown', '百题斩', i.mastered, 100, '道'),
  ];
}
