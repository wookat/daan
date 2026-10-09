// AI 端点：拍题讲解（流式/上传）/ 答题卡扫描 / AI 面试陪练
import { BASE_URL, request, rawRequest, anonUid, getAccessCode, authHeader, withAuthRetry } from './client';
import { fetchNet, readNet, feedSse, makeUtf8Decoder } from './net';
import { netFailMessage } from '../api-policy';

// #ifdef H5
// H5 流式讲解：onMeta(meta) 一次，onDelta(fullText) 增量；返回完整讲解文本。
export async function streamExplain({ file, text, userAnswer, questionId, onMeta, onDelta, onThinking }) {
  const doIt = async () => {
    const fd = new FormData();
    if (file) fd.append('image', file);
    if (text) fd.append('text', text);
    if (userAnswer) fd.append('user_answer', userAnswer);
    if (questionId > 0) fd.append('question_id', String(questionId));
    const resp = await fetchNet(BASE_URL + '/api/explain/stream', {
      method: 'POST',
      headers: { 'X-Access-Code': getAccessCode(), ...authHeader() },
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
      const { done, value } = await readNet(reader);
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
    'X-Access-Code': getAccessCode(),
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
        fail: (err) => reject(new Error(netFailMessage(err && err.errMsg))),
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
      fail: (err) => reject(new Error(netFailMessage(err && err.errMsg, '上传失败，请检查网络后重试'))),
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
          header: { 'X-Access-Code': getAccessCode(), ...authHeader() },
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
          fail: (err) => reject(new Error(netFailMessage(err && err.errMsg, '上传失败，请检查网络后重试'))),
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
// H5 流式点评：onMeta({scores,total,summary}) 一次，onThinking({secs,chars}) 推理中逐秒，onDelta(fullText) 增量，onDone({session_id})。
export async function streamInterview({ questionId, answer, durationSec, onMeta, onDelta, onThinking }) {
  const resp = await fetchNet(BASE_URL + '/api/interview/answer/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Code': getAccessCode(), ...authHeader() },
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
    const { done, value } = await readNet(reader);
    if (done) break;
    feedSse(dec.decode(value, { stream: true }), state, onMeta, onDelta, onThinking);
  }
  if (!state.meta) throw new Error('点评失败：无响应');
  return { ...state.meta, review: state.full, session_id: state.done && state.done.session_id };
}

// H5 中断 session 重新生成点评：onThinking({secs,chars}) 推理中，onDelta(fullText) 增量，完成返回 { review }。
export async function streamInterviewReviewRegen({ sessionId, onDelta, onThinking }) {
  const resp = await fetchNet(BASE_URL + '/api/interview/sessions/' + sessionId + '/review/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Code': getAccessCode(), ...authHeader() },
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
    const { done, value } = await readNet(reader);
    if (done) break;
    feedSse(dec.decode(value, { stream: true }), state, null, onDelta, onThinking);
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
