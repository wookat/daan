<template>
  <view class="wrap profile">
    <!-- 账号卡 -->
    <view class="card acct" @click="user ? null : goLogin()">
      <view class="avatar">
        <text v-if="user">{{ (user.nickname || user.phone || 'U').slice(0, 1) }}</text>
        <l-icon v-else name="user-round" :size="26" color="#ffffff" />
      </view>
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

    <!-- 打卡徽章墙 -->
    <view class="sec-t">打卡徽章</view>
    <view class="card badges">
      <view v-if="badgeInfo" class="badge-head">
        <text class="badge-cur">当前连续 {{ badgeInfo.streak }} 天</text>
        <text class="badge-best">历史最长 {{ badgeInfo.best_streak }} 天</text>
      </view>
      <view class="badge-grid">
        <view v-for="b in badgeList" :key="b.days" class="badge" :class="{ off: !b.unlocked }" @click="tapBadge(b)">
          <text class="badge-ico">{{ b.unlocked ? '🏅' : '🔒' }}</text>
          <text class="badge-d">{{ b.days }} 天</text>
        </view>
      </view>
    </view>

    <!-- 学习 -->
    <view class="sec-t">学习</view>
    <wd-cell-group custom-class="cellcard" border>
      <wd-cell title="学习计划与报考画像" :value="profileSummary" is-link clickable @click="goPlan">
        <template #icon><view class="cell-ico"><l-icon name="target" :size="18" color="#3b6ff5" /></view></template>
      </wd-cell>
      <wd-cell title="学习日历" is-link clickable @click="goCalendar">
        <template #icon><view class="cell-ico"><l-icon name="calendar" :size="18" color="#3b6ff5" /></view></template>
      </wd-cell>
      <wd-cell title="我的收藏" :value="favN + ' 题'" is-link clickable @click="goFavs">
        <template #icon><view class="cell-ico"><l-icon name="star" :size="18" color="#3b6ff5" /></view></template>
      </wd-cell>
      <wd-cell title="模考记录" is-link clickable @click="goExamList">
        <template #icon><view class="cell-ico"><l-icon name="file-text" :size="18" color="#3b6ff5" /></view></template>
      </wd-cell>
      <wd-cell title="AI 面试陪练" value="抽题 · 打分 · 点评" is-link clickable @click="goInterview">
        <template #icon><view class="cell-ico"><l-icon name="mic" :size="18" color="#3b6ff5" /></view></template>
      </wd-cell>
      <wd-cell title="答题 PK" is-link clickable @click="goPk">
        <template #icon><view class="cell-ico"><l-icon name="swords" :size="18" color="#3b6ff5" /></view></template>
      </wd-cell>
      <wd-cell title="刷题小队" value="组队打卡 · 互相催学" is-link clickable @click="goTeam">
        <template #icon><view class="cell-ico"><l-icon name="users" :size="18" color="#3b6ff5" /></view></template>
      </wd-cell>
    </wd-cell-group>

    <!-- 偏好设置 -->
    <view class="sec-t">偏好设置</view>
    <wd-cell-group custom-class="cellcard" border>
      <wd-cell title="每日目标" :value="dailyGoal + ' 题/天'" is-link clickable @click="cycleGoal">
        <template #icon><view class="cell-ico"><l-icon name="flag" :size="18" color="#0d9488" /></view></template>
      </wd-cell>
      <wd-cell title="字号与显示" :value="['小', '标准', '大'][fontLv]" is-link clickable @click="cycleFont">
        <template #icon><view class="cell-ico"><l-icon name="a-large-small" :size="18" color="#0d9488" /></view></template>
      </wd-cell>
      <wd-cell title="学习提醒" :value="remindOn ? '每天 ' + remindTime : '未开启'" is-link clickable @click="goReminders">
        <template #icon><view class="cell-ico"><l-icon name="alarm-clock" :size="18" color="#0d9488" /></view></template>
      </wd-cell>
      <!-- #ifdef H5 -->
      <wd-cell title="外观模式" :value="themeLabel" is-link clickable @click="cycleTheme">
        <template #icon><view class="cell-ico"><l-icon name="moon" :size="18" color="#0d9488" /></view></template>
      </wd-cell>
      <!-- #endif -->
      <wd-cell title="离线题包" :value="offlineN ? offlineN + ' 个题包' : '未下载'" is-link clickable @click="goOffline">
        <template #icon><view class="cell-ico"><l-icon name="package" :size="18" color="#0d9488" /></view></template>
      </wd-cell>
      <wd-cell title="答题音效" :value="sfxOn ? '已开启' : '已关闭'" is-link clickable @click="toggleSfx">
        <template #icon><view class="cell-ico"><l-icon name="bell" :size="18" color="#0d9488" /></view></template>
      </wd-cell>
    </wd-cell-group>

    <!-- 其他 -->
    <view class="sec-t">其他</view>
    <wd-cell-group custom-class="cellcard" border>
      <wd-cell v-if="announce" title="公告" :value="announce.title" is-link clickable @click="showAnnounce">
        <template #icon><view class="cell-ico"><l-icon name="megaphone" :size="18" color="#d97706" /></view></template>
      </wd-cell>
      <wd-cell title="反馈与纠错" is-link clickable @click="feedback">
        <template #icon><view class="cell-ico"><l-icon name="message-circle" :size="18" color="#d97706" /></view></template>
      </wd-cell>
      <wd-cell title="关于" value="考公助手" is-link clickable @click="about">
        <template #icon><view class="cell-ico"><l-icon name="info" :size="18" color="#d97706" /></view></template>
      </wd-cell>
    </wd-cell-group>

    <view v-if="user" class="logout" @click="doLogout">退出登录</view>
  </view>
