<template>
  <view class="wrap">
    <view v-if="items.length" class="list">
      <view v-for="g in groups" :key="g.day" class="group">
        <kg-section-header :title="g.day + ' · ' + g.list.length + ' 组'" />
        <kg-card v-for="{ s, i } in g.list" :key="s.start" class="item" :padding="12">
          <view class="row" role="button" @click="toggle(i)">
            <view class="row-main">
              <view class="row-top">
                <text class="time num">{{ fmtTime(s.start) }}</text>
                <kg-tag v-for="m in s.modules" :key="m" tone="module" :module="m">{{ modName(m) }}</kg-tag>
              </view>
              <text class="meta"><text class="num">{{ s.n }}</text> 题 · 用时 <text class="num">{{ fmtDur(s.secs) }}</text></text>
            </view>
            <text class="pct num" :class="pctCls(s)">{{ pct(s) }}%</text>
            <l-icon name="chevron-right" :size="20" tone="faint" class="arrow" :class="{ open: openIdx === i }" />
          </view>
          <view v-if="openIdx === i" class="detail">
            <kg-skeleton v-if="detailLoading" preset="lines" />
            <template v-else>
              <view v-for="(d, j) in detail" :key="j" class="d-item">
                <view class="d-row" :class="{ wrong: !d.correct, opener: !!d.question }" @click.stop="toggleDetail(j)">
                  <l-icon :name="d.correct ? 'check' : 'x'" :size="16" :tone="d.correct ? 'ok' : 'bad'" class="d-mark" />
                  <view class="d-main">
                    <text class="d-q q-text" :class="{ ellip2: openDetailIdx !== j }">{{ d.question ? d.question.question : (d.submodule || modName(d.module)) }}</text>
                    <text v-if="!d.correct && d.picked" class="d-ans">我的答案 {{ d.picked }}<template v-if="d.question && d.question.answer"> · 正解 {{ d.question.answer }}</template></text>
                  </view>
                  <text class="d-secs num">{{ d.secs }}s</text>
                  <l-icon v-if="d.question" name="chevron-right" :size="16" tone="faint" class="arrow" :class="{ open: openDetailIdx === j }" />
                </view>
                <view v-if="openDetailIdx === j && d.question" class="d-exp">
                  <text v-for="(v, k) in d.question.options" :key="k" class="d-opt q-text" :class="{ ans: k === d.question.answer, bad: !d.correct && k === d.picked }">{{ k }}. {{ v }}</text>
                  <text class="d-ansline">正确答案 {{ d.question.answer }}<template v-if="d.picked"> · 我的答案 {{ d.picked }}</template></text>
                  <text v-if="d.question.hs_explanation || d.question.explanation" class="d-expl q-text">{{ d.question.hs_explanation || d.question.explanation }}</text>
                  <view class="d-ops" @click.stop>
                    <kg-button variant="text" size="sm" aria-label="AI 详解本题" @click.stop="askFromHistory(d)">AI 详解本题</kg-button>
                    <kg-button v-if="seenAsk" variant="text" size="sm" aria-label="回看 AI 详解" @click.stop="openSeenAsk">回看 AI 详解</kg-button>
                  </view>
                </view>
              </view>
              <kg-button v-if="wrongQs.length" variant="primary" size="md" block icon="rotate-ccw" class="btn-redo" @click="redoWrong">重练本次错题（{{ wrongQs.length }} 题）</kg-button>
            </template>
          </view>
        </kg-card>
      </view>
    </view>
    <kg-empty-state
      v-else-if="loadErr"
      icon="wifi-off"
      :title="'加载失败：' + loadErr"
      cta-text="重试"
      @cta="load"
    />
    <kg-empty-state
      v-else-if="loaded"
      icon="pencil-line"
      title="还没有练习记录"
      desc="每次刷题都会按日期记在这里，可回看每道题的作答与解析"
      cta-text="去刷一组题"
      @cta="goPractice"
    />
    <kg-skeleton v-else preset="cards" />
  </view>
</template>

<script>
import { fmtMDHM, fmtDayLabel, fmtDurShort } from '../../fmt.js';
import { request, snapPeek, anonUid, trackEvent } from '../../api.js';
import { askPrefill, askAnswerLetter } from '../../ask-prefill.js';
import { askQid, findAskSid } from '../../ask-link.js';
import { MODULES, moduleLabel } from '../../module-meta.js';

