// API transport 层：BASE_URL/请求封装/登录态/访问码/快照兜底/GET 合并缓存/埋点可靠投递。
// 端点按域分在 api/{social,daily,export,ai,play}.js；src/api.js 只做 barrel 重导出，调用侧 import 不变。
import { isTimeoutMsg, isNetMsg, netFailMessage, classifyHttpError, snapCacheable, snapFresh, snapPushIndex, isStaleUidResponse, isStaleUidErr, trackRetryable, trackQueuePush, trackReplayPayload } from '../api-policy';
import { createGetCache, getTtl, isTrackPath } from '../api-get-cache';

export { isStaleUidErr };

const REMOTE_BASE = 'https://kaogong.zalize.com';

// #ifdef H5
export const BASE_URL = import.meta.env.VITE_API_BASE || '';
// #endif
// #ifndef H5
export const BASE_URL = import.meta.env.VITE_API_BASE || REMOTE_BASE;
// #endif

export function getAccessCode() {
  return uni.getStorageSync('accessCode') || '';
}

// ---------- 账号登录态 ----------

export function getToken() {
  return uni.getStorageSync('authToken') || '';
}

export function getAuthUser() {
  try {
    const u = uni.getStorageSync('authUser');
    return u && u.uid ? u : null;
  } catch (e) {
    return null;
  }
}

// 登录：保留本机匿名 uid 以便合并，并把当前 uid 切到账号稳定 uid
export function setAuth(token, user) {
  const cur = uni.getStorageSync('anonUid');
  if (cur && cur !== user.uid && !uni.getStorageSync('deviceAnonUid')) {
    uni.setStorageSync('deviceAnonUid', cur);
  }
  // 做题记录服务端已合并，本机按 uid 隔离的时政完成态也一并迁移到账号 uid
  if (cur && cur !== user.uid && !uni.getStorageSync('szDaily:' + user.uid)) {
    const sz = uni.getStorageSync('szDaily:' + cur);
    if (sz) uni.setStorageSync('szDaily:' + user.uid, sz);
  }
  uni.setStorageSync('authToken', token);
  uni.setStorageSync('authUser', user);
  uni.setStorageSync('anonUid', user.uid);
  uni.$emit('authChanged');
}

// 退出/401：清登录态，回到本机匿名 uid
export function clearAuth() {
  uni.removeStorageSync('authToken');
  uni.removeStorageSync('authUser');
  const dev = uni.getStorageSync('deviceAnonUid');
  if (dev) uni.setStorageSync('anonUid', dev);
  else uni.removeStorageSync('anonUid');
  uni.$emit('authChanged');
}

export function authHeader() {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

export function authRegister(email, password, code, nickname) {
  return request('/api/auth/register', { method: 'POST', data: { email, password, code, nickname: nickname || null } });
}

export function authLogin(email, password) {
  return request('/api/auth/login', { method: 'POST', data: { email, password } });
}

export function authSso() {
  // Zalize 统一账号一键登录：H5 同域自动携带 .zalize.com 中心站 Cookie
  return request('/api/auth/sso', { method: 'POST' });
}

export function authLogout() {
  return request('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

export function authMe() {
  return request('/api/auth/me');
}

export function mergeAnon(anonUidVal) {
  return request('/api/auth/merge_anon', { method: 'POST', data: { anon_uid: anonUidVal } });
}


// ---------- 访问码（内测功能） ----------

function askCode() {
  return new Promise((resolve) => {
    uni.showModal({
      title: '需要访问码（内测功能）',
      editable: true,
      placeholderText: '请输入访问码，可联系管理员获取',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm && res.content) {
          uni.setStorageSync('accessCode', res.content.trim());
          resolve(true);
        } else resolve(false);
      },
      fail: () => resolve(false),
    });
  });
}

export function promptAccessCode() {
  return askCode();
}

export function hasAccessCode() {
  return !!getAccessCode();
}

// 后端是否开启访问码（新增只读接口，旧后端 404 时按未开启处理）
export function fetchAccessInfo() {
  return rawRequest('/api/access_info').catch(() => ({ required: false }));
}

export async function withAuthRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    if (String(e.message).includes('访问码')) {
      uni.removeStorageSync('accessCode');
      const ok = await askCode();
      if (ok) return fn();
      throw new Error('该功能需访问码，已取消（已输入的内容未丢失）');
    }
    throw e;
  }
}


