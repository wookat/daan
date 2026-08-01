<template>
  <view class="wrap">
    <view class="card ov">
      <view class="ovi">
        <text class="ovn">{{ totalDone }}</text>
        <text class="ovt">累计刷题</text>
      </view>
      <view class="ovi">
        <text class="ovn">{{ accPct }}%</text>
        <text class="ovt">总正确率</text>
      </view>
      <view class="ovi">
        <text class="ovn">{{ streakDays }}</text>
        <text class="ovt">连续打卡(天)</text>
      </view>
    </view>

    <view class="card">
      <view class="cal-head">
        <view class="h" style="margin-bottom: 0">学习日历</view>
        <text class="cal-sub">本月打卡 {{ monthDays }} 天</text>
      </view>
      <view class="cal-week">
        <text v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="cal-w">{{ w }}</text>
      </view>
      <view class="cal-grid">
        <view v-for="(c, i) in calCells" :key="i" class="cal-c" :class="c.cls">{{ c.d || '' }}</view>
      </view>
    </view>

    <view class="card">
      <view class="h">五模块能力雷达</view>
      <view v-if="!hasRadar" class="radar-empty">
        <view class="re-t">还没有能力数据</view>
        <view class="re-s">刷几题就能生成你的五模块能力画像</view>
        <button class="re-btn" @click="goPractice('')">去刷题</button>
      </view>
      <view v-else class="radar-box">
        <view class="radar">
          <view v-for="i in 4" :key="'g' + i" class="ring" :style="ringStyle(i)" />
          <view class="poly" :style="polyStyle" />
          <view v-for="(a, i) in axes" :key="a.key" class="axis-label" :style="labelStyle(i)">
            <text class="al-name">{{ a.name }}</text>
            <text class="al-val">{{ a.pct }}%</text>
          </view>
        </view>
      </view>
    </view>

    <view class="card coach">
      <view class="cal-head">
        <view class="h" style="margin-bottom: 0">AI 学习教练</view>
        <text v-if="!coachLoading" class="coach-btn" @click="getCoach">{{ coachHtml ? '重新诊断' : '生成建议' }}</text>
      </view>
      <view v-if="coachLoading" class="coach-tip">教练正在分析你的学习数据…</view>
      <rich-text v-else-if="coachHtml" class="coach-body" :nodes="coachHtml" />
      <view v-else class="coach-tip">基于你的正确率、错因分布和打卡情况，生成个性化备考建议</view>
    </view>

    <view v-if="trendHas" class="card">
      <view class="h">近 7 日正确率</view>
      <view class="trend">
        <view v-for="t in trend" :key="t.key" class="tcol">
          <text class="tpct">{{ t.done ? t.pct + '%' : '' }}</text>
          <view class="tbar">
            <view class="tfill" :class="{ lo: t.done && t.pct < 60 }" :style="{ height: (t.done ? Math.max(t.pct, 6) : 0) + '%' }" />
          </view>
          <text class="tday">{{ t.label }}</text>
        </view>
      </view>
    </view>

    <view v-if="growth && growth.weeks.length >= 2" class="card">
      <view class="h">成长轨迹（周正确率）</view>
      <view class="gw-tabs">
        <text class="gw-tab" :class="{ on: gwMod === '' }" @click="gwMod = ''">整体</text>
        <text v-for="m in gwMods" :key="m.key" class="gw-tab" :class="{ on: gwMod === m.key }" @click="gwMod = m.key">{{ m.name }}</text>
      </view>
      <view class="gw-row" v-for="w in growthRows" :key="w.week">
        <text class="gw-wk">{{ w.label }}</text>
        <view class="gw-bar">
          <view class="gw-fill" :class="{ lo: w.pct < 60, mid: w.pct >= 60 && w.pct < 80 }" :style="{ width: w.pct + '%' }" />
        </view>
        <text class="gw-pct">{{ w.pct }}%<text class="gw-n">（{{ w.n }}题）</text></text>
      </view>
      <view v-if="growthDelta !== null" class="gw-delta" :class="{ up: growthDelta >= 0 }">
        本周比上周{{ growthDelta >= 0 ? '提升' : '下降' }} {{ Math.abs(growthDelta) }} 个百分点
      </view>
    </view>

    <view v-if="(reco && reco.items.length) || dueN" class="card">
      <view class="h">个性化推荐 · 查漏补缺</view>
      <view v-if="dueN" class="rc-row" @click="goBook">
        <view class="rc-main">
          <text class="rc-name">错题到期复习</text>
          <text class="rc-tag warn">今日到期</text>
        </view>
        <text class="rc-meta">{{ dueN }} 题待复习</text>
        <text class="rc-go">去复习 ›</text>
      </view>
      <view v-for="(r, i) in (reco ? reco.items : [])" :key="i" class="rc-row" @click="goSub(r.module, r.submodule)">
        <view class="rc-main">
          <text class="rc-name">{{ r.submodule }}</text>
          <text class="rc-tag" :class="{ warn: r.reason === '近期退步' || r.reason === '正确率偏低' }">{{ r.reason }}</text>
        </view>
        <text class="rc-meta">正确率 {{ Math.round(r.acc * 100) }}%（{{ r.n }}题）</text>
        <text class="rc-go">练10题 ›</text>
      </view>
      <view class="rc-note">基于你的做题历史（正确率/近期趋势/遗忘曲线/考频）自动推荐</view>
    </view>

    <view v-if="history.length >= 3" class="card">
      <view class="h">正确率趋势（近 {{ trendData.length }} 次）</view>
      <view class="trend">
        <view v-for="(p, i) in trendData" :key="i" class="trend-col">
          <view class="trend-bar" :class="{ lo: p < 60, mid: p >= 60 && p < 80 }" :style="{ height: Math.max(p, 4) + '%' }" />
        </view>
      </view>
      <view class="trend-x">
        <text>旧</text>
        <text>近 {{ trendData.length }} 次平均 {{ trendAvg }}%</text>
        <text>新</text>
      </view>
    </view>

    <view v-if="speedData.length >= 3" class="card">
      <view class="h">做题速度趋势（平均每题用时）</view>
      <view class="trend">
        <view v-for="(s, i) in speedData" :key="i" class="trend-col">
          <view class="trend-bar" :class="{ lo: s > 90, mid: s > 60 && s <= 90 }" :style="{ height: Math.min(Math.max((s / 120) * 100, 6), 100) + '%' }" />
        </view>
      </view>
      <view class="trend-x">
        <text>旧</text>
        <text>近 {{ speedData.length }} 次平均 {{ speedAvg }}s/题（越短越好）</text>
        <text>新</text>
      </view>
    </view>

    <view v-if="history.length" class="card">
      <view class="h">练习记录</view>
      <view v-for="(h, i) in history.slice(0, showAllHist ? 30 : 6)" :key="i" class="hist-row">
        <text class="hist-time">{{ fmtHist(h.t) }}</text>
        <text class="hist-mod" :class="{ exam: h.exam }">{{ h.exam ? (h.exam === 'full' ? '全真模考' : '迷你模考') : h.module ? modName(h.module) : h.n >= 100 ? '全真模考' : '混合' }}</text>
        <text class="hist-n">{{ h.correct }}/{{ h.n }}</text>
        <text class="hist-pct" :class="{ lo: h.n && Math.round((h.correct / h.n) * 100) < 60 }">{{ h.n ? Math.round((h.correct / h.n) * 100) : 0 }}%</text>
      </view>
      <view v-if="history.length > 6" class="hist-more" @click="showAllHist = !showAllHist">{{ showAllHist ? '收起' : '展开全部 ' + Math.min(history.length, 30) + ' 条' }}</view>
    </view>

    <view v-if="subMap.length" class="card">
      <view class="h">考点地图</view>
      <view v-for="g in subMap" :key="g.module" class="km-group">
        <view class="km-mod">{{ g.name }}</view>
        <view class="km-items">
          <view v-for="s in g.subs" :key="s.sub" class="km-chip" :class="s.lv" @click="goSub(g.module, s.sub)">
            <text class="km-name">{{ s.sub }}</text>
            <text class="km-pct">{{ s.pct }}% · {{ s.done }}题</text>
          </view>
        </view>
      </view>
      <view class="km-legend"><text class="km-lg r">● &lt;60% 薄弱</text><text class="km-lg y">● 60–80%</text><text class="km-lg g">● &gt;80% 掌握</text><text class="km-lg">点考点直达专项练习</text></view>
    </view>

    <view class="card">
      <view class="h">错题模块分布</view>
      <view v-if="!byModule.length" class="spin">暂无数据</view>
      <view v-for="m in byModule" :key="m.module" class="brow" @click="goPractice(m.module)">
        <view class="blabel">
          <text>{{ modName(m.module) }}</text>
          <text class="n">×{{ m.n }} 去练 ›</text>
        </view>
        <view class="bar">
          <view class="fill" :class="sevClass(m.n)" :style="{ width: (m.n / total) * 100 + '%' }" />
        </view>
      </view>
    </view>
    <view v-if="byReason.length" class="card">
      <view class="h">错因分布</view>
      <view v-for="r in byReason" :key="r.error_reason" class="brow">
        <view class="blabel">
          <text>{{ r.error_reason }}</text>
          <text class="n">×{{ r.n }}</text>
        </view>
        <view class="bar">
          <view class="fill rz" :style="{ width: (r.n / reasonTotal) * 100 + '%' }" />
        </view>
      </view>
    </view>

    <view class="card">
      <view class="h">成就勋章</view>
      <view class="medals">
        <view v-for="md in medals" :key="md.name" class="medal" :class="{ got: md.got }">
          <text class="m-ico">{{ md.icon }}</text>
          <text class="m-name">{{ md.name }}</text>
          <text class="m-sub">{{ md.got ? '已达成' : md.progress }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="h">高频错题型 TOP10</view>
      <view v-if="!byType.length" class="spin">暂无数据</view>
      <view v-for="t in byType" :key="t.question_type" class="tline">
        {{ typeName(t.question_type) }} <text class="n">×{{ t.n }}</text>
      </view>
    </view>

    <view class="card">
      <view class="h">数据备份与迁移</view>
      <view class="bk-tip">免注册也能换机：生成恢复码备份学习数据，在新设备输入恢复码即可找回。</view>
      <view v-if="backupCode" class="bk-code" @click="copyCode">恢复码：{{ backupCode }}（点击复制）</view>
      <view class="row2">
        <button class="bk-btn" :disabled="bkLoading" @click="doBackup">{{ backupCode ? '更新备份' : '生成恢复码' }}</button>
        <button class="bk-btn ghost" :disabled="bkLoading" @click="doRestore">输入恢复码恢复</button>
      </view>
    </view>
  </view>
</template>

<script>
import { request, anonUid } from '../../api.js';
import { md } from '../../md.js';

const MODS = [
  { key: 'ziliao', name: '资料' },
  { key: 'shuliang', name: '数量' },
  { key: 'yanyu', name: '言语' },
  { key: 'panduan', name: '判断' },
  { key: 'changshi', name: '常识' },
];

export default {
  data() {
    return { byModule: [], byType: [], byReason: [], masteredCount: 0, pstats: { byModule: {}, days: {} }, backupCode: uni.getStorageSync('backupCode') || '', bkLoading: false, history: [], showAllHist: false, coachHtml: uni.getStorageSync('coachAdvice') || '', coachLoading: false, growth: null, reco: null, dueN: 0, gwMod: '' };
  },
  computed: {
    speedData() {
      return this.history
        .filter((h) => h.n && h.secs)
        .slice(0, 14)
        .reverse()
        .map((h) => Math.round(h.secs / h.n));
    },
    speedAvg() {
      const d = this.speedData;
      return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : 0;
    },
    gwMods() {
      if (!this.growth) return [];
      const seen = new Set();
      this.growth.weeks.forEach((w) => Object.keys(w.modules || {}).forEach((k) => seen.add(k)));
      return MODS.filter((m) => seen.has(m.key));
    },
    growthRows() {
      if (!this.growth) return [];
      return this.growth.weeks.slice(-8).map((w) => {
        const [y, wk] = w.week.split('-');
        const src = this.gwMod ? (w.modules || {})[this.gwMod] || { n: 0, c: 0 } : w;
        return {
          week: w.week,
          label: y.slice(2) + '年第' + Number(wk) + '周',
          n: src.n,
          pct: src.n ? Math.round((src.c / src.n) * 100) : 0,
        };
      });
    },
    growthDelta() {
      const r = this.growthRows;
      if (r.length < 2) return null;
      return r[r.length - 1].pct - r[r.length - 2].pct;
    },
    trendData() {
      return this.history
        .slice(0, 14)
        .reverse()
        .map((h) => (h.n ? Math.round((h.correct / h.n) * 100) : 0));
    },
    trendAvg() {
      if (!this.trendData.length) return 0;
      return Math.round(this.trendData.reduce((a, b) => a + b, 0) / this.trendData.length);
    },
    total() {
      return this.byModule.reduce((s, m) => s + m.n, 0) || 1;
    },
    totalDone() {
      return Object.values(this.pstats.byModule).reduce((s, m) => s + m.done, 0);
    },
    accPct() {
      const done = this.totalDone;
      if (!done) return 0;
      const c = Object.values(this.pstats.byModule).reduce((s, m) => s + m.correct, 0);
      return Math.round((c / done) * 100);
    },
    streakDays() {
      const days = this.pstats.days || {};
      let n = 0;
      const d = new Date();
      for (;;) {
        const key = d.toISOString().slice(0, 10);
        if (days[key]) {
          n++;
          d.setDate(d.getDate() - 1);
        } else if (n === 0 && key === new Date().toISOString().slice(0, 10)) {
          d.setDate(d.getDate() - 1);
        } else break;
      }
      return n;
    },
    medals() {
      const done = this.totalDone;
      const streak = this.streakDays;
      const best = this.pstats.bestStreak || 0;
      const zhan = this.masteredCount;
      const m = (icon, name, got, progress) => ({ icon, name, got, progress });
      return [
        m('🌱', '初战告捷', done >= 10, done + '/10 题'),
        m('💪', '小有所成', done >= 100, done + '/100 题'),
        m('🏆', '刷题大师', done >= 500, done + '/500 题'),
        m('🔥', '三日不辍', streak >= 3, streak + '/3 天'),
        m('⚡', '七日连环', streak >= 7, streak + '/7 天'),
        m('🎯', '十连对', best >= 10, best + '/10 连对'),
        m('⚔️', '斩题十道', zhan >= 10, zhan + '/10 道'),
        m('👑', '百题斩', zhan >= 100, zhan + '/100 道'),
      ];
    },
    trend() {
      const days = this.pstats.days || {};
      const dc = this.pstats.daysCorrect || {};
      const out = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const done = days[key] || 0;
        out.push({
          key,
          label: i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`,
          done,
          pct: done ? Math.round(((dc[key] || 0) / done) * 100) : 0,
        });
      }
      return out;
    },
    trendHas() {
      return this.trend.some((t) => t.done > 0);
    },
    reasonTotal() {
      return this.byReason.reduce((s, r) => s + r.n, 0) || 1;
    },
    monthDays() {
      const now = new Date();
      const pre = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
      return Object.keys(this.pstats.days || {}).filter((k) => k.startsWith(pre) && this.pstats.days[k] > 0).length;
    },
    calCells() {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const first = new Date(y, m, 1);
      const lead = (first.getDay() + 6) % 7;
      const total = new Date(y, m + 1, 0).getDate();
      const days = this.pstats.days || {};
      const cells = [];
      for (let i = 0; i < lead; i++) cells.push({ d: 0, cls: 'blank' });
      for (let d = 1; d <= total; d++) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const n = days[key] || 0;
        let cls = '';
        if (n >= 10) cls = 'full';
        else if (n > 0) cls = 'part';
        if (d === now.getDate()) cls += ' today';
        cells.push({ d, cls });
      }
      return cells;
    },
    axes() {
      return MODS.map((m) => {
        const s = this.pstats.byModule[m.key] || { done: 0, correct: 0 };
        return { ...m, pct: s.done ? Math.round((s.correct / s.done) * 100) : 0 };
      });
    },
    hasRadar() {
      return this.axes.some((a) => a.pct > 0);
    },
    subMap() {
      const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断' };
      const bySub = this.pstats.bySub || {};
      const groups = {};
      for (const [key, s] of Object.entries(bySub)) {
        const [mod, sub] = key.split('|');
        if (!sub || s.done < 3) continue;
        const pct = Math.round((s.correct / s.done) * 100);
        if (!groups[mod]) groups[mod] = [];
        groups[mod].push({ sub, done: s.done, pct, lv: pct < 60 ? 'lo' : pct <= 80 ? 'mid' : 'hi' });
      }
      return Object.entries(groups).map(([m, subs]) => ({
        module: m,
        name: NAMES[m] || m,
        subs: subs.sort((a, b) => a.pct - b.pct),
      }));
    },
    polyStyle() {
      const pts = this.axes.map((a, i) => {
        const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const r = (a.pct / 100) * 50;
        return `${50 + r * Math.cos(ang)}% ${50 + r * Math.sin(ang)}%`;
      });
      return { clipPath: `polygon(${pts.join(',')})` };
    },
  },
  onShow() {
    this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
    this.history = uni.getStorageSync('practiceHistory') || [];
    this.loadGrowth();
    this.loadReco();
    this.load();
  },
  methods: {
    async getCoach() {
      this.coachLoading = true;
      try {
        const byMod = {};
        for (const [k, v] of Object.entries(this.pstats.byModule || {})) {
          byMod[k] = { 已做: v.done, 正确率: v.done ? Math.round((v.correct / v.done) * 100) + '%' : '无' };
        }
        const stats = {
          累计刷题: this.totalDone,
          总正确率: this.accPct + '%',
          连续打卡天数: this.streakDays,
          各模块: byMod,
          错题模块分布: this.byModule.map((m) => this.modName(m.module) + '×' + m.n).join('、'),
          错因分布: this.byReason.map((r) => r.error_reason + '×' + r.n).join('、'),
          高频错题型TOP5: this.byType.slice(0, 5).map((t) => this.typeName(t.question_type) + '×' + t.n).join('、'),
          近10次练习: this.history.slice(0, 10).map((h) => (this.modName(h.module) || '混合') + ' ' + h.correct + '/' + h.n),
        };
        const d = await request('/api/coach', { method: 'POST', data: { stats } });
        this.coachHtml = md(d.advice || '');
        uni.setStorageSync('coachAdvice', this.coachHtml);
      } catch (e) {
        uni.showToast({ title: '生成失败：' + e.message, icon: 'none' });
      }
      this.coachLoading = false;
    },
    fmtHist(t) {
      const d = new Date(t);
      const p = (x) => (x < 10 ? '0' + x : x);
      return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    typeName(t) {
      if (!t) return '未分类';
      return String(t).replace(/^(数量关系|数学运算|资料分析|言语理解(与表达)?|判断推理|逻辑判断|常识判断|常识)[-－·：:]/, '');
    },
    modName(m) {
      const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断' };
      return NAMES[m] || m || '未分类';
    },
    goPractice(mod) {
      const KEY = { '资料分析': 'ziliao', '数量关系': 'shuliang', '言语理解': 'yanyu', '判断推理': 'panduan', '常识判断': 'changshi' };
      const k = KEY[mod] || (Object.values(KEY).includes(mod) ? mod : '');
      if (k) uni.setStorageSync('practiceModule', k);
      uni.switchTab({ url: '/pages/practice/practice' });
    },
    ringStyle(i) {
      const size = i * 25;
      return { width: size + '%', height: size + '%', left: (100 - size) / 2 + '%', top: (100 - size) / 2 + '%' };
    },
    labelStyle(i) {
      const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return {
        left: 50 + 58 * Math.cos(ang) + '%',
        top: 50 + 58 * Math.sin(ang) + '%',
      };
    },
    sevClass(n) {
      const pct = n / this.total;
      if (pct > 0.4) return 'sev-hi';
      if (pct > 0.2) return 'sev-mid';
      return '';
    },
    goBook() {
      uni.switchTab({ url: '/pages/book/book' });
    },
    goSub(module, sub) {
      uni.setStorageSync('practicePreset', { module, submodule: sub, count: 10 });
      uni.switchTab({ url: '/pages/practice/practice' });
    },
    copyCode() {
      uni.setClipboardData({ data: this.backupCode });
    },
    localData() {
      const keys = ['pstats', 'dailyPlan', 'dailyGoal', 'groupSize', 'realMode', 'fontLv', 'beiMode', 'favQuestions', 'practiceHistory', 'coachAdvice', 'backupCode'];
      const out = {};
      keys.forEach((k) => {
        const v = uni.getStorageSync(k);
        if (v !== '' && v !== null && v !== undefined) out[k] = v;
      });
      return out;
    },
    async doBackup() {
      this.bkLoading = true;
      try {
        const d = await request('/api/backup', { method: 'POST', data: { code: this.backupCode || null, data: this.localData() } });
        this.backupCode = d.code;
        uni.setStorageSync('backupCode', d.code);
        uni.showModal({ title: '备份成功', content: '恢复码：' + d.code + '\n请记下或截图保存，在新设备输入即可恢复数据。', showCancel: false });
      } catch (e) {
        uni.showToast({ title: '备份失败：' + e.message, icon: 'none' });
      }
      this.bkLoading = false;
    },
    doRestore() {
      uni.showModal({
        title: '输入恢复码',
        editable: true,
        placeholderText: '如：AB3D5F7H',
        success: async (res) => {
          if (!res.confirm || !res.content) return;
          try {
            const d = await request('/api/backup?code=' + encodeURIComponent(res.content.trim()));
            Object.entries(d.data || {}).forEach(([k, v]) => uni.setStorageSync(k, v));
            uni.setStorageSync('backupCode', res.content.trim().toUpperCase());
            this.backupCode = res.content.trim().toUpperCase();
            this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
            this.history = uni.getStorageSync('practiceHistory') || [];
            this.coachHtml = uni.getStorageSync('coachAdvice') || '';
            uni.showToast({ title: '恢复成功！', icon: 'success' });
          } catch (e) {
            uni.showToast({ title: '恢复失败：' + e.message, icon: 'none' });
          }
        },
      });
    },
    async loadGrowth() {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      try {
        this.growth = await request('/api/growth?uid=' + encodeURIComponent(uid));
      } catch (e) { /* 非关键路径 */ }
    },
    async loadReco() {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      try {
        this.reco = await request('/api/recommend?uid=' + encodeURIComponent(uid));
      } catch (e) { /* 非关键路径 */ }
      try {
        const d = await request('/api/review?uid=' + encodeURIComponent(anonUid()));
        this.dueN = d.total || 0;
      } catch (e) { /* 非关键路径 */ }
    },
    async load() {
      try {
        const d = await request('/api/stats');
        this.byModule = d.by_module;
        this.byType = d.by_type;
        this.byReason = d.by_reason || [];
        const mk = await request('/api/mistakes?uid=' + encodeURIComponent(anonUid()));
        this.masteredCount = (mk.items || []).filter((m) => m.mastered).length;
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 24rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.ov { display: flex; }
.ovi { flex: 1; text-align: center; }
.ovn { display: block; font-size: 48rpx; font-weight: 700; color: var(--ink); }
.ovt { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 6rpx; }
.h { font-size: 28rpx; font-weight: 600; margin-bottom: 14rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 20rpx; }
.radar-box { display: flex; justify-content: center; padding: 40rpx 0 30rpx; }
.radar { position: relative; width: 380rpx; height: 380rpx; }
.ring { position: absolute; border: 1rpx solid var(--line); border-radius: 50%; box-sizing: border-box; }
.poly { position: absolute; inset: 0; background: rgba(79, 70, 229, 0.35); border-radius: 2rpx; }
.axis-label { position: absolute; transform: translate(-50%, -50%); text-align: center; white-space: nowrap; }
.al-name { display: block; font-size: 23rpx; color: var(--ink); font-weight: 600; }
.al-val { display: block; font-size: 20rpx; color: var(--brand); }
.brow { margin: 14rpx 0; }
.blabel { display: flex; justify-content: space-between; font-size: 26rpx; color: var(--ink); margin-bottom: 6rpx; }
.bar { background: var(--brand-soft); border-radius: 999rpx; height: 20rpx; position: relative; overflow: hidden; }
.fill { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #6366f1, #4f46e5); border-radius: 999rpx; transition: width 0.6s ease; }
.fill.sev-hi { background: linear-gradient(90deg, #f87171, #ef4444); }
.fill.sev-mid { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.tline { font-size: 26rpx; margin: 8rpx 0; }
.fill.rz { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.trend { display: flex; align-items: flex-end; gap: 12rpx; height: 220rpx; padding-top: 8rpx; }
.tcol { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.tpct { font-size: 18rpx; color: var(--brand); height: 28rpx; }
.tbar { flex: 1; width: 36rpx; background: var(--soft-bg); border-radius: 999rpx; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
.tfill { width: 100%; background: linear-gradient(180deg, #6366f1, #4f46e5); border-radius: 999rpx; }
.tfill.lo { background: linear-gradient(180deg, #fbbf24, #f59e0b); }
.tday { font-size: 19rpx; color: var(--ink-2); margin-top: 8rpx; }
.radar-empty { text-align: center; padding: 30rpx 0 20rpx; }
.re-t { font-size: 28rpx; font-weight: 600; }
.re-s { font-size: 23rpx; color: var(--ink-2); margin: 8rpx 0 20rpx; }
.re-btn { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border-radius: 18rpx; font-size: 26rpx; font-weight: 600; width: 50%; }
.medals { display: flex; flex-wrap: wrap; }
.medal { width: 25%; box-sizing: border-box; text-align: center; padding: 14rpx 6rpx; opacity: 0.35; filter: grayscale(1); }
.medal.got { opacity: 1; filter: none; }
.m-ico { display: block; font-size: 48rpx; }
.m-name { display: block; font-size: 22rpx; font-weight: 600; margin-top: 6rpx; }
.m-sub { display: block; font-size: 18rpx; color: var(--ink-2); margin-top: 4rpx; }
.cal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.cal-sub { font-size: 22rpx; color: var(--ink-2); }
.cal-week { display: flex; margin-bottom: 8rpx; }
.cal-w { flex: 1; text-align: center; font-size: 20rpx; color: var(--ink-2); }
.cal-grid { display: flex; flex-wrap: wrap; }
.cal-c { width: 14.28%; height: 64rpx; line-height: 64rpx; text-align: center; font-size: 22rpx; color: var(--ink-2); box-sizing: border-box; border-radius: 50%; }
.cal-c.part { background: var(--brand-soft); color: var(--brand); font-weight: 600; }
.cal-c.full { background: var(--brand); color: #fff; font-weight: 700; }
.cal-c.today { border: 2rpx solid var(--brand); }
.n { color: var(--brand); font-weight: 600; }
.km-group { margin-bottom: 18rpx; }
.km-mod { font-size: 24rpx; font-weight: 600; color: var(--ink-2); margin-bottom: 10rpx; }
.km-items { display: flex; flex-wrap: wrap; gap: 12rpx; }
.km-chip { border-radius: 14rpx; padding: 10rpx 18rpx; }
.km-chip.lo { background: #fee2e2; }
.km-chip.lo .km-name, .km-chip.lo .km-pct { color: #b91c1c; }
.km-chip.mid { background: #fef3c7; }
.km-chip.mid .km-name, .km-chip.mid .km-pct { color: #b45309; }
.km-chip.hi { background: #d1fae5; }
.km-chip.hi .km-name, .km-chip.hi .km-pct { color: #047857; }
.km-name { display: block; font-size: 24rpx; font-weight: 600; }
.km-pct { display: block; font-size: 19rpx; margin-top: 2rpx; }
.km-legend { display: flex; gap: 18rpx; flex-wrap: wrap; margin-top: 8rpx; }
.coach-btn {
  font-size: 24rpx;
  color: #4f46e5;
  background: #eef2ff;
  border-radius: 999rpx;
  padding: 8rpx 22rpx;
}
.coach-tip {
  font-size: 24rpx;
  color: var(--ink-2);
  padding: 16rpx 0 4rpx;
}
.coach-body {
  display: block;
  font-size: 25rpx;
  line-height: 1.7;
  padding-top: 8rpx;
}
.hist-row { display: flex; align-items: center; gap: 16rpx; padding: 14rpx 0; border-bottom: 1rpx solid #f0f1f5; }
.hist-time { font-size: 22rpx; color: var(--ink-2); width: 170rpx; }
.gw-row { display: flex; align-items: center; gap: 14rpx; margin-bottom: 12rpx; }
.gw-wk { font-size: 22rpx; color: var(--ink-2); width: 130rpx; flex-shrink: 0; }
.gw-bar { flex: 1; height: 16rpx; background: var(--brand-soft, #eef1fd); border-radius: 999rpx; overflow: hidden; }
.gw-fill { height: 100%; background: #16a34a; border-radius: 999rpx; }
.gw-fill.mid { background: #f59e0b; }
.gw-fill.lo { background: #dc2626; }
.gw-pct { font-size: 22rpx; width: 150rpx; text-align: right; flex-shrink: 0; }
.gw-n { color: var(--ink-2); }
.gw-tabs { display: flex; gap: 10rpx; margin-bottom: 14rpx; flex-wrap: wrap; }
.gw-tab { font-size: 22rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 4rpx 18rpx; background: var(--card); }
.gw-tab.on { color: #fff; background: var(--brand, #4f6ef7); border-color: var(--brand, #4f6ef7); }
.gw-delta { font-size: 23rpx; color: #dc2626; margin-top: 6rpx; }
.gw-delta.up { color: #16a34a; }
.rc-row { display: flex; align-items: center; gap: 12rpx; padding: 14rpx 0; border-bottom: 1rpx solid var(--line); }
.rc-row:last-of-type { border-bottom: none; }
.rc-main { flex: 1; display: flex; align-items: center; gap: 10rpx; min-width: 0; }
.rc-name { font-size: 26rpx; font-weight: 600; }
.rc-tag { font-size: 20rpx; color: #16a34a; background: #f0fdf4; border-radius: 999rpx; padding: 2rpx 14rpx; flex-shrink: 0; }
.rc-tag.warn { color: #dc2626; background: #fef2f2; }
.rc-meta { font-size: 22rpx; color: var(--ink-2); flex-shrink: 0; }
.rc-go { font-size: 23rpx; color: var(--brand, #4f6ef7); flex-shrink: 0; }
.rc-note { font-size: 20rpx; color: var(--ink-2); margin-top: 10rpx; }
.trend { display: flex; align-items: flex-end; gap: 8rpx; height: 160rpx; padding-top: 12rpx; }
.trend-col { flex: 1; height: 100%; display: flex; align-items: flex-end; }
.trend-bar { width: 100%; border-radius: 6rpx 6rpx 0 0; background: #16a34a; min-height: 6rpx; }
.trend-bar.mid { background: #f59e0b; }
.trend-bar.lo { background: #dc2626; }
.trend-x { display: flex; justify-content: space-between; font-size: 22rpx; color: var(--ink-2); margin-top: 10rpx; }
.hist-mod { font-size: 24rpx; flex: 1; }
.hist-mod.exam { color: #b45309; font-weight: 600; }
.hist-n { font-size: 24rpx; color: var(--ink-2); }
.hist-pct { font-size: 26rpx; font-weight: 700; color: #16a34a; width: 90rpx; text-align: right; }
.hist-pct.lo { color: #dc2626; }
.hist-more { text-align: center; font-size: 24rpx; color: var(--brand, #4f6ef7); padding: 14rpx 0 2rpx; }
.km-lg { font-size: 20rpx; color: var(--ink-2); }
.km-lg.r { color: #ef4444; }
.km-lg.y { color: #f59e0b; }
.km-lg.g { color: #10b981; }
.bk-tip { font-size: 23rpx; color: var(--ink-2); line-height: 1.6; margin-bottom: 14rpx; }
.bk-code { font-size: 26rpx; font-weight: 700; color: var(--brand); background: var(--brand-soft); border-radius: 14rpx; padding: 14rpx 22rpx; margin-bottom: 14rpx; }
.row2 { display: flex; gap: 16rpx; }
.bk-btn { flex: 1; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border-radius: 16rpx; font-size: 25rpx; font-weight: 600; }
.bk-btn.ghost { background: var(--brand-soft); color: var(--brand); }
</style>