// module-meta 只收录题库 5 模块；练习历史里还会出现申论/时政会话
const EXTRA_NAMES = { shenlun: '申论', shizheng: '时事政治' };

export default {
  data() {
    return { items: [], loaded: false, loadErr: '', openIdx: -1, detail: [], detailLoading: false, openDetailIdx: -1, seenAsk: null };
  },
  computed: {
    /** 按日期分组（仅展示层）：保留 items 原顺序与原下标，toggle 仍按原下标 */
    groups() {
      const out = [];
      this.items.forEach((s, i) => {
        const day = this.fmtDay(s.start);
        let g = out[out.length - 1];
        if (!g || g.day !== day) {
          g = { day, list: [] };
          out.push(g);
        }
        g.list.push({ s, i });
      });
      return out;
    },
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
      if (MODULES[m]) return moduleLabel(m);
      return EXTRA_NAMES[m] || m || '混合';
    },
    fmtDay(ts) {
      return fmtDayLabel(ts);
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
      this.seenAsk = null;
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
      this.seenAsk = this.openDetailIdx === j
        ? findAskSid(uni.getStorageSync('askSessions'), uni.getStorageSync('askCurSession'), d.question && d.question.id)
        : null;
    },
    openSeenAsk() {
      if (!this.seenAsk) return;
      if (this.seenAsk.sid > 0) uni.setStorageSync('askOpenSid', this.seenAsk.sid);
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    askFromHistory(d) {
      const q = d && d.question;
      const text = askPrefill(q && q.question, q && q.options);
      if (!text) return;
      trackEvent('history_ask_click', d.module || '');
      uni.setStorageSync('redoQuestion', text);
      const qid = askQid(d.question && d.question.id);
      if (qid) uni.setStorageSync('redoQid', qid);
      else uni.removeStorageSync('redoQid');
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
      return fmtMDHM(ts);
    },
    fmtDur(s) {
      return fmtDurShort(s);
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
.wrap { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.list { display: flex; flex-direction: column; }
.group { margin-bottom: var(--sp-8); }
.item { margin-bottom: var(--card-gap); }
.row { display: flex; align-items: center; gap: var(--sp-12); min-height: var(--hit-min); }
.row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-4); }
.row-top { display: flex; align-items: center; gap: var(--sp-8); flex-wrap: wrap; }
.time { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.meta { font-size: var(--fs-caption); color: var(--ink-2); }
.pct { font-size: var(--fs-h2); font-weight: 600; color: var(--ink); flex-shrink: 0; }
.pct.hi { color: var(--ok-strong); }
.pct.lo { color: var(--bad-strong); }
.arrow { flex-shrink: 0; transition: transform var(--dur-fast); }
.arrow.open { transform: rotate(90deg); }

.detail { border-top: 1px solid var(--line); margin-top: var(--sp-12); padding-top: var(--sp-8); }
.d-item { border-bottom: 1px solid var(--line); }
.d-item:last-of-type { border-bottom: none; }
.d-row { display: flex; align-items: flex-start; gap: var(--sp-8); padding: var(--sp-12) 0; }
.d-mark { flex-shrink: 0; margin-top: 2px; }
.d-exp { padding: 0 0 var(--sp-12) var(--sp-24); display: flex; flex-direction: column; gap: var(--sp-8); }
.d-opt { font-size: var(--fs-sub); color: var(--ink-2); }
.d-opt.ans { color: var(--ok-strong); font-weight: 600; }
.d-opt.bad { color: var(--bad-strong); }
.d-ansline { font-size: var(--fs-sub); color: var(--ink); font-weight: 600; }
.d-expl { font-size: var(--fs-sub); color: var(--ink-2); background: var(--fill); border-radius: var(--r-sm); padding: var(--sp-8) var(--sp-12); }
.d-ops { display: flex; gap: var(--sp-4); flex-wrap: wrap; }
.d-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-4); }
.d-q { font-size: var(--fs-sub); color: var(--ink); }
.ellip2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.d-ans { font-size: var(--fs-caption); color: var(--bad-strong); }
.d-secs { font-size: var(--fs-caption); color: var(--ink-2); flex-shrink: 0; }
.btn-redo { margin-top: var(--sp-12); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .row:hover, .d-row.opener:hover { cursor: pointer; }
}
/* #endif */
</style>
