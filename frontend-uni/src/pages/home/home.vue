<template>
  <view class="wrap home">
    <!-- 考试切换 + 全局搜索入口 -->
    <view class="toprow">
      <view class="examsw" role="button" hover-class="examsw--hover" @click="openSetup">
        <text class="examsw-t">{{ examLabel }}</text>
        <l-icon :name="profile && profile.exam_type ? 'pencil-line' : 'chevron-down'" :size="16" tone="brand-text" />
      </view>
      <view class="searchbar" role="button" hover-class="searchbar--hover" @click="goSearch">
        <l-icon name="search" :size="16" tone="muted" />
        <text class="searchbar-t">搜题目 / 考点 / 试卷</text>
      </view>
    </view>

    <kg-two-col>
      <template #main>
        <!-- Hero：零作答 = 一句价值 + 1 CTA（可关闭）；有记录 = 今日已练 N/goal + 1 主按钮 + 连签 -->
        <view v-if="showLanding" class="hero-wrap">
          <kg-hero-card
            label="拍题 AI 讲解 · 错题按遗忘曲线复习 · 迷你模考"
            value="10万+"
            unit="行测题免费刷，免注册即练"
            :primary="{ text: '免注册立即开练' }"
            @primary="startDaily"
          />
          <view class="hero-x" role="button" aria-label="关闭" @click="closeLanding"><l-icon name="x" :size="16" tone="on-brand" /></view>
        </view>
        <kg-hero-card
          v-else
          :label="todayCount >= dailyGoal ? '今日已练 · 已达成' : '今日已练'"
          :value="todayCount"
          :total="dailyGoal"
          unit="题"
          :progress="Math.min((todayCount / dailyGoal) * 100, 100)"
          :streak="streakShown"
          :primary="{ text: heroPrimaryText }"
          @primary="heroPrimary"
        >
          <view class="hero-links">
            <text v-if="dsMeta && dsDone" class="hero-ds">今日全站同题 · 答对 {{ dsDone.right }}/{{ dsDone.total }}<template v-if="dsDone.rank"> · 第 {{ dsDone.rank }} 名</template><template v-if="dsDone.streak >= 2"> · 连 {{ dsDone.streak }} 天</template></text>
            <text v-else class="hero-ds">今日全站同题 10 题{{ dsMeta ? ' · ' + (dsMeta.participants ? '已有 ' + dsMeta.participants + ' 人完成' : '来做今天第 1 人') : '' }}</text>
            <view class="hero-lnk-row">
              <text class="hero-lnk" role="button" @click.stop="openDailyArchive">补练往期 ›</text>
              <text v-if="todayCount >= dailyGoal" class="hero-lnk" role="button" @click.stop="openPoster">生成打卡海报 ›</text>
            </view>
          </view>
        </kg-hero-card>

        <!-- 续练/续考/续复习（并入 hero 下方一组，保留放弃确认） -->
        <view v-if="examResume || practiceResume || reviewResume" class="resumes">
          <kg-card v-if="examResume" class="rs" :padding="12">
            <view class="rs-row">
              <view class="rs-main">
                <text class="rs-t">有一场未交卷的模考</text>
                <text class="rs-s">{{ examResume.title }} · 已答 {{ examResume.answered }}/{{ examResume.total }} 题 · 剩余 {{ fmtErLeft(examResume.leftSecs) }}</text>
              </view>
              <kg-button variant="text" size="sm" aria-label="继续未交卷的模考" @click="erContinue">去继续 ›</kg-button>
              <view class="rs-x" role="button" aria-label="放弃未交卷进度" @click="erDrop"><l-icon name="x" :size="16" tone="muted" /></view>
            </view>
          </kg-card>
          <kg-card v-if="practiceResume" class="rs" :padding="12">
            <view class="rs-row">
              <view class="rs-main">
                <text class="rs-t">有一组未做完的练习</text>
                <text class="rs-s">{{ prLabel(practiceResume) }} · 已做 {{ practiceResume.done }}/{{ practiceResume.total }} 题</text>
                <text v-if="practiceResume.snapAt" class="rs-s rs-stale">{{ snapshotProgressNote(practiceResume.snapAt, practiceResume.netOnline) }}</text>
              </view>
              <kg-button variant="text" size="sm" aria-label="继续未做完的练习" @click="prContinue">去继续 ›</kg-button>
              <view class="rs-x" role="button" aria-label="放弃未完成练习" @click="prDrop"><l-icon name="x" :size="16" tone="muted" /></view>
            </view>
          </kg-card>
          <kg-card v-if="reviewResume" class="rs" :padding="12">
            <view class="rs-row">
              <view class="rs-main">
                <text class="rs-t">有一次未完成的错题复习</text>
                <text class="rs-s">中断在第 {{ reviewResume.rIdx + 1 }}/{{ reviewResume.items.length }} 题</text>
              </view>
              <kg-button variant="text" size="sm" aria-label="继续未完成的错题复习" @click="rvContinue">去继续 ›</kg-button>
              <view class="rs-x" role="button" aria-label="放弃未完成复习" @click="rvDrop"><l-icon name="x" :size="16" tone="muted" /></view>
            </view>
          </kg-card>
        </view>

        <!-- 回访召回 / 打卡提醒 / 断卡风险 / 公告：统一横幅 -->
        <view v-if="comeback" class="strip">
          <kg-banner tone="ok" icon="sprout" :text="'欢迎回来！你已累计练 ' + comeback.total + ' 题，上次练习是 ' + comeback.gap + ' 天前'" action-text="看周报" @action="cbWeekly" @close="comeback = null" />
        </view>
        <view v-if="announce === undefined" class="strip"><kg-skeleton preset="banner" /></view>
        <view v-else-if="announce" class="strip">
          <kg-banner tone="info" icon="megaphone" :text="announce.title" :action-text="announce.body && !annOpen ? '详情' : ''" @action="annOpen = true" @close="dismissAnn" />
          <text v-if="annOpen && announce.body" class="ann-body">{{ announce.body }}</text>
        </view>

        <!-- 今日待办：到期复习 / 未打卡 / 断卡风险聚合成一张卡，不再多张促练横幅叠罗汉 -->
        <kg-card v-if="todoRows.length" class="sec todo" variant="soft">
          <kg-section-header title="今日待办" />
          <view v-for="t in todoRows" :key="t.k" class="todo-row" role="button" @click="t.go()">
            <view class="todo-ico"><l-icon :name="t.icon" :size="18" :tone="t.tone" /></view>
            <view class="grow">
              <text class="todo-t">{{ t.t }}</text>
              <text v-if="t.s" class="todo-s">{{ t.s }}</text>
            </view>
            <view v-if="t.dismiss" class="todo-x" role="button" :aria-label="'忽略' + t.t" @click.stop="t.dismiss()"><l-icon name="x" :size="14" tone="faint" /></view>
            <l-icon v-else name="chevron-right" :size="16" tone="faint" />
          </view>
        </kg-card>

        <!-- 学习计划（三入口合一：未制定→去制定 / 已制定→今日任务 / 无画像→今日建议） -->
        <kg-card v-if="!profileFetched && planSkel" class="sec plan"><kg-skeleton preset="plan" :rows="planSkelRows" /></kg-card>
        <kg-card v-else-if="profileFetched && profile === null && !guideHide" class="sec plan">
          <kg-section-header title="学习计划">
            <template #right><kg-button variant="text" size="sm" @click="skipGuide">跳过</kg-button></template>
          </kg-section-header>
          <text class="plan-s">按考试日期倒排每日任务：专项练习 + 错题复习 + 每周模考</text>
          <kg-button variant="primary" size="lg" block @click="openSetup">制定我的学习计划</kg-button>
        </kg-card>
        <kg-card v-else-if="planToday && planToday.profile" class="sec plan">
          <kg-section-header title="学习计划" more="编辑" @more="openSetup" />
          <text v-if="planDaysText" class="plan-s">{{ planDaysText }}</text>
          <view class="plan-prog">
            <kg-progress :value="planToday.progress.done" :max="planToday.progress.total || 1" :thickness="4" class="grow" aria-label="今日计划进度" />
            <text class="plan-prog-t num">{{ planToday.progress.done }}/{{ planToday.progress.total }}</text>
          </view>
          <view v-for="t in planToday.tasks" :key="t.key" class="task" :class="{ 'is-done': t.done }" role="button" hover-class="task--hover" @click="goTask(t)">
            <l-icon :name="t.done ? 'circle-check' : 'target'" :size="20" :tone="t.done ? 'ok' : 'brand'" />
            <view class="grow task-main">
              <text class="task-t">{{ t.title }}</text>
              <text class="task-s">{{ t.sub }}<template v-if="t.type !== 'mock' && t.done_n"> · 已完成 {{ t.done_n }}/{{ t.target }}</template></text>
            </view>
            <text class="task-go">{{ t.done ? '已完成' : t.type === 'mock' ? '去模考 ›' : t.type === 'review' ? '去复习 ›' : t.type === 'reinforce' ? '去强化 ›' : '去练 ›' }}</text>
          </view>
          <view class="focus">
            <text class="focus-k">今天主攻</text>
            <kg-chip-row size="sm" :options="focusOptions" :model-value="(plan && plan.focus) || ''" :scroll-to-selected="false" @update:model-value="setFocus" />
          </view>
        </kg-card>
        <kg-card v-else-if="plan && (plan.due_mistakes || (plan.weak || []).length || (plan.yesterday || {}).n)" class="sec plan">
          <kg-section-header title="今天做什么">
            <template #right>
              <text v-if="(plan.yesterday || {}).n" class="plan-y">昨日练 {{ plan.yesterday.n }} 题 · 正确率 {{ Math.round((plan.yesterday.correct / plan.yesterday.n) * 100) }}%</text>
              <text v-else class="plan-y">昨日未练习</text>
            </template>
          </kg-section-header>
          <view v-if="plan.due_mistakes" class="task" role="button" hover-class="task--hover" @click="goBook">
            <l-icon name="rotate-ccw" :size="20" tone="warn" />
            <text class="grow task-t">先复习到期错题 {{ plan.due_mistakes }} 道</text>
            <text class="task-go">去复习 ›</text>
          </view>
          <view v-for="w in plan.weak || []" :key="w.module + w.submodule + (w.tag3 || '')" class="task" role="button" hover-class="task--hover" @click="startPreset(w.module, w.submodule, 10, true, w.tag3 || null, 'reco')">
            <l-icon name="target" :size="20" tone="brand" />
            <text class="grow task-t">{{ w.label || w.submodule }}（{{ w.reason }} · 正确率 {{ Math.round(w.acc * 100) }}%）</text>
            <text class="task-go">练 10 题 ›</text>
          </view>
          <view class="focus">
            <text class="focus-k">今天主攻</text>
            <kg-chip-row size="sm" :options="focusOptions" :model-value="plan.focus || ''" :scroll-to-selected="false" @update:model-value="setFocus" />
          </view>
        </kg-card>

        <!-- 专项练习：五模块 + 时政 + 随机 -->
        <kg-section-header title="专项练习" more="练习设置" class="sec-h" @more="customOpen = true" />
        <view v-if="!counts.length" class="skelwrap" @click="loadCounts">
          <kg-skeleton preset="cards" />
          <text class="skel-hint">题库加载中…点此重试</text>
        </view>
        <view v-else class="modlist">
          <kg-module-card v-for="c in modCounts" :key="c.module" :module="c.module" :progress="modProgress(c)" :sub="modSub(c)" @click="openModule(c.module)" />
          <kg-card clickable chevron class="modrow" @click="szTodayDone ? launch({ kind: 'szreview' }) : launch({ kind: 'shizheng' })">
            <view class="modrow-in">
              <view class="modrow-ico is-warn"><l-icon name="newspaper" :size="24" tone="warn" /></view>
              <view class="grow">
                <view class="modrow-tr">
                  <text class="modrow-t">时政每日一练</text>
                  <kg-tag v-if="!szTodayDone" tone="warn">今日更新</kg-tag>
                  <kg-tag v-else tone="ok">已完成</kg-tag>
                </view>
                <text class="modrow-s">每日 10 题 · 全站同题<text class="modrow-lnk" @click.stop="openSzArchive"> · 往期 ›</text></text>
              </view>
            </view>
          </kg-card>
          <kg-card clickable chevron class="modrow" @click="startPreset(null)">
            <view class="modrow-in">
              <view class="modrow-ico"><l-icon name="shuffle" :size="24" tone="brand" /></view>
              <view class="grow">
                <text class="modrow-t">随机混合刷题</text>
                <text class="modrow-s">全部模块随机 · 每组 {{ groupSize }} 题</text>
              </view>
            </view>
          </kg-card>
          <kg-card v-if="weakModule" variant="soft" clickable chevron class="modrow" @click="openModule(weakModule)">
            <view class="modrow-in">
              <view class="modrow-ico"><l-icon name="zap" :size="24" tone="brand" /></view>
              <view class="grow">
                <text class="modrow-t">按弱项出题</text>
                <text class="modrow-s">你的 {{ modName(weakModule) }} 正确率较低，建议专项练习</text>
              </view>
            </view>
          </kg-card>
        </view>
      </template>

      <template #aside>
        <!-- 更多练习：4 格 -->
        <kg-section-header title="更多练习" class="sec-h" />
        <view class="more-grid">
          <kg-card clickable class="more-c" @click="goExamList">
            <view class="more-ico"><l-icon name="timer" :size="24" tone="brand" /></view>
            <text class="more-t">模考</text>
            <text class="more-s">迷你 / 全真 · 成绩报告</text>
          </kg-card>
          <kg-card clickable class="more-c" @click="goShenlun">
            <view class="more-ico"><l-icon name="pen-line" :size="24" tone="brand" /></view>
            <text class="more-t">申论</text>
            <text class="more-s">真题 + AI 采分点批改</text>
          </kg-card>
          <kg-card clickable class="more-c" @click="goBook">
            <view class="more-ico"><l-icon name="rotate-ccw" :size="24" tone="brand" /></view>
            <text class="more-t">错题重练</text>
            <text class="more-s">遗忘曲线 · 今日复习</text>
          </kg-card>
          <kg-card clickable class="more-c" @click="goAsk">
            <view class="more-ico"><l-icon name="camera" :size="24" tone="brand" /></view>
            <text class="more-t">拍题讲解</text>
            <text class="more-s">花生十三方法体系</text>
          </kg-card>
        </view>

        <!-- 周学习报告 -->
        <kg-card clickable chevron class="weekly" @click="goWeeklyReport">
          <view class="modrow-in">
            <view class="modrow-ico"><l-icon name="calendar-check" :size="24" tone="brand" /></view>
            <view class="grow">
              <view class="modrow-tr">
                <text class="modrow-t">周学习报告</text>
                <view v-if="weeklyDot" class="dot" />
              </view>
              <text class="modrow-s">每周一生成 · 回顾上周 · 规划下周</text>
            </view>
          </view>
        </kg-card>

        <!-- 连签摘要（≥1024 辅栏，窄屏在流末） -->
        <kg-card clickable chevron class="streak" @click="goCalendar">
          <view class="modrow-in">
            <kg-streak-badges :days="streakShown" />
            <view class="grow">
              <text class="modrow-t">连续打卡</text>
              <text v-if="nextMilestone" class="modrow-s">再打卡 {{ nextMilestone.left }} 天解锁「{{ nextMilestone.days }} 天」徽章</text>
              <text v-else class="modrow-s">已解锁全部打卡徽章，太强了！</text>
            </view>
          </view>
          <kg-progress v-if="nextMilestone" :value="nextMilestone.pct" :thickness="4" class="streak-bar" aria-label="距下一个徽章" />
        </kg-card>
      </template>
    </kg-two-col>

    <!-- 练习设置 sheet -->
    <kg-sheet v-model="customOpen" title="练习设置">
      <view class="setrow">
        <view class="set-kwrap"><text class="set-k">每日目标</text><text class="set-sub">今天合计要练的题数</text></view>
        <kg-chip-row size="sm" :options="goalOptions" :model-value="dailyGoal" :scroll-to-selected="false" @update:model-value="setGoal" />
      </view>
      <view class="setrow">
        <text class="set-k">选题来源</text>
        <kg-chip-row size="sm" :options="[{ label: '题库模式', value: 0 }, { label: '真题模式', value: 1 }]" :model-value="realMode ? 1 : 0" :scroll-to-selected="false" @update:model-value="(v) => setReal(!!v)" />
      </view>
      <view v-if="realMode && realYears.length" class="setrow">
        <text class="set-k">真题年份</text>
        <kg-chip-row size="sm" :options="[{ label: '全部', value: '' }].concat(realYears.map((y) => ({ label: String(y.y), value: y.y })))" :model-value="realYear || ''" @update:model-value="(v) => setRealYear(v || null)" />
      </view>
      <view v-if="realMode && realRegions.length" class="setrow">
        <text class="set-k">真题地区</text>
        <kg-chip-row size="sm" :options="[{ label: '全部', value: '' }].concat(realRegions.map((r) => ({ label: r.r, value: r.r })))" :model-value="realRegion || ''" @update:model-value="(v) => setRealRegion(v || null)" />
      </view>
      <view class="setrow">
        <view class="set-kwrap"><text class="set-k">每组题量</text><text class="set-sub">单次练习连做几道</text></view>
        <kg-chip-row size="sm" :options="groupOptions" :model-value="groupSize" :scroll-to-selected="false" @update:model-value="setGroup" />
      </view>
      <text class="custom-note">以上设置同样作用于模块列表；模考与真题卷不受影响</text>
      <template #footer>
        <view class="sheet-acts">
          <kg-button variant="primary" size="lg" block @click="customOpen = false; startPreset(null)">按以上设置开始练习（混合模块）</kg-button>
          <kg-button variant="secondary" size="lg" block :loading="exporting" @click="exportConfirm = true">{{ exporting ? '正在生成 PDF…' : '导出为试卷 PDF' }}</kg-button>
        </view>
      </template>
    </kg-sheet>

    <export-confirm
      :visible="exportConfirm"
      :scope="(realMode ? '真题精选卷' : '练习卷') + '（混合模块）'"
      :count="groupSize || 20"
      :busy="exporting"
      above-tabbar
      @close="exportConfirm = false"
      @confirm="exportPaper"
    />

    <!-- 制定学习计划 wizard：抽成 PlanSetupSheet 组件，saved 后刷新计划卡 -->
    <plan-setup-sheet v-model="setupOpen" :profile="profile" @saved="onPlanSaved" />

    <!-- 选二级题型 sheet -->
    <kg-sheet :model-value="!!subSelect" :title="modName(subSelect) + ' · 选择题型'" @update:model-value="(v) => { if (!v) subSelect = null; }">
      <view class="sub-list">
        <kg-card clickable chevron class="sub-chip is-all" @click="startPreset(subSelect)">
          <view class="sub-row">
            <text class="sub-name">全部随机</text>
            <text class="sub-n num">{{ (counts.find((c) => c.module === subSelect) || {}).n || 0 }} 题</text>
          </view>
        </kg-card>
        <kg-card v-for="s in submodules" :key="s.submodule" clickable chevron class="sub-chip" @click="startPreset(subSelect, s.submodule)">
          <view class="sub-row">
            <view class="grow">
              <text class="sub-name">{{ s.submodule }}</text>
              <text v-if="subProg[s.submodule]" class="sub-prog">已做 {{ subProg[s.submodule].n }} 题 · 正确率 {{ Math.round((100 * subProg[s.submodule].c) / subProg[s.submodule].n) }}%</text>
            </view>
            <text class="sub-n num">{{ s.n }} 题</text>
          </view>
        </kg-card>
      </view>
    </kg-sheet>
  </view>
