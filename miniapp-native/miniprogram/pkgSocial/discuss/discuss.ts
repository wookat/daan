// 题目讨论区（对齐 frontend-uni/src/pkgA/social/discuss.vue）：按 qid 拉评论，最热/最新，发帖/回复/点赞/删除/举报，
// 草稿本机持久化（dcDraft:<qid>），发言门禁与 H5 同款弹窗。
import {
  deleteOwnComment,
  fetchCommentInbox,
  fetchComments,
  fetchQuestion,
  likeComment,
  postComment,
  reportComment,
} from '../../api/social';
import type { CommentItem, QuestionBrief } from '../../api/social';
import { MODULES, moduleLabel } from '../../utils/module-meta';
import { avatarTone, ensureLogin, fmtRelTime, isLogged, REPORT_REASONS } from '../../utils/social-fmt';
import { toastInfo } from '../../utils/toast';

interface CmView extends CommentItem {
  av: string;
  avTone: string;
  tm: string;
  replies: CmView[];
}

type Sort = 'hot' | 'new';

function toView(c: CommentItem): CmView {
  return {
    ...c,
    av: (c.nickname || '?').slice(0, 1),
    avTone: avatarTone(c.nickname || ''),
    tm: fmtRelTime(c.created_at),
    replies: (c.replies || []).map(toView),
  };
}

