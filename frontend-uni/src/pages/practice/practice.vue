<template>
  <view class="wrap" :class="{ 'has-banner': picked }">
    <!-- 选模块 -->
    <view v-if="!session" class="card">
      <view class="h">选择模块开始刷题</view>
      <view v-if="!counts.length" class="spin">题库为空，敬请期待</view>
      <view class="grid">
        <view
          v-for="c in counts"
          :key="c.module"
          class="mcard"
          @click="start(c.module)"
        >
          <view class="mtop">
            <text class="mico" :style="{ background: modColor(c.module).bg, color: modColor(c.module).fg }">{{ modName(c.module).slice(0, 1) }}</text>
            <text class="mname">{{ modName(c.module) }}</text>
          </view>
          <text class="mn">{{ progText(c) }}</text>
          <view class="mbar">
            <view class="mfill" :style="{ width: progPct(c) + '%' }" />
          </view>
        </view>
        <view v-if="counts.length" class="mcard all" @click="start(null)">
          <view class="mtop"><text class="mname">🎯 混合刷题</text></view>
          <text class="mn">全部模块随机</text>
        </view>
      </view>
    </view>

    <!-- 答题 -->
    <view v-if="session && cur" class="card">
      <view class="rhead">
        <text class="tag">{{ modName(cur.module) }} · {{ idx + 1 }}/{{ items.length }}</text>
        <view class="hstats">
          <text class="cnt okc">✓{{ right }}</text>
          <text class="cnt badc">✗{{ wrongCount }}</text>
          <text v-if="streak >= 3" class="cnt fire">🔥{{ streak }}</text>
          <text class="op" @click="quit">退出</text>
        </view>
      </view>
      <view class="progress"><view class="pfill" :style="{ width: (idx / items.length) * 100 + '%' }" /></view>
      <view class="q">{{ cur.question }}</view>
      <view
        v-for="(v, k) in cur.options"
        :key="k"
        class="opt"
        :class="optClass(k)"
        @click="pick(k)"
      >
        <text class="okey">{{ k }}</text>
        <text class="otext">{{ v }}</text>
        <text v-if="picked && k === cur.answer" class="omark good">✓</text>
        <text v-else-if="picked && k === picked" class="omark badm">✗</text>
      </view>
      <view v-if="picked" class="after">
        <view v-if="cur.explanation" class="exp">{{ cur.explanation }}</view>
        <view class="deep" @click="deepExplain">🔍 用花生十三方法详解这道题 ›</view>
      </view>
    </view>

    <!-- 完成/结算 -->
    <view v-if="session && !cur" class="card done">
      <view class="ring" :style="ringStyle">
        <view class="ring-in">
          <text class="ring-n">{{ Math.round((right / items.length) * 100) }}%</text>
          <text class="ring-t">正确率</text>
        </view>
      </view>
      <view class="big">🎉 本组完成</view>
      <view class="sub">答对 {{ right }}/{{ items.length }} · 最高连对 {{ bestStreak }} 题<template v-if="autoSaved">，错题已自动加入错题本</template></view>
      <button class="btn" @click="start(lastModule)">再来一组</button>
      <button class="btn ghost" style="margin-top: 16rpx" @click="quit">返回选模块</button>
    </view>

    <!-- 判分横幅 -->
    <view v-if="picked && cur" class="banner" :class="picked === cur.answer ? 'bok' : 'bbad'">
      <view class="binfo">
        <text class="btitle">{{ picked === cur.answer ? '✓ 回答正确' + (streak >= 3 ? ' · 连对 ' + streak + ' 题！' : '') : '✗ 正确答案 ' + cur.answer }}</text>
        <text v-if="picked !== cur.answer" class="bsub">{{ cur._saved ? '已自动存入错题本' : '' }}</text>
      </view>
      <button class="bnext" :class="picked === cur.answer ? 'nok' : 'nbad'" @click="next">
        {{ idx + 1 < items.length ? '下一题' : '完成' }}
      </button>
    </view>
  </view>
</template>

<script>
import { request } from '../../api.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };
const COLORS = {
  changshi: { bg: '#FEF3C7', fg: '#B45309' },
  shuliang: { bg: '#DBEAFE', fg: '#1D4ED8' },
  panduan: { bg: '#EDE9FE', fg: '#6D28D9' },
  ziliao: { bg: '#D1FAE5', fg: '#047857' },
  yanyu: { bg: '#FEE2E2', fg: '#B91C1C' },
};

function loadPStats() {
  return uni.getStorageSync('pstats') || { byModule: {}, days: {} };
}
function savePStats(s) {
  uni.setStorageSync('pstats', s);
}

