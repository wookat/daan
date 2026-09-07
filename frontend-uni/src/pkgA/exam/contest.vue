<template>
  <view class="page">
    <kg-skeleton v-if="loading" preset="cards" />

    <kg-two-col v-else>
      <template #main>
        <!-- 当前/下一场比赛 -->
        <kg-card v-if="event" variant="raised" class="hero">
          <view class="hero-top">
            <kg-tag tone="brand">{{ event.series === 'weekly' ? '每周六 · 全站同卷' : '专场比赛' }}</kg-tag>
            <kg-tag :tone="event.phase === 'running' ? 'ok' : event.phase === 'upcoming' ? 'warn' : 'neutral'">{{ phaseText }}</kg-tag>
          </view>
          <text class="hero-title">{{ event.title }}</text>
          <text class="hero-paper">{{ event.paper_title }} · {{ event.n_questions }} 题 · {{ event.duration_min }} 分钟</text>
          <view class="hero-meta">
            <text class="hm num">{{ fmtWindow }}</text>
            <text class="hm">{{ event.registered || event.submitted ? event.registered + ' 人报名 · ' + event.submitted + ' 人交卷' : '本场首批报名开放中 · 全站同卷' }}</text>
          </view>

          <template v-if="event.phase === 'upcoming'">
            <view class="count"><l-icon name="timer" :size="16" tone="warn" /><text>距开赛 </text><text class="count-n num">{{ countdown }}</text></view>
            <kg-button v-if="event.my_state === '未报名'" block size="lg" @click="register">预约报名</kg-button>
            <view v-else class="done-line"><l-icon name="circle-check" :size="20" tone="ok" /><text>已报名，开赛后可进入</text></view>
          </template>

          <template v-else-if="event.phase === 'running'">
            <view class="count"><l-icon name="timer" :size="16" tone="warn" /><text>距截止 </text><text class="count-n num">{{ countdown }}</text></view>
            <template v-if="event.my_state === '已交卷'">
              <text class="score-line">本场成绩 <text class="score-n num">{{ event.my_score }}</text> 分</text>
              <kg-button block size="lg" variant="ghost" @click="openReport(event.id)">查看实时排名与报告</kg-button>
            </template>
            <kg-button v-else block size="lg" @click="enter">{{ event.my_state === '已报名' ? '进入考试' : '立即参赛' }}</kg-button>
          </template>

          <template v-else>
            <template v-if="event.my_score != null">
              <text class="score-line">本场成绩 <text class="score-n num">{{ event.my_score }}</text> 分<template v-if="event.my_rank"> · 第 {{ event.my_rank }} 名</template></text>
              <kg-button block size="lg" @click="openReport(event.id)">查看赛后报告</kg-button>
            </template>
            <template v-else>
              <kg-button block size="lg" variant="ghost" @click="practice">比赛已结束 · 作为普通试卷练习</kg-button>
              <kg-button v-if="event.submitted" block size="md" variant="text" @click="openBoard(event)">围观本场榜单</kg-button>
            </template>
          </template>
        </kg-card>
        <kg-empty-state v-else-if="loadErr" icon="wifi-off" title="比赛信息加载失败" :desc="loadErr" cta-text="重试" @cta="load" />
        <kg-empty-state v-else icon="trophy" title="暂无比赛场次" desc="每周六 09:00 全站同卷模考大赛，先去卷库练一卷热热身" cta-text="去卷库" cta-to="/pkgA/exam/list" />

        <!-- 往期成绩：折叠成一行，点开展开 -->
        <kg-card v-if="past.length" variant="flat" class="sec">
          <view class="fold-h" role="button" :aria-expanded="pastOpen ? 'true' : 'false'" @click="pastOpen = !pastOpen">
            <text class="h">往期比赛 · {{ past.length }} 场</text>
            <l-icon name="chevron-down" :size="20" tone="ink-2" :class="{ flip: pastOpen }" class="fold-ico" />
          </view>
          <template v-if="pastOpen">
            <view v-for="p in past" :key="p.id" class="prow" role="button" hover-class="row--hover" @click="p.joined ? openReport(p.id) : openBoard(p)">
              <view class="prow-l">
                <text class="prow-t">{{ p.title }}</text>
                <text class="prow-s num">{{ fmtDay(p.close_at - 1) }}</text>
              </view>
              <text v-if="p.joined" class="prow-score num">{{ p.score }} 分<template v-if="p.rank"> · 第 {{ p.rank }} 名</template></text>
              <text v-else class="prow-none">未参加 · 看榜单</text>
              <l-icon name="chevron-right" :size="16" tone="faint" />
            </view>
          </template>
        </kg-card>
      </template>

      <template #aside>
        <kg-card variant="flat" class="sec rules-card">
          <view class="fold-h" role="button" :aria-expanded="rulesOpen ? 'true' : 'false'" @click="rulesOpen = !rulesOpen">
            <text class="h">赛制说明</text>
            <l-icon name="chevron-down" :size="20" tone="ink-2" :class="{ flip: rulesOpen }" class="fold-ico" />
          </view>
          <view v-if="rulesOpen" class="rules">
            <text class="rule">1. 每周六 09:00-24:00（东八区）全站同卷比赛，报名可选，开赛后随时进入。</text>
            <text class="rule">2. 只有比赛窗口内交卷的成绩计入排名，且以首次交卷为准。</text>
            <text class="rule">3. 交卷后即可看到成绩与实时排名，比赛结束后排名冻结并生成赛后报告。</text>
            <text class="rule">4. 比赛结束后试卷转为普通试卷，可自由练习，不影响比赛榜单。</text>
            <text class="rule">5. 参赛人数较少时，报告会同时展示历史同卷分数池作为参照。</text>
          </view>
        </kg-card>
      </template>
    </kg-two-col>

    <!-- 公共榜单（非参赛者也可围观） -->
    <kg-sheet :model-value="!!(board || boardLoading)" :title="boardTitle + ' · 榜单'" @update:model-value="!$event && closeBoard()">
      <kg-skeleton v-if="boardLoading" preset="lines" />
      <template v-else-if="board">
        <view class="board-meta">
          <text class="hm">{{ board.total }} 人交卷 · 平均 {{ board.avg }} 分</text>
          <text v-if="!board.frozen" class="hm">排名实时变化中</text>
        </view>
        <kg-empty-state v-if="!board.top || !board.top.length" compact icon="inbox" title="本场暂无交卷成绩" />
        <view v-for="(t, i) in board.top" :key="i" class="brow" :class="{ me: t.me }">
          <kg-tag :tone="t.rank === 1 ? 'warn' : t.rank <= 3 ? 'brand' : 'neutral'" class="brow-r">{{ t.rank }}</kg-tag>
          <text class="brow-n">{{ t.nickname }}<text v-if="t.me" class="brow-me">（我）</text></text>
          <text class="brow-s num">{{ t.score }} 分</text>
        </view>
      </template>
    </kg-sheet>
  </view>
