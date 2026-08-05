<template>
  <view class="wrap">
    <view v-if="loading" class="spin">报告加载中…</view>

    <template v-if="!loading && report">
      <view class="card hero">
        <text class="hero-title">{{ report.paper.title }}</text>
        <view class="hero-score">
          <text class="score-n">{{ report.attempt.score }}</text>
          <text class="score-u">分</text>
        </view>
        <view class="hero-meta">
          <text class="hm">答对 {{ report.correct }}/{{ report.total }}</text>
          <text class="hm">正确率 {{ accuracy }}%</text>
          <text class="hm">用时 {{ usedTime }}</text>
        </view>
      </view>

      <rank-card v-if="report.attempt && report.attempt.id" :attempt-id="report.attempt.id" />

      <view v-if="modules.length" class="card">
        <view class="h">模块得分</view>
        <view v-for="m in modules" :key="m.key" class="mrow">
          <text class="mrow-name">{{ m.name }}</text>
          <view class="mrow-bar">
            <view class="mrow-fill" :style="{ width: m.pct + '%' }"></view>
          </view>
          <text class="mrow-v">{{ m.correct }}/{{ m.n }}</text>
        </view>
      </view>

      <view v-if="history.length > 1" class="card">
        <view class="h">历次成绩</view>
        <view class="curve">
          <view v-for="(a, i) in history" :key="a.id" class="curve-col" @click="openAttempt(a)">
            <text class="curve-v">{{ a.score }}</text>
            <view class="curve-bar" :class="{ cur: a.id === report.attempt.id }" :style="{ height: Math.max(8, a.score) + '%' }"></view>
            <text class="curve-x">{{ i + 1 }}</text>
          </view>
        </view>
        <text class="curve-note">同类试卷最近 {{ history.length }} 次成绩（分）</text>
      </view>

      <view class="card">
        <view class="h">逐题对错（点击看解析）</view>
        <view class="qgrid">
          <view
            v-for="it in report.items"
            :key="it.no"
            class="qn"
            :class="it.picked ? (it.correct ? 'ok' : 'bad') : 'blank'"
            @click="openQ(it)"
          >{{ it.no }}</view>
        </view>
        <view class="legend">
          <text class="lg"><text class="dot ok"></text>答对</text>
          <text class="lg"><text class="dot bad"></text>答错</text>
          <text class="lg"><text class="dot"></text>未答</text>
        </view>
      </view>

      <view class="btns">
        <view class="pbtn" @click="goList">返回卷库</view>
        <view class="pbtn main" @click="retake">再考一次</view>
      </view>
    </template>

    <!-- 解析浮层 -->
    <view v-if="detail" class="mask" @click="detail = null">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">第 {{ detail.no }} 题 · {{ detail.correct ? '答对' : (detail.picked ? '答错' : '未答') }}</text>
          <view class="sheet-x" @click="detail = null"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <scroll-view scroll-y class="detail-scroll">
          <text class="dq">{{ detail.question }}</text>
          <view v-for="(v, k) in detail.options" :key="k" class="dopt" :class="{ right: k === detail.answer, wrong: k === detail.picked && k !== detail.answer }">
            <text>{{ k }}. {{ v }}</text>
          </view>
          <view class="dans">
            正确答案 <text class="da ok">{{ detail.answer }}</text>
            <template v-if="detail.picked">，你选了 <text class="da" :class="detail.correct ? 'ok' : 'bad'">{{ detail.picked }}</text></template>
          </view>
          <view v-if="detail.hs_explanation || detail.explanation" class="dexp">
            <text>{{ detail.hs_explanation || detail.explanation }}</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, anonUid } from '../../api.js';

const MODS = { changshi: '常识判断', yanyu: '言语理解', shuliang: '数量关系', panduan: '判断推理', ziliao: '资料分析' };
const MOD_ORDER = ['changshi', 'yanyu', 'shuliang', 'panduan', 'ziliao'];

