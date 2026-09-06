// KgSheet 小程序版（对齐 H5 components/kg-sheet）：底部弹层壳（把手 + 标题 + 关闭 + 内容 slot），业务内容由页面/组件填充
Component({
  options: { multipleSlots: true },
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    maxHeight: { type: String, value: '76vh' },
  },
  methods: {
    onVisible(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
      if (!e.detail.visible) this.triggerEvent('close');
    },
    onClose() {
      this.triggerEvent('close');
    },
  },
});
