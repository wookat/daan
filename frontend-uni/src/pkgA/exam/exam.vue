<template>
  <view class="page">
    <kg-skeleton v-if="loading" preset="lines" />

    <kg-two-col v-if="!loading && items.length">
      <template #main>
        <view class="topbar">
          <kg-tag tone="module" :module="cur.module">{{ modName(cur.module) }}</kg-tag>
          <text class="pos num">{{ idx + 1 }}/{{ items.length }}</text>
          <view class="clock" :class="{ low: lowTime }" role="timer" aria-label="剩余时间">
            <l-icon name="timer" :size="16" :tone="lowTime ? 'bad' : 'muted'" />
            <text class="clock-t num">{{ fmtLeft }}</text>
          </view>
        </view>
        <kg-progress :value="idx + 1" :max="items.length" class="prog" />

        <view @touchstart="touchStart" @touchend="touchEnd">
          <kg-question-card :q="qCard" :index="idx" :total="items.length" :font-level="fontLv" :show-meta="false">
            <view v-if="cur.multi" class="multi-tip">多选题：可选多项{{ cur._picked ? '，已选 ' + cur._picked : '' }}，选完点「下一题」</view>
            <kg-option-group
              :options="optList"
              :model-value="cur.multi ? (cur._picked || '').split('') : (cur._picked || '')"
              :multiple="!!cur.multi"
              :excluded="cur._excl || []"
              :font-level="fontLv"
              @select="pick"
              @exclude="toggleExcl"
            />
          </kg-question-card>
        </view>

        <kg-action-bar
          layout="answer"
          :index="idx"
          :total="items.length"
          :primary-text="idx + 1 < items.length ? '下一题' : '交卷'"
          @primary="idx + 1 < items.length ? next() : confirmSubmit()"
        >
          <template #tools>
            <view class="kg-tool" :class="{ dis: idx === 0 }" role="button" aria-label="上一题" :aria-disabled="idx === 0 ? 'true' : 'false'" hover-class="tool-hover" @click="prev">
              <l-icon name="chevron-left" :size="24" tone="ink-2" />
            </view>
            <view class="kg-tool" :class="{ on: cur._marked }" role="button" :aria-label="cur._marked ? '取消标记' : '标记本题'" :aria-pressed="cur._marked ? 'true' : 'false'" hover-class="tool-hover" @click="toggleMark">
              <l-icon name="bookmark" :size="24" :tone="cur._marked ? 'warn' : 'ink-2'" :fill="cur._marked ? 'currentColor' : 'none'" />
            </view>
            <view class="kg-tool kg-tool--m" role="button" aria-label="答题卡" hover-class="tool-hover" @click="cardOpen = true">
              <l-icon name="clipboard-list" :size="24" tone="ink-2" />
            </view>
          </template>
        </kg-action-bar>
      </template>

      <!-- #ifdef H5 -->
      <template #aside>
        <kg-card class="side-card">
          <view class="side-h">
            <text class="side-t">答题卡</text>
            <view class="clock" :class="{ low: lowTime }">
              <l-icon name="timer" :size="16" :tone="lowTime ? 'bad' : 'muted'" />
              <text class="clock-t num">{{ fmtLeft }}</text>
            </view>
          </view>
          <view class="legend">
            <text class="lg"><text class="dot done"></text>已答</text>
            <text class="lg"><text class="dot"></text>未答</text>
            <text class="lg"><text class="dot mark"></text>标记</text>
          </view>
          <view class="acard-grid side-grid">
            <view
              v-for="(q, i) in items"
              :key="i"
              class="acard-n num"
              :class="{ done: q._picked, mark: q._marked, cur: i === idx }"
              role="button"
              :aria-label="'第 ' + (i + 1) + ' 题'"
              @click="goto(i)"
            >{{ i + 1 }}</view>
          </view>
          <text class="acard-foot">已答 {{ answeredCount }}/{{ items.length }}</text>
          <kg-button block size="lg" @click="confirmSubmit">交卷</kg-button>
          <text class="kbd-note">A–D 选择 · ←/→ 翻题 · Enter 下一题/交卷</text>
        </kg-card>
      </template>
      <!-- #endif -->
    </kg-two-col>

    <kg-sheet v-model="cardOpen" title="答题卡">
      <view class="legend">
        <text class="lg"><text class="dot done"></text>已答</text>
        <text class="lg"><text class="dot"></text>未答</text>
        <text class="lg"><text class="dot mark"></text>标记</text>
      </view>
      <view class="acard-grid">
        <view
          v-for="(q, i) in items"
          :key="i"
          class="acard-n num"
          :class="{ done: q._picked, mark: q._marked, cur: i === idx }"
          role="button"
          :aria-label="'第 ' + (i + 1) + ' 题'"
          @click="jumpTo(i)"
        >{{ i + 1 }}</view>
      </view>
      <text class="acard-foot">已答 {{ answeredCount }}/{{ items.length }} · 剩余 {{ fmtLeft }}</text>
      <template #footer><kg-button block size="lg" @click="confirmSubmit">交卷</kg-button></template>
    </kg-sheet>

    <!-- 继续上次模考：关层（X / Esc / Back / 遮罩）= 继续；「重新开始」丢弃未交卷作答，必须显式点按 -->
    <kg-sheet v-model="resumeOpen" :title="resumeAsk ? resumeAsk.title : '继续上次模考？'">
      <text class="resume-tip">{{ resumeAsk ? resumeAsk.tip : '' }}</text>
      <template #footer>
        <view class="resume-acts">
          <kg-button variant="primary" size="lg" block @click="resumePick(true)">{{ resumeAsk ? resumeAsk.cont : '继续' }}</kg-button>
          <kg-button variant="ghost" size="lg" block tone="bad" @click="resumePick(false)">{{ resumeAsk ? resumeAsk.drop : '重新开始' }}</kg-button>
        </view>
      </template>
    </kg-sheet>
  </view>
