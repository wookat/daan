// 讨论消息（对齐 frontend-uni/src/pkgA/social/inbox.vue）：回复/点赞提醒，进入即标已读，点击回到对应题目讨论
import { fetchCommentInbox, readCommentInbox } from '../../api/social';
import type { InboxItem } from '../../api/social';
import { isLogged } from '../../utils/social-fmt';
import { toastInfo } from '../../utils/toast';

interface InboxRow extends InboxItem {
  key: string;
  av: string;
  time: string;
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

Page({
  data: {
    items: [] as InboxRow[],
    unreadCount: 0,
    loaded: false,
    logged: false,
    loadErr: '',
  },

  onShow() {
    const logged = isLogged();
    this.setData({ logged });
    if (logged) this.load();
    else this.setData({ loaded: true });
  },

  async load() {
    this.setData({ loadErr: '' });
    try {
      const d = await fetchCommentInbox();
      const items = (d.items || []).map((it, i) => ({
        ...it,
        key: `${it.type}-${it.id}-${i}`,
        av: (it.nickname || '?').slice(0, 1),
        time: fmtTime(it.created_at),
      }));
      this.setData({ items, unreadCount: items.filter((x) => x.unread).length });
      if (d.unread) readCommentInbox().catch(() => {});
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ loadErr: msg });
      toastInfo(msg);
    }
    this.setData({ loaded: true });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },
  openDiscuss(e: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: '/pkgSocial/discuss/discuss?qid=' + e.currentTarget.dataset.qid });
  },
});
