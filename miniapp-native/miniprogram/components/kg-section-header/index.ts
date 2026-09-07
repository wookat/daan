// KgSectionHeader 小程序版（COMPONENTS §1.12）：区块标题 + 「查看全部」（44px 热区）。
Component({
  properties: {
    title: { type: String, value: '' },
    more: { type: String, value: '' },
    to: { type: String, value: '' },
  },
  methods: {
    onMore() {
      this.triggerEvent('more');
      const url = this.data.to as string;
      if (url) wx.navigateTo({ url, fail: () => wx.switchTab({ url }) });
    },
  },
});
