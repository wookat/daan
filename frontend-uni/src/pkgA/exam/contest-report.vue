<template>
  <view class="page">
    <kg-skeleton v-if="loading" preset="cards" />
    <kg-empty-state v-else-if="loadErr" icon="wifi-off" title="赛后报告加载失败" :desc="loadErr" cta-text="重试" @cta="retry" />
    <kg-empty-state v-else-if="err" icon="trophy" title="暂无大赛报告" :desc="err" cta-text="去模考大赛" @cta="goContest" />

    <kg-two-col v-else-if="r">
      <template #main>
        <kg-hero-card :label="r.event.title + (r.event.phase === 'ended' ? '（排名已冻结）' : '（实时排名）')" :value="r.score" unit="分">
          <view class="hero-sub">
            <text class="hero-beat num">{{ rankLine(r.total, r.pct) }}</text>
            <text class="hero-line num">{{ contestHeroLine(r) }}</text>
          </view>
        </kg-hero-card>

        <kg-banner v-if="r.small_sample" tone="warn" :closable="false" :text="'本场参赛 ' + r.total + ' 人，样本较少，排名仅供参考；历史同卷共 ' + r.history_pool.n + ' 人作答、平均 ' + r.history_pool.avg + ' 分（含比赛窗口外练习）'" class="sec" />

        <kg-card variant="flat" class="sec">
          <kg-stat-row :items="[
            { label: '排名', value: r.rank + '/' + r.total, tone: 'brand' },
            { label: '超过考友', value: r.pct, unit: '%' },
            { label: '全场平均', value: r.avg, unit: '分' },
          ]" />
        </kg-card>

        <kg-card v-if="r.target_score != null || r.top25_score != null" variant="flat" class="sec">
          <text class="h">距离目标</text>
          <view v-if="r.target_score != null" class="gap-row">
            <text class="gap-k">目标分 <text class="num">{{ r.target_score }}</text></text>
            <text class="gap-v" :class="{ ok: r.gap_to_target <= 0 }">{{ r.gap_to_target <= 0 ? '已达标 🎉' : '还差 ' + r.gap_to_target + ' 分' }}</text>
          </view>
          <view v-if="r.top25_score != null" class="gap-row">
            <text class="gap-k">前 25% 分数线 <text class="num">{{ r.top25_score }}</text></text>
            <text class="gap-v" :class="{ ok: r.score >= r.top25_score }">{{ r.score >= r.top25_score ? '已进入前 25%' : '还差 ' + round1(r.top25_score - r.score) + ' 分' }}</text>
          </view>
        </kg-card>

        <kg-card v-if="r.modules.length" variant="flat" class="sec">
          <text class="h">模块表现</text>
          <view v-for="m in r.modules" :key="m.module" class="mrow">
            <text class="mrow-name">{{ modName(m.module) }}</text>
            <view class="mrow-main">
              <kg-progress :value="m.n ? Math.round((m.correct / m.n) * 100) : 0" :module="m.module" />
              <text class="mrow-sub num">答对 {{ m.correct }}/{{ m.n }}<template v-if="m.avg_correct != null"> · 全场平均 {{ m.avg_correct }}</template></text>
              <text class="mrow-sub num">用时 {{ fmtSecs(m.secs) }} · 建议 {{ fmtSecs(m.rec_secs) }}</text>
            </view>
          </view>
        </kg-card>

        <kg-card variant="flat" class="sec">
          <text class="h">本卷薄弱考点</text>
          <text v-if="!r.weak_tags.length" class="note">{{ weakNoteText }}</text>
          <view v-for="t in r.weak_tags" :key="t.tag3" class="wrow" role="button" hover-class="row--hover" @click="goPractice(t.tag3)">
            <view class="wrow-l">
              <text class="wrow-t">{{ t.name || t.tag3 }}</text>
              <text class="wrow-s">错 {{ t.wrong }}/{{ t.n }} 题</text>
            </view>
            <text class="wrow-go">去练</text>
            <l-icon name="chevron-right" :size="16" tone="brand" />
          </view>
        </kg-card>

        <kg-card v-if="r.history.length > 1" variant="flat" class="sec">
          <text class="h">历届大赛成绩</text>
          <view class="curve">
            <view v-for="(a, i) in r.history" :key="a.id" class="curve-col">
              <text class="curve-v num">{{ a.score }}</text>
              <view class="curve-bar" :class="{ cur: a.id === r.event.id }" :style="{ height: Math.max(8, a.score) + '%' }" />
              <text class="curve-x num">{{ i + 1 }}</text>
            </view>
          </view>
          <text class="note">同系列最近 {{ r.history.length }} 场成绩（分）</text>
        </kg-card>

        <kg-action-bar layout="actions" primary-text="弱项练 5 题" secondary-text="逐题回顾" @primary="goWeakPractice" @secondary="openAttempt" />
      </template>

      <template #aside>
        <kg-card variant="flat" class="sec dist-card">
          <text class="h">分数分布</text>
          <view class="dist">
            <view v-for="(n, i) in r.distribution" :key="i" class="dist-col">
              <view class="dist-bar-w"><view class="dist-bar" :class="{ me: i === r.my_bucket }" :style="{ height: barH(n) + '%' }" /></view>
              <text class="dist-l num">{{ i * 10 }}</text>
            </view>
          </view>
          <text class="note">你在 {{ r.my_bucket * 10 }}-{{ r.my_bucket * 10 + 10 }} 分段（高亮）</text>
        </kg-card>
      </template>
    </kg-two-col>
  </view>
