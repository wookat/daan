<template>
  <view class="wrap">
    <kg-two-col>
      <template #main>
        <view v-if="items.length" class="list">
          <kg-card v-for="it in items" :key="it.question_id" clickable class="item" @click="openDiscuss(it)">
            <view class="item-top">
              <kg-tag tone="module" :module="it.module">{{ modName(it.module) }}</kg-tag>
              <view class="cnt">
                <l-icon name="message-circle" :size="16" tone="muted" />
                <text class="cnt-t num">{{ it.cnt }}</text>
                <text class="cnt-u">条讨论</text>
              </view>
            </view>
            <text class="stem q-text ellip2">{{ it.stem }}</text>
            <view class="latest ellip2"><text class="nick">{{ it.latest.nickname }}：</text>{{ it.latest.content }}</view>
            <text class="time">{{ fmtTime(it.last_at) }} 活跃</text>
          </kg-card>
        </view>
        <kg-empty-state
          v-else-if="loadErr"
          icon="wifi-off"
          title="加载失败"
          :desc="loadErr"
          cta-text="重试"
          @cta="load"
        />
        <kg-empty-state
          v-else-if="loaded"
          icon="message-circle"
          title="还没有讨论"
          desc="去刷题时对题目发表评论，这里会聚合全站热议"
          cta-text="去刷题"
          @cta="goPractice"
        />
        <kg-skeleton v-else preset="cards" />
      </template>
      <template #aside>
        <kg-card v-if="items.length" variant="soft">
          <kg-stat-row :items="[{ label: '热议题目', value: items.length }, { label: '讨论总数', value: totalCnt }]" />
        </kg-card>
      </template>
    </kg-two-col>
  </view>
</template>

<script>
import { fmtMDHM } from '../../fmt.js';
import { fetchCommentsPlaza } from '../../api.js';
import { MODULES, moduleLabel } from '../../module-meta.js';

export default {
  data() {
    return { items: [], loaded: false, loadErr: '' };
  },
  computed: {
    totalCnt() {
      return this.items.reduce((s, x) => s + (Number(x.cnt) || 0), 0);
    },
  },
  onShow() {
    this.load();
  },
  methods: {
    async load() {
      this.loadErr = '';
      try {
        const d = await fetchCommentsPlaza();
        this.items = d.items || [];
      } catch (e) {
        this.loadErr = e.message || '网络异常';
        uni.showToast({ title: e.message || '加载失败', icon: 'none' });
      }
      this.loaded = true;
    },
    modName(m) {
      return MODULES[m] ? moduleLabel(m) : '综合';
    },
    fmtTime(ts) {
      return fmtMDHM(ts);
    },
    openDiscuss(it) {
      uni.navigateTo({ url: '/pkgA/social/discuss?qid=' + it.question_id });
    },
    goPractice() {
      uni.switchTab({ url: '/pages/home/home' });
    },
  },
};
</script>

<style scoped>
.wrap { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.list { display: flex; flex-direction: column; gap: var(--card-gap); }
.item-top { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-8); }
.cnt { display: flex; align-items: center; gap: var(--sp-4); color: var(--ink-3); flex-shrink: 0; }
.cnt-t { font-size: var(--fs-sub); color: var(--ink-2); }
.cnt-u { font-size: var(--fs-caption); color: var(--ink-3); }
.stem { font-size: var(--fs-body); color: var(--ink); }
.latest { margin-top: var(--sp-8); font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--ink-2); background: var(--fill); border-radius: var(--r-xs); padding: var(--sp-8) var(--sp-12); overflow-wrap: anywhere; }
.nick { font-weight: 600; color: var(--ink); }
.time { display: block; margin-top: var(--sp-8); font-size: var(--fs-caption); color: var(--ink-3); }
.ellip2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .wrap { max-width: 1044px !important; }
}
/* #endif */
</style>
