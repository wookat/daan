<template>
  <view class="wrap team">
    <!-- 我的小队列表 -->
    <template v-if="view === 'home'">
      <view class="hero">
        <view class="hero-t"><l-icon name="users" :size="22" color="#ffffff" /><text>刷题小队</text></view>
        <text class="hero-s">和队友一起打卡 · 看谁今天没刷题 · 互相催学</text>
      </view>

      <view class="tm-cols">
      <view class="tm-main">
      <view class="card" v-if="loadErr && loaded">
        <view class="empty">加载失败：{{ loadErr }}<view class="retry" @click="loadHome">重试 ›</view></view>
      </view>
      <view class="card" v-else-if="!teams.length && loaded">
        <view class="empty">还没有小队。创建一个小队，把邀请码发给考友，一起打卡刷题！</view>
      </view>
      <view v-for="t in teams" :key="t.id" class="card t-row" @click="openPanel(t)">
        <view class="t-l">
          <text class="t-name">{{ t.name }}</text>
          <text class="t-sub">{{ t.n_members }} 名队友 · 邀请码 {{ t.invite_code }}</text>
        </view>
        <text class="t-go">看队友 ›</text>
      </view>
      </view>

      <view class="tm-side">
      <view class="act-btn main" @click="showCreate = true">创建小队</view>
      <view class="join-row">
        <input v-model="joinCode" class="join-input" placeholder="输入 6 位邀请码" :maxlength="8" />
        <view class="join-btn" @click="joinByCode">加入</view>
      </view>
      </view>
      </view>
    </template>

    <!-- 小队面板 -->
    <template v-else-if="view === 'panel' && panel">
      <view class="hero">
        <view class="hero-t"><l-icon name="users" :size="22" color="#ffffff" /><text>{{ panel.team.name }}</text></view>
        <text class="hero-s">{{ panel.members.length }} 名队友 · 邀请码 {{ panel.team.invite_code }}</text>
        <view class="hero-btns">
          <view class="hero-btn" @click="copyInvite">复制邀请链接</view>
          <view class="hero-btn ghost" @click="leaveTeam">退出小队</view>
        </view>
      </view>

      <view class="tp-cols">
      <view class="tp-side">
      <!-- 本周队内排行榜 -->
      <view v-if="weekRank.length" class="card rank-card">
        <view class="rank-head">
          <text class="rank-t">🏆 本周队内排行</text>
          <view class="rank-copy" @click="copyWeekReport">复制周战报</view>
        </view>
        <view v-for="(m, i) in weekRank" :key="i" class="rank-row">
          <text class="rank-no" :class="'no' + (i + 1)">{{ i + 1 }}</text>
          <text class="rank-name">{{ m.nickname }}</text>
          <text v-if="i === 0 && m.week_n > 0" class="rank-king">卷王</text>
          <text v-if="m.is_me" class="rank-me">我</text>
          <text class="rank-n">本周 {{ m.week_n }} 题</text>
        </view>
      </view>
      </view>

      <view class="tp-main">
      <view class="week-head">
        <text class="wh-name">队友</text>
        <view class="wh-days">
          <text v-for="(d, i) in weekLabels" :key="i" class="wh-d" :class="{ today: i === todayIdx }">{{ d }}</text>
        </view>
      </view>

      <view v-for="(m, mi) in panel.members" :key="mi" class="card mem">
        <view class="mem-top">
          <view class="mem-av" :class="{ me: m.is_me }">{{ (m.nickname || '?').slice(0, 1) }}</view>
          <view class="mem-l">
            <view class="mem-name-row">
              <text class="mem-name">{{ m.nickname }}</text>
              <text v-if="m.is_me" class="mem-tag me">我</text>
              <text v-else-if="m.is_creator" class="mem-tag">队长</text>
            </view>
            <text class="mem-sub">{{ memDesc(m) }}</text>
          </view>
          <view v-if="!m.is_me && !m.today_n" class="remind-btn" @click="remind(m)">提醒 TA</view>
          <text v-else-if="m.today_n" class="mem-done">今日 {{ m.today_n }} 题</text>
        </view>
        <view class="mem-week">
          <view v-for="(n, i) in m.week" :key="i" class="wk-cell" :class="cellCls(n, i)">
            <text v-if="n" class="wk-n">{{ n > 99 ? '99+' : n }}</text>
          </view>
        </view>
      </view>
      </view>
      </view>
    </template>

    <view v-else class="card empty">加载中…</view>

    <!-- 创建小队弹层 -->
    <view v-if="showCreate" class="mask" @click="showCreate = false">
      <view class="sheet" @click.stop>
        <text class="sheet-t">创建刷题小队</text>
        <input v-model="newName" class="sheet-input" placeholder="小队名，如：上岸冲刺队" :maxlength="20" />
        <view class="sheet-btn" :class="{ off: creating }" @click="createTeam">{{ creating ? '创建中…' : '创建并生成邀请码' }}</view>
      </view>
    </view>
  </view>
