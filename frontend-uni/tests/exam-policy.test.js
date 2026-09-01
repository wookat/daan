import { describe, it, expect } from 'vitest';
import { submitFailPlan, SUBMIT_MAX_AUTO_RETRIES } from '../src/exam-policy.js';

describe('submitFailPlan', () => {
  it('确定性业务错误终止（会话失效重试永不成功）', () => {
    expect(submitFailPlan({ message: '答题记录不存在', timeUp: true, tries: 0 })).toEqual({ action: 'terminal' });
    expect(submitFailPlan({ message: 'HTTP 404', timeUp: true, tries: 0 })).toEqual({ action: 'terminal' });
    expect(submitFailPlan({ message: '该次模考已交卷', timeUp: false, tries: 0 })).toEqual({ action: 'terminal' });
  });

  it('时间未到的网络失败回到可手动重交状态', () => {
    expect(submitFailPlan({ message: 'request:fail timeout', timeUp: false, tries: 0 })).toEqual({ action: 'manual' });
    expect(submitFailPlan({ message: 'HTTP 502', timeUp: false, tries: 2 })).toEqual({ action: 'manual' });
  });

  it('时间到 + 可重试错误按指数退避自动重试（5s 起步 60s 封顶）', () => {
    expect(submitFailPlan({ message: '网络错误', timeUp: true, tries: 0 })).toEqual({ action: 'retry', delayMs: 5000 });
    expect(submitFailPlan({ message: 'HTTP 503', timeUp: true, tries: 1 })).toEqual({ action: 'retry', delayMs: 10000 });
    expect(submitFailPlan({ message: 'request:fail', timeUp: true, tries: 3 })).toEqual({ action: 'retry', delayMs: 40000 });
    expect(submitFailPlan({ message: 'request:fail', timeUp: true, tries: 4 })).toEqual({ action: 'retry', delayMs: 60000 });
  });

  it('自动重试达上限后停止，转手动重交', () => {
    expect(submitFailPlan({ message: '网络错误', timeUp: true, tries: SUBMIT_MAX_AUTO_RETRIES })).toEqual({ action: 'manual' });
  });
});
