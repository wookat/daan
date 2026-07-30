<template>
  <view class="wrap">
    <view v-if="loading" class="card spin">加载中…</view>
    <view v-else-if="!items.length" class="card spin">错题本还是空的</view>
    <view v-for="m in items" :key="m.id" class="card" @click="m.open = !m.open">
      <view class="ops">
        <text class="op redo" @click.stop="redo(m)">重做</text>
        <text class="op del" @click.stop="del(m)">删除</text>
      </view>
      <text class="tag">{{ m.question_type || m.module || '' }}</text>
      <view class="q" :class="{ clamp: !m.open }">{{ (m.question_text || '').slice(0, 200) }}</view>
      <view class="meta">{{ fmt(m.created_at) }}</view>
      <rich-text v-if="m.open" :nodes="m.html" />
    </view>
  </view>
</template>

<script>
import { md } from '../../md.js';
import { request } from '../../api.js';

export default {
  data() {
    return { items: [], loading: true };
  },
  onShow() {
    this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      try {
        const d = await request('/api/mistakes');
        this.items = d.items.map((m) => ({ ...m, open: false, html: md(m.explanation || '') }));
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    fmt(ts) {
      return new Date(ts * 1000).toLocaleString('zh-CN');
    },
    redo(m) {
      uni.setStorageSync('redoQuestion', m.question_text || '');
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    del(m) {
      uni.showModal({
        title: '确定删除这道错题？',
        success: async (res) => {
          if (!res.confirm) return;
          await request('/api/mistakes/' + m.id, { method: 'DELETE' });
          this.load();
        },
      });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx; border-left: 6rpx solid #2f6fed; box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.06); }
.spin { text-align: center; color: #8a90a0; font-size: 26rpx; border-left: none; }
.ops { float: right; }
.op { font-size: 24rpx; margin-left: 20rpx; padding: 4rpx 8rpx; }
.redo { color: #2f6fed; }
.del { color: #c33; }
.tag { display: inline-block; background: #eef2ff; color: #2f6fed; border-radius: 10rpx; padding: 4rpx 14rpx; font-size: 22rpx; }
.q { font-size: 26rpx; line-height: 1.5; margin-top: 10rpx; }
.q.clamp { max-height: 120rpx; overflow: hidden; }
.meta { font-size: 22rpx; color: #8a90a0; margin-top: 10rpx; }
</style>
