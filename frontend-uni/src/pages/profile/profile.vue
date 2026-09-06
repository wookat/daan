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

    <view class="pgrid">
    <view class="psec">
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
    </view>

    <view class="psec">
    <!-- 学习 -->
    <view class="sec-t">学习</view>
    <wd-cell-group custom-class="cellcard" border>
      <wd-cell title="学习计划与报考画像" :value="profileSummary" is-link clickable @click="goPlan">
        <template #icon><view class="cell-ico"><l-icon name="target" :size="18" color="#2e5bff" /></view></template>
      </wd-cell>
      <wd-cell title="学习日历" is-link clickable @click="goCalendar">
        <template #icon><view class="cell-ico"><l-icon name="calendar" :size="18" color="#2e5bff" /></view></template>
      </wd-cell>
      <wd-cell title="我的收藏" :value="favN + ' 题'" is-link clickable @click="goFavs">
        <template #icon><view class="cell-ico"><l-icon name="star" :size="18" color="#2e5bff" /></view></template>
      </wd-cell>
      <wd-cell title="讨论消息" :value="inboxUnread ? inboxUnread + ' 条未读' : ''" is-link clickable @click="goInbox">
        <template #icon><view class="cell-ico"><l-icon name="message-circle" :size="18" color="#2e5bff" /></view></template>
      </wd-cell>
      <wd-cell title="练习历史" value="逐题回看 · 错题重练" is-link clickable @click="goPracticeHistory">
        <template #icon><view class="cell-ico"><l-icon name="clock" :size="18" color="#2e5bff" /></view></template>
      </wd-cell>
      <wd-cell title="模考记录" is-link clickable @click="goExamList">
        <template #icon><view class="cell-ico"><l-icon name="file-text" :size="18" color="#2e5bff" /></view></template>
      </wd-cell>
      <wd-cell title="AI 面试陪练" value="抽题 · 打分 · 点评" is-link clickable @click="goInterview">
        <template #icon><view class="cell-ico"><l-icon name="mic" :size="18" color="#2e5bff" /></view></template>
      </wd-cell>
      <wd-cell title="答题 PK" is-link clickable @click="goPk">
        <template #icon><view class="cell-ico"><l-icon name="swords" :size="18" color="#2e5bff" /></view></template>
      </wd-cell>
      <wd-cell title="刷题小队" value="组队打卡 · 互相催学" is-link clickable @click="goTeam">
        <template #icon><view class="cell-ico"><l-icon name="users" :size="18" color="#2e5bff" /></view></template>
      </wd-cell>
    </wd-cell-group>
    </view>

    <view class="psec">
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
      <wd-cell v-if="pwaInstallable" title="安装到桌面" value="像 App 一样从主屏打开" is-link clickable @click="installPwa">
        <template #icon><view class="cell-ico"><l-icon name="monitor-down" :size="18" color="#0d9488" /></view></template>
      </wd-cell>
      <wd-cell v-else-if="iosInstallable" title="安装到主屏幕" value="像 App 一样从主屏打开" is-link clickable @click="showIosGuide">
        <template #icon><view class="cell-ico"><l-icon name="monitor-down" :size="18" color="#0d9488" /></view></template>
      </wd-cell>
      <!-- #endif -->
      <wd-cell title="离线题包" :value="offlineN ? offlineN + ' 个题包' : '未下载'" is-link clickable @click="goOffline">
        <template #icon><view class="cell-ico"><l-icon name="package" :size="18" color="#0d9488" /></view></template>
      </wd-cell>
      <wd-cell title="答题音效" :value="sfxOn ? '已开启' : '已关闭'" is-link clickable @click="toggleSfx">
        <template #icon><view class="cell-ico"><l-icon name="bell" :size="18" color="#0d9488" /></view></template>
      </wd-cell>
    </wd-cell-group>
    </view>

    <view class="psec">
    <!-- 其他 -->
    <view class="sec-t">其他</view>
    <wd-cell-group custom-class="cellcard" border>
      <wd-cell v-if="announce" title="公告" :value="announce.title" is-link clickable @click="showAnnounce">
        <template #icon><view class="cell-ico"><l-icon name="megaphone" :size="18" color="#d97706" /></view></template>
      </wd-cell>
      <wd-cell title="反馈与纠错" is-link clickable @click="feedback">
        <template #icon><view class="cell-ico"><l-icon name="message-circle" :size="18" color="#d97706" /></view></template>
      </wd-cell>
      <wd-cell title="关于" value="错题邦" is-link clickable @click="about">
        <template #icon><view class="cell-ico"><l-icon name="info" :size="18" color="#d97706" /></view></template>
      </wd-cell>
    </wd-cell-group>
    </view>
    </view>

    <view v-if="user" class="logout" @click="doLogout">退出登录</view>

    <view class="zl-footer">
      <view class="zl-links">
        <text class="zl-link" v-for="p in zlProducts" :key="p.url" @click="zlOpen(p.url)">{{ p.name }}</text>
      </view>
      <view class="zl-links">
        <text class="zl-link" @click="zlOpen('https://career.zalize.com/privacy/')">隐私政策</text>
        <text class="zl-link" @click="zlOpen('https://career.zalize.com/terms/')">服务条款</text>
        <text class="zl-link" @click="zlOpen('mailto:support@zalize.com')">联系我们</text>
      </view>
      <text class="zl-copy">© 2026 Zalize 上岸 · 错题邦</text>
    </view>
  </view>
