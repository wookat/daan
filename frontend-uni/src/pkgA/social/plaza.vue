<template>
  <view class="wrap">
    <view v-if="items.length" class="list">
      <view v-for="it in items" :key="it.question_id" class="item" @click="openDiscuss(it)">
        <view class="item-top">
          <text class="mod">{{ modName(it.module) }}</text>
          <text class="cnt"><l-icon name="message-circle" :size="13" color="#8a90a2" /> {{ it.cnt }} 条讨论</text>
        </view>
        <view class="stem ellip2">{{ it.stem }}</view>
        <view class="latest ellip2"><text class="nick">{{ it.latest.nickname }}：</text>{{ it.latest.content }}</view>
        <view class="time">{{ fmtTime(it.last_at) }} 活跃</view>
      </view>
    </view>
    <view v-else-if="loaded" class="empty">
      <view class="empty-ico">💬</view>
      <text class="empty-t">还没有讨论</text>
      <text class="empty-d">去刷题时对题目发表评论，这里会聚合全站热议</text>
    </view>
  </view>
</template>

<script>
import { fetchCommentsPlaza } from '../../api.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };

export default {
  data() {
    return { items: [], loaded: false };
  },
  onShow() {
    this.load();
  },
  methods: {
    async load() {
      try {
        const d = await fetchCommentsPlaza();
        this.items = d.items || [];
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' });
      }
      this.loaded = true;
    },
    modName(m) {
      return NAMES[m] || '综合';
    },
    fmtTime(ts) {
      const d = new Date(ts * 1000);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    openDiscuss(it) {
      uni.navigateTo({ url: '/pkgA/social/discuss?qid=' + it.question_id });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 60rpx; }
.list { display: flex; flex-direction: column; gap: 18rpx; }
.item { background: var(--card); border-radius: 24rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 24rpx 28rpx; }
.item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.mod { font-size: 22rpx; color: var(--brand); background: var(--brand-soft); border-radius: 999rpx; padding: 4rpx 18rpx; font-weight: 600; }
.cnt { font-size: 22rpx; color: var(--ink-2); display: inline-flex; align-items: center; gap: 6rpx; }
.stem { font-size: 27rpx; color: var(--ink); line-height: 1.6; font-weight: 600; }
.latest { font-size: 24rpx; color: var(--ink-2); background: var(--bg); border-radius: 12rpx; padding: 12rpx 18rpx; margin-top: 14rpx; line-height: 1.6; }
.nick { color: var(--ink); font-weight: 600; }
.time { font-size: 22rpx; color: var(--ink-3); margin-top: 12rpx; }
.ellip2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 12rpx; padding: 120rpx 0; }
.empty-ico { font-size: 72rpx; }
.empty-t { font-size: 28rpx; font-weight: 600; color: var(--ink); }
.empty-d { font-size: 24rpx; color: var(--ink-2); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .item:hover { cursor: pointer; box-shadow: 0 6rpx 20rpx rgba(23, 24, 28, 0.1); }
}
@media (min-width: 1024px) {
  .list { display: grid; grid-template-columns: 1fr 1fr; align-items: start; }
}
/* #endif */
</style>
