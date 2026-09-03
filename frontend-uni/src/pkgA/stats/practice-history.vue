<template>
  <view class="wrap">
    <view v-if="items.length" class="list">
      <view v-for="(s, i) in items" :key="s.start" class="item">
        <view class="row" @click="toggle(i)">
          <view class="row-main">
            <view class="row-top">
              <text class="time">{{ fmtTime(s.start) }}</text>
              <text v-for="m in s.modules" :key="m" class="chip">{{ modName(m) }}</text>
            </view>
            <text class="meta">{{ s.n }} 题 · 用时 {{ fmtDur(s.secs) }}</text>
          </view>
          <text class="pct" :class="pctCls(s)">{{ pct(s) }}%</text>
          <text class="arrow" :class="{ open: openIdx === i }">›</text>
        </view>
        <view v-if="openIdx === i" class="detail">
          <view v-if="detailLoading" class="d-loading">加载中…</view>
          <template v-else>
            <view v-for="(d, j) in detail" :key="j" class="d-item">
              <view class="d-row" :class="{ wrong: !d.correct, opener: !!d.question }" @click.stop="toggleDetail(j)">
                <text class="d-mark" :class="d.correct ? 'ok' : 'bad'">{{ d.correct ? '✓' : '✗' }}</text>
                <view class="d-main">
                  <text class="d-q" :class="{ ellip2: openDetailIdx !== j }">{{ d.question ? d.question.question : (d.submodule || modName(d.module)) }}</text>
                  <text v-if="!d.correct && d.picked" class="d-ans">我的答案 {{ d.picked }}<template v-if="d.question && d.question.answer"> · 正解 {{ d.question.answer }}</template></text>
                </view>
                <text class="d-secs">{{ d.secs }}s</text>
                <text v-if="d.question" class="d-arrow" :class="{ open: openDetailIdx === j }">›</text>
              </view>
              <view v-if="openDetailIdx === j && d.question" class="d-exp">
                <view v-for="(v, k) in d.question.options" :key="k" class="d-opt" :class="{ ans: k === d.question.answer, bad: !d.correct && k === d.picked }">{{ k }}. {{ v }}</view>
                <view class="d-ansline">正确答案 {{ d.question.answer }}<template v-if="d.picked"> · 我的答案 {{ d.picked }}</template></view>
                <view v-if="d.question.hs_explanation || d.question.explanation" class="d-expl">{{ d.question.hs_explanation || d.question.explanation }}</view>
                <view class="d-ops">
                  <text class="d-op" role="button" aria-label="AI 详解本题" @click.stop="askFromHistory(d)">AI 详解本题</text>
                </view>
              </view>
            </view>
            <button v-if="wrongQs.length" class="btn-redo" @click="redoWrong">重练本次错题（{{ wrongQs.length }} 题）</button>
          </template>
        </view>
      </view>
    </view>
    <view v-else-if="loadErr" class="empty">
      <text class="empty-t">加载失败：{{ loadErr }}</text>
      <view class="retry" @click="load">重试 ›</view>
    </view>
    <view v-else-if="loaded" class="empty">
      <view class="empty-ico"><l-icon name="edit-3" :size="30" color="#b0b4c0" /></view>
      <text class="empty-t">还没有练习记录</text>
      <button class="btn-primary" @click="goPractice">去刷一组题</button>
    </view>
  </view>
</template>

<script>
import { request, snapPeek, anonUid, trackEvent } from '../../api.js';
import { askPrefill, askAnswerLetter } from '../../ask-prefill.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论', shizheng: '时事政治' };

