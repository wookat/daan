<template>
  <view class="wrap profile">
    <kg-two-col>
      <template #main>
        <!-- 账号卡 -->
        <kg-card class="acct" :clickable="!user" @click="!user && goLogin()">
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
      </template>

      <template #aside>
        <!-- 偏好设置（桌面双栏放到右栏平衡高度，移动端自然顺排在「学习」下方） -->
        <kg-section-header title="偏好设置" />
        <wd-cell-group custom-class="cellcard" border>
          <wd-cell key="goal" title="每日目标" :value="dailyGoal + ' 题/天'" is-link clickable @click="cycleGoal">
            <template #icon><view class="cell-ico"><l-icon name="flag" :size="20" tone="info" /></view></template>
          </wd-cell>
          <wd-cell key="font" title="字号与显示" :value="['小', '标准', '大'][fontLv]" is-link clickable @click="cycleFont">
            <template #icon><view class="cell-ico"><l-icon name="a-large-small" :size="20" tone="info" /></view></template>
          </wd-cell>
          <wd-cell key="remind" title="学习提醒" :value="remindOn ? '每天 ' + remindTime : '未开启'" is-link clickable @click="goReminders">
            <template #icon><view class="cell-ico"><l-icon name="alarm-clock" :size="20" tone="info" /></view></template>
          </wd-cell>
          <!-- #ifdef H5 -->
          <wd-cell key="theme" title="外观模式" :value="themeLabel" is-link clickable @click="cycleTheme">
            <template #icon><view class="cell-ico"><l-icon :name="themeIcon" :size="20" tone="info" /></view></template>
          </wd-cell>
          <wd-cell key="accent" title="主题色" custom-class="acc-cell">
            <template #icon><view class="cell-ico"><l-icon name="palette" :size="20" tone="info" /></view></template>
            <view class="acc-row">
              <view
                v-for="a in themeAccents"
                :key="a.key"
                class="acc-chip"
                :class="{ on: accKey === a.key }"
                role="radio"
                :aria-checked="accKey === a.key"
                @click="setAcc(a.key)"
              >
                <view class="acc-dot" :style="{ background: a.color }"></view>
                <text class="acc-t">{{ a.label }}</text>
              </view>
            </view>
          </wd-cell>
          <wd-cell v-if="pwaInstallable" key="pwa" title="安装到桌面" value="像 App 一样从主屏打开" is-link clickable @click="installPwa">
            <template #icon><view class="cell-ico"><l-icon name="monitor-down" :size="20" tone="info" /></view></template>
          </wd-cell>
          <wd-cell v-else-if="iosInstallable" key="ios-pwa" title="安装到主屏幕" value="像 App 一样从主屏打开" is-link clickable @click="showIosGuide">
            <template #icon><view class="cell-ico"><l-icon name="monitor-down" :size="20" tone="info" /></view></template>
          </wd-cell>
          <!-- #endif -->
          <wd-cell key="offline" title="离线题包" :value="offlineN ? offlineN + ' 个题包' : '未下载'" is-link clickable @click="goOffline">
            <template #icon><view class="cell-ico"><l-icon name="package" :size="20" tone="info" /></view></template>
          </wd-cell>
          <wd-cell key="sfx" title="答题音效" clickable @click="toggleSfx">
            <template #icon><view class="cell-ico"><l-icon name="bell" :size="20" tone="info" /></view></template>
            <view class="sw-stop" @click.stop><kg-switch :model-value="sfxOn" aria-label="答题音效" @update:model-value="setSfx" /></view>
          </wd-cell>
        </wd-cell-group>

        <!-- 其他 -->
        <kg-section-header title="其他" />
        <wd-cell-group custom-class="cellcard" border>
          <wd-cell v-if="announce" key="announce" title="公告" :value="announce.title" is-link clickable @click="showAnnounce">
            <template #icon><view class="cell-ico"><l-icon name="megaphone" :size="20" tone="warn" /></view></template>
          </wd-cell>
          <wd-cell key="feedback" title="反馈与纠错" is-link clickable @click="feedback">
            <template #icon><view class="cell-ico"><l-icon name="message-circle" :size="20" tone="warn" /></view></template>
          </wd-cell>
          <wd-cell key="about" title="关于" value="答岸" is-link clickable @click="aboutOpen = true">
            <template #icon><view class="cell-ico"><l-icon name="info" :size="20" tone="warn" /></view></template>
          </wd-cell>
        </wd-cell-group>

        <view v-if="user" class="logout">
          <kg-button variant="secondary" tone="bad" size="lg" block @click="doLogout">退出登录</kg-button>
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
          <l-icon :name="bkCopied ? 'check' : 'copy'" :size="16" :tone="bkCopied ? 'ok' : 'brand-text'" />
        </view>
        <view v-if="restoreMode" class="bk-restore">
          <text class="bk-warn">注意：恢复会用云端备份覆盖当前设备尚未备份的学习记录。</text>
          <input v-model="restoreCode" class="bk-inp num" placeholder="输入 8 位恢复码，如 AB3D5F7H" maxlength="16" confirm-type="done" @confirm="submitRestore" />
        </view>
      </view>
      <template #footer>
        <view v-if="!restoreMode" class="row2">
          <kg-button variant="primary" size="lg" block :loading="bkLoading" @click="doBackup">{{ backupCode ? '更新并复制备份' : '生成恢复码' }}</kg-button>
          <kg-button variant="secondary" size="lg" block :disabled="bkLoading" @click="restoreMode = true">输入恢复码恢复</kg-button>
        </view>
        <view v-else class="row2">
          <kg-button variant="secondary" size="lg" block :disabled="bkLoading" @click="restoreMode = false">返回</kg-button>
          <kg-button variant="primary" size="lg" block :loading="bkLoading" :disabled="!restoreCode.trim()" @click="submitRestore">确认恢复并覆盖</kg-button>
        </view>
      </template>
    </kg-sheet>

    <!-- 公告 -->
    <kg-sheet v-model="announceOpen" :title="(announce && announce.title) || '公告'">
      <view class="sheet-body">
        <text class="coach-body">{{ (announce && announce.body) || '' }}</text>
      </view>
      <template #footer>
        <kg-button variant="primary" size="lg" block @click="announceOpen = false">知道了</kg-button>
      </template>
    </kg-sheet>

    <kg-confirm-sheet
      :model-value="!!fbConfirm"
      title="反馈与纠错"
      desc="题目内容纠错：答题或看解析时点「纠错」即可提交。其他建议可发邮件至 support@zalize.com"
      confirm-text="复制邮箱"
      cancel-text="关闭"
      @confirm="runFbConfirm"
      @cancel="fbConfirm = null"
    />

    <kg-confirm-sheet
      :model-value="!!logoutConfirm"
      title="退出登录？"
      desc="退出后将回到本机匿名记录，账号数据仍保留在云端。"
      confirm-text="退出登录"
      cancel-text="先留着"
      danger
      @confirm="runLogoutConfirm"
      @cancel="logoutConfirm = null"
    />

    <!-- 关于：产品链接/协议/版权统一收纳（不再散落页脚） -->
    <kg-sheet v-model="aboutOpen" title="关于">
      <view class="sheet-body">
        <text class="about-name">答岸</text>
        <text class="about-desc">考公行测刷题 · 错题本 · AI 讲解 · 真题模考</text>
        <text class="about-site">kaogong.zalize.com（网页版）</text>
        <text class="about-site">微信小程序 · 内测中</text>
        <text class="about-sec">更多产品</text>
        <view class="about-list">
          <view v-for="p in zlProducts" :key="p.url" class="about-item" role="button" @click="zlOpen(p.url)">
            <text class="about-item-t">{{ p.name }}</text>
            <l-icon name="chevron-right" :size="16" tone="faint" />
          </view>
        </view>
        <text class="about-sec">协议与支持</text>
        <view class="about-list">
          <view class="about-item" role="button" @click="zlOpen('https://career.zalize.com/privacy/')"><text class="about-item-t">隐私政策</text><l-icon name="chevron-right" :size="16" tone="faint" /></view>
          <view class="about-item" role="button" @click="zlOpen('https://career.zalize.com/terms/')"><text class="about-item-t">服务条款</text><l-icon name="chevron-right" :size="16" tone="faint" /></view>
          <view class="about-item" role="button" @click="zlOpen('https://kaogong.zalize.com/#feedback')"><text class="about-item-t">意见反馈</text><l-icon name="chevron-right" :size="16" tone="faint" /></view>
          <view class="about-item" role="button" @click="zlOpen('mailto:support@zalize.com')"><text class="about-item-t">联系我们</text><l-icon name="chevron-right" :size="16" tone="faint" /></view>
        </view>
        <text class="about-copy">© 2026 答岸 版权所有 · 运营团队：Zalize</text>
      </view>
    </kg-sheet>
  </view>
