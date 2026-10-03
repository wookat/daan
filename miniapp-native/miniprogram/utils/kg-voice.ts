// 语音输入：微信同声传译插件（WechatSI）封装。
// 插件需在小程序管理后台「设置-第三方设置-插件管理」添加后才能用；
// 未开通/低版本时所有入口静默降级为不可用（siUsable()=false）。
/* eslint-disable @typescript-eslint/no-explicit-any */

declare const requirePlugin: (name: string) => any;

interface SIManager {
  start(opts: { lang?: string; duration?: number }): void;
  stop(): void;
  onStart(cb: (res: { result: string }) => void): void;
  onRecognize(cb: (res: { result: string }) => void): void;
  onStop(cb: (res: { result: string; tempFilePath?: string; duration?: number }) => void): void;
  onError(cb: (res: { retcode?: number; msg?: string }) => void): void;
}

let _si: SIManager | null | undefined;

export function siManager(): SIManager | null {
  if (_si !== undefined) return _si;
  try {
    _si = requirePlugin('WechatSI').getRecordRecognitionManager() as SIManager;
  } catch (_e) {
    _si = null;
  }
  return _si;
}

export function siUsable(): boolean {
  return !!siManager();
}

export interface VoiceHandlers {
  onRecognize?: (text: string) => void; // 边说边识别（部分机型支持）
  onStop: (text: string) => void;
  onError: (msg: string) => void;
}

// start 后插件 30s 内自动 stop；stop() 提前结束并触发 onStop(finalText)
export function voiceStart(h: VoiceHandlers, lang = 'zh_CN'): boolean {
  const m = siManager();
  if (!m) return false;
  m.onStart(() => {});
  m.onRecognize((res: { result: string }) => {
    if (h.onRecognize && res && res.result) h.onRecognize(res.result);
  });
  m.onStop((res: { result: string }) => {
    h.onStop((res && res.result) || '');
  });
  m.onError((res: { msg?: string }) => {
    h.onError((res && res.msg) || '语音识别失败');
  });
  try {
    m.start({ lang, duration: 30000 });
    return true;
  } catch (_e) {
    return false;
  }
}

export function voiceStop(): void {
  const m = siManager();
  if (m) {
    try {
      m.stop();
    } catch (_e) {
      /* 插件 stop 失败静默 */
    }
  }
}
