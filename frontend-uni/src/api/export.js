// 试卷 PDF 导出：mp/app 写文件预览，H5 触发浏览器下载（含 Capacitor 原生壳保存）
import { BASE_URL, getAccessCode, authHeader } from './client';
import { fetchNet } from './net';
import { isNativeApp, savePdfNative } from '../native';
import { netFailMessage } from '../api-policy';

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
      header: { 'Content-Type': 'application/json', 'X-Access-Code': getAccessCode(), ...authHeader() },
      responseType: 'arraybuffer',
      timeout: 120000,
      success: resolve,
      fail: (err) => reject(new Error(netFailMessage(err && err.errMsg))),
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
  const resp = await fetchNet(BASE_URL + '/api/export/pdf', {
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

