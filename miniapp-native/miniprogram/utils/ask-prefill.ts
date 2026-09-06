// AI 讲解入口文本拼装（与 frontend-uni/src/ask-prefill.js 同口径）：题干 + "A.xx B.xx" 一行选项
export function askPrefill(stem: string | null | undefined, options: Record<string, string> | null | undefined): string {
  const s = typeof stem === 'string' ? stem.trim() : '';
  if (!s) return '';
  let opt = '';
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    opt = Object.keys(options)
      .sort()
      .filter((k) => typeof options[k] === 'string' && options[k].trim())
      .map((k) => `${k}.${options[k]}`)
      .join(' ');
  }
  return opt ? s + '\n' + opt : s;
}

export interface ExplainHandoff {
  text: string;
  qid: number | null;
  /** 用户作答字母（/api/explain user_answer），未作答传 '' */
  answer: string;
  qtype: string | null;
}
export const EXPLAIN_HANDOFF_KEY = 'explainPrefill';

// 刷题页 / 错题本 / 历史 → pkgLearn/explain：先落 storage 再跳转（题干可能超过 URL 长度）
export function openExplain(h: ExplainHandoff): void {
  if (!h.text) return;
  wx.setStorageSync(EXPLAIN_HANDOFF_KEY, h);
  wx.navigateTo({ url: '/pkgLearn/explain/explain' + (h.qid ? '?qid=' + h.qid : '') });
}
