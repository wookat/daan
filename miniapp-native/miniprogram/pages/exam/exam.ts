// 模考 tab：迷你模考入口 + 模考大赛/申论专区入口 + 真题卷库预览（前 20 卷，完整卷库与筛选在 pkgExam/list）
import { fetchExamPapers } from '../../api/exam';
import type { ExamPaper } from '../../api/exam-types';
import { syncTabBar } from '../../utils/tabbar';

type PaperVM = ExamPaper & { yearShort: string; regionShort: string; subText: string };

const PREVIEW_N = 20;

function toVM(p: ExamPaper): PaperVM {
  const y = String(p.year || '');
  const region = String(p.region || '');
  let regionShort = '真题';
  if (region.indexOf('国考') > -1 || region.indexOf('国家') > -1) regionShort = '国考';
  else if (region.indexOf('联考') > -1) regionShort = '联考';
  else if (region) regionShort = region.slice(0, 2);
  const parts: string[] = [];
  if (region) parts.push(region);
  if (p.n) parts.push(p.n + ' 题');
  if (p.duration_min) parts.push(p.duration_min + ' 分钟');
  return { ...p, yearShort: y.length === 4 ? y.slice(2) : y, regionShort, subText: parts.join(' · ') };
}

Page({
  data: {
    loading: true,
    loadErr: '',
    papers: [] as PaperVM[],
    total: 0,
  },
  onShow() {
    syncTabBar(this, 2);
    this.load();
  },
  onShareAppMessage() {
    return { title: '考公行测真题卷库 · 整卷全真模考', path: '/pages/exam/exam' };
  },
  async load() {
    this.setData({ loadErr: '' });
    try {
      const d = await fetchExamPapers();
      const items = d.items || [];
      this.setData({ papers: items.slice(0, PREVIEW_N).map(toVM), total: items.length });
    } catch (e) {
      this.setData({ loadErr: (e as Error).message || '网络错误' });
    } finally {
      this.setData({ loading: false });
    }
  },
  onRetry() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    this.load();
  },
  onPaperTap(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    wx.navigateTo({ url: '/pkgExam/list/list?pid=' + id });
  },
  onAllPapers() {
    wx.navigateTo({ url: '/pkgExam/list/list' });
  },
  onMini() {
    wx.navigateTo({ url: '/pkgExam/exam/exam?mini=1' });
  },
  onContest() {
    wx.navigateTo({ url: '/pkgExam/contest/contest' });
  },
  onShenlun() {
    wx.navigateTo({ url: '/pkgExam/shenlun/shenlun' });
  },
});
