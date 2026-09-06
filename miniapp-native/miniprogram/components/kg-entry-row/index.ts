// KgEntryRow：图标 + 标题 + 说明的可点入口卡（H5 stats.vue .km-entry / home.vue 入口卡的共享版），
// 首页/统计/我的页的 pkgGrow 入口统一用它，避免页面级重复样式。
Component({
  properties: {
    icon: { type: String, value: 'chevron-right' },
    tone: { type: String, value: 'brand' },
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    to: { type: String, value: '' },
    chevron: { type: Boolean, value: true },
  },
  methods: {
    onTap() {
      this.triggerEvent('click');
      if (this.data.to) wx.navigateTo({ url: this.data.to });
    },
  },
});
