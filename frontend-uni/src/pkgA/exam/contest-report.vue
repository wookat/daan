<template>
  <view class="wrap">
    <view v-if="loading" class="spin">赛后报告加载中…</view>
    <view v-else-if="loadErr" class="card empty">
      <text class="empty-t">加载失败</text>
      <text class="empty-s">{{ loadErr }}</text>
      <view class="retry" @click="retry">重试 ›</view>
    </view>
    <view v-else-if="err" class="card empty">
      <text class="empty-t">暂无大赛报告</text>
      <text class="empty-s">{{ err }}</text>
      <view class="pbtn main" @click="goContest">去模考大赛</view>
    </view>

    <template v-else-if="r">
      <view class="cr-cols">
      <view class="cr-side">
      <!-- 1. 总分与排名 -->
      <view class="card hero">
        <text class="hero-title">{{ r.event.title }}{{ r.event.phase === 'ended' ? '（排名已冻结）' : '（实时排名）' }}</text>
        <view class="hero-score"><text class="score-n">{{ r.score }}</text><text class="score-u">分</text></view>
        <view class="hero-meta">
          <text class="hm">第 {{ r.rank }} 名 / {{ r.total }} 人</text>
          <text class="hm">击败 {{ r.pct }}%</text>
          <text class="hm">全场平均 {{ r.avg }} 分</text>
        </view>
      </view>

      <view v-if="r.small_sample" class="card tip-card">
        <text class="tipline">本场参赛 {{ r.total }} 人，样本较少，排名仅供参考；历史同卷共 {{ r.history_pool.n }} 人作答、平均 {{ r.history_pool.avg }} 分（含比赛窗口外练习）。</text>
      </view>

      <!-- 分数分布 -->
      <view class="card">
        <view class="h">分数分布</view>
        <view class="dist">
          <view v-for="(n, i) in r.distribution" :key="i" class="dist-col">
            <view class="dist-bar-w"><view class="dist-bar" :class="{ me: i === r.my_bucket }" :style="{ height: barH(n) + '%' }" /></view>
            <text class="dist-l">{{ i * 10 }}</text>
          </view>
        </view>
        <text class="note">你在 {{ r.my_bucket * 10 }}-{{ r.my_bucket * 10 + 10 }} 分段（蓝色）</text>
      </view>
      </view>

      <view class="cr-main">
      <!-- 2. 目标差距 -->
      <view v-if="r.target_score != null || r.top25_score != null" class="card">
        <view class="h">距离目标</view>
        <view v-if="r.target_score != null" class="gap-row">
          <text class="gap-k">目标分 {{ r.target_score }}</text>
          <text class="gap-v" :class="{ ok: r.gap_to_target <= 0 }">{{ r.gap_to_target <= 0 ? '已达标 🎉' : '还差 ' + r.gap_to_target + ' 分' }}</text>
        </view>
        <view v-if="r.top25_score != null" class="gap-row">
          <text class="gap-k">前 25% 分数线 {{ r.top25_score }}</text>
          <text class="gap-v" :class="{ ok: r.score >= r.top25_score }">{{ r.score >= r.top25_score ? '已进入前 25%' : '还差 ' + round1(r.top25_score - r.score) + ' 分' }}</text>
        </view>
      </view>

      <!-- 3. 模块正确率与用时 -->
      <view v-if="r.modules.length" class="card">
        <view class="h">模块表现</view>
        <view v-for="m in r.modules" :key="m.module" class="mrow">
          <text class="mrow-name">{{ modName(m.module) }}</text>
          <view class="mrow-main">
            <view class="mrow-bar"><view class="mrow-fill" :style="{ width: (m.n ? (m.correct / m.n) * 100 : 0) + '%' }" /></view>
            <text class="mrow-sub">答对 {{ m.correct }}/{{ m.n }}<template v-if="m.avg_correct != null"> · 全场平均 {{ m.avg_correct }}</template></text>
            <text class="mrow-sub">用时 {{ fmtSecs(m.secs) }} · 建议 {{ fmtSecs(m.rec_secs) }}</text>
          </view>
        </view>
      </view>

      <!-- 4. 弱项考点 -->
      <view class="card">
        <view class="h">本卷薄弱考点</view>
        <text v-if="!r.weak_tags.length" class="note">本卷错题较少，暂未形成薄弱考点结论，继续保持！</text>
        <view v-for="t in r.weak_tags" :key="t.tag3" class="wrow" @click="goPractice(t.tag3)">
          <view class="wrow-l">
            <text class="wrow-t">{{ t.name || t.tag3 }}</text>
            <text class="wrow-s">错 {{ t.wrong }}/{{ t.n }} 题</text>
          </view>
          <text class="wrow-go">去练 ›</text>
        </view>
      </view>

      <!-- 5. 同系列历史曲线 -->
      <view v-if="r.history.length > 1" class="card">
        <view class="h">历届大赛成绩</view>
        <view class="curve">
          <view v-for="(a, i) in r.history" :key="a.id" class="curve-col">
            <text class="curve-v">{{ a.score }}</text>
            <view class="curve-bar" :class="{ cur: a.id === r.event.id }" :style="{ height: Math.max(8, a.score) + '%' }" />
            <text class="curve-x">{{ i + 1 }}</text>
          </view>
        </view>
        <text class="note">同系列最近 {{ r.history.length }} 场成绩（分）</text>
      </view>

      <!-- 6. 行动 -->
      <view class="btns">
        <view class="pbtn" @click="openAttempt">逐题回顾（错题已入本）</view>
        <view class="pbtn main" @click="goWeakPractice">弱项练 5 题</view>
      </view>
      </view>
      </view>
    </template>
  </view>
