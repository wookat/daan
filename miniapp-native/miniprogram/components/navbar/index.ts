// Skyline 要求自定义导航栏：状态栏占位 + 标题（可带返回）

Component({
  properties: {
    title: { type: String, value: '' },
    back: { type: Boolean, value: false },
    brand: { type: Boolean, value: false },
  },
  data: {
    statusBarHeight: 20,
    /** 右侧为胶囊菜单预留的宽度（px），防止长标题钻到胶囊底下 */
    capsuleW: 96,
  },
  lifetimes: {
    attached() {
      const info = wx.getWindowInfo();
      let capsuleW = 96;
      try {
        const cap = wx.getMenuButtonBoundingClientRect();
        if (cap && cap.width) capsuleW = info.windowWidth - cap.left + 8;
      } catch {
        /* 部分容器无胶囊，用默认值 */
      }
      this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleW });
    },
  },
  methods: {
    onBack() {
      wx.navigateBack({
        fail: () => wx.switchTab({ url: '/pages/home/home' }),
      });
    },
  },
});
