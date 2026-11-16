// GET 请求层去重（纯逻辑，不依赖 uni）：同 key in-flight Promise 复用 + 只读白名单短 TTL 内存缓存；
// uid 变化或任何写请求（POST/PUT/DELETE，埋点 /api/track 除外）即整体作废，写后读与切号后读都穿透到服务端。
import { snapCacheable } from './api-policy';

export const GET_TTL_DEFAULT = 3000;

// 只读「读模型」端点：服务端只 SELECT、同 uid 3s 内再读结果一致。抽题（questions）、续做（*/resume）、复习队列（review*）
// 这类每次调用都可能换内容或推进流程的端点不进白名单，只做 in-flight 合并。
const READ_ONLY = /^\/api\/(home_bundle|growth|daily_plan|plan(\/\w+)?|today|predict|checkin(\/\w+)?|summary|stats|profile|announcement|question_counts|daily_set|recommend|mastery\/map|shenlun\/stats|exam\/attempts)(?=\?|$)/;

/** 埋点上报：只写 events 表，不影响任何只读端点的结果，写后无需作废。 */
export function isTrackPath(path) {
  return typeof path === 'string' && /^\/api\/track(?=\?|$)/.test(path);
}

/** 快照白名单之上再收窄到幂等只读端点：命中返回 ttl（ms），否则 0（仅 in-flight 合并，不缓存结果）。 */
export function getTtl(path, ttl = GET_TTL_DEFAULT) {
  if (typeof path !== 'string' || !snapCacheable(path)) return 0;
  return READ_ONLY.test(path) ? ttl : 0;
}

export function createGetCache({ now = Date.now } = {}) {
  const inflight = new Map();
  const fresh = new Map();
  let uid;
  let gen = 0;

  function clear() {
    gen += 1;
    inflight.clear();
    fresh.clear();
  }

  /**
   * @param key      path（含 query，uid 已在其中）
   * @param curUid   当前本机 uid；与上次不同则先清空两层
   * @param ttl      >0 时成功结果在 ttl 内直接复用；发起后若发生过 clear（写/切号）则结果不入缓存
   * @param fetch    () => Promise，真正发请求
   */
  function run(key, curUid, ttl, fetch) {
    if (curUid !== uid) {
      uid = curUid;
      clear();
    }
    const hit = ttl > 0 && fresh.get(key);
    if (hit && now() - hit.t < ttl) return Promise.resolve(hit.d);
    const pending = inflight.get(key);
    if (pending) return pending;
    const g = gen;
    const p = fetch()
      .then((d) => {
        if (ttl > 0 && g === gen) fresh.set(key, { t: now(), d });
        return d;
      })
      .finally(() => {
        if (inflight.get(key) === p) inflight.delete(key);
      });
    inflight.set(key, p);
    return p;
  }

  return { run, clear, size: () => inflight.size + fresh.size };
}
