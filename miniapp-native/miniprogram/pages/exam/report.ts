// 旧路径兼容：成绩报告已迁至 pkgExam/report（含排名/配速/历次/错因/解析浮层），此处仅转发 attempt_id
Page({
  onLoad(query: Record<string, string | undefined>) {
    const aid = Number(query.attempt_id || 0);
    if (!aid) {
      wx.showToast({ title: '缺少报告参数', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    wx.redirectTo({ url: '/pkgExam/report/report?attempt_id=' + aid });
  },
});