</template>

<script>
import { request, anonUid, isNetErr } from '../../api.js';
import { moduleLabel } from '../../module-meta.js';
import { rankLine, contestHeroLine, weakNote, contestCorrectTotal } from '../../exam-copy.js';

export default {
  data() {
    return { loading: true, err: '', loadErr: '', r: null, eventId: null };
  },
  onLoad(opt) {
    this.eventId = opt.event_id ? Number(opt.event_id) : null;
    if (!this.eventId) {
      this.err = '链接缺少赛事参数，请从模考大赛页进入';
      this.loading = false;
      return;
    }
    this.load();
  },
  computed: {
    weakNoteText() {
      const [correct, total] = contestCorrectTotal(this.r);
      return weakNote(correct, total);
    },
  },
  methods: {
    modName(m) { return moduleLabel(m); },
    round1(v) { return Math.round(v * 10) / 10; },
    rankLine,
    contestHeroLine,
    async load() {
      this.loadErr = '';
      try {
        this.r = await request('/api/mock/events/' + this.eventId + '/report?uid=' + encodeURIComponent(anonUid()));
      } catch (e) {
        if (isNetErr(e)) this.loadErr = e.message || '网络异常';
        else this.err = e.message || '报告不存在或已过期';
      }
      this.loading = false;
    },
    retry() {
      this.loading = true;
      this.load();
    },
    barH(n) {
      const max = Math.max(...this.r.distribution, 1);
      return n ? 15 + (n / max) * 85 : 4;
    },
    fmtSecs(s) {
      if (!s) return '0 分';
      return Math.round(s / 60) + ' 分';
    },
    goPractice(tag3, count) {
      uni.setStorageSync('practiceLaunch', { kind: 'start', tag3: tag3 || null, count: count || null, adaptive: true });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goWeakPractice() {
      const t = this.r.weak_tags[0];
      this.goPractice(t ? t.tag3 : null, 5);
    },
    openAttempt() {
      uni.navigateTo({ url: '/pkgA/exam/report?attempt_id=' + this.r.attempt_id });
    },
    goContest() {
      uni.reLaunch({ url: '/pkgA/exam/contest' });
    },
  },
};
</script>

<style scoped>
.page { padding: var(--sp-16) var(--page-x) calc(var(--bar-h) + var(--sp-24) + env(safe-area-inset-bottom, 0px)); }
.h { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); margin-bottom: var(--sp-12); }
.sec { margin-top: var(--card-gap); }
.note { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-8); }
.hero-sub { display: flex; flex-direction: column; gap: var(--sp-4); margin-top: var(--sp-8); }
.hero-beat { font-size: var(--fs-h3); font-weight: 600; color: var(--on-brand); }
.hero-line { font-size: var(--fs-sub); color: var(--on-brand); opacity: 0.85; }
.dist { display: flex; align-items: flex-end; gap: var(--sp-4); height: 96px; }
.dist-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.dist-bar-w { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.dist-bar { width: 60%; min-height: 2px; background: var(--line); border-radius: var(--r-xs) var(--r-xs) 0 0; }
.dist-bar.me { background: var(--brand); }
.dist-l { font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }
.gap-row { display: flex; justify-content: space-between; align-items: center; min-height: var(--hit-min); }
.gap-k { font-size: var(--fs-body); color: var(--ink); }
.gap-v { font-size: var(--fs-body); font-weight: 600; color: var(--warn-strong); }
.gap-v.ok { color: var(--ok-strong); }
.mrow { display: flex; gap: var(--sp-12); padding: var(--sp-8) 0; border-bottom: 1px solid var(--line); }
.mrow:last-child { border-bottom: none; }
.mrow-name { flex-shrink: 0; width: 64px; font-size: var(--fs-sub); color: var(--ink-2); }
.mrow-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-4); }
.mrow-sub { font-size: var(--fs-caption); color: var(--ink-2); }
.wrow { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); padding: var(--sp-8) 0; border-bottom: 1px solid var(--line); }
.wrow:last-child { border-bottom: none; }
.row--hover { background: var(--fill); }
.wrow-l { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-4); }
.wrow-t { font-size: var(--fs-body); color: var(--ink); font-weight: 500; }
.wrow-s { font-size: var(--fs-caption); color: var(--bad-strong); }
.wrow-go { flex-shrink: 0; font-size: var(--fs-sub); color: var(--brand-text); font-weight: 600; }
.curve { display: flex; align-items: flex-end; gap: var(--sp-8); height: 120px; padding: var(--sp-4) 0; }
.curve-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 24px; }
.curve-v { font-size: var(--fs-caption); color: var(--ink-2); margin-bottom: var(--sp-4); }
.curve-bar { width: 60%; max-width: 24px; background: var(--brand-soft-2); border-radius: var(--r-xs) var(--r-xs) 0 0; }
.curve-bar.cur { background: var(--brand); }
.curve-x { font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .page { max-width: 1064px; margin: 0 auto; padding-bottom: var(--sp-24); }
  .dist-card { margin-top: 0; }
  .wrow { cursor: pointer; }
}
/* #endif */
</style>
