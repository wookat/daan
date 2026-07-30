// API 封装：H5 同源；小程序需改为线上域名
export const BASE_URL = import.meta.env.VITE_API_BASE || '';

export function request(path, { method = 'GET', data } = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + path,
      method,
      data,
      timeout: 180000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(new Error((res.data && res.data.detail) || `HTTP ${res.statusCode}`));
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    });
  });
}

export function uploadExplain({ filePath, text, userAnswer }) {
  return new Promise((resolve, reject) => {
    const formData = {};
    if (text) formData.text = text;
    if (userAnswer) formData.user_answer = userAnswer;
    if (filePath) {
      uni.uploadFile({
        url: BASE_URL + '/api/explain',
        filePath,
        name: 'image',
        formData,
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
      uni.request({
        url: BASE_URL + '/api/explain',
        method: 'POST',
        header: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: formData,
        timeout: 180000,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
          else reject(new Error((res.data && res.data.detail) || `HTTP ${res.statusCode}`));
        },
        fail: (err) => reject(new Error(err.errMsg || '网络错误')),
      });
    }
  });
}
