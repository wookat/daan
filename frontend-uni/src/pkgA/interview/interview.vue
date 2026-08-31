<template>
  <view class="wrap">
    <!-- 第一步：选分类 -->
    <view v-if="step === 'pick'">
      <view class="hero">
        <view class="hero-t">AI 结构化面试陪练</view>
        <view class="hero-s">抽题作答 · 考官级五维打分 · 逐段点评</view>
        <view class="hero-n">{{ bankTotal }} 道真题/经典题 · 来源公开资料</view>
      </view>
      <view class="sec-t">选择题型分类</view>
      <view class="cat-list">
        <view v-for="c in categories" :key="c.name" class="cat" @click="draw(c.name)">
          <view class="cat-l">
            <text class="cat-name">{{ c.name }}</text>
            <text class="cat-sub">共 {{ c.total }} 题 · 已练 {{ c.done }}</text>
          </view>
          <text class="cat-arrow">›</text>
        </view>
      </view>
      <button class="btn-primary" @click="draw('')"><l-icon name="shuffle" :size="16" color="#ffffff" /> 随机抽一题</button>
      <view class="hist-link" @click="goHistory">练习记录 ›</view>
    </view>

    <!-- 第二步：作答 -->
    <view v-else-if="step === 'answer'" class="iv-cols">
      <view class="iv-left">
        <view class="q-card">
          <view class="q-meta">
            <text class="q-tag">{{ question.category }}</text>
            <text class="q-src">{{ question.source }}</text>
          </view>
          <view class="q-text">{{ question.question }}</view>
        </view>
        <view class="timer-row">
          <view class="timer"><l-icon name="timer" :size="15" color="#40434e" /><text>{{ fmtDur(elapsed) }}</text></view>
          <text class="swap" @click="draw(pickedCategory, question.id)">换一题</text>
        </view>
      </view>
      <view class="iv-right">
        <textarea
          v-model="answer"
          class="ans-box"
          :maxlength="5000"
          placeholder="像面试现场一样组织语言作答（建议 200 字以上）…"
        />
        <view class="cnt">{{ answer.length }} / 5000</view>
        <view class="btn-row">
          <button class="btn-ghost" @click="voiceStub"><l-icon name="mic" :size="15" color="#2e5bff" /> 语音作答（即将上线）</button>
          <button class="btn-primary grow" :disabled="answer.trim().length < 20 || submitting" @click="submit">
            {{ submitting ? '考官点评中…' : '提交作答' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 第三步：点评报告 -->
    <view v-else>
      <view class="hero report">
        <view class="row-between">
          <view>
            <view class="hero-s">结构化面试 · {{ report.category }}</view>
            <view class="score-big">{{ report.total }} <text class="score-sub">/ 100</text></view>
          </view>
          <view class="hero-meta">作答 {{ fmtDur(report.duration) }} · {{ report.answerLen }} 字</view>
        </view>
        <view v-if="report.summary" class="hero-sum">{{ report.summary }}</view>
      </view>

      <view class="rp-cols">
        <view class="rp-left">
          <view class="card">
            <view class="card-t">五维评分</view>
            <view v-for="(v, k) in report.scores" :key="k" class="dim-row">
              <text class="dim-l">{{ k }}</text>
              <view class="bar"><view class="bar-i" :style="{ width: v * 10 + '%' }" /></view>
              <text class="dim-v">{{ v }}</text>
            </view>
          </view>

          <view class="sec-t">题目</view>
          <view class="q-card"><view class="q-text">{{ question.question }}</view></view>

          <view v-if="points.length" class="card">
            <view class="card-t">参考思路要点</view>
            <view v-for="(p, i) in points" :key="i" class="pt">{{ i + 1 }}. {{ p }}</view>
          </view>
        </view>
        <view class="rp-right">
          <view class="sec-t">考官点评{{ streaming ? '（生成中…）' : '' }}</view>
          <view class="card review">
            <rich-text v-if="reviewHtml" :nodes="reviewHtml" />
            <view v-if="reviewMissing && !streaming" class="regen">
              <view class="regen-tip">{{ review ? '点评可能不完整（生成被中断）' : '上次点评生成被中断，评分已保留' }}</view>
              <!-- #ifdef H5 -->
              <button class="btn-primary regen-btn" @click="regenReview">重新生成点评</button>
              <!-- #endif -->
            </view>
            <view v-if="!reviewHtml && (!reviewMissing || streaming)" class="loading">考官正在撰写点评…</view>
          </view>
        </view>
      </view>

      <view class="btn-row">
        <button class="btn-ghost" :disabled="streaming" @click="retry">重答本题</button>
        <button class="btn-primary grow" :disabled="streaming" @click="draw(pickedCategory, question.id)">再练一题</button>
      </view>
      <view class="hist-link" @click="goHistory">练习记录 ›</view>
    </view>
  </view>
</template>

<script>
import { interviewCategories, interviewDraw, interviewSession, streamInterview } from '../../api.js';
// #ifdef H5
import { streamInterviewReviewRegen } from '../../api.js';
// #endif
import { md } from '../../md.js';

export default {
  data() {
    return {
      step: 'pick',
      categories: [],
      bankTotal: 0,
      pickedCategory: '',
      question: {},
      answer: '',
      elapsed: 0,
      submitting: false,
      streaming: false,
      report: { scores: {}, total: 0, summary: '', duration: 0, answerLen: 0, category: '' },
      review: '',
      reviewMissing: false,
      points: [],
    };
  },
  created() {
    this._timer = null;
  },
  computed: {
    reviewHtml() {
      return this.review ? md(this.review) : '';
    },
  },
  onLoad(opts) {
    if (opts && opts.session_id) this.loadSession(opts.session_id);
    else this.loadCategories();
  },
  onUnload() {
    this.stopTimer();
  },
  methods: {
    fmtDur(s) {
      const m = Math.floor(s / 60);
      return m + "'" + String(s % 60).padStart(2, '0') + '"';
    },
    async loadCategories() {
      try {
        const d = await interviewCategories();
        this.categories = d.categories || [];
        this.bankTotal = d.total || 0;
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' });
      }
    },
    async draw(category, excludeId) {
      this.pickedCategory = category || '';
      try {
        const d = await interviewDraw(category, excludeId);
        this.question = d.question;
        this.answer = '';
        this.review = '';
        this.points = [];
        this.step = 'answer';
        this.startTimer();
      } catch (e) {
        uni.showToast({ title: e.message || '抽题失败', icon: 'none' });
      }
    },
    startTimer() {
      this.stopTimer();
      this.elapsed = 0;
      this._timer = setInterval(() => { this.elapsed += 1; }, 1000);
    },
    stopTimer() {
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },
    voiceStub() {
      uni.showToast({ title: '语音作答即将上线，先用文字练起来吧', icon: 'none' });
    },
    async submit() {
      if (this.submitting) return;
      this.submitting = true;
      this.stopTimer();
      const duration = this.elapsed;
      const ans = this.answer.trim();
      try {
        this.report = { scores: {}, total: 0, summary: '', duration, answerLen: ans.length, category: this.question.category };
        this.review = '';
        this.streaming = true;
        const res = await streamInterview({
          questionId: this.question.id,
          answer: ans,
          durationSec: duration,
          onMeta: (m) => {
            this.report = { ...this.report, scores: m.scores || {}, total: m.total || 0, summary: m.summary || '' };
            this.step = 'report';
          },
          onDelta: (full) => { this.review = full; },
        });
        this.review = res.review || this.review;
        if (res.session_id) this.loadPoints(res.session_id);
      } catch (e) {
        uni.showToast({ title: e.message || '点评失败，请重试', icon: 'none' });
        if (this.step !== 'report') this.startTimer();
      } finally {
        this.submitting = false;
        this.streaming = false;
      }
    },
    async loadPoints(sid) {
      try {
        const d = await interviewSession(sid);
        this.points = (d.session && d.session.points) || [];
      } catch (e) { /* 非关键路径 */ }
    },
    async loadSession(sid) {
      try {
        const d = await interviewSession(sid);
        this._sid = sid;
        const s = d.session;
        this.question = { id: s.question_id, category: s.category, question: s.question_text, source: s.source };
        this.answer = s.answer_text || '';
        this.report = {
          scores: s.scores || {},
          total: s.total || 0,
          summary: '',
          duration: s.duration_sec || 0,
          answerLen: (s.answer_text || '').length,
          category: s.category,
        };
        this.review = s.review || '';
        this.reviewMissing = this.review.trim().length < 300;
        this.points = s.points || [];
        this.step = 'report';
      } catch (e) {
        uni.showToast({ title: e.message || '记录加载失败', icon: 'none' });
        this.loadCategories();
      }
    },
    // #ifdef H5
    async regenReview() {
      if (this.streaming) return;
      this.streaming = true;
      try {
        const sid = this._sid;
        await streamInterviewReviewRegen({
          sessionId: sid,
          onDelta: (full) => { this.review = full; },
        });
        this.reviewMissing = this.review.trim().length < 300;
      } catch (e) {
        uni.showToast({ title: e.message || '点评生成失败，请重试', icon: 'none' });
      } finally {
        this.streaming = false;
      }
    },
    // #endif
    retry() {
      this.answer = '';
      this.review = '';
      this.points = [];
      this.step = 'answer';
      this.startTimer();
    },
    goHistory() {
      uni.navigateTo({ url: '/pkgA/interview/history' });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 60rpx; }

.hero { background: linear-gradient(135deg, #5b8af8, #2e5bff); border-radius: 28rpx; padding: 36rpx 32rpx; color: #fff; margin-bottom: 24rpx; box-shadow: 0 6rpx 18rpx rgba(46, 91, 255, 0.3); }
.hero-t { font-size: 38rpx; font-weight: 800; }
.hero-s { font-size: 25rpx; color: rgba(255, 255, 255, 0.85); margin-top: 8rpx; }
.hero-n { font-size: 22rpx; color: rgba(255, 255, 255, 0.7); margin-top: 14rpx; }
.hero.report { margin-bottom: 20rpx; }
.row-between { display: flex; justify-content: space-between; align-items: flex-start; }
.score-big { font-size: 68rpx; font-weight: 800; line-height: 1.2; }
.score-sub { font-size: 26rpx; font-weight: 500; color: rgba(255, 255, 255, 0.8); }
.hero-meta { font-size: 23rpx; color: rgba(255, 255, 255, 0.85); text-align: right; line-height: 1.8; }
.hero-sum { font-size: 25rpx; color: rgba(255, 255, 255, 0.92); margin-top: 14rpx; border-top: 1rpx solid rgba(255, 255, 255, 0.25); padding-top: 14rpx; }

.sec-t { font-size: 24rpx; color: var(--ink-2); margin: 28rpx 8rpx 14rpx; }
.cat-list { background: var(--card); border-radius: 28rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 4rpx 32rpx; margin-bottom: 24rpx; }
.cat { display: flex; align-items: center; min-height: 52px; border-top: 1rpx solid var(--line); }
.cat:first-child { border-top: none; }
.cat-l { flex: 1; }
.cat-name { display: block; font-size: 29rpx; font-weight: 600; color: var(--ink); }
.cat-sub { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.cat-arrow { color: #b0b4c0; font-size: 30rpx; }

.q-card { background: var(--card); border-radius: 28rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 28rpx 32rpx; margin-bottom: 20rpx; }
.q-meta { display: flex; align-items: center; gap: 16rpx; margin-bottom: 14rpx; }
.q-tag { background: #e8effe; color: #2e5bff; font-size: 22rpx; font-weight: 600; border-radius: 8rpx; padding: 4rpx 14rpx; }
.q-src { font-size: 22rpx; color: var(--ink-2); }
.q-text { font-size: 29rpx; line-height: 1.7; color: var(--ink); }

.timer-row { display: flex; justify-content: space-between; align-items: center; margin: 0 8rpx 14rpx; }
.timer { display: flex; align-items: center; gap: 8rpx; font-size: 26rpx; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.swap { font-size: 25rpx; color: #2e5bff; }
.ans-box { width: 100%; box-sizing: border-box; min-height: 320rpx; background: var(--card); border-radius: 24rpx; padding: 24rpx 28rpx; font-size: 28rpx; line-height: 1.7; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); }
.cnt { text-align: right; font-size: 22rpx; color: var(--ink-2); margin: 10rpx 8rpx 24rpx; }

.btn-row { display: flex; gap: 20rpx; margin-top: 10rpx; }
.grow { flex: 1; }
.btn-primary { background: #2e5bff; color: #fff; border-radius: 999rpx; font-size: 29rpx; font-weight: 600; min-height: 44px; display: flex; align-items: center; justify-content: center; width: 100%; }
.btn-primary[disabled] { opacity: 0.5; }
.btn-ghost { background: var(--card); color: var(--ink); border-radius: 999rpx; font-size: 26rpx; min-height: 44px; display: flex; align-items: center; justify-content: center; padding: 0 24rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); }
.btn-ghost[disabled] { opacity: 0.5; }
.hist-link { text-align: center; font-size: 26rpx; color: #2e5bff; margin-top: 28rpx; }

.card { background: var(--card); border-radius: 28rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 28rpx 32rpx; margin-bottom: 20rpx; }
.card-t { font-size: 29rpx; font-weight: 700; color: var(--ink); margin-bottom: 12rpx; }
.dim-row { display: flex; align-items: center; gap: 18rpx; padding: 12rpx 0; }
.dim-l { width: 130rpx; font-size: 24rpx; color: var(--ink-2); flex-shrink: 0; }
.bar { flex: 1; height: 14rpx; background: #eef1f7; border-radius: 999rpx; overflow: hidden; }
.bar-i { height: 100%; background: linear-gradient(90deg, #5b8af8, #2e5bff); border-radius: 999rpx; }
.dim-v { width: 44rpx; text-align: right; font-size: 26rpx; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.pt { font-size: 26rpx; color: var(--ink); line-height: 1.7; margin: 8rpx 0; }
.review { font-size: 27rpx; line-height: 1.8; }
.loading { font-size: 26rpx; color: var(--ink-2); padding: 20rpx 0; }
.regen { padding: 16rpx 0; }
.regen-tip { font-size: 26rpx; color: var(--ink-2); margin-bottom: 20rpx; }
.regen-btn { max-width: 360rpx; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .cat:hover, .hist-link:hover, .swap:hover { cursor: pointer; }
  .cat:hover { background: var(--soft-bg, #f5f6fa); border-radius: 16rpx; }
}
@media (min-width: 1024px) {
  .cat-list { display: grid; grid-template-columns: 1fr 1fr; column-gap: 32rpx; padding: 12rpx 32rpx; }
  .cat:nth-child(2) { border-top: none; }
  .iv-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .iv-left { width: 420px; flex: none; position: sticky; top: 24rpx; }
  .iv-right { flex: 1; min-width: 0; }
  .iv-right .ans-box { min-height: 480rpx; }
  .rp-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .rp-left { width: 420px; flex: none; }
  .rp-right { flex: 1; min-width: 0; }
  .rp-right .sec-t { margin-top: 0; }
}
/* #endif */
</style>