</template>

<script>
import { request, anonUid } from '../../api.js';
import { submitFailPlan } from '../../exam-policy.js';
import { dayKey } from '../../checkin.js';
import { splitMaterial, sameMaterial } from '../../material.js';
import { crossedTimeAlert } from '../../exam-alert.js';
import { toggleExcl, pickWithExcl, togglePickLetter } from '../../exam-excl.js';
import { countAnswered, shouldPushProgress } from '../../exam-resume.js';
import { resumeAsk, resumeDismissAction } from '../../resume-ask.js';
import { normFontLv } from '../../font-size.js';
import { MODULES, moduleLabel } from '../../module-meta.js';

const PROG_KEY = 'examProgress';

export default {
  data() {
    return {
      loading: true,
      attemptId: null,
      paper: null,
      items: [],
      idx: 0,
      leftSecs: 0,
      cardOpen: false,
      resumeOpen: false,
      resumeAsk: null,
      timer: null,
      qsecs: 0,
      qTimer: null,
      submitting: false,
      fontLv: normFontLv(uni.getStorageSync('fontLv')),
    };
  },
  watch: {
    resumeOpen(v) {
      if (!v && resumeDismissAction(this._resumeAct) === 'cont') this.resumePick(true);
    },
  },
  created() {
    this._endAt = 0;
    this._tsx = 0;
    this._submitTries = 0;
    this._retryTimer = null;
  },
  computed: {
    cur() { return this.items[this.idx] || {}; },
    /** KgQuestionCard 入参：资料分析同材料题组由组件折叠材料，其余题干原样 */
    qCard() {
      const q = this.cur;
      const m = this.matInfo;
      return {
        id: q.id,
        module: q.module,
        stem: m ? m.stem : String(q.question || ''),
        material: m ? m.material : '',
        images: q.image ? [q.image] : [],
      };
    },
    optList() {
      const o = this.cur.options || {};
      return Object.keys(o).map((k) => ({ key: k, text: String(o[k] == null ? '' : o[k]) }));
    },
    matInfo() {
      const q = this.cur;
      if (!q || q.module !== 'ziliao' || this.idx === 0) return null;
      const prev = this.items[this.idx - 1];
      if (!prev || prev.module !== 'ziliao' || !sameMaterial(prev.question, q.question)) return null;
      return splitMaterial(q.question);
    },
    answeredCount() { return this.items.filter((q) => q._picked).length; },
    lowTime() { return this.leftSecs > 0 && this.leftSecs <= 300; },
    fmtLeft() {
      const s = Math.max(0, this.leftSecs);
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },
  },
  async onLoad(opt) {
    this._eventId = opt.event_id ? Number(opt.event_id) : null;
    const saved = uni.getStorageSync(PROG_KEY);
    if (
      saved && saved.attemptId && saved.endAt > Date.now() &&
      ((opt.paper_id && String(saved.paperId) === String(opt.paper_id)) || (opt.mini && saved.mini)) &&
      countAnswered(saved.items) > 0
    ) {
      const resume = await new Promise((resolve) => {
        this._resumeAct = { resolve, picked: false };
        this.resumeAsk = resumeAsk('exam', {
          title: saved.paper && saved.paper.title,
          done: countAnswered(saved.items),
          total: saved.items.length,
        });
        this.resumeOpen = true;
      });
      if (resume) {
        this._progPushed = true;
        this.attemptId = saved.attemptId;
        this._mini = !!saved.mini;
        this.paper = saved.paper;
        this.items = saved.items;
        this.idx = Math.min(saved.idx || 0, saved.items.length - 1);
        this._endAt = saved.endAt;
        uni.setNavigationBarTitle({ title: this._mini ? '迷你模考' : String((saved.paper && saved.paper.title) || '全真模考').slice(0, 16) });
        this.loading = false;
        this.startClock();
        return;
      }
      uni.removeStorageSync(PROG_KEY);
    }
    await this.start(opt);
  },
  onShow() {
    this.fontLv = normFontLv(uni.getStorageSync('fontLv'));
    // #ifdef H5
    if (!this._exKeyHandler && typeof window !== 'undefined') {
      this._exKeyHandler = (e) => this.onExKeydown(e);
      window.addEventListener('keydown', this._exKeyHandler);
    }
    // #endif
  },
  onUnload() {
    this.stopClock();
    if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
    this.saveProgress();
    this.flushProgress();
    // #ifdef H5
    if (this._exKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._exKeyHandler);
      this._exKeyHandler = null;
    }
    // #endif
  },
  onHide() {
    this.saveProgress();
    this.flushProgress();
    // #ifdef H5
    if (this._exKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._exKeyHandler);
      this._exKeyHandler = null;
    }
    // #endif
  },
  methods: {
    modName(m) { return MODULES[m] ? moduleLabel(m) : '行测'; },
    resumePick(cont) {
      const act = this._resumeAct;
      if (!act || act.picked) return;
      act.picked = true;
      this.resumeOpen = false;
      act.resolve(!!cont);
    },
    async start(opt) {
      if (!opt.mini && !opt.paper_id) {
        uni.showToast({ title: '链接缺少试卷参数，去卷库选卷', icon: 'none' });
        setTimeout(() => uni.reLaunch({ url: '/pkgA/exam/list' }), 1200);
        return;
      }
      try {
        const data = opt.mini ? { uid: anonUid(), mini: true } : { uid: anonUid(), paper_id: Number(opt.paper_id) };
        const d = await request('/api/exam/start', { method: 'POST', data });
        this.attemptId = d.attempt_id;
        this.paper = d.paper;
        this.items = (d.items || []).map((q) => ({ ...q, _picked: '', _marked: false, _secs: 0 }));
        this._mini = !!opt.mini;
        this._endAt = Date.now() + d.paper.duration_min * 60 * 1000;
        uni.setNavigationBarTitle({ title: opt.mini ? '迷你模考' : d.paper.title.slice(0, 16) });
        this.loading = false;
        this.startClock();
        this.saveProgress();
      } catch (e) {
        uni.showToast({ title: '开考失败：' + e.message, icon: 'none' });
        // 深链直达时无历史栈，navigateBack 会静默失败卡在加载页，兜底回卷库
        setTimeout(() => uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pkgA/exam/list' }) }), 1200);
      }
    },
    startClock() {
      this.stopClock();
      this.leftSecs = Math.max(0, Math.round((this._endAt - Date.now()) / 1000));
      this.qsecs = 0;
      this.timer = setInterval(() => {
        const prev = this.leftSecs;
        this.leftSecs = Math.max(0, Math.round((this._endAt - Date.now()) / 1000));
        const alert = crossedTimeAlert(prev, this.leftSecs);
        if (alert) {
          const blank = this.items.length - this.answeredCount;
          uni.showToast({ title: alert.label + (blank ? '，还有 ' + blank + ' 题未作答' : ''), icon: 'none', duration: 3500 });
        }
        this.qsecs++;
        if (this.leftSecs <= 0) {
          this.stopClock();
          uni.showToast({ title: '时间到，自动交卷', icon: 'none' });
          this.submit();
        }
      }, 1000);
    },
    stopClock() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },
    flushQSecs() {
      if (this.cur && this.qsecs) {
        this.cur._secs = (this.cur._secs || 0) + this.qsecs;
        this.qsecs = 0;
      }
    },
    pick(k) {
      this.cur._excl = pickWithExcl(this.cur._excl, k);
      if (this.cur.multi) {
        this.cur._picked = togglePickLetter(this.cur._picked, k);
        this.saveProgress();
        return;
      }
      this.cur._picked = this.cur._picked === k ? '' : k;
      this.saveProgress();
      if (this.cur._picked && this.idx + 1 < this.items.length) {
        setTimeout(() => this.next(), 180);
      }
    },
    toggleExcl(k) {
      const r = toggleExcl(this.cur._excl, k, this.cur._picked);
      this.cur._excl = r.excl;
      this.cur._picked = r.picked;
      this.saveProgress();
    },
    toggleMark() {
      this.cur._marked = !this.cur._marked;
      this.saveProgress();
    },
    goto(i) {
      if (i < 0 || i >= this.items.length || i === this.idx) return;
      this.flushQSecs();
      this.idx = i;
      this.saveProgress();
    },
    prev() { this.goto(this.idx - 1); },
    next() { this.goto(this.idx + 1); },
    jumpTo(i) {
      this.cardOpen = false;
      this.goto(i);
    },
    touchStart(e) {
      this._tsx = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0;
    },
    touchEnd(e) {
      const x = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0;
      const dx = x - this._tsx;
      if (Math.abs(dx) < 60) return;
      if (dx < 0) this.next();
      else this.prev();
    },
    saveProgress() {
      if (!this.attemptId || this.submitting) return;
      uni.setStorageSync(PROG_KEY, {
        attemptId: this.attemptId,
        paperId: this.paper && this.paper.id,
        mini: !!this._mini,
        paper: this.paper,
        items: this.items,
        idx: this.idx,
        endAt: this._endAt,
      });
      clearTimeout(this._progTimer);
      this._progTimer = setTimeout(() => this.pushProgress(), 1500);
    },
    flushProgress() {
      clearTimeout(this._progTimer);
      this.pushProgress();
    },
    pushProgress() {
      if (!this.attemptId || this.submitting) return;
      const picks = {};
      const marks = [];
      const secs = {};
      const excl = {};
      this.items.forEach((q) => {
        if (q && q._picked) picks[q.id] = q._picked;
        if (q && q._marked) marks.push(q.id);
        if (q && Number.isInteger(q._secs) && q._secs > 0) secs[q.id] = q._secs;
        if (q && Array.isArray(q._excl) && q._excl.length) excl[q.id] = q._excl;
      });
      if (!shouldPushProgress(picks, this._progPushed)) return;
      this._progPushed = true;
      request('/api/exam/progress', {
        method: 'POST',
        data: { uid: anonUid(), attempt_id: this.attemptId, picks, idx: this.idx, marks, secs, excl },
      }).catch(() => {});
    },
    confirmSubmit() {
      const blank = this.items.length - this.answeredCount;
      uni.showModal({
        title: '确认交卷？',
        content: blank ? '还有 ' + blank + ' 题未作答，交卷后不能再修改' : '已全部作答，交卷查看成绩报告',
        confirmText: '交卷',
        cancelText: '再检查',
        success: (r) => { if (r.confirm) { this._submitTries = 0; this.submit(); } },
      });
    },
    async submit() {
      if (this.submitting) return;
      this.submitting = true;
      this.stopClock();
      this.flushQSecs();
      uni.showLoading({ title: '判分中…', mask: true });
      try {
        const picks = {};
        const secs = {};
        const marks = [];
        this.items.forEach((q, i) => {
          if (q._picked) picks[i + 1] = q._picked;
          if (q._secs) secs[i + 1] = q._secs;
          if (q._marked) marks.push(i + 1);
        });
        const d = await request('/api/exam/submit', {
          method: 'POST',
          data: { uid: anonUid(), attempt_id: this.attemptId, picks, secs, marks },
          timeout: 20000,
        });
        uni.removeStorageSync(PROG_KEY);
        this.mergeIntoStats(d);
        await this.gotoReport(d.attempt_id);
      } catch (e) {
        // 超时/失败先确认服务端是否已判分（请求可能已送达），已判分直接进报告，避免重交撞「已交卷」
        try {
          await request('/api/exam/report/' + this.attemptId + '?uid=' + encodeURIComponent(anonUid()), { timeout: 8000 });
          uni.removeStorageSync(PROG_KEY);
          await this.gotoReport(this.attemptId);
          return;
        } catch (e2) {
          /* 未判分，按失败分流决定重试方式 */
        }
        uni.hideLoading();
        const plan = submitFailPlan({ message: e.message, timeUp: this._endAt <= Date.now(), tries: this._submitTries });
        this._submitTries += 1;
        if (plan.action === 'terminal') {
          uni.removeStorageSync(PROG_KEY);
          uni.showModal({
            title: '交卷失败',
            content: '试卷会话已失效，本次作答无法判分（' + e.message + '）',
            showCancel: false,
            confirmText: '返回卷库',
            success: () => uni.reLaunch({ url: '/pkgA/exam/list' }),
          });
          return;
        }
        this.submitting = false;
        if (plan.action === 'retry') {
          uni.showToast({ title: '交卷失败：' + e.message + '，' + Math.round(plan.delayMs / 1000) + ' 秒后自动重试', icon: 'none', duration: 3000 });
          this._retryTimer = setTimeout(() => { this._retryTimer = null; this.submit(); }, plan.delayMs);
          return;
        }
        if (this._endAt > Date.now()) this.startClock();
        uni.showToast({ title: '交卷失败：' + e.message + '，作答已保留，可再次交卷', icon: 'none', duration: 3000 });
      }
    },
    async gotoReport(attemptId) {
      if (this._eventId) {
        try {
          await request('/api/mock/events/' + this._eventId + '/attach', {
            method: 'POST',
            data: { uid: anonUid(), attempt_id: attemptId },
          });
          uni.hideLoading();
          uni.redirectTo({ url: '/pkgA/exam/contest-report?event_id=' + this._eventId });
          return;
        } catch (e) {
          uni.showToast({ title: '未计入比赛：' + e.message, icon: 'none', duration: 2500 });
        }
      }
      uni.hideLoading();
      uni.redirectTo({ url: '/pkgA/exam/report?attempt_id=' + attemptId });
    },
    // #ifdef H5
    onExKeydown(e) {
      if (typeof window === 'undefined' || window.innerWidth < 1024) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (this.loading || !this.items.length || this.submitting || this.cardOpen) return;
      const k = e.key;
      if (/^[a-dA-D]$/.test(k)) {
        const K = k.toUpperCase();
        if (this.cur.options && this.cur.options[K] != null) {
          e.preventDefault();
          this.pick(K);
        }
      } else if (k === 'ArrowLeft' && this.idx > 0) {
        e.preventDefault();
        this.prev();
      } else if (k === 'ArrowRight' && this.idx + 1 < this.items.length) {
        e.preventDefault();
        this.next();
      } else if (k === 'Enter') {
        e.preventDefault();
        if (this.idx + 1 < this.items.length) this.next();
        else this.confirmSubmit();
      }
    },
    // #endif
    // 模考作答同步计入本地统计（统计页/打卡日历与练习同一口径）
    mergeIntoStats(d) {
      try {
        const s = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
        if (!s.byModule) s.byModule = {};
        if (!s.days) s.days = {};
        if (!s.daysCorrect) s.daysCorrect = {};
        const day = dayKey();
        let answered = 0;
        let correctN = 0;
        for (const it of d.items || []) {
          if (it.status !== 'ok') continue;
          const m = it.module || 'other';
          if (!s.byModule[m]) s.byModule[m] = { done: 0, correct: 0 };
          s.byModule[m].done++;
          if (it.correct) s.byModule[m].correct++;
          answered++;
          if (it.correct) correctN++;
        }
        if (!answered) return;
        s.days[day] = (s.days[day] || 0) + answered;
        s.daysCorrect[day] = (s.daysCorrect[day] || 0) + correctN;
        uni.setStorageSync('pstats', s);
        const hist = uni.getStorageSync('practiceHistory') || [];
        hist.unshift({
          t: Date.now(),
          uid: anonUid(),
          module: '',
          n: d.total,
          correct: d.correct,
          secs: this.items.reduce((a, q) => a + (q._secs || 0), 0),
          exam: this._mini ? 'mini' : 'full',
        });
        uni.setStorageSync('practiceHistory', hist.slice(0, 100));
      } catch (e) { /* 非关键路径 */ }
    },
  },
};
</script>

