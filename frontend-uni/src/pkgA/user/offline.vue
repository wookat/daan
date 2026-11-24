<template>
  <view class="page">
    <kg-two-col aside-first>
      <template #aside>
        <kg-banner v-if="!online" tone="warn" icon="plane" :closable="false" text="当前离线 · 可继续刷已下载题包，作答将在联网后自动同步" class="offbar-b" />

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

    <kg-confirm-sheet
      :model-value="!!removeTarget"
      :title="removeTarget ? '删除「' + removeName + '」离线题包？' : ''"
      desc="删除后无网络时将无法使用该模块离线刷题"
      confirm-text="删除"
      danger
      @confirm="confirmRemove"
      @cancel="removeTarget = ''"
    />
  </view>
</template>

<script>
import { PACK_MODULES, PACK_SIZE, downloadPack, removePack, listPacks, packUsageBytes, pendingCount, flushOfflineQueue } from '../../services/offline.js';
import { moduleMeta } from '../../utils/module-meta.js';
import { toastOk, toastInfo, toastErrFrom } from '../../utils/toast.js';

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
      removeTarget: '',
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
    removeName() {
      const m = this.mods.find((x) => x.module === this.removeTarget);
      return m ? m.name : this.removeTarget;
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
    // #ifdef H5
    if (!this._onNet && typeof window !== 'undefined') {
      this._onNet = () => { this.online = navigator.onLine !== false; };
      window.addEventListener('online', this._onNet);
      window.addEventListener('offline', this._onNet);
    }
    // #endif
  },
  onUnload() {
    // #ifdef H5
    if (this._onNet && typeof window !== 'undefined') {
      window.removeEventListener('online', this._onNet);
      window.removeEventListener('offline', this._onNet);
      this._onNet = null;
    }
    // #endif
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
      if (!this.online) {
        toastInfo('当前无网络，联网后再下载或更新题包');
        return;
      }
      this.busy = m;
      try {
        await downloadPack(m);
        // #ifdef H5
        // 预热练习页资源，配合 Service Worker 缓存，保证断网后能进入做题页
        import('../../pages/practice/practice.vue').catch(() => {});
        // #endif
        toastOk('题包已就绪');
      } catch (e) {
        toastErrFrom(e, '下载失败，请稍后重试');
      }
      this.busy = '';
      this.refresh();
    },
    remove(m) {
      this.removeTarget = m;
    },
    confirmRemove() {
      const m = this.removeTarget;
      if (!m) return;
      removePack(m);
      this.removeTarget = '';
      this.refresh();
      toastOk('已删除题包');
    },
    async syncNow() {
      if (this.syncing) return;
      if (!this.online) {
        toastInfo('当前无网络，联网后将自动同步');
        return;
      }
      const before = this.pending;
      this.syncing = true;
      await flushOfflineQueue();
      this.syncing = false;
      this.refresh();
      if (this.pending === 0 && before > 0) toastOk('同步完成');
      else if (this.pending >= before && before > 0) toastInfo('同步暂未完成，请稍后重试');
    },
  },
};
</script>

<style scoped>
.page { padding: var(--sp-16) var(--page-x) var(--sp-48); box-sizing: border-box; }
.offbar-b { margin-bottom: var(--card-gap); }
.card { margin-bottom: var(--card-gap); }
.row-sb { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-8); }
.h { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.sub { font-size: var(--fs-sub); color: var(--ink-3); }
.bar { margin-top: var(--sp-12); }
.hint { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-8); line-height: var(--lh-caption); }
.sync { display: flex; align-items: center; gap: var(--sp-12); background: var(--brand-soft); }
.sync-t { flex: 1; min-width: 0; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--brand-text); }
.pkg { display: flex; align-items: center; gap: var(--sp-12); margin-bottom: var(--card-gap); }
.ico { width: 44px; height: 44px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.grow { flex: 1; min-width: 0; }
.nm-row { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-4) var(--sp-8); }
.nm-row :deep(.kg-tag) { flex-shrink: 0; }
.nm { font-size: var(--fs-body); font-weight: 600; color: var(--ink); line-height: var(--lh-sub); overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.sub2 { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: 2px; }
.acts { display: flex; align-items: center; gap: var(--sp-8); flex-shrink: 0; }
.hint2 { display: block; font-size: var(--fs-caption); color: var(--ink-3); line-height: var(--lh-caption); margin: var(--sp-8) var(--sp-4); }
/* #ifdef H5 */
@media (min-width: 768px) {
  .page { max-width: 680px; margin: 0 auto; }
}
@media (min-width: 1024px) {
  .page { max-width: 1064px; margin: 0 auto; }
}
/* #endif */
</style>
