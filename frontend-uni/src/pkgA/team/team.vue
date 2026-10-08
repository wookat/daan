<template>
  <view class="page team">
    <!-- 我的小队列表 -->
    <kg-two-col v-if="view === 'home'" aside-first>
      <template #aside>
        <kg-hero-card
          label="刷题小队 · 已加入"
          :value="teams.length"
          unit="队"
          :primary="{ text: '创建小队' }"
          class="hero"
          @primary="showCreate = true"
        >
          <text class="hero-s">和队友一起打卡 · 看谁今天没刷题 · 互相催学</text>
        </kg-hero-card>
        <kg-card class="join" :padding="12">
          <text class="join-t">有邀请码？直接加入</text>
          <kg-invite-input v-model="joinCode" placeholder="输入 6 位邀请码" :maxlength="8" :minlength="6" :error="joinErr" :loading="joining" @submit="joinByCode" />
        </kg-card>
      </template>
      <template #main>
        <kg-skeleton v-if="!loaded" preset="cards" />
        <kg-empty-state
          v-else-if="loadErr"
          icon="wifi-off"
          :title="'加载失败：' + loadErr"
          cta-text="重试"
          @cta="loadHome"
        />
        <kg-empty-state
          v-else-if="!teams.length"
          icon="users"
          title="还没有小队"
          desc="创建一个小队，把邀请码发给考友，一起打卡刷题！"
          cta-text="创建小队"
          @cta="showCreate = true"
        />
        <template v-else>
          <kg-section-header title="我的小队" />
          <kg-card v-for="t in teams" :key="t.id" clickable chevron class="t-row" @click="openPanel(t)">
            <view class="t-l">
              <text class="t-name">{{ t.name }}</text>
              <text class="t-sub"><text class="num">{{ t.n_members }}</text> 名队友 · 邀请码 <text class="num">{{ t.invite_code }}</text></text>
            </view>
          </kg-card>
        </template>
      </template>
    </kg-two-col>

    <!-- 小队面板 -->
    <template v-else-if="view === 'panel' && panel">
      <kg-hero-card
        :label="panel.team.name"
        :value="panel.members.length"
        unit="名队友"
        :primary="{ text: '复制邀请链接' }"
        :secondary="{ text: '退出小队' }"
        class="hero"
        @primary="copyInvite"
        @secondary="leaveTeam"
      >
        <text class="hero-s">邀请码 <text class="num">{{ panel.team.invite_code }}</text> · 发给考友即可加入</text>
      </kg-hero-card>

      <kg-two-col aside-first>
        <template #aside>
          <!-- 本周队内排行榜 -->
          <kg-card v-if="weekRank.length" class="rank-card">
            <view class="rank-head">
              <view class="rank-t"><l-icon name="trophy" :size="20" tone="warn" /><text>本周队内排行</text></view>
              <kg-button variant="text" size="sm" icon="copy" @click="copyWeekReport">复制周战报</kg-button>
            </view>
            <view v-for="(m, i) in weekRank" :key="i" class="rank-row">
              <text class="rank-no num" :class="'no' + (i + 1)">{{ i + 1 }}</text>
              <text class="rank-name">{{ m.nickname }}</text>
              <kg-tag v-if="i === 0 && m.week_n > 0" tone="warn">卷王</kg-tag>
              <kg-tag v-if="m.is_me" tone="brand">我</kg-tag>
              <text class="rank-n">本周 <text class="num">{{ m.week_n }}</text> 题</text>
            </view>
          </kg-card>
        </template>

        <template #main>
          <view class="week-head">
            <text class="wh-name">队友</text>
            <view class="wh-days">
              <text v-for="(d, i) in weekLabels" :key="i" class="wh-d" :class="{ today: i === todayIdx }">{{ d }}</text>
            </view>
          </view>

          <kg-card v-for="(m, mi) in panel.members" :key="mi" class="mem">
            <view class="mem-top">
              <view class="mem-av" :class="{ me: m.is_me }">{{ (m.nickname || '?').slice(0, 1) }}</view>
              <view class="mem-l">
                <view class="mem-name-row">
                  <text class="mem-name">{{ m.nickname }}</text>
                  <kg-tag v-if="m.is_me" tone="brand">我</kg-tag>
                  <kg-tag v-else-if="m.is_creator" tone="neutral">队长</kg-tag>
                </view>
                <text class="mem-sub">{{ memDesc(m) }}</text>
              </view>
              <kg-button v-if="!m.is_me && !m.today_n" variant="secondary" size="sm" icon="bell" @click="remind(m)">提醒 TA</kg-button>
              <text v-else-if="m.today_n" class="mem-done">今日 <text class="num">{{ m.today_n }}</text> 题</text>
            </view>
            <view class="mem-week">
              <view v-for="(n, i) in m.week" :key="i" class="wk-cell" :class="cellCls(n, i)">
                <text v-if="n" class="wk-n num">{{ n > 99 ? '99+' : n }}</text>
              </view>
            </view>
          </kg-card>
        </template>
      </kg-two-col>
    </template>

    <view v-else class="skel" aria-busy="true">
      <kg-skeleton preset="hero" />
      <kg-skeleton preset="cards" />
    </view>

    <!-- 创建小队弹层 -->
    <kg-sheet v-model="showCreate" title="创建刷题小队">
      <view class="sheet-body">
        <wd-input v-model="newName" label="小队名" placeholder="如：上岸冲刺队" :maxlength="20" clearable :focus="showCreate" @confirm="createTeam" />
      </view>
      <template #footer>
        <kg-button variant="primary" size="lg" block :disabled="creating || !newName.trim()" :loading="creating" @click="createTeam">创建并生成邀请码</kg-button>
      </template>
    </kg-sheet>
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
      joinErr: '',
      joining: false,
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
      this.joinErr = '';
      if (!code) {
        this.joinErr = '请输入邀请码';
        return;
      }
      if (this.joining) return;
      this.joining = true;
      try {
        const d = await teamJoin(code);
        uni.showToast({ title: d.already ? '你已在该小队' : '加入成功！', icon: 'none' });
        this.joinCode = '';
        this.openPanel(d.team);
      } catch (e) {
        this.joinErr = e.message || '加入失败';
      }
      this.joining = false;
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
        data: `我在答岸建了刷题小队「${t.name}」，一起打卡刷题冲上岸！邀请码 ${t.invite_code}，点链接直接加入：${this.inviteUrl()}`,
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
        data: `「${m.nickname}」今天还没刷题哦！我在答岸小队「${this.panel.team.name}」等你打卡，别掉队：${this.inviteUrl()}`,
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
.page { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.skel { display: flex; flex-direction: column; gap: var(--sp-12); }
.hero { margin-bottom: var(--card-gap); }
.hero-s { display: block; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--on-brand-2); margin-bottom: var(--sp-8); }

