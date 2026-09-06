// API 封装：H5 同源相对路径；小程序 / App 必须用绝对域名（可用 VITE_API_BASE 覆盖）
import { isNativeApp, savePdfNative } from './native';
import { isTimeoutMsg, isNetMsg, classifyHttpError, snapCacheable, snapFresh, snapPushIndex, parseSseEvents, trackRetryable, trackQueuePush, trackReplayPayload } from './api-policy';

const REMOTE_BASE = 'https://kaogong.zalize.com';

// #ifdef H5
export const BASE_URL = import.meta.env.VITE_API_BASE || '';
// #endif
// #ifndef H5
export const BASE_URL = import.meta.env.VITE_API_BASE || REMOTE_BASE;
// #endif

function getCode() {
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

function authHeader() {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

export function authRegister(phone, password, code, nickname) {
  return request('/api/auth/register', { method: 'POST', data: { phone, password, code, nickname: nickname || null } });
}

export function authLogin(phone, password) {
  return request('/api/auth/login', { method: 'POST', data: { phone, password } });
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

// ---------- 每题讨论区 ----------

export function fetchComments(questionId, sort) {
  return request(`/api/comments?question_id=${questionId}&sort=${sort || 'hot'}&uid=${encodeURIComponent(anonUid())}`);
}

export function fetchCommentCount(questionId) {
  return request(`/api/comments/count?question_id=${questionId}`);
}

export function postComment(questionId, content, parentId) {
  return request('/api/comments', {
    method: 'POST',
    data: { question_id: questionId, content, parent_id: parentId || null },
  });
}

export function likeComment(cid) {
  return request(`/api/comments/${cid}/like`, { method: 'POST' });
}

export function deleteOwnComment(cid) {
  return request(`/api/comments/${cid}`, { method: 'DELETE' });
}

export function reportComment(cid, reason) {
  return request(`/api/comments/${cid}/report`, { method: 'POST', data: { reason } });
}

export function fetchCommentInbox() {
  return request('/api/comments/inbox');
}

export function fetchCommentsPlaza() {
  return request('/api/comments/plaza');
}

export function readCommentInbox() {
  return request('/api/comments/inbox/read', { method: 'POST' });
}

// ---------- 收藏夹 / 笔记 ----------

export function fetchFavFolders() {
  return request(`/api/favs/folders?uid=${encodeURIComponent(anonUid())}`);
}

export function createFavFolder(name, icon) {
  return request('/api/favs/folders', { method: 'POST', data: { uid: anonUid(), name, icon } });
}

export function renameFavFolder(fid, name) {
  return request(`/api/favs/folders/${fid}`, { method: 'PATCH', data: { uid: anonUid(), name } });
}

export function deleteFavFolder(fid) {
  return request(`/api/favs/folders/${fid}?uid=${encodeURIComponent(anonUid())}`, { method: 'DELETE' });
}

export function fetchFavs(folderId, module) {
  let p = `/api/favs?uid=${encodeURIComponent(anonUid())}`;
  if (folderId != null) p += `&folder_id=${folderId}`;
  if (module) p += `&module=${module}`;
  return request(p);
}

export function setFav(questionId, folderId) {
  return request('/api/favs', { method: 'POST', data: { uid: anonUid(), question_id: questionId, folder_id: folderId || null } });
}

export function removeFav(questionId) {
  return request(`/api/favs?uid=${encodeURIComponent(anonUid())}&question_id=${questionId}`, { method: 'DELETE' });
}

export function favStatus(questionId) {
  return request(`/api/favs/status?uid=${encodeURIComponent(anonUid())}&question_id=${questionId}`);
}

export function fetchNotes() {
  return request(`/api/notes?uid=${encodeURIComponent(anonUid())}`);
}

export function fetchNote(questionId) {
  return request(`/api/notes?uid=${encodeURIComponent(anonUid())}&question_id=${questionId}`);
}

export function saveNote(questionId, content) {
  return request('/api/notes', { method: 'POST', data: { uid: anonUid(), question_id: questionId, content } });
}

// ---------- 打卡海报 ----------

export function fetchCheckinSummary() {
  return request(`/api/checkin/summary?uid=${encodeURIComponent(anonUid())}`);
}

export function fetchCheckinBadges() {
  return request(`/api/checkin/badges?uid=${encodeURIComponent(anonUid())}`);
}

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
  return !!getCode();
}

// 后端是否开启访问码（新增只读接口，旧后端 404 时按未开启处理）
export function fetchAccessInfo() {
  return rawRequest('/api/access_info').catch(() => ({ required: false }));
}

async function withAuthRetry(fn) {
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

function rawRequest(path, { method = 'GET', data, header = {}, timeout = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + path,
      method,
      data,
      header: { 'X-Access-Code': getCode(), ...authHeader(), ...header },
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
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
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

// 快照即显（客户端 stale-while-revalidate）：同步读取最近成功快照供页面先行渲染，
// 调用方随后照常 request()，真实响应到达后覆盖；无快照/超白名单返回 null
export function snapPeek(path) {
  if (!snapCacheable(path)) return null;
  const snap = snapLoad(path);
  return snap ? snap.d : null;
}

export function request(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  if (method !== 'GET' || opts.timeout != null) return withAuthRetry(() => rawRequest(path, opts));
  // GET 默认 12s 超时；超时自动重试一次（幂等安全）——共享 origin 长尾为单请求级，重试大概率命中热路径
  return withAuthRetry(() =>
    rawRequest(path, { ...opts, timeout: 12000 })
      .catch((e) => {
        if (!isTimeoutErr(e)) throw e;
        return rawRequest(path, { ...opts, timeout: 20000 });
      })
      .then((data) => {
        if (snapCacheable(path)) snapSave(path, data);
        return data;
      })
      .catch((e) => {
        // 最后一跳：仅超时/网络错误回退最近成功快照，HTTP 业务错误（401/422 等）必须透出
        if (!isNetErr(e) || !snapCacheable(path)) throw e;
        const snap = snapLoad(path);
        if (!snap) throw e;
        trackEvent('stale_fallback', 'h5', path.slice(0, 120));
        return snap.d;
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

// ---------- 每日一练成绩可靠投递 ----------
// 完成页一次性 POST 在共享 origin 长尾（几十秒级）下可能超时/随关页被取消导致成绩丢失；
// 先落地 pending 再发送，失败保留，首页 onShow 幂等补投（服务端 (day,uid) 主键，重试安全）。
const DAILY_PENDING_KEY = 'dailyPendingSubmit';

export function submitDailySet(payload) {
  uni.setStorageSync(DAILY_PENDING_KEY, payload);
  return request('/api/daily_set/submit', { method: 'POST', data: payload }).then((d) => {
    uni.removeStorageSync(DAILY_PENDING_KEY);
    uni.setStorageSync('dailyDone:' + payload.uid, {
      date: payload.date, right: d.my_right, total: payload.total, rank: d.my_rank, streak: d.streak,
    });
    return d;
  });
}

export function flushDailySubmit() {
  const p = uni.getStorageSync(DAILY_PENDING_KEY);
  if (!p || !p.date || !p.uid) return;
  const cnDay = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  if (p.date !== cnDay) {
    uni.removeStorageSync(DAILY_PENDING_KEY);
    return;
  }
  submitDailySet(p).catch(() => {});
}

// 记录最近导出的试卷码（各端共用）
function rememberPaper(paperCode, title) {
  if (!paperCode) return;
  const list = (uni.getStorageSync('recentPapers') || []).filter((p) => p.code !== paperCode);
  list.unshift({ code: paperCode, title: title || '试卷', ts: Date.now() });
  uni.setStorageSync('recentPapers', list.slice(0, 10));
}

// #ifndef H5
// 小程序 / App：POST 拿 arraybuffer → 落地本地文件 → 系统预览打开
export async function exportPdf(body) {
  const res = await new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + '/api/export/pdf',
      method: 'POST',
      data: body,
      header: { 'Content-Type': 'application/json', 'X-Access-Code': getCode(), ...authHeader() },
      responseType: 'arraybuffer',
      timeout: 120000,
      success: resolve,
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    });
  });
  if (res.statusCode < 200 || res.statusCode >= 300) throw new Error('HTTP ' + res.statusCode);
  const h = res.header || {};
  rememberPaper(h['X-Paper-Code'] || h['x-paper-code'], body.title);
  const name = 'paper-' + Date.now() + '.pdf';
  // #ifdef MP-WEIXIN
  const fs = wx.getFileSystemManager();
  const filePath = `${wx.env.USER_DATA_PATH}/${name}`;
  await new Promise((resolve, reject) => {
    fs.writeFile({
      filePath,
      data: res.data,
      success: resolve,
      fail: (e) => reject(new Error(e.errMsg || '写入失败')),
    });
  });
  await new Promise((resolve, reject) => {
    uni.openDocument({
      filePath,
      fileType: 'pdf',
      showMenu: true,
      success: resolve,
      fail: (e) => reject(new Error(e.errMsg || '打开 PDF 失败')),
    });
  });
  // #endif
  // #ifdef APP-PLUS
  const b64 = uni.arrayBufferToBase64(res.data);
  await new Promise((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL(
      '_doc/',
      (dir) => {
        dir.getFile(
          name,
          { create: true },
          (fileEntry) => {
            fileEntry.createWriter((writer) => {
              writer.onwriteend = () => {
                plus.runtime.openFile(fileEntry.fullPath);
                resolve();
              };
              writer.onerror = () => reject(new Error('写入失败'));
              writer.writeAsBinary(b64);
            }, () => reject(new Error('写入失败')));
          },
          () => reject(new Error('创建文件失败'))
        );
      },
      () => reject(new Error('存储不可用'))
    );
  });
  // #endif
}
// #endif

// #ifdef H5
// 导出试卷 PDF 并触发浏览器下载（H5）。
export async function exportPdf(body) {
  const resp = await fetch(BASE_URL + '/api/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let msg = 'HTTP ' + resp.status;
    try {
      msg = (await resp.json()).detail || msg;
    } catch (e) { /* 保留状态码 */ }
    throw new Error(msg);
  }
  rememberPaper(resp.headers.get('X-Paper-Code'), body.title);
  const blob = await resp.blob();
  if (isNativeApp()) {
    await savePdfNative(blob, (body.title || '试卷') + '-' + Date.now() + '.pdf');
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (body.title || '试卷') + '.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}
// #endif

// SSE 文本 → 事件回调；解析见 api-policy.parseSseEvents。
function feedSse(chunkText, state, onMeta, onDelta, onThinking) {
  const { rest, events } = parseSseEvents(state.buf + chunkText);
  state.buf = rest;
  for (const { type, data } of events) {
    if (type === 'meta') { state.meta = data; onMeta && onMeta(data); }
    else if (type === 'thinking') { onThinking && onThinking(data); }
    else if (type === 'done') { state.done = data; }
    else if (type === 'error') throw new Error(data.message || state.errMsg || '生成失败');
    else if (type === 'message') { state.full += data.d; onDelta && onDelta(state.full); }
  }
}

// #ifdef H5
// H5 流式讲解：onMeta(meta) 一次，onDelta(fullText) 增量；返回完整讲解文本。
export async function streamExplain({ file, text, userAnswer, questionId, onMeta, onDelta, onThinking }) {
  const doIt = async () => {
    const fd = new FormData();
    if (file) fd.append('image', file);
    if (text) fd.append('text', text);
    if (userAnswer) fd.append('user_answer', userAnswer);
    if (questionId > 0) fd.append('question_id', String(questionId));
    const resp = await fetch(BASE_URL + '/api/explain/stream', {
      method: 'POST',
      headers: { 'X-Access-Code': getCode(), ...authHeader() },
      body: fd,
    });
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try { detail = (await resp.json()).detail || detail; } catch (e) { /* ignore */ }
      throw new Error(detail);
    }
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    const state = { buf: '', full: '', meta: null };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      feedSse(dec.decode(value, { stream: true }), state, onMeta, onDelta, onThinking);
    }
    if (!state.meta) throw new Error('生成失败：无响应');
    return { ...state.meta, explanation: state.full };
  };
  return withAuthRetry(doIt);
}
// #endif

// #ifndef H5
// 小程序/App 无 fetch 流。文字题走分块流式（微信 enableChunked / App XHR 进度），
// 图片题无法分块上传 → 降级为一次性 /api/explain（uploadExplain）。
export function streamExplain({ filePath, text, userAnswer, questionId, onMeta, onDelta, onThinking }) {
  if (filePath || !text) {
    return uploadExplain({ filePath: filePath || null, text: text || null, userAnswer }).then((d) => {
      onMeta && onMeta(d);
      onDelta && onDelta(d.explanation || '');
      return d;
    });
  }
  const formBody = { text, ...(userAnswer ? { user_answer: userAnswer } : {}), ...(questionId > 0 ? { question_id: questionId } : {}) };
  const header = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Access-Code': getCode(),
    ...authHeader(),
  };
  const doIt = () =>
    new Promise((resolve, reject) => {
      const state = { buf: '', full: '', meta: null };
      const finish = () => {
        if (!state.meta) reject(new Error('生成失败：无响应'));
        else resolve({ ...state.meta, explanation: state.full });
      };
      // #ifdef MP
      const task = uni.request({
        url: BASE_URL + '/api/explain/stream',
        method: 'POST',
        header,
        data: formBody,
        enableChunked: true,
        timeout: 180000,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) finish();
          else reject(new Error('HTTP ' + res.statusCode));
        },
        fail: (err) => reject(new Error(err.errMsg || '网络错误')),
      });
      const decode = makeUtf8Decoder();
      if (task && task.onChunkReceived) {
        task.onChunkReceived((r) => {
          try {
            feedSse(decode(r.data), state, onMeta, onDelta, onThinking);
          } catch (e) {
            reject(e);
          }
        });
      }
      // #endif
      // #ifdef APP-PLUS
      const xhr = new plus.net.XMLHttpRequest();
      let seen = 0;
      xhr.onreadystatechange = () => {
        if (xhr.readyState >= 3) {
          if (xhr.status && (xhr.status < 200 || xhr.status >= 300)) {
            reject(new Error('HTTP ' + xhr.status));
            return;
          }
          const txt = xhr.responseText || '';
          if (txt.length > seen) {
            try {
              feedSse(txt.slice(seen), state, onMeta, onDelta, onThinking);
            } catch (e) {
              reject(e);
              return;
            }
            seen = txt.length;
          }
          if (xhr.readyState === 4) finish();
        }
      };
      xhr.open('POST', BASE_URL + '/api/explain/stream');
      Object.keys(header).forEach((k) => xhr.setRequestHeader(k, header[k]));
      xhr.send(
        Object.keys(formBody)
          .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(formBody[k]))
          .join('&')
      );
      // #endif
    });
  return withAuthRetry(doIt);
}

// 增量 UTF-8 解码（小程序无 TextDecoder，需处理跨 chunk 的多字节截断）
function makeUtf8Decoder() {
  let pending = [];
  return function decode(arrayBuffer) {
    const all = pending.concat(Array.from(new Uint8Array(arrayBuffer)));
    let end = all.length;
    for (let i = all.length - 1, k = 0; i >= 0 && k < 4; i--, k++) {
      const b = all[i];
      if (b < 0x80) break;
      if (b >= 0xc0) {
        const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : 2;
        if (all.length - i < need) end = i;
        break;
      }
    }
    pending = all.slice(end);
    let s = '';
    for (let i = 0; i < end; ) {
      const b = all[i];
      if (b < 0x80) { s += String.fromCharCode(b); i += 1; }
      else if (b >= 0xf0) {
        s += String.fromCodePoint(
          ((b & 0x07) << 18) | ((all[i + 1] & 0x3f) << 12) | ((all[i + 2] & 0x3f) << 6) | (all[i + 3] & 0x3f)
        );
        i += 4;
      } else if (b >= 0xe0) {
        s += String.fromCharCode(((b & 0x0f) << 12) | ((all[i + 1] & 0x3f) << 6) | (all[i + 2] & 0x3f));
        i += 3;
      } else {
        s += String.fromCharCode(((b & 0x1f) << 6) | (all[i + 1] & 0x3f));
        i += 2;
      }
    }
    return s;
  };
}
// #endif

export function scanSheet({ filePath, uid }) {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: BASE_URL + '/api/scan_sheet',
      filePath,
      name: 'image',
      formData: { uid: uid || '' },
      timeout: 120000,
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error(data.detail || `HTTP ${res.statusCode}`));
        } catch (e) {
          reject(e);
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '上传失败')),
    });
  });
}

