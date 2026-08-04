<template>
  <view class="wrap home">
    <!-- 全局搜索入口 -->
    <view class="searchbar" @click="goSearch">
      <l-icon name="search" :size="16" color="#9ca3af" />
      <text class="searchbar-t">搜题目 / 考点 / 试卷，支持题号</text>
    </view>

    <!-- Hero：今日目标 + 行动 -->
    <view class="hero">
      <view class="hero-top">
        <text class="hero-goal">今日已练 <text class="hero-n">{{ todayCount }}</text>/{{ dailyGoal }} 题{{ todayCount >= dailyGoal ? ' · 已达成' : '' }}</text>
        <view v-if="todayCount >= dailyGoal" class="hero-streak" @click="openPoster"><l-icon name="party-popper" :size="13" color="#ffffff" /><text>生成打卡海报 ›</text></view>
        <view v-else-if="dailyStreak" class="hero-streak"><l-icon name="flame" :size="13" color="#ffffff" /><text>连续打卡 {{ dailyStreak }} 天</text></view>
      </view>
      <view class="hero-bar"><view class="hero-fill" :style="{ width: Math.min((todayCount / dailyGoal) * 100, 100) + '%' }" /></view>
      <view class="hero-acts">
        <view class="hero-btn main" @click="startDaily">{{ todayDone ? '再练一组 ›' : '继续目标 ›' }}</view>
        <view class="hero-btn sub" @click="openSetup">今日计划</view>
      </view>
    </view>

    <!-- 学习计划引导 / 今日计划 -->
    <view v-if="profile === null && !guideHide" class="card guide">
      <view class="guide-l" @click="openSetup">
        <text class="guide-t">制定我的学习计划</text>
        <text class="guide-s">按考试日期倒排每日任务：专项练习 + 错题复习 + 每周模考</text>
      </view>
      <text class="guide-btn" @click="openSetup">去制定 ›</text>
      <text class="guide-x" @click.stop="skipGuide">跳过</text>
    </view>
    <view v-if="planToday && planToday.profile" class="card plancard">
      <view class="plan-h">
        <text class="plan-t">今日计划</text>
        <view class="plan-hr">
          <text v-if="planToday.days_left != null" class="plan-days">距考试 {{ planToday.days_left }} 天 · {{ planToday.phase_name }}</text>
          <text class="plan-edit" @click="openSetup">编辑</text>
        </view>
      </view>
      <view class="plan-prog">
        <view class="plan-prog-bar"><view class="plan-prog-fill" :style="{ width: (planToday.progress.total ? (planToday.progress.done / planToday.progress.total) * 100 : 0) + '%' }" /></view>
        <text class="plan-prog-t">{{ planToday.progress.done }}/{{ planToday.progress.total }}</text>
      </view>
      <view v-for="t in planToday.tasks" :key="t.key" class="plan-row task" @click="goTask(t)">
        <text class="task-ck" :class="{ on: t.done }">{{ t.done ? '✓' : '' }}</text>
        <view class="task-main">
          <text class="plan-txt" :class="{ tdone: t.done }">{{ t.title }}</text>
          <text class="task-sub">{{ t.sub }}<template v-if="t.type !== 'mock' && t.done_n"> · 已完成 {{ t.done_n }}/{{ t.target }}</template></text>
        </view>
        <text class="plan-go">{{ t.done ? '已完成' : t.type === 'mock' ? '去模考 ›' : t.type === 'review' ? '去复习 ›' : '去练 ›' }}</text>
      </view>
      <view class="plan-focus">
        <text class="plan-focus-k">今天主攻</text>
        <text v-for="(fn, fk) in FOCUS_MODS" :key="fk" class="plan-fchip" :class="{ on: plan && plan.focus === fk }" @click="setFocus(fk)">{{ fn }}</text>
      </view>
    </view>
    <view v-else-if="plan && (plan.due_mistakes || (plan.weak || []).length || (plan.yesterday || {}).n)" class="card plancard">
      <view class="plan-h">
        <text class="plan-t">今日建议</text>
        <text v-if="(plan.yesterday || {}).n" class="plan-y">昨日练 {{ plan.yesterday.n }} 题 · 正确率 {{ Math.round((plan.yesterday.correct / plan.yesterday.n) * 100) }}%</text>
        <text v-else class="plan-y">昨日未练习</text>
      </view>
      <view v-if="plan.due_mistakes" class="plan-row" @click="goBook">
        <text class="plan-dot due" />
        <text class="plan-txt">先复习到期错题 {{ plan.due_mistakes }} 道</text>
        <text class="plan-go">去复习 ›</text>
      </view>
      <view v-for="w in plan.weak || []" :key="w.module + w.submodule + (w.tag3 || '')" class="plan-row" @click="startPreset(w.module, w.submodule, 10, true, w.tag3 || null)">
        <text class="plan-dot" />
        <text class="plan-txt">{{ w.label || w.submodule }}（{{ w.reason }} · 正确率 {{ Math.round(w.acc * 100) }}%）</text>
        <text class="plan-go">练 10 题 ›</text>
      </view>
      <view class="plan-focus">
        <text class="plan-focus-k">今天主攻</text>
        <text v-for="(fn, fk) in FOCUS_MODS" :key="fk" class="plan-fchip" :class="{ on: plan.focus === fk }" @click="setFocus(fk)">{{ fn }}</text>
      </view>
    </view>

    <!-- 断卡风险提示 -->
    <view v-if="streakRisk" class="card riskbar" @click="startDaily">
      <view class="risk-ico"><l-icon name="flame" :size="22" color="#d97706" /></view>
      <view class="grow">
        <text class="risk-t">{{ streakRisk.title }}</text>
        <text class="risk-s">{{ streakRisk.sub }}</text>
      </view>
      <text class="risk-go">去刷题 ›</text>
    </view>

    <!-- 公告 -->
    <view v-if="announce" class="card ann">
      <l-icon name="megaphone" :size="16" color="#0369a1" />
      <view class="ann-c">
        <text class="ann-t">{{ announce.title }}</text>
        <text v-if="announce.body" class="ann-b">{{ announce.body }}</text>
      </view>
      <view class="ann-x" @click="dismissAnn"><l-icon name="x" :size="16" color="#0369a1" /></view>
    </view>

    <!-- 时政每日一练 -->
    <view v-if="counts.length" class="card szcard" @click="szTodayDone ? launch({ kind: 'szreview' }) : launch({ kind: 'shizheng' })">
      <view class="sz-ico"><l-icon name="newspaper" :size="24" color="#d97706" /></view>
      <view class="grow">
        <view class="sz-t">时政每日一练 <text v-if="!szTodayDone" class="tag warn">今日更新</text><text v-else class="tag ok">已完成</text></view>
        <text class="sz-s">每日 10 题 · 近半年国内时政热点 · 全站同题</text>
      </view>
      <view class="mini-btn">{{ szTodayDone ? '回顾' : '去练习' }}</view>
    </view>

    <!-- 专项练习 -->
    <view class="sec-h">
      <text class="sec-t">专项练习</text>
      <text class="sec-more" @click="customOpen = true">练习设置 ›</text>
    </view>
    <view v-if="!counts.length" class="card spin" @click="loadCounts">题库加载中…点此重试</view>
    <view class="modlist">
      <view v-for="c in counts" :key="c.module" class="card modrow" @click="openModule(c.module)">
        <view class="mod-ico" :style="{ background: modColor(c.module).bg }"><l-icon :name="modIcon(c.module)" :size="24" :color="modColor(c.module).fg" /></view>
        <view class="grow">
          <text class="mod-name">{{ modName(c.module) }}</text>
          <text class="mod-sub">{{ progText(c) }}</text>
        </view>
        <view class="mod-bar"><view class="mod-fill" :style="{ width: progPct(c) + '%', background: modColor(c.module).fg }" /></view>
        <text class="mod-arrow">›</text>
      </view>
      <view v-if="counts.length" class="card modrow" @click="startPreset(null)">
        <view class="mod-ico" style="background: var(--brand-soft)"><l-icon name="shuffle" :size="24" color="#3b6ff5" /></view>
        <view class="grow">
          <text class="mod-name">混合刷题</text>
          <text class="mod-sub">全部模块随机 · 每组 {{ groupSize }} 题</text>
        </view>
        <text class="mod-arrow">›</text>
      </view>
      <view v-if="weakModule" class="card smart" @click="openModule(weakModule)">
        <view class="smart-l">
          <text class="smart-t">智能刷题：攻克薄弱项</text>
          <text class="smart-s">你的 {{ modName(weakModule) }} 正确率较低，建议专项练习</text>
        </view>
        <text class="smart-go">去练 ›</text>
      </view>
    </view>

    <!-- 更多练习 -->
    <view class="sec-h"><text class="sec-t">更多练习</text></view>
    <view class="more-grid">
      <view class="card more-c" @click="goExamList">
        <view class="more-ico"><l-icon name="file-text" :size="20" color="#3b6ff5" /></view>
        <text class="more-t">全真模考</text>
        <text class="more-s">真题卷库 · 成绩报告</text>
      </view>
      <view class="card more-c" @click="goShenlun">
        <view class="more-ico"><l-icon name="pen-line" :size="20" color="#0d9488" /></view>
        <text class="more-t">申论专区</text>
        <text class="more-s">真题 + AI 采分点批改</text>
      </view>
      <view class="card more-c" @click="goBook">
        <view class="more-ico"><l-icon name="rotate-ccw" :size="20" color="#e11d48" /></view>
        <text class="more-t">错题重练</text>
        <text class="more-s">遗忘曲线 · 今日复习</text>
      </view>
      <view class="card more-c" @click="goAsk">
        <view class="more-ico"><l-icon name="camera" :size="20" color="#7c3aed" /></view>
        <text class="more-t">拍题讲解</text>
        <text class="more-s">花生十三方法体系</text>
      </view>
      <view class="card more-c" @click="goPk">
        <view class="more-ico"><l-icon name="swords" :size="20" color="#d97706" /></view>
        <text class="more-t">答题 PK</text>
        <text class="more-s">同组 10 题 · 比分拼手速</text>
      </view>
      <view class="card more-c" @click="goMini">
        <view class="more-ico"><l-icon name="zap" :size="20" color="#3b6ff5" /></view>
        <text class="more-t">迷你模考</text>
        <text class="more-s">25 题 · 20 分钟</text>
      </view>
      <view class="card more-c" @click="openPapers">
        <view class="more-ico"><l-icon name="files" :size="20" color="#0d9488" /></view>
        <text class="more-t">真题卷练习</text>
        <text class="more-s">按卷连做 · 统一判分</text>
      </view>
    </view>

    <!-- 自定义练习 sheet -->
    <view v-if="customOpen" class="mask" @click="customOpen = false">
      <view class="sheet" @click.stop>
        <view class="grab" />
        <view class="sheet-h">
          <text class="sheet-t">练习设置</text>
          <view class="sheet-x" @click="customOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <view class="setrow">
          <view class="set-kwrap"><text class="set-k">每日目标</text><text class="set-sub">今天合计要练的题数</text></view>
          <view class="set-chips">
            <text v-for="g in [20, 50, 100]" :key="g" class="set-chip" :class="{ on: dailyGoal === g }" @click="setGoal(g)">{{ g }} 题</text>
          </view>
        </view>
        <view class="setrow">
          <text class="set-k">选题来源</text>
          <view class="set-chips">
            <text class="set-chip" :class="{ on: !realMode }" @click="setReal(false)">题库模式</text>
            <text class="set-chip" :class="{ on: realMode }" @click="setReal(true)">真题模式</text>
          </view>
        </view>
        <view v-if="realMode && realYears.length" class="setrow">
          <text class="set-k">真题年份</text>
          <view class="set-chips scrollx">
            <text class="set-chip" :class="{ on: !realYear }" @click="setRealYear(null)">全部</text>
            <text v-for="y in realYears" :key="y.y" class="set-chip" :class="{ on: realYear === y.y }" @click="setRealYear(y.y)">{{ y.y }}</text>
          </view>
        </view>
        <view v-if="realMode && realRegions.length" class="setrow">
          <text class="set-k">真题地区</text>
          <view class="set-chips scrollx">
            <text class="set-chip" :class="{ on: !realRegion }" @click="setRealRegion(null)">全部</text>
            <text v-for="r in realRegions" :key="r.r" class="set-chip" :class="{ on: realRegion === r.r }" @click="setRealRegion(r.r)">{{ r.r }}</text>
          </view>
        </view>
        <view class="setrow">
          <view class="set-kwrap"><text class="set-k">每组题量</text><text class="set-sub">单次练习连做几道</text></view>
          <view class="set-chips">
            <text v-for="n in [10, 20, 30, 50]" :key="n" class="set-chip" :class="{ on: groupSize === n }" @click="setGroup(n)">{{ n }}</text>
          </view>
        </view>
        <wd-button type="primary" block custom-class="sheet-cta" @click="customOpen = false; startPreset(null)">按以上设置开始练习（混合模块）</wd-button>
        <view class="exp-opts">
          <text class="expchip" :class="{ on: expSheet && !expOnly }" @click="expOnly = false; expSheet = !expSheet">含答题卡</text>
          <text class="expchip" :class="{ on: expAns && !expOnly }" @click="expOnly = false; expAns = !expAns">含答案解析</text>
          <text class="expchip" :class="{ on: expOnly }" @click="expOnly = !expOnly">仅导出答案</text>
        </view>
        <wd-button type="primary" plain block custom-class="sheet-cta2" @click="exportPaper">{{ exporting ? '正在生成 PDF…' : '导出为试卷 PDF' }}</wd-button>
        <view class="custom-note">以上设置同样作用于模块列表；模考与真题卷不受影响</view>
      </view>
    </view>

    <!-- 制定学习计划 sheet -->
    <view v-if="setupOpen" class="mask" @click="setupOpen = false">
      <view class="sheet" @click.stop>
        <view class="grab" />
        <view class="sheet-h">
          <text class="sheet-t">制定学习计划 · {{ ['考试信息', '目标', '每日时长'][setupStep - 1] }}（{{ setupStep }}/3）</text>
          <view class="sheet-x" @click="setupOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <template v-if="setupStep === 1">
          <view class="setrow">
            <text class="set-k">考试类型</text>
            <view class="set-chips">
              <text v-for="t in ['国考', '省考', '事业单位', '其他']" :key="t" class="set-chip" :class="{ on: pf.exam_type === t }" @click="pf.exam_type = t">{{ t }}</text>
            </view>
          </view>
          <view class="setrow">
            <text class="set-k">目标地区</text>
            <input v-model="pf.target_region" class="pf-input" placeholder="如 广东 / 全国（选填）" :maxlength="20" />
          </view>
          <view class="setrow">
            <text class="set-k">考试日期</text>
            <picker mode="date" :value="pf.exam_date" @change="pf.exam_date = $event.detail.value">
              <view class="pf-date" :class="{ empty: !pf.exam_date }">{{ pf.exam_date || '选择日期 ›' }}</view>
            </picker>
          </view>
        </template>
        <template v-else-if="setupStep === 2">
          <view class="setrow">
            <text class="set-k">目标分</text>
            <view class="set-chips">
              <text v-for="s in [60, 65, 70, 75, 80]" :key="s" class="set-chip" :class="{ on: pf.target_score === s }" @click="pf.target_score = s">{{ s }}+</text>
            </view>
          </view>
          <view class="setrow">
            <text class="set-k">基础自评</text>
            <view class="set-chips">
              <text v-for="b in ['零基础', '有基础', '二战']" :key="b" class="set-chip" :class="{ on: pf.base_level === b }" @click="pf.base_level = b">{{ b }}</text>
            </view>
          </view>
        </template>
        <template v-else>
          <view class="setrow">
            <view class="set-kwrap"><text class="set-k">每日可用时长</text><text class="set-sub">决定每日任务量</text></view>
            <view class="set-chips">
              <text v-for="m in [30, 60, 90, 120]" :key="m" class="set-chip" :class="{ on: pf.daily_minutes === m }" @click="pf.daily_minutes = m">{{ m }} 分钟</text>
            </view>
          </view>
          <view class="pf-summary">{{ pf.exam_type }}{{ pf.target_region ? ' · ' + pf.target_region : '' }} · {{ pf.exam_date }} · 目标 {{ pf.target_score }}+ · {{ pf.base_level }} · 每天 {{ pf.daily_minutes }} 分钟</view>
        </template>
        <wd-button type="primary" block custom-class="sheet-cta" @click="setupNext">{{ setupStep < 3 ? '下一步' : setupBusy ? '生成中…' : '生成我的学习计划' }}</wd-button>
        <view v-if="setupStep > 1" class="pf-back" @click="setupStep--">上一步</view>
      </view>
    </view>

    <!-- 真题卷库 sheet -->
    <view v-if="paperSheet" class="mask" @click="paperSheet = false">
      <view class="sheet" @click.stop>
        <view class="grab" />
        <view class="sheet-h">
          <text class="sheet-t">真题卷库 · 选择试卷</text>
          <view class="sheet-x" @click="paperSheet = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <view v-if="!papers.length" class="spin">试卷加载中…</view>
        <scroll-view v-if="paperRegions.length > 1" scroll-x class="pr-scroll">
          <text class="set-chip" :class="{ on: !paperRegion }" @click="paperRegion = null">全部</text>
          <text v-for="rg in paperRegions" :key="rg" class="set-chip" :class="{ on: paperRegion === rg }" @click="paperRegion = rg">{{ rg }}</text>
        </scroll-view>
        <view v-for="p in shownPapers" :key="p.source" class="sub-chip" @click="startPaper(p)">
          <text class="sub-name">{{ p.title }}</text>
          <text class="sub-n">{{ p.n }} 题</text>
        </view>
      </view>
    </view>

    <!-- 选二级题型 sheet -->
    <view v-if="subSelect" class="mask" @click="subSelect = null">
      <view class="sheet" @click.stop>
        <view class="grab" />
        <view class="sheet-h">
          <text class="sheet-t">{{ modName(subSelect) }} · 选择题型</text>
          <view class="sheet-x" @click="subSelect = null"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <view class="sub-chip all-chip" @click="startPreset(subSelect)">
          <text class="sub-name">全部随机</text>
          <text class="sub-n">{{ (counts.find(c => c.module === subSelect) || {}).n || 0 }} 题</text>
        </view>
        <view v-for="s in submodules" :key="s.submodule" class="sub-chip" @click="startPreset(subSelect, s.submodule)">
          <view class="sub-l">
            <text class="sub-name">{{ s.submodule }}</text>
            <text v-if="subProg[s.submodule]" class="sub-prog">已做 {{ subProg[s.submodule].n }} 题 · 正确率 {{ Math.round(100 * subProg[s.submodule].c / subProg[s.submodule].n) }}%</text>
          </view>
          <text class="sub-n">{{ s.n }} 题</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { request, anonUid, exportPdf } from '../../api.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };
