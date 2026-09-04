// utils/offline.ts 单测：mock wx storage/request，验证去重、持久化、单飞、失败保留、成功出队。
// 运行：cd frontend-uni && npx vitest run --dir ../miniapp-native/scripts
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Req = { url: string; data: { uid?: string; items?: unknown[] } };
const store = new Map<string, unknown>();
const reqs: Req[] = [];
let netHandler: ((r: { isConnected: boolean }) => void) | null = null;
let online = true;
let resolvers: (() => void)[] = [];

(globalThis as Record<string, unknown>).wx = {
  getStorageSync: (k: string) => (store.has(k) ? store.get(k) : ''),
  setStorageSync: (k: string, v: unknown) => store.set(k, v),
  removeStorageSync: (k: string) => store.delete(k),
  showToast: () => undefined,
  showModal: () => undefined,
  onNetworkStatusChange: (cb: (r: { isConnected: boolean }) => void) => {
    netHandler = cb;
  },
  request: (o: Req & { success: (r: { statusCode: number; data: unknown }) => void; fail: (e: { errMsg: string }) => void }) => {
    reqs.push({ url: o.url, data: o.data });
    if (!online) return o.fail({ errMsg: 'request:fail' });
    resolvers.push(() => o.success({ statusCode: 200, data: { ok: true } }));
  },
};

const mod = await import('../miniprogram/utils/offline');
const { enqueueAnswers, enqueueMistake, flushOfflineQueue, pendingCount, watchNetwork } = mod;

const item = (qid: number) => ({ qid, module: 'yanyu', submodule: null, correct: true, secs: 3, picked: 'A', source: null });
const flushAll = () => {
  resolvers.splice(0).forEach((r) => r());
};
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  store.clear();
  reqs.length = 0;
  resolvers = [];
  online = true;
  netHandler = null;
});

describe('offline queue', () => {
  it('enqueueAnswers 持久化到 wx storage，并按 uid|qid|t 去重', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    enqueueAnswers('test-w2-a', [item(1), item(2)]);
    enqueueAnswers('test-w2-a', [item(1)]); // 同 uid|qid|t（时间未推进）→ 丢弃
    const q = store.get('offlineQueue') as { answers: { key: string }[] };
    expect(q.answers.map((a) => a.key)).toEqual(['test-w2-a|1|1000', 'test-w2-a|2|1001']);
    vi.setSystemTime(2000);
    enqueueAnswers('test-w2-a', [item(1)]); // 不同 t → 视为新作答
    expect(pendingCount()).toBe(3);
    vi.useRealTimers();
  });

  it('enqueueMistake 按 uid|question_id 去重', () => {
    const m = { uid: 'test-w2-b', question_id: 7, module: 'yanyu', question_text: 'Q', user_answer: 'A', correct_answer: 'B' };
    enqueueMistake(m);
    enqueueMistake({ ...m, user_answer: 'C' });
    expect(pendingCount()).toBe(1);
  });

  it('flush 按 uid 分组上传 answer_log，成功后出队；mistakes 逐条', async () => {
    enqueueAnswers('test-w2-a', [item(1), item(2)]);
    enqueueAnswers('test-w2-b', [item(3)]);
    enqueueMistake({ uid: 'test-w2-a', question_id: 1, module: 'yanyu', question_text: 'Q', user_answer: 'A', correct_answer: 'B' });
    const p = flushOfflineQueue();
    for (let i = 0; i < 4; i++) {
      flushAll();
      await tick();
    }
    await p;
    const logs = reqs.filter((r) => r.url.endsWith('/api/answer_log'));
    expect(logs.map((r) => [r.data.uid, r.data.items!.length])).toEqual([
      ['test-w2-a', 2],
      ['test-w2-b', 1],
    ]);
    expect(reqs.filter((r) => r.url.endsWith('/api/mistakes')).length).toBe(1);
    expect(pendingCount()).toBe(0);
  });

  it('flush 失败保留队列，不丢数据', async () => {
    online = false;
    enqueueAnswers('test-w2-a', [item(1)]);
    await flushOfflineQueue();
    expect(pendingCount()).toBe(1);
    expect(reqs.length).toBe(1);
  });

  it('flush 单飞：并发调用只发一次请求', async () => {
    enqueueAnswers('test-w2-a', [item(1)]);
    const p1 = flushOfflineQueue();
    const p2 = flushOfflineQueue();
    await tick();
    expect(reqs.length).toBe(1);
    flushAll();
    await Promise.all([p1, p2]);
    expect(pendingCount()).toBe(0);
  });

  it('空队列不发请求', async () => {
    await flushOfflineQueue();
    expect(reqs.length).toBe(0);
  });

  it('watchNetwork 恢复联网时触发 flush', async () => {
    watchNetwork();
    enqueueAnswers('test-w2-a', [item(1)]);
    netHandler!({ isConnected: true });
    await tick();
    expect(reqs.length).toBe(1);
  });
});