export function uploadExplain({ filePath, text, userAnswer }) {
  const doIt = () =>
    new Promise((resolve, reject) => {
      const formData = {};
      if (text) formData.text = text;
      if (userAnswer) formData.user_answer = userAnswer;
      if (filePath) {
        uni.uploadFile({
          url: BASE_URL + '/api/explain',
          filePath,
          name: 'image',
          formData,
          header: { 'X-Access-Code': getCode(), ...authHeader() },
          timeout: 180000,
          success: (res) => {
            try {
              const data = JSON.parse(res.data);
              if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
              else reject(new Error(data.detail || `HTTP ${res.statusCode}`));
            } catch (e) {
              reject(e);
            }
          },
          fail: (err) => reject(new Error(err.errMsg || '上传失败')),
        });
      } else {
        rawRequest('/api/explain', {
          method: 'POST',
          header: { 'Content-Type': 'application/x-www-form-urlencoded' },
          data: formData,
        }).then(resolve, reject);
      }
    });
  return withAuthRetry(doIt);
}

// ---------- AI 面试陪练 ----------

export function interviewCategories() {
  return request('/api/interview/categories?uid=' + encodeURIComponent(anonUid()));
}

export function interviewDraw(category, excludeId) {
  let qs = 'uid=' + encodeURIComponent(anonUid());
  if (category) qs += '&category=' + encodeURIComponent(category);
  if (excludeId) qs += '&exclude_id=' + excludeId;
  return request('/api/interview/question?' + qs);
}

