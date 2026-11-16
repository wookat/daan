# R207：SW 离线壳缓存污染收口（导航响应仅 2xx 才回写壳缓存）

## 取证（verified / inference / unknown）

- verified（源码）：`src/static/sw.js` 导航分支 `fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put('/', copy)); return res; })` 对任何同源 SPA 导航响应无条件回写 `'/'` 壳缓存，不检查 `res.ok`。
- verified（生产事实链）：origin 容器重建窗口（R205 取证：每次 ~15–25s 不可用）边缘对无副本路径可能透传 502（R205 已加单次重试，但重试窗内两次失败仍 502）；`/` 虽在边缘缓存允许清单内，但边缘副本过期+后台刷新失败的组合下仍可能对导航返回非 2xx。
- 后果推演（inference）：用户恰在故障窗口导航 → 502/504 错误页覆盖壳缓存 → 之后断网/弱网超时兜底 `caches.match('/')` 返回的是 502 页面而非可用 SPA 壳，且无自然恢复路径（下次成功导航才会覆盖回来，但离线用户等不到）。
- unknown：生产是否已有真实用户壳缓存被污染——SW Cache Storage 无法服务端观测，按防御性收口处理。

## 方案

导航分支回写壳缓存前加 `res.ok` 守卫（仅 2xx 回写；3xx/4xx/5xx 直出给页面但不入缓存）：

```js
fetch(req).then((res) => {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put('/', copy));
  }
  return res;
})
```

- 不改缓存名（`kg-shell-v4`）：逻辑守卫不影响既有副本兼容性，SW 字节变更自然触发浏览器更新+activate 清理。
- 不改离线兜底/超时/静态资源不拦截等既有语义。

## 验证计划

- 本地：ESLint/vitest/build 全绿（sw.js 为 classic script 无模块测试面，行为经生产受控验证）。
- 生产：部署后用 CDP 网络拦截把 `/` 导航 mock 成 502，确认 SW 收到 502 后壳缓存仍为旧的 200 副本（断网导航仍出正常壳）；再恢复正常导航确认 200 回写正常。
