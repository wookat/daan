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
}

// 刷题页 / 搜索 / 历史 → pkgSocial/ask：与 H5 practice.deepExplain 同存储契约（redoQuestion/redoQid/redoAnswer），
// ask 页 onShow 读取后自动填入。题干先落 storage 再跳转（可能超过 URL 长度）。
export function openExplain(h: ExplainHandoff): void {
  if (!h.text) return;
  wx.setStorageSync('redoQuestion', h.text);
  if (h.qid) wx.setStorageSync('redoQid', h.qid);
  else wx.removeStorageSync('redoQid');
  if (/^[A-D]$/.test(h.answer)) wx.setStorageSync('redoAnswer', h.answer);
  else wx.removeStorageSync('redoAnswer');
  wx.navigateTo({ url: '/pkgSocial/ask/ask' });
}