export function interviewHistory(limit) {
  return request('/api/interview/history?uid=' + encodeURIComponent(anonUid()) + '&limit=' + (limit || 50));
}

export function interviewSession(id) {
  return request('/api/interview/sessions/' + id + '?uid=' + encodeURIComponent(anonUid()));
}

// #ifdef H5
// H5 流式点评：onMeta({scores,total,summary}) 一次，onDelta(fullText) 增量，onDone({session_id})。
export async function streamInterview({ questionId, answer, durationSec, onMeta, onDelta }) {
  const resp = await fetch(BASE_URL + '/api/interview/answer/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Code': getCode(), ...authHeader() },
    body: JSON.stringify({ uid: anonUid(), question_id: questionId, answer, duration_sec: durationSec || 0 }),
  });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try { detail = (await resp.json()).detail || detail; } catch (e) { /* ignore */ }
    throw new Error(detail);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  const state = { buf: '', full: '', meta: null, done: null, errMsg: '点评失败' };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    feedSse(dec.decode(value, { stream: true }), state, onMeta, onDelta);
  }
  if (!state.meta) throw new Error('点评失败：无响应');
  return { ...state.meta, review: state.full, session_id: state.done && state.done.session_id };
}

// H5 中断 session 重新生成点评：onDelta(fullText) 增量，完成返回 { review }。
export async function streamInterviewReviewRegen({ sessionId, onDelta }) {
  const resp = await fetch(BASE_URL + '/api/interview/sessions/' + sessionId + '/review/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Code': getCode(), ...authHeader() },
    body: JSON.stringify({ uid: anonUid() }),
  });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try { detail = (await resp.json()).detail || detail; } catch (e) { /* ignore */ }
    throw new Error(detail);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  const state = { buf: '', full: '', errMsg: '点评失败' };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    feedSse(dec.decode(value, { stream: true }), state, null, onDelta);
  }
  if (!state.full) throw new Error('点评失败：无响应');
  return { review: state.full };
}
// #endif