const COLORS = {
  ziliao: { bg: '#e6f5f3', fg: '#0d9488' },
  shuliang: { bg: '#e8effe', fg: '#3b6ff5' },
  yanyu: { bg: '#fce8ec', fg: '#e11d48' },
  panduan: { bg: '#f1eafd', fg: '#7c3aed' },
  changshi: { bg: '#fbf1e0', fg: '#d97706' },
};
const ICONS = { ziliao: 'chart-pie', shuliang: 'calculator', yanyu: 'message-square', panduan: 'puzzle', changshi: 'lightbulb' };

export default {
  data() {
    return {
      counts: [],
      subSelect: null,
      paperSheet: false,
      customOpen: false,
      exporting: false,
      expSheet: true,
      expAns: true,
      expOnly: false,
      plan: null,
      profile: undefined,
      planToday: null,
      guideHide: uni.getStorageSync('planGuideHide') ? true : false,
      setupOpen: false,
      setupStep: 1,
      setupBusy: false,
      pf: { exam_type: '国考', target_region: '', exam_date: '', target_score: 70, daily_minutes: 60, base_level: '零基础' },
      FOCUS_MODS: { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断' },
      papers: [],
      paperRegion: null,
      subProg: {},
      submodules: [],
      pstats: { byModule: {}, days: {} },
      daily: { days: {} },
      szDaily: { days: {} },
      realMode: uni.getStorageSync('realMode') ? true : false,
      realYears: [],
      realRegions: [],
      realYear: uni.getStorageSync('realYear') || null,
      realRegion: uni.getStorageSync('realRegion') || null,
      groupSize: uni.getStorageSync('groupSize') || 10,
      dailyGoal: uni.getStorageSync('dailyGoal') || 20,
      announce: null,
    };
  },
  computed: {
    paperRegions() {
      const seen = [];
      for (const p of this.papers) {
        if (p.region && !seen.includes(p.region)) seen.push(p.region);
      }
      return seen.sort((a, b) => a.localeCompare(b, 'zh'));
    },
    shownPapers() {
      return this.paperRegion ? this.papers.filter((p) => p.region === this.paperRegion) : this.papers;
    },
    todayCount() {
      const days = (this.pstats && this.pstats.days) || {};
      return days[new Date().toISOString().slice(0, 10)] || 0;
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
    todayDone() {
      return !!this.daily.days[new Date().toISOString().slice(0, 10)];
    },
    szTodayDone() {
      return !!this.szDaily.days[new Date().toISOString().slice(0, 10)];
    },
    dailyModule() {
      const mods = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi'];
      const key = new Date().toISOString().slice(0, 10);
      let h = 0;
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      return mods[h % mods.length];
    },
    streakRisk() {
      const days = (this.pstats && this.pstats.days) || {};
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yKey = y.toISOString().slice(0, 10);
      const yN = days[yKey] || 0;
      if (this.todayCount >= this.dailyGoal) return null;
      if (!yN) {
        // 昨天完全没练：若之前有打卡记录，提示找回节奏
        const d2 = new Date();
        d2.setDate(d2.getDate() - 2);
        if (!days[d2.toISOString().slice(0, 10)]) return null;
        return { title: '昨天没打卡，连续记录中断了', sub: `今天练 ${this.dailyGoal} 题，重新出发不掉队` };
      }
      if (yN < this.dailyGoal) {
        return { title: `昨天只练了 ${yN}/${this.dailyGoal} 题，未达标`, sub: '今天补上进度，守住你的连续打卡' };
      }
      return null;
    },
    dailyStreak() {
      let n = 0;
      const d = new Date();
      if (!this.todayDone) d.setDate(d.getDate() - 1);
      while (this.daily.days[d.toISOString().slice(0, 10)]) {
        n++;
        d.setDate(d.getDate() - 1);
      }
      return n;
    },
  },
  onShow() {
    this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
    this.daily = uni.getStorageSync('dailyPlan') || { days: {} };
    this.szDaily = uni.getStorageSync('szDaily') || { days: {} };
    this.groupSize = uni.getStorageSync('groupSize') || 10;
    this.dailyGoal = uni.getStorageSync('dailyGoal') || 20;
    this.loadCounts();
    this.loadAnnounce();
    this.loadPlan();
    const wantSetup = uni.getStorageSync('openPlanSetup');
    if (wantSetup) uni.removeStorageSync('openPlanSetup');
    this.loadProfile().then(() => {
      if (wantSetup) this.openSetup();
    });
    if (this.realMode) this.loadRealFilters();
  },
  methods: {
    goSearch() {
      uni.navigateTo({ url: '/pkgA/search/search' });
    },
    openPoster() {
      uni.navigateTo({ url: '/pkgA/social/poster' });
    },
    goPk() {
      uni.navigateTo({ url: '/pkgA/pk/pk' });
    },
    modName(m) {
      return NAMES[m] || m || '未知';
    },
    modColor(m) {
      return COLORS[m] || { bg: '#edf3fe', fg: '#3b6ff5' };
    },
    modIcon(m) {
      return ICONS[m] || 'book-open';
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
    launch(payload) {
      uni.setStorageSync('practiceLaunch', payload);
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    startPreset(module, submodule, count, adaptive, tag3) {
      this.subSelect = null;
      this.launch({ kind: 'start', module: module || null, submodule: submodule || null, count: count || null, adaptive: !!adaptive, tag3: tag3 || null });
    },
    startDaily() {
      this.launch({ kind: 'daily' });
    },
    startPaper(p) {
      this.paperSheet = false;
      this.launch({ kind: 'paper', source: p.source, title: p.title });
    },
    goMini() {
      uni.navigateTo({ url: '/pkgA/exam/exam?mini=1' });
    },
    goExamList() {
      uni.navigateTo({ url: '/pkgA/exam/list' });
    },
    goShenlun() {
      uni.navigateTo({ url: '/pkgA/shenlun/shenlun' });
    },
    goBook() {
      uni.switchTab({ url: '/pages/book/book' });
    },
    goAsk() {
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    async loadAnnounce() {
      try {
        const d = await request('/api/announcement');
        const item = d.item;
        if (item && uni.getStorageSync('annDismissed') !== String(item.id)) this.announce = item;
      } catch (e) { /* 非关键路径 */ }
    },
    dismissAnn() {
      if (this.announce) uni.setStorageSync('annDismissed', String(this.announce.id));
      this.announce = null;
    },
    setGoal(g) {
      this.dailyGoal = g;
      uni.setStorageSync('dailyGoal', g);
    },
    async loadCounts() {
      try {
        const d = await request('/api/questions?limit=1');
        this.counts = d.counts || [];
      } catch (e) { /* 走下方重试 */ }
      if (this.counts.length) {
        this._countsTries = 0;
        return;
      }
      this._countsTries = (this._countsTries || 0) + 1;
      if (this._countsTries <= 20) setTimeout(() => this.loadCounts(), 3000);
    },
    async openModule(module) {
      try {
        const d = await request('/api/submodules?module=' + module);
        const items = (d.items || []).filter((s) => s.submodule);
        if (items.length < 2) {
          this.startPreset(module);
          return;
        }
        this.submodules = items;
        this.subSelect = module;
        this.subProg = {};
        const uid = uni.getStorageSync('anonUid');
        if (uid) {
          request('/api/submodule_progress?uid=' + uid + '&module=' + module)
            .then((p) => { this.subProg = p.items || {}; })
            .catch(() => {});
        }
      } catch (e) {
        this.startPreset(module);
      }
    },
    setReal(v) {
      this.realMode = v;
      uni.setStorageSync('realMode', v ? '1' : '');
      if (v && !this.realYears.length) this.loadRealFilters();
    },
    async loadRealFilters() {
      try {
        const d = await request('/api/real_filters');
        this.realYears = d.years || [];
        this.realRegions = d.regions || [];
      } catch (e) { /* 非关键路径 */ }
    },
    setRealYear(y) {
      this.realYear = y;
      uni.setStorageSync('realYear', y || '');
    },
    setRealRegion(r) {
      this.realRegion = r;
      uni.setStorageSync('realRegion', r || '');
    },
    setGroup(n) {
      this.groupSize = n;
      uni.setStorageSync('groupSize', n);
    },
    async openPapers() {
      this.paperSheet = true;
      if (this.papers.length) return;
      try {
        const d = await request('/api/papers');
        this.papers = d.items || [];
      } catch (e) {
        uni.showToast({ title: '试卷加载失败：' + e.message, icon: 'none' });
        this.paperSheet = false;
      }
    },
    async loadPlan() {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      try {
        this.plan = await request('/api/daily_plan?uid=' + encodeURIComponent(uid));
      } catch (e) { /* 非关键路径 */ }
    },
    async loadProfile() {
      try {
        const d = await request('/api/profile?uid=' + encodeURIComponent(anonUid()));
        this.profile = d.profile || null;
        if (this.profile) await this.loadPlanToday();
        else this.planToday = null;
      } catch (e) { /* 非关键路径 */ }
    },
    async loadPlanToday() {
      try {
        this.planToday = await request('/api/plan/today?uid=' + encodeURIComponent(anonUid()));
      } catch (e) { /* 非关键路径 */ }
    },
    openSetup() {
      const p = this.profile || {};
      this.pf = {
        exam_type: p.exam_type || '国考',
        target_region: p.target_region || '',
        exam_date: p.exam_date || '',
        target_score: p.target_score || 70,
        daily_minutes: p.daily_minutes || 60,
        base_level: p.base_level || '零基础',
      };
      this.setupStep = 1;
      this.setupOpen = true;
    },
    skipGuide() {
      this.guideHide = true;
      uni.setStorageSync('planGuideHide', '1');
      uni.showToast({ title: '已跳过，可在「我的」随时制定', icon: 'none', duration: 1500 });
    },
    async setupNext() {
      if (this.setupStep === 1 && !this.pf.exam_date) {
        uni.showToast({ title: '请先选择考试日期', icon: 'none' });
        return;
      }
      if (this.setupStep < 3) {
        this.setupStep++;
        return;
      }
      if (this.setupBusy) return;
      this.setupBusy = true;
      try {
        const d = await request('/api/profile', { method: 'POST', data: { uid: anonUid(), ...this.pf } });
        this.profile = d.profile;
        await this.loadPlanToday();
        this.setupOpen = false;
        uni.showToast({ title: '学习计划已生成', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '保存失败：' + e.message, icon: 'none' });
      } finally {
        this.setupBusy = false;
      }
    },
    goTask(t) {
      if (t.done) return;
      if (t.type === 'mock') {
        this.goMini();
        return;
      }
      if (t.type === 'review') {
        this.goBook();
        return;
      }
      const remain = Math.max(t.target - (t.done_n || 0), 5);
      this.launch({ kind: 'start', module: t.module || null, submodule: t.submodule || null, count: remain, adaptive: !!t.submodule, forceReal: t.real, tag3: null });
    },
    async exportPaper() {
      if (this.exporting) return;
      this.exporting = true;
      try {
        const limit = this.groupSize || 20;
        const realQ = this.realMode
          ? '&real=1' +
            (this.realYear ? '&year=' + this.realYear : '') +
            (this.realRegion ? '&region=' + encodeURIComponent(this.realRegion) : '')
          : '';
        const uid = uni.getStorageSync('anonUid');
        const d = await request('/api/questions?limit=' + limit + realQ + (uid ? '&uid=' + encodeURIComponent(uid) : ''));
        const ids = (d.items || []).map((q) => q.id).filter(Boolean);
        if (!ids.length) throw new Error('没有可导出的题目');
        const date = new Date();
        const title = (this.realMode ? '真题精选卷' : '练习卷') + ' ' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
        await exportPdf({
          title,
          question_ids: ids,
          include_answers: this.expOnly || this.expAns,
          answer_sheet: !this.expOnly && this.expSheet,
          include_questions: !this.expOnly,
        });
        uni.showToast({ title: 'PDF 已开始下载', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '导出失败：' + e.message, icon: 'none' });
      }
      this.exporting = false;
    },
    async setFocus(mod) {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      const next = this.plan && this.plan.focus === mod ? '' : mod;
      try {
        await request('/api/user_state', { method: 'POST', data: { uid, focus: next } });
        this.plan = await request('/api/daily_plan?uid=' + encodeURIComponent(uid));
        if (this.profile) this.loadPlanToday();
        if (next) uni.showToast({ title: '今日主攻已设为' + (this.FOCUS_MODS[next] || next) + '，推荐已更新', icon: 'none' });
      } catch (e) { /* 非关键路径 */ }
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 40rpx; }

/* Hero */
.hero { background: linear-gradient(135deg, #5b8af8, var(--brand)); border-radius: 28rpx; padding: 36rpx 36rpx 32rpx; margin-bottom: 24rpx; box-shadow: 0 12rpx 36rpx rgba(59, 111, 245, 0.3); }
.hero-top { display: flex; justify-content: space-between; align-items: center; }
.hero-goal { font-size: 26rpx; color: rgba(255, 255, 255, 0.85); }
.hero-n { font-size: 36rpx; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
.hero-streak { display: inline-flex; align-items: center; gap: 8rpx; font-size: 22rpx; color: #fff; background: rgba(255, 255, 255, 0.18); border-radius: 8rpx; padding: 4rpx 16rpx; }
.hero-bar { height: 12rpx; background: rgba(255, 255, 255, 0.25); border-radius: 999rpx; margin: 16rpx 0 24rpx; overflow: hidden; }
.hero-fill { height: 100%; background: var(--card); border-radius: 999rpx; transition: width 0.3s; }
.hero-acts { display: flex; gap: 20rpx; }
.hero-btn { min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border-radius: 20rpx; font-size: 28rpx; font-weight: 600; }
.hero-btn.main { flex: 1; background: var(--card); color: var(--brand); }
.hero-btn.sub { padding: 0 32rpx; background: rgba(255, 255, 255, 0.16); color: #fff; }

/* Section header */
.sec-h { display: flex; justify-content: space-between; align-items: baseline; margin: 36rpx 4rpx 20rpx; }
.sec-t { font-size: 32rpx; font-weight: 700; color: var(--ink); }
.sec-more { font-size: 24rpx; color: var(--ink-2); min-height: 44px; display: inline-flex; align-items: center; }

/* 时政卡 */
.szcard { display: flex; align-items: center; gap: 24rpx; padding: 26rpx 32rpx; }
.sz-ico { width: 80rpx; height: 80rpx; border-radius: 20rpx; background: var(--warn-soft); display: flex; align-items: center; justify-content: center; font-size: 38rpx; flex-shrink: 0; }
.sz-t { font-size: 29rpx; font-weight: 600; color: var(--ink); display: flex; align-items: center; gap: 8rpx; }
.sz-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.tag { display: inline-flex; align-items: center; height: 40rpx; padding: 0 16rpx; border-radius: 12rpx; font-size: 21rpx; font-weight: 500; }
.tag.warn { background: var(--warn-soft); color: #d97706; }
.tag.ok { background: var(--ok-soft); color: #16a34a; }
.mini-btn { flex-shrink: 0; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 28rpx; background: var(--brand-soft); color: var(--brand); border-radius: 20rpx; font-size: 25rpx; font-weight: 600; }
.grow { flex: 1; min-width: 0; }

/* 模块列表 */
.modlist { display: flex; flex-direction: column; }
.modrow { display: flex; align-items: center; gap: 24rpx; padding: 28rpx 32rpx; margin-bottom: 20rpx; }
.mod-ico { width: 88rpx; height: 88rpx; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; font-size: 40rpx; flex-shrink: 0; }
.mod-name { display: block; font-size: 30rpx; font-weight: 600; color: var(--ink); }
.mod-sub { display: block; font-size: 23rpx; color: var(--ink-2); margin-top: 4rpx; }
.mod-bar { width: 120rpx; height: 10rpx; background: var(--soft-bg); border-radius: 999rpx; overflow: hidden; flex-shrink: 0; }
.mod-fill { height: 100%; border-radius: 999rpx; }
.mod-arrow { color: var(--ink-4); font-size: 30rpx; flex-shrink: 0; }

.smart { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(120deg, var(--brand-soft), var(--brand-soft)); border: 1rpx solid var(--brand-soft-2); padding: 26rpx 32rpx; margin-bottom: 20rpx; }
.smart-t { display: block; font-size: 28rpx; font-weight: 600; color: var(--brand); }
.smart-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 6rpx; }
.smart-go { flex-shrink: 0; font-size: 26rpx; font-weight: 600; color: var(--brand); min-height: 44px; display: inline-flex; align-items: center; }

/* 更多练习 */
.more-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; }
.more-c { margin: 0; padding: 28rpx 30rpx; display: flex; flex-direction: column; }
.more-ico { width: 72rpx; height: 72rpx; border-radius: 18rpx; background: var(--fill); display: flex; align-items: center; justify-content: center; }
.more-t { font-size: 29rpx; font-weight: 600; color: var(--ink); margin-top: 10rpx; }
.more-s { font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }

/* 通用卡片 */
.card { background: var(--card); border-radius: 28rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); margin-bottom: 20rpx; padding: 28rpx 32rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 30rpx 0; }

/* 计划卡（沿用原样式类名） */
.plancard { padding: 22rpx 26rpx; }
.guide { display: flex; align-items: center; gap: 16rpx; background: linear-gradient(120deg, var(--brand-soft), var(--brand-soft)); border: 1rpx solid var(--brand-soft-2); padding: 24rpx 26rpx; }
.guide-l { flex: 1; min-height: 44px; display: flex; flex-direction: column; justify-content: center; }
.guide-t { font-size: 28rpx; font-weight: 600; color: var(--brand); }
.guide-s { font-size: 22rpx; color: var(--ink-2); margin-top: 6rpx; }
.guide-btn { flex-shrink: 0; background: var(--brand); color: #fff; border-radius: 999rpx; padding: 0 26rpx; font-size: 24rpx; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; }
.guide-x { flex-shrink: 0; font-size: 22rpx; color: var(--ink-3); min-height: 44px; display: inline-flex; align-items: center; padding: 0 8rpx; }
.plan-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6rpx; }
.plan-t { font-size: 27rpx; font-weight: 600; color: var(--ink); }
.plan-y { font-size: 21rpx; color: var(--ink-3); }
.plan-hr { display: flex; align-items: center; gap: 14rpx; }
.plan-days { font-size: 21rpx; color: var(--brand); background: var(--brand-soft); border-radius: 999rpx; padding: 4rpx 14rpx; }
.plan-edit { font-size: 22rpx; color: var(--ink-3); min-height: 44px; display: inline-flex; align-items: center; }
.plan-prog { display: flex; align-items: center; gap: 14rpx; margin: 8rpx 0 6rpx; }
.plan-prog-bar { flex: 1; height: 10rpx; background: var(--brand-soft); border-radius: 999rpx; overflow: hidden; }
.plan-prog-fill { height: 100%; background: var(--brand); border-radius: 999rpx; transition: width 0.3s; }
.plan-prog-t { font-size: 21rpx; color: var(--ink-3); flex-shrink: 0; }
.plan-row { display: flex; align-items: center; gap: 14rpx; min-height: 44px; border-top: 1rpx solid var(--line); }
.plan-row:first-of-type { border-top: none; }
.plan-row.task { gap: 16rpx; }
.task-ck { width: 36rpx; height: 36rpx; border-radius: 50%; border: 2rpx solid var(--ink-4); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 22rpx; color: #fff; box-sizing: border-box; }
.task-ck.on { background: #16a34a; border-color: #16a34a; }
.task-main { flex: 1; display: flex; flex-direction: column; padding: 10rpx 0; }
.plan-txt { flex: 1; font-size: 25rpx; color: var(--ink); }
.plan-txt.tdone { color: var(--ink-3); text-decoration: line-through; }
.task-sub { font-size: 21rpx; color: var(--ink-3); margin-top: 4rpx; }
.plan-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: var(--brand); flex-shrink: 0; }
.plan-dot.due { background: #f59e0b; }
.plan-go { font-size: 24rpx; color: var(--brand); flex-shrink: 0; }
.plan-focus { display: flex; align-items: center; gap: 10rpx; flex-wrap: wrap; border-top: 1rpx solid var(--line); padding-top: 14rpx; margin-top: 6rpx; }
.plan-focus-k { font-size: 22rpx; color: var(--ink-3); margin-right: 4rpx; }
.plan-fchip { font-size: 22rpx; color: var(--ink-2); background: var(--fill); border-radius: 999rpx; padding: 0 20rpx; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; }
.plan-fchip.on { background: var(--brand-soft); color: var(--brand); font-weight: 600; }
.pf-input { flex: 1; min-height: 44px; border: 1rpx solid var(--line); border-radius: 12rpx; padding: 0 20rpx; font-size: 26rpx; background: var(--fill); box-sizing: border-box; }
.pf-date { min-height: 44px; display: inline-flex; align-items: center; border: 1rpx solid var(--line); border-radius: 12rpx; padding: 0 24rpx; font-size: 26rpx; color: var(--ink); background: var(--fill); box-sizing: border-box; }
.pf-date.empty { color: var(--ink-3); }
.pf-summary { margin-top: 8rpx; font-size: 23rpx; color: var(--ink-2); background: var(--brand-soft); border-radius: 12rpx; padding: 18rpx 22rpx; }
.pf-back { margin-top: 16rpx; text-align: center; font-size: 24rpx; color: var(--ink-3); min-height: 44px; display: flex; align-items: center; justify-content: center; }

/* 断卡风险提示 */
.riskbar { display: flex; align-items: center; gap: 20rpx; background: var(--warn-soft); border: 1rpx solid #fde68a; padding: 22rpx 26rpx; }
.risk-ico { flex-shrink: 0; display: flex; align-items: center; }
.risk-t { display: block; font-size: 26rpx; font-weight: 600; color: var(--warn); }
.risk-s { display: block; font-size: 22rpx; color: #b45309; margin-top: 4rpx; }
.risk-go { flex-shrink: 0; font-size: 24rpx; font-weight: 600; color: var(--warn); }

/* 公告 */
.ann { display: flex; align-items: flex-start; gap: 14rpx; background: var(--info-soft); border: 1rpx solid #bae6fd; padding: 22rpx 26rpx; }
.ann-c { flex: 1; }
.ann-t { display: block; font-size: 25rpx; font-weight: 600; color: #0369a1; }
.ann-b { display: block; font-size: 22rpx; color: #075985; margin-top: 4rpx; white-space: pre-wrap; }
.ann-x { flex-shrink: 0; display: flex; align-items: center; padding: 4rpx 8rpx; }

/* Sheet */
.mask { position: fixed; inset: 0; background: rgba(23, 24, 28, 0.45); z-index: 30; display: flex; align-items: flex-end; }
.sheet { width: 100%; max-height: 76vh; overflow-y: auto; background: var(--card); border-radius: 40rpx 40rpx 0 0; padding: 12rpx 36rpx calc(36rpx + env(safe-area-inset-bottom)); box-sizing: border-box; box-shadow: 0 -16rpx 48rpx rgba(23, 24, 28, 0.16); }
.grab { width: 72rpx; height: 8rpx; border-radius: 4rpx; background: var(--line); margin: 8rpx auto 16rpx; }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.sheet-t { font-size: 32rpx; font-weight: 700; color: var(--ink); }
.sheet-x { min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; }
.setrow { display: flex; justify-content: space-between; align-items: center; gap: 20rpx; padding: 18rpx 0; }
.set-kwrap { display: flex; flex-direction: column; }
.set-k { font-size: 27rpx; color: var(--ink); font-weight: 500; }
.set-sub { font-size: 21rpx; color: var(--ink-2); margin-top: 2rpx; }
.set-chips { display: flex; gap: 12rpx; flex-wrap: wrap; justify-content: flex-end; }
.set-chips.scrollx { flex-wrap: nowrap; overflow-x: auto; max-width: 65%; }
.set-chip { font-size: 24rpx; color: var(--ink-2); background: var(--soft-bg); border-radius: 999rpx; padding: 0 22rpx; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; white-space: nowrap; }
.set-chip.on { background: var(--brand-soft); color: var(--brand); font-weight: 600; }
:deep(.sheet-cta) { margin-top: 24rpx; width: 100%; border-radius: 20rpx !important; background: linear-gradient(135deg, #5b8af8, var(--brand)) !important; box-shadow: 0 8rpx 24rpx rgba(59, 111, 245, 0.28); font-weight: 600; }
.exp-opts { display: flex; gap: 12rpx; margin-top: 20rpx; }
.expchip { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--line); border-radius: 12rpx; font-size: 24rpx; color: var(--ink-2); background: var(--fill); }
.expchip.on { background: var(--brand-soft); color: var(--brand); border-color: var(--brand-soft-2); font-weight: 500; }
:deep(.sheet-cta2) { margin-top: 16rpx; width: 100%; border-radius: 20rpx !important; }
.custom-note { margin-top: 14rpx; text-align: center; font-size: 21rpx; color: var(--ink-3); }
.pr-scroll { white-space: nowrap; margin-bottom: 12rpx; }
.pr-scroll .set-chip { margin-right: 12rpx; }
.sub-chip { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; padding: 22rpx 8rpx; min-height: 44px; border-top: 1rpx solid var(--line); box-sizing: border-box; }
.sub-chip:first-of-type { border-top: none; }
.sub-chip.all-chip .sub-name { color: var(--brand); font-weight: 600; }
.sub-l { flex: 1; display: flex; flex-direction: column; }
.sub-name { font-size: 27rpx; color: var(--ink); }
.sub-prog { font-size: 21rpx; color: var(--ink-3); margin-top: 4rpx; }
.sub-n { font-size: 23rpx; color: var(--ink-3); flex-shrink: 0; }

/* 宽屏（≥768px）双栏 */
/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.home { max-width: 960px !important; display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; align-items: start; }
  .hero, .sec-h, .ann, .riskbar { grid-column: 1 / -1; }
  .modlist { grid-column: 1; }
  .more-grid { grid-column: 2; grid-template-columns: 1fr 1fr; }
  .card.guide, .card.plancard, .card.szcard, .card.spin { grid-column: 1 / -1; }
  .modrow:hover, .more-c:hover { box-shadow: 0 8rpx 24rpx rgba(23, 24, 28, 0.08); cursor: pointer; }
  .mask { position: fixed; align-items: center; justify-content: center; }
  .sheet { max-width: 520px; border-radius: 28rpx; }
}
/* #endif */
.searchbar { display: flex; align-items: center; gap: 12rpx; background: var(--card); border-radius: 999rpx; padding: 16rpx 26rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04); }
.searchbar-t { font-size: 26rpx; color: var(--ink-3); }
</style>
