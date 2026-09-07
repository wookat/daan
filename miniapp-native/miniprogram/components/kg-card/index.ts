// KgCard 小程序版（COMPONENTS §1.4）：flat/raised/soft 三变体 + 可点/选中态；深色下 raised 不加阴影由 token 层处理（--sh-* 在深色为 none）。
Component({
  options: { multipleSlots: true },
  externalClasses: ['body-class'],
  properties: {
    variant: { type: String, value: 'flat' },
    clickable: { type: Boolean, value: false },
    selected: { type: Boolean, value: false },
    chevron: { type: Boolean, value: false },
    padding: { type: Number, value: 16 },
    header: { type: Boolean, value: false },
    footer: { type: Boolean, value: false },
  },
  methods: {
    onTap() {
      if (this.data.clickable) this.triggerEvent('click');
    },
  },
});
