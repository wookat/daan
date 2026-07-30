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
