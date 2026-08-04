<template>
  <view class="wrap profile">
    <!-- 账号卡 -->
    <view class="card acct" @click="user ? null : goLogin()">
      <view class="avatar">{{ user ? (user.nickname || user.phone || 'U').slice(0, 1) : '👤' }}</view>
      <view class="grow">
        <text class="acct-name">{{ user ? user.nickname || maskPhone(user.phone) : '未登录' }}</text>
        <text class="acct-sub">{{ user ? maskPhone(user.phone) + ' · 记录多端同步中' : '登录后错题、做题记录多端同步' }}</text>
      </view>
      <view v-if="!user" class="acct-btn" @click.stop="goLogin">登录 / 注册</view>
    </view>

    <!-- 学习资产 -->
    <view class="stats-row">
      <view class="stat-c" @click="goStats">
        <text class="stat-n">{{ totalDone }}</text>
        <text class="stat-t">累计做题</text>
      </view>
      <view class="stat-c" @click="goBook">
        <text class="stat-n">{{ mistakeN == null ? '—' : mistakeN }}</text>
        <text class="stat-t">错题本</text>
      </view>
      <view class="stat-c" @click="goStats">
        <text class="stat-n">{{ streak }}</text>
        <text class="stat-t">连续打卡</text>
      </view>
    </view>

    <!-- 学习 -->
    <view class="sec-t">学习</view>
    <view class="card group">
      <view class="row" @click="goPlan">
        <text class="row-ico">🎯</text>
        <text class="row-t">学习计划与报考画像</text>
        <text class="row-v">{{ profileSummary }}</text>
        <text class="row-arrow">›</text>
      </view>
      <view class="row" @click="goCalendar">
        <text class="row-ico">📅</text>
        <text class="row-t">学习日历</text>
        <text class="row-arrow">›</text>
      </view>
      <view class="row" @click="goFavs">
        <text class="row-ico">⭐</text>
        <text class="row-t">我的收藏</text>
        <text class="row-v">{{ favN }} 题</text>
        <text class="row-arrow">›</text>
      </view>
      <view class="row" @click="goExamList">
        <text class="row-ico">📝</text>
        <text class="row-t">模考记录</text>
        <text class="row-arrow">›</text>
      </view>
    </view>

    <!-- 偏好设置 -->
    <view class="sec-t">偏好设置</view>
    <view class="card group">
      <view class="row" @click="cycleGoal">
        <text class="row-ico">🏁</text>
        <text class="row-t">每日目标</text>
        <text class="row-v">{{ dailyGoal }} 题/天</text>
        <text class="row-arrow">›</text>
      </view>
      <view class="row" @click="cycleFont">
        <text class="row-ico">🔠</text>
        <text class="row-t">字号与显示</text>
        <text class="row-v">{{ ['小', '标准', '大'][fontLv] }}</text>
        <text class="row-arrow">›</text>
      </view>
      <!-- #ifdef H5 -->
      <view class="row" @click="cycleTheme">
        <text class="row-ico">🌓</text>
        <text class="row-t">外观模式</text>
        <text class="row-v">{{ themeLabel }}</text>
        <text class="row-arrow">›</text>
      </view>
      <!-- #endif -->
      <view class="row" @click="goOffline">
        <text class="row-ico">📦</text>
        <text class="row-t">离线题包</text>
        <text class="row-v">{{ offlineN ? offlineN + ' 个题包' : '未下载' }}</text>
        <text class="row-arrow">›</text>
      </view>
      <view class="row" @click="toggleSfx">
        <text class="row-ico">🔔</text>
        <text class="row-t">答题音效</text>
        <text class="row-v">{{ sfxOn ? '已开启' : '已关闭' }}</text>
        <text class="row-arrow">›</text>
      </view>
    </view>

    <!-- 其他 -->
    <view class="sec-t">其他</view>
    <view class="card group">
      <view v-if="announce" class="row" @click="showAnnounce">
        <text class="row-ico">📢</text>
        <text class="row-t">公告</text>
        <text class="row-v ellip">{{ announce.title }}</text>
        <text class="row-arrow">›</text>
      </view>
      <view class="row" @click="feedback">
        <text class="row-ico">💬</text>
        <text class="row-t">反馈与纠错</text>
        <text class="row-arrow">›</text>
      </view>
      <view class="row" @click="about">
        <text class="row-ico">ℹ️</text>
        <text class="row-t">关于</text>
        <text class="row-v">考公助手</text>
        <text class="row-arrow">›</text>
      </view>
    </view>

    <view v-if="user" class="logout" @click="doLogout">退出登录</view>
  </view>