<style scoped>
.page { padding: var(--sp-16) var(--page-x) calc(var(--bar-h) + var(--sp-24) + env(safe-area-inset-bottom, 0px)); }
.topbar { display: flex; align-items: center; gap: var(--sp-12); min-height: var(--hit-min); }
.pos { flex: 1; font-size: var(--fs-sub); color: var(--ink-2); }
.clock { display: inline-flex; align-items: center; gap: var(--sp-4); }
.clock-t { font-size: var(--fs-h3); color: var(--ink); }
.clock.low .clock-t { color: var(--bad-strong); }
.clock.low { animation: clock-pulse 1s ease-in-out infinite; }
@keyframes clock-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
.prog { margin: var(--sp-8) 0 var(--sp-16); }
.kg-tool.on { background: var(--warn-soft); }
.kg-tool.dis { opacity: 0.4; }
.tool-hover { background: var(--fill); }
.legend { display: flex; gap: var(--sp-16); margin-bottom: var(--sp-12); }
.resume-tip { display: block; font-size: var(--fs-sub); color: var(--ink-3); line-height: 1.6; padding: var(--sp-4) 0 var(--sp-8); }
.resume-acts { display: grid; gap: var(--sp-8); }
.lg { display: inline-flex; align-items: center; gap: var(--sp-4); font-size: var(--fs-caption); color: var(--ink-2); }
.dot { width: 10px; height: 10px; border-radius: var(--r-full); background: var(--fill); border: 1px solid var(--line); display: inline-block; }
.dot.done { background: var(--brand); border-color: var(--brand); }
.dot.mark { background: var(--warn-soft); border-color: var(--warn); }
.acard-grid { display: flex; flex-wrap: wrap; gap: var(--sp-8); padding: var(--sp-4) 0 var(--sp-12); }
.acard-n {
  width: var(--acard-cell); height: var(--acard-cell); line-height: var(--acard-cell); text-align: center; border-radius: var(--r-full);
  background: var(--fill); border: 1px solid var(--line); font-size: var(--fs-sub); color: var(--ink-2); box-sizing: border-box;
}
.acard-n.done { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.acard-n.mark { border-color: var(--warn); }
.acard-n.cur { box-shadow: 0 0 0 2px var(--brand-soft-2); border-color: var(--brand); }
.acard-foot { display: block; text-align: center; font-size: var(--fs-sub); color: var(--ink-3); padding: var(--sp-4) 0 var(--sp-12); }

.multi-tip { font-size: var(--fs-caption); line-height: 1.5; color: var(--brand-text); background: var(--brand-soft); border-radius: var(--r-xs); padding: var(--sp-4) var(--sp-8); margin-bottom: var(--sp-8); }

/* #ifdef H5 */
.page :deep(.kg-two__aside) { display: none; }
.side-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-12); }
.side-t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.side-grid { max-height: 46vh; overflow-y: auto; }
.kbd-note { display: block; text-align: center; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-12); }
@media (min-width: 1024px) {
  .page { max-width: 1064px; margin: 0 auto; padding-bottom: var(--sp-24); }
  .page :deep(.kg-two__aside) { display: block; }
  .kg-tool, .acard-n { cursor: pointer; }
}
/* #endif */
</style>
