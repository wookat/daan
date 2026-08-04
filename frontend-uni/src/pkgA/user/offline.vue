<template>
  <view class="wrap">
    <view v-if="!online" class="offbar">✈️ 当前离线 · 可继续刷已下载题包，作答将在联网后自动同步</view>

    <view class="card">
      <view class="row-sb">
        <text class="h">存储占用</text>
        <text class="sub">已用 {{ usageText }}</text>
      </view>
      <view class="bar"><view class="fill" :style="{ width: usagePct + '%' }" /></view>
      <view class="hint">题包含题干/选项/解析文本，AI 讲解与讨论区需联网。{{ mpHint }}</view>
    </view>

    <view v-if="pending" class="card sync" @click="syncNow">
      <text class="sync-t">🔄 待同步：离线作答 {{ pending }} 条 · 联网后自动上传并更新统计</text>
      <text class="sync-btn">{{ syncing ? '同步中…' : '立即同步' }}</text>
    </view>

    <view class="sec-t">题包（每包 {{ packSize }} 题，可随时更新）</view>
    <view class="card group">
      <view v-for="m in mods" :key="m.module" class="pkg">
        <text class="ico" :style="{ background: modBg(m.module) }">{{ m.name.slice(0, 1) }}</text>
        <view class="grow">
          <text class="nm">{{ m.name }} · 高频题包</text>
          <text class="sub2">{{ packSub(m.module) }}</text>
        </view>
        <text v-if="busy === m.module" class="act dim">下载中…</text>
        <template v-else-if="packOf(m.module)">
          <text class="act" @click="download(m.module)">更新</text>
          <text class="act del" @click="remove(m.module)">删除</text>
        </template>
        <text v-else class="act" @click="download(m.module)">下载</text>
      </view>
    </view>

    <view class="hint2">离线时进入「刷题 → 专项练习」会自动使用已下载题包出题，本地判分；错题与作答记录联网后自动同步（去重）。错题本离线可查看最近缓存内容。</view>
  </view>
</template>

<script>
import { PACK_MODULES, PACK_SIZE, downloadPack, removePack, listPacks, packUsageBytes, pendingCount, flushOfflineQueue } from '../../offline.js';

const MOD_BG = { ziliao: '#0d9488', shuliang: '#3b6ff5', yanyu: '#e11d48', panduan: '#7c3aed', changshi: '#d97706' };

export default {
  data() {
    return {
      mods: PACK_MODULES,
      packSize: PACK_SIZE,
      packs: [],
      pending: 0,
      busy: '',
      syncing: false,
      online: true,
    };
  },
  computed: {
    usageBytes() {
      return packUsageBytes();
    },
    usageText() {
      const b = this.usageBytes;
      return b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
    },
    usagePct() {
      // 以 5MB 为参考上限（小程序 storage 共 10MB）
      return Math.min(100, (this.usageBytes / (5 * 1024 * 1024)) * 100);
    },
    mpHint() {
      // #ifdef MP-WEIXIN
      return '小程序存储上限 10MB，题包为精简小包。';
      // #endif
      // #ifndef MP-WEIXIN
      return ''; // eslint-disable-line no-unreachable
      // #endif
    },
  },
  onShow() {
    this.refresh();
    uni.getNetworkType({ success: (r) => { this.online = r.networkType !== 'none'; } });
  },
  methods: {
    refresh() {
      this.packs = listPacks();
      this.pending = pendingCount();
    },
    packOf(m) {
      return this.packs.find((p) => p.module === m) || null;
    },
    packSub(m) {
      const p = this.packOf(m);
      if (!p) return '未下载 · 离线不可用';
      const d = new Date(p.ts);
      return `✓ 可离线 · ${p.count} 题 · 更新于 ${d.getMonth() + 1}/${d.getDate()}`;
    },
    modBg(m) {
      return MOD_BG[m] || 'var(--brand)';
    },
    async download(m) {
      if (this.busy) return;
      this.busy = m;
      try {
        await downloadPack(m);
        uni.showToast({ title: '题包已就绪，可离线刷题', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '下载失败：' + e.message, icon: 'none' });
      }
      this.busy = '';
      this.refresh();
    },
    remove(m) {
      removePack(m);
      this.refresh();
      uni.showToast({ title: '已删除题包', icon: 'none' });
    },
    async syncNow() {
      if (this.syncing) return;
      this.syncing = true;
      await flushOfflineQueue();
      this.syncing = false;
      this.refresh();
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 60rpx; }
.offbar { background: var(--warn-soft); border-radius: 16rpx; padding: 18rpx 24rpx; font-size: 25rpx; color: var(--warn); margin-bottom: 20rpx; }
.card { background: var(--card); border-radius: 28rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 28rpx; margin-bottom: 20rpx; }
.row-sb { display: flex; justify-content: space-between; align-items: center; }
.h { font-size: 30rpx; font-weight: 700; color: var(--ink); }
.sub { font-size: 24rpx; color: var(--ink-3); }
.bar { height: 12rpx; background: var(--fill); border-radius: 999rpx; overflow: hidden; margin-top: 16rpx; }
.fill { height: 100%; background: var(--brand); border-radius: 999rpx; min-width: 6rpx; }
.hint { font-size: 23rpx; color: var(--ink-3); margin-top: 14rpx; line-height: 1.6; }
.sync { display: flex; align-items: center; gap: 16rpx; background: var(--brand-soft); box-shadow: none; }
.sync-t { flex: 1; font-size: 24rpx; color: var(--brand); line-height: 1.6; }
.sync-btn { flex-shrink: 0; font-size: 24rpx; font-weight: 600; color: #fff; background: var(--brand); border-radius: 999rpx; padding: 10rpx 26rpx; }
.sec-t { font-size: 24rpx; color: var(--ink-2); margin: 28rpx 8rpx 14rpx; }
.group { padding: 6rpx 28rpx; }
.pkg { display: flex; align-items: center; gap: 20rpx; padding: 24rpx 0; border-bottom: 1rpx solid var(--fill); }
.pkg:last-child { border-bottom: none; }
.ico { width: 68rpx; height: 68rpx; border-radius: 16rpx; color: #fff; font-size: 30rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.grow { flex: 1; min-width: 0; }
.nm { display: block; font-size: 27rpx; font-weight: 600; color: var(--ink); }
.sub2 { display: block; font-size: 22rpx; color: var(--ink-3); margin-top: 4rpx; }
.act { flex-shrink: 0; font-size: 24rpx; font-weight: 600; color: var(--brand); padding: 12rpx 16rpx; }
.act.del { color: var(--bad); }
.act.dim { color: var(--ink-4); }
.hint2 { font-size: 23rpx; color: var(--ink-3); line-height: 1.7; margin: 8rpx 10rpx; }
</style>