export function rawRequest(path, { method = 'GET', data, header = {}, timeout = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + path,
      method,
      data,
      header: { 'X-Access-Code': getAccessCode(), ...authHeader(), ...header },
      timeout,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else {
          // detail 提取 / 登录态失效判定 / 对外文案统一，决策见 api-policy.classifyHttpError
          const { authExpired, message } = classifyHttpError({
            status: res.statusCode,
            detail: res.data && res.data.detail,
            path,
          });
          if (authExpired && (getToken() || res.statusCode === 403)) {
            clearAuth();
            uni.showToast({ title: '登录已过期，请重新登录', icon: 'none', duration: 2500 });
          }
          reject(new Error(message));
        }
      },
      fail: (err) => reject(new Error(netFailMessage(err && err.errMsg))),
    });
  });
}

const isTimeoutErr = (e) => isTimeoutMsg(e && e.message);
export const isNetErr = (e) => isNetMsg(e && e.message);

// ---------- GET 最近成功快照兜底 ----------
// uid 专属/随机端点无法进边缘缓存，共享 origin 长尾下双超时后调用方只能拿错误态；
// 快照按完整 path（含 query/uid）隔离，仅超时/网络错误回退，HTTP 业务错误照旧透出。
const SNAP_PREFIX = 'apiSnap:';
const SNAP_INDEX = 'apiSnapIndex';
const SNAP_MAX = 40;
const SNAP_TTL = 24 * 3600 * 1000;
const SNAP_MAX_BYTES = 64 * 1024;

function snapSave(path, data) {
  try {
    const body = JSON.stringify({ t: Date.now(), d: data });
    if (body.length > SNAP_MAX_BYTES) return;
    uni.setStorageSync(SNAP_PREFIX + path, body);
    const { idx, evict } = snapPushIndex(uni.getStorageSync(SNAP_INDEX) || [], path, SNAP_MAX);
    evict.forEach((p) => uni.removeStorageSync(SNAP_PREFIX + p));
    uni.setStorageSync(SNAP_INDEX, idx);
  } catch (e) {
    /* storage 满/序列化失败：兜底是尽力而为 */
  }
}

function snapLoad(path) {
  try {
    const body = uni.getStorageSync(SNAP_PREFIX + path);
    if (!body) return null;
    const snap = JSON.parse(body);
    return snapFresh(snap, Date.now(), SNAP_TTL) ? snap : null;
  } catch (e) {
    return null;
  }
}

// request() 以旧快照兜底时给返回值打标（按对象身份，不改数据本身），页面据此区分「真实回包」与「旧快照」：
// 到期数等时效字段不能把旧快照当已同步，且应向用户明示网络异常与快照时刻
const staleMarks = new WeakMap();
function markStale(data, t) {
  if (data && typeof data === 'object') staleMarks.set(data, t || Date.now());
  return data;
}
/** 该数据若来自旧快照兜底返回快照时刻（ms），真实回包返回 0 */
export function staleAt(data) {
  return (data && typeof data === 'object' && staleMarks.get(data)) || 0;
}

// 快照即显（客户端 stale-while-revalidate）：同步读取最近成功快照供页面先行渲染，
// 调用方随后照常 request()，真实响应到达后覆盖；无快照/超白名单返回 null
export function snapPeek(path) {
  if (!snapCacheable(path)) return null;
  const snap = snapLoad(path);
  return snap ? snap.d : null;
}

// 带 uid 的 GET 回包到达时本机身份已变（退出/换号/401 清态）：回包属旧身份，作废不交给调用方
function guardStaleUid(path, data) {
  if (isStaleUidResponse(path, uni.getStorageSync('anonUid'))) {
    const e = new Error('账号已切换，已忽略旧身份数据');
    e.staleUid = true;
    throw e;
  }
  return data;
}