</template>

<script>
import { request, snapPeek, anonUid, exportPdf, trackEvent, fetchCheckinBadges, fetchCheckinSummary, flushDailySubmit, isStaleUidErr, staleAt } from '../../api.js';
import { snapshotProgressNote, netOnlineNow } from '../../snapshot-notice.js';
import { checkinStreak, dayKey, loadSzDaily } from '../../checkin.js';
import { parseExamProgress, fmtLeftSecs } from '../../exam-resume.js';
import { setBookBadge } from '../../tabbar-badge.js';
import { adoptServerExamProgress } from '../../exam-progress-sync.js';
import { parsePendingPractice, parseRemotePractice, markRemoteResume, dailyPendingTitle, cnDayOf, REDO_PENDING_TITLE } from '../../practice-progress.js';
import { parseReviewSnap } from '../../review-snap.js';
import { adoptServerDailyGoal } from '../../daily-goal.js';
import { adoptServerPracticePrefs } from '../../practice-prefs.js';
import { planDaysLabel, planCardMark } from '../../plan-days-label.js';
import { MODULE_KEYS, moduleLabel } from '../../module-meta.js';
import { todayShown } from '../../home-today.js';

// module-meta.js 只含行测五模块；申论不是练习模块但会出现在续练/薄弱项文案里
const EXTRA_NAMES = { shenlun: '申论' };
const modLabel = (m) => (MODULE_KEYS.includes(m) ? moduleLabel(m) : EXTRA_NAMES[m] || '');

