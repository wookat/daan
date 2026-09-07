<template>
  <view class="page">
    <!-- 第一步：选分类 -->
    <kg-two-col v-if="step === 'pick'" aside-first>
      <template #aside>
        <kg-hero-card
          label="AI 结构化面试陪练 · 已练"
          :value="doneTotal"
          unit="题"
          :primary="{ text: '随机抽一题' }"
          class="hero"
          @primary="draw('')"
        >
          <text class="hero-s">抽题作答 · 考官级五维打分 · 逐段点评 · <text class="num">{{ bankTotal }}</text> 道真题/经典题（来源公开资料）</text>
        </kg-hero-card>
      </template>
      <template #main>
        <kg-section-header title="选择题型分类" more="练习记录" to="/pkgA/interview/history" />
        <kg-skeleton v-if="!categories.length && catLoading" preset="lines" />
        <wd-cell-group v-else custom-class="cellcard" border>
          <wd-cell
            v-for="c in categories"
            :key="c.name"
            :title="c.name"
            :label="'共 ' + c.total + ' 题 · 已练 ' + c.done"
            is-link
            clickable
            @click="draw(c.name)"
          />
        </wd-cell-group>
        <kg-empty-state
          v-if="!categories.length && !catLoading"
          compact
          icon="mic"
          title="题库暂时没有加载出来"
          desc="检查网络后重试，或直接随机抽一题"
          cta-text="重试"
          @cta="loadCategories"
        />
      </template>
    </kg-two-col>

    <!-- 第二步：作答 -->
    <kg-two-col v-else-if="step === 'answer'" aside-first>
      <template #aside>
        <kg-card class="q-card">
          <view class="q-meta">
            <kg-tag tone="brand">{{ question.category }}</kg-tag>
            <text class="q-src">{{ question.source }}</text>
          </view>
          <text class="q-text stem">{{ question.question }}</text>
        </kg-card>
        <view class="timer-row">
          <view class="timer"><l-icon name="timer" :size="16" tone="ink-2" /><text class="num">{{ fmtDur(elapsed) }}</text></view>
          <kg-button variant="text" size="sm" icon="shuffle" @click="draw(pickedCategory, question.id)">换一题</kg-button>
        </view>
      </template>
      <template #main>
        <kg-card :padding="12" class="ans-card">
          <textarea
            v-model="answer"
            class="ans-box"
            :maxlength="5000"
            placeholder="像面试现场一样组织语言作答（建议 200 字以上）…草稿自动保存在本机"
            placeholder-style="color: var(--ink-4)"
            @input="saveDraft"
          />
        </kg-card>
        <text class="cnt"><text v-if="answer" class="cnt-save">已自动保存 · </text><text class="num">{{ answer.length }}</text> / 5000</text>
        <view class="btn-row">
          <kg-button variant="ghost" size="lg" icon="mic" @click="voiceStub">语音（即将上线）</kg-button>
          <kg-button variant="primary" size="lg" class="grow" :disabled="answer.trim().length < 20 || submitting" :loading="submitting" @click="submit">
            {{ submitting ? '考官点评中…' : '提交作答' }}
          </kg-button>
        </view>
      </template>
    </kg-two-col>

    <!-- 第三步：点评报告 -->
    <template v-else>
      <kg-hero-card :label="'结构化面试 · ' + report.category + ' · 得分'" :value="report.total" :total="100" class="hero">
        <text class="hero-s">作答 <text class="num">{{ fmtDur(report.duration) }}</text> · <text class="num">{{ report.answerLen }}</text> 字</text>
        <text v-if="report.summary" class="hero-sum">{{ report.summary }}</text>
      </kg-hero-card>

      <kg-two-col aside-first>
        <template #aside>
          <kg-card class="card">
            <text class="card-t">五维评分</text>
            <view v-for="(v, k) in report.scores" :key="k" class="dim-row">
              <text class="dim-l">{{ k }}</text>
              <kg-progress :value="v * 10" :thickness="8" :aria-label="k + ' 评分'" class="dim-bar" />
              <text class="dim-v num">{{ v }}</text>
            </view>
          </kg-card>

          <kg-section-header title="题目" />
          <kg-card class="q-card"><text class="q-text stem">{{ question.question }}</text></kg-card>

          <kg-card v-if="points.length" class="card">
            <text class="card-t">参考思路要点</text>
            <text v-for="(p, i) in points" :key="i" class="pt">{{ i + 1 }}. {{ p }}</text>
          </kg-card>
        </template>
        <template #main>
          <kg-section-header :title="'考官点评' + (streaming ? '（生成中…）' : '')" />
          <kg-card class="review">
            <rich-text v-if="reviewHtml" :nodes="reviewHtml" />
            <view v-if="reviewMissing && !streaming" class="regen">
              <text class="regen-tip">{{ review ? '点评可能不完整（生成被中断）' : '上次点评生成被中断，评分已保留' }}</text>
              <!-- #ifdef H5 -->
              <kg-button variant="secondary" size="md" icon="rotate-ccw" @click="regenReview">重新生成点评</kg-button>
              <!-- #endif -->
            </view>
            <view v-if="!reviewHtml && (!reviewMissing || streaming)" class="loading" aria-busy="true">
              <kg-skeleton preset="lines" />
              <text class="loading-t">{{ loadingLabel }}</text>
            </view>
          </kg-card>

          <view class="btn-row">
            <kg-button variant="ghost" size="lg" :disabled="streaming" @click="retry">重答本题</kg-button>
            <kg-button variant="primary" size="lg" class="grow" :disabled="streaming" @click="draw(pickedCategory, question.id)">再练一题</kg-button>
          </view>
          <kg-button variant="text" size="md" block icon="chevron-right" class="hist-link" @click="goHistory">练习记录</kg-button>
        </template>
      </kg-two-col>
    </template>
  </view>
