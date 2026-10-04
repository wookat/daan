// 启动预取（SWR）：onLaunch fire-and-forget 把首屏慢接口写进 storage，
// 页面先读缓存秒渲染、再后台 revalidate。对齐 H5 prefetchPack 思路。
import { fetchQuestionCounts } from '../api/index';

export const PF_COUNTS_KEY = 'pf:question_counts';

export function prefetchBoot(): void {
  fetchQuestionCounts()
    .then((d) => {
      if (d && d.counts && d.counts.length) {
        wx.setStorageSync(PF_COUNTS_KEY, { counts: d.counts, ts: Date.now() });
      }
    })
    .catch(() => {});
}

export interface CountsCache {
  counts: { module: string; n: number }[];
  ts: number;
}

export function readCountsCache(maxAgeMs = 24 * 3600 * 1000): CountsCache | null {
  try {
    const c = wx.getStorageSync(PF_COUNTS_KEY) as CountsCache | '';
    if (!c || !Array.isArray(c.counts) || !c.counts.length) return null;
    if (Date.now() - (c.ts || 0) > maxAgeMs) return null;
    return c;
  } catch {
    return null;
  }
}