export default {
  data() {
    return {
      counts: [],
      subSelect: null,
      customOpen: false,
      exporting: false,
      exportConfirm: false,
      plan: null,
      planFetched: false,
      profile: undefined,
      profileFetched: false,
      planSkel: uni.getStorageSync('homePlanCard') || !uni.getStorageSync('planGuideHide'),
      planSkelRows: Number(uni.getStorageSync('homePlanCard')) || 0,
      planToday: null,
      guideHide: uni.getStorageSync('planGuideHide') ? true : false,
      landingHide: uni.getStorageSync('landingHide') ? true : false,
      setupOpen: false,
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
      announce: undefined,
      annOpen: false,
      badgeInfo: null,
      svTodayN: null,
      svLocalAtSync: 0,
      weeklyDot: false,
      comeback: null,
      reminderBanner: false,
      examResume: null,
      practiceResume: null,
      reviewResume: null,
      dsMeta: null,
      dsDone: null,
    };
  },
  computed: {
    modCounts() {
      return this.counts.filter((c) => MODULE_KEYS.includes(c.module));
    },
    focusOptions() {
      return MODULE_KEYS.map((k) => ({ label: moduleLabel(k), value: k }));
    },
    planDaysText() {
      return this.planToday ? planDaysLabel(this.planToday.days_left, this.planToday.phase_name) : '';
    },
    goalOptions() {
      return [20, 50, 100].map((g) => ({ label: g + ' 题', value: g }));
    },
    groupOptions() {
      return [10, 20, 30, 50].map((n) => ({ label: String(n), value: n }));
    },
    showLanding() {
      if (this.landingHide) return false;
      return !Object.keys((this.pstats && this.pstats.days) || {}).length;
    },
    examLabel() {
      if (this.profile && this.profile.exam_type) {
        return this.profile.exam_type + (this.profile.target_region ? ' · ' + this.profile.target_region : '');
      }
      return '选择考试';
    },
    dueReview() {
      return (this.plan && this.plan.due_mistakes) || 0;
    },
    todayLocal() {
      const days = (this.pstats && this.pstats.days) || {};
      return days[dayKey()] || 0;
    },
    todayCount() {
      // 服务端 answer_log（Asia/Shanghai 日界，按当前 uid）为准，叠加本机自上次 summary 以来的增量；
      // 本地 pstats 不分身份，仅在服务端未返回（离线）时单独使用
      return todayShown(this.svTodayN, this.svLocalAtSync, this.todayLocal);
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
      return !!this.daily.days[dayKey()];
    },
    // 今日同题本机有未做完快照时，hero 主按钮与续练卡同一落点（startDaily 会接着做），文案直说待续题号
    dailyPendingToday() {
      const r = this.practiceResume;
      return r && r.daily && !r.daily.past && r.daily.date === cnDayOf(Date.now()) ? r : null;
    },
    heroPrimaryText() {
      if (this.todayDone) return '再练 10 题';
      const r = this.dailyPendingToday;
      return r ? '继续今日一练 · 第 ' + (r.done + 1) + '/' + r.total + ' 题' : '继续目标';
    },
    szTodayDone() {
      return !!this.szDaily.days[dayKey()];
    },
    dailyModule() {
      const mods = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi'];
      const key = dayKey();
      let h = 0;
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      return mods[h % mods.length];
    },
    streakRisk() {
      const days = (this.pstats && this.pstats.days) || {};
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yKey = dayKey(y);
      const yN = days[yKey] || 0;
      if (this.todayCount >= this.dailyGoal) return null;
      if (!yN) {
        // 昨天完全没练：若之前有打卡记录，提示找回节奏
        const d2 = new Date();
        d2.setDate(d2.getDate() - 2);
        if (!days[dayKey(d2)]) return null;
        return { title: '昨天没打卡，连续记录中断了', sub: `今天练 ${this.dailyGoal} 题，重新出发不掉队` };
      }
      if (yN < this.dailyGoal) {
        return { title: `昨天只练了 ${yN}/${this.dailyGoal} 题，未达标`, sub: '今天补上进度，守住你的连续打卡' };
      }
      return null;
    },
    // 今日待办聚合：到期复习 > 断卡风险 > 未打卡提醒，单行可点直达；未打卡可单独忽略
    todoRows() {
      const rows = [];
      if (this.dueReview) {
        rows.push({ k: 'review', icon: 'calendar-check', tone: 'warn', t: '到期复习 ' + this.dueReview + ' 题', s: '按遗忘曲线安排 · 越拖越容易忘', go: () => this.goReview('home_card') });
      }
      if (this.streakRisk) {
        rows.push({ k: 'risk', icon: 'flame', tone: 'warn', t: this.streakRisk.title, s: this.streakRisk.sub, go: () => this.startDaily() });
      }
      if (this.reminderBanner) {
        rows.push({ k: 'checkin', icon: 'flame', tone: 'warn', t: '今天还没打卡', s: '练 1 题即可保住连续打卡', go: () => this.rmGo(), dismiss: () => { this.reminderBanner = false; } });
      }
      return rows;
    },
    dailyStreak() {
      return checkinStreak(this.pstats);
    },
    streakShown() {
      if (this.badgeInfo && this.badgeInfo.streak != null) return this.badgeInfo.streak;
      return this.dailyStreak;
    },
    nextMilestone() {
      const ms = [3, 7, 14, 30, 60, 100];
      const s = this.streakShown;
      const next = ms.find((m) => m > s);
      if (!next) return null;
      const prev = ms.filter((m) => m <= s).pop() || 0;
      return { days: next, left: next - s, pct: Math.round(((s - prev) / (next - prev)) * 100) };
    },
  },
  onLoad() {
    this._onAuth = () => {
      if (anonUid() === this._acctUid) return;
      this.resetAccountState();
    };
    uni.$on('authChanged', this._onAuth);
  },
  onUnload() {
    if (this._onAuth) uni.$off('authChanged', this._onAuth);
  },
  onShow() {
    this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
    this.daily = uni.getStorageSync('dailyPlan') || { days: {} };
    this.groupSize = uni.getStorageSync('groupSize') || 10;
    this.dailyGoal = uni.getStorageSync('dailyGoal') || 20;
    if (!this.counts.length) this.counts = uni.getStorageSync('countsSnap') || [];
    this.loadCounts();
    this.prefetchNext();
    this.loadAnnounce();
    this.calcWeeklyDot();
    this.checkComeback();
    this.checkReminder();
    this.loadDailySet();
    flushDailySubmit().then((ok) => {
      if (ok) this.syncDsDone();
    });
    const wantSetup = uni.getStorageSync('openPlanSetup');
    if (wantSetup) {
      uni.removeStorageSync('openPlanSetup');
      // 立即弹出设置，不等 profile 请求返回（返回后表单会回填已有值）
      this.openSetup();
    }
    this.refreshAccountData().then(() => {
      if (wantSetup && this.setupOpen && this.profile) this.openSetup();
    });
    if (this.realMode) this.loadRealFilters();
  },
  methods: {
    // 账号（uid）专属数据统一从这里拉：onShow 与登录态变化（authChanged）共用
    refreshAccountData() {
      this._acctUid = anonUid();
      this.szDaily = loadSzDaily(this._acctUid);
      this.loadExamResume();
      this.loadPracticeResume();
      this.loadReviewResume();
      this.syncDsDone();
      return this.loadHome();
    },
    resetAccountState() {
      this.plan = null;
      this.planFetched = false;
      this.planToday = null;
      this.profile = undefined;
      this.profileFetched = false;
      this.badgeInfo = null;
      this.svTodayN = null;
      this.svLocalAtSync = 0;
      this.dsDone = null;
      this.refreshAccountData();
    },
    closeLanding() {
      this.landingHide = true;
      uni.setStorageSync('landingHide', 1);
    },
    goTiku() {
      // #ifdef H5
      window.location.href = '/tiku/';
      // #endif
    },
    loadDailySet() {
      // 全站同题题组：首页外显参与数 + 预取题组供 startDaily 秒开（边缘缓存 60s）
      request('/api/daily_set')
        .then((d) => {
          if (!d || !d.date || !(d.items || []).length) return;
          this.dsMeta = { date: d.date, participants: (d.stats && d.stats.participants) || 0 };
          this.syncDsDone();
          uni.setStorageSync('dailySet', d);
        })
        .catch(() => {});
    },
    syncDsDone() {
      if (!this.dsMeta) return;
      const done = uni.getStorageSync('dailyDone:' + anonUid());
      this.dsDone = done && done.date === this.dsMeta.date ? done : null;
    },
    goSearch() {
      uni.navigateTo({ url: '/pkgA/search/search' });
    },
    openPoster() {
      uni.navigateTo({ url: '/pkgA/social/poster' });
    },
    goCalendar() {
      uni.navigateTo({ url: '/pages/stats/calendar' });
    },
    modName(m) {
      return modLabel(m) || m || '未知';
    },
    modStat(m) {
      return this.pstats.byModule[m] || { done: 0, correct: 0 };
    },
    /** KgModuleCard progress：{done,total,acc}；未开始/题数未知时返回 null 走 sub 文案 */
    modProgress(c) {
      const s = this.modStat(c.module);
      if (!c.n || !s.done) return null;
      return { done: s.done, total: c.n, acc: Math.round((s.correct / s.done) * 100) };
    },
    modSub(c) {
      const s = this.modStat(c.module);
      if (!c.n && !s.done) return '题库加载中…';
      if (!s.done) return '共 ' + c.n + ' 题 · 未开始';
      return '';
    },
    prefetchNext() {
      this.prefetchModule(uni.getStorageSync('lastModule') || '');
    },
    prefetchModule(module) {
      // 预取题包：进刷题页命中时零等待开练（真题/资料分析分组参数不同，不预取）
      if (this.realMode) return;
      if (module === 'ziliao') return;
      const limit = this.groupSize || 10;
      const uid = anonUid() || '';
      const pk = uni.getStorageSync('prefetchPack');
      if (pk && pk.module === module && pk.limit === limit && pk.uid === uid && Date.now() - pk.ts < 5 * 60 * 1000) return;
      request(
        '/api/questions?limit=' + limit + (uid ? '&uid=' + encodeURIComponent(uid) + '&mix_due=1' : '') +
          (module ? '&module=' + module : ''),
        { timeout: 15000 }
      )
        .then((d) => {
          if (d.items && d.items.length) uni.setStorageSync('prefetchPack', { module, limit, uid, items: d.items, ts: Date.now() });
        })
        .catch(() => {});
    },
    launch(payload) {
      uni.setStorageSync('practiceLaunch', payload);
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    startPreset(module, submodule, count, adaptive, tag3, source) {
      this.subSelect = null;
      this.launch({ kind: 'start', module: module || null, submodule: submodule || null, count: count || null, adaptive: !!adaptive, tag3: tag3 || null, source: source || null });
    },
    startDaily() {
      this.launch({ kind: 'daily' });
    },
    // 今日同题已完成后出普通一组新题（daily_set 按日固定，重进是同 10 题；重做走「补练往期」）
    heroPrimary() {
      if (this.todayDone) this.startPreset(this.dailyModule, null, 10, false, null, 'home_hero');
      else this.startDaily();
    },
    openSzArchive() {
      this.pickArchiveDay((d) => {
        trackEvent('daily_archive_open', 'sz:' + d);
        this.launch({ kind: 'shizheng', date: d });
      });
    },
    openDailyArchive() {
      // 近 7 天往期每日一练（补练不计成绩/streak，复用 R78 往期链路）
      this.pickArchiveDay((d) => {
        trackEvent('daily_archive_open', d);
        this.launch({ kind: 'daily', date: d });
      });
    },
    pickArchiveDay(cb) {
      const days = [];
      for (let i = 1; i <= 7; i++) {
        days.push(new Date(Date.now() + 8 * 3600e3 - i * 86400e3).toISOString().slice(0, 10));
      }
      uni.showActionSheet({
        itemList: days.map((d, i) => d + (i === 0 ? '（昨天）' : i === 1 ? '（前天）' : '')),
        success: (res) => cb(days[res.tapIndex]),
      });
    },
    goMini() {
      uni.navigateTo({ url: '/pkgA/exam/exam?mini=1' });
    },
    goExamList() {
      uni.navigateTo({ url: '/pkgA/exam/list' });
    },
    goWeeklyReport() {
      uni.navigateTo({ url: '/pkgA/stats/weekly-report' });
    },
    loadPracticeResume() {
      const local = parsePendingPractice(uni.getStorageSync('pendingSession'), Date.now());
      if (local) {
        this.practiceResume = local;
        return;
      }
      this.practiceResume = null;
      const clearedAt = uni.getStorageSync('ppClearedAt');
      if (clearedAt && Date.now() - clearedAt < 30 * 1000) return;
      request('/api/practice/resume?uid=' + encodeURIComponent(anonUid()))
        .then((d) => {
          this.practiceResume = markRemoteResume(parseRemotePractice(d), staleAt(d), netOnlineNow());
        })
        .catch(() => {});
    },
    snapshotProgressNote(snapAt, online) {
      return snapshotProgressNote(snapAt, online);
    },
    prModName(m) {
      return modLabel(m) || '上次练习';
    },
    prLabel(r) {
      if (r.ptitle) return r.ptitle;
      if (r.redo) return REDO_PENDING_TITLE;
      if (r.daily) return dailyPendingTitle(r.daily);
      return this.prModName(r.module);
    },
    prContinue() {
      uni.setStorageSync('practiceLaunch', { kind: 'resume' });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    loadReviewResume() {
      const uid = anonUid();
      const local = parseReviewSnap(uni.getStorageSync('reviewSnap'), uid, Date.now() / 1000);
      if (local) {
        this.reviewResume = local;
        return;
      }
      this.reviewResume = null;
      const clearedAt = uni.getStorageSync('rvClearedAt');
      if (clearedAt && Date.now() - clearedAt < 30 * 1000) return;
      request('/api/review/cur?uid=' + encodeURIComponent(uid))
        .then((r) => {
          this.reviewResume = parseReviewSnap(r && r.snap, uid, Date.now() / 1000);
        })
        .catch(() => {});
    },
    rvContinue() {
      trackEvent('home_review_resume_click', 'home');
      uni.setStorageSync('bookReviewIntent', 1);
      uni.switchTab({ url: '/pages/book/book' });
    },
    rvDrop() {
      uni.showModal({
        title: '放弃未完成复习？',
        content: '放弃后这轮复习的进度不再保留',
        confirmText: '放弃',
        cancelText: '再想想',
        success: (res) => {
          if (!res.confirm) return;
          uni.removeStorageSync('reviewSnap');
          uni.setStorageSync('rvClearedAt', Date.now());
          request('/api/review/cur', { method: 'POST', data: { uid: anonUid(), snap: null } }).catch(() => {});
          this.reviewResume = null;
        },
      });
    },
    prDrop() {
      uni.showModal({
        title: '放弃未完成练习？',
        content: '放弃后这组题的作答进度不再保留',
        confirmText: '放弃',
        cancelText: '再想想',
        success: (res) => {
          if (!res.confirm) return;
          uni.removeStorageSync('pendingSession');
          uni.setStorageSync('ppClearedAt', Date.now());
          request('/api/practice/progress', { method: 'POST', data: { uid: anonUid(), qids: [] } }).catch(() => {});
          this.practiceResume = null;
        },
      });
    },
    loadExamResume() {
      const saved = uni.getStorageSync('examProgress');
      this.examResume = parseExamProgress(saved, Date.now());
      if (saved && saved.attemptId && !this.examResume) uni.removeStorageSync('examProgress');
      if (!this.examResume) this.syncExamResume();
    },
    async syncExamResume() {
      const clearedAt = uni.getStorageSync('erClearedAt');
      if (clearedAt && Date.now() - clearedAt < 30 * 1000) return;
      try {
        const d = await request('/api/exam/resume?uid=' + encodeURIComponent(anonUid()));
        const now = Date.now();
        const snap = adoptServerExamProgress(uni.getStorageSync('examProgress'), d, now);
        if (!snap) return;
        uni.setStorageSync('examProgress', snap);
        this.examResume = parseExamProgress(snap, now);
      } catch (e) { /* 非关键路径 */ }
    },
    erContinue() {
      const r = this.examResume;
      if (!r) return;
      uni.navigateTo({ url: r.mini ? '/pkgA/exam/exam?mini=1' : '/pkgA/exam/exam?paper_id=' + r.paperId });
    },
    erDrop() {
      uni.showModal({
        title: '放弃未交卷进度？',
        content: '放弃后本次作答记录不再保留',
        confirmText: '放弃',
        cancelText: '再想想',
        success: (res) => {
          if (!res.confirm) return;
          uni.setStorageSync('erClearedAt', Date.now());
          if (this.examResume && this.examResume.attemptId) {
            request('/api/exam/progress', { method: 'POST', data: { uid: anonUid(), attempt_id: this.examResume.attemptId, drop: true } }).catch(() => {});
          }
          uni.removeStorageSync('examProgress');
          this.examResume = null;
        },
      });
    },
    fmtErLeft(s) {
      return fmtLeftSecs(s);
    },
    checkComeback() {
      const days = (this.pstats && this.pstats.days) || {};
      const keys = Object.keys(days).filter((k) => days[k] > 0).sort();
      if (!keys.length) return;
      const todayKey = dayKey();
      const last = keys[keys.length - 1];
      if (last >= todayKey) return;
      const gap = Math.round((new Date(todayKey) - new Date(last)) / 86400000);
      if (gap < 7) return;
      if (uni.getStorageSync('comebackShown') === todayKey) return;
      const total = keys.reduce((s, k) => s + (days[k] || 0), 0);
      this.comeback = { gap, total };
      uni.setStorageSync('comebackShown', todayKey);
      trackEvent('comeback_view', 'home');
    },
    cbWeekly() {
      this.comeback = null;
      this.goWeeklyReport();
    },
    checkReminder() {
      // 今日已练/非傍晚/今天已展示过/新用户（无历史记录）均不打扰
      if (this.todayCount > 0) return;
      if (new Date().getHours() < 18) return;
      const days = (this.pstats && this.pstats.days) || {};
      if (!Object.keys(days).some((k) => days[k] > 0)) return;
      const todayKey = dayKey();
      if (uni.getStorageSync('reminderShown') === todayKey) return;
      this.reminderBanner = true;
      uni.setStorageSync('reminderShown', todayKey);
    },
    rmGo() {
      this.reminderBanner = false;
      trackEvent('reminder_banner_click', 'home');
      this.startDaily();
    },
    calcWeeklyDot() {
      // 周一至周三未读上周周报时显示红点
      const now = new Date();
      const dow = now.getDay();
      if (dow < 1 || dow > 3) {
        this.weeklyDot = false;
        return;
      }
      const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastWs = Math.floor(day0.getTime() / 1000) - ((dow + 6) % 7) * 86400 - 7 * 86400;
      this.weeklyDot = uni.getStorageSync('weeklyReadWs') !== lastWs;
    },
    goShenlun() {
      uni.navigateTo({ url: '/pkgA/shenlun/shenlun' });
    },
    goBook() {
      uni.switchTab({ url: '/pages/book/book' });
    },
    goReview(src) {
      trackEvent('review_entry_click', src);
      uni.setStorageSync('autoStartReview', 1);
      uni.switchTab({ url: '/pages/book/book' });
    },
    async loadBadges(localAtReq) {
      try {
        this.badgeInfo = await fetchCheckinBadges();
      } catch (e) { /* 非关键路径 */ }
      try {
        this.applySummary(await fetchCheckinSummary(), localAtReq);
      } catch (e) { /* 非关键路径 */ }
    },
    // localAtReq：发请求时的本机今日数，作为之后本地增量的基线
    applySummary(d, localAtReq) {
      if (d && d.today_n != null) {
        this.svTodayN = d.today_n;
        this.svLocalAtSync = localAtReq;
        if (d.today_n > 0) this.reminderBanner = false;
      }
    },
    // 首屏 uid 专属数据聚合拉取：bundle 一次取齐 plan/profile/plan_today/badges/summary，
    // 失败时回退逐个端点（旧后端/部署窗口兼容）
    async loadHome() {
      const uid = anonUid();
      if (!uid) return;
      const p = '/api/home_bundle?uid=' + encodeURIComponent(uid);
      const snap = snapPeek(p);
      if (snap) this.applyBundle(snap, true);
      const localAtReq = this.todayLocal;
      try {
        this.applyBundle(await request(p), false, localAtReq);
      } catch (e) {
        if (isStaleUidErr(e)) return;
        this.loadPlan();
        this.loadBadges(localAtReq);
        await this.loadProfile();
      }
    },
    // stale=true 为快照即显：跳过日界敏感的 summary（今日刷题数/提醒横幅），防昨日快照误报今日进度
    applyBundle(d, stale, localAtReq) {
      this.applyPlan(d.plan);
      if (d.badges) this.badgeInfo = d.badges;
      if (!stale) this.applySummary(d.summary, localAtReq);
      this.profile = d.profile || null;
      this.profileFetched = true;
      const g = adoptServerDailyGoal(this.dailyGoal, this.profile);
      if (g != null) {
        this.dailyGoal = g;
        uni.setStorageSync('dailyGoal', g);
      }
      this.adoptPrefs(this.profile);
      if (this.profile) {
        this.planToday = d.plan_today || null;
        uni.setStorageSync('homePlanCard', planCardMark(this.planToday));
      } else this.planToday = null;
    },
    goAsk() {
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    async loadAnnounce() {
      try {
        const d = await request('/api/announcement');
        const item = d.item;
        this.announce = item && uni.getStorageSync('annDismissed') !== String(item.id) ? item : null;
      } catch (e) {
        this.announce = null;
      }
    },
    dismissAnn() {
      if (this.announce) uni.setStorageSync('annDismissed', String(this.announce.id));
      this.announce = null;
    },
    setGoal(g) {
      this.dailyGoal = g;
      uni.setStorageSync('dailyGoal', g);
      request('/api/profile', { method: 'POST', data: { uid: anonUid(), daily_goal: g } }).catch(() => {});
    },
    async loadCounts() {
      try {
        const d = await request('/api/question_counts');
        if (d.counts && d.counts.length) {
          this.counts = d.counts;
          uni.setStorageSync('countsSnap', d.counts);
          this._countsTries = 0;
          return;
        }
      } catch (e) { /* 走下方快照/静态回退 + 重试 */ }
      if (!this.counts.length) {
        // 接口不可用时入口不阻塞：静态模块列表先渲染，题数后台刷新后原位替换
        this.counts = MODULE_KEYS.map((m) => ({ module: m, n: 0 }));
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
        this.prefetchModule(module);
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
      request('/api/profile', { method: 'POST', data: { uid: anonUid(), group_size: n } }).catch(() => {});
    },
    adoptPrefs(profile) {
      const p = adoptServerPracticePrefs({ groupSize: this.groupSize }, profile);
      if (p.groupSize != null) {
        this.groupSize = p.groupSize;
        uni.setStorageSync('groupSize', p.groupSize);
      }
    },
    async loadPlan() {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      try {
        this.applyPlan(await request('/api/daily_plan?uid=' + encodeURIComponent(uid)));
      } catch (e) { /* 非关键路径 */ }
    },
    applyPlan(plan) {
      if (!plan) return;
      this.plan = plan;
      this.planFetched = true;
      setBookBadge(plan.due_mistakes || 0);
    },
    async loadProfile() {
      try {
        const d = await request('/api/profile?uid=' + encodeURIComponent(anonUid()));
        this.profile = d.profile || null;
        const g = adoptServerDailyGoal(this.dailyGoal, this.profile);
        if (g != null) {
          this.dailyGoal = g;
          uni.setStorageSync('dailyGoal', g);
        }
        this.adoptPrefs(this.profile);
        if (this.profile) await this.loadPlanToday();
        else this.planToday = null;
      } catch (e) { /* 非关键路径 */ } finally {
        this.profileFetched = true;
      }
    },
    async loadPlanToday() {
      try {
        this.planToday = await request('/api/plan/today?uid=' + encodeURIComponent(anonUid()));
        uni.setStorageSync('homePlanCard', planCardMark(this.planToday));
      } catch (e) { /* 非关键路径 */ }
    },
    openSetup() {
      this.setupOpen = true;
    },
    async onPlanSaved(profile) {
      this.profile = profile;
      await this.loadPlanToday();
    },
    skipGuide() {
      this.guideHide = true;
      uni.setStorageSync('planGuideHide', '1');
      uni.showToast({ title: '已跳过，可在「我的」随时制定', icon: 'none', duration: 1500 });
    },
    goTask(t) {
      if (t.done) return;
      if (t.type === 'mock') {
        // 真题/冲刺阶段（plan real_mode）计划文案为「整卷全真模考」→ 卷库；其余阶段迷你模考
        if (t.real || (this.planToday && this.planToday.real_mode)) this.goExamList();
        else this.goMini();
        return;
      }
      if (t.type === 'review') {
        this.goBook();
        return;
      }
      if (t.type === 'reinforce') {
        this.launch({ kind: 'reinforce', module: t.module || null, submodule: t.submodule || null, tag3: t.tag3 || null, count: 5 });
        return;
      }
      const remain = Math.max(t.target - (t.done_n || 0), 5);
      this.launch({ kind: 'start', module: t.module || null, submodule: t.submodule || null, count: remain, adaptive: !!t.submodule, forceReal: t.real, tag3: null });
    },
    async exportPaper(opts) {
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
          ...opts,
        });
        this.exportConfirm = false;
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
        if (next) uni.showToast({ title: '今日主攻已设为' + (modLabel(next) || next) + '，推荐已更新', icon: 'none' });
      } catch (e) { /* 非关键路径 */ }
    },
  },
};
</script>

<style scoped>
.wrap { padding: var(--sp-12) var(--page-x) calc(var(--sp-40) + 50px + env(safe-area-inset-bottom)); }
.grow { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-4); }

