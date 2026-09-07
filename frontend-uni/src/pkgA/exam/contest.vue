<template>
  <view class="wrap">
    <view v-if="loading" class="spin">比赛信息加载中…</view>

    <template v-else>
      <view class="ct-cols">
      <view class="ct-main">
      <!-- 当前/下一场比赛卡 -->
      <view v-if="event" class="card hero">
        <view class="hero-top">
          <text class="hero-series">{{ event.series === 'weekly' ? '每周六 · 全站同卷' : '专场比赛' }}</text>
          <text class="hero-phase" :class="event.phase">{{ phaseText }}</text>
        </view>
        <text class="hero-title">{{ event.title }}</text>
        <text class="hero-paper">{{ event.paper_title }} · {{ event.n_questions }} 题 · {{ event.duration_min }} 分钟</text>
        <view class="hero-meta">
          <text class="hm">{{ fmtWindow }}</text>
          <text class="hm">{{ event.registered || event.submitted ? event.registered + ' 人报名 · ' + event.submitted + ' 人交卷' : '本场首批报名开放中 · 全站同卷' }}</text>
        </view>

        <!-- 未开始：倒计时 + 报名 -->
        <template v-if="event.phase === 'upcoming'">
          <view class="count">距开赛 <text class="count-n">{{ countdown }}</text></view>
          <view v-if="event.my_state === '未报名'" class="cta" @click="register">预约报名</view>
          <view v-else class="cta done">已报名，开赛后可进入</view>
        </template>

        <!-- 进行中：剩余时间 + 进入考试 -->
        <template v-else-if="event.phase === 'running'">
          <view class="count">距截止 <text class="count-n">{{ countdown }}</text></view>
          <view v-if="event.my_state === '已交卷'" class="score-line">
            <text>本场成绩 <text class="score-n">{{ event.my_score }}</text> 分</text>
            <view class="cta sub" @click="openReport(event.id)">查看实时排名与报告 ›</view>
          </view>
          <view v-else class="cta" @click="enter">{{ event.my_state === '已报名' ? '进入考试' : '立即参赛' }}</view>
        </template>

        <!-- 已结束：冻结排名 -->
        <template v-else>
          <view v-if="event.my_score != null" class="score-line">
            <text>本场成绩 <text class="score-n">{{ event.my_score }}</text> 分<template v-if="event.my_rank"> · 第 {{ event.my_rank }} 名</template></text>
            <view class="cta sub" @click="openReport(event.id)">查看赛后报告 ›</view>
          </view>
          <template v-else>
            <view class="cta ghost" @click="practice">比赛已结束 · 作为普通试卷练习</view>
            <view v-if="event.submitted" class="cta sub" @click="openBoard(event)">围观本场榜单 ›</view>
          </template>
        </template>
      </view>
      <view v-else-if="loadErr" class="card spin">加载失败：{{ loadErr }}<view class="retry" @click="load">重试 ›</view></view>
      <view v-else class="card spin">暂无比赛场次</view>
      </view>

      <view class="ct-side">
      <!-- 往期成绩 -->
      <view v-if="past.length" class="card">
        <view class="h">往期比赛</view>
        <view v-for="p in past" :key="p.id" class="prow" @click="p.joined ? openReport(p.id) : openBoard(p)">
          <view class="prow-l">
            <text class="prow-t">{{ p.title }}</text>
            <text class="prow-s">{{ fmtDay(p.close_at) }}</text>
          </view>
          <text v-if="p.joined" class="prow-score">{{ p.score }} 分<template v-if="p.rank"> · 第 {{ p.rank }} 名</template></text>
          <text v-else class="prow-none">未参加 · 看榜单 ›</text>
        </view>
      </view>

      <!-- 公共榜单弹层（非参赛者也可围观） -->
      <view v-if="board || boardLoading" class="mask" @click="closeBoard">
        <view class="sheet" @click.stop>
          <view class="sheet-h">
            <text class="sheet-t">{{ boardTitle }} · 榜单</text>
            <text class="sheet-x" @click="closeBoard">✕</text>
          </view>
          <view v-if="boardLoading" class="spin">榜单加载中…</view>
          <template v-else-if="board">
            <view class="board-meta">
              <text class="hm">{{ board.total }} 人交卷 · 平均 {{ board.avg }} 分</text>
              <text v-if="!board.frozen" class="hm">排名实时变化中</text>
            </view>
            <view v-if="!board.top || !board.top.length" class="spin">本场暂无交卷成绩</view>
            <view v-for="(t, i) in board.top" :key="i" class="brow" :class="{ me: t.me }">
              <text class="brow-r" :class="'r' + t.rank">{{ t.rank }}</text>
              <text class="brow-n">{{ t.nickname }}<text v-if="t.me" class="brow-me">（我）</text></text>
              <text class="brow-s">{{ t.score }} 分</text>
            </view>
          </template>
        </view>
      </view>

      <!-- 赛制说明（可折叠） -->
      <view class="card">
        <view class="h rules-h" @click="rulesOpen = !rulesOpen">
          <text>赛制说明</text>
          <text class="rules-arrow">{{ rulesOpen ? '收起 ▲' : '展开 ▼' }}</text>
        </view>
        <view v-if="rulesOpen" class="rules">
          <text class="rule">1. 每周六 09:00-24:00（东八区）全站同卷比赛，报名可选，开赛后随时进入。</text>
          <text class="rule">2. 只有比赛窗口内交卷的成绩计入排名，且以首次交卷为准。</text>
          <text class="rule">3. 交卷后即可看到成绩与实时排名，比赛结束后排名冻结并生成赛后报告。</text>
          <text class="rule">4. 比赛结束后试卷转为普通试卷，可自由练习，不影响比赛榜单。</text>
          <text class="rule">5. 参赛人数较少时，报告会同时展示历史同卷分数池作为参照。</text>
        </view>
      </view>
      </view>
      </view>
    </template>
  </view>
