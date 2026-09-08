<template>
  <view class="wrap profile">
    <kg-two-col>
      <template #main>
        <!-- 账号卡 -->
        <kg-card class="acct" :clickable="!user" @click="goLogin">
          <view class="acct-row">
            <view class="avatar">
              <text v-if="user" class="avatar-t">{{ (user.nickname || user.phone || 'U').slice(0, 1) }}</text>
              <l-icon v-else name="user-round" :size="24" tone="on-brand" />
            </view>
            <view class="grow">
              <text class="acct-name">{{ user ? user.nickname || maskPhone(user.phone) : '未登录' }}</text>
              <text class="acct-sub">{{ user ? maskPhone(user.phone) + ' · 记录多端同步中' : '登录后错题、做题记录多端同步' }}</text>
            </view>
            <kg-button v-if="!user" variant="primary" size="lg" @click.stop="goLogin">登录 / 注册</kg-button>
          </view>
          <view class="acct-stats">
            <kg-stat-row :items="statItems" />
          </view>
        </kg-card>

        <!-- 打卡徽章：一行，点击进日历 -->
        <kg-card class="streak" clickable chevron @click="goCalendar">
          <view class="streak-row">
            <kg-streak-badges :days="streak" />
            <text class="streak-t">连续打卡</text>
            <text v-if="badgeInfo" class="streak-best">历史最长 <text class="num">{{ badgeInfo.best_streak }}</text> 天 · 已解锁 {{ unlockedN }}/{{ badgeList.length }} 徽章</text>
            <text v-else class="streak-best">学习日历与打卡徽章</text>
          </view>
        </kg-card>

        <!-- 学习 -->
        <kg-section-header title="学习" />
        <wd-cell-group custom-class="cellcard" border>
          <wd-cell title="学习计划与报考画像" :value="profileSummary" is-link clickable @click="goPlan">
            <template #icon><view class="cell-ico"><l-icon name="target" :size="20" tone="brand" /></view></template>
          </wd-cell>
          <wd-cell title="学习日历" is-link clickable @click="goCalendar">
            <template #icon><view class="cell-ico"><l-icon name="calendar" :size="20" tone="brand" /></view></template>
          </wd-cell>
          <wd-cell title="我的收藏" :value="favN + ' 题'" is-link clickable @click="goFavs">
            <template #icon><view class="cell-ico"><l-icon name="star" :size="20" tone="brand" /></view></template>
          </wd-cell>
          <wd-cell title="讨论消息" :value="inboxUnread ? inboxUnread + ' 条未读' : ''" is-link clickable @click="goInbox">
            <template #icon><view class="cell-ico"><l-icon name="message-circle" :size="20" tone="brand" /></view></template>
          </wd-cell>
          <wd-cell title="PK 对战" value="和考友同题比拼" is-link clickable @click="goPk">
            <template #icon><view class="cell-ico"><l-icon name="swords" :size="20" tone="brand" /></view></template>
          </wd-cell>
          <wd-cell title="学习小队" :value="teamName || '组队打卡互相监督'" is-link clickable @click="goTeam">
            <template #icon><view class="cell-ico"><l-icon name="users" :size="20" tone="brand" /></view></template>
          </wd-cell>
          <wd-cell title="练习历史" value="逐题回看 · 错题重练" is-link clickable @click="goPracticeHistory">
            <template #icon><view class="cell-ico"><l-icon name="clock" :size="20" tone="brand" /></view></template>
          </wd-cell>
          <wd-cell title="真题卷库" value="历年真题 · 模考记录" is-link clickable @click="goExamList">
            <template #icon><view class="cell-ico"><l-icon name="file-text" :size="20" tone="brand" /></view></template>
          </wd-cell>
          <wd-cell title="AI 学习教练" :value="coachHtml ? '已生成建议' : '个性化备考建议'" is-link clickable @click="coachOpen = true">
            <template #icon><view class="cell-ico"><l-icon name="bot-message-square" :size="20" tone="brand" /></view></template>
          </wd-cell>
          <wd-cell title="数据备份与迁移" :value="backupCode ? '恢复码 ' + backupCode : '免注册换机'" is-link clickable @click="bkOpen = true">
            <template #icon><view class="cell-ico"><l-icon name="save" :size="20" tone="brand" /></view></template>
          </wd-cell>
        </wd-cell-group>

        <!-- 偏好设置 -->
        <kg-section-header title="偏好设置" />
        <wd-cell-group custom-class="cellcard" border>
          <wd-cell title="每日目标" :value="dailyGoal + ' 题/天'" is-link clickable @click="cycleGoal">
            <template #icon><view class="cell-ico"><l-icon name="flag" :size="20" tone="info" /></view></template>
          </wd-cell>
          <wd-cell title="字号与显示" :value="['小', '标准', '大'][fontLv]" is-link clickable @click="cycleFont">
            <template #icon><view class="cell-ico"><l-icon name="a-large-small" :size="20" tone="info" /></view></template>
          </wd-cell>
          <wd-cell title="学习提醒" :value="remindOn ? '每天 ' + remindTime : '未开启'" is-link clickable @click="goReminders">
            <template #icon><view class="cell-ico"><l-icon name="alarm-clock" :size="20" tone="info" /></view></template>
          </wd-cell>
          <!-- #ifdef H5 -->
          <wd-cell title="外观模式" :value="themeLabel" is-link clickable @click="cycleTheme">
            <template #icon><view class="cell-ico"><l-icon name="moon" :size="20" tone="info" /></view></template>
          </wd-cell>
          <wd-cell v-if="pwaInstallable" title="安装到桌面" value="像 App 一样从主屏打开" is-link clickable @click="installPwa">
            <template #icon><view class="cell-ico"><l-icon name="monitor-down" :size="20" tone="info" /></view></template>
          </wd-cell>
          <wd-cell v-else-if="iosInstallable" title="安装到主屏幕" value="像 App 一样从主屏打开" is-link clickable @click="showIosGuide">
            <template #icon><view class="cell-ico"><l-icon name="monitor-down" :size="20" tone="info" /></view></template>
          </wd-cell>
          <!-- #endif -->
          <wd-cell title="离线题包" :value="offlineN ? offlineN + ' 个题包' : '未下载'" is-link clickable @click="goOffline">
            <template #icon><view class="cell-ico"><l-icon name="package" :size="20" tone="info" /></view></template>
          </wd-cell>
          <wd-cell title="答题音效" :value="sfxOn ? '已开启' : '已关闭'" is-link clickable @click="toggleSfx">
            <template #icon><view class="cell-ico"><l-icon name="bell" :size="20" tone="info" /></view></template>
          </wd-cell>
        </wd-cell-group>
      </template>

      <template #aside>
        <!-- 其他 -->
        <kg-section-header title="其他" />
        <wd-cell-group custom-class="cellcard" border>
          <wd-cell v-if="announce" title="公告" :value="announce.title" is-link clickable @click="showAnnounce">
            <template #icon><view class="cell-ico"><l-icon name="megaphone" :size="20" tone="warn" /></view></template>
          </wd-cell>
          <wd-cell title="反馈与纠错" is-link clickable @click="feedback">
            <template #icon><view class="cell-ico"><l-icon name="message-circle" :size="20" tone="warn" /></view></template>
          </wd-cell>
          <wd-cell title="关于" value="错题邦" is-link clickable @click="about">
            <template #icon><view class="cell-ico"><l-icon name="info" :size="20" tone="warn" /></view></template>
          </wd-cell>
        </wd-cell-group>

        <view v-if="user" class="logout">
          <kg-button variant="secondary" tone="bad" size="lg" block @click="doLogout">退出登录</kg-button>
        </view>

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
      </template>
    </kg-two-col>

    <!-- AI 学习教练（自 stats 迁入） -->
    <kg-sheet v-model="coachOpen" title="AI 学习教练">
      <view class="sheet-body">
        <text class="sheet-tip">基于你的正确率、错因分布和打卡情况，生成个性化备考建议</text>
        <kg-skeleton v-if="coachLoading" preset="lines" />
        <rich-text v-else-if="coachHtml" class="coach-body" :nodes="coachHtml" />
        <kg-empty-state v-else compact icon="bot-message-square" title="还没有生成过建议" desc="教练会读取你的做题数据，约需 10 秒" />
      </view>
      <template #footer>
        <kg-button variant="primary" size="lg" block :loading="coachLoading" @click="getCoach">{{ coachHtml ? '重新诊断' : '生成建议' }}</kg-button>
      </template>
    </kg-sheet>

    <!-- 数据备份与迁移（自 stats 迁入） -->
    <kg-sheet v-model="bkOpen" title="数据备份与迁移">
      <view class="sheet-body">
        <text class="sheet-tip">免注册也能换机：生成恢复码备份学习数据，在新设备输入恢复码即可找回。</text>
        <view v-if="backupCode" class="bk-code" role="button" aria-label="复制恢复码" @click="copyCode">
          <text class="bk-code-l">恢复码</text>
          <text class="bk-code-v num">{{ backupCode }}</text>
          <l-icon name="copy" :size="16" tone="brand-text" />
        </view>
      </view>
      <template #footer>
        <view class="row2">
          <kg-button variant="primary" size="lg" block :loading="bkLoading" @click="doBackup">{{ backupCode ? '更新备份' : '生成恢复码' }}</kg-button>
          <kg-button variant="secondary" size="lg" block :disabled="bkLoading" @click="doRestore">输入恢复码恢复</kg-button>
        </view>
      </template>
    </kg-sheet>
  </view>
