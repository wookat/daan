<template>
  <view class="wrap">
    <view v-if="loading" class="spin">试卷加载中…</view>

    <template v-if="!loading && items.length">
      <view class="topbar">
        <view class="left-info">
          <text class="pos">{{ idx + 1 }}/{{ items.length }}</text>
          <text class="mod">{{ modName(cur.module) }}</text>
        </view>
        <text class="clock" :class="{ warn: leftSecs <= 300 }">{{ fmtLeft }}</text>
        <view class="top-btns">
          <view class="tbtn" :class="{ on: cur._marked }" @click="toggleMark">{{ cur._marked ? '已标记' : '标记' }}</view>
          <view class="tbtn" @click="cardOpen = true">答题卡</view>
        </view>
      </view>

      <view class="progress"><view class="pfill" :style="{ width: ((idx + 1) / items.length) * 100 + '%' }"></view></view>

      <view class="card qcard" @touchstart="touchStart" @touchend="touchEnd">
        <text class="q">{{ cur.question }}</text>
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
        <view v-if="idx + 1 < items.length" class="nbtn main" @click="next">下一题</view>
        <view v-else class="nbtn main" @click="confirmSubmit">交卷</view>
      </view>
    </template>

    <!-- 答题卡浮层 -->
    <view v-if="cardOpen" class="mask" @click="cardOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">答题卡</text>
          <text class="sheet-x" @click="cardOpen = false">✕</text>
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
      _endAt: 0,
      _tsx: 0,
    };
  },
  computed: {
    cur() { return this.items[this.idx] || {}; },
    answeredCount() { return this.items.filter((q) => q._picked).length; },
    fmtLeft() {
      const s = Math.max(0, this.leftSecs);
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },
  },
  async onLoad(opt) {
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
  onUnload() {
    this.stopClock();
    this.saveProgress();
  },
  onHide() {
    this.saveProgress();
  },
  methods: {
    modName(m) { return MODS[m] || '行测'; },
    async start(opt) {
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
        setTimeout(() => uni.navigateBack(), 1200);
      }
    },
    startClock() {
      this.stopClock();
      this.leftSecs = Math.max(0, Math.round((this._endAt - Date.now()) / 1000));
      this.qsecs = 0;
      this.timer = setInterval(() => {
        this.leftSecs = Math.max(0, Math.round((this._endAt - Date.now()) / 1000));
        this.qsecs++;
        if (this.leftSecs <= 0) {
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
    },
    confirmSubmit() {
      const blank = this.items.length - this.answeredCount;
      uni.showModal({
        title: '确认交卷？',
        content: blank ? '还有 ' + blank + ' 题未作答，交卷后不能再修改' : '已全部作答，交卷查看成绩报告',
        confirmText: '交卷',
        success: (r) => { if (r.confirm) this.submit(); },
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
        this.items.forEach((q, i) => {
          if (q._picked) picks[i + 1] = q._picked;
          if (q._secs) secs[i + 1] = q._secs;
        });
        const d = await request('/api/exam/submit', {
          method: 'POST',
          data: { uid: anonUid(), attempt_id: this.attemptId, picks, secs },
        });
        uni.removeStorageSync(PROG_KEY);
        uni.hideLoading();
        uni.redirectTo({ url: '/pages/exam/report?attempt_id=' + d.attempt_id });
      } catch (e) {
        uni.hideLoading();
        this.submitting = false;
        this.startClock();
        uni.showToast({ title: '交卷失败：' + e.message, icon: 'none' });
      }
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 60rpx 24rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; gap: 12rpx; }
.left-info { display: flex; align-items: baseline; gap: 10rpx; min-width: 0; }
.pos { font-size: 27rpx; font-weight: 700; color: var(--ink); }
.mod { font-size: 21rpx; color: var(--brand, #3b6ff5); background: var(--brand-soft, #edf3fe); border-radius: 8rpx; padding: 2rpx 12rpx; }
.clock { font-size: 30rpx; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.clock.warn { color: #ef4444; }
.top-btns { display: flex; gap: 10rpx; }
.tbtn { min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; font-size: 23rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 0 22rpx; background: var(--card); }
.tbtn.on { color: #d97706; border-color: #f59e0b; background: #fffbeb; font-weight: 600; }
.progress { height: 6rpx; background: #e0e7ff; border-radius: 999rpx; overflow: hidden; margin-bottom: 20rpx; }
.pfill { height: 100%; background: linear-gradient(90deg, #6c9bff, #3b6ff5); border-radius: 999rpx; transition: width 0.3s ease; }
.q { font-size: 30rpx; line-height: 1.7; margin-bottom: 22rpx; white-space: pre-wrap; display: block; }
.qimg { width: 100%; border-radius: 12rpx; margin-bottom: 16rpx; background: #f6f7fb; }
.opt { display: flex; align-items: center; border: 2rpx solid var(--line); border-radius: 20rpx; padding: 22rpx 24rpx; margin-bottom: 20rpx; font-size: 29rpx; line-height: 1.6; min-height: 44px; box-sizing: border-box; }
.opt.sel { border-color: var(--brand, #3b6ff5); background: var(--brand-soft, #edf3fe); }
.okey { flex-shrink: 0; width: 52rpx; height: 52rpx; line-height: 52rpx; text-align: center; border-radius: 50%; background: var(--soft-bg); color: var(--ink-2); font-weight: 600; font-size: 26rpx; margin-right: 20rpx; border: 1rpx solid var(--line); }
.opt.sel .okey { background: var(--brand, #3b6ff5); color: #fff; border-color: var(--brand, #3b6ff5); }
.otext { flex: 1; }
.navrow { display: flex; gap: 16rpx; }
.nbtn { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--brand, #3b6ff5); color: var(--brand, #3b6ff5); border-radius: 999rpx; font-size: 27rpx; font-weight: 500; background: var(--card); }
.nbtn.main { background: var(--brand, #3b6ff5); color: #fff; }
.nbtn.dis { opacity: 0.4; }
.mask { position: fixed; inset: 0; background: rgba(15, 18, 25, 0.45); z-index: 90; display: flex; align-items: flex-end; }
.sheet { width: 100%; background: var(--card); border-radius: 28rpx 28rpx 0 0; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); max-height: 75vh; display: flex; flex-direction: column; box-sizing: border-box; }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.sheet-t { font-size: 30rpx; font-weight: 600; }
.sheet-x { font-size: 30rpx; color: var(--ink-2); padding: 8rpx 16rpx; }
.legend { display: flex; gap: 24rpx; margin-bottom: 16rpx; }
.lg { display: inline-flex; align-items: center; gap: 8rpx; font-size: 22rpx; color: var(--ink-2); }
.dot { width: 20rpx; height: 20rpx; border-radius: 50%; background: var(--soft-bg); border: 2rpx solid var(--line); display: inline-block; }
.dot.done { background: var(--brand, #3b6ff5); border-color: var(--brand, #3b6ff5); }
.dot.mark { background: #fffbeb; border-color: #f59e0b; }
.acard-scroll { max-height: 40vh; }
.acard-grid { display: flex; flex-wrap: wrap; gap: 20rpx; padding: 8rpx 0 20rpx; }
.acard-n { width: 80rpx; height: 80rpx; line-height: 80rpx; text-align: center; border-radius: 50%; background: var(--soft-bg); border: 2rpx solid var(--line); font-size: 27rpx; font-weight: 600; color: var(--ink-2); box-sizing: border-box; }
.acard-n.done { background: var(--brand, #3b6ff5); border-color: var(--brand, #3b6ff5); color: #fff; }
.acard-n.mark { border-color: #f59e0b; }
.acard-n.cur { box-shadow: 0 0 0 4rpx var(--brand-soft, #edf3fe); border-color: var(--brand, #3b6ff5); }
.acard-foot { text-align: center; font-size: 23rpx; color: var(--ink-2); padding: 8rpx 0 16rpx; }
.btn { background: var(--brand, #3b6ff5); color: #fff; border-radius: 999rpx; font-size: 28rpx; font-weight: 500; min-height: 44px; line-height: 44px; }
</style>
