// Skyline 要求自定义导航栏：状态栏占位 + 标题（可带返回）

Component({
  properties: {
    title: { type: String, value: '' },
    back: { type: Boolean, value: false },
    brand: { type: Boolean, value: false },
  },
  data: {
    statusBarHeight: 20,
  },
  lifetimes: {
    attached() {
      const info = wx.getWindowInfo();
      this.setData({ statusBarHeight: info.statusBarHeight || 20 });
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