.join { margin-bottom: var(--card-gap); }
.join-t { display: block; font-size: var(--fs-sub); color: var(--ink-2); margin-bottom: var(--sp-8); }

.t-row { margin-bottom: var(--sp-8); }
.t-l { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.t-name { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.t-sub { font-size: var(--fs-caption); color: var(--ink-2); }

.rank-card { margin-bottom: var(--card-gap); }
.rank-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-4); }
.rank-t { display: flex; align-items: center; gap: var(--sp-4); font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.rank-row { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); border-top: 1px solid var(--line); }
.rank-row:first-of-type { border-top: none; }
.rank-no { width: 20px; text-align: center; font-size: var(--fs-body); font-weight: 600; color: var(--ink-3); flex-shrink: 0; }
.rank-no.no1 { color: var(--warn); }
.rank-no.no2 { color: var(--ink-2); }
.rank-no.no3 { color: var(--warn-strong); }
.rank-name { flex: 1; min-width: 0; font-size: var(--fs-sub); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-n { flex-shrink: 0; font-size: var(--fs-caption); color: var(--ink-2); }

.week-head { display: flex; align-items: center; padding: 0 var(--sp-4) var(--sp-8); }
.wh-name { flex: 1; font-size: var(--fs-caption); color: var(--ink-3); }
.wh-days { display: flex; gap: var(--sp-4); width: 60%; max-width: 280px; }
.wh-d { flex: 1; text-align: center; font-size: var(--fs-caption); color: var(--ink-3); }
.wh-d.today { color: var(--brand-text); font-weight: 600; }

.mem { margin-bottom: var(--sp-8); }
.mem-top { display: flex; align-items: center; gap: var(--sp-12); }
.mem-av { width: 36px; height: 36px; border-radius: var(--r-full); background: var(--brand-soft); color: var(--brand-text); font-size: var(--fs-body); font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.mem-av.me { background: var(--brand); color: var(--on-brand); }
.mem-l { flex: 1; min-width: 0; }
.mem-name-row { display: flex; align-items: center; gap: var(--sp-8); }
.mem-name { font-size: var(--fs-body); font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mem-sub { display: block; font-size: var(--fs-caption); color: var(--ink-2); margin-top: 2px; }
.mem-done { flex-shrink: 0; font-size: var(--fs-caption); color: var(--ok-strong); font-weight: 600; }
.mem-week { display: flex; gap: var(--sp-4); margin-top: var(--sp-12); }
.wk-cell { flex: 1; height: 28px; border-radius: var(--r-xs); background: var(--fill); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.wk-n { font-size: var(--fs-caption); color: var(--brand-text); }
.wk-cell.done { background: var(--brand-soft); }
.wk-cell.hot { background: var(--brand); }
.wk-cell.hot .wk-n { color: var(--on-brand); }
.wk-cell.today-empty { border: 1px dashed var(--brand); }
.wk-cell.future { background: transparent; border: 1px dashed var(--line); }

.sheet-body { padding: var(--sp-8) 0; }
</style>
