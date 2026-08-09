import {
  deleteOwnComment,
  fetchComments,
  fetchQuestionBrief,
  likeComment,
  postComment,
} from '../../api/p3';
import type { CommentItem, QuestionBrief } from '../../api/p3';
import { getToken } from '../../utils/auth';
import { fmtAgo } from '../../utils/text';

interface CRow extends CommentItem {
  timeText: string;
  replies: CRow[];
}

function decorate(c: CommentItem): CRow {
  return {
    ...c,
    timeText: fmtAgo(c.created_at),
    replies: (c.replies || []).map(decorate),
  };
}

Page({
  data: {
    qid: 0,
    q: null as QuestionBrief | null,
    sort: 'hot' as 'hot' | 'new',
    loading: true,
    items: [] as CRow[],
    total: 0,
    input: '',
    replyTo: null as { id: number; nickname: string } | null,
    posting: false,
  },

  onLoad(query: Record<string, string>) {
    const qid = Number(query.qid) || 0;
    this.setData({ qid });
    if (!qid) {
      wx.showToast({ title: '缺少题目参数', icon: 'none' });
      return;
    }
    this.loadQuestion();
    this.load();
  },

  async loadQuestion() {
    try {
      const d = await fetchQuestionBrief(this.data.qid);
      this.setData({ q: d.item });
    } catch (e) {
      /* 摘要卡非关键 */
    }
  },
  async load() {
    this.setData({ loading: true });
    try {
      const d = await fetchComments(this.data.qid, this.data.sort);
      this.setData({ items: (d.items || []).map(decorate), total: d.total || 0 });
    } catch (e) {
      wx.showToast({ title: (e as Error).message, icon: 'none' });
    }
    this.setData({ loading: false });
  },
  onSort(e: WechatMiniprogram.TouchEvent) {
    const s = e.currentTarget.dataset.s as 'hot' | 'new';
    if (s === this.data.sort) return;
    this.setData({ sort: s });
    this.load();
  },

  ensureLogin(): boolean {
    if (getToken()) return true;
    wx.showModal({
      title: '需要登录',
      content: '发言、点赞需要登录账号，游客可正常浏览讨论',
      confirmText: '去登录',
      success: (r) => {
        if (r.confirm) wx.navigateTo({ url: '/pages/login/login' });
      },
    });
    return false;
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ input: e.detail.value });
  },
  onReply(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const nickname = String(e.currentTarget.dataset.nick || '');
    if (!this.ensureLogin()) return;
    this.setData({ replyTo: { id, nickname } });
  },
  onCancelReply() {
    this.setData({ replyTo: null });
  },
  async onPost() {
    const content = this.data.input.trim();
    if (!content || this.data.posting) return;
    if (!this.ensureLogin()) return;
    this.setData({ posting: true });
    try {
      await postComment(this.data.qid, content, this.data.replyTo && this.data.replyTo.id);
      this.setData({ input: '', replyTo: null });
      await this.load();
    } catch (e) {
      wx.showToast({ title: '发布失败：' + (e as Error).message, icon: 'none' });
    }
    this.setData({ posting: false });
  },

  async onLike(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (!this.ensureLogin()) return;
    try {
      await likeComment(id);
      await this.load();
    } catch (err) {
      wx.showToast({ title: (err as Error).message, icon: 'none' });
    }
  },
  onDelete(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    wx.showModal({
      title: '删除这条评论？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await deleteOwnComment(id);
          await this.load();
        } catch (err) {
          wx.showToast({ title: (err as Error).message, icon: 'none' });
        }
      },
    });
  },
});
