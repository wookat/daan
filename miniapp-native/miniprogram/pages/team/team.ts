import { teamCreate, teamJoin, teamMine, trackEvent } from '../../api/index';
import type { TeamInfo } from '../../api/types';

Page({
  data: {
    loading: true,
    teams: [] as TeamInfo[],
    joinCode: '',
    showCreate: false,
    newName: '',
    creating: false,
  },

  onLoad(query: Record<string, string>) {
    const code = (query.code || '').trim().toUpperCase();
    if (code) {
      trackEvent('team_join_open', 'team', code);
      wx.setStorageSync('regSource', 'team');
      this.setData({ joinCode: code });
    }
    this.load();
  },
  onShow() {
    if (!this.data.loading) this.load();
  },

  async load() {
    try {
      const d = await teamMine();
      this.setData({ teams: d.items || [] });
    } catch (e) {
      /* 非关键路径 */
    }
    this.setData({ loading: false });
  },

  onOpenPanel(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    wx.navigateTo({ url: '/pages/team/panel?id=' + id });
  },

  onShowCreate() {
    this.setData({ showCreate: true, newName: '' });
  },
  onHideCreate() {
    this.setData({ showCreate: false });
  },
  onCreateVisible(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    if (!e.detail.visible) this.onHideCreate();
  },
  onNameInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ newName: e.detail.value });
  },
  onCodeInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ joinCode: e.detail.value });
  },

  async onCreate() {
    const name = (this.data.newName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入小队名', icon: 'none' });
      return;
    }
    if (this.data.creating) return;
    this.setData({ creating: true });
    try {
      const d = await teamCreate(name);
      this.setData({ showCreate: false, newName: '' });
      wx.showToast({ title: '小队已创建', icon: 'none' });
      wx.navigateTo({ url: '/pages/team/panel?id=' + d.team.id });
    } catch (e) {
      wx.showToast({ title: (e as Error).message || '创建失败', icon: 'none' });
    }
    this.setData({ creating: false });
  },

  async onJoin() {
    const code = (this.data.joinCode || '').trim().toUpperCase();
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '加入中…' });
      const d = await teamJoin(code);
      wx.hideLoading();
      wx.showToast({ title: d.already ? '你已在该小队' : '加入成功！', icon: 'none' });
      this.setData({ joinCode: '' });
      wx.navigateTo({ url: '/pages/team/panel?id=' + d.team.id });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: (e as Error).message || '加入失败', icon: 'none' });
    }
  },
});