/* 顶部：考试切换 + 搜索 */
.toprow { display: flex; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-12); }
.examsw { display: flex; align-items: center; gap: var(--sp-4); height: var(--hit-min); padding: 0 var(--sp-12); border-radius: var(--r-full); background: var(--brand-soft); color: var(--brand-text); flex-shrink: 0; max-width: 45%; }
.examsw--hover { background: var(--brand-soft-2); }
.examsw-t { font-size: var(--fs-sub); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.searchbar { flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--sp-8); height: var(--hit-min); padding: 0 var(--sp-16); border-radius: var(--r-full); background: var(--card); border: 1px solid var(--line); }
.searchbar--hover { background: var(--fill); }
.searchbar-t { font-size: var(--fs-sub); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Hero */
.hero-wrap { position: relative; }
.hero-wrap :deep(.kg-hero__num) { white-space: nowrap; flex-shrink: 0; }
.hero-wrap :deep(.kg-hero__total) { min-width: 0; line-height: var(--lh-body); }
.hero-x { position: absolute; top: var(--sp-8); right: var(--sp-8); width: var(--hit-min); height: var(--hit-min); display: flex; align-items: center; justify-content: center; border-radius: var(--r-full); }
.hero-links { display: flex; flex-direction: column; gap: var(--sp-4); }
.hero-ds { font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--on-brand-2); }
.hero-lnk-row { display: flex; gap: var(--sp-16); }
.hero-lnk { display: inline-flex; align-items: center; min-height: 40px; margin: -3px 0; font-size: var(--fs-sub); color: var(--on-brand); text-decoration: underline; text-underline-offset: 3px; }