</template>

<script>
import { request, getAuthUser, authLogout, clearAuth, anonUid } from '../../api.js';
import { cycleThemeMode, getThemeMode, THEME_LABELS } from '../../theme.js';
import { listPacks } from '../../offline.js';

export default {
  data() {
    return {
      user: null,
      profile: null,
      mistakeN: null,
      announce: null,
      pstats: { byModule: {}, days: {} },
      daily: { days: {} },
      favN: 0,
      dailyGoal: 20,
      fontLv: 1,
      sfxOn: true,
      themeMode: 'system',
      offlineN: 0,
    };
  },
  computed: {
    themeLabel() {
      return THEME_LABELS[this.themeMode] || '跟随系统';
    },
    totalDone() {
      let n = 0;
      for (const s of Object.values(this.pstats.byModule || {})) n += s.done || 0;
      return n;
    },
    streak() {
      let n = 0;
      const days = this.daily.days || {};
      const d = new Date();
      if (!days[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 1);
      while (days[d.toISOString().slice(0, 10)]) {
        n++;
        d.setDate(d.getDate() - 1);
      }
      return n;
    },
    profileSummary() {
      if (!this.profile) return '未制定';
      const p = this.profile;
      return (p.exam_type || '') + (p.exam_date ? ' · ' + p.exam_date : '');
    },
  },
  onShow() {
    this.user = getAuthUser();
    this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
    this.daily = uni.getStorageSync('dailyPlan') || { days: {} };
    this.favN = (uni.getStorageSync('favQuestions') || []).length;
    this.dailyGoal = uni.getStorageSync('dailyGoal') || 20;
    this.fontLv = uni.getStorageSync('fontLv') || 1;
    this.sfxOn = uni.getStorageSync('sfxOff') ? false : true;
    this.themeMode = getThemeMode();
    this.offlineN = listPacks().length;
    this.loadRemote();
  },
  methods: {
    maskPhone(p) {
      return p ? p.slice(0, 3) + '****' + p.slice(-4) : '';
    },
    async loadRemote() {
      const uid = anonUid();
      try {
        const d = await request('/api/mistakes?uid=' + encodeURIComponent(uid) + '&limit=1');
        this.mistakeN = d.total != null ? d.total : (d.items || []).length;
      } catch (e) { /* 非关键路径 */ }
      try {
        const d = await request('/api/profile?uid=' + encodeURIComponent(uid));
        this.profile = d.profile || null;
      } catch (e) { /* 非关键路径 */ }
      try {
        const d = await request('/api/announcement');
        this.announce = d.item || null;
      } catch (e) { /* 非关键路径 */ }
    },
    goLogin() {
      uni.navigateTo({ url: '/pkgA/user/login' });
    },
    goStats() {
      uni.switchTab({ url: '/pages/stats/stats' });
    },
    goBook() {
      uni.switchTab({ url: '/pages/book/book' });
    },
    goPlan() {
      uni.setStorageSync('openPlanSetup', '1');
      uni.switchTab({ url: '/pages/home/home' });
    },
    goCalendar() {
      uni.navigateTo({ url: '/pages/stats/calendar' });
    },
    goFavs() {
      uni.setStorageSync('bookShowFavs', '1');
      uni.switchTab({ url: '/pages/book/book' });
    },
    goExamList() {
      uni.navigateTo({ url: '/pkgA/exam/list' });
    },
    cycleGoal() {
      const opts = [20, 50, 100];
      const next = opts[(opts.indexOf(this.dailyGoal) + 1) % opts.length];
      this.dailyGoal = next;
      uni.setStorageSync('dailyGoal', next);
      uni.showToast({ title: '每日目标：' + next + ' 题', icon: 'none' });
    },
    cycleFont() {
      this.fontLv = (this.fontLv + 1) % 3;
      uni.setStorageSync('fontLv', this.fontLv);
      uni.showToast({ title: '字号：' + ['小', '标准', '大'][this.fontLv] + '（练习页生效）', icon: 'none' });
    },
    cycleTheme() {
      this.themeMode = cycleThemeMode();
      uni.showToast({ title: '外观模式：' + this.themeLabel, icon: 'none' });
    },
    goOffline() {
      uni.navigateTo({ url: '/pkgA/user/offline' });
    },
    toggleSfx() {
      this.sfxOn = !this.sfxOn;
      uni.setStorageSync('sfxOff', this.sfxOn ? '' : '1');
      uni.showToast({ title: this.sfxOn ? '音效已开启' : '音效已关闭', icon: 'none' });
    },
    showAnnounce() {
      if (!this.announce) return;
      uni.showModal({ title: this.announce.title, content: this.announce.body || '', showCancel: false, confirmText: '知道了' });
    },
    feedback() {
      uni.showModal({
        title: '反馈与纠错',
        content: '题目内容纠错：练习页答题后点「纠错」即可提交。\n其他建议可发送至邮箱 support@zalize.com',
        showCancel: false,
        confirmText: '知道了',
      });
    },
    about() {
      uni.showModal({ title: '考公助手', content: '行测刷题 · 错题本 · AI 讲解 · 全真模考\nkaogong.zalize.com', showCancel: false, confirmText: '知道了' });
    },
    doLogout() {
      uni.showModal({
        title: '退出登录',
        content: '退出后将回到本机匿名记录，账号数据仍保留在云端。',
        success: (r) => {
          if (!r.confirm) return;
          authLogout();
          clearAuth();
          this.user = null;
          this.loadRemote();
          uni.showToast({ title: '已退出登录', icon: 'none' });
        },
      });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 60rpx; }
.card { background: var(--card); border-radius: 28rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); margin-bottom: 20rpx; }

.acct { display: flex; align-items: center; gap: 24rpx; padding: 32rpx; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 50%; background: linear-gradient(135deg, #5b8af8, var(--brand)); color: #fff; font-size: 40rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.grow { flex: 1; min-width: 0; }
.acct-name { display: block; font-size: 32rpx; font-weight: 700; color: var(--ink); }
.acct-sub { display: block; font-size: 23rpx; color: var(--ink-2); margin-top: 6rpx; }
.acct-btn { flex-shrink: 0; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 28rpx; background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 25rpx; font-weight: 600; }

.stats-row { display: flex; gap: 20rpx; margin-bottom: 8rpx; }
.stat-c { flex: 1; background: var(--card); border-radius: 24rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 26rpx 0; display: flex; flex-direction: column; align-items: center; gap: 6rpx; }
.stat-n { font-size: 36rpx; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.stat-t { font-size: 22rpx; color: var(--ink-2); }

.sec-t { font-size: 24rpx; color: var(--ink-2); margin: 28rpx 8rpx 14rpx; }
.group { padding: 4rpx 32rpx; }
.row { display: flex; align-items: center; gap: 20rpx; min-height: 52px; border-top: 1rpx solid var(--line); }
.row:first-child { border-top: none; }
.row-ico { font-size: 32rpx; flex-shrink: 0; }
.row-t { flex: 1; font-size: 28rpx; color: var(--ink); }
.row-v { font-size: 24rpx; color: var(--ink-2); max-width: 40%; }
.row-v.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-arrow { color: var(--ink-4); font-size: 30rpx; flex-shrink: 0; }

.logout { margin-top: 40rpx; background: var(--card); border-radius: 24rpx; text-align: center; min-height: 44px; display: flex; align-items: center; justify-content: center; font-size: 28rpx; color: #dc2626; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.profile { max-width: 680px; }
  .row:hover { cursor: pointer; }
}
/* #endif */
</style>
