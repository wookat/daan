// 做卷交卷失败的重试决策纯函数：无 uni/window 依赖，exam.vue 委托调用；
// 单测见 tests/exam-policy.test.js。
import { trackRetryable } from './api-policy';

export const SUBMIT_MAX_AUTO_RETRIES = 5;

// 与埋点离线队列同口径：网络失败/超时/HTTP 5xx/429 限流可重试；其余 4xx 属确定性拒绝。
const retryable = trackRetryable;

// 交卷失败分流：
// - terminal：确定性错误（如「答题记录不存在」404）——会话已失效，重试永不成功；
// - manual：时间未到（用户可继续作答后手动重交）或自动重试已达上限；
// - retry：时间到 + 可重试错误——指数退避 5s→10s→20s→40s→60s（封顶），
//   防止到点自动交卷在失败时被秒级时钟无限触发（重试风暴）。
export function submitFailPlan({ message, timeUp, tries }) {
  if (!retryable(message)) return { action: 'terminal' };
  if (!timeUp || tries >= SUBMIT_MAX_AUTO_RETRIES) return { action: 'manual' };
  return { action: 'retry', delayMs: Math.min(5000 * 2 ** tries, 60000) };
}