/* 续练/续考/续复习 */
.resumes { display: flex; flex-direction: column; gap: var(--sp-8); margin-top: var(--sp-12); }
.rs-row { display: flex; align-items: center; gap: var(--sp-8); }
.rs-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-4); }
.rs-t { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.rs-s { font-size: var(--fs-sub); color: var(--ink-3); line-height: var(--lh-sub); }
.rs-stale { color: var(--warn); }
.rs-x { width: var(--hit-min); height: var(--hit-min); display: flex; align-items: center; justify-content: center; margin-right: calc(var(--sp-12) * -1); flex-shrink: 0; }

/* 横幅 */
.strip { margin-top: var(--sp-12); }
.ann-body { display: block; font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--ink-2); padding: var(--sp-8) var(--sp-12) 0; }

/* 到期复习 */
.todo { margin-top: var(--sp-12); }
.todo-row { display: flex; align-items: center; gap: var(--sp-12); padding: var(--sp-8) 0; border-top: 1px solid var(--line); }
.todo-row:first-of-type { border-top: 0; }
.todo-ico { width: 36px; height: 36px; border-radius: var(--r-sm); background: var(--warn-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.todo-t { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.todo-s { font-size: var(--fs-sub); color: var(--ink-3); }
.todo-x { width: var(--hit-min); height: var(--hit-min); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

/* 学习计划 */
.sec { margin-top: var(--sp-16); }
.sec-h { margin-top: var(--sp-16); }
.plan { display: grid; gap: var(--sp-12); }
.plan-s { font-size: var(--fs-sub); color: var(--ink-3); line-height: var(--lh-sub); }
.plan-y { font-size: var(--fs-caption); color: var(--ink-3); }
.plan-prog { display: flex; align-items: center; gap: var(--sp-12); }
.plan-prog-t { font-size: var(--fs-sub); color: var(--ink-2); flex-shrink: 0; }
.task { display: flex; align-items: center; gap: var(--sp-12); min-height: var(--hit-min); padding: var(--sp-8) 0; border-top: 1px solid var(--line); }
.task--hover { background: var(--fill); }
.task-main { display: flex; flex-direction: column; gap: var(--sp-4); }
.task-t { font-size: var(--fs-body); color: var(--ink); line-height: var(--lh-body); }
.task.is-done .task-t { color: var(--ink-4); text-decoration: line-through; }
.task-s { font-size: var(--fs-sub); color: var(--ink-3); line-height: var(--lh-sub); }
.task-go { font-size: var(--fs-sub); color: var(--brand-text); font-weight: 500; flex-shrink: 0; }
.task.is-done .task-go { color: var(--ink-4); }
.focus { display: flex; align-items: center; gap: var(--sp-8); }
.focus-k { font-size: var(--fs-sub); color: var(--ink-3); flex-shrink: 0; }

/* 专项练习列表 */
.skelwrap { display: flex; flex-direction: column; gap: var(--sp-8); margin-top: var(--sp-12); }
.skel-hint { font-size: var(--fs-caption); color: var(--ink-4); text-align: center; padding: var(--sp-8) 0; }
.modlist { display: flex; flex-direction: column; gap: var(--card-gap); margin-top: var(--sp-12); }
.modrow-in { display: flex; align-items: center; gap: var(--sp-12); }
.modrow-ico { width: 44px; height: 44px; border-radius: var(--r-sm); background: var(--brand-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.modrow-ico.is-warn { background: var(--warn-soft); }
.modrow-tr { display: flex; align-items: center; gap: var(--sp-8); }
.modrow-t { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.modrow-s { font-size: var(--fs-sub); color: var(--ink-3); line-height: var(--lh-sub); }
.modrow-lnk { display: inline-block; padding: 11px 0 11px 4px; margin: -11px 0 -11px -4px; color: var(--brand-text); }
.dot { width: 8px; height: 8px; border-radius: var(--r-full); background: var(--bad); }

/* 更多练习 4 格 */
.more-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--card-gap); margin-top: var(--sp-12); }
.more-c { display: flex; flex-direction: column; gap: var(--sp-4); min-height: 96px; }
.more-ico { width: 40px; height: 40px; border-radius: var(--r-sm); background: var(--brand-soft); display: flex; align-items: center; justify-content: center; margin-bottom: var(--sp-4); }
.more-t { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.more-s { font-size: var(--fs-caption); color: var(--ink-3); line-height: var(--lh-caption); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.more-grid .more-c { margin-top: 0; }
.weekly, .streak { margin-top: var(--card-gap); }
.streak-bar { margin-top: var(--sp-12); }

/* sheet 内表单 */
.setrow { display: flex; flex-direction: column; gap: var(--sp-8); padding: var(--sp-12) 0; border-bottom: 1px solid var(--line); }
.set-kwrap { display: flex; align-items: baseline; gap: var(--sp-8); }
.set-k { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.set-sub { font-size: var(--fs-caption); color: var(--ink-4); }
.custom-note { display: block; font-size: var(--fs-caption); color: var(--ink-4); padding: var(--sp-12) 0 0; line-height: var(--lh-caption); }
.sheet-acts { display: grid; gap: var(--sp-8); }

/* 题型 sheet */
.sub-list { display: flex; flex-direction: column; gap: var(--sp-8); }
.sub-row { display: flex; align-items: center; gap: var(--sp-12); }
.sub-chip.is-all { background: var(--brand-soft); border-color: transparent; }
.sub-name { font-size: var(--fs-body); font-weight: 500; color: var(--ink); flex: 1; }
.sub-prog { font-size: var(--fs-caption); color: var(--ink-3); }
.sub-n { font-size: var(--fs-sub); color: var(--ink-3); flex-shrink: 0; }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .wrap.home { max-width: 1064px; padding-top: var(--sp-24); }
  .toprow { max-width: 640px; }
  .more-grid { margin-top: var(--sp-8); }
}
/* #endif */
</style>