</template>

<script>
import { interviewCategories, interviewDraw, interviewSession, streamInterview } from '../../api.js';
// #ifdef H5
import { streamInterviewReviewRegen } from '../../api.js';
// #endif
import { md } from '../../md.js';
import { reviewThinkingLabel, thinkingSecs } from '../../ask-link.js';

export default {
  data() {
    return {
      step: 'pick',
      categories: [],
      catLoading: false,
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
      thinkSecs: 0,
      points: [],
    };
  },
  created() {
    this._timer = null;
  },
  computed: {
    doneTotal() {
      return this.categories.reduce((n, c) => n + (Number(c.done) || 0), 0);
    },
    reviewHtml() {
      return this.review ? md(this.review) : '';
    },
    loadingLabel() {
      return reviewThinkingLabel(this.thinkSecs);
    },
  },
  onLoad(opts) {
    if (opts && opts.session_id) this.loadSession(opts.session_id);
    else if (!this.restoreDraft()) this.loadCategories();
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
      this.catLoading = true;
      try {
        const d = await interviewCategories();
        this.categories = d.categories || [];
        this.bankTotal = d.total || 0;
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' });
      }
      this.catLoading = false;
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
    saveDraft() {
      if (!this.question.id) return;
      if (this.answer) uni.setStorageSync('ivDraft', { q: this.question, cat: this.pickedCategory, answer: this.answer });
      else uni.removeStorageSync('ivDraft');
    },
    restoreDraft() {
      const d = uni.getStorageSync('ivDraft');
      if (!d || !d.q || !d.q.id || !(d.answer || '').trim()) return false;
      this.question = d.q;
      this.pickedCategory = d.cat || '';
      this.answer = d.answer;
      this.step = 'answer';
      this.startTimer();
      uni.showToast({ title: '已恢复上次未提交的作答', icon: 'none' });
      this.loadCategories();
      return true;
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
        this.thinkSecs = 0;
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
          onThinking: (t) => { this.thinkSecs = thinkingSecs(t); },
        });
        this.review = res.review || this.review;
        uni.removeStorageSync('ivDraft');
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
      this.thinkSecs = 0;
      try {
        const sid = this._sid;
        await streamInterviewReviewRegen({
          sessionId: sid,
          onDelta: (full) => { this.review = full; },
          onThinking: (t) => { this.thinkSecs = thinkingSecs(t); },
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
.page { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.hero { margin-bottom: var(--card-gap); }
.hero-s { display: block; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--on-brand-2); margin-bottom: var(--sp-8); }
.hero-sum { display: block; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--on-brand); border-top: 1px solid var(--on-brand-2); padding-top: var(--sp-8); margin-bottom: var(--sp-4); opacity: 0.92; }

.q-card { margin-bottom: var(--sp-12); }
.q-meta { display: flex; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-8); }
.q-src { font-size: var(--fs-caption); color: var(--ink-2); }
.stem { display: block; font-size: var(--fs-body); line-height: var(--lh-question); color: var(--ink); }

.timer-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-12); }
.timer { display: flex; align-items: center; gap: var(--sp-4); font-size: var(--fs-sub); color: var(--ink-2); }
.ans-card { margin-bottom: var(--sp-4); }
.ans-box { width: 100%; box-sizing: border-box; min-height: 160px; background: transparent; color: var(--ink); font-size: var(--fs-body); line-height: var(--lh-body); }
.cnt { display: block; text-align: right; font-size: var(--fs-caption); color: var(--ink-2); margin: 0 var(--sp-4) var(--sp-12); }
.cnt-save { color: var(--ink-3); }

.btn-row { display: flex; gap: var(--sp-12); margin-top: var(--sp-4); }
.grow { flex: 1; }
.hist-link { margin-top: var(--sp-12); }

.card { margin-bottom: var(--card-gap); }
.card-t { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); margin-bottom: var(--sp-8); }
.dim-row { display: flex; align-items: center; gap: var(--sp-12); padding: var(--sp-4) 0; }
.dim-l { width: 64px; font-size: var(--fs-caption); color: var(--ink-2); flex-shrink: 0; }
.dim-bar { flex: 1; }
.dim-v { width: 24px; text-align: right; font-size: var(--fs-sub); font-weight: 600; color: var(--ink); flex-shrink: 0; }
.pt { display: block; font-size: var(--fs-sub); color: var(--ink); line-height: var(--lh-sub); margin: var(--sp-4) 0; }
.review { font-size: var(--fs-body); line-height: var(--lh-body); color: var(--ink); margin-bottom: var(--card-gap); }
.loading { padding: var(--sp-8) 0; }
.loading-t { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); color: var(--ink-2); }
.regen { padding: var(--sp-8) 0; display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-12); }
.regen-tip { font-size: var(--fs-sub); color: var(--ink-2); }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .ans-box { min-height: 320px; }
}
/* #endif */
</style>