</template>

<script>
import { request, snapPeek, getAuthUser, authLogout, clearAuth, anonUid, fetchCheckinBadges, fetchCommentInbox } from '../../api.js';
import { md } from '../../md.js';
import { getReminderSettings } from '../../reminder.js';
import { cycleThemeMode, getThemeMode, THEME_LABELS } from '../../theme.js';
import { normFontLv } from '../../font-size.js';
// #ifdef H5
import { canInstall, promptInstall, onInstallable, isIosSafariInstallable } from '../../pwa.js';
// #endif
import { listPacks } from '../../offline.js';
import { checkinStreak } from '../../checkin.js';
import { DAILY_GOALS, adoptServerDailyGoal } from '../../daily-goal.js';
import { moduleLabel } from '../../module-meta.js';

// 旧版缓存的 AI 建议 HTML 内联了旧紫色，读取时映射到品牌色
function cleanCoach(s) {
  return s.replace(/#4f46e5/g, '#2e5bff').replace(/#6366f1/g, '#5c82ff').replace(/#3730a3/g, '#2f5cd8').replace(/#f4f5ff/g, '#eef3ff');
}

function typeName(t) {
  if (!t) return '未分类';
  return String(t).replace(/^(数量关系|数学运算|资料分析|言语理解(与表达)?|判断推理|逻辑判断|常识判断|常识)[-－·：:]/, '');
}

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
      teamName: '',
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
      coachOpen: false,
      coachHtml: cleanCoach(uni.getStorageSync('coachAdvice') || ''),
      coachLoading: false,
      bkOpen: false,
      backupCode: uni.getStorageSync('backupCode') || '',
      bkLoading: false,
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
    unlockedN() {
      return this.badgeList.filter((b) => b.unlocked).length;
    },
    statItems() {
      return [
        { label: '累计做题', value: this.totalDone },
        { label: '错题本', value: this.mistakeN == null ? '—' : this.mistakeN },
        { label: '连续打卡', value: this.streak, unit: '天', tone: 'brand' },
      ];
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
    accPct() {
      const done = this.totalDone;
      if (!done) return 0;
      const sv = this.growth && this.growth.total;
      const c = sv ? sv.c || 0 : Object.values(this.pstats.byModule || {}).reduce((s, m) => s + (m.correct || 0), 0);
      return Math.round((c / done) * 100);
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
      const u = getAuthUser();
      if ((u ? u.uid : null) === (this.user ? this.user.uid : null)) return;
      this.resetAccountState();
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
    this.teamName = this.peekTeamName();
    this.refreshAccountData();
  },
  methods: {
    refreshAccountData() {
      this.user = getAuthUser();
      this.loadRemote();
      this.loadBadges();
      this.loadInbox();
    },
    resetAccountState() {
      this.mistakeN = null;
      this.profile = null;
      this.growth = null;
      this.badgeInfo = null;
      this.inboxUnread = 0;
      this.refreshAccountData();
    },
    maskPhone(p) {
      return p ? p.slice(0, 3) + '****' + p.slice(-4) : '';
    },
    /** 只读小队页留下的快照，不新增请求 */
    peekTeamName() {
      const snap = snapPeek('/api/team/mine?uid=' + encodeURIComponent(anonUid()));
      const t = snap && snap.items && snap.items[0];
      return t && t.name ? t.name : '';
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
    async loadRemote() {
      const uid = anonUid();
      // 快照即显：uid API 长尾下先用最近成功快照铺屏，真实响应到达后覆盖
      const pp = '/api/profile?uid=' + encodeURIComponent(uid);
      const gp = '/api/growth?uid=' + encodeURIComponent(uid);
      const pSnap = snapPeek(pp);
      if (pSnap) this.profile = pSnap.profile || null;
      const gSnap = snapPeek(gp);
      if (gSnap) this.applyGrowth(gSnap, uid);
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
        this.applyGrowth(await request(gp), uid);
      } catch (e) { /* 非关键路径 */ }
      try {
        const d = await request('/api/announcement');
        this.announce = d.item || null;
      } catch (e) { /* 非关键路径 */ }
    },
    /** 错题数取 /api/growth 聚合字段；老后端无 mistakes 时过渡一轮只读旧 /api/mistakes 快照，再无则 0 */
    applyGrowth(g, uid) {
      this.growth = g;
      if (g.mistakes) {
        this.mistakeN = g.mistakes.total || 0;
        return;
      }
      const legacy = snapPeek('/api/mistakes?uid=' + encodeURIComponent(uid) + '&limit=1');
      this.mistakeN = legacy ? (legacy.items || []).length : 0;
    },
    /** 本地练习记录按当前身份隔离（与 stats.vue 同口径） */
    localHist() {
      try {
        const uid = anonUid();
        return (uni.getStorageSync('practiceHistory') || []).filter((h) => !h.uid || h.uid === uid);
      } catch (e) {
        return [];
      }
    },
    /** 自 stats.vue 迁入：payload 字段与原实现一致，错题分布按需拉一次 /api/stats */
    async getCoach() {
      this.coachLoading = true;
      try {
        let st = { by_module: [], by_type: [], by_reason: [] };
        try {
          st = await request('/api/stats?uid=' + encodeURIComponent(anonUid()));
        } catch (e) { /* 无错题分布时仍可生成 */ }
        const byMod = {};
        for (const [k, v] of Object.entries(this.pstats.byModule || {})) {
          byMod[k] = { 已做: v.done, 正确率: v.done ? Math.round((v.correct / v.done) * 100) + '%' : '无' };
        }
        const hist = this.localHist();
        const stats = {
          累计刷题: this.totalDone,
          总正确率: this.accPct + '%',
          连续打卡天数: this.streak,
          各模块: byMod,
          错题模块分布: (st.by_module || []).map((m) => moduleLabel(m.module) + '×' + m.n).join('、'),
          错因分布: (st.by_reason || []).map((r) => r.error_reason + '×' + r.n).join('、'),
          高频错题型TOP5: (st.by_type || []).slice(0, 5).map((t) => typeName(t.question_type) + '×' + t.n).join('、'),
          近10次练习: hist.slice(0, 10).map((h) => (moduleLabel(h.module) || '未分类') + ' ' + h.correct + '/' + h.n),
        };
        const d = await request('/api/coach', { method: 'POST', data: { stats } });
        this.coachHtml = md(d.advice || '');
        uni.setStorageSync('coachAdvice', this.coachHtml);
      } catch (e) {
        uni.showToast({ title: '生成失败：' + e.message, icon: 'none' });
      }
      this.coachLoading = false;
    },
    copyCode() {
      uni.setClipboardData({ data: this.backupCode });
    },
    localData() {
      const keys = ['pstats', 'dailyPlan', 'dailyGoal', 'groupSize', 'realMode', 'fontLv', 'beiMode', 'favQuestions', 'practiceHistory', 'coachAdvice', 'backupCode'];
      const out = {};
      keys.forEach((k) => {
        const v = uni.getStorageSync(k);
        if (v !== '' && v !== null && v !== undefined) out[k] = v;
      });
      return out;
    },
    async doBackup() {
      this.bkLoading = true;
      try {
        const d = await request('/api/backup', { method: 'POST', data: { code: this.backupCode || null, data: this.localData() } });
        this.backupCode = d.code;
        uni.setStorageSync('backupCode', d.code);
        uni.showModal({ title: '备份成功', content: '恢复码：' + d.code + '\n请记下或截图保存，在新设备输入即可恢复数据。', showCancel: false });
      } catch (e) {
        uni.showToast({ title: '备份失败：' + e.message, icon: 'none' });
      }
      this.bkLoading = false;
    },
    doRestore() {
      uni.showModal({
        title: '输入恢复码',
        editable: true,
        placeholderText: '如：AB3D5F7H',
        success: async (res) => {
          if (!res.confirm || !res.content) return;
          try {
            const d = await request('/api/backup?code=' + encodeURIComponent(res.content.trim()));
            Object.entries(d.data || {}).forEach(([k, v]) => uni.setStorageSync(k, v));
            uni.setStorageSync('backupCode', res.content.trim().toUpperCase());
            this.backupCode = res.content.trim().toUpperCase();
            this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
            this.favN = (uni.getStorageSync('favQuestions') || []).length;
            this.dailyGoal = uni.getStorageSync('dailyGoal') || 20;
            this.fontLv = normFontLv(uni.getStorageSync('fontLv'));
            this.coachHtml = cleanCoach(uni.getStorageSync('coachAdvice') || '');
            uni.showToast({ title: '恢复成功！', icon: 'success' });
          } catch (e) {
            uni.showToast({ title: '恢复失败：' + e.message, icon: 'none' });
          }
        },
      });
    },
    goLogin() {
      uni.navigateTo({ url: '/pkgA/user/login' });
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
    goPk() {
      uni.navigateTo({ url: '/pkgA/pk/pk' });
    },
    goTeam() {
      uni.navigateTo({ url: '/pkgA/team/team' });
    },
    goExamList() {
      uni.navigateTo({ url: '/pkgA/exam/list' });
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
          uni.showToast({ title: '已退出登录', icon: 'none' });
        },
      });
    },
  },
};
</script>

