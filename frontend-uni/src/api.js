// API 封装：H5 同源相对路径；小程序 / App 必须用绝对域名（可用 VITE_API_BASE 覆盖）
import { isNativeApp, savePdfNative } from './native';

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
  uni.setStorageSync('authToken', token);
  uni.setStorageSync('authUser', user);
  uni.setStorageSync('anonUid', user.uid);
}

// 退出/401：清登录态，回到本机匿名 uid
export function clearAuth() {
  uni.removeStorageSync('authToken');
  uni.removeStorageSync('authUser');
  const dev = uni.getStorageSync('deviceAnonUid');
  if (dev) uni.setStorageSync('anonUid', dev);
  else uni.removeStorageSync('anonUid');
}

function authHeader() {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

export function authRegister(phone, password, code) {
  return request('/api/auth/register', { method: 'POST', data: { phone, password, code } });
}

export function authLogin(phone, password) {
  return request('/api/auth/login', { method: 'POST', data: { phone, password } });
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

function askCode() {
  return new Promise((resolve) => {
    uni.showModal({
      title: '请输入访问码',
      editable: true,
      placeholderText: '联系管理员获取',
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

async function withAuthRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    if (String(e.message).includes('访问码') || String(e.message).includes('401')) {
      uni.removeStorageSync('accessCode');
      const ok = await askCode();
      if (ok) return fn();
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
          if (res.statusCode === 401 && getToken() && !path.startsWith('/api/auth/login')) clearAuth();
          reject(new Error((res.data && res.data.detail) || `HTTP ${res.statusCode}`));
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    });
  });
}

export function request(path, opts) {
  return withAuthRetry(() => rawRequest(path, opts));
}

export function anonUid() {
  let uid = uni.getStorageSync('anonUid');
  if (!uid) {
    uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    uni.setStorageSync('anonUid', uid);
  }
  return uid;
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

// SSE 文本 → 事件回调；返回是否已收到 meta。
function feedSse(chunkText, state, onMeta, onDelta) {
  state.buf += chunkText;
  const events = state.buf.split('\n\n');
  state.buf = events.pop();
  for (const ev of events) {
    const typeM = ev.match(/^event: (\w+)/m);
    const dataM = ev.match(/^data: (.*)$/m);
    if (!dataM) continue;
    const type = typeM ? typeM[1] : 'message';
    const data = JSON.parse(dataM[1]);
    if (type === 'meta') { state.meta = data; onMeta && onMeta(data); }
    else if (type === 'error') throw new Error(data.message || '生成失败');
    else if (type === 'message') { state.full += data.d; onDelta && onDelta(state.full); }
  }
}

// #ifdef H5
// H5 流式讲解：onMeta(meta) 一次，onDelta(fullText) 增量；返回完整讲解文本。
export async function streamExplain({ file, text, userAnswer, onMeta, onDelta }) {
  const doIt = async () => {
    const fd = new FormData();
    if (file) fd.append('image', file);
    if (text) fd.append('text', text);
    if (userAnswer) fd.append('user_answer', userAnswer);
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
      feedSse(dec.decode(value, { stream: true }), state, onMeta, onDelta);
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
export function streamExplain({ filePath, text, userAnswer, onMeta, onDelta }) {
  if (filePath || !text) {
    return uploadExplain({ filePath: filePath || null, text: text || null, userAnswer }).then((d) => {
      onMeta && onMeta(d);
      onDelta && onDelta(d.explanation || '');
      return d;
    });
  }
  const formBody = { text, ...(userAnswer ? { user_answer: userAnswer } : {}) };
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
            feedSse(decode(r.data), state, onMeta, onDelta);
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
              feedSse(txt.slice(seen), state, onMeta, onDelta);
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: anonUid(), question_id: questionId, answer, duration_sec: durationSec || 0 }),
  });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try { detail = (await resp.json()).detail || detail; } catch (e) { /* ignore */ }
    throw new Error(detail);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  const state = { buf: '', full: '', meta: null, done: null };
  const feed = (chunkText) => {
    state.buf += chunkText;
    const events = state.buf.split('\n\n');
    state.buf = events.pop();
    for (const ev of events) {
      const typeM = ev.match(/^event: (\w+)/m);
      const dataM = ev.match(/^data: (.*)$/m);
      if (!dataM) continue;
      const type = typeM ? typeM[1] : 'message';
      const data = JSON.parse(dataM[1]);
      if (type === 'meta') { state.meta = data; onMeta && onMeta(data); }
      else if (type === 'done') { state.done = data; }
      else if (type === 'error') throw new Error(data.message || '点评失败');
      else { state.full += data.d; onDelta && onDelta(state.full); }
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    feed(dec.decode(value, { stream: true }));
  }
  if (!state.meta) throw new Error('点评失败：无响应');
  return { ...state.meta, review: state.full, session_id: state.done && state.done.session_id };
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
  let n = uni.getStorageSync('pkNickname');
  if (!n) {
    n = '考友' + Math.random().toString(36).slice(2, 6).toUpperCase();
    uni.setStorageSync('pkNickname', n);
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
  return request('/api/pk/submit', { method: 'POST', data: { uid: anonUid(), code, items } });
}

export function pkMine() {
  return request(`/api/pk/mine?uid=${encodeURIComponent(anonUid())}`);
}

export function pkLeaderboard() {
  return request(`/api/pk/leaderboard?uid=${encodeURIComponent(anonUid())}`);
}