</template>

<script>
import { request, snapPeek, getAuthUser, authLogout, clearAuth, anonUid, fetchCheckinBadges, fetchCommentInbox } from '../../api/api.js';
import { syncCloudFavs } from '../../fav/fav-sync.js';
import { favsLocalOnly } from '../../exam/exam-fav.js';
import { md } from '../../utils/md.js';
import { getReminderSettings } from '../../services/reminder.js';
import { cycleThemeMode, getThemeMode, getThemeAccent, setThemeAccent, THEME_ACCENTS, THEME_LABELS } from '../../services/theme.js';
import { normFontLv } from '../../services/font-size.js';
// #ifdef H5
import { canInstall, promptInstall, onInstallable, isIosSafariInstallable } from '../../services/pwa.js';
// #endif
import { listPacks } from '../../services/offline.js';
import { checkinStreak } from '../../home/checkin.js';
import { DAILY_GOALS, adoptServerDailyGoal } from '../../home/daily-goal.js';
import { moduleLabel } from '../../utils/module-meta.js';
import { toastOk, toastInfo, toastErrFrom } from '../../utils/toast.js';

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
      favN: 0,
      inboxUnread: 0,
      teamName: '',
      dailyGoal: 20,
      fontLv: 1,
      sfxOn: true,
      remindOn: false,
      remindTime: '20:30',
      themeMode: 'system',
      themeAccents: THEME_ACCENTS,
      accKey: 'default',
      pwaInstallable: false,
      iosInstallable: false,
      offlineN: 0,
      badgeInfo: null,
      growth: null,
      coachOpen: false,
      coachHtml: cleanCoach(uni.getStorageSync('coachAdvice') || ''),
      coachLoading: false,
      bkOpen: false,
      restoreMode: false,
      restoreCode: '',
      bkCopied: false,
      aboutOpen: false,
      announceOpen: false,
      fbConfirm: null,
      logoutConfirm: null,
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
    themeIcon() {
      return this.themeMode === 'dark' ? 'moon' : this.themeMode === 'light' ? 'sun' : 'sun-moon';
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
  onLoad(opts) {
    if (opts && opts.coach) this.coachOpen = true;
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
    if (this._bkCopyTimer) { clearTimeout(this._bkCopyTimer); this._bkCopyTimer = null; }
    // #ifdef H5
    if (this._offInstallable) this._offInstallable();
    // #endif
  },
  onShow() {
    this.user = getAuthUser();
    if (uni.getStorageSync('profileCoachOpen')) {
      uni.removeStorageSync('profileCoachOpen');
      this.coachOpen = true;
    }
    this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
    this.favN = (uni.getStorageSync('favQuestions') || []).length;
    syncCloudFavs().then((list) => {
      if (list) this.favN = list.length;
    });
    this.dailyGoal = uni.getStorageSync('dailyGoal') || 20;
    this.fontLv = normFontLv(uni.getStorageSync('fontLv'));
    this.sfxOn = uni.getStorageSync('sfxOff') ? false : true;
    const rs = getReminderSettings();
    this.remindOn = rs.on;
    this.remindTime = rs.time;
    this.themeMode = getThemeMode();
    this.accKey = getThemeAccent();
    this.offlineN = listPacks().length;
    this.refreshAccountData();
  },
  methods: {
    refreshAccountData() {
      this.user = getAuthUser();
      this.teamName = this.peekTeamName();
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
      this.teamName = '';
      this.favN = (uni.getStorageSync('favQuestions') || []).length;
      syncCloudFavs().then((list) => { if (list) this.favN = list.length; });
      this.refreshAccountData();
    },
    maskPhone(p) {
      // 后端已脱敏（手机 138****1234 / 邮箱 a***@x.com）；邮箱照原样回显，二次截断会毁掉可读性
      if (!p) return '';
      return p.includes('@') ? p : p.slice(0, 3) + '****' + p.slice(-4);
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
      // 三个端点互不依赖：并发发出，各自失败只影响自身（非关键路径）
      await Promise.all([
        (async () => {
          try {
            const d = await request(pp);
            this.profile = d.profile || null;
            const g = adoptServerDailyGoal(this.dailyGoal, this.profile);
            if (g != null) {
              this.dailyGoal = g;
              uni.setStorageSync('dailyGoal', g);
            }
          } catch (e) { /* 非关键路径 */ }
        })(),
        (async () => {
          try {
            this.applyGrowth(await request(gp), uid);
          } catch (e) { /* 非关键路径 */ }
        })(),
        (async () => {
          try {
            const d = await request('/api/announcement');
            this.announce = d.item || null;
          } catch (e) { /* 非关键路径 */ }
        })(),
      ]);
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
        toastErrFrom(e, '生成失败，请稍后重试');
      }
      this.coachLoading = false;
    },
    copyCode(code) {
      const target = typeof code === 'string' && code ? code : this.backupCode;
      if (!target) return;
      uni.setClipboardData({
        data: target,
        success: () => {
          this.bkCopied = true;
          if (this._bkCopyTimer) clearTimeout(this._bkCopyTimer);
          this._bkCopyTimer = setTimeout(() => { this.bkCopied = false; }, 1800);
          toastOk('恢复码已复制');
        },
      });
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
        this.copyCode(d.code);
        toastOk('恢复码已生成并复制：' + d.code);
      } catch (e) {
        toastErrFrom(e, '备份失败，请稍后重试');
      }
      this.bkLoading = false;
    },
    async submitRestore() {
      const raw = (this.restoreCode || '').trim();
      if (!raw || this.bkLoading) return;
      this.bkLoading = true;
      await this.doRestore(raw);
      this.bkLoading = false;
    },
    async doRestore(rawCode) {
      const RESTORE_ALLOW = new Set(['pstats', 'dailyPlan', 'dailyGoal', 'groupSize', 'realMode', 'fontLv', 'beiMode', 'favQuestions', 'practiceHistory', 'coachAdvice', 'backupCode']);
      const code = String(rawCode || '').trim();
      if (!code) return;
      try {
        const d = await request('/api/backup?code=' + encodeURIComponent(code));
        Object.entries(d.data || {}).forEach(([k, v]) => {
          if (!RESTORE_ALLOW.has(k)) return;
          uni.setStorageSync(k, k === 'coachAdvice' ? cleanCoach(typeof v === 'string' ? v : '') : v);
        });
        uni.setStorageSync('favQuestions', favsLocalOnly(uni.getStorageSync('favQuestions') || []));
        uni.setStorageSync('backupCode', code.toUpperCase());
        this.backupCode = code.toUpperCase();
        this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
        this.favN = (uni.getStorageSync('favQuestions') || []).length;
        this.dailyGoal = uni.getStorageSync('dailyGoal') || 20;
        this.fontLv = normFontLv(uni.getStorageSync('fontLv'));
        this.coachHtml = cleanCoach(uni.getStorageSync('coachAdvice') || '');
        this.restoreMode = false;
        this.restoreCode = '';
        toastOk('学习数据已恢复');
      } catch (e) {
        toastErrFrom(e, '恢复失败，请确认恢复码无误');
      }
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
      toastInfo('每日目标：' + next + ' 题');
    },
    cycleFont() {
      this.fontLv = (this.fontLv + 1) % 3;
      uni.setStorageSync('fontLv', this.fontLv);
      toastInfo('字号：' + ['小', '标准', '大'][this.fontLv] + '（做题与复习页生效）');
    },
    cycleTheme() {
      this.themeMode = cycleThemeMode();
      toastInfo('外观模式：' + this.themeLabel);
    },
    setAcc(key) {
      this.accKey = key;
      setThemeAccent(key);
      toastOk('主题色已切换');
    },
    goOffline() {
      uni.navigateTo({ url: '/pkgA/user/offline' });
    },
    setSfx(v) {
      this.sfxOn = !!v;
      uni.setStorageSync('sfxOff', this.sfxOn ? '' : '1');
      toastInfo(this.sfxOn ? '音效已开启' : '音效已关闭');
    },
    toggleSfx() {
      this.setSfx(!this.sfxOn);
    },
    showAnnounce() {
      if (!this.announce) return;
      this.announceOpen = true;
    },
    feedback() {
      this.fbConfirm = () => {
        uni.setClipboardData({ data: 'support@zalize.com', success: () => toastOk('支持邮箱已复制') });
      };
    },
    runFbConfirm() {
      const fn = this.fbConfirm;
      this.fbConfirm = null;
      if (fn) fn();
    },
    zlOpen(url) {
      // #ifdef H5
      window.open(url, '_blank');
      // #endif
      // #ifndef H5
      uni.setClipboardData({ data: url, success: () => toastOk('链接已复制') });
      // #endif
    },
    doLogout() {
      this.logoutConfirm = () => {
        authLogout();
        clearAuth();
        toastOk('已退出登录');
      };
    },
    runLogoutConfirm() {
      const fn = this.logoutConfirm;
      this.logoutConfirm = null;
      if (fn) fn();
    },
  },
};
</script>

