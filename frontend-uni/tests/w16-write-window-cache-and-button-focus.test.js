import { describe, it, expect, vi } from 'vitest';
import { createGetCache } from '../src/api-get-cache.js';
import { HOST_RE } from '../src/a11y-focus.js';

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const U = 'test-w16-a';
const K = '/api/home_bundle?uid=' + U;

// 生产复现：做完 10 题回首页，hero 短暂 0/20，刷新才 10/20——answer_log POST 在途时首页已发 home_bundle GET，
// 读到写前快照并按 3s TTL 复用。写请求落地后再 clear 一次，让这段写窗口内取到的结果失去复用资格。
describe('W16 写窗口：写在途期间发出的 GET 结果不得在写落地后继续复用', () => {
  it('模拟 request()：写发起 clear → GET 读旧值 → 写落地 clear → 下一次 GET 穿透拿新值', async () => {
    const c = createGetCache();
    const server = { today_n: 0 };
    const fetch = vi.fn(() => Promise.resolve({ today_n: server.today_n }));
    const write = deferred();

    c.clear(); // 写发起
    expect(await c.run(K, U, 3000, fetch)).toEqual({ today_n: 0 }); // 首页 onShow 在写在途时读到旧值
    server.today_n = 10;
    write.resolve();
    await write.promise.finally(() => c.clear()); // 写落地
    expect(await c.run(K, U, 3000, fetch)).toEqual({ today_n: 10 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('对照：只在写发起时 clear，写窗口内读到的旧值会被 TTL 复用（即修复前的缺陷）', async () => {
    const c = createGetCache();
    const server = { today_n: 0 };
    const fetch = vi.fn(() => Promise.resolve({ today_n: server.today_n }));
    c.clear();
    await c.run(K, U, 3000, fetch);
    server.today_n = 10;
    expect(await c.run(K, U, 3000, fetch)).toEqual({ today_n: 0 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

// 生产复现：uni-button.kg-btn 全部 tabIndex=-1，Tab 遍历到不了主按钮。uni-h5 的 <button> 编译为自定义元素
// <uni-button>（onClick 挂在宿主），不在原生 Tab 序列；补进宿主白名单即与 uni-view 同路径拿到 tabindex=0 + Enter/Space。
describe('W16 a11y-focus：UNI-BUTTON 进入键盘宿主白名单', () => {
  it('UNI-BUTTON 与既有 VIEW/TEXT/IMAGE/LABEL 一并命中；原生/其他宿主不命中', () => {
    for (const t of ['UNI-BUTTON', 'UNI-VIEW', 'UNI-TEXT', 'UNI-IMAGE', 'UNI-LABEL']) expect(HOST_RE.test(t), t).toBe(true);
    for (const t of ['BUTTON', 'DIV', 'UNI-INPUT', 'UNI-TEXTAREA', 'UNI-SCROLL-VIEW', 'UNI-BUTTONX']) expect(HOST_RE.test(t), t).toBe(false);
  });
});