// #ifndef H5
// 小程序 / App：一次性返回打分与点评。
export async function streamInterview({ questionId, answer, durationSec, onMeta, onDelta }) {
  const d = await request('/api/interview/answer', {
    method: 'POST',
    data: { uid: anonUid(), question_id: questionId, answer, duration_sec: durationSec || 0 },
  });
  onMeta && onMeta(d);
  onDelta && onDelta(d.review || '');
  return d;
}
// #endif

// ---------- 答题 PK（异步） ----------

export function pkNickname() {
  const u = getAuthUser();
  if (u && u.nickname) return u.nickname;
  if (u && u.phone) return '考友' + String(u.phone).slice(-4);
  // 匿名昵称按 uid 隔离，避免同设备切换身份后串用他人昵称；旧全局键迁移到当前 uid 一次
  const key = 'pkNickname:' + anonUid();
  let n = uni.getStorageSync(key);
  if (!n) {
    n = uni.getStorageSync('pkNickname');
    if (n) uni.removeStorageSync('pkNickname');
    else n = '考友' + Math.random().toString(36).slice(2, 6).toUpperCase();
    uni.setStorageSync(key, n);
  }
  return n;
}

export function pkCreate(module) {
  return request('/api/pk/create', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname(), module: module || null } });
}

export function pkJoin(code) {
  return request('/api/pk/join', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname(), code } });
}

