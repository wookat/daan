// 离线题包（对齐 H5 pkgA/user/offline.vue）：题包下载/更新/删除（wx.setStorage，10MB 上限预检）+ 离线作答队列同步状态
import { flushOfflineQueue, pendingCount } from '../../utils/offline';
import {
  downloadPack,
  fmtBytes,
  listPacks,
  PACK_MODULES,
  PACK_SIZE,
  packUsageBytes,
  removePack,
  STORAGE_LIMIT_BYTES,
  storageUsedBytes,
} from '../../utils/offline-pack';
import { moduleMeta } from '../../utils/module-meta';

interface PackVM {
  module: string;
  name: string;
  icon: string;
  color: string;
  soft: string;
  has: boolean;
  sub: string;
}

Page({
  data: {
    packs: [] as PackVM[],
    packSize: PACK_SIZE,
    pending: 0,
    busy: '',
    syncing: false,
    online: true,
    usageText: '0 KB',
    usagePct: 0,
    storageText: '',
  },

  onShow() {
    this.refresh();
    wx.getNetworkType({ success: (r) => this.setData({ online: r.networkType !== 'none' }) });
  },

  refresh() {
    const idx = listPacks();
    const packs: PackVM[] = PACK_MODULES.map((m) => {
      const meta = moduleMeta(m.module);
      const p = idx.find((x) => x.module === m.module) || null;
      let sub = '未下载 · 离线不可用';
      if (p) {
        const d = new Date(p.ts);
        sub = `可离线 · ${p.count} 题 · 更新于 ${d.getMonth() + 1}/${d.getDate()} · ${fmtBytes(p.size)}`;
      }
      return { module: m.module, name: m.name, icon: meta.icon, color: meta.color, soft: meta.soft, has: !!p, sub };
    });
    const usage = packUsageBytes();
    const used = storageUsedBytes();
    this.setData({
      packs,
      pending: pendingCount(),
      usageText: fmtBytes(usage),
      // 以 5MB 为参考上限（小程序 storage 共 10MB），与 H5 同口径
      usagePct: Math.min(100, (usage / (5 * 1024 * 1024)) * 100),
      storageText: '本地存储共 ' + fmtBytes(used) + ' / ' + fmtBytes(STORAGE_LIMIT_BYTES),
    });
  },

  async onDownload(e: WechatMiniprogram.TouchEvent) {
    const m = String((e.currentTarget.dataset as { m: string }).m || '');
    if (!m || this.data.busy) return;
    this.setData({ busy: m });
    try {
      await downloadPack(m);
      wx.showToast({ title: '题包已就绪，可离线刷题', icon: 'none' });
    } catch (err) {
      const msg = (err as Error).message || '网络异常';
      if ((err as Error).name === 'StorageLimitError') {
        wx.showModal({ title: '存储空间不足', content: msg, showCancel: false });
      } else {
        wx.showToast({ title: '下载失败：' + msg, icon: 'none' });
      }
    }
    this.setData({ busy: '' });
    this.refresh();
  },

  onRemove(e: WechatMiniprogram.TouchEvent) {
    const m = String((e.currentTarget.dataset as { m: string }).m || '');
    if (!m) return;
    removePack(m);
    this.refresh();
    wx.showToast({ title: '已删除题包', icon: 'none' });
  },

  async onSyncNow() {
    if (this.data.syncing) return;
    this.setData({ syncing: true });
    await flushOfflineQueue();
    this.setData({ syncing: false });
    this.refresh();
    if (!pendingCount()) wx.showToast({ title: '已全部同步', icon: 'none' });
  },
});
