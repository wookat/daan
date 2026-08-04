// Capacitor 原生桥：H5 构建产物跑在 Android App（Capacitor WebView）里时，
// 用官方插件接管相机/相册与 PDF 落盘打开；普通浏览器里 isNativeApp() 恒为 false。
// #ifdef H5
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

// 拍照 / 相册选图，返回与 <input type=file> 等价的 { path, file }
export async function pickImageNative() {
  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt,
    promptLabelHeader: '选择图片',
    promptLabelPhoto: '从相册选择',
    promptLabelPicture: '拍照',
  });
  const resp = await fetch(photo.webPath);
  const blob = await resp.blob();
  const file = new File([blob], `photo.${photo.format || 'jpg'}`, {
    type: blob.type || 'image/jpeg',
  });
  return { path: photo.webPath, file };
}

// PDF Blob → 应用缓存目录 → 系统查看器
export async function savePdfNative(blob, name) {
  const base64 = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = () => reject(new Error('读取 PDF 失败'));
    fr.readAsDataURL(blob);
  });
  const res = await Filesystem.writeFile({
    path: name,
    data: base64,
    directory: Directory.Cache,
  });
  await FileOpener.open({ filePath: res.uri, contentType: 'application/pdf' });
}
// #endif

// #ifndef H5
export function isNativeApp() {
  return false;
}
export async function pickImageNative() {
  throw new Error('not supported');
}
export async function savePdfNative() {
  throw new Error('not supported');
}
// #endif