Page({
  data: {
    qid: 0,
    noQid: false,
    q: null as QuestionBrief | null,
    qMod: '',
    qReal: '',
    qRatio: '',
    items: [] as CmView[],
    total: 0,
    sort: 'hot' as Sort,
    sortOpts: [
      { label: '最热', value: 'hot' },
      { label: '最新', value: 'new' },
    ],
    loading: true,
    loadErr: '',
    draft: '',
    busy: false,
    replyTo: null as { id: number; nickname: string } | null,
    logged: false,
    autoFocus: false,
    inboxUnread: 0,
  },

  onLoad(opts: Record<string, string>) {
    const qid = Number(opts.qid || 0);
    if (!qid) {
      this.setData({ noQid: true, loading: false });
      return;
    }
    this.setData({ qid, draft: (wx.getStorageSync('dcDraft:' + qid) as string) || '', logged: isLogged() });
    if (opts.focus === '1' && isLogged()) setTimeout(() => this.setData({ autoFocus: true }), 300);
    this.loadQuestion();
    this.load();
  },

  onShow() {
    const l = isLogged();
    if (l !== this.data.logged) {
      this.setData({ logged: l });
      if (this.data.qid) this.load();
    }
    this.loadInbox();
  },

  async loadQuestion() {
    try {
      const d = await fetchQuestion(this.data.qid);
      const q = d.item;
      const mod = q.module || '';
      this.setData({
        q,
        qMod: MODULES[mod] ? moduleLabel(mod) : mod,
        qReal: q.is_real ? [q.exam_year, q.exam_region, '真题'].filter(Boolean).join(' ') : '',
        qRatio: (q.attempt_count || 0) >= 5 && q.correct_ratio != null ? `正确率 ${q.correct_ratio}%` : '',
      });
    } catch (e) {
      /* 摘要卡非关键 */
    }
  },

  async load() {
    this.setData({ loading: true, loadErr: '' });
    try {
      const d = await fetchComments(this.data.qid, this.data.sort);
      this.setData({ items: d.items.map(toView), total: d.total });
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ loadErr: msg });
      toastInfo(msg);
    }
    this.setData({ loading: false });
  },

  async loadInbox() {
    if (!this.data.logged) {
      this.setData({ inboxUnread: 0 });
      return;
    }
    try {
      const d = await fetchCommentInbox();
      this.setData({ inboxUnread: d.unread || 0 });
    } catch (e) {
      /* 非关键路径 */
    }
  },

  goPlaza() {
    wx.redirectTo({ url: '/pkgSocial/plaza/plaza' });
  },
  goInbox() {
    if (!ensureLogin()) return;
    wx.navigateTo({ url: '/pkgSocial/inbox/inbox' });
  },

  onSort(e: WechatMiniprogram.CustomEvent<{ value: Sort }>) {
    if (e.detail.value === this.data.sort) return;
    this.setData({ sort: e.detail.value });
    this.load();
  },

  onDraft(e: WechatMiniprogram.TextareaInput) {
    const v = e.detail.value;
    this.setData({ draft: v });
    const k = 'dcDraft:' + this.data.qid;
    if (v) wx.setStorageSync(k, v);
    else wx.removeStorageSync(k);
  },
  onFocus() {
    ensureLogin();
  },
  cancelReply() {
    this.setData({ replyTo: null });
  },

  findTop(id: number): CmView | undefined {
    return this.data.items.find((c) => c.id === id);
  },
  target(e: WechatMiniprogram.BaseEvent): { c: CmView | null; top: CmView | null } {
    const top = this.findTop(Number(e.currentTarget.dataset.top)) || null;
    const rid = Number(e.currentTarget.dataset.id || 0);
    if (!top) return { c: null, top: null };
    if (!rid || rid === top.id) return { c: top, top: null };
    return { c: top.replies.find((r) => r.id === rid) || null, top };
  },

  onReply(e: WechatMiniprogram.BaseEvent) {
    if (!ensureLogin()) return;
    const { c, top } = this.target(e);
    if (!c) return;
    this.setData({ replyTo: { id: (top || c).id, nickname: c.nickname } });
  },

  async submit() {
    const content = this.data.draft.trim();
    if (!content || this.data.busy) return;
    if (!ensureLogin()) return;
    this.setData({ busy: true });
    try {
      const d = await postComment(this.data.qid, content, this.data.replyTo && this.data.replyTo.id);
      wx.removeStorageSync('dcDraft:' + this.data.qid);
      const items = this.data.items;
      if (this.data.replyTo) {
        const top = items.find((c) => c.id === d.item.parent_id);
        if (top) top.replies.push(toView(d.item));
      } else {
        items.unshift(toView({ ...d.item, replies: [] }));
      }
      this.setData({ items, total: this.data.total + 1, draft: '', replyTo: null });
      toastInfo('已发布');
    } catch (e) {
      toastInfo((e as Error).message);
    }
    this.setData({ busy: false });
  },

  async onLike(e: WechatMiniprogram.BaseEvent) {
    if (!ensureLogin()) return;
    const { c } = this.target(e);
    if (!c) return;
    try {
      const d = await likeComment(c.id);
      c.liked = d.liked;
      c.likes = d.likes;
      this.setData({ items: this.data.items });
    } catch (err) {
      toastInfo((err as Error).message);
    }
  },

  dropItem(c: CmView, top: CmView | null) {
    let items = this.data.items;
    if (top) top.replies = top.replies.filter((x) => x.id !== c.id);
    else items = items.filter((x) => x.id !== c.id);
    this.setData({ items, total: Math.max(0, this.data.total - 1) });
  },

  onReport(e: WechatMiniprogram.BaseEvent) {
    if (!ensureLogin()) return;
    const { c, top } = this.target(e);
    if (!c) return;
    wx.showActionSheet({
      itemList: REPORT_REASONS,
      success: async ({ tapIndex }) => {
        try {
          const d = await reportComment(c.id, REPORT_REASONS[tapIndex]);
          if (d.hidden) this.dropItem(c, top);
          toastInfo(d.already ? '你已举报过这条评论' : '已收到举报，我们会尽快处理');
        } catch (err) {
          toastInfo((err as Error).message);
        }
      },
    });
  },

  onRemove(e: WechatMiniprogram.BaseEvent) {
    const { c, top } = this.target(e);
    if (!c) return;
    wx.showModal({
      title: '删除这条讨论？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await deleteOwnComment(c.id);
          this.dropItem(c, top);
        } catch (err) {
          toastInfo((err as Error).message);
        }
      },
    });
  },
});
