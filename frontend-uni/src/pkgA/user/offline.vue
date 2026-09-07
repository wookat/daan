<template>
  <view class="page">
    <kg-two-col aside-first>
      <template #aside>
        <view v-if="!online" class="offbar" role="status">
          <l-icon name="plane" :size="16" tone="warn" />
          <text class="offbar-t">当前离线 · 可继续刷已下载题包，作答将在联网后自动同步</text>
        </view>

        <kg-card class="card">
          <view class="row-sb">
            <text class="h">存储占用</text>
            <text class="sub">已用 <text class="num">{{ usageText }}</text></text>
          </view>
          <kg-progress :value="usagePct" :thickness="8" aria-label="存储占用" class="bar" />
          <text class="hint">题包含题干/选项/解析文本，AI 讲解与讨论区需联网。{{ mpHint }}</text>
        </kg-card>

        <kg-card v-if="pending" class="card sync" :padding="12">
          <l-icon name="refresh-cw" :size="20" tone="brand-text" />
          <text class="sync-t">待同步：离线作答 <text class="num">{{ pending }}</text> 条 · 联网后自动上传并更新统计</text>
          <kg-button variant="primary" size="sm" :loading="syncing" :disabled="syncing" @click="syncNow">立即同步</kg-button>
        </kg-card>
      </template>

      <template #main>
        <kg-section-header :title="'题包（每包 ' + packSize + ' 题，可随时更新）'" />
        <kg-card v-for="m in mods" :key="m.module" class="pkg" :padding="12">
          <view class="ico" :style="{ background: modMeta(m.module).soft }">
            <l-icon :name="modMeta(m.module).icon" :size="24" :tone="'module:' + m.module" />
          </view>
          <view class="grow">
            <view class="nm-row">
              <text class="nm">{{ m.name }} · 高频题包</text>
              <kg-tag v-if="packOf(m.module)" tone="ok">已下载</kg-tag>
            </view>
            <text class="sub2">{{ packSub(m.module) }}</text>
          </view>
          <view class="acts">
            <kg-button v-if="busy === m.module" variant="secondary" size="sm" loading disabled>下载中</kg-button>
            <template v-else-if="packOf(m.module)">
              <kg-button variant="secondary" size="sm" icon="rotate-ccw" @click="download(m.module)">更新</kg-button>
              <kg-button variant="text" size="sm" tone="bad" @click="remove(m.module)">删除</kg-button>
            </template>
            <kg-button v-else variant="primary" size="sm" icon="monitor-down" @click="download(m.module)">下载</kg-button>
          </view>
        </kg-card>

        <text class="hint2">离线时进入「刷题 → 专项练习」会自动使用已下载题包出题，本地判分；错题与作答记录联网后自动同步（去重）。错题本离线可查看最近缓存内容。</text>
      </template>
    </kg-two-col>
  </view>
</template>

<script>
import { PACK_MODULES, PACK_SIZE, downloadPack, removePack, listPacks, packUsageBytes, pendingCount, flushOfflineQueue } from '../../offline.js';
import { moduleMeta } from '../../module-meta.js';

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
      usageBytes: 0,
    };
  },
  computed: {
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
      this.usageBytes = packUsageBytes();
    },
    packOf(m) {
      return this.packs.find((p) => p.module === m) || null;
    },
    packSub(m) {
      const p = this.packOf(m);
      if (!p) return '未下载 · 离线不可用';
      const d = new Date(p.ts);
      return `可离线 · ${p.count} 题 · 更新于 ${d.getMonth() + 1}/${d.getDate()}`;
    },
    modMeta(m) {
      return moduleMeta(m);
    },
    async download(m) {
      if (this.busy) return;
      this.busy = m;
      try {
        await downloadPack(m);
        // #ifdef H5
        // 预热练习页资源，配合 Service Worker 缓存，保证断网后能进入做题页
        import('../../pages/practice/practice.vue').catch(() => {});
        // #endif
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
.page { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.offbar { display: flex; align-items: flex-start; gap: var(--sp-8); background: var(--warn-soft); border-radius: var(--r-sm); padding: var(--sp-12); margin-bottom: var(--card-gap); }
.offbar-t { flex: 1; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--warn-strong); }
.card { margin-bottom: var(--card-gap); }
.row-sb { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-8); }
.h { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.sub { font-size: var(--fs-sub); color: var(--ink-3); }
.bar { margin-top: var(--sp-12); }
.hint { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-8); line-height: var(--lh-caption); }
.sync { display: flex; align-items: center; gap: var(--sp-12); background: var(--brand-soft); }
.sync-t { flex: 1; min-width: 0; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--brand-text); }
.pkg { display: flex; align-items: center; gap: var(--sp-12); margin-bottom: var(--sp-8); }
.ico { width: 44px; height: 44px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.grow { flex: 1; min-width: 0; }
.nm-row { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-4) var(--sp-8); }
.nm-row :deep(.kg-tag) { flex-shrink: 0; }
.nm { font-size: var(--fs-body); font-weight: 600; color: var(--ink); line-height: var(--lh-sub); overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.sub2 { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: 2px; }
.acts { display: flex; align-items: center; gap: var(--sp-4); flex-shrink: 0; }
.hint2 { display: block; font-size: var(--fs-caption); color: var(--ink-3); line-height: var(--lh-caption); margin: var(--sp-8) var(--sp-4); }
</style>
