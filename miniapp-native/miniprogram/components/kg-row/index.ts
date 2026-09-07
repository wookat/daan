// KgRow（v3 贴皮）：组内一行。左：可选单色线性图标；中：标题 + 副文；右：值文字 / slot / 箭头。
// 高 52（单行）/ 64（双行），分隔线从文字起点开始（iOS inset）。所有入口/记录/设置项统一用它。
Component({
  options: { multipleSlots: true },
  properties: {
    icon: { type: String, value: '' },
    tone: { type: String, value: 'ink-2' },
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    value: { type: String, value: '' },
    /** value 文字色：muted(默认灰) / brand / ok / bad / warn */
    valueTone: { type: String, value: 'muted' },
    chevron: { type: Boolean, value: true },
    to: { type: String, value: '' },
    /** 是否为组内最后一行（不画分隔线）；组内用 wx:for 时可传 index === len-1 */
    last: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
  },
  methods: {
    onTap() {
      if (this.data.disabled) return;
      this.triggerEvent('click');
      const url = this.data.to as string;
      if (url) wx.navigateTo({ url, fail: () => wx.switchTab({ url }) });
    },
  },
});