export default {
  data() {
    return {
      counts: [],
      session: false,
      items: [],
      idx: 0,
      picked: '',
      right: 0,
      lastModule: null,
      streak: 0,
      bestStreak: 0,
      autoSaved: false,
      pstats: { byModule: {}, days: {} },
      autoTimer: null,
    };
  },
  computed: {
    cur() {
      return this.items[this.idx] || null;
    },
    wrongCount() {
      return (this.picked ? this.idx + 1 : this.idx) - this.right;
    },
    ringStyle() {
      const pct = Math.round((this.right / (this.items.length || 1)) * 100);
      return { background: `conic-gradient(#22c55e 0% ${pct}%, var(--brand-soft) ${pct}% 100%)` };
    },
  },
  onShow() {
    this.pstats = loadPStats();
    this.loadCounts();
  },
  onHide() {
    if (this.autoTimer) clearTimeout(this.autoTimer);
  },
  methods: {
    modName(m) {
      return NAMES[m] || m || '未知';
    },
    modColor(m) {
      return COLORS[m] || { bg: 'var(--brand-soft)', fg: 'var(--brand)' };
    },
    modStat(m) {
      return this.pstats.byModule[m] || { done: 0, correct: 0 };
    },
    progText(c) {
      const s = this.modStat(c.module);
      if (!s.done) return c.n + ' 题';
      return `已刷 ${s.done}/${c.n} · 正确率 ${Math.round((s.correct / s.done) * 100)}%`;
    },
    progPct(c) {
      const s = this.modStat(c.module);
      return Math.min(100, (s.done / (c.n || 1)) * 100);
    },
    async loadCounts() {
      try {
        const d = await request('/api/questions?limit=1');
        this.counts = d.counts || [];
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
    async start(module) {
      this.lastModule = module;
      try {
        const d = await request('/api/questions?limit=10' + (module ? '&module=' + module : ''));
        if (!d.items.length) {
          uni.showToast({ title: '该模块暂无题目', icon: 'none' });
          return;
        }
        this.items = d.items.map((q) => ({ ...q, _saved: false }));
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.session = true;
        uni.setStorageSync('lastModule', module || '');
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
    recordStat(module, correct) {
      const s = this.pstats;
      if (!s.byModule[module]) s.byModule[module] = { done: 0, correct: 0 };
      s.byModule[module].done++;
      if (correct) s.byModule[module].correct++;
      const day = new Date().toISOString().slice(0, 10);
      s.days[day] = (s.days[day] || 0) + 1;
      savePStats(s);
    },
    pick(k) {
      if (this.picked) return;
      this.picked = k;
      const correct = k === this.cur.answer;
      this.recordStat(this.cur.module, correct);
      if (correct) {
        this.right++;
        this.streak++;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        if (this.streak === 3 || this.streak === 5 || this.streak === 10) {
          uni.showToast({ title: '🔥 连对 ' + this.streak + ' 题！', icon: 'none' });
        }
        this.autoTimer = setTimeout(() => {
          if (this.picked === k) this.next();
        }, 1200);
      } else {
        this.streak = 0;
        this.saveWrong();
      }
    },
    optClass(k) {
      if (!this.picked) return '';
      if (k === this.cur.answer) return 'right';
      if (k === this.picked) return 'wrong';
      return 'dim';
    },
    async saveWrong() {
      const q = this.cur;
      if (q._saved) return;
      const optText = Object.entries(q.options).map(([k, v]) => `${k}.${v}`).join(' ');
      try {
        await request('/api/mistakes', {
          method: 'POST',
          data: {
            module: q.module,
            question_type: q.question_type,
            question_text: q.question + '\n' + optText,
            user_answer: this.picked,
            correct_answer: q.answer,
            explanation: q.explanation || '',
          },
        });
        q._saved = true;
        this.autoSaved = true;
      } catch (e) {
        /* 保存失败不阻塞刷题 */
      }
    },
    deepExplain() {
      const q = this.cur;
      const optText = Object.entries(q.options).map(([k, v]) => `${k}.${v}`).join(' ');
      uni.setStorageSync('redoQuestion', q.question + '\n' + optText);
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    next() {
      if (this.autoTimer) {
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
      }
      this.idx++;
      this.picked = '';
    },
    quit() {
      this.session = false;
      this.items = [];
      this.idx = 0;
      this.picked = '';
      this.pstats = loadPStats();
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.wrap.has-banner { padding-bottom: 200rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 600; margin-bottom: 20rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 24rpx; }
.grid { display: flex; flex-wrap: wrap; gap: 20rpx; }
.mcard { width: calc(50% - 10rpx); box-sizing: border-box; background: var(--soft-bg); border: 1rpx solid var(--line); border-radius: 20rpx; padding: 24rpx; }
.mcard.all { background: linear-gradient(135deg, #6366f1, #4f46e5); border: none; }
.mcard.all .mname, .mcard.all .mn { color: #fff; }
.mtop { display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.mico { width: 48rpx; height: 48rpx; line-height: 48rpx; text-align: center; border-radius: 12rpx; font-size: 24rpx; font-weight: 600; }
.mname { font-size: 29rpx; font-weight: 600; color: var(--ink); }
.mn { display: block; font-size: 21rpx; color: var(--ink-2); margin: 4rpx 0 10rpx; }
.mbar { height: 8rpx; background: var(--line); border-radius: 999rpx; overflow: hidden; }
.mfill { height: 100%; background: var(--brand); border-radius: 999rpx; transition: width 0.4s ease; }
.rhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14rpx; }
.tag { display: inline-block; background: var(--brand-soft); color: var(--brand); border-radius: 999rpx; padding: 6rpx 20rpx; font-size: 22rpx; }
.hstats { display: flex; align-items: center; gap: 12rpx; }
.cnt { font-size: 22rpx; border-radius: 999rpx; padding: 2rpx 14rpx; font-weight: 600; }
.okc { background: var(--ok-soft); color: var(--ok); }
.badc { background: var(--bad-soft); color: var(--bad); }
.fire { background: #fff7ed; color: #ea580c; }
.op { font-size: 24rpx; color: var(--ink-2); margin-left: 6rpx; }
.progress { height: 14rpx; background: var(--line); border-radius: 999rpx; overflow: hidden; margin-bottom: 22rpx; }
.pfill { height: 100%; background: linear-gradient(90deg, #6366f1, #4f46e5); border-radius: 999rpx; transition: width 0.3s ease; }
.q { font-size: 30rpx; line-height: 1.7; margin-bottom: 22rpx; white-space: pre-wrap; }
.opt { display: flex; align-items: center; border: 2rpx solid var(--line); border-radius: 20rpx; padding: 22rpx 24rpx; margin-bottom: 20rpx; font-size: 29rpx; line-height: 1.6; transition: border-color 0.15s, background 0.15s; }
.okey { flex-shrink: 0; width: 52rpx; height: 52rpx; line-height: 52rpx; text-align: center; border-radius: 50%; background: var(--soft-bg); color: var(--ink-2); font-weight: 600; font-size: 26rpx; margin-right: 20rpx; border: 1rpx solid var(--line); }
.otext { flex: 1; }
.omark { flex-shrink: 0; font-size: 30rpx; font-weight: 700; margin-left: 12rpx; }
.omark.good { color: var(--ok); }
.omark.badm { color: var(--bad); }
.opt.right { background: var(--ok-soft); border-color: var(--ok); }
.opt.right .okey { background: var(--ok); color: #fff; border-color: var(--ok); }
.opt.wrong { background: var(--bad-soft); border-color: var(--bad); animation: shake 0.3s; }
.opt.wrong .okey { background: var(--bad); color: #fff; border-color: var(--bad); }
.opt.dim { opacity: 0.5; }
@keyframes shake {
  25% { transform: translateX(-8rpx); }
  75% { transform: translateX(8rpx); }
}
.after { margin-top: 8rpx; }
.exp { background: var(--soft-bg); border-radius: 14rpx; padding: 20rpx; font-size: 25rpx; line-height: 1.7; color: var(--ink); white-space: pre-wrap; margin-bottom: 16rpx; }
.deep { margin-top: 6rpx; text-align: center; font-size: 25rpx; color: var(--brand); padding: 10rpx 0; }
.banner { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 28rpx 32rpx calc(28rpx + env(safe-area-inset-bottom)); animation: slideup 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes slideup {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.banner.bok { background: var(--ok-soft); }
.banner.bbad { background: var(--bad-soft); }
.binfo { flex: 1; min-width: 0; }
.btitle { display: block; font-size: 30rpx; font-weight: 700; }
.bok .btitle { color: var(--ok); }
.bbad .btitle { color: var(--bad); }
.bsub { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.bnext { flex-shrink: 0; border-radius: 999rpx; font-size: 28rpx; font-weight: 600; color: #fff; padding: 0 44rpx; line-height: 2.6; margin: 0; }
.bnext.nok { background: #22c55e; }
.bnext.nbad { background: #ef4444; }
.btn { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border-radius: 18rpx; font-size: 30rpx; font-weight: 600; box-shadow: 0 6rpx 16rpx rgba(79, 70, 229, 0.25); }
.btn.ghost { background: var(--brand-soft); color: var(--brand); box-shadow: none; }
.done { text-align: center; padding: 48rpx 28rpx; }
.ring { width: 200rpx; height: 200rpx; border-radius: 50%; margin: 0 auto 24rpx; display: flex; align-items: center; justify-content: center; }
.ring-in { width: 156rpx; height: 156rpx; border-radius: 50%; background: var(--card); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-n { font-size: 40rpx; font-weight: 700; color: var(--ink); }
.ring-t { font-size: 20rpx; color: var(--ink-2); }
.big { font-size: 40rpx; font-weight: 700; margin-bottom: 12rpx; }
.sub { font-size: 26rpx; color: var(--ink-2); margin-bottom: 28rpx; }
</style>