<style scoped>
.wrap { padding: var(--sp-16) var(--page-x) calc(var(--sp-40) + var(--tab-h) + env(safe-area-inset-bottom)); }

/* 账号卡 */
.acct { margin-bottom: var(--card-gap); }
.acct-row { display: flex; align-items: center; gap: var(--sp-12); }
.avatar { width: 48px; height: 48px; border-radius: var(--r-full); background: var(--brand); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.avatar-t { color: var(--on-brand); font-size: var(--fs-h2); font-weight: 600; }
.grow { flex: 1; min-width: 0; }
.acct-name { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); line-height: var(--lh-h3); }
.acct-sub { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: 2px; }
.acct-stats { margin-top: var(--sp-16); padding-top: var(--sp-16); border-top: 1px solid var(--line); }

/* 连签一行 */
.streak { margin-bottom: var(--sp-4); }
.streak-row { display: flex; align-items: center; gap: var(--sp-8); min-height: 24px; padding-right: var(--sp-24); }
.streak-t { font-size: var(--fs-body); font-weight: 500; color: var(--ink); flex-shrink: 0; white-space: nowrap; }
.streak-best { flex: 1; min-width: 0; font-size: var(--fs-caption); color: var(--ink-3); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.streak-best :deep(uni-text), .streak-best text { white-space: nowrap; }

/* cell 组边框/圆角由 App.vue .cellcard 统一治理，本页只留间距与行内排版微调 */
:deep(.cellcard) { margin-bottom: var(--sp-4); }
/* 标题不换行、右侧值单行省略：wot 默认左右各 flex:1，长标题会被挤成两行；
   title 由 <text> 渲染，uni-h5 基础样式 uni-text{white-space:pre-line} 会盖掉父级 nowrap，需下探到 text 本体 */
:deep(.cellcard .wd-cell__left) { flex: 0 0 auto; max-width: 62%; min-width: 0; }
:deep(.cellcard .wd-cell__title),
:deep(.cellcard .wd-cell__title uni-text),
:deep(.cellcard .wd-cell__title text) { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; align-content: center; }
:deep(.cellcard .wd-cell__value) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cell-ico { width: 32px; height: 32px; border-radius: var(--r-xs); background: var(--fill); display: flex; align-items: center; justify-content: center; margin-right: var(--sp-12); }

/* 主题色 chips（375px 手机与 ≥1024px 右侧 320–344px 栏均单行完整不裁切） */
:deep(.acc-cell .wd-cell__left) { max-width: none; }
:deep(.acc-cell .wd-cell__value) { overflow: visible; flex: 1; min-width: 0; }
.acc-row { display: flex; flex-wrap: nowrap; justify-content: flex-end; gap: 4px; }
.acc-chip { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; padding: 0 7px; height: var(--chip-h); border-radius: var(--r-full); border: 1px solid var(--line); background: var(--card); font-size: var(--fs-caption); color: var(--ink-2); white-space: nowrap; cursor: pointer; transition: transform var(--dur-instant) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard); }
.acc-chip:active { transform: scale(0.95); }
.acc-chip.on { border-color: var(--brand); color: var(--brand-text); background: var(--brand-soft); font-weight: var(--fw-medium); }
.acc-dot { width: 8px; height: 8px; border-radius: var(--r-full); flex-shrink: 0; }
.acc-t { font-size: var(--fs-caption); line-height: 1; white-space: nowrap; }
.sw-stop { display: inline-flex; align-items: center; }