</template>

<script>
import { teamMine, teamCreate, teamJoin, teamLeave, teamPanel, trackEvent } from '../../api.js';

const SITE = 'https://kaogong.zalize.com';

export default {
  data() {
    return {
      view: 'home',
      loaded: false,
      loadErr: '',
      teams: [],
      joinCode: '',
      showCreate: false,
      newName: '',
      creating: false,
      panel: null,
      curTeamId: null,
    };
  },
  computed: {
    weekLabels() {
      return ['一', '二', '三', '四', '五', '六', '日'];
    },
    todayIdx() {
      return (new Date().getDay() + 6) % 7;
    },
    weekRank() {
      if (!this.panel) return [];
      return this.panel.members
        .map((m) => ({ ...m, week_n: (m.week || []).reduce((a, b) => a + b, 0) }))
        .sort((a, b) => b.week_n - a.week_n);
    },
  },
  onLoad(query) {
    if (query && query.id) {
      this.openPanel({ id: Number(query.id) });
      return;
    }
    this.loadHome();
  },
  onShow() {
    if (!this.loaded) return;
    if (this.view === 'home') this.loadHome();
    else if (this.view === 'panel' && this.curTeamId) this.refreshPanel();
  },
  methods: {
    async loadHome() {
      this.loadErr = '';
      try {
        const d = await teamMine();
        this.teams = d.items || [];
      } catch (e) {
        this.loadErr = e.message || '网络异常';
      }
      this.loaded = true;
    },
    async refreshPanel() {
      try {
        this.panel = await teamPanel(this.curTeamId);
      } catch (e) { /* 非关键路径 */ }
    },
    async openPanel(t) {
      try {
        uni.showLoading({ title: '加载中…' });
        const d = await teamPanel(t.id);
        uni.hideLoading();
        this.panel = d;
        this.curTeamId = t.id;
        this.view = 'panel';
      } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: e.message || '加载失败', icon: 'none' });
      }
    },
    async createTeam() {
      const name = (this.newName || '').trim();
      if (!name) return uni.showToast({ title: '请输入小队名', icon: 'none' });
      if (this.creating) return;
      this.creating = true;
      try {
        const d = await teamCreate(name);
        this.showCreate = false;
        this.newName = '';
        uni.showToast({ title: '小队已创建', icon: 'none' });
        this.openPanel(d.team);
      } catch (e) {
        uni.showToast({ title: e.message || '创建失败', icon: 'none' });
      }
      this.creating = false;
    },
    async joinByCode() {
      const code = (this.joinCode || '').trim().toUpperCase();
      if (!code) return uni.showToast({ title: '请输入邀请码', icon: 'none' });
      try {
        uni.showLoading({ title: '加入中…' });
        const d = await teamJoin(code);
        uni.hideLoading();
        uni.showToast({ title: d.already ? '你已在该小队' : '加入成功！', icon: 'none' });
        this.joinCode = '';
        this.openPanel(d.team);
      } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: e.message || '加入失败', icon: 'none' });
      }
    },
    leaveTeam() {
      uni.showModal({
        title: '退出小队',
        content: '退出后将不再显示在队友面板中，可凭邀请码重新加入。',
        success: async (r) => {
          if (!r.confirm) return;
          try {
            await teamLeave(this.curTeamId);
            uni.showToast({ title: '已退出小队', icon: 'none' });
            this.view = 'home';
            this.panel = null;
            this.loadHome();
          } catch (e) {
            uni.showToast({ title: e.message || '退出失败', icon: 'none' });
          }
        },
      });
    },
    inviteUrl() {
      return `${SITE}/#/pages/team/join?code=${this.panel.team.invite_code}`;
    },
    copyInvite() {
      const t = this.panel.team;
      trackEvent('team_invite_copy', 'team', t.invite_code);
      uni.setClipboardData({
        data: `我在错题邦建了刷题小队「${t.name}」，一起打卡刷题冲上岸！邀请码 ${t.invite_code}，点链接直接加入：${this.inviteUrl()}`,
        success: () => uni.showToast({ title: '邀请链接已复制，发给考友吧', icon: 'none' }),
      });
    },
    copyWeekReport() {
      const t = this.panel.team;
      const rank = this.weekRank;
      const totalN = rank.reduce((a, m) => a + m.week_n, 0);
      const upto = this.todayIdx + 1;
      let dayCnt = 0;
      this.panel.members.forEach((m) => {
        (m.week || []).slice(0, upto).forEach((n) => { if (n > 0) dayCnt += 1; });
      });
      const king = rank[0] && rank[0].week_n > 0 ? `，卷王是「${rank[0].nickname}」（${rank[0].week_n} 题）` : '';
      trackEvent('team_report_copy', 'team', t.invite_code);
      uni.setClipboardData({
        data: `📊刷题小队「${t.name}」本周战报：全队共刷 ${totalN} 题，打卡 ${dayCnt} 人天${king}。一起打卡冲上岸，邀请码 ${t.invite_code}，点链接加入：${this.inviteUrl()}`,
        success: () => uni.showToast({ title: '周战报已复制，发到微信群吧', icon: 'none' }),
      });
    },
    remind(m) {
      uni.setClipboardData({
        data: `「${m.nickname}」今天还没刷题哦！我在错题邦小队「${this.panel.team.name}」等你打卡，别掉队：${this.inviteUrl()}`,
        success: () => uni.showToast({ title: '催打卡文案已复制，发给 TA 吧', icon: 'none' }),
      });
    },
    memDesc(m) {
      const parts = [];
      parts.push(m.streak ? `连续打卡 ${m.streak} 天` : '打卡中断');
      if (m.today_n) parts.push(`今日正确率 ${m.today_acc}%`);
      else parts.push('今天还没刷题');
      if (m.last_active) parts.push(this.fmtAgo(m.last_active));
      return parts.join(' · ');
    },
    fmtAgo(ts) {
      const s = Date.now() / 1000 - ts;
      if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} 分钟前活跃`;
      if (s < 86400) return `${Math.floor(s / 3600)} 小时前活跃`;
      return `${Math.floor(s / 86400)} 天前活跃`;
    },
    cellCls(n, i) {
      if (i > this.todayIdx) return 'future';
      if (!n) return i === this.todayIdx ? 'today-empty' : 'miss';
      return n >= 20 ? 'hot' : 'done';
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 60rpx; }
.card { background: var(--card); border-radius: 28rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 24rpx 28rpx; margin-bottom: 20rpx; }
.empty { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 30rpx 0; line-height: 1.7; }
.retry { margin-top: 12rpx; color: var(--brand-text); font-size: 26rpx; font-weight: 500; }

.hero { background: linear-gradient(135deg, #5b8af8, #2e5bff); border-radius: 32rpx; padding: 36rpx 32rpx; margin-bottom: 24rpx; box-shadow: 0 12rpx 36rpx rgba(46, 91, 255, 0.3); }
.hero-t { display: flex; align-items: center; gap: 12rpx; color: #fff; font-size: 40rpx; font-weight: 800; }
.hero-s { display: block; color: rgba(255, 255, 255, 0.85); font-size: 24rpx; margin-top: 10rpx; }
.hero-btns { display: flex; gap: 16rpx; margin-top: 22rpx; }
.hero-btn { flex: 1; min-height: 40px; display: flex; align-items: center; justify-content: center; background: #fff; color: var(--brand-text); border-radius: 999rpx; font-size: 26rpx; font-weight: 600; }
.hero-btn.ghost { background: rgba(255, 255, 255, 0.16); color: #fff; }

.t-row { display: flex; align-items: center; gap: 16rpx; }
.t-l { flex: 1; min-width: 0; }
.t-name { display: block; font-size: 30rpx; font-weight: 700; color: var(--ink); }
.t-sub { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 6rpx; }
.t-go { flex-shrink: 0; font-size: 26rpx; color: var(--brand-text); font-weight: 600; }

.act-btn { min-height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 999rpx; font-size: 30rpx; font-weight: 600; margin-bottom: 18rpx; }
.act-btn.main { background: var(--brand); color: #fff; }

.join-row { display: flex; gap: 16rpx; }
.join-input { flex: 1; background: var(--card); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 0 30rpx; min-height: 44px; font-size: 28rpx; box-sizing: border-box; }
.join-btn { min-height: 44px; display: flex; align-items: center; padding: 0 40rpx; background: var(--brand-soft); color: var(--brand-text); border-radius: 999rpx; font-size: 28rpx; font-weight: 600; }

/* 本周排行榜 */
.rank-card { padding: 24rpx 28rpx; }
.rank-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8rpx; }
.rank-t { font-size: 28rpx; font-weight: 700; color: var(--ink); }
.rank-copy { min-height: 32px; display: flex; align-items: center; padding: 0 22rpx; background: var(--brand-soft); color: var(--brand-text); border-radius: 999rpx; font-size: 22rpx; font-weight: 600; }
.rank-row { display: flex; align-items: center; gap: 14rpx; padding: 14rpx 0; border-bottom: 1rpx solid var(--fill); }
.rank-row:last-child { border-bottom: none; }
.rank-no { width: 40rpx; text-align: center; font-size: 24rpx; font-weight: 800; color: var(--ink-3); }
.rank-no.no1 { color: #d97706; }
.rank-no.no2 { color: #6b7280; }
.rank-no.no3 { color: #b45309; }
.rank-name { flex: 1; min-width: 0; font-size: 26rpx; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-king { font-size: 20rpx; color: #d97706; background: #fef3c7; border-radius: 8rpx; padding: 2rpx 12rpx; font-weight: 700; }
.rank-me { font-size: 20rpx; color: var(--brand-text); background: var(--brand-soft); border-radius: 8rpx; padding: 2rpx 10rpx; }
.rank-n { font-size: 24rpx; color: var(--ink-2); font-weight: 600; }

/* 打卡矩阵 */
.week-head { display: flex; align-items: center; padding: 0 28rpx; margin-bottom: 12rpx; }
.wh-name { width: 96rpx; font-size: 22rpx; color: var(--ink-3); }
.wh-days { flex: 1; display: flex; gap: 10rpx; margin-left: 20rpx; }
.wh-d { flex: 1; text-align: center; font-size: 22rpx; color: var(--ink-3); }
.wh-d.today { color: var(--brand-text); font-weight: 700; }

.mem { padding: 22rpx 28rpx; }
.mem-top { display: flex; align-items: center; gap: 18rpx; }
.mem-av { width: 72rpx; height: 72rpx; border-radius: 50%; background: var(--brand-soft); color: var(--brand-text); font-size: 30rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.mem-av.me { background: linear-gradient(135deg, #5b8af8, #2e5bff); color: #fff; }
.mem-l { flex: 1; min-width: 0; }
.mem-name-row { display: flex; align-items: center; gap: 10rpx; }
.mem-name { font-size: 28rpx; font-weight: 700; color: var(--ink); max-width: 260rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mem-tag { font-size: 20rpx; color: #d97706; background: #fef3c7; border-radius: 8rpx; padding: 2rpx 10rpx; }
.mem-tag.me { color: var(--brand-text); background: var(--brand-soft); }
.mem-sub { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 6rpx; }
.remind-btn { flex-shrink: 0; min-height: 36px; display: flex; align-items: center; padding: 0 24rpx; background: #fef3c7; color: #b45309; border-radius: 999rpx; font-size: 24rpx; font-weight: 600; }
.mem-done { flex-shrink: 0; font-size: 24rpx; color: var(--ok); font-weight: 700; }

.mem-week { display: flex; gap: 10rpx; margin-top: 18rpx; margin-left: 90rpx; }
.wk-cell { flex: 1; height: 52rpx; border-radius: 10rpx; background: var(--fill); display: flex; align-items: center; justify-content: center; }
.wk-cell.done { background: #dbeafe; }
.wk-cell.hot { background: var(--brand); }
.wk-cell.hot .wk-n { color: #fff; }
.wk-cell.miss { background: var(--fill); }
.wk-cell.today-empty { background: var(--fill); border: 1rpx dashed var(--brand); box-sizing: border-box; }
.wk-cell.future { background: transparent; border: 1rpx dashed var(--line); box-sizing: border-box; }
.wk-n { font-size: 20rpx; color: var(--brand-text); font-weight: 700; }

/* 弹层 */
.mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 99; display: flex; align-items: flex-end; }
.sheet { width: 100%; background: var(--card); border-radius: 32rpx 32rpx 0 0; padding: 40rpx 40rpx calc(40rpx + env(safe-area-inset-bottom)); box-sizing: border-box; }
.sheet-t { display: block; font-size: 32rpx; font-weight: 700; color: var(--ink); margin-bottom: 26rpx; }
.sheet-input { background: var(--fill); border-radius: 16rpx; padding: 0 26rpx; min-height: 44px; font-size: 28rpx; margin-bottom: 26rpx; box-sizing: border-box; width: 100%; }
.sheet-btn { min-height: 44px; display: flex; align-items: center; justify-content: center; background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 30rpx; font-weight: 600; }
.sheet-btn.off { opacity: 0.6; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.team { max-width: 1044px; margin: 0 auto; }
  .mask { justify-content: center; align-items: center; }
  .sheet { width: 520px; border-radius: 24rpx; }
  .t-row:hover, .act-btn:hover, .join-btn:hover, .hero-btn:hover, .remind-btn:hover, .rank-copy:hover, .sheet-btn:hover { cursor: pointer; }
  .t-row:hover { background: var(--soft-bg, #f5f6fa); }
}

@media (min-width: 1024px) {
  .tm-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .tm-main { flex: 1; min-width: 0; }
  .tm-side { width: 360px; flex: none; position: sticky; top: 24rpx; }
  .tm-side .act-btn.main { margin-top: 0; }

  .tp-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .tp-side { width: 360px; flex: none; position: sticky; top: 24rpx; }
  .tp-main { flex: 1; min-width: 0; }
  .tp-main .week-head { margin-top: 0; }
}
/* #endif */
</style>
