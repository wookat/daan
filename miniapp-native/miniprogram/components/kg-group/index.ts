// KgGroup（v3 贴皮）：页面分区容器 = 灰字小标题 + 白底圆角组；组内放 kg-row，行间由 kg-row 画分隔线。
// 取代「卡当分区」：分区不带阴影/边框，一页最多 3 个 group。
Component({
  options: { multipleSlots: true },
  properties: {
    title: { type: String, value: '' },
    more: { type: String, value: '' },
    to: { type: String, value: '' },
    /** 组内是否有 padding（图表等非行内容用 true） */
    padded: { type: Boolean, value: false },
  },
  methods: {
    onMore() {
      this.triggerEvent('more');
      const url = this.data.to as string;
      if (url) wx.navigateTo({ url, fail: () => wx.switchTab({ url }) });
    },
  },
});
