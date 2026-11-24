// KgSheet 小程序版（对应 H5 components/kg-sheet.vue）：底部抽屉 = t-popup + 拖柄 + 标题/关闭 + 可滚 body + footer 插槽。
// 用法：<kg-sheet visible="{{open}}" title="练习工具" bind:close="onClose">…<view slot="footer">…</view></kg-sheet>
const dragStarts = new WeakMap<object, number>();

Component({
  options: { multipleSlots: true },
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    closable: { type: Boolean, value: true },
  },
  data: {
    sheetDragY: 0,
    sheetDragging: false,
  },
  observers: {
    visible(v: boolean) {
      if (!v) this.setData({ sheetDragY: 0, sheetDragging: false });
    },
  },
  methods: {
    onVisibleChange(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
      if (!e.detail.visible) {
        this.setData({ sheetDragY: 0, sheetDragging: false });
        this.triggerEvent('close');
      }
    },
    onClose() {
      this.setData({ sheetDragY: 0, sheetDragging: false });
      this.triggerEvent('close');
    },
    onSheetTouchStart(e: WechatMiniprogram.TouchEvent) {
      const t = e.touches && e.touches[0];
      if (!t) return;
      dragStarts.set(this, t.clientY);
      this.setData({ sheetDragging: true });
    },
    onSheetTouchMove(e: WechatMiniprogram.TouchEvent) {
      if (!this.data.sheetDragging) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const startY = dragStarts.get(this) || 0;
      const dy = Math.max(0, t.clientY - startY);
      this.setData({ sheetDragY: dy });
    },
    onSheetTouchEnd() {
      if (!this.data.sheetDragging) return;
      const dy = this.data.sheetDragY;
      if (dy > 80) {
        this.setData({ sheetDragY: 0, sheetDragging: false });
        this.triggerEvent('close');
      } else {
        this.setData({ sheetDragY: 0, sheetDragging: false });
      }
    },
  },
});
