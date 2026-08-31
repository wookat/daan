<template>
  <view class="wrap home">
    <!-- 考试切换 + 全局搜索入口 -->
    <view class="toprow">
      <view class="examsw" @click="openSetup">
        <text class="examsw-t">{{ examLabel }}</text>
        <text class="examsw-a">▾</text>
      </view>
      <view class="searchbar" @click="goSearch">
        <l-icon name="search" :size="16" color="#9ca3af" />
        <text class="searchbar-t">搜题目 / 考点 / 试卷</text>
      </view>
    </view>

    <!-- 新访客价值主张首屏（无练习历史时展示，可关闭） -->
    <view v-if="showLanding" class="card landing">
      <text class="ld-x" @click="closeLanding">✕</text>
      <text class="ld-t">免费刷 11万+ 行测真题</text>
      <text class="ld-s">拍题 AI 讲解 · 错题本按遗忘曲线复习 · 迷你模考 —— 免注册，打开即练</text>
      <view class="ld-grid">
        <view class="ld-item"><text class="ld-in">11万+ 真题题库</text><text class="ld-id">五大模块 · 三级考点分类</text></view>
        <view class="ld-item"><text class="ld-in">AI 拍题讲解</text><text class="ld-id">花生十三方法体系解析</text></view>
        <view class="ld-item"><text class="ld-in">智能错题本</text><text class="ld-id">遗忘曲线复习 + 掌握度</text></view>
        <view class="ld-item"><text class="ld-in">迷你模考</text><text class="ld-id">判分报告 · 错题自动入本</text></view>
      </view>
      <view class="ld-acts">
        <view class="ld-btn main" @click="startDaily">免注册立即开练 ›</view>
        <view class="ld-btn sub" @click="goTiku">浏览题库</view>
      </view>
    </view>

    <!-- 回访召回卡（7天以上未练习的老用户） -->
    <view v-if="comeback" class="card cbcard">
      <view class="cb-l">
        <text class="cb-t">欢迎回来！你已累计练 {{ comeback.total }} 题</text>
        <text class="cb-s">上次练习是 {{ comeback.gap }} 天前 · 继续保持，看看你的学习周报</text>
      </view>
      <view class="cb-r">
        <text class="cb-go" @click="cbWeekly">看周报 ›</text>
        <text class="cb-x" @click="comeback = null">✕</text>
      </view>
    </view>

    <!-- 每日打卡提醒横幅（傍晚仍未开练时展示，每天一次） -->
    <view v-if="reminderBanner" class="card rmcard">
      <view class="cb-l">
        <text class="cb-t">今天还没打卡</text>
        <text class="cb-s">练 1 题即可保住连续打卡，别让连击断在今天</text>
      </view>
      <view class="cb-r">
        <text class="cb-go" @click="rmGo">去刷题 ›</text>
        <text class="cb-x" @click="reminderBanner = false">✕</text>
      </view>
    </view>

    <!-- Hero：今日目标 + 行动 -->
    <view class="hero">
      <view class="hero-top">
        <text class="hero-goal">今日已练 <text class="hero-n">{{ todayCount }}</text>/{{ dailyGoal }} 题{{ todayCount >= dailyGoal ? ' · 已达成' : '' }}</text>
        <view v-if="todayCount >= dailyGoal" class="hero-streak" @click="openPoster"><l-icon name="party-popper" :size="13" color="#ffffff" /><text>生成打卡海报 ›</text></view>
        <view v-else-if="streakShown" class="hero-streak"><l-icon name="flame" :size="13" color="#ffffff" /><text>连续打卡 {{ streakShown }} 天</text></view>
      </view>
      <view class="hero-bar"><view class="hero-fill" :style="{ width: Math.min((todayCount / dailyGoal) * 100, 100) + '%' }" /></view>
      <text v-if="dsMeta && dsDone" class="hero-ds">今日全站同题 · 已完成 答对 {{ dsDone.right }}/{{ dsDone.total }}<template v-if="dsDone.rank"> · 第 {{ dsDone.rank }} 名</template><template v-if="dsDone.streak >= 2"> · 🔥 连 {{ dsDone.streak }} 天</template><text class="hero-ds-arc" @click.stop="openDailyArchive">补练往期 ›</text></text>
      <text v-else-if="dsMeta" class="hero-ds">今日全站同题 10 题 · {{ dsMeta.participants ? '已有 ' + dsMeta.participants + ' 人完成' : '来做今天第 1 人' }}<text class="hero-ds-arc" @click.stop="openDailyArchive">补练往期 ›</text></text>
      <view class="hero-acts">
        <view class="hero-btn main" @click="startDaily">{{ todayDone ? '再练一组 ›' : '继续目标 ›' }}</view>
        <view class="hero-btn sub" @click="openSetup">今日计划</view>
      </view>
    </view>

    <!-- 今日任务三件套 -->
    <view class="card taskcard">
      <view class="tk-h">
        <text class="tk-t">今日任务</text>
        <text class="tk-n">{{ taskDoneN }}/3</text>
      </view>
      <view class="tk-row" @click="taskGo('practice')">
        <text class="tk-ck" :class="{ on: todayCount >= dailyGoal }">{{ todayCount >= dailyGoal ? '✓' : '' }}</text>
        <view class="tk-main">
          <text class="tk-name" :class="{ done: todayCount >= dailyGoal }">刷题目标</text>
          <text class="tk-sub">已练 {{ todayCount }}/{{ dailyGoal }} 题</text>
        </view>
        <text class="tk-go">{{ todayCount >= dailyGoal ? '再练一组 ›' : '去刷题 ›' }}</text>
      </view>
      <view class="tk-row" @click="taskGo('review')">
        <text class="tk-ck" :class="{ on: planFetched && !dueReview }">{{ planFetched && !dueReview ? '✓' : '' }}</text>
        <view class="tk-main">
          <text class="tk-name" :class="{ done: planFetched && !dueReview }">错题复习</text>
          <text class="tk-sub">{{ dueReview ? '今日到期 ' + dueReview + ' 题' : planFetched ? '今日已清零' : '按遗忘曲线安排' }}</text>
        </view>
        <text class="tk-go">{{ dueReview ? '去复习 ›' : '错题本 ›' }}</text>
      </view>
      <view class="tk-row" @click="taskGo('checkin')">
        <text class="tk-ck" :class="{ on: todayCount > 0 }">{{ todayCount > 0 ? '✓' : '' }}</text>
        <view class="tk-main">
          <text class="tk-name" :class="{ done: todayCount > 0 }">每日打卡<text v-if="streakShown" class="tk-streak">🔥 连续 {{ streakShown }} 天</text></text>
          <template v-if="nextMilestone">
            <view class="tk-bar"><view class="tk-fill" :style="{ width: nextMilestone.pct + '%' }" /></view>
            <text class="tk-sub">再打卡 {{ nextMilestone.left }} 天解锁「{{ nextMilestone.days }} 天」徽章</text>
          </template>
          <text v-else class="tk-sub">已解锁全部打卡徽章，太强了！</text>
        </view>
        <text class="tk-go">日历 ›</text>
      </view>
    </view>

    <!-- 今日到期复习入口 -->
    <view v-if="dueReview" class="card duebar" @click="goReview('home_card')">
      <view class="duebar-l">
        <l-icon name="calendar-check" :size="18" color="#ffffff" />
        <view class="duebar-txts">
          <text class="duebar-t">今日到期复习 {{ dueReview }} 题</text>
          <text class="duebar-s">按遗忘曲线安排 · 越拖越容易忘</text>
        </view>
      </view>
      <text class="duebar-go">去复习 ›</text>
    </view>

    <!-- 学习计划引导 / 今日计划 -->
    <view v-if="!profileFetched && planSkel" class="card skel skel-plan" />
    <view v-if="profileFetched && profile === null && !guideHide" class="card guide" @click="openSetup">
      <view class="guide-l">
        <text class="guide-t">制定我的学习计划</text>
        <text class="guide-s">按考试日期倒排每日任务：专项练习 + 错题复习 + 每周模考</text>
      </view>
      <text class="guide-btn">去制定 ›</text>
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
        <text class="plan-go">{{ t.done ? '已完成' : t.type === 'mock' ? '去模考 ›' : t.type === 'review' ? '去复习 ›' : t.type === 'reinforce' ? '去强化 ›' : '去练 ›' }}</text>
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
      <view v-for="w in plan.weak || []" :key="w.module + w.submodule + (w.tag3 || '')" class="plan-row" @click="startPreset(w.module, w.submodule, 10, true, w.tag3 || null, 'reco')">
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
    <view v-if="announce === undefined" class="card skel skel-ann" />
    <view v-if="announce" class="card ann">
      <l-icon name="megaphone" :size="16" color="#0369a1" />
      <view class="ann-c">
        <text class="ann-t">{{ announce.title }}</text>
        <text v-if="announce.body" class="ann-b">{{ announce.body }}</text>
      </view>
      <view class="ann-x" @click="dismissAnn"><l-icon name="x" :size="16" color="#0369a1" /></view>
    </view>

    <!-- 时政每日一练 -->
    <view v-if="!counts.length" class="card skel skel-sz" />
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
    <view v-if="!counts.length" class="skelwrap" @click="loadCounts">
      <view v-for="i in 6" :key="i" class="card skel skel-row" />
      <text class="skel-hint">题库加载中…点此重试</text>
    </view>
    <view class="modlist">
      <view v-for="c in counts" :key="c.module" class="card modrow" @click="openModule(c.module)">
        <view class="mod-ico" :style="{ background: modColor(c.module).bg }"><l-icon :name="modIcon(c.module)" :size="24" :color="modColor(c.module).fg" /></view>
        <view class="grow">
          <text class="mod-name">{{ modName(c.module) }}</text>
          <text class="mod-sub">{{ progText(c) }}</text>
        </view>
        <view class="mod-r">
          <text class="mod-prog"><text class="mod-prog-n">{{ modStat(c.module).done }}</text>/{{ c.n }}</text>
          <view class="mod-bar"><view class="mod-fill" :style="{ width: progPct(c) + '%', background: modColor(c.module).fg }" /></view>
        </view>
        <text class="mod-arrow">›</text>
      </view>
      <view v-if="counts.length" class="card modrow" @click="startPreset(null)">
        <view class="mod-ico" style="background: var(--brand-soft)"><l-icon name="shuffle" :size="24" color="#2e5bff" /></view>
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

    <!-- 周学习报告 -->
    <view class="card weekly-c" @click="goWeeklyReport">
      <view class="more-ico"><l-icon name="calendar-check" :size="22" color="#2e5bff" /></view>
      <view class="grow">
        <view class="weekly-t">周学习报告 <view v-if="weeklyDot" class="dot" /></view>
        <text class="weekly-s">每周一生成 · 回顾上周 · 规划下周</text>
      </view>
      <view class="mini-btn">查看</view>
    </view>

    <!-- 更多练习 -->
    <view class="sec-h"><text class="sec-t">更多练习</text></view>
    <view class="more-grid">
      <view class="card more-c" @click="goContest">
        <view class="more-ico"><l-icon name="trophy" :size="20" color="#d97706" /></view>
        <text class="more-t">模考大赛</text>
        <text class="more-s">每周六 · 全站同卷排名</text>
      </view>
      <view class="card more-c" @click="goExamList">
        <view class="more-ico"><l-icon name="file-text" :size="20" color="#2e5bff" /></view>
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
        <view class="more-ico"><l-icon name="zap" :size="20" color="#2e5bff" /></view>
        <text class="more-t">迷你模考</text>
        <text class="more-s">30 题 · 30 分钟</text>
      </view>
      <view class="card more-c" @click="openPapers">
        <view class="more-ico"><l-icon name="files" :size="20" color="#0d9488" /></view>
        <text class="more-t">真题卷练习</text>
        <text class="more-s">按卷连做 · 统一判分</text>
      </view>
      <view class="card more-c" @click="goPlaza">
        <view class="more-ico"><l-icon name="message-circle" :size="20" color="#7c3aed" /></view>
        <text class="more-t">讨论广场</text>
        <text class="more-s">考友热议 · 每题讨论</text>
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
        <wd-button type="primary" plain block custom-class="sheet-cta2" @click="exportConfirm = true">{{ exporting ? '正在生成 PDF…' : '导出为试卷 PDF' }}</wd-button>
        <view class="custom-note">以上设置同样作用于模块列表；模考与真题卷不受影响</view>
      </view>
    </view>

    <export-confirm
      :visible="exportConfirm"
      :scope="(realMode ? '真题精选卷' : '练习卷') + '（混合模块）'"
      :count="groupSize || 20"
      :busy="exporting"
      above-tabbar
      @close="exportConfirm = false"
      @confirm="exportPaper"
    />

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
            <wd-datetime-picker
              v-model="pfDateTs"
              type="date"
              :min-date="dateStartTs"
              :max-date="dateEndTs"
              :before-confirm="beforeExamDate"
              @confirm="onExamDate"
            >
              <view class="pf-date" :class="{ empty: !pf.exam_date }">{{ pf.exam_date || '选择日期 ›' }}</view>
            </wd-datetime-picker>
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
import { request, anonUid, exportPdf, trackEvent, fetchCheckinBadges, fetchCheckinSummary } from '../../api.js';
import { checkinStreak, dayKey, loadSzDaily } from '../../checkin.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };
const COLORS = {
  ziliao: { bg: '#e6f5f3', fg: '#0d9488' },
  shuliang: { bg: '#e8effe', fg: '#2e5bff' },
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
      exportConfirm: false,
      plan: null,
      planFetched: false,
      profile: undefined,
      profileFetched: false,
      planSkel: uni.getStorageSync('homePlanCard') || !uni.getStorageSync('planGuideHide'),
      planToday: null,
      guideHide: uni.getStorageSync('planGuideHide') ? true : false,
      landingHide: uni.getStorageSync('landingHide') ? true : false,
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
      announce: undefined,
      badgeInfo: null,
      svTodayN: null,
      weeklyDot: false,
      comeback: null,
      reminderBanner: false,
      dsMeta: null,
      dsDone: null,
      dateStart: new Date().toISOString().slice(0, 10),
      dateEnd: new Date(Date.now() + 3 * 366 * 86400000).toISOString().slice(0, 10),
      dateStartTs: Date.now(),
      dateEndTs: Date.now() + 3 * 366 * 86400000,
      pfDateTs: Date.now(),
    };
  },
  computed: {
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
      // 服务端 answer_log（Asia/Shanghai 日界，按当前 uid）为准；
      // 本地 pstats 不分身份，仅在服务端未返回（离线）时降级使用
      if (this.svTodayN != null) return this.svTodayN;
      const days = (this.pstats && this.pstats.days) || {};
      return days[dayKey()] || 0;
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
    taskDoneN() {
      let n = 0;
      if (this.todayCount >= this.dailyGoal) n++;
      if (this.planFetched && !this.dueReview) n++;
      if (this.todayCount > 0) n++;
      return n;
    },
  },
  onShow() {
    this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
    this.daily = uni.getStorageSync('dailyPlan') || { days: {} };
    this.szDaily = loadSzDaily(anonUid());
    this.groupSize = uni.getStorageSync('groupSize') || 10;
    this.dailyGoal = uni.getStorageSync('dailyGoal') || 20;
    this.loadCounts();
    this.prefetchNext();
    this.loadAnnounce();
    this.calcWeeklyDot();
    this.checkComeback();
    this.checkReminder();
    this.loadDailySet();
    const wantSetup = uni.getStorageSync('openPlanSetup');
    if (wantSetup) {
      uni.removeStorageSync('openPlanSetup');
      // 立即弹出设置，不等 profile 请求返回（返回后表单会回填已有值）
      this.openSetup();
    }
    this.loadHome().then(() => {
      if (wantSetup && this.setupOpen && this.profile) this.openSetup();
    });
    if (this.realMode) this.loadRealFilters();
  },
  methods: {
    closeLanding() {
      this.landingHide = true;
      uni.setStorageSync('landingHide', 1);
    },
    goTiku() {
      // #ifdef H5
      window.location.href = '/tiku/';
      // #endif
    },
    beforeExamDate(value, resolve) {
      // confirm 前拦截越界日期：钳回边界并提示，弹层保持打开
      if (value < this.dateStartTs || value > this.dateEndTs) {
        this.pfDateTs = value < this.dateStartTs ? this.dateStartTs : this.dateEndTs;
        uni.showToast({ title: `请选择 ${this.dateStart} 至 ${this.dateEnd} 之间的日期`, icon: 'none', duration: 2500 });
        resolve(false);
        return;
      }
      resolve(true);
    },
    onExamDate({ value }) {
      this.pf.exam_date = this.fmtDateStr(value);
    },
    fmtDateStr(ts) {
      const d = new Date(ts);
      const p = (n) => (n < 10 ? '0' + n : '' + n);
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    },
    loadDailySet() {
      // 全站同题题组：首页外显参与数 + 预取题组供 startDaily 秒开（边缘缓存 60s）
      request('/api/daily_set')
        .then((d) => {
          if (!d || !d.date || !(d.items || []).length) return;
          this.dsMeta = { date: d.date, participants: (d.stats && d.stats.participants) || 0 };
          const done = uni.getStorageSync('dailyDone:' + anonUid());
          this.dsDone = done && done.date === d.date ? done : null;
          uni.setStorageSync('dailySet', d);
        })
        .catch(() => {});
    },
    goSearch() {
      uni.navigateTo({ url: '/pkgA/search/search' });
    },
    openPoster() {
      uni.navigateTo({ url: '/pkgA/social/poster' });
    },
    goPk() {
      uni.navigateTo({ url: '/pkgA/pk/pk' });
    },
    goPlaza() {
      uni.navigateTo({ url: '/pkgA/social/plaza' });
    },
    modName(m) {
      return NAMES[m] || m || '未知';
    },
    modColor(m) {
      return COLORS[m] || { bg: '#eef3ff', fg: '#2e5bff' };
    },
    modIcon(m) {
      return ICONS[m] || 'book-open';
    },
    modStat(m) {
      return this.pstats.byModule[m] || { done: 0, correct: 0 };
    },
    progText(c) {
      const s = this.modStat(c.module);
      if (!s.done) return '共 ' + c.n + ' 题 · 未开始';
      return `正确率 ${Math.round((s.correct / s.done) * 100)}%`;
    },
    prefetchNext() {
      // 预取下一组题包：进刷题页命中时零等待开练（真题/资料分析分组参数不同，不预取）
      if (this.realMode) return;
      const module = uni.getStorageSync('lastModule') || '';
      if (module === 'ziliao') return;
      const limit = this.groupSize || 10;
      const uid = anonUid() || '';
      const pk = uni.getStorageSync('prefetchPack');
      if (pk && pk.module === module && pk.limit === limit && pk.uid === uid && Date.now() - pk.ts < 5 * 60 * 1000) return;
      request(
        '/api/questions?limit=' + limit + (uid ? '&uid=' + encodeURIComponent(uid) : '') + (module ? '&module=' + module : ''),
        { timeout: 15000 }
      )
        .then((d) => {
          if (d.items && d.items.length) uni.setStorageSync('prefetchPack', { module, limit, uid, items: d.items, ts: Date.now() });
        })
        .catch(() => {});
    },
    progPct(c) {
      const s = this.modStat(c.module);
      return Math.min(100, (s.done / (c.n || 1)) * 100);
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
    openDailyArchive() {
      // 近 7 天往期每日一练（补练不计成绩/streak，复用 R78 往期链路）
      const days = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(Date.now() + 8 * 3600e3 - i * 86400e3).toISOString().slice(0, 10);
        days.push(d);
      }
      const label = (d, i) => d + (i === 0 ? '（昨天）' : i === 1 ? '（前天）' : '');
      uni.showActionSheet({
        itemList: days.map(label),
        success: (res) => {
          trackEvent('daily_archive_open', days[res.tapIndex]);
          this.launch({ kind: 'daily', date: days[res.tapIndex] });
        },
      });
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
    goContest() {
      uni.navigateTo({ url: '/pkgA/exam/contest' });
    },
    goWeeklyReport() {
      uni.navigateTo({ url: '/pkgA/stats/weekly-report' });
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
    async loadBadges() {
      try {
        this.badgeInfo = await fetchCheckinBadges();
      } catch (e) { /* 非关键路径 */ }
      try {
        this.applySummary(await fetchCheckinSummary());
      } catch (e) { /* 非关键路径 */ }
    },
    applySummary(d) {
      if (d && d.today_n != null) {
        this.svTodayN = d.today_n;
        if (d.today_n > 0) this.reminderBanner = false;
      }
    },
    // 首屏 uid 专属数据聚合拉取：bundle 一次取齐 plan/profile/plan_today/badges/summary，
    // 失败时回退逐个端点（旧后端/部署窗口兼容）
    async loadHome() {
      const uid = anonUid();
      if (!uid) return;
      try {
        const d = await request('/api/home_bundle?uid=' + encodeURIComponent(uid));
        this.applyPlan(d.plan);
        if (d.badges) this.badgeInfo = d.badges;
        this.applySummary(d.summary);
        this.profile = d.profile || null;
        this.profileFetched = true;
        if (this.profile) {
          this.planToday = d.plan_today || null;
          uni.setStorageSync('homePlanCard', this.planToday && this.planToday.profile ? '1' : '');
        } else this.planToday = null;
      } catch (e) {
        this.loadPlan();
        this.loadBadges();
        await this.loadProfile();
      }
    },
    taskGo(kind) {
      trackEvent('task_card_click', kind);
      if (kind === 'practice') this.startDaily();
      else if (kind === 'review') {
        if (this.dueReview) {
          uni.setStorageSync('autoStartReview', 1);
          trackEvent('review_entry_click', 'task_card');
        }
        uni.switchTab({ url: '/pages/book/book' });
      } else uni.navigateTo({ url: '/pages/stats/calendar' });
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
    },
    async loadCounts() {
      try {
        const d = await request('/api/question_counts');
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
        this.applyPlan(await request('/api/daily_plan?uid=' + encodeURIComponent(uid)));
      } catch (e) { /* 非关键路径 */ }
    },
    applyPlan(plan) {
      if (!plan) return;
      this.plan = plan;
      this.planFetched = true;
      const due = plan.due_mistakes || 0;
      if (due > 0) uni.setTabBarBadge({ index: 1, text: String(due > 99 ? '99+' : due) });
      else uni.removeTabBarBadge({ index: 1 });
    },
    async loadProfile() {
      try {
        const d = await request('/api/profile?uid=' + encodeURIComponent(anonUid()));
        this.profile = d.profile || null;
        if (this.profile) await this.loadPlanToday();
        else this.planToday = null;
      } catch (e) { /* 非关键路径 */ } finally {
        this.profileFetched = true;
      }
    },
    async loadPlanToday() {
      try {
        this.planToday = await request('/api/plan/today?uid=' + encodeURIComponent(anonUid()));
        uni.setStorageSync('homePlanCard', this.planToday && this.planToday.profile ? '1' : '');
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
      const ts = this.pf.exam_date ? new Date(this.pf.exam_date + 'T12:00:00').getTime() : Date.now();
      this.pfDateTs = Math.min(Math.max(ts, this.dateStartTs), this.dateEndTs);
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
        if (next) uni.showToast({ title: '今日主攻已设为' + (this.FOCUS_MODS[next] || next) + '，推荐已更新', icon: 'none' });
      } catch (e) { /* 非关键路径 */ }
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx 32rpx 40rpx; }

/* Hero */
.hero { background: linear-gradient(135deg, #5b8af8, var(--brand)); border-radius: 28rpx; padding: 30rpx 36rpx 26rpx; margin-bottom: 20rpx; box-shadow: 0 12rpx 36rpx rgba(46, 91, 255, 0.3); }
.hero-top { display: flex; justify-content: space-between; align-items: center; }
.hero-goal { font-size: 26rpx; color: rgba(255, 255, 255, 0.85); }
.hero-n { font-size: 36rpx; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
.hero-streak { display: inline-flex; align-items: center; gap: 8rpx; font-size: 22rpx; color: #fff; background: rgba(255, 255, 255, 0.18); border-radius: 8rpx; padding: 4rpx 16rpx; }
.hero-bar { height: 12rpx; background: rgba(255, 255, 255, 0.25); border-radius: 999rpx; margin: 16rpx 0 24rpx; overflow: hidden; }
.hero-ds { display: block; font-size: 22rpx; color: rgba(255, 255, 255, 0.85); margin: -8rpx 0 20rpx; }
.hero-ds-arc { margin-left: 16rpx; text-decoration: underline; color: rgba(255, 255, 255, 0.75); }
.hero-fill { height: 100%; background: var(--card); border-radius: 999rpx; transition: width 0.3s; }
.hero-acts { display: flex; gap: 20rpx; }
.hero-btn { min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border-radius: 20rpx; font-size: 28rpx; font-weight: 600; }
.hero-btn.main { flex: 1; background: var(--card); color: var(--brand); }
.hero-btn.sub { padding: 0 32rpx; background: rgba(255, 255, 255, 0.16); color: #fff; }

/* Section header */
.sec-h { display: flex; justify-content: space-between; align-items: baseline; margin: 36rpx 4rpx 20rpx; }
.sec-t { font-size: 32rpx; font-weight: 700; color: var(--ink); }
.sec-more { font-size: 24rpx; color: var(--ink-2); min-height: 44px; display: inline-flex; align-items: center; }

/* 周报卡 */
.weekly-c { display: flex; align-items: center; gap: 24rpx; padding: 26rpx 32rpx; }
.weekly-t { font-size: 29rpx; font-weight: 600; color: var(--ink); display: flex; align-items: center; gap: 10rpx; }
.weekly-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.dot { width: 16rpx; height: 16rpx; border-radius: 50%; background: #ef4444; }

/* 时政卡 */
.szcard { display: flex; align-items: center; gap: 24rpx; padding: 26rpx 32rpx; }
.sz-ico { width: 80rpx; height: 80rpx; border-radius: 20rpx; background: var(--warn-soft); display: flex; align-items: center; justify-content: center; font-size: 38rpx; flex-shrink: 0; }
.sz-t { font-size: 29rpx; font-weight: 600; color: var(--ink); display: flex; align-items: center; gap: 8rpx; }
.sz-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.tag { display: inline-flex; align-items: center; height: 40rpx; padding: 0 16rpx; border-radius: 12rpx; font-size: 21rpx; font-weight: 500; }
.tag.warn { background: var(--warn-soft); color: #b45309; }
.tag.ok { background: var(--ok-soft); color: var(--ok-strong); }
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
.skel { background: var(--fill); box-shadow: none; animation: skel-pulse 1.4s ease-in-out infinite; }
.skel-plan { height: 162rpx; box-sizing: border-box; }
.skel-sz { height: 166rpx; box-sizing: border-box; }
.skel-ann { height: 154rpx; box-sizing: border-box; }
.skel-row { height: 144rpx; box-sizing: border-box; }
.skelwrap { position: relative; }
.skel-hint { position: absolute; top: 56rpx; left: 0; right: 0; text-align: center; color: var(--ink-2); font-size: 26rpx; }
@keyframes skel-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

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

/* 回访召回卡 */
.cbcard { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #f59e0b, #f97316); border: none; box-shadow: 0 6rpx 16rpx rgba(249, 115, 22, 0.25); padding: 24rpx 28rpx; }
.cb-l { min-width: 0; }
.cb-t { display: block; font-size: 28rpx; font-weight: 700; color: #ffffff; }
.cb-s { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.85); margin-top: 4rpx; }
.cb-r { flex-shrink: 0; display: flex; align-items: center; gap: 16rpx; }
.cb-go { background: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 25rpx; font-weight: 600; border-radius: 999rpx; padding: 12rpx 26rpx; }
.cb-x { color: rgba(255, 255, 255, 0.75); font-size: 26rpx; padding: 8rpx; }

/* 每日打卡提醒横幅 */
.rmcard { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #6366f1, #4f46e5); border: none; box-shadow: 0 6rpx 16rpx rgba(99, 102, 241, 0.25); padding: 24rpx 28rpx; }

/* 今日到期复习入口 */
.duebar { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(180deg, #4a7bf7, #3567ec); border: none; box-shadow: 0 6rpx 16rpx rgba(46, 91, 255, 0.25); padding: 24rpx 28rpx; }
.duebar-l { display: flex; align-items: center; gap: 18rpx; min-width: 0; }
.duebar-txts { min-width: 0; }
.duebar-t { display: block; font-size: 28rpx; font-weight: 700; color: #ffffff; }
.duebar-s { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.75); margin-top: 4rpx; }
.duebar-go { flex-shrink: 0; background: rgba(255, 255, 255, 0.18); color: #ffffff; font-size: 25rpx; font-weight: 600; border-radius: 999rpx; padding: 12rpx 30rpx; }
.taskcard { padding: 24rpx 28rpx; }
.tk-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8rpx; }
.tk-t { font-size: 28rpx; font-weight: 700; }
.tk-n { font-size: 22rpx; color: var(--brand); font-weight: 700; background: var(--brand-soft); border-radius: 8rpx; padding: 2rpx 14rpx; }
.tk-row { display: flex; align-items: center; gap: 18rpx; padding: 16rpx 0; border-top: 1rpx solid var(--line); }
.tk-row:first-of-type { border-top: none; }
.tk-ck { flex-shrink: 0; width: 34rpx; height: 34rpx; line-height: 34rpx; text-align: center; border-radius: 50%; border: 2rpx solid var(--line); font-size: 22rpx; color: #fff; }
.tk-ck.on { background: #16a34a; border-color: #16a34a; }
.tk-main { flex: 1; min-width: 0; }
.tk-name { display: block; font-size: 26rpx; font-weight: 600; }
.tk-name.done { color: var(--ink-3); }
.tk-streak { font-size: 21rpx; color: #d97706; font-weight: 600; margin-left: 12rpx; }
.tk-sub { display: block; font-size: 21rpx; color: var(--ink-2); margin-top: 4rpx; }
.tk-bar { height: 10rpx; background: var(--line); border-radius: 999rpx; margin-top: 10rpx; overflow: hidden; }
.tk-fill { height: 100%; background: linear-gradient(90deg, #f59e0b, #d97706); border-radius: 999rpx; }
.tk-go { flex-shrink: 0; font-size: 23rpx; color: var(--brand); font-weight: 600; }

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
.sheet { width: 100%; max-height: 76vh; overflow-y: auto; background: var(--card); border-radius: 40rpx 40rpx 0 0; padding: 12rpx 36rpx calc(146rpx + env(safe-area-inset-bottom)); box-sizing: border-box; box-shadow: 0 -16rpx 48rpx rgba(23, 24, 28, 0.16); }
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
:deep(.sheet-cta) { margin-top: 24rpx; width: 100%; border-radius: 20rpx !important; background: linear-gradient(135deg, #5b8af8, var(--brand)) !important; box-shadow: 0 8rpx 24rpx rgba(46, 91, 255, 0.28); font-weight: 600; }
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

/* 宽屏交互（≥768px）；双栏留到 ≥1024px——768 时内容区仅 560px（侧栏占 208px），双栏放不下卡内固定宽元素 */
/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.home { max-width: 960px !important; }
  .modrow:hover, .more-c:hover { box-shadow: 0 8rpx 24rpx rgba(23, 24, 28, 0.08); cursor: pointer; }
  .mask { position: fixed; align-items: center; justify-content: center; }
  .sheet { max-width: 520px; border-radius: 28rpx; padding-bottom: calc(36rpx + env(safe-area-inset-bottom)); }
}
@media (min-width: 1024px) {
  .wrap.home { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; align-items: start; }
  .hero, .sec-h, .ann, .riskbar, .duebar, .taskcard { grid-column: 1 / -1; }
  .modlist { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; align-items: start; }
  .modlist .card.smart { grid-column: 1 / -1; }
  .more-grid { grid-column: 1 / -1; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .card.guide, .card.plancard, .card.szcard, .card.weekly-c, .card.spin { grid-column: 1 / -1; }
  .card.landing { grid-column: 1 / -1; }
  .hero-btn.main { flex: 0 0 auto; padding: 0 64rpx; }
  .landing .ld-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .landing .ld-btn.main { flex: 0 0 auto; padding: 0 56rpx; }
}
/* #endif */
.toprow { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; }
.examsw { flex-shrink: 0; display: flex; align-items: center; gap: 6rpx; min-height: 44px; box-sizing: border-box; padding: 0 22rpx; background: var(--card); border-radius: 999rpx; box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04); }
.examsw-t { font-size: 26rpx; font-weight: 600; color: var(--ink); max-width: 220rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.examsw-a { font-size: 20rpx; color: var(--ink-3); }
.mod-r { display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx; flex-shrink: 0; }
.mod-prog { font-size: 22rpx; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.mod-prog-n { font-size: 26rpx; font-weight: 700; color: var(--ink); }
.searchbar { flex: 1; display: flex; align-items: center; gap: 12rpx; background: var(--card); border-radius: 999rpx; padding: 16rpx 26rpx; box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04); }
.searchbar-t { font-size: 26rpx; color: var(--ink-3); }

/* 新访客价值主张首屏 */
.landing { position: relative; background: linear-gradient(135deg, var(--brand), #4c7dff); color: #fff; padding: 36rpx 32rpx; }
.ld-x { position: absolute; top: 16rpx; right: 24rpx; font-size: 26rpx; color: rgba(255, 255, 255, 0.75); padding: 8rpx; }
.ld-t { display: block; font-size: 40rpx; font-weight: 700; line-height: 1.35; }
.ld-s { display: block; font-size: 24rpx; color: rgba(255, 255, 255, 0.88); margin-top: 10rpx; line-height: 1.6; }
.ld-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; margin-top: 24rpx; }
.ld-item { background: rgba(255, 255, 255, 0.14); border-radius: 16rpx; padding: 18rpx 20rpx; display: flex; flex-direction: column; gap: 4rpx; }
.ld-in { font-size: 26rpx; font-weight: 600; }
.ld-id { font-size: 21rpx; color: rgba(255, 255, 255, 0.82); }
.ld-acts { display: flex; gap: 16rpx; margin-top: 26rpx; }
.ld-btn { min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border-radius: 999rpx; padding: 0 34rpx; font-size: 27rpx; font-weight: 600; }
.ld-btn.main { background: #fff; color: var(--brand); flex: 1; }
.ld-btn.sub { background: rgba(255, 255, 255, 0.16); color: #fff; border: 1rpx solid rgba(255, 255, 255, 0.45); }
</style>