export function pkRandomMatch(module) {
  return request('/api/pk/random_match', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname(), module: module || null } });
}

export function pkMatch(code) {
  return request(`/api/pk/match/${encodeURIComponent(code)}?uid=${encodeURIComponent(anonUid())}`);
}

export function pkSubmit(code, items) {
  return request('/api/pk/submit', { method: 'POST', data: { uid: anonUid(), code, items }, timeout: 20000 });
}

export function pkMine() {
  return request(`/api/pk/mine?uid=${encodeURIComponent(anonUid())}`);
}

export function pkResult(code) {
  return request(`/api/pk/result/${encodeURIComponent(code)}`);
}

// ---------- 组队打卡 / 题目分享 ----------

export function teamCreate(name) {
  return request('/api/team/create', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname(), name } });
}

export function teamJoin(code) {
  return request('/api/team/join', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname(), code } });
}

export function teamLeave(teamId) {
  return request('/api/team/leave', { method: 'POST', data: { uid: anonUid(), team_id: teamId } });
}

export function teamMine() {
  return request(`/api/team/mine?uid=${encodeURIComponent(anonUid())}`);
}

export function teamPanel(teamId) {
  return request(`/api/team/${teamId}/panel?uid=${encodeURIComponent(anonUid())}`);
}

export function shareCreate(questionId, teamId) {
  return request('/api/share/create', {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), question_id: questionId, team_id: teamId || null },
  });
}

