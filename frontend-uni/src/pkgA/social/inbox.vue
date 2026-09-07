<template>
  <view class="wrap">
    <view v-if="items.length" class="list">
      <view v-for="(it, i) in items" :key="it.type + '-' + it.id + '-' + i" class="item" @click="openDiscuss(it)">
        <view class="item-top">
          <view class="who">
            <view v-if="it.unread" class="dot" />
            <template v-if="it.type === 'like'">
              <text class="like-ico">👍</text>
              <text class="act">有人赞了我的评论</text>
            </template>
            <template v-else>
              <text class="nick">{{ it.nickname }}</text>
              <text class="act">回复了我</text>
            </template>
          </view>
          <text class="time">{{ fmtTime(it.created_at) }}</text>
        </view>
        <view v-if="it.type !== 'like'" class="content ellip2">{{ it.content }}</view>
        <view class="quote ellip2">我的评论：{{ it.parent_content }}</view>
      </view>
    </view>
    <view v-else-if="loaded && !logged" class="empty">
      <view class="empty-ico">🔐</view>
      <text class="empty-t">登录后查看消息</text>
      <text class="empty-d">登录账号后，评论收到的回复和点赞会在这里提醒你</text>
      <button class="login-btn" @click="goLogin">去登录</button>
    </view>
    <view v-else-if="loadErr" class="empty">
      <text class="empty-t">加载失败：{{ loadErr }}</text>
      <view class="retry" @click="load">重试 ›</view>
    </view>
    <view v-else-if="loaded" class="empty">
      <view class="empty-ico">💬</view>
      <text class="empty-t">暂无消息</text>
      <text class="empty-d">去讨论区发表评论，收到回复或点赞会在这里提醒你</text>
    </view>
  </view>
</template>

<script>
import { fetchCommentInbox, readCommentInbox, getToken } from '../../api.js';

export default {
  data() {
    return { items: [], loaded: false, logged: false, loadErr: '' };
  },
  onShow() {
    this.logged = !!getToken();
    if (this.logged) this.load();
    else this.loaded = true;
  },
  methods: {
    async load() {
      this.loadErr = '';
      try {
        const d = await fetchCommentInbox();
        this.items = d.items || [];
        if (d.unread) readCommentInbox().catch(() => {});
      } catch (e) {
        this.loadErr = e.message || '网络异常';
        uni.showToast({ title: e.message || '加载失败', icon: 'none' });
      }
      this.loaded = true;
    },
    goLogin() {
      uni.navigateTo({ url: '/pkgA/user/login' });
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
.who { display: flex; align-items: center; gap: 10rpx; }
.dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: #2e5bff; }
.nick { font-size: 26rpx; font-weight: 700; color: var(--ink); }
.like-ico { font-size: 26rpx; }
.act { font-size: 24rpx; color: var(--ink-2); }
.time { font-size: 22rpx; color: var(--ink-2); }
.content { font-size: 27rpx; color: var(--ink); line-height: 1.6; }
.quote { font-size: 24rpx; color: var(--ink-2); background: var(--bg); border-radius: 12rpx; padding: 12rpx 18rpx; margin-top: 14rpx; }
.ellip2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 12rpx; padding: 120rpx 0; }
.empty-ico { font-size: 72rpx; }
.empty-t { font-size: 28rpx; font-weight: 600; color: var(--ink); }
.retry {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  margin-top: 4rpx;
  color: var(--brand-text);
  font-size: 26rpx;
  font-weight: 500;
}
.empty-d { font-size: 24rpx; color: var(--ink-2); }
.login-btn { margin-top: 24rpx; background: var(--brand); color: #fff; font-size: 28rpx; border-radius: 18rpx; padding: 0 64rpx; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .item:hover { cursor: pointer; box-shadow: 0 6rpx 20rpx rgba(23, 24, 28, 0.1); }
}
/* #endif */
</style>