</template>

<script>
import { request, anonUid, isNetErr } from '../../api.js';

const MODS = { changshi: '常识判断', yanyu: '言语理解', shuliang: '数量关系', panduan: '判断推理', ziliao: '资料分析' };

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
  methods: {
    modName(m) { return MODS[m] || m; },
    round1(v) { return Math.round(v * 10) / 10; },
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
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 60rpx 24rpx; }
.empty { text-align: center; padding: 80rpx 28rpx; }
.retry { display: flex; align-items: center; justify-content: center; min-height: 40px; margin-top: 4rpx; color: var(--brand-text); font-size: 26rpx; font-weight: 500; }
.empty-t { display: block; font-size: 30rpx; font-weight: 600; color: var(--ink); }
.empty-s { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 12rpx; margin-bottom: 32rpx; }
.empty .pbtn { margin: 0 auto; max-width: 320rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 600; margin-bottom: 20rpx; }
.hero { background: linear-gradient(135deg, var(--brand), #5c82ff); border: none; text-align: center; }
.hero-title { display: block; font-size: 26rpx; color: rgba(255, 255, 255, 0.85); }
.hero-score { margin: 16rpx 0 10rpx; }
.score-n { font-size: 88rpx; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
.score-u { font-size: 26rpx; color: rgba(255, 255, 255, 0.85); margin-left: 6rpx; }
.hero-meta { display: flex; justify-content: center; gap: 28rpx; flex-wrap: wrap; }
.hm { font-size: 24rpx; color: rgba(255, 255, 255, 0.9); }
.tip-card { background: var(--warn-soft); border-color: #fcd34d; }
.tipline { font-size: 24rpx; color: #92400e; line-height: 1.7; }
.dist { display: flex; align-items: flex-end; gap: 6rpx; height: 160rpx; }
.dist-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.dist-bar-w { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.dist-bar { width: 60%; min-height: 4rpx; background: var(--line); border-radius: 4rpx 4rpx 0 0; }
.dist-bar.me { background: var(--brand); }
.dist-l { font-size: 24rpx; color: var(--ink-3); margin-top: 4rpx; }
.note { display: block; font-size: 24rpx; color: var(--ink-3); margin-top: 10rpx; }
.gap-row { display: flex; justify-content: space-between; align-items: center; min-height: 44px; }
.gap-k { font-size: 26rpx; color: var(--ink); }
.gap-v { font-size: 26rpx; font-weight: 700; color: #d97706; }
.gap-v.ok { color: #15803d; }
.mrow { display: flex; gap: 16rpx; padding: 12rpx 0; border-bottom: 1rpx solid var(--line); }
.mrow:last-child { border-bottom: none; }
.mrow-name { flex-shrink: 0; width: 130rpx; font-size: 24rpx; color: var(--ink-2); padding-top: 4rpx; }
.mrow-main { flex: 1; min-width: 0; }
.mrow-bar { height: 14rpx; background: var(--brand-soft); border-radius: 999rpx; overflow: hidden; margin-bottom: 8rpx; }
.mrow-fill { height: 100%; background: var(--brand); border-radius: 999rpx; }
.mrow-sub { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 2rpx; }
.wrow { display: flex; justify-content: space-between; align-items: center; min-height: 44px; padding: 10rpx 0; border-bottom: 1rpx solid var(--line); }
.wrow:last-child { border-bottom: none; }
.wrow-t { display: block; font-size: 26rpx; color: var(--ink); }
.wrow-s { display: block; font-size: 24rpx; color: #b91c1c; margin-top: 2rpx; }
.wrow-go { flex-shrink: 0; font-size: 24rpx; color: var(--brand-text); font-weight: 600; }
.curve { display: flex; align-items: flex-end; gap: 14rpx; height: 220rpx; padding: 10rpx 0; }
.curve-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 44rpx; }
.curve-v { font-size: 24rpx; color: var(--ink-2); margin-bottom: 4rpx; }
.curve-bar { width: 60%; max-width: 44rpx; background: var(--brand-soft); border-radius: 8rpx 8rpx 0 0; }
.curve-bar.cur { background: var(--brand); }
.curve-x { font-size: 24rpx; color: var(--ink-2); margin-top: 6rpx; }
.btns { display: flex; gap: 16rpx; }
.pbtn { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--brand); color: var(--brand-text); border-radius: 999rpx; font-size: 27rpx; font-weight: 500; background: var(--card); }
.pbtn.main { background: var(--brand); color: #fff; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .pbtn:hover, .wrow:hover { cursor: pointer; }
}

@media (min-width: 1024px) {
  .cr-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .cr-side { width: 420px; flex: none; position: sticky; top: 24rpx; }
  .cr-main { flex: 1; min-width: 0; }
}
/* #endif */
</style>