</template>

<script>
import { request, snapPeek, getAuthUser, authLogout, clearAuth, anonUid, fetchCheckinBadges, fetchCommentInbox } from '../../api.js';
import { getReminderSettings } from '../../reminder.js';
import { cycleThemeMode, getThemeMode, THEME_LABELS } from '../../theme.js';
import { normFontLv } from '../../font-size.js';
// #ifdef H5
import { canInstall, promptInstall, onInstallable, isIosSafariInstallable } from '../../pwa.js';
// #endif
import { listPacks } from '../../offline.js';
import { checkinStreak } from '../../checkin.js';
import { DAILY_GOALS, adoptServerDailyGoal } from '../../daily-goal.js';

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
      inboxUnread: 0,
      dailyGoal: 20,
      fontLv: 1,
      sfxOn: true,
      remindOn: false,
      remindTime: '20:30',
      themeMode: 'system',
      pwaInstallable: false,
      iosInstallable: false,
      offlineN: 0,
      badgeInfo: null,
      growth: null,
      zlProducts: [
        { name: 'Zalize 门户', url: 'https://career.zalize.com' },
        { name: '刷题营', url: 'https://tiku.zalize.com' },
        { name: '真题营', url: 'https://zhenti.zalize.com' },
        { name: '答对笔试', url: 'https://test.zalize.com' },
        { name: '面试鲸', url: 'https://interview.zalize.com' },
      ],
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
      // 服务端 answer_log 全量口径优先（含时政，与统计页同源），离线降级本地 pstats
      const sv = this.growth && this.growth.total;
      if (sv) return sv.n || 0;
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
  onLoad() {
    this._onAuth = () => {
      this.user = getAuthUser();
    };
    uni.$on('authChanged', this._onAuth);
    // #ifdef H5
    this.pwaInstallable = canInstall();
    this.iosInstallable = isIosSafariInstallable();
    this._offInstallable = onInstallable(() => {
      this.pwaInstallable = canInstall();
    });
    // #endif
  },
  onUnload() {
    if (this._onAuth) uni.$off('authChanged', this._onAuth);
    // #ifdef H5
    if (this._offInstallable) this._offInstallable();
    // #endif
  },
  onShow() {
    this.user = getAuthUser();
    this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
    this.daily = uni.getStorageSync('dailyPlan') || { days: {} };
    this.favN = (uni.getStorageSync('favQuestions') || []).length;
    this.dailyGoal = uni.getStorageSync('dailyGoal') || 20;
    this.fontLv = normFontLv(uni.getStorageSync('fontLv'));
    this.sfxOn = uni.getStorageSync('sfxOff') ? false : true;
    const rs = getReminderSettings();
    this.remindOn = rs.on;
    this.remindTime = rs.time;
    this.themeMode = getThemeMode();
    this.offlineN = listPacks().length;
    this.loadRemote();
    this.loadBadges();
    this.loadInbox();
  },
  methods: {
    maskPhone(p) {
      return p ? p.slice(0, 3) + '****' + p.slice(-4) : '';
    },
    // #ifdef H5
    async installPwa() {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        uni.showToast({ title: '已安装，可从桌面直接打开', icon: 'none' });
      }
    },
    showIosGuide() {
      uni.showModal({
        title: '安装到主屏幕',
        content: '1. 点浏览器底部的「分享」按钮（向上箭头）\n2. 在菜单中选择「添加到主屏幕」\n完成后可像 App 一样从主屏直接打开', 
        showCancel: false,
        confirmText: '知道了',
      });
    },
    // #endif
    async loadInbox() {
      if (!this.user) {
        this.inboxUnread = 0;
        return;
      }
      try {
        const d = await fetchCommentInbox();
        this.inboxUnread = d.unread || 0;
      } catch (e) { /* 非关键路径 */ }
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
      // 快照即显：uid API 长尾下先用最近成功快照铺屏，真实响应到达后覆盖
      const mp = '/api/mistakes?uid=' + encodeURIComponent(uid) + '&limit=1';
      const pp = '/api/profile?uid=' + encodeURIComponent(uid);
      const gp = '/api/growth?uid=' + encodeURIComponent(uid);
      const mSnap = snapPeek(mp);
      if (mSnap) this.mistakeN = mSnap.total != null ? mSnap.total : (mSnap.items || []).length;
      const pSnap = snapPeek(pp);
      if (pSnap) this.profile = pSnap.profile || null;
      const gSnap = snapPeek(gp);
      if (gSnap) this.growth = gSnap;
      try {
        const d = await request(mp);
        this.mistakeN = d.total != null ? d.total : (d.items || []).length;
      } catch (e) { /* 非关键路径 */ }
      try {
        const d = await request(pp);
        this.profile = d.profile || null;
        const g = adoptServerDailyGoal(this.dailyGoal, this.profile);
        if (g != null) {
          this.dailyGoal = g;
          uni.setStorageSync('dailyGoal', g);
        }
      } catch (e) { /* 非关键路径 */ }
      try {
        this.growth = await request(gp);
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
    goPracticeHistory() {
      uni.navigateTo({ url: '/pkgA/stats/practice-history' });
    },
    goFavs() {
      uni.setStorageSync('bookShowFavs', '1');
      uni.switchTab({ url: '/pages/book/book' });
    },
    goInbox() {
      if (!this.user) {
        this.goLogin();
        return;
      }
      uni.navigateTo({ url: '/pkgA/social/inbox' });
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
      const opts = DAILY_GOALS;
      const next = opts[(opts.indexOf(this.dailyGoal) + 1) % opts.length];
      this.dailyGoal = next;
      uni.setStorageSync('dailyGoal', next);
      request('/api/profile', { method: 'POST', data: { uid: anonUid(), daily_goal: next } }).catch(() => {});
      uni.showToast({ title: '每日目标：' + next + ' 题', icon: 'none' });
    },
    cycleFont() {
      this.fontLv = (this.fontLv + 1) % 3;
      uni.setStorageSync('fontLv', this.fontLv);
      uni.showToast({ title: '字号：' + ['小', '标准', '大'][this.fontLv] + '（做题与复习页生效）', icon: 'none' });
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
    zlOpen(url) {
      // #ifdef H5
      window.open(url, '_blank');
      // #endif
      // #ifndef H5
      uni.setClipboardData({ data: url, success: () => uni.showToast({ title: '链接已复制', icon: 'none' }) });
      // #endif
    },
    about() {
      uni.showModal({ title: '错题邦', content: '行测刷题 · 错题本 · AI 讲解 · 全真模考\nkaogong.zalize.com', showCancel: false, confirmText: '知道了' });
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
.acct-sub { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 6rpx; }
.acct-btn { flex-shrink: 0; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 28rpx; background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 25rpx; font-weight: 600; }

.stats-row { display: flex; gap: 20rpx; margin-bottom: 8rpx; }
.stat-c { flex: 1; background: var(--card); border-radius: 24rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 26rpx 0; display: flex; flex-direction: column; align-items: center; gap: 6rpx; }
.stat-n { font-size: 36rpx; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.stat-t { font-size: 24rpx; color: var(--ink-2); }

.sec-t { font-size: 24rpx; color: var(--ink-2); margin: 28rpx 8rpx 14rpx; }
.badges { padding: 26rpx 28rpx; }
.badge-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.badge-cur { font-size: 26rpx; font-weight: 700; color: var(--ink); }
.badge-best { font-size: 24rpx; color: var(--ink-2); }
.badge-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.badge { width: calc((100% - 32rpx) / 3); box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 6rpx; background: var(--brand-soft); border-radius: 18rpx; padding: 18rpx 0; }
.badge.off { background: var(--fill); opacity: 0.65; }
.badge-ico { font-size: 40rpx; }
.badge-d { font-size: 24rpx; font-weight: 600; color: var(--ink); }
:deep(.cellcard) { display: block; border-radius: 28rpx; overflow: hidden; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); margin-bottom: 20rpx; }
.cell-ico { width: 56rpx; height: 56rpx; border-radius: 14rpx; background: var(--fill); display: flex; align-items: center; justify-content: center; margin-right: 20rpx; }

.logout { margin-top: 40rpx; background: var(--card); border-radius: 24rpx; text-align: center; min-height: 44px; display: flex; align-items: center; justify-content: center; font-size: 28rpx; color: #dc2626; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); }

.zl-footer { margin: 48rpx 0 16rpx; text-align: center; }
.zl-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 16rpx 28rpx; margin-bottom: 14rpx; }
.zl-link { display: inline-flex; align-items: center; min-height: 40px; margin: -4px 0; font-size: 24rpx; color: var(--brand-text); }
.zl-copy { font-size: 24rpx; color: var(--ink-3); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.profile { max-width: 680px; }
  .row:hover { cursor: pointer; }
}

/* 桌面双栏（仅 H5 ≥1024px）：四分组 masonry，账号卡/资产行/页脚保持整宽 */
@media (min-width: 1024px) {
  .wrap.profile { max-width: 1044px !important; margin: 0 auto; }
  .pgrid { column-count: 2; column-gap: 24rpx; }
  .pgrid > .psec { break-inside: avoid; }
}
/* #endif */
</style>
