# R222 设计：管理台重查询缓存 stale-while-revalidate（收口 governance 4–7s 过期冷路径）

## 取证（verified）

- origin 24h 慢请求（>3s）窗口中 `/api/admin/governance` 多次 4.0–7.1s（均 200，管理台治理页真实加载）；R221 已定位其实现为 `_cached("governance", 600, _governance_scan_uncached)`——600s TTL 过期后**下一个管理台请求同步承担** Python 全表逐行体检（156k 行 + JSON 解析），即每 10 分钟必有一个请求吃 4–7s。
- `_ADMIN_CACHE`/`_cached` 同时服务 dashboard(300s)/governance(600s) 等重查询，全部是「过期即同步重算」语义；且无锁，同键并发过期请求会各自重算（小惊群）。
- 代码库内已有成熟先例：`_pick_pools`（R81/R94）对过期缓存采用「先回旧值 + 后台单飞重建」，生产验证有效。

## 方案

`_cached` 对齐 `_pick_pools` 语义，零调用方改动：

```python
def _cached(key, ttl, fn):
    with _admin_cache_lock:
        hit = _ADMIN_CACHE.get(key)
        if hit:
            if now - hit[0] < ttl: return hit[1]
            if key not in _admin_refreshing:   # 过期：回旧值 + 后台单飞重算
                _admin_refreshing.add(key)
                threading.Thread(target=_refresh(key, fn), daemon=True).start()
            return hit[1]
    # 冷 miss（进程启动后首次）：同步计算，build 锁防同键惊群
```

- 过期路径从「同步 4–7s」变为「即时返回旧值 + 后台重算」；数据最陈旧度 ≈ TTL + 一次重算时长，管理台观测类数据可接受。
- 冷 miss（重启后首次访问）仍同步——与现状一致，不额外引入启动期后台扫描（2G 内存宿主不做常驻预热）。
- 后台重算失败：丢弃并释放单飞标记，旧值继续服务，下个过期请求再触发。

## 明确不做

- 不重写 `_governance_scan_uncached` 为 SQL（复杂 JSON 语义校验，独立候选）。
- 不加常驻预热线程（内存高压宿主，见 R212 取证）。
- 不改任何 `/api/admin/*` 契约。

## 验收

- pytest：过期返回旧值不阻塞、后台单飞重算更新缓存、冷 miss 同步计算、重算异常不污染缓存。
- 本地全绿门禁；部署后生产管理台 governance 页过期窗口实测 <1s。