export default {
  data() {
    return { loading: true, report: null, history: [], detail: null };
  },
  computed: {
    accuracy() {
      const r = this.report;
      return r && r.answered ? Math.round((r.correct / r.answered) * 100) : 0;
    },
    usedTime() {
      const a = this.report && this.report.attempt;
      if (!a || !a.submitted_at) return '-';
      const s = Math.max(0, Math.round(a.submitted_at - a.started_at));
      return Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒';
    },
    modules() {
      const pm = (this.report && this.report.attempt.per_module) || {};
      const keys = MOD_ORDER.filter((k) => pm[k]).concat(Object.keys(pm).filter((k) => !MOD_ORDER.includes(k)));
      return keys.map((k) => ({
        key: k,
        name: MODS[k] || k,
        n: pm[k].n,
        correct: pm[k].correct,
        pct: pm[k].n ? Math.round((pm[k].correct / pm[k].n) * 100) : 0,
      }));
    },
  },
  onLoad(opt) {
    this.load(opt.attempt_id);
  },
  methods: {
    async load(aid) {
      this.loading = true;
      try {
        const d = await request('/api/exam/report/' + aid + '?uid=' + encodeURIComponent(anonUid()));
        this.report = d;
        uni.setNavigationBarTitle({ title: '成绩报告' });
        this.loadHistory();
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async loadHistory() {
      try {
        const d = await request(
          '/api/exam/attempts?uid=' + encodeURIComponent(anonUid()) + '&paper_id=' + this.report.paper.id + '&limit=10'
        );
        this.history = (d.items || []).slice().reverse();
      } catch (e) { /* 非关键路径 */ }
    },
    openQ(it) { this.detail = it; },
    openAttempt(a) {
      if (a.id === this.report.attempt.id) return;
      this.load(a.id);
    },
    goList() {
      uni.redirectTo({ url: '/pkgA/exam/list' });
    },
    retake() {
      const p = this.report.paper;
      uni.redirectTo({ url: p.kind === 'mock' ? '/pkgA/exam/exam?mini=1' : '/pkgA/exam/exam?paper_id=' + p.id });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 60rpx 24rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 600; margin-bottom: 20rpx; }
.hero { background: linear-gradient(135deg, var(--brand), #6c9bff); border: none; text-align: center; }
.hero-title { display: block; font-size: 25rpx; color: rgba(255, 255, 255, 0.85); }
.hero-score { margin: 16rpx 0 10rpx; }
.score-n { font-size: 88rpx; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
.score-u { font-size: 26rpx; color: rgba(255, 255, 255, 0.85); margin-left: 6rpx; }
.hero-meta { display: flex; justify-content: center; gap: 28rpx; flex-wrap: wrap; }
.hm { font-size: 23rpx; color: rgba(255, 255, 255, 0.9); }
.mrow { display: flex; align-items: center; gap: 16rpx; min-height: 44px; }
.mrow-name { flex-shrink: 0; width: 130rpx; font-size: 24rpx; color: var(--ink-2); }
.mrow-bar { flex: 1; height: 16rpx; background: var(--brand-soft); border-radius: 999rpx; overflow: hidden; }
.mrow-fill { height: 100%; background: var(--brand); border-radius: 999rpx; transition: width 0.4s ease; }
.mrow-v { flex-shrink: 0; width: 90rpx; text-align: right; font-size: 24rpx; color: var(--ink); font-weight: 600; }
.curve { display: flex; align-items: flex-end; gap: 14rpx; height: 220rpx; padding: 10rpx 0; }
.curve-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 44rpx; }
.curve-v { font-size: 20rpx; color: var(--ink-2); margin-bottom: 4rpx; }
.curve-bar { width: 60%; max-width: 44rpx; background: var(--brand-soft); border-radius: 8rpx 8rpx 0 0; }
.curve-bar.cur { background: var(--brand); }
.curve-x { font-size: 20rpx; color: var(--ink-2); margin-top: 6rpx; }
.curve-note { font-size: 21rpx; color: var(--ink-2); }
.qgrid { display: flex; flex-wrap: wrap; gap: 18rpx; margin-bottom: 16rpx; }
.qn { width: 76rpx; height: 76rpx; line-height: 76rpx; text-align: center; border-radius: 50%; font-size: 25rpx; font-weight: 600; box-sizing: border-box; background: var(--soft-bg); border: 2rpx solid var(--line); color: var(--ink-2); }
.qn.ok { background: var(--ok-soft); border-color: #86efac; color: #15803d; }
.qn.bad { background: var(--bad-soft); border-color: #fca5a5; color: #b91c1c; }
.legend { display: flex; gap: 24rpx; }
.lg { display: inline-flex; align-items: center; gap: 8rpx; font-size: 22rpx; color: var(--ink-2); }
.dot { width: 20rpx; height: 20rpx; border-radius: 50%; background: var(--soft-bg); border: 2rpx solid var(--line); display: inline-block; }
.dot.ok { background: #86efac; border-color: #86efac; }
.dot.bad { background: #fca5a5; border-color: #fca5a5; }
.btns { display: flex; gap: 16rpx; }
.pbtn { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--brand); color: var(--brand); border-radius: 999rpx; font-size: 27rpx; font-weight: 500; background: var(--card); }
.pbtn.main { background: var(--brand); color: #fff; }
.mask { position: fixed; inset: 0; background: rgba(15, 18, 25, 0.45); z-index: 90; display: flex; align-items: flex-end; }
.sheet { width: 100%; background: var(--card); border-radius: 28rpx 28rpx 0 0; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); max-height: 80vh; display: flex; flex-direction: column; box-sizing: border-box; }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.sheet-t { font-size: 30rpx; font-weight: 600; }
.sheet-x { font-size: 30rpx; color: var(--ink-2); padding: 8rpx 16rpx; }
.detail-scroll { max-height: 62vh; }
.dq { display: block; font-size: 28rpx; line-height: 1.7; white-space: pre-wrap; margin-bottom: 20rpx; }
.dopt { border: 2rpx solid var(--line); border-radius: 16rpx; padding: 16rpx 20rpx; margin-bottom: 14rpx; font-size: 26rpx; line-height: 1.6; }
.dopt.right { border-color: var(--ok, #16a34a); background: var(--ok-soft); }
.dopt.wrong { border-color: var(--bad, #dc2626); background: var(--bad-soft); }
.dans { font-size: 25rpx; color: var(--ink-2); margin: 10rpx 0 16rpx; }
.da { font-weight: 800; font-size: 28rpx; }
.da.ok { color: var(--ok, #16a34a); }
.da.bad { color: var(--bad, #dc2626); }
.dexp { background: var(--soft-bg); border-left: 5rpx solid var(--brand); border-radius: 14rpx; padding: 20rpx; font-size: 25rpx; line-height: 1.7; white-space: pre-wrap; margin-bottom: 20rpx; }
</style>