</template>

<script>
import { request, getAuthUser, authLogout, clearAuth, anonUid, fetchCheckinBadges } from '../../api.js';
import { getReminderSettings } from '../../reminder.js';
import { cycleThemeMode, getThemeMode, THEME_LABELS } from '../../theme.js';
import { listPacks } from '../../offline.js';
import { checkinStreak } from '../../checkin.js';

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
      remindOn: false,
      remindTime: '20:30',
      themeMode: 'system',
      offlineN: 0,
      badgeInfo: null,
      growth: null,
    };
  },
  computed: {
    badgeList() {
      if (this.badgeInfo) return this.badgeInfo.badges || [];
      return [3, 7, 14, 30, 60, 100].map((d) => ({ days: d, unlocked: false }));
    },
    themeLabel() {
      return THEME_LABELS[this.themeMode] || '跟随系统';
    },
    totalDone() {
      // 服务端 answer_log 全量口径优先（与统计页同源），离线降级本地 pstats
      const sv = this.growth && this.growth.modules;
      if (sv) return Object.values(sv).reduce((s, m) => s + (m.n || 0), 0);
      let n = 0;
      for (const s of Object.values(this.pstats.byModule || {})) n += s.done || 0;
      return n;
    },
    streak() {
      if (this.badgeInfo && this.badgeInfo.streak != null) return this.badgeInfo.streak;
      return checkinStreak(this.pstats);
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
    const rs = getReminderSettings();
    this.remindOn = rs.on;
    this.remindTime = rs.time;
    this.themeMode = getThemeMode();
    this.offlineN = listPacks().length;
    this.loadRemote();
    this.loadBadges();
  },
  methods: {
    maskPhone(p) {
      return p ? p.slice(0, 3) + '****' + p.slice(-4) : '';
    },
    async loadBadges() {
      try {
        this.badgeInfo = await fetchCheckinBadges();
      } catch (e) { /* 非关键路径 */ }
    },
    tapBadge(b) {
      if (b.unlocked) {
        uni.navigateTo({ url: '/pkgA/social/poster?badge=' + b.days });
      } else {
        uni.showToast({ title: `连续打卡 ${b.days} 天即可解锁`, icon: 'none' });
      }
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
        this.growth = await request('/api/growth?uid=' + encodeURIComponent(uid));
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
    goInterview() {
      uni.navigateTo({ url: '/pkgA/interview/interview' });
    },
    goPk() {
      uni.navigateTo({ url: '/pkgA/pk/pk' });
    },
    goTeam() {
      uni.navigateTo({ url: '/pkgA/team/team' });
    },
    goReminders() {
      uni.navigateTo({ url: '/pkgA/settings/reminders' });
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
.wrap { padding: 24rpx 32rpx calc(60rpx + 50px + env(safe-area-inset-bottom)); }
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
.badges { padding: 26rpx 28rpx; }
.badge-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.badge-cur { font-size: 26rpx; font-weight: 700; color: var(--ink); }
.badge-best { font-size: 22rpx; color: var(--ink-2); }
.badge-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.badge { width: calc((100% - 32rpx) / 3); box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 6rpx; background: var(--brand-soft); border-radius: 18rpx; padding: 18rpx 0; }
.badge.off { background: var(--fill); opacity: 0.65; }
.badge-ico { font-size: 40rpx; }
.badge-d { font-size: 22rpx; font-weight: 600; color: var(--ink); }
:deep(.cellcard) { display: block; border-radius: 28rpx; overflow: hidden; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); margin-bottom: 20rpx; }
.cell-ico { width: 56rpx; height: 56rpx; border-radius: 14rpx; background: var(--fill); display: flex; align-items: center; justify-content: center; margin-right: 20rpx; }

.logout { margin-top: 40rpx; background: var(--card); border-radius: 24rpx; text-align: center; min-height: 44px; display: flex; align-items: center; justify-content: center; font-size: 28rpx; color: #dc2626; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.profile { max-width: 680px; }
  .row:hover { cursor: pointer; }
}
/* #endif */
</style>