// 同 path（含 query）GET 在途合并 + 只读白名单 3s 内存缓存：一次 onShow 多组件各自拉 home_bundle/growth 只发一次；
// key 已含 uid，切号再由 uid 判定整体作废。opts.ttl 可覆盖（0 = 仅合并不缓存）
const getCache = createGetCache();

export function request(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  // 写请求让短缓存整体作废：答题/签到后紧接着读 today、growth 必须拿到新值；埋点 track 不动任何读模型，不作废。
  // 发起时与落地后各作废一次：写在途期间发出的 GET 读到的是写前快照，不能在写落地后继续当新值复用
  if (method !== 'GET') {
    if (isTrackPath(path)) return withAuthRetry(() => rawRequest(path, opts));
    getCache.clear();
    return withAuthRetry(() => rawRequest(path, opts)).finally(() => getCache.clear());
  }
  if (opts.timeout != null) return withAuthRetry(() => rawRequest(path, opts).then((d) => guardStaleUid(path, d)));
  const ttl = opts.ttl != null ? opts.ttl : getTtl(path);
  const key = opts.data == null ? path : path + '#' + JSON.stringify(opts.data);
  // GET 默认 12s 超时；超时自动重试一次（幂等安全）——共享 origin 长尾为单请求级，重试大概率命中热路径
  return withAuthRetry(() =>
    getCache
      .run(key, uni.getStorageSync('anonUid'), ttl, () =>
        rawRequest(path, { ...opts, timeout: 12000 })
          .catch((e) => {
            if (!isTimeoutErr(e)) throw e;
            return rawRequest(path, { ...opts, timeout: 20000 });
          })
          .then((data) => {
            guardStaleUid(path, data);
            if (snapCacheable(path)) snapSave(path, data);
            return data;
          })
      )
      .catch((e) => {
        // 最后一跳：仅超时/网络错误回退最近成功快照，HTTP 业务错误（401/422 等）必须透出
        if (!isNetErr(e) || !snapCacheable(path)) throw e;
        const snap = snapLoad(path);
        if (!snap) throw e;
        trackEvent('stale_fallback', 'h5', path.slice(0, 120));
        return markStale(snap.d, snap.t);
      })
  );
}

export function anonUid() {
  let uid = uni.getStorageSync('anonUid');
  if (!uid) {
    uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    uni.setStorageSync('anonUid', uid);
  }
  return uid;
}

// 埋点失败离线队列：瞬时失败（部署重启窗口/弱网）入队，下次成功上报后重放（决策见 api-policy）
const TRACK_Q_KEY = 'kgTrackQ';
let trackFlushing = false;

function trackQueueLoad() {
  const q = uni.getStorageSync(TRACK_Q_KEY);
  return Array.isArray(q) ? q : [];
}

function trackQueueSave(q) {
  if (q.length) uni.setStorageSync(TRACK_Q_KEY, q);
  else uni.removeStorageSync(TRACK_Q_KEY);
}

export function flushTrackQueue() {
  if (trackFlushing) return Promise.resolve();
  const q = trackQueueLoad();
  if (!q.length) return Promise.resolve();
  trackFlushing = true;
  trackQueueSave([]);
  const run = (i) => {
    if (i >= q.length) return Promise.resolve();
    return request('/api/track', { method: 'POST', data: trackReplayPayload(q[i], Date.now()) })
      .then(() => run(i + 1))
      .catch((e) => {
        if (trackRetryable(e && e.message)) {
          trackQueueSave(trackQueueLoad().concat(q.slice(i)));
          return Promise.resolve();
        }
        return run(i + 1);
      });
  };
  return run(0).finally(() => {
    trackFlushing = false;
  });
}

export function trackEvent(event, source, ref) {
  const data = { uid: anonUid(), event, source: source || null, ref: ref || null };
  return request('/api/track', { method: 'POST', data })
    .then((d) => {
      flushTrackQueue();
      return d;
    })
    .catch((e) => {
      if (trackRetryable(e && e.message)) {
        trackQueueSave(trackQueuePush(trackQueueLoad(), { ...data, t: Date.now() }));
      }
    });
}