.logout { margin-top: var(--sp-24); }

/* 迁入的两个 sheet */
.sheet-body { padding: var(--sp-4) var(--sp-16) var(--sp-16); }
.sheet-tip { display: block; font-size: var(--fs-sub); color: var(--ink-3); line-height: var(--lh-sub); margin-bottom: var(--sp-12); }
.coach-body { display: block; font-size: var(--fs-body); line-height: var(--lh-body); color: var(--ink); }
.bk-code { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); padding: 0 var(--sp-12); background: var(--brand-soft); border-radius: var(--r-sm); cursor: pointer; transition: transform var(--dur-instant) var(--ease-standard); }
.bk-code:active { transform: scale(0.985); }
.bk-code-l { font-size: var(--fs-sub); color: var(--ink-3); }
.bk-code-v { flex: 1; font-size: var(--fs-h3); font-weight: 600; color: var(--brand-text); letter-spacing: 2px; }
.bk-restore { margin-top: var(--sp-16); display: flex; flex-direction: column; gap: var(--sp-8); animation: kg-fade-in var(--dur-fast) var(--ease-decel) both; }
.bk-warn { font-size: var(--fs-caption); color: var(--warn-strong); line-height: var(--lh-caption); }
.bk-inp { width: 100%; height: var(--input-h); border: 1px solid var(--line-strong); border-radius: var(--r-sm); padding: 0 var(--sp-12); background: var(--fill); color: var(--ink); font-size: var(--fs-body); box-sizing: border-box; letter-spacing: 1.5px; }
.row2 { display: flex; gap: var(--sp-12); }
.row2 :deep(.kg-btn) { flex: 1; }

.about-name { display: block; font-size: var(--fs-h2); font-weight: 600; color: var(--ink); }
.about-desc { display: block; font-size: var(--fs-body); color: var(--ink-2); margin-top: var(--sp-4); }
.about-site { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }
.about-sec { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin: var(--sp-24) 0 var(--sp-8); }
.about-list { border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
.about-item { display: flex; align-items: center; justify-content: space-between; min-height: var(--hit-min); padding: var(--sp-12) var(--sp-16); border-bottom: 1px solid var(--line); }
.about-item:last-child { border-bottom: none; }
.about-item-t { font-size: var(--fs-sub); color: var(--ink); }
.about-copy { display: block; font-size: var(--fs-caption); color: var(--ink-3); text-align: center; margin-top: var(--sp-24); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.profile { padding-bottom: var(--sp-40); }
}
@media (min-width: 1024px) {
  .wrap.profile { max-width: 1064px; padding-top: var(--sp-24); }
  :deep(.acc-cell .cell-ico) { margin-right: var(--sp-8); }
}
/* #endif */
</style>
