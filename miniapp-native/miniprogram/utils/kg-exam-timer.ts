// 模考计时器（全真模考 / 迷你模考共用）：倒计时 + 每题用时 + 低时预警
// 对齐 frontend-uni/src/exam-alert.js、exam-time.js、exam-excl.js 的纯函数口径

export interface TimeAlert {
  secs: number;
  label: string;
}

export const TIME_ALERTS: TimeAlert[] = [
  { secs: 300, label: '剩余 5 分钟' },
  { secs: 60, label: '剩余 1 分钟，时间到将自动交卷' },
];

/** tick 向下穿越预警节点时返回该节点，否则 null */
export function crossedTimeAlert(prevSecs: number, curSecs: number): TimeAlert | null {
  if (!Number.isFinite(prevSecs) || !Number.isFinite(curSecs)) return null;
  if (curSecs <= 0 || curSecs >= prevSecs) return null;
  for (const a of TIME_ALERTS) {
    if (prevSecs > a.secs && curSecs <= a.secs) return a;
  }
  return null;
}

/** 倒计时钟面：3725 → '62:05'，超过 100 分钟仍按分钟累计 */
export function fmtClock(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return (m < 10 ? '0' + m : String(m)) + ':' + (r < 10 ? '0' + r : String(r));
}

/** 秒数文案：45 → '45 秒'，80 → '1 分 20 秒'，120 → '2 分'；非正数返回 null */
export function fmtSecs(s: number | null | undefined): string | null {
  if (typeof s !== 'number' || !isFinite(s) || s <= 0) return null;
  const v = Math.round(s);
  if (v < 60) return v + ' 秒';
  const m = Math.floor(v / 60);
  const r = v % 60;
  return r ? m + ' 分 ' + r + ' 秒' : m + ' 分';
}

/** 全卷平均每题用时：仅统计 secs>0 的题，有效题 <3 返回 null */
export function paperAvgSecs(items: Array<{ secs?: number | null }>): number | null {
  const vals = items
    .map((it) => (it ? it.secs : null))
    .filter((s): s is number => typeof s === 'number' && isFinite(s) && s > 0);
  if (vals.length < 3) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// ---------- 排除干扰项 ----------

export function toggleExcl(excl: string[] | undefined, k: string, picked: string): { excl: string[]; picked: string } {
  const list = Array.isArray(excl) ? excl.filter((x) => typeof x === 'string') : [];
  if (!k) return { excl: list, picked };
  if (list.includes(k)) return { excl: list.filter((x) => x !== k), picked };
  return { excl: list.concat(k), picked: picked === k ? '' : picked };
}

export function pickWithExcl(excl: string[] | undefined, k: string): string[] {
  const list = Array.isArray(excl) ? excl.filter((x) => typeof x === 'string') : [];
  return list.filter((x) => x !== k);
}

// ---------- 计时器 ----------

export interface ExamTimerHandlers {
  /** 每秒回调：剩余秒数 + 是否穿越预警节点 */
  onTick: (leftSecs: number, alert: TimeAlert | null) => void;
  onEnd: () => void;
}

/** 倒计时：按 endAt（ms）每秒计算剩余，后台切回自动校正 */
export class ExamTimer {
  private timer: number | null = null;
  private endAt = 0;
  private prev = Infinity;

  start(endAt: number, h: ExamTimerHandlers): void {
    this.stop();
    this.endAt = endAt;
    this.prev = Infinity;
    const tick = (): void => {
      const left = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
      const alert = crossedTimeAlert(this.prev, left);
      this.prev = left;
      h.onTick(left, alert);
      if (left <= 0) {
        this.stop();
        h.onEnd();
      }
    };
    tick();
    this.timer = setInterval(tick, 1000) as unknown as number;
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get running(): boolean {
    return this.timer !== null;
  }
}

/** 每题用时：切题时 flush 把秒数加到上一题 */
export class QuestionTimer {
  private startedAt = 0;

  start(): void {
    this.startedAt = Date.now();
  }

  /** 返回自 start 以来的秒数并重置起点 */
  flush(): number {
    if (!this.startedAt) return 0;
    const s = Math.round((Date.now() - this.startedAt) / 1000);
    this.startedAt = Date.now();
    return s;
  }

  stop(): number {
    const s = this.flush();
    this.startedAt = 0;
    return s;
  }
}