export function shareDetail(sid) {
  return request(`/api/share/${encodeURIComponent(sid)}?uid=${encodeURIComponent(anonUid())}`);
}

export function shareAnswer(sid, picked, secs) {
  return request(`/api/share/${encodeURIComponent(sid)}/answer`, {
    method: 'POST',
    data: { uid: anonUid(), nickname: pkNickname(), picked, secs: secs || 0 },
  });
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

// 分享文案 A/B：按 uid 稳定分桶（a=好奇型，b=挑战型），用于 share_open/share_answer/share_copy 漏斗对比
export function shareVariant() {
  const uid = anonUid();
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) & 0x7fffffff;
  return h % 2 === 0 ? 'a' : 'b';
}

export function qShareText(mod, sid) {
  const v = shareVariant();
  const url = `https://kaogong.zalize.com/s/${sid}?v=${v}`;
  if (v === 'b') {
    return `【${mod}】敢不敢挑战这道题？不少人都做错了，答完立刻看你击败了多少人：${url}`;
  }
  return `【${mod}】我刚做了一道题，你能做对吗？答完就能看到大家选了啥：${url}`;
}

// 把分享落地页地址栏回写为服务端短链（/s/{sid}、/p/{rid}），地址栏转发/浏览器原生分享
// 不再携带聊天应用会截断的 #/? hash 路由；站内一旦导航即把 path 还原为 /，避免刷新误落分享页
export function canonicalizeSharePath(path) {
  // #ifdef H5
  try {
    window.history.replaceState(null, '', path);
    window.addEventListener(
      'hashchange',
      () => window.history.replaceState(null, '', '/' + window.location.hash),
      { once: true }
    );
  } catch (e) {
    /* 老旧 webview 无 History API 时静默降级 */
  }
  // #endif
}

export function pkLeaderboard() {
  return request(`/api/pk/leaderboard?uid=${encodeURIComponent(anonUid())}`);
}