</template>

<script>
import { request, anonUid, pkNickname } from '../../api.js';

export default {
  data() {
    return {
      loading: true,
      loadErr: '',
      event: null,
      past: [],
      rulesOpen: false,
      nowSec: Math.floor(Date.now() / 1000),
      timer: null,
      board: null,
      boardTitle: '',
      boardLoading: false,
    };
  },
  computed: {
    phaseText() {
      return { upcoming: '未开始', running: '进行中', ended: '已结束' }[this.event.phase] || '';
    },
    fmtWindow() {
      const o = new Date(this.event.open_at * 1000);
      const c = new Date(this.event.close_at * 1000);
      const p = (n) => String(n).padStart(2, '0');
      return `${o.getMonth() + 1}月${o.getDate()}日 ${p(o.getHours())}:${p(o.getMinutes())} - ${c.getHours() === 0 ? '24:00' : p(c.getHours()) + ':' + p(c.getMinutes())}`;
    },
    countdown() {
      const target = this.event.phase === 'upcoming' ? this.event.open_at : this.event.close_at;
      let s = Math.max(0, Math.floor(target - this.nowSec));
      const d = Math.floor(s / 86400); s %= 86400;
      const h = Math.floor(s / 3600); s %= 3600;
      const m = Math.floor(s / 60);
      return (d ? d + ' 天 ' : '') + h + ' 时 ' + m + ' 分';
    },
  },
  onShow() {
    this.load();
    this.timer = setInterval(() => {
      this.nowSec = Math.floor(Date.now() / 1000);
      if (this.event && this.event.phase === 'upcoming' && this.nowSec >= this.event.open_at) this.load();
      if (this.event && this.event.phase === 'running' && this.nowSec >= this.event.close_at) this.load();
    }, 30000);
  },
  onHide() { this.stopTimer(); },
  onUnload() { this.stopTimer(); },
  methods: {
    stopTimer() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },
    async load() {
      this.loadErr = '';
      try {
        const d = await request('/api/mock/events?uid=' + encodeURIComponent(anonUid()));
        this.event = d.current || d.next;
        this.past = d.past || [];
      } catch (e) {
        this.loadErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async register() {
      try {
        await request('/api/mock/events/' + this.event.id + '/register', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname() } });
        uni.showToast({ title: '报名成功，周六见！', icon: 'none' });
        this.load();
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' });
      }
    },
    async enter() {
      try {
        const d = await request('/api/mock/events/' + this.event.id + '/enter', { method: 'POST', data: { uid: anonUid(), nickname: pkNickname() } });
        uni.navigateTo({ url: '/pkgA/exam/exam?paper_id=' + d.paper_id + '&event_id=' + this.event.id });
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' });
      }
    },
    practice() {
      uni.navigateTo({ url: '/pkgA/exam/exam?paper_id=' + this.event.paper_id });
    },
    openReport(eventId) {
      uni.navigateTo({ url: '/pkgA/exam/contest-report?event_id=' + eventId });
    },
    async openBoard(ev) {
      this.boardTitle = ev.title;
      this.board = null;
      this.boardLoading = true;
      try {
        this.board = await request('/api/mock/events/' + ev.id + '/rank?uid=' + encodeURIComponent(anonUid()));
      } catch (e) {
        this.boardLoading = false;
        uni.showToast({ title: e.message, icon: 'none' });
        return;
      }
      this.boardLoading = false;
    },
    closeBoard() {
      this.board = null;
      this.boardLoading = false;
    },
    fmtDay(t) {
      const d = new Date(t * 1000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 60rpx 24rpx; }
.retry { margin-top: 12rpx; color: var(--brand-text); font-size: 26rpx; font-weight: 500; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 600; margin-bottom: 20rpx; }
.hero { background: linear-gradient(135deg, #eef3ff, #fdfbf3); }
.theme-dark .hero { background: linear-gradient(135deg, #232a3d, #262330); }
.hero-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.hero-series { font-size: 22rpx; color: var(--brand-text); background: var(--brand-soft); border-radius: 8rpx; padding: 4rpx 14rpx; }
.hero-phase { font-size: 22rpx; font-weight: 600; border-radius: 999rpx; padding: 4rpx 18rpx; }
.hero-phase.upcoming { color: var(--warn-strong); background: var(--warn-soft); }
.hero-phase.running { color: #15803d; background: var(--ok-soft); }
.hero-phase.ended { color: var(--ink-2); background: var(--soft-bg); }
.hero-title { display: block; font-size: 34rpx; font-weight: 800; color: var(--ink); }
.hero-paper { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 8rpx; }
.hero-meta { display: flex; gap: 24rpx; flex-wrap: wrap; margin-top: 12rpx; }
.hm { font-size: 24rpx; color: var(--ink-2); }
.count { font-size: 26rpx; color: var(--ink-2); margin-top: 20rpx; }
.count-n { font-size: 30rpx; font-weight: 700; color: #d97706; }
.cta { margin-top: 20rpx; min-height: 44px; display: flex; align-items: center; justify-content: center; background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 28rpx; font-weight: 600; }
.cta.done { background: var(--ok-soft); color: #15803d; }
.cta.ghost { background: var(--card); color: var(--brand-text); border: 1rpx solid var(--brand); }
.cta.sub { margin-top: 12rpx; background: var(--card); color: var(--brand-text); border: 1rpx solid var(--brand); }
.score-line { margin-top: 20rpx; font-size: 26rpx; color: var(--ink); }
.score-n { font-size: 40rpx; font-weight: 800; color: var(--brand-text); }
.prow { display: flex; justify-content: space-between; align-items: center; min-height: 44px; padding: 12rpx 0; border-bottom: 1rpx solid var(--line); }
.prow:last-child { border-bottom: none; }
.prow-l { flex: 1; min-width: 0; margin-right: 16rpx; }
.prow-t { display: block; font-size: 26rpx; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prow-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.prow-score { flex-shrink: 0; font-size: 26rpx; font-weight: 700; color: var(--brand-text); }
.prow-none { flex-shrink: 0; font-size: 24rpx; color: var(--ink-3); }
.rules-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0; }
.rules-arrow { font-size: 22rpx; color: var(--ink-2); font-weight: 400; }
.rules { margin-top: 16rpx; }
.rule { display: block; font-size: 24rpx; color: var(--ink-2); line-height: 1.8; margin-bottom: 8rpx; }
.mask { position: fixed; inset: 0; background: rgba(15, 18, 26, 0.5); z-index: 60; display: flex; align-items: flex-end; }
.sheet { width: 100%; max-height: 70vh; overflow-y: auto; background: var(--card); border-radius: 32rpx 32rpx 0 0; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.sheet-t { font-size: 30rpx; font-weight: 700; color: var(--ink); }
.sheet-x { font-size: 30rpx; color: var(--ink-2); padding: 8rpx 16rpx; }
.board-meta { display: flex; justify-content: space-between; margin-bottom: 16rpx; }
.brow { display: flex; align-items: center; min-height: 44px; padding: 10rpx 0; border-bottom: 1rpx solid var(--line); }
.brow:last-child { border-bottom: none; }
.brow.me { background: var(--brand-soft); border-radius: 12rpx; padding-left: 8rpx; padding-right: 8rpx; }
.brow-r { width: 64rpx; font-size: 28rpx; font-weight: 800; color: var(--ink-2); }
.brow-r.r1 { color: #d97706; }
.brow-r.r2 { color: #6b7280; }
.brow-r.r3 { color: #b45309; }
.brow-n { flex: 1; min-width: 0; font-size: 26rpx; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.brow-me { color: var(--brand-text); font-size: 22rpx; }
.brow-s { flex-shrink: 0; font-size: 26rpx; font-weight: 700; color: var(--brand-text); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .prow:hover, .cta:hover, .rules-h:hover, .brow:hover, .sheet-x:hover { cursor: pointer; }
  .prow:hover { background: var(--soft-bg, #f5f6fa); border-radius: 12rpx; }
  .mask { align-items: center; justify-content: center; }
  .sheet { max-width: 560px; border-radius: 32rpx; padding-bottom: 28rpx; }
}
@media (min-width: 1024px) {
  .ct-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .ct-main { flex: 1; min-width: 0; }
  .ct-side { width: 360px; flex: none; position: sticky; top: 24rpx; }
}
/* #endif */
</style>
