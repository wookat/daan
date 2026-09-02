<template>
  <view class="wrap">
    <view v-if="loading" class="spin">试卷加载中…</view>

    <template v-if="!loading && items.length">
      <view class="ex-cols">
      <view class="ex-main">
      <view class="topbar">
        <text class="mod">{{ modName(cur.module) }}</text>
        <text class="clock" :class="{ low: lowTime }">⏱ {{ fmtLeft }}</text>
        <view class="top-btns">
          <view class="tbtn" :class="{ on: cur._marked }" @click="toggleMark">{{ cur._marked ? '已标记' : '标记' }}</view>
        </view>
      </view>

      <view class="meta-row"><text class="pos">{{ idx + 1 }}/{{ items.length }}</text></view>
      <view class="progress"><view class="pfill" :style="{ width: ((idx + 1) / items.length) * 100 + '%' }"></view></view>

      <view class="card qcard" @touchstart="touchStart" @touchend="touchEnd">
        <view
          v-if="matInfo"
          class="mat-fold"
          role="button"
          :aria-label="matOpen[idx] ? '收起材料' : '展开材料'"
          @click="toggleMat"
        >
          <text class="mat-fold-t">📄 同上材料（与上一题相同）</text>
          <text class="mat-fold-a">{{ matOpen[idx] ? '收起 ‹' : '展开 ›' }}</text>
        </view>
        <text class="q">{{ matInfo && !matOpen[idx] ? matInfo.stem : cur.question }}</text>
        <image v-if="cur.image" :src="cur.image" class="qimg" mode="widthFix" />
        <view
          v-for="(v, k) in cur.options"
          :key="k"
          class="opt"
          :class="{ sel: cur._picked === k }"
          @click="pick(k)"
        >
          <text class="okey">{{ k }}</text>
          <text class="otext">{{ v }}</text>
        </view>
      </view>

      <view class="navrow">
        <view class="nbtn" :class="{ dis: idx === 0 }" @click="prev">上一题</view>
        <view class="nbtn acard-btn" @click="cardOpen = true">答题卡</view>
        <view v-if="idx + 1 < items.length" class="nbtn main" @click="next">下一题</view>
        <view v-else class="nbtn main" @click="confirmSubmit">交卷</view>
      </view>
      </view>

      <!-- #ifdef H5 -->
      <view class="ex-side">
        <view class="card side-card">
          <view class="side-h">
            <text class="side-t">答题卡</text>
            <text class="side-clock" :class="{ low: lowTime }">⏱ {{ fmtLeft }}</text>
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
              class="acard-n"
              :class="{ done: q._picked, mark: q._marked, cur: i === idx }"
              @click="goto(i)"
            >{{ i + 1 }}</view>
          </view>
          <view class="acard-foot">已答 {{ answeredCount }}/{{ items.length }}</view>
          <button class="btn" @click="confirmSubmit">交卷</button>
          <view class="kbd-note">A–D 选择 · ←/→ 翻题 · Enter 下一题/交卷</view>
        </view>
      </view>
      <!-- #endif -->
      </view>
    </template>

    <!-- 答题卡浮层 -->
    <view v-if="cardOpen" class="mask" @click="cardOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">答题卡</text>
          <view class="sheet-x" role="button" aria-label="关闭" @click="cardOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <view class="legend">
          <text class="lg"><text class="dot done"></text>已答</text>
          <text class="lg"><text class="dot"></text>未答</text>
          <text class="lg"><text class="dot mark"></text>标记</text>
        </view>
        <scroll-view scroll-y class="acard-scroll">
          <view class="acard-grid">
            <view
              v-for="(q, i) in items"
              :key="i"
              class="acard-n"
              :class="{ done: q._picked, mark: q._marked, cur: i === idx }"
              @click="jumpTo(i)"
            >{{ i + 1 }}</view>
          </view>
        </scroll-view>
        <view class="acard-foot">已答 {{ answeredCount }}/{{ items.length }} · 剩余 {{ fmtLeft }}</view>
        <button class="btn" @click="confirmSubmit">交卷</button>
      </view>
    </view>
  </view>
</template>

<script>
import { request, anonUid } from '../../api.js';
import { submitFailPlan } from '../../exam-policy.js';
import { dayKey } from '../../checkin.js';
import { splitMaterial, sameMaterial } from '../../material.js';
import { crossedTimeAlert } from '../../exam-alert.js';