<style scoped>
.wrap { padding: var(--sp-16) var(--page-x) calc(var(--sp-40) + 50px + env(safe-area-inset-bottom)); }

/* 账号卡 */
.acct { margin-bottom: var(--card-gap); }
.acct-row { display: flex; align-items: center; gap: var(--sp-12); }
.avatar { width: 48px; height: 48px; border-radius: var(--r-full); background: var(--brand-grad); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.avatar-t { color: var(--on-brand); font-size: var(--fs-h2); font-weight: 600; }
.grow { flex: 1; min-width: 0; }
.acct-name { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); line-height: var(--lh-h3); }
.acct-sub { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: 2px; }
.acct-stats { margin-top: var(--sp-16); padding-top: var(--sp-16); border-top: 1px solid var(--line); }

/* 连签一行 */
.streak { margin-bottom: var(--sp-4); }
.streak-row { display: flex; align-items: center; gap: var(--sp-8); min-height: 24px; padding-right: var(--sp-24); }
.streak-t { font-size: var(--fs-body); font-weight: 500; color: var(--ink); }
.streak-best { flex: 1; min-width: 0; font-size: var(--fs-caption); color: var(--ink-3); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* cell 组：作为 cell 规范样板 */
:deep(.cellcard) { display: block; border-radius: var(--r-md); overflow: hidden; border: 1px solid var(--line); margin-bottom: var(--sp-4); }
/* 标题不换行、右侧值单行省略：wot 默认左右各 flex:1，长标题会被挤成两行；
   title 由 <text> 渲染，uni-h5 基础样式 uni-text{white-space:pre-line} 会盖掉父级 nowrap，需下探到 text 本体 */
:deep(.cellcard .wd-cell__left) { flex: 0 0 auto; max-width: 62%; min-width: 0; }
:deep(.cellcard .wd-cell__title),
:deep(.cellcard .wd-cell__title uni-text),
:deep(.cellcard .wd-cell__title text) { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
:deep(.cellcard .wd-cell__value) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cell-ico { width: 32px; height: 32px; border-radius: var(--r-xs); background: var(--fill); display: flex; align-items: center; justify-content: center; margin-right: var(--sp-12); }

.logout { margin-top: var(--sp-24); }

/* 迁入的两个 sheet */
.sheet-body { padding: var(--sp-4) var(--sp-16) var(--sp-16); }
.sheet-tip { display: block; font-size: var(--fs-sub); color: var(--ink-3); line-height: var(--lh-sub); margin-bottom: var(--sp-12); }
.coach-body { display: block; font-size: var(--fs-body); line-height: var(--lh-body); color: var(--ink); }
.bk-code { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); padding: 0 var(--sp-12); background: var(--brand-soft); border-radius: var(--r-sm); }
.bk-code-l { font-size: var(--fs-sub); color: var(--ink-3); }
.bk-code-v { flex: 1; font-size: var(--fs-h3); font-weight: 600; color: var(--brand-text); letter-spacing: 2px; }
.row2 { display: flex; gap: var(--sp-12); }
.row2 :deep(.kg-btn) { flex: 1; }

.zl-footer { margin: var(--sp-32) 0 var(--sp-8); text-align: center; }
.zl-links { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--sp-4) var(--sp-16); margin-bottom: var(--sp-8); }
.zl-link { display: inline-block; font-size: var(--fs-caption); color: var(--brand-text); line-height: 28px; padding: var(--sp-8) 0; }
.zl-copy { font-size: var(--fs-caption); color: var(--ink-3); }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .wrap.profile { max-width: 1064px; }
}
/* #endif */
</style>
