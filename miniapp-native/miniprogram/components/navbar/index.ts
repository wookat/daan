// Skyline 要求自定义导航栏：状态栏占位 + 标题（可带返回）

Component({
  properties: {
    title: { type: String, value: '' },
    back: { type: Boolean, value: false },
    brand: { type: Boolean, value: false },
    large: { type: Boolean, value: false },
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
  pageLifetimes: {
    // 状态栏前景色由 window.navigationBarTextStyle(@navTxtStyle 随主题)决定；品牌渐变头页面不论主题都要白字
    show() {
      if (this.properties.brand) {
        wx.setNavigationBarColor({ frontColor: '#ffffff', backgroundColor: '#2e5bff' });
      }
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
