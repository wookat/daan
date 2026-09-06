// KgSheet 小程序版（对应 H5 components/kg-sheet.vue）：底部抽屉 = t-popup + 拖柄 + 标题/关闭 + 可滚 body + footer 插槽。
// 用法：<kg-sheet visible="{{open}}" title="练习工具" bind:close="onClose">…<view slot="footer">…</view></kg-sheet>
Component({
  options: { multipleSlots: true },
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    closable: { type: Boolean, value: true },
  },
  methods: {
    onVisibleChange(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
      if (!e.detail.visible) this.triggerEvent('close');
    },
    onClose() {
      this.triggerEvent('close');
    },
  },
});
