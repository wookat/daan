// 迷你模考：路径保留兼容，作答流程与全真模考共用 pkgExam/exam（题卡/选项/答题卡/计时器共享组件）
Page({
  onLoad() {
    wx.redirectTo({ url: '/pkgExam/exam/exam?mini=1' });
  },
});
