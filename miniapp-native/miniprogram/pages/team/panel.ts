import { teamLeave, teamPanel } from '../../api/index';
import type { TeamMember, TeamPanelResp } from '../../api/types';

const SITE = 'https://kaogong.zalize.com';

interface WeekCell {
  cls: string;
  label: string;
}

interface MemberRow extends TeamMember {
  av: string;
  desc: string;
  cells: WeekCell[];
}

function fmtAgo(ts: number): string {
  const s = Date.now() / 1000 - ts;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} 分钟前活跃`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前活跃`;
  return `${Math.floor(s / 86400)} 天前活跃`;
}

function memDesc(m: TeamMember): string {
  const parts: string[] = [];
  parts.push(m.streak ? `连续打卡 ${m.streak} 天` : '打卡中断');
  if (m.today_n) parts.push(`今日正确率 ${m.today_acc}%`);
  else parts.push('今天还没刷题');
  if (m.last_active) parts.push(fmtAgo(m.last_active));
  return parts.join(' · ');
}

function cellCls(n: number, i: number, todayIdx: number): string {
  if (i > todayIdx) return 'future';
  if (!n) return i === todayIdx ? 'today-empty' : 'miss';
  return n >= 20 ? 'hot' : 'done';
}

Page({
  data: {
    loading: true,
    panel: null as TeamPanelResp | null,
    members: [] as MemberRow[],
    weekLabels: ['一', '二', '三', '四', '五', '六', '日'],
    todayIdx: 0,
  },
  _teamId: 0,

  onLoad(query: Record<string, string>) {
    this._teamId = Number(query.id) || 0;
    this.load();
  },

  async load() {
    if (!this._teamId) {
      wx.showToast({ title: '小队不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    const todayIdx = (new Date().getDay() + 6) % 7;
    try {
      const d = await teamPanel(this._teamId);
      const members: MemberRow[] = (d.members || []).map((m) => ({
        ...m,
        av: (m.nickname || '?').slice(0, 1),
        desc: memDesc(m),
        cells: (m.week || []).map((n, i) => ({
          cls: cellCls(n, i, todayIdx),
          label: n ? (n > 99 ? '99+' : String(n)) : '',
        })),
      }));
      this.setData({ loading: false, panel: d, members, todayIdx });
    } catch (e) {
      wx.showToast({ title: (e as Error).message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  inviteText(): string {
    const t = this.data.panel!.team;
    const url = `${SITE}/#/pages/team/join?code=${t.invite_code}`;
    return `我在考公助手建了刷题小队「${t.name}」，一起打卡刷题冲上岸！邀请码 ${t.invite_code}，点链接直接加入：${url}`;
  },

  onCopyInvite() {
    if (!this.data.panel) return;
    wx.setClipboardData({
      data: this.inviteText(),
      success: () => wx.showToast({ title: '邀请链接已复制，发给考友吧', icon: 'none' }),
    });
  },

  onRemind(e: WechatMiniprogram.TouchEvent) {
    const p = this.data.panel;
    if (!p) return;
    const m = this.data.members[Number(e.currentTarget.dataset.index)];
    if (!m) return;
    const url = `${SITE}/#/pages/team/join?code=${p.team.invite_code}`;
    wx.setClipboardData({
      data: `「${m.nickname}」今天还没刷题哦！我在考公助手小队「${p.team.name}」等你打卡，别掉队：${url}`,
      success: () => wx.showToast({ title: '催打卡文案已复制，发给 TA 吧', icon: 'none' }),
    });
  },

  onLeave() {
    wx.showModal({
      title: '退出小队',
      content: '退出后将不再显示在队友面板中，可凭邀请码重新加入。',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await teamLeave(this._teamId);
          wx.showToast({ title: '已退出小队', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 800);
        } catch (e) {
          wx.showToast({ title: (e as Error).message || '退出失败', icon: 'none' });
        }
      },
    });
  },

  // 微信右上角转发 / 邀请卡片：进入小队页自动填邀请码
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const t = this.data.panel && this.data.panel.team;
    if (!t) return { title: '一起来刷题打卡' };
    return {
      title: `邀你加入刷题小队「${t.name}」，一起打卡冲上岸！`,
      path: `/pages/team/team?code=${t.invite_code}`,
    };
  },
});
