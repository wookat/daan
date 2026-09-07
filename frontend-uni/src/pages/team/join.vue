<template>
  <view class="wrap tjoin">
    <view class="hero">
      <view class="hero-t"><l-icon name="users" :size="22" color="#ffffff" /><text>刷题小队邀请</text></view>
      <text class="hero-s">队友邀请你加入小队，一起打卡刷题冲上岸</text>
    </view>

    <view class="card">
      <template v-if="state === 'ready'">
        <text class="code-l">邀请码</text>
        <text class="code">{{ code }}</text>
        <view class="act-btn main" @click="join">加入小队</view>
      </template>
      <template v-else-if="state === 'joined'">
        <text class="ok-t">🎉 已加入「{{ teamName }}」</text>
        <text class="ok-s">每天刷题就是打卡，队友都能看到你的进度</text>
        <view class="act-btn main" @click="goTeam">看队友打卡情况</view>
        <view class="act-btn sub" @click="goPractice">立刻刷 10 题打卡</view>
      </template>
      <template v-else-if="state === 'input'">
        <text class="code-l">输入邀请码加入小队</text>
        <input v-model="code" class="join-input" placeholder="6 位邀请码，如 A8X2QK" :maxlength="8" />
        <view class="act-btn main" @click="join">加入小队</view>
      </template>
      <template v-else>
        <text class="err">{{ errMsg }}</text>
        <view class="act-btn sub" @click="state = 'input'">手动输入邀请码</view>
      </template>
    </view>

    <view class="reg-tip" @click="goLogin">
      <text class="reg-t">登录 / 注册账号，打卡记录多端同步 ›</text>
    </view>
  </view>
</template>

<script>
import { teamJoin, trackEvent } from '../../api.js';

export default {
  data() {
    return { code: '', state: 'input', teamName: '', errMsg: '' };
  },
  onLoad(query) {
    const c = query && query.code ? String(query.code).trim().toUpperCase() : '';
    trackEvent('team_join_open', 'team', c || null);
    uni.setStorageSync('regSource', 'team');
    uni.setNavigationBarTitle({ title: '队友邀请你加入刷题小队，一起打卡冲上岸 - 错题邦' });
    if (c) {
      this.code = c;
      this.state = 'ready';
    }
  },
  methods: {
    async join() {
      const c = (this.code || '').trim().toUpperCase();
      if (!c) return uni.showToast({ title: '请输入邀请码', icon: 'none' });
      try {
        uni.showLoading({ title: '加入中…' });
        const d = await teamJoin(c);
        uni.hideLoading();
        this.teamName = d.team.name;
        this.state = 'joined';
        this._teamId = d.team.id;
      } catch (e) {
        uni.hideLoading();
        this.errMsg = e.message || '加入失败，邀请码可能无效';
        this.state = 'error';
      }
    },
    goTeam() {
      uni.navigateTo({ url: '/pkgA/team/team?id=' + this._teamId });
    },
    goPractice() {
      uni.setStorageSync('practiceLaunch', { kind: 'start', count: 10, source: 'team' });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goLogin() {
      uni.navigateTo({ url: '/pkgA/user/login' });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 60rpx; }
.hero { background: linear-gradient(135deg, #5b8af8, #2e5bff); border-radius: 32rpx; padding: 36rpx 32rpx; margin-bottom: 24rpx; box-shadow: 0 12rpx 36rpx rgba(46, 91, 255, 0.3); }
.hero-t { display: flex; align-items: center; gap: 12rpx; color: #fff; font-size: 40rpx; font-weight: 800; }
.hero-s { display: block; color: rgba(255, 255, 255, 0.85); font-size: 24rpx; margin-top: 10rpx; }

.card { background: var(--card); border-radius: 28rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 40rpx 32rpx; margin-bottom: 20rpx; display: flex; flex-direction: column; align-items: center; }
.code-l { font-size: 24rpx; color: var(--ink-2); margin-bottom: 14rpx; }
.code { font-size: 56rpx; font-weight: 800; color: var(--brand-text); letter-spacing: 8rpx; margin-bottom: 30rpx; }
.ok-t { font-size: 34rpx; font-weight: 700; color: var(--ink); margin-bottom: 12rpx; }
.ok-s { font-size: 24rpx; color: var(--ink-2); margin-bottom: 30rpx; }
.err { font-size: 27rpx; color: #dc2626; margin-bottom: 26rpx; }

.act-btn { width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 999rpx; font-size: 29rpx; font-weight: 600; margin-bottom: 18rpx; box-sizing: border-box; }
.act-btn.main { background: var(--brand); color: #fff; }
.act-btn.sub { background: var(--brand-soft); color: var(--brand-text); }

.join-input { width: 100%; background: var(--fill); border-radius: 999rpx; padding: 0 30rpx; min-height: 44px; font-size: 28rpx; margin-bottom: 26rpx; box-sizing: border-box; text-align: center; }

.reg-tip { display: flex; align-items: center; justify-content: center; min-height: 40px; box-sizing: border-box; padding: 20rpx 0; }
.reg-t { font-size: 24rpx; color: var(--brand-text); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.tjoin { max-width: 560px; }
}
/* #endif */
</style>
