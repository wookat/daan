// KgEmpty 小程序版（COMPONENTS §1.8）：不用 t-empty 的远程插图，Lucide 图标圆底 + 标题/说明 + CTA(lg) / compact 行内态。
Component({
  properties: {
    icon: { type: String, value: 'inbox' },
    title: { type: String, value: '暂无内容' },
    desc: { type: String, value: '' },
    ctaText: { type: String, value: '' },
    ctaTo: { type: String, value: '' },
    secondaryText: { type: String, value: '' },
    compact: { type: Boolean, value: false },
  },
  methods: {
    onCta() {
      this.triggerEvent('cta');
      const url = this.data.ctaTo as string;
      if (url) wx.navigateTo({ url, fail: () => wx.switchTab({ url }) });
    },
    onSecondary() {
      this.triggerEvent('secondary');
    },
  },
});