const MODS = { changshi: '常识判断', yanyu: '言语理解', shuliang: '数量关系', panduan: '判断推理', ziliao: '资料分析' };
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
      timer: null,
      qsecs: 0,
      qTimer: null,
      submitting: false,
      matOpen: {},
    };
  },
  created() {
    this._endAt = 0;
    this._tsx = 0;
    this._submitTries = 0;
    this._retryTimer = null;
  },
  computed: {
    cur() { return this.items[this.idx] || {}; },
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
      ((opt.paper_id && String(saved.paperId) === String(opt.paper_id)) || (opt.mini && saved.mini))
    ) {
      const resume = await new Promise((resolve) => {
        uni.showModal({
          title: '继续上次模考？',
          content: '检测到未交卷的进度（已答 ' + saved.items.filter((q) => q._picked).length + '/' + saved.items.length + ' 题）',
          confirmText: '继续', cancelText: '重新开始',
          success: (r) => resolve(r.confirm), fail: () => resolve(false),
        });
      });
      if (resume) {
        this.attemptId = saved.attemptId;
        this._mini = !!saved.mini;
        this.paper = saved.paper;
        this.items = saved.items;
        this.idx = Math.min(saved.idx || 0, saved.items.length - 1);
        this._endAt = saved.endAt;
        this.loading = false;
        this.startClock();
        return;
      }
      uni.removeStorageSync(PROG_KEY);
    }
    await this.start(opt);
  },
  onShow() {
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
  watch: {
    items() {
      this.matOpen = {};
    },
  },
  methods: {
    modName(m) { return MODS[m] || '行测'; },
    toggleMat() {
      this.matOpen = { ...this.matOpen, [this.idx]: !this.matOpen[this.idx] };
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
        uni.setNavigationBarTitle({ title: d.paper.title.slice(0, 16) });
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
      this.cur._picked = this.cur._picked === k ? '' : k;
      this.saveProgress();
      if (this.cur._picked && this.idx + 1 < this.items.length) {
        setTimeout(() => this.next(), 180);
      }
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
      this.items.forEach((q) => {
        if (q && q._picked) picks[q.id] = q._picked;
        if (q && q._marked) marks.push(q.id);
        if (q && Number.isInteger(q._secs) && q._secs > 0) secs[q.id] = q._secs;
      });
      request('/api/exam/progress', {
        method: 'POST',
        data: { uid: anonUid(), attempt_id: this.attemptId, picks, idx: this.idx, marks, secs },
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
.wrap { padding: 24rpx; padding-bottom: calc(140rpx + env(safe-area-inset-bottom)); }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 60rpx 24rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; gap: 12rpx; }
.meta-row { display: flex; justify-content: flex-end; margin-bottom: 8rpx; }
.pos { font-size: 24rpx; font-weight: 600; color: var(--ink-2); }
.mod { font-size: 21rpx; color: var(--brand-text); background: var(--brand-soft); border-radius: 8rpx; padding: 2rpx 12rpx; }
.clock { font-size: 32rpx; font-weight: 700; color: #ef4444; font-variant-numeric: tabular-nums; }
.clock.low, .side-clock.low { animation: clock-pulse 1s ease-in-out infinite; }
@keyframes clock-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
@media (prefers-reduced-motion: reduce) {
  .clock.low, .side-clock.low { animation: none; }
}
.top-btns { display: flex; gap: 10rpx; }
.tbtn { min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; font-size: 23rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 0 22rpx; background: var(--card); }
.tbtn.on { color: #d97706; border-color: #f59e0b; background: var(--warn-soft); font-weight: 600; }
.progress { height: 6rpx; background: #dbe6ff; border-radius: 999rpx; overflow: hidden; margin-bottom: 20rpx; }
.pfill { height: 100%; background: linear-gradient(90deg, #5c82ff, var(--brand)); border-radius: 999rpx; transition: width 0.3s ease; }
.q { font-size: 30rpx; line-height: 1.7; margin-bottom: 22rpx; white-space: pre-wrap; display: block; }
.mat-fold {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f0fdfa;
  border: 1rpx solid #99f6e4;
  border-radius: 12rpx;
  padding: 14rpx 20rpx;
  margin-bottom: 14rpx;
}
.mat-fold-t { font-size: 24rpx; color: #0f766e; }
.mat-fold-a {
  font-size: 24rpx;
  color: #0d9488;
  font-weight: 600;
  flex-shrink: 0;
  margin-left: 16rpx;
}
.qimg { width: 100%; border-radius: 12rpx; margin-bottom: 16rpx; background: var(--fill); }
.opt { display: flex; align-items: center; border: 2rpx solid var(--line); border-radius: 20rpx; padding: 22rpx 24rpx; margin-bottom: 20rpx; font-size: 29rpx; line-height: 1.6; min-height: 44px; box-sizing: border-box; }
.opt.sel { border-color: var(--brand-text); background: var(--brand-soft); }
.okey { flex-shrink: 0; width: 52rpx; height: 52rpx; line-height: 52rpx; text-align: center; border-radius: 50%; background: var(--soft-bg); color: var(--ink-2); font-weight: 600; font-size: 26rpx; margin-right: 20rpx; border: 1rpx solid var(--line); }
.opt.sel .okey { background: var(--brand); color: #fff; border-color: var(--brand-text); }
.otext { flex: 1; }
.navrow { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; gap: 16rpx; padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom)); background: var(--card); border-top: 1rpx solid var(--line); }
.nbtn { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--brand); color: var(--brand-text); border-radius: 999rpx; font-size: 27rpx; font-weight: 500; background: var(--card); }
.nbtn.acard-btn { flex: 0 0 176rpx; border-color: var(--line); color: var(--ink-2); }
.nbtn.main { background: var(--brand); color: #fff; }
.nbtn.dis { opacity: 0.4; }
.mask { position: fixed; inset: 0; background: rgba(15, 18, 25, 0.45); z-index: 90; display: flex; align-items: flex-end; }
.sheet { width: 100%; background: var(--card); border-radius: 28rpx 28rpx 0 0; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); max-height: 75vh; display: flex; flex-direction: column; box-sizing: border-box; }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.sheet-t { font-size: 30rpx; font-weight: 600; }
.sheet-x { font-size: 30rpx; color: var(--ink-2); padding: 8rpx 16rpx; }
.legend { display: flex; gap: 24rpx; margin-bottom: 16rpx; }
.lg { display: inline-flex; align-items: center; gap: 8rpx; font-size: 22rpx; color: var(--ink-2); }
.dot { width: 20rpx; height: 20rpx; border-radius: 50%; background: var(--soft-bg); border: 2rpx solid var(--line); display: inline-block; }
.dot.done { background: var(--brand); border-color: var(--brand-text); }
.dot.mark { background: var(--warn-soft); border-color: #f59e0b; }
.acard-scroll { max-height: 40vh; }
.acard-grid { display: flex; flex-wrap: wrap; gap: 20rpx; padding: 8rpx 0 20rpx; }
.acard-n { width: 80rpx; height: 80rpx; line-height: 80rpx; text-align: center; border-radius: 50%; background: var(--soft-bg); border: 2rpx solid var(--line); font-size: 27rpx; font-weight: 600; color: var(--ink-2); box-sizing: border-box; }
.acard-n.done { background: var(--brand); border-color: var(--brand-text); color: #fff; }
.acard-n.mark { border-color: #f59e0b; }
.acard-n.cur { box-shadow: 0 0 0 4rpx var(--brand-soft); border-color: var(--brand-text); }
.acard-foot { text-align: center; font-size: 23rpx; color: var(--ink-2); padding: 8rpx 0 16rpx; }
.btn { background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 28rpx; font-weight: 500; min-height: 44px; line-height: 44px; }

/* #ifdef H5 */
.ex-side { display: none; }

@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .opt:hover, .tbtn:hover, .nbtn:hover, .acard-n:hover, .btn:hover { cursor: pointer; }
  .opt:hover { border-color: var(--brand-text); }
}

@media (min-width: 1024px) {
  .ex-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .ex-main { flex: 1; min-width: 0; }
  .ex-side { display: block; width: 320px; flex: none; position: sticky; top: 24rpx; }
  .side-card { margin-bottom: 0; }
  .side-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
  .side-t { font-size: 30rpx; font-weight: 600; }
  .side-clock { font-size: 28rpx; font-weight: 700; color: #ef4444; font-variant-numeric: tabular-nums; }
  .side-grid { max-height: 46vh; overflow-y: auto; }
  .kbd-note { text-align: center; font-size: 21rpx; color: var(--ink-2); margin-top: 16rpx; }
  .navrow { position: static; padding: 0; background: transparent; border-top: none; margin-bottom: 24rpx; }
  .navrow .acard-btn { display: none; }
  .wrap { padding-bottom: 40rpx; }
}
/* #endif */
</style>