export default {
  data() {
    return { items: [], loaded: false, loadErr: '', openIdx: -1, detail: [], detailLoading: false, openDetailIdx: -1 };
  },
  computed: {
    wrongQs() {
      const seen = new Set();
      const out = [];
      this.detail.forEach((d) => {
        if (!d.correct && d.question && d.question.id && !seen.has(d.question.id)) {
          seen.add(d.question.id);
          out.push(d.question);
        }
      });
      return out;
    },
  },
  onShow() {
    this.load();
  },
  methods: {
    modName(m) {
      return NAMES[m] || m || '混合';
    },
    async load() {
      this.loadErr = '';
      const p = '/api/practice/history?uid=' + encodeURIComponent(anonUid());
      // 快照即显：uid API 长尾下先用最近成功快照铺屏，真实响应到达后覆盖
      const snap = snapPeek(p);
      if (snap) {
        this.items = snap.items || [];
        this.loaded = true;
      }
      try {
        const d = await request(p);
        this.items = d.items || [];
      } catch (e) {
        this.loadErr = e.message || '网络异常';
        uni.showToast({ title: e.message || '加载失败', icon: 'none' });
      }
      this.loaded = true;
    },
    async toggle(i) {
      if (this.openIdx === i) {
        this.openIdx = -1;
        return;
      }
      this.openIdx = i;
      this.openDetailIdx = -1;
      this.detail = [];
      this.detailLoading = true;
      const s = this.items[i];
      try {
        const d = await request(
          '/api/practice/history/detail?uid=' + encodeURIComponent(anonUid()) + '&start=' + s.start + '&end=' + s.end
        );
        this.detail = d.items || [];
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' });
      }
      this.detailLoading = false;
    },
    toggleDetail(j) {
      const d = this.detail[j];
      if (!d || !d.question) return;
      this.openDetailIdx = this.openDetailIdx === j ? -1 : j;
    },
    askFromHistory(d) {
      const q = d && d.question;
      const text = askPrefill(q && q.question, q && q.options);
      if (!text) return;
      trackEvent('history_ask_click', d.module || '');
      uni.setStorageSync('redoQuestion', text);
      const ans = askAnswerLetter(d.picked);
      if (ans) uni.setStorageSync('redoAnswer', ans);
      else uni.removeStorageSync('redoAnswer');
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    pct(s) {
      return s.n ? Math.round((s.correct / s.n) * 100) : 0;
    },
    pctCls(s) {
      const p = this.pct(s);
      return p >= 80 ? 'hi' : p < 60 ? 'lo' : '';
    },
    fmtTime(ts) {
      const d = new Date(ts * 1000);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    fmtDur(s) {
      if (!s) return '0"';
      const m = Math.floor(s / 60);
      return m ? m + "'" + String(s % 60).padStart(2, '0') + '"' : s + '"';
    },
    redoWrong() {
      uni.setStorageSync('redoSet', this.wrongQs);
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goPractice() {
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 60rpx; }
.list { display: flex; flex-direction: column; gap: 18rpx; }
.item { background: var(--card); border-radius: 24rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); overflow: hidden; }
.row { display: flex; align-items: center; gap: 16rpx; padding: 24rpx 28rpx; }
.row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.row-top { display: flex; align-items: center; gap: 10rpx; flex-wrap: wrap; }
.time { font-size: 26rpx; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
.chip { background: #e8effe; color: var(--brand-text); font-size: 20rpx; font-weight: 600; border-radius: 8rpx; padding: 2rpx 12rpx; }
.meta { font-size: 22rpx; color: var(--ink-2); }
.pct { font-size: 32rpx; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
.pct.hi { color: var(--ok-strong, #15803d); }
.pct.lo { color: var(--bad-strong, #b91c1c); }
.arrow { font-size: 32rpx; color: var(--ink-4); transition: transform 0.15s; }
.arrow.open { transform: rotate(90deg); }

.detail { border-top: 1rpx solid var(--line, #eef0f4); padding: 12rpx 28rpx 24rpx; }
.d-loading { font-size: 24rpx; color: var(--ink-2); padding: 20rpx 0; text-align: center; }
.d-item { border-bottom: 1rpx solid var(--line, #f2f3f7); }
.d-item:last-of-type { border-bottom: none; }
.d-row { display: flex; align-items: flex-start; gap: 14rpx; padding: 16rpx 0; }
.d-arrow { font-size: 28rpx; color: var(--ink-4); flex-shrink: 0; transition: transform 0.15s; }
.d-arrow.open { transform: rotate(90deg); }
.d-exp { padding: 0 0 20rpx 48rpx; display: flex; flex-direction: column; gap: 10rpx; }
.d-opt { font-size: 24rpx; color: var(--ink-2); line-height: 1.6; }
.d-opt.ans { color: var(--ok-strong, #15803d); font-weight: 600; }
.d-opt.bad { color: var(--bad-strong, #b91c1c); }
.d-ansline { font-size: 23rpx; color: var(--ink); font-weight: 600; }
.d-expl { font-size: 23rpx; color: var(--ink-2); line-height: 1.7; background: var(--bg-2, #f6f7fa); border-radius: 12rpx; padding: 14rpx 18rpx; }
.d-ops { display: flex; gap: 28rpx; }
.d-op { font-size: 24rpx; color: var(--brand-text, #2e5bff); font-weight: 600; }
.d-mark { font-size: 26rpx; font-weight: 800; width: 34rpx; text-align: center; flex-shrink: 0; }
.d-mark.ok { color: var(--ok-strong, #15803d); }
.d-mark.bad { color: var(--bad-strong, #b91c1c); }
.d-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.d-q { font-size: 25rpx; color: var(--ink); line-height: 1.6; }
.ellip2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.d-ans { font-size: 22rpx; color: var(--bad-strong, #b91c1c); }
.d-secs { font-size: 22rpx; color: var(--ink-2); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.btn-redo { margin-top: 20rpx; background: #2e5bff; color: #fff; border-radius: 999rpx; font-size: 26rpx; font-weight: 600; min-height: 40px; display: flex; align-items: center; justify-content: center; }

.empty { display: flex; flex-direction: column; align-items: center; gap: 16rpx; padding: 120rpx 0; }
.empty-t { font-size: 27rpx; color: var(--ink-2); }
.retry { margin-top: 8rpx; color: var(--brand-text); font-size: 26rpx; font-weight: 500; }
.btn-primary { background: #2e5bff; color: #fff; border-radius: 999rpx; font-size: 28rpx; font-weight: 600; min-height: 44px; display: flex; align-items: center; justify-content: center; padding: 0 60rpx; margin-top: 12rpx; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 880px; margin: 0 auto; }
  .row:hover, .btn-redo:hover, .btn-primary:hover, .d-row.opener:hover, .d-op:hover { cursor: pointer; }
}
@media (min-width: 1024px) {
  .item { transition: box-shadow 0.15s; }
  .item:hover { box-shadow: 0 6rpx 20rpx rgba(23, 24, 28, 0.1); }
}
/* #endif */
</style>
