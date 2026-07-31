<template>
  <view class="wrap" :class="{ 'has-banner': picked }">
    <!-- 选模块 -->
    <view v-if="!session" class="card">
      <view class="h">选择模块开始刷题</view>
      <view class="setrow">
        <text class="set-k">选题来源</text>
        <view class="set-chips">
          <text class="set-chip" :class="{ on: !realMode }" @click="setReal(false)">题库模式</text>
          <text class="set-chip" :class="{ on: realMode }" @click="setReal(true)">真题模式</text>
        </view>
      </view>
      <view class="setrow">
        <text class="set-k">每组题量</text>
        <view class="set-chips">
          <text v-for="n in [10, 20, 30, 50]" :key="n" class="set-chip" :class="{ on: groupSize === n }" @click="setGroup(n)">{{ n }}</text>
        </view>
      </view>
      <view v-if="!counts.length" class="spin">题库为空，敬请期待</view>
      <view v-if="weakModule" class="smart" @click="start(weakModule)">
        <view class="smart-l">
          <view class="smart-t"><uni-icons type="flag-filled" size="15" color="#ffffff" /><text class="smart-t-t">智能刷题：攻克薄弱项</text></view>
          <text class="smart-s">你的 {{ modName(weakModule) }} 正确率较低，建议专项练习</text>
        </view>
        <text class="smart-go">去练 ›</text>
      </view>
      <view class="grid">
        <view
          v-for="c in counts"
          :key="c.module"
          class="mcard"
          @click="openModule(c.module)"
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
          <view class="mtop"><uni-icons type="loop" size="16" color="#ffffff" /><text class="mname">混合刷题</text></view>
          <text class="mn">全部模块随机</text>
        </view>
      </view>
    </view>

    <!-- 选二级题型 -->
    <view v-if="subSelect" class="mask" @click="subSelect = null">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">{{ modName(subSelect) }} · 选择题型</text>
          <view class="sheet-x" @click="subSelect = null"><uni-icons type="closeempty" size="20" color="#6b7280" /></view>
        </view>
        <view class="sub-chip all-chip" @click="start(subSelect)">
          <text class="sub-name">全部随机</text>
          <text class="sub-n">{{ (counts.find(c => c.module === subSelect) || {}).n || 0 }} 题</text>
        </view>
        <view
          v-for="s in submodules"
          :key="s.submodule"
          class="sub-chip"
          @click="start(subSelect, s.submodule)"
        >
          <text class="sub-name">{{ s.submodule }}</text>
          <text class="sub-n">{{ s.n }} 题</text>
        </view>
      </view>
    </view>

    <!-- 答题 -->
    <view v-if="session && cur" class="card">
      <view class="rhead">
        <text class="tag" @click="cardOpen = true">{{ modName(cur.module) }}{{ lastSubmodule ? ' · ' + lastSubmodule : '' }} · {{ idx + 1 }}/{{ items.length }} ▾</text>
        <view class="hstats">
          <text class="timer">{{ fmtSecs(qsecs) }}</text>
          <text class="fontbtn" @click="cycleFont">Aa</text>
          <text class="fontbtn" :class="{ beion: beiMode }" @click="toggleBei">背</text>
          <view class="fontbtn iconbtn" @click="toggleSfx"><uni-icons :type="sfxOn ? 'sound-filled' : 'sound'" size="16" :color="sfxOn ? '#4f46e5' : '#8a90a0'" /></view>
          <text class="cnt okc">✓{{ right }}</text>
          <text class="cnt badc">✗{{ wrongCount }}</text>
          <view v-if="streak >= 3" class="cnt fire"><uni-icons type="fire-filled" size="13" color="#f97316" /><text class="fire-n">{{ streak }}</text></view>
          <text class="op" @click="quit">退出</text>
        </view>
      </view>
      <view class="progress"><view class="pfill" :style="{ width: (idx / items.length) * 100 + '%' }" /></view>
      <view v-if="cur.is_real" class="real-tag">真题{{ cur.exam_year ? ' · ' + cur.exam_year : '' }}{{ cur.exam_region ? ' · ' + cur.exam_region : '' }}</view>
      <view class="q" :style="qStyle">{{ cur.question }}</view>
      <view
        v-for="(v, k) in cur.options"
        :key="k"
        class="opt"
        :class="optClass(k)"
        :style="optStyle"
        @click="beiMode ? null : pick(k)"
      >
        <text class="okey">{{ k }}</text>
        <text class="otext">{{ v }}</text>
        <text v-if="(picked || beiMode) && k === cur.answer" class="omark good">✓</text>
        <text v-else-if="picked && k === picked" class="omark badm">✗</text>
      </view>
      <view v-if="picked || beiMode" class="after">
        <view v-if="picked && picked !== cur.answer" class="reasons">
          <text class="rz-t">错因自评：</text>
          <text
            v-for="rz in REASONS"
            :key="rz"
            class="rz"
            :class="{ on: cur._reason === rz }"
            @click="setReason(rz)"
          >{{ rz }}</text>
        </view>
        <view class="exp-sec">
          <view class="exp-row">
            <text class="exp-k">正确答案</text>
            <text class="exp-ans" :class="beiMode || picked === cur.answer ? 'okc2' : 'badc2'">{{ cur.answer }}</text>
          </view>
          <view v-if="cur.hs_explanation" class="exp-row col">
            <text class="exp-k hs">花生十三方法解析</text>
            <view class="exp hsx">{{ cur.hs_explanation }}</view>
            <view class="hs-rate">
              <text v-if="hsRated[cur.id]" class="hs-rate-done">{{ hsRated[cur.id] === 'up' ? '已反馈：有用 👍' : '已反馈：有误 👎' }}</text>
              <template v-else>
                <text class="hs-rate-btn" @click="rateHs(cur, true)">👍 有用</text>
                <text class="hs-rate-btn bad" @click="rateHs(cur, false)">👎 有误</text>
              </template>
            </view>
          </view>
          <view v-if="cur.explanation" class="exp-row col">
            <text class="exp-k">解析</text>
            <view class="exp">{{ cur.explanation }}</view>
          </view>
          <view v-if="cur.question_type" class="exp-row">
            <text class="exp-k">考点</text>
            <text class="exp-v">{{ cur.question_type }}</text>
          </view>
          <view v-if="cur.source" class="exp-row">
            <text class="exp-k">来源</text>
            <text class="exp-v">{{ cur.source }}</text>
          </view>
        </view>
        <view class="deep" @click="deepExplain">用花生十三方法详解这道题 ›</view>
      </view>
    </view>

    <!-- 完成/结算 -->
    <view v-if="session && !cur" class="card done">
      <view v-if="!beiMode" class="ring" :style="ringStyle">
        <view class="ring-in">
          <text class="ring-n">{{ Math.round((right / items.length) * 100) }}%</text>
          <text class="ring-t">正确率</text>
        </view>
      </view>
      <view class="big">{{ beiMode ? '本组背完' : '本组完成' }}</view>
      <view v-if="!beiMode" class="sub">答对 {{ right }}/{{ items.length }} · 最高连对 {{ bestStreak }} 题<template v-if="autoSaved">，错题已自动加入错题本</template></view>
      <view v-else class="sub">已浏览 {{ items.length }} 道题的答案与解析</view>
      <button class="btn" @click="start(lastModule, lastSubmodule)">再来一组</button>
      <button class="btn ghost" style="margin-top: 16rpx" @click="quit">返回选模块</button>
    </view>

    <!-- 答题卡 -->
    <view v-if="cardOpen && session" class="mask" @click="cardOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">答题卡</text>
          <view class="sheet-x" @click="cardOpen = false"><uni-icons type="closeempty" size="20" color="#6b7280" /></view>
        </view>
        <view class="acard-grid">
          <view
            v-for="(q, i) in items"
            :key="i"
            class="acard-n"
            :class="acardClass(q, i)"
            @click="jumpTo(i)"
          >{{ i + 1 }}</view>
        </view>
        <view class="acard-foot">已答 {{ answeredCount }}/{{ items.length }} · 正确 {{ right }}</view>
      </view>
    </view>

    <!-- 判分横幅 -->
    <view v-if="cur && (picked || beiMode)" class="banner" :class="beiMode || picked === cur.answer ? 'bok' : 'bbad'">
      <view class="binfo">
        <text class="btitle">{{ beiMode ? '背题模式 · 答案 ' + cur.answer : picked === cur.answer ? '✓ 回答正确' + (streak >= 3 ? ' · 连对 ' + streak + ' 题！' : '') : '✗ 正确答案 ' + cur.answer }}</text>
        <text v-if="!beiMode && picked !== cur.answer" class="bsub">{{ cur._saved ? '已自动存入错题本' : '' }}</text>
      </view>
      <button class="bnext" :class="beiMode || picked === cur.answer ? 'nok' : 'nbad'" @click="next">
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
      lastSubmodule: null,
      subSelect: null,
      submodules: [],
      streak: 0,
      bestStreak: 0,
      autoSaved: false,
      pstats: { byModule: {}, days: {} },
      autoTimer: null,
      cardOpen: false,
      qsecs: 0,
      qTimer: null,
      fontLv: uni.getStorageSync('fontLv') || 1,
      sfxOn: uni.getStorageSync('sfxOff') ? false : true,
      beiMode: uni.getStorageSync('beiMode') ? true : false,
      realMode: uni.getStorageSync('realMode') ? true : false,
      groupSize: uni.getStorageSync('groupSize') || 10,
      hsRated: {},
      REASONS: ['粗心大意', '概念不清', '方法不会', '纯蒙的'],
    };
  },
  computed: {
    cur() {
      return this.items[this.idx] || null;
    },
    wrongCount() {
      return this.items.filter((q) => q._picked && q._picked !== q.answer).length;
    },
    weakModule() {
      let worst = null;
      let worstAcc = 1;
      for (const [m, s] of Object.entries(this.pstats.byModule)) {
        if (s.done < 5) continue;
        const acc = s.correct / s.done;
        if (acc < 0.8 && acc < worstAcc) {
          worstAcc = acc;
          worst = m;
        }
      }
      return worst;
    },
    answeredCount() {
      return this.items.filter((q) => q._picked).length;
    },
    qStyle() {
      return { fontSize: [26, 30, 34][this.fontLv] + 'rpx' };
    },
    optStyle() {
      return { fontSize: [25, 29, 33][this.fontLv] + 'rpx' };
    },
    ringStyle() {
      const pct = Math.round((this.right / (this.items.length || 1)) * 100);
      return { background: `conic-gradient(#22c55e 0% ${pct}%, var(--brand-soft) ${pct}% 100%)` };
    },
  },
  onShow() {
    this.pstats = loadPStats();
    this.loadCounts();
    const preset = uni.getStorageSync('practicePreset');
    if (preset && preset.module) {
      uni.removeStorageSync('practicePreset');
      this.start(preset.module, preset.submodule || null, preset.count || 10);
      return;
    }
    const pm = uni.getStorageSync('practiceModule');
    if (pm) {
      uni.removeStorageSync('practiceModule');
      this.start(pm);
    }
  },
  onHide() {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.stopQTimer();
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
    async openModule(module) {
      try {
        const d = await request('/api/submodules?module=' + module);
        const items = (d.items || []).filter((s) => s.submodule);
        if (items.length < 2) {
          this.start(module);
          return;
        }
        this.submodules = items;
        this.subSelect = module;
      } catch (e) {
        this.start(module);
      }
    },
    setReal(v) {
      this.realMode = v;
      uni.setStorageSync('realMode', v ? '1' : '');
    },
    setGroup(n) {
      this.groupSize = n;
      uni.setStorageSync('groupSize', n);
    },
    async start(module, submodule, count) {
      this.lastModule = module;
      this.lastSubmodule = submodule || null;
      this.subSelect = null;
      const limit = count || this.groupSize || 10;
      const realQ = this.realMode ? '&real=1' : '';
      try {
        let d = await request(
          '/api/questions?limit=' + limit + realQ +
            (module ? '&module=' + module : '') +
            (submodule ? '&submodule=' + encodeURIComponent(submodule) : '')
        );
        if (!d.items.length && submodule) {
          this.lastSubmodule = null;
          d = await request('/api/questions?limit=' + limit + realQ + (module ? '&module=' + module : ''));
        }
        if (!d.items.length && this.realMode) {
          uni.showToast({ title: '真题还在搜集中，已切回题库模式', icon: 'none' });
          d = await request('/api/questions?limit=' + limit + (module ? '&module=' + module : ''));
        }
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
        this.startQTimer();
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
      if (!s.daysCorrect) s.daysCorrect = {};
      if (correct) s.daysCorrect[day] = (s.daysCorrect[day] || 0) + 1;
      savePStats(s);
    },
    fmtSecs(s) {
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },
    startQTimer() {
      this.stopQTimer();
      this.qsecs = 0;
      this.qTimer = setInterval(() => { this.qsecs++; }, 1000);
    },
    stopQTimer() {
      if (this.qTimer) {
        clearInterval(this.qTimer);
        this.qTimer = null;
      }
    },
    toggleSfx() {
      this.sfxOn = !this.sfxOn;
      uni.setStorageSync('sfxOff', this.sfxOn ? '' : '1');
      uni.showToast({ title: this.sfxOn ? '音效已开启' : '音效已关闭', icon: 'none', duration: 800 });
    },
    playSfx(correct) {
      if (!this.sfxOn) return;
      // #ifdef H5
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!this._actx) this._actx = new Ctx();
        const ctx = this._actx;
        const t = ctx.currentTime;
        const mk = (freq, start, dur) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.12, t + start);
          g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
          o.connect(g).connect(ctx.destination);
          o.start(t + start);
          o.stop(t + start + dur);
        };
        if (correct) {
          mk(660, 0, 0.12);
          mk(880, 0.1, 0.18);
        } else {
          mk(220, 0, 0.25);
        }
      } catch (e) { /* 音效失败不影响刷题 */ }
      // #endif
    },
    cycleFont() {
      this.fontLv = (this.fontLv + 1) % 3;
      uni.setStorageSync('fontLv', this.fontLv);
      uni.showToast({ title: '字号：' + ['小', '标准', '大'][this.fontLv], icon: 'none', duration: 800 });
    },
    acardClass(q, i) {
      if (i === this.idx) return 'cur';
      if (!q._picked) return '';
      return q._picked === q.answer ? 'ok' : 'bad';
    },
    jumpTo(i) {
      this.cardOpen = false;
      if (i === this.idx) return;
      if (this.autoTimer) {
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
      }
      this.idx = i;
      this.picked = this.items[i]._picked || '';
      if (!this.picked) this.startQTimer();
    },
    async setReason(rz) {
      const q = this.cur;
      q._reason = rz;
      this.$forceUpdate();
      if (q._mid) {
        try {
          await request('/api/mistakes/' + q._mid, { method: 'PATCH', data: { error_reason: rz } });
        } catch (e) { /* 非关键路径 */ }
      }
    },
    pick(k) {
      if (this.picked) return;
      this.picked = k;
      this.cur._picked = k;
      this.stopQTimer();
      const correct = k === this.cur.answer;
      this.recordStat(this.cur.module, correct);
      this.playSfx(correct);
      try { uni.vibrateShort({ type: correct ? 'light' : 'medium' }); } catch (e) { /* 不支持则忽略 */ }
      if (correct) {
        this.right++;
        this.streak++;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        const s = this.pstats;
        if (this.streak > (s.bestStreak || 0)) {
          s.bestStreak = this.streak;
          savePStats(s);
        }
        if (this.streak === 3 || this.streak === 5 || this.streak === 10) {
          uni.showToast({ title: '连对 ' + this.streak + ' 题！', icon: 'none' });
        }
        this.autoTimer = setTimeout(() => {
          if (this.picked === k) this.next();
        }, 1200);
      } else {
        this.streak = 0;
        this.saveWrong();
      }
    },
    async rateHs(q, up) {
      this.hsRated[q.id] = up ? 'up' : 'down';
      try {
        await request('/api/rate', { method: 'POST', data: { question_id: q.id, up } });
      } catch (e) { /* 静默失败 */ }
      uni.showToast({ title: up ? '感谢反馈' : '已记录，我们会核查这条解析', icon: 'none' });
    },
    toggleBei() {
      this.beiMode = !this.beiMode;
      uni.setStorageSync('beiMode', this.beiMode ? '1' : '');
      uni.showToast({ title: this.beiMode ? '背题模式：直接看答案解析，不计入正确率' : '已切回做题模式', icon: 'none', duration: 1500 });
    },
    optClass(k) {
      if (this.beiMode) return k === this.cur.answer ? 'right' : '';
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
        const res = await request('/api/mistakes', {
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
        q._mid = res.id;
        if (q._reason) {
          request('/api/mistakes/' + q._mid, { method: 'PATCH', data: { error_reason: q._reason } });
        }
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
      this.picked = (this.items[this.idx] && this.items[this.idx]._picked) || '';
      if (this.cur && !this.picked) this.startQTimer();
      else this.stopQTimer();
    },
    quit() {
      this.session = false;
      this.items = [];
      this.idx = 0;
      this.picked = '';
      this.cardOpen = false;
      this.stopQTimer();
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
.setrow { display: flex; align-items: center; gap: 18rpx; margin-bottom: 16rpx; flex-wrap: wrap; }
.set-k { font-size: 24rpx; color: var(--ink-2); }
.set-chips { display: flex; gap: 12rpx; flex-wrap: wrap; }
.set-chip { font-size: 23rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 6rpx 22rpx; }
.set-chip.on { color: #fff; background: var(--brand); border-color: var(--brand); }
.real-tag { display: inline-block; font-size: 21rpx; color: #b45309; background: #fef3c7; border-radius: 8rpx; padding: 4rpx 14rpx; margin-bottom: 10rpx; }
.smart { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #f97316, #f43f5e); border-radius: 20rpx; padding: 24rpx 28rpx; margin-bottom: 20rpx; }
.smart-t { display: flex; align-items: center; gap: 8rpx; font-size: 27rpx; font-weight: 700; color: #fff; }
.smart-t-t { font-size: 27rpx; font-weight: 700; color: #fff; }
.smart-s { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.8); margin-top: 4rpx; }
.smart-go { background: #fff; color: #f43f5e; font-size: 24rpx; font-weight: 600; border-radius: 999rpx; padding: 10rpx 26rpx; flex-shrink: 0; }
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
.fire { background: #fff7ed; color: #ea580c; display: inline-flex; align-items: center; gap: 2rpx; }
.fire-n { font-size: 22rpx; color: #ea580c; font-weight: 700; }
.iconbtn { display: inline-flex; align-items: center; }
.timer { font-size: 22rpx; color: var(--ink-2); }
.fontbtn { font-size: 24rpx; font-weight: 700; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 10rpx; padding: 2rpx 12rpx; }
.fontbtn.beion { background: var(--brand); border-color: var(--brand); color: #fff; }
.reasons { display: flex; flex-wrap: wrap; align-items: center; gap: 12rpx; margin-bottom: 16rpx; }
.rz-t { font-size: 23rpx; color: var(--ink-2); }
.rz { font-size: 23rpx; color: var(--ink-2); border: 1rpx solid var(--line); background: var(--soft-bg); border-radius: 999rpx; padding: 8rpx 22rpx; }
.rz.on { background: var(--brand); border-color: var(--brand); color: #fff; font-weight: 600; }
.acard-grid { display: flex; flex-wrap: wrap; gap: 20rpx; padding: 8rpx 0 20rpx; }
.acard-n { width: 80rpx; height: 80rpx; line-height: 80rpx; text-align: center; border-radius: 50%; background: var(--soft-bg); border: 2rpx solid var(--line); font-size: 27rpx; font-weight: 600; color: var(--ink-2); box-sizing: border-box; }
.acard-n.ok { background: var(--ok); border-color: var(--ok); color: #fff; }
.acard-n.bad { background: var(--bad); border-color: var(--bad); color: #fff; }
.acard-n.cur { border-color: var(--brand); color: var(--brand); background: var(--brand-soft); }
.acard-foot { text-align: center; font-size: 23rpx; color: var(--ink-2); padding-bottom: 8rpx; }
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
.opt.right { background: var(--ok-soft); border-color: var(--ok); animation: pop 0.35s cubic-bezier(0.2, 0.8, 0.2, 1.4); }
@keyframes pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.03); }
  100% { transform: scale(1); }
}
.opt.right .okey { background: var(--ok); color: #fff; border-color: var(--ok); }
.opt.wrong { background: var(--bad-soft); border-color: var(--bad); animation: shake 0.3s; }
.opt.wrong .okey { background: var(--bad); color: #fff; border-color: var(--bad); }
.opt.dim { opacity: 0.5; }
@keyframes shake {
  25% { transform: translateX(-8rpx); }
  75% { transform: translateX(8rpx); }
}
.after { margin-top: 8rpx; }
.exp-k.hs { color: var(--brand); }
.exp.hsx { border-left: 5rpx solid var(--brand); background: var(--brand-soft); }
.hs-rate { display: flex; gap: 14rpx; margin-top: 10rpx; align-items: center; }
.hs-rate-btn { font-size: 23rpx; color: var(--brand); border: 1rpx solid var(--brand); border-radius: 999rpx; padding: 6rpx 22rpx; }
.hs-rate-btn.bad { color: var(--bad); border-color: var(--bad); }
.hs-rate-done { font-size: 23rpx; color: var(--ink-2); }
.exp { background: var(--soft-bg); border-radius: 14rpx; padding: 20rpx; font-size: 25rpx; line-height: 1.7; color: var(--ink); white-space: pre-wrap; margin-top: 8rpx; }
.exp-sec { background: var(--card); border: 1rpx solid var(--line); border-radius: 16rpx; padding: 20rpx; margin-bottom: 16rpx; }
.exp-row { display: flex; align-items: baseline; gap: 16rpx; margin-bottom: 12rpx; }
.exp-row:last-child { margin-bottom: 0; }
.exp-row.col { display: block; }
.exp-k { flex-shrink: 0; font-size: 22rpx; color: var(--ink-2); font-weight: 600; }
.exp-v { font-size: 24rpx; color: var(--ink); }
.exp-ans { font-size: 32rpx; font-weight: 800; }
.exp-ans.okc2 { color: var(--ok); }
.exp-ans.badc2 { color: var(--bad); }
.deep { margin-top: 6rpx; text-align: center; font-size: 25rpx; color: var(--brand); border: 1rpx solid var(--brand); border-radius: 999rpx; padding: 14rpx 0; }
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
.mask { position: fixed; inset: 0; background: rgba(15, 18, 30, 0.5); z-index: 90; display: flex; align-items: flex-end; }
.sheet { width: 100%; box-sizing: border-box; background: var(--card); border-radius: 32rpx 32rpx 0 0; padding: 32rpx 28rpx calc(32rpx + env(safe-area-inset-bottom)); max-height: 70vh; overflow-y: auto; animation: slideup 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.sheet-t { font-size: 30rpx; font-weight: 700; }
.sheet-x { font-size: 28rpx; color: var(--ink-2); padding: 8rpx 16rpx; }
.sub-chip { display: flex; justify-content: space-between; align-items: center; border: 1rpx solid var(--line); background: var(--soft-bg); border-radius: 18rpx; padding: 24rpx 28rpx; margin-bottom: 16rpx; }
.sub-chip.all-chip { background: linear-gradient(135deg, #6366f1, #4f46e5); border: none; }
.sub-chip.all-chip .sub-name, .sub-chip.all-chip .sub-n { color: #fff; }
.sub-name { font-size: 28rpx; font-weight: 600; color: var(--ink); }
.sub-n { font-size: 22rpx; color: var(--ink-2); }
</style>
