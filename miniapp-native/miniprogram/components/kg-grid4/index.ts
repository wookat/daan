// KgGrid4（v3）：4 列图标入口格，只放「去某处」，不放数据。项结构固定（24 图标 + 13 标签）保证等高。
export interface Grid4Item { key: string; icon: string; label: string; to?: string; badge?: string }

Component({
  properties: {
    items: { type: Array, value: [] as Grid4Item[] },
  },
  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const key = String(e.currentTarget.dataset.key || '');
      const item = (this.data.items as Grid4Item[]).find((x) => x.key === key);
      this.triggerEvent('click', { key });
      if (item && item.to) wx.navigateTo({ url: item.to, fail: () => wx.switchTab({ url: item.to as string }) });
    },
  },
});
