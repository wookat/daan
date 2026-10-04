import { shareAnswer, shareDetail, teamJoin, trackEvent } from '../../api/index';
import type { QStats, ShareAnswerRow, ShareDetailResp, TeamInvite } from '../../api/types';
import { getToken } from '../../utils/auth';
import { modName } from '../../utils/stats';

const SITE = 'https://kaogong.zalize.com';

function beatText(s: QStats | null, myResult: { correct: boolean } | null): string {
  if (!s || !s.total || !myResult) return '';
  if (s.total < 5) return `🎯 全站第 ${s.total} 个作答本题的人，把题发给更多考友一起比比`;
  if (myResult.correct && s.beat_pct != null)
    return `🏆 你击败了全站 ${s.beat_pct}% 的作答者（共 ${s.total} 人做过这题）`;
  if (s.acc != null) return `全站共 ${s.total} 人做过这题，正确率 ${s.acc}%，再战同类题赢回来`;
  return '';
}

Page({
  data: {
    sid: '',
    loading: true,
    errMsg: '',
    d: null as ShareDetailResp | null,
    modLabel: '',
    optList: [] as Array<{ k: string; v: string }>,
    picked: '',
    myResult: null as { picked: string; correct: boolean } | null,
    answers: [] as ShareAnswerRow[],
    revealed: false,
    fromAv: '',
    submitting: false,
    beatText: '',
    teamInvite: null as TeamInvite | null,
    teamJoined: false,
    joining: false,
    logged: false,
  },
  _startTs: 0,
  _qStats: null as QStats | null,
  _joinedTeamId: 0,

  onLoad(query: Record<string, string>) {
    const sid = query && query.sid ? String(query.sid) : '';
    this.setData({ sid, logged: !!getToken() });
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
      this._qStats = d.q_stats || null;
      this.setData({
        d,
        modLabel: modName(d.question.module || ''),
        optList: Object.keys(d.question.options)
          .sort()
          .map((k) => ({ k, v: d.question.options[k] })),
        answers: d.answers || [],
        myResult,
        revealed: !!(d.is_sharer || d.answered || myResult),
        fromAv: (d.from_name || '?').slice(0, 1),
        beatText: beatText(this._qStats, myResult),
        teamInvite: d.team_invite || null,
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
      const myResult = { picked: k, correct: r.correct };
      if (r.q_stats) this._qStats = r.q_stats;
      this.setData({
        myResult,
        'd.question.answer': r.answer,
        'd.question.explanation': r.explanation,
        answers: r.answers || [],
        revealed: true,
        beatText: beatText(this._qStats, myResult),
        teamInvite: r.team_invite || this.data.teamInvite,
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

  // 一键加入分享者的刷题小队
  async onJoinTeam() {
    const { teamInvite, joining, sid } = this.data;
    if (!teamInvite || joining) return;
    this.setData({ joining: true });
    try {
      const d = await teamJoin(teamInvite.code);
      this._joinedTeamId = d.team.id;
      this.setData({ teamJoined: true });
      trackEvent('share_team_join', 'share_q', sid);
      wx.showToast({ title: d.already ? '你已在该小队' : '加入成功！', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: (e as Error).message || '加入失败', icon: 'none' });
    }
    this.setData({ joining: false });
  },

  onGoTeam() {
    wx.navigateTo({ url: '/pages/team/panel?id=' + this._joinedTeamId });
  },

  onLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },
  onCopyLink() {
    const q = this.data.d && this.data.d.question;
    const mod = (q && (q.submodule || modName(q.module || ''))) || '行测';
    trackEvent('share_copy', 'share_q', this.data.sid);
    wx.setClipboardData({
      data: `【${mod}】我刚在岸上见做了一道题，你能做对吗？答完就能看到大家选了啥：${SITE}/s/${this.data.sid}`,
      success: () => wx.showToast({ title: '分享链接已复制', icon: 'none' }),
    });
  },

  // 微信右上角转发：转发卡片直达本分享作答页
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const d = this.data.d;
    const mod = d ? d.question.submodule || modName(d.question.module || '') : '';
    return {
      title: d
        ? `${d.from_name || '考友'}考了你一道${mod}题，你能做对吗？`
        : '来挑战一道题',
      path: `/pages/share/share?sid=${this.data.sid}`,
    };
  },
});
