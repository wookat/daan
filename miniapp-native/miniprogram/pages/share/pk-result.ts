// 旧路径兼容：历史分享卡片仍指向 /pages/share/pk-result?rid=…，实现已迁到分包 pkgSocial/pk-result
Page({
  onLoad(query: Record<string, string>) {
    const rid = query && query.rid ? encodeURIComponent(String(query.rid)) : '';
    wx.redirectTo({ url: '/pkgSocial/pk-result/pk-result' + (rid ? '?rid=' + rid : '') });
  },
});
