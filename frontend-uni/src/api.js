// API 封装：H5 同源；小程序需改为线上域名
export const BASE_URL = import.meta.env.VITE_API_BASE || '';

function getCode() {
  return uni.getStorageSync('accessCode') || '';
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

function rawRequest(path, { method = 'GET', data, header = {} } = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + path,
      method,
      data,
      header: { 'X-Access-Code': getCode(), ...header },
      timeout: 180000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(new Error((res.data && res.data.detail) || `HTTP ${res.statusCode}`));
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
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (body.title || '试卷') + '.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

// H5 流式讲解：onMeta(meta) 一次，onDelta(fullText) 增量；返回完整讲解文本。
// 仅 H5 可用（fetch 流）；小程序端调用方应回退到 uploadExplain。
export async function streamExplain({ file, text, userAnswer, onMeta, onDelta }) {
  const doIt = async () => {
    const fd = new FormData();
    if (file) fd.append('image', file);
    if (text) fd.append('text', text);
    if (userAnswer) fd.append('user_answer', userAnswer);
    const resp = await fetch(BASE_URL + '/api/explain/stream', {
      method: 'POST',
      headers: { 'X-Access-Code': getCode() },
      body: fd,
    });
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try { detail = (await resp.json()).detail || detail; } catch (e) { /* ignore */ }
      throw new Error(detail);
    }
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let full = '';
    let meta = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const events = buf.split('\n\n');
      buf = events.pop();
      for (const ev of events) {
        const typeM = ev.match(/^event: (\w+)/m);
        const dataM = ev.match(/^data: (.*)$/m);
        if (!dataM) continue;
        const type = typeM ? typeM[1] : 'message';
        const data = JSON.parse(dataM[1]);
        if (type === 'meta') { meta = data; onMeta && onMeta(data); }
        else if (type === 'error') throw new Error(data.message || '生成失败');
        else if (type === 'message') { full += data.d; onDelta && onDelta(full); }
      }
    }
    if (!meta) throw new Error('生成失败：无响应');
    return { ...meta, explanation: full };
  };
  return withAuthRetry(doIt);
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
          header: { 'X-Access-Code': getCode() },
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