</template>

<script>
import { request, anonUid, pkNickname } from '../../api.js';
import { fmtWindow as fmtWindowCst, fmtDay as fmtDayCst } from '../../contest-time.js';

export default {
  data() {
    return {
      loading: true,
      loadErr: '',
      event: null,
      past: [],
      rulesOpen: false,
      pastOpen: false,
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
      return fmtWindowCst(this.event.open_at, this.event.close_at);
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
      return fmtDayCst(t);
    },
  },
};
</script>

<style scoped>
.page { padding: var(--sp-16) var(--page-x) var(--sp-40); }
.h { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.sec { margin-top: var(--card-gap); }
.hero-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-12); }
.hero-title { display: block; font-size: var(--fs-h2); font-weight: 600; color: var(--ink); line-height: var(--lh-h2); }
.hero-paper { display: block; font-size: var(--fs-sub); color: var(--ink-2); margin-top: var(--sp-4); }
.hero-meta { display: flex; gap: var(--sp-16); flex-wrap: wrap; margin-top: var(--sp-8); }
.hm { font-size: var(--fs-caption); color: var(--ink-3); }
.count { display: flex; align-items: center; gap: var(--sp-4); font-size: var(--fs-sub); color: var(--ink-2); margin: var(--sp-16) 0 var(--sp-12); }
.count-n { font-size: var(--fs-h3); font-weight: 600; color: var(--warn-strong); }
.done-line { display: flex; align-items: center; justify-content: center; gap: var(--sp-8); min-height: var(--hit-min); border-radius: var(--r-full); background: var(--ok-soft); color: var(--ok-strong); font-size: var(--fs-body); font-weight: 500; }
.score-line { display: block; font-size: var(--fs-body); color: var(--ink); margin: var(--sp-16) 0 var(--sp-12); }
.score-n { font-size: var(--fs-h1); font-weight: 600; color: var(--brand-text); }
.fold-h { display: flex; justify-content: space-between; align-items: center; min-height: var(--hit-min); }
.fold-ico { transition: transform 0.2s ease; }
.fold-ico.flip { transform: rotate(180deg); }
.prow { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--cell-h); padding: var(--sp-8) 0; border-bottom: 1px solid var(--line); }
.prow:last-child { border-bottom: none; padding-bottom: 0; }
.row--hover { background: var(--fill); }
.prow-l { flex: 1; min-width: 0; }
.prow-t { display: block; font-size: var(--fs-body); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prow-s { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }
.prow-score { flex-shrink: 0; font-size: var(--fs-body); font-weight: 600; color: var(--brand-text); }
.prow-none { flex-shrink: 0; font-size: var(--fs-caption); color: var(--ink-3); }
.rules { margin-top: var(--sp-8); }
.rule { display: block; font-size: var(--fs-sub); color: var(--ink-2); line-height: var(--lh-body); margin-bottom: var(--sp-8); }
.board-meta { display: flex; justify-content: space-between; gap: var(--sp-8); margin-bottom: var(--sp-12); }
.brow { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); padding: var(--sp-4) var(--sp-8); border-bottom: 1px solid var(--line); }
.brow:last-child { border-bottom: none; }
.brow.me { background: var(--brand-soft); border-radius: var(--r-sm); }
.brow-r { flex-shrink: 0; min-width: 28px; justify-content: center; }
.brow-n { flex: 1; min-width: 0; font-size: var(--fs-body); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.brow-me { color: var(--brand-text); font-size: var(--fs-caption); }
.brow-s { flex-shrink: 0; font-size: var(--fs-body); font-weight: 600; color: var(--brand-text); }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .page { max-width: 1064px; margin: 0 auto; }
  .rules-card { margin-top: 0; }
  .fold-h, .prow, .brow { cursor: pointer; }
}
/* #endif */
</style>
