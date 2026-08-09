import { shareAnswer, shareDetail, trackEvent } from '../../api/index';
import type { ShareAnswerRow, ShareDetailResp } from '../../api/types';

const SITE = 'https://kaogong.zalize.com';

Page({
  data: {
    sid: '',
    loading: true,
    errMsg: '',
    d: null as ShareDetailResp | null,
    optList: [] as Array<{ k: string; v: string }>,
    picked: '',
    myResult: null as { picked: string; correct: boolean } | null,
    answers: [] as ShareAnswerRow[],
    revealed: false,
    fromAv: '',
    submitting: false,
  },
  _startTs: 0,

  onLoad(query: Record<string, string>) {
    const sid = query && query.sid ? String(query.sid) : '';
    this.setData({ sid });
    trackEvent('share_open', 'share', sid || null);
    wx.setStorageSync('regSource', 'share');
    this.load();
  },

  async load() {
    const { sid } = this.data;
    if (!sid) {
      this.setData({ loading: false, errMsg: '分享链接无效' });
      return;
    }
    try {
      const d = await shareDetail(sid);
      const myResult = d.my_answer || null;
      this.setData({
        d,
        optList: Object.keys(d.question.options)
          .sort()
          .map((k) => ({ k, v: d.question.options[k] })),
        answers: d.answers || [],
        myResult,
        revealed: !!(d.is_sharer || d.answered || myResult),
        fromAv: (d.from_name || '?').slice(0, 1),
      });
      this._startTs = Date.now();
    } catch (e) {
      this.setData({ errMsg: (e as Error).message || '分享不存在或已过期' });
    }
    this.setData({ loading: false });
  },

  async onPick(e: WechatMiniprogram.TouchEvent) {
    const { revealed, submitting, sid, d } = this.data;
    if (revealed || submitting || !d) return;
    const k = String(e.currentTarget.dataset.key);
    this.setData({ picked: k, submitting: true });
    try {
      const secs = Math.round((Date.now() - this._startTs) / 1000);
      const r = await shareAnswer(sid, k, secs);
      this.setData({
        myResult: { picked: k, correct: r.correct },
        'd.question.answer': r.answer,
        'd.question.explanation': r.explanation,
        answers: r.answers || [],
        revealed: true,
      });
      trackEvent('share_answer', 'share', sid);
    } catch (err) {
      this.setData({ picked: '' });
      wx.showToast({ title: (err as Error).message || '提交失败', icon: 'none' });
    }
    this.setData({ submitting: false });
  },

  onSimilar() {
    const q = this.data.d && this.data.d.question;
    if (!q) return;
    let url = '/pages/practice/practice?count=10&source=share';
    if (q.module) url += '&module=' + q.module;
    if (q.submodule) url += '&submodule=' + encodeURIComponent(q.submodule);
    wx.navigateTo({ url });
  },

  onCopyLink() {
    wx.setClipboardData({
      data: `我在考公助手分享了一道题，敢来挑战吗？${SITE}/#/pkgA/share/share-q?sid=${this.data.sid}`,
      success: () => wx.showToast({ title: '分享链接已复制', icon: 'none' }),
    });
  },

  // 微信右上角转发：转发卡片直达本分享作答页
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const d = this.data.d;
    return {
      title: d ? `${d.from_name || '考友'}分享了一道题，敢来挑战吗？` : '来挑战一道题',
      path: `/pages/share/share?sid=${this.data.sid}`,
    };
  },
});
