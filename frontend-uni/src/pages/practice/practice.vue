<template>
  <view class="page" :class="{ 'has-bar': session }">
    <!-- 加载失败 / 骨架（本页仅承载答题会话，选题在首页） -->
    <kg-empty-state
      v-if="!session && loadState === 'fail'"
      icon="wifi-off"
      title="题目加载失败"
      :desc="loadFailMsg || '网络不稳定或服务暂时无响应'"
      cta-text="重试"
      :secondary-text="backLabel"
      @cta="retryStart"
      @secondary="quit"
    />
    <view v-else-if="!session" class="pskel">
      <kg-skeleton preset="lines" />
      <text class="pskel-hint" role="status">{{ loadHint }}</text>
      <kg-button variant="text" size="md" @click="quit">{{ backLabel }}</kg-button>
    </view>

    <!-- 作答（T3） -->
    <kg-two-col v-if="session && cur">
      <template #main>
        <view v-if="beiMode || timedMode || examMode" class="modechips">
          <kg-tag v-if="beiMode" tone="brand">背题模式</kg-tag>
          <kg-tag v-if="timedMode && !beiMode && !examMode" tone="info">限时训练</kg-tag>
          <kg-tag v-if="examMode" tone="bad">模考态 · 交卷统一判分</kg-tag>
        </view>
        <view class="topbar">
          <view class="top-mod" role="button" aria-label="打开答题卡" @click="cardOpen = true">
            <kg-tag tone="module" :module="cur.module">{{ modName(cur.module) }}</kg-tag>
            <text class="pos num">{{ idx + 1 }}/{{ items.length }}</text>
            <l-icon name="chevron-down" :size="16" tone="muted" />
          </view>
          <view class="hstats">
            <text class="timer num" :class="{ examleft: examMode, overtime: timedMode && !examMode && qsecs > targetSecs }">{{ examMode ? fmtSecs(examLeft) : timedMode ? (qsecs > targetSecs ? '超时+' + fmtSecs(qsecs - targetSecs) : fmtSecs(targetSecs - qsecs)) : fmtSecs(qsecs) }}</text>
            <text v-if="!examMode" class="cnt okc num">✓{{ right }}</text>
            <text v-if="!examMode" class="cnt badc num">✗{{ wrongCount }}</text>
            <view v-if="streak >= 3" class="cnt fire"><l-icon name="flame" :size="16" tone="streak" fill="currentColor" /><text class="num">{{ streak }}</text></view>
            <view class="icon-btn" role="button" aria-label="退出练习" hover-class="tool-hover" @click="quit"><l-icon name="log-out" :size="20" tone="ink-2" /></view>
          </view>
        </view>

        <kg-banner v-if="offline" tone="warn" icon="plane" text="离线题包模式 · 本地判分，作答记录联网后自动同步（AI 讲解等需联网）" :closable="false" />
        <kg-banner v-if="leadHint && idx === 0" class="lead-tag" tone="info" :text="leadHint" @close="leadHint = ''" />

        <kg-question-card :q="qCard" :index="idx" :total="items.length" :font-level="fontLv">
          <template v-if="qSegs && !matInfo" #stem>
            <text v-for="(s, si) in qSegs" :key="si" :class="{ qhl: s.hl }">{{ s.t }}</text>
          </template>
          <text v-if="qSegs && qSegs.some(s => s.hl)" class="qhl-tip">已标注题干重点（解析涉及的关键数字/关键词），对照检查是否找对了信息</text>
          <text v-if="cur.image && cur.image_credit" class="img-credit">图源：{{ cur.image_credit }}</text>
          <kg-option-group
            :options="optList"
            :model-value="picked ? ansKeys(picked) : multiSel"
            :answer="ansKeys(cur.answer)"
            :revealed="(!!picked || beiMode) && !examMode"
            :excluded="cur._excl || []"
            :readonly="beiMode"
            :multiple="isMulti"
            :font-level="fontLv"
            @select="pick"
            @exclude="toggleExclOpt"
          />
          <view v-if="isMulti && !picked && !beiMode" class="multi-bar">
            <text class="multi-hint">多选题：选完所有正确项后确认</text>
            <kg-button variant="primary" size="lg" :disabled="!multiSel.length" @click="confirmMulti">确认答案{{ multiSel.length ? '（' + multiSel.length + '）' : '' }}</kg-button>
          </view>
        </kg-question-card>

        <view v-if="(picked || beiMode) && !examMode" class="after">
          <kg-banner
            :tone="beiMode || picked === cur.answer ? 'ok' : 'bad'"
            :text="beiMode ? '背题模式 · 答案 ' + cur.answer : picked === cur.answer ? '回答正确' + (streak >= 3 ? ' · 连对 ' + streak + ' 题！' : '') : '正确答案 ' + cur.answer + (cur._saved ? ' · 已自动存入错题本' : '')"
            :action-text="!beiMode && picked === cur.answer && autoTimer ? '看解析' : ''"
            :closable="false"
            @action="stayHere"
          />
          <kg-analysis-card
            :answer="cur.answer"
            :picked="beiMode ? '' : picked"
            :analysis="mainExplanation"
            :stats="anaStats"
            :source="cur.source || ''"
            :tags="kpTags"
          >
            <template #social>
              <text v-if="timedMode && !beiMode && cur._secs != null" class="tm-cmp num" :class="{ over: cur._secs > targetSecs }">用时 {{ cur._secs }}s / 目标 {{ targetSecs }}s</text>
              <view v-if="cur.hs_explanation" class="hs-rate">
                <text v-if="hsRated[cur.id]" class="hs-rate-done">{{ hsRated[cur.id] === 'up' ? '已反馈：有用' : '已反馈：有误' }}</text>
                <template v-else>
                  <text class="hs-rate-t">花生十三方法解析</text>
                  <kg-button variant="ghost" size="sm" icon="thumbs-up" @click="rateHs(cur, true)">有用</kg-button>
                  <kg-button variant="ghost" size="sm" tone="bad" icon="thumbs-down" @click="rateHs(cur, false)">有误</kg-button>
                </template>
              </view>
              <q-social-bar v-if="cur.id && !cur._sz" :question-id="cur.id" />
            </template>
          </kg-analysis-card>
          <view v-if="picked && picked !== cur.answer" class="reasons" role="group" aria-label="错因自评">
            <text class="rz-t">错因自评（选填）</text>
            <view
              v-for="rz in REASONS"
              :key="rz"
              class="rz"
              :class="{ on: cur._reason === rz }"
              role="button"
              :aria-pressed="cur._reason === rz ? 'true' : 'false'"
              @click="setReason(rz)"
            >{{ rz }}</view>
          </view>
          <kg-card v-if="cur.xp_explanation" variant="soft" class="xp-card">
            <text class="xp-k">{{ cur.xp_school || '第二名师视角' }}</text>
            <text class="xp-b q-text">{{ cur.xp_explanation }}</text>
          </kg-card>
          <kg-card v-if="cur.hs_explanation && cur.explanation && !isExplanationCovered(cur.hs_explanation, cur.explanation)" variant="soft" class="xp-card">
            <text class="xp-k">解析</text>
            <text class="xp-b q-text">{{ cur.explanation }}</text>
          </kg-card>
          <view class="deep-acts">
            <kg-button v-if="curAskSeen" variant="ghost" size="md" block @click="openSeenAsk">回看 AI 详解</kg-button>
            <kg-button variant="secondary" size="md" block icon="sparkles" @click="deepExplain">用花生十三方法详解这道题</kg-button>
            <kg-button v-if="!cur._sz" variant="text" size="sm" @click="reportQuestion">{{ cur._reported ? '已提交纠错，感谢反馈' : '题目有问题？纠错' }}</kg-button>
          </view>
        </view>

        <kg-action-bar
          layout="answer"
          :index="idx"
          :total="items.length"
          :primary-text="barPrimary.text"
          :disabled="barPrimary.disabled"
          @primary="barPrimary.go()"
        >
          <template #tools>
            <view class="kg-tool" :class="{ on: isFav }" role="button" :aria-label="isFav ? '取消收藏' : '收藏本题'" :aria-pressed="isFav ? 'true' : 'false'" hover-class="tool-hover" @click="toggleFav">
              <l-icon name="star" :size="24" :tone="isFav ? 'warn' : 'ink-2'" :fill="isFav ? 'currentColor' : 'none'" />
            </view>
            <view class="kg-tool" role="button" aria-label="练习工具" hover-class="tool-hover" @click="toolsOpen = true">
              <l-icon name="sliders-horizontal" :size="24" tone="ink-2" />
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
            <text class="acard-foot">已答 {{ answeredCount }}/{{ items.length }}<template v-if="!examMode"> · 正确 {{ right }}</template></text>
          </view>
          <view class="acard-grid side-grid">
            <view
              v-for="(q, i) in items"
              :key="i"
              class="acard-n num"
              :class="acardClass(q, i)"
              role="button"
              :aria-label="'第 ' + (i + 1) + ' 题'"
              @click="jumpTo(i)"
            >{{ i + 1 }}</view>
          </view>
          <kg-button v-if="examMode" size="md" block @click="confirmFinishExam">交卷</kg-button>
        </kg-card>
        <kg-card class="side-card">
          <text class="side-t">键盘快捷键</text>
          <view class="kbd-row"><text class="kbd">A</text><text class="kbd">–</text><text class="kbd">D</text><text class="kbd-d">选择答案</text></view>
          <view class="kbd-row"><text class="kbd">Enter</text><text class="kbd-d">下一题</text></view>
          <view class="kbd-row"><text class="kbd">←</text><text class="kbd">→</text><text class="kbd-d">上一题 / 下一题</text></view>
        </kg-card>
      </template>
      <!-- #endif -->
    </kg-two-col>

    <!-- 结算段（T4） -->
    <kg-two-col v-if="session && !cur">
      <template #main>
        <kg-hero-card
          v-if="!beiMode"
          :label="paperFinish().isPaper ? paperFinish().big + ' · ' + paperFinish().title : paperFinish().big"
          :value="Math.round((right / (items.length || 1)) * 100)"
          unit="%"
          :progress="Math.round((right / (items.length || 1)) * 100)"
        >
          <text class="hero-s">答对 {{ right }}/{{ items.length }} · 最高连对 {{ bestStreak }} 题<template v-if="autoSaved">，错题已自动加入错题本</template></text>
          <text v-if="percentile != null" class="hero-s">{{ percentileLine(percentile) }}</text>
        </kg-hero-card>
        <kg-hero-card v-else label="本组背完" :value="items.length" unit="题">
          <text class="hero-s">已浏览 {{ items.length }} 道题的答案与解析</text>
        </kg-hero-card>

        <kg-stat-row v-if="!beiMode" class="sec" :items="doneStats" />

        <kg-banner
          v-if="!beiMode && dailyStats"
          class="sec"
          tone="info"
          icon="users"
          :closable="false"
          :text="dailyStatsText"
        />
        <kg-card v-if="!beiMode && dailyStats && dailyBoard.length" class="sec">
          <view class="sec-h">
            <text class="sec-t">今日排行榜</text>
            <text v-if="dailyStats.my_rank" class="sec-r num">我的名次：第 {{ dailyStats.my_rank }} 名</text>
          </view>
          <view v-for="r in dailyBoard.slice(0, 10)" :key="r.rank" class="dsb-row">
            <kg-tag :tone="r.rank <= 3 ? 'warn' : 'neutral'">{{ r.rank }}</kg-tag>
            <text class="dsb-name">{{ r.name }}</text>
            <text class="dsb-score num">答对 {{ r.right }}/{{ r.total }}<template v-if="r.secs"> · {{ fmtSecs(r.secs) }}</template></text>
          </view>
        </kg-card>
        <kg-banner
          v-if="!beiMode && dailyErr"
          class="sec"
          tone="warn"
          :closable="false"
          text="今日全站同题 · 成绩上传失败（回首页也会自动补传）"
          action-text="重试"
          @action="retryDailySubmit"
        />

        <kg-card v-if="!beiMode && redoReport" class="sec">
          <text class="sec-t">错题重练效果</text>
          <kg-stat-row
            :items="[
              { label: '已纠正', value: redoReport.fixed, tone: 'ok' },
              { label: '仍错', value: redoReport.still, tone: 'bad' },
              { label: '达成掌握', value: redoReport.mastered, tone: 'brand' },
            ]"
          />
          <text class="sec-tip">答对的已推进复习计划<template v-if="redoReport.still">；仍错的已重置复习，已回到今日待复习</template></text>
          <kg-button variant="text" size="sm" @click="goReview">回错题本查看</kg-button>
        </kg-card>
        <kg-card v-else-if="!beiMode && fixReport" class="sec" clickable chevron @click="goReview">
          <text class="fr-t">{{ fixReportText(fixReport) }}</text>
        </kg-card>

        <kg-card v-if="!beiMode && !examMode && weakSpots.length" class="sec">
          <text class="sec-t">薄弱考点 · 趁热打铁</text>
          <view v-for="w in weakSpots" :key="w.key" class="wr-row">
            <view class="wr-l">
              <text class="wr-name">{{ w.name }}</text>
              <text class="wr-meta">本组错 {{ w.n }} 题</text>
            </view>
            <kg-button variant="ghost" size="sm" @click="reinforceWeak(w)">练同考点</kg-button>
          </view>
        </kg-card>

        <kg-card v-if="!beiMode && moduleBreakdown.length >= 2" class="sec">
          <text class="sec-t">分模块正确率</text>
          <view v-for="b in moduleBreakdown" :key="b.mod" class="mb-row">
            <text class="mb-name">{{ modName(b.mod) }}</text>
            <kg-progress :value="b.pct" :module="b.mod" class="mb-bar" :aria-label="modName(b.mod) + '正确率'" />
            <text class="mb-pct num">{{ b.right }}/{{ b.n }} · {{ b.pct }}%</text>
          </view>
        </kg-card>

        <kg-card v-if="!beiMode" class="sec answers-card">
          <text class="sec-t">逐题回顾</text>
          <view class="acard-grid">
            <view
              v-for="(q, i) in items"
              :key="i"
              class="acard-n num"
              :class="!q._picked ? 'skip' : q._picked === q.answer ? 'ok' : 'bad'"
              role="button"
              :aria-label="'第 ' + (i + 1) + ' 题'"
              @click="jumpTo(i)"
            >{{ i + 1 }}</view>
          </view>
          <text class="sec-tip">点题号可回看题目与解析<template v-if="items.some(q => !q._picked)">（灰色为未作答）</template></text>
        </kg-card>

        <kg-card v-if="!beiMode && dueReview" class="sec" clickable chevron @click="goReview">
          <text class="nudge-t">今日还有 {{ dueReview }} 题到期待复习</text>
          <text class="nudge-s">趁热打铁，按遗忘曲线巩固一遍</text>
        </kg-card>
        <kg-banner
          v-if="!beiMode && loginNudgeN"
          class="sec"
          tone="info"
          icon="cloud"
          :text="'已累计刷 ' + loginNudgeN + ' 题 · 登录保进度：错题本、做题记录云同步，换设备/清缓存不丢'"
          action-text="去登录"
          @action="loginNudgeGo"
          @close="dismissLoginNudge"
        />
        <!-- #ifdef H5 -->
        <kg-banner
          v-if="!beiMode && pushNudge"
          class="sec"
          tone="info"
          icon="bell"
          :text="pushNudgeDone ? '已开启每日一练提醒 · 明早 8 点推送今日全站同题' : (dailyStats && dailyStats.streak >= 2 ? '别断了连续 ' + dailyStats.streak + ' 天 · ' : '') + '开启每日一练提醒：明早 8 点推送全站同题 10 题，关闭页面也能收到'"
          :action-text="pushNudgeDone ? '' : '开启'"
          :closable="!pushNudgeDone"
          @action="pushNudgeGo"
          @close="dismissPushNudge"
        />
        <!-- #endif -->

        <view class="done-acts">
          <kg-button v-if="!beiMode" variant="ghost" size="lg" block icon="share-2" @click="shareResult">分享成绩</kg-button>
          <kg-button v-if="doneBar().secondaryAct !== 'quit'" variant="text" size="md" block @click="quit">{{ backLabel }}</kg-button>
        </view>

        <!-- 结算态固定底栏（小程序 doneBar 同口径）：主出路不再随长页沉到首屏之下 -->
        <kg-action-bar
          layout="actions"
          class="done-bar"
          :class="{ 'done-bar--long': doneBar().primaryAct === 'redo' }"
          :primary-text="doneBar().primary"
          :secondary-text="doneBar().secondary"
          @primary="doneAct(doneBar().primaryAct)"
          @secondary="doneAct(doneBar().secondaryAct)"
        />
      </template>
    </kg-two-col>

    <!-- 答题卡 -->
    <kg-sheet v-model="cardOpen" title="答题卡">
      <view class="acard-grid">
        <view
          v-for="(q, i) in items"
          :key="i"
          class="acard-n num"
          :class="acardClass(q, i)"
          role="button"
          :aria-label="'第 ' + (i + 1) + ' 题'"
          @click="jumpTo(i)"
        >{{ i + 1 }}</view>
      </view>
      <text class="acard-foot">已答 {{ answeredCount }}/{{ items.length }}<template v-if="!examMode"> · 正确 {{ right }}</template></text>
      <kg-button v-if="examMode" size="lg" block @click="confirmFinishExam">交卷</kg-button>
    </kg-sheet>

    <!-- 练习工具 -->
    <kg-sheet v-model="toolsOpen" title="练习工具">
      <view class="tool-row" role="button" @click="cycleFont">
        <text class="tool-name">字号大小</text>
        <text class="tool-val">{{ ['小', '标准', '大'][fontLv] || '标准' }} · 点击切换</text>
      </view>
      <view v-if="!examMode" class="tool-row" role="switch" :aria-checked="beiMode ? 'true' : 'false'" @click="toggleBei">
        <text class="tool-name">背题模式</text>
        <text class="tool-val" :class="{ on: beiMode }">{{ beiMode ? '已开启' : '已关闭' }}</text>
      </view>
      <view v-if="!examMode" class="tool-row" role="switch" :aria-checked="autoNext ? 'true' : 'false'" @click="toggleAutoNext">
        <text class="tool-name">答对自动跳下一题</text>
        <text class="tool-val" :class="{ on: autoNext }">{{ autoNext ? '已开启' : '已关闭' }}</text>
      </view>
      <view v-if="!examMode && !beiMode" class="tool-row" role="switch" :aria-checked="timedMode ? 'true' : 'false'" @click="toggleTimed">
        <text class="tool-name">限时训练（按模块建议用时倒计时）</text>
        <text class="tool-val" :class="{ on: timedMode }">{{ timedMode ? '已开启' : '已关闭' }}</text>
      </view>
      <view class="tool-row" role="switch" :aria-checked="sfxOn ? 'true' : 'false'" @click="toggleSfx">
        <text class="tool-name">答题音效</text>
        <text class="tool-val" :class="{ on: sfxOn }">{{ sfxOn ? '已开启' : '已关闭' }}</text>
      </view>
      <view class="tool-row" role="switch" :aria-checked="vibrateOn ? 'true' : 'false'" @click="toggleVibrate">
        <text class="tool-name">答题震动反馈</text>
        <text class="tool-val" :class="{ on: vibrateOn }">{{ vibrateOn ? '已开启' : '已关闭' }}</text>
      </view>
    </kg-sheet>

    <!-- 中途退出：关层（X / Esc / Back / 遮罩）= 继续做题；两种离开都要显式点按，键盘 Esc 不再等于「结束本组」 -->
    <kg-sheet v-model="quitOpen" :title="quitSum ? quitSum.title : '退出练习'">
      <text class="quit-tip">保留后可从首页「有一组未做完的练习」继续；结束本组不保留进度（已答记录仍进错题本）</text>
      <template #footer>
        <view class="sheet-acts">
          <kg-button variant="primary" size="lg" block @click="quitPick(true)">保留进度并退出</kg-button>
          <kg-button variant="ghost" size="lg" block tone="bad" @click="quitPick(false)">结束本组并退出</kg-button>
          <kg-button variant="text" size="md" block @click="quitOpen = false">继续做题</kg-button>
        </view>
      </template>
    </kg-sheet>

    <!-- 继续上次练习：关层（X / Esc / Back / 遮罩）= 继续；「开新一组」会清本机 + 服务端进度，必须显式点按 -->
    <kg-sheet v-model="resumeOpen" :title="resumeAsk ? resumeAsk.title : '继续上次练习？'">
      <text class="quit-tip">{{ resumeAsk ? resumeAsk.tip : '' }}</text>
      <template #footer>
        <view class="sheet-acts">
          <kg-button variant="primary" size="lg" block @click="resumePick(true)">{{ resumeAsk ? resumeAsk.cont : '继续' }}</kg-button>
          <kg-button variant="ghost" size="lg" block tone="bad" @click="resumePick(false)">{{ resumeAsk ? resumeAsk.drop : '不用了' }}</kg-button>
        </view>
      </template>
    </kg-sheet>

    <!-- 题目纠错 -->
    <kg-sheet v-model="reportOpen" title="题目纠错">
      <view class="rp-types" role="group" aria-label="问题类型">
        <view
          v-for="t in reportTypes"
          :key="t"
          class="rz"
          :class="{ on: reportType === t }"
          role="button"
          :aria-pressed="reportType === t ? 'true' : 'false'"
          @click="reportType = t"
        >{{ t }}</view>
      </view>
      <textarea
        v-model="reportDetail"
        class="rp-detail"
        placeholder="补充说明（选填，500 字以内）"
        :maxlength="500"
      />
      <kg-button size="lg" block :disabled="!reportType || reportBusy" :loading="reportBusy" @click="submitReport">提交纠错</kg-button>
    </kg-sheet>
  </view>
</template>

<script>
import { request, BASE_URL, anonUid, removeFav, setFav, fetchCheckinBadges, getAuthUser, trackEvent } from '../../api.js';
import { markFavLocalOnly } from '../../exam-fav.js';
import { syncCloudFavs } from '../../fav-sync.js';
import { enqueueAnswers, enqueueMistake, drawOffline, flushOfflineQueue } from '../../offline.js';
import { dayKey, loadSzDaily } from '../../checkin.js';
import { dailySetLine, dailySetShareTail, percentileLine, percentileShareTail } from '../../exam-copy.js';
import { splitMaterial, sameMaterial } from '../../material.js';
import { normFontLv } from '../../font-size.js';
import { MODULES, moduleLabel } from '../../module-meta.js';
import { askPrefill, askAnswerLetter } from '../../ask-prefill.js';
import { askQid, findAskSid } from '../../ask-link.js';
// #ifdef H5
import { requestNotificationPermission } from '../../reminder.js';
import { announce } from '../../a11y-live.js';
import { pickAnnounceText } from '../../live-policy.js';
import { dailyOps } from '../../practice/daily-ops.js';
import { sessionOps } from '../../practice/session-ops.js';
// #endif
import { paperContinuePlan, paperQuery, paperFinishState, paperShareText, paperWrongItems, paperWrongPlan, paperWrongLaunch, wrongRetryPlan, doneBarPlan } from '../../paper-continue.js';
import { adoptServerDailyGoal } from '../../daily-goal.js';
import { adoptServerPracticePrefs } from '../../practice-prefs.js';
import { qStatLine, qDifficulty } from '../../q-stat.js';
import { toggleExcl, pickWithExcl, exclVisible } from '../../exam-excl.js';
import { dailyPendingFor, cnDayOf, patchPendingMistake, unlinkedWrongItems, relinkMistakeIds } from '../../practice-progress.js';
import { weakSpots as buildWeakSpots } from '../../weak-spots.js';
import { isExplanationCovered } from '../../exp-dup.js';
import { reviewedMasteredCount, fixReportText } from '../../review-advance.js';
import { leadQidOf, leadPickOf, mergeLead, leadHintText } from '../../leadq.js';
import { quitSummary } from '../../quit-summary.js';
import { resumeDismissAction } from '../../resume-ask.js';
import { backLabel } from '../../back-label.js';
import { practiceNavTitle, practicePageOnTop } from '../../practice-title.js';


function loadPStats() {
  return uni.getStorageSync('pstats') || { byModule: {}, days: {} };
}
function savePStats(s) {
  uni.setStorageSync('pstats', s);
}

export default {
  data() {
    return {
      askSeenTick: 0,
      counts: [],
      session: false,
      loadState: '',
      loadSecs: 0,
      loadFailMsg: '',
      offline: false,
      leadHint: '',
      items: [],
      idx: 0,
      picked: '',
      multiSel: [],
      right: 0,
      lastModule: null,
      lastSubmodule: null,
      subSelect: null,
      paperSheet: false,
      customOpen: false,
      reportOpen: false,
      reportType: '',
      reportDetail: '',
      reportBusy: false,
      reportTypes: ['答案错误', '解析错误', '题干或选项错字', '图片缺失', '分类错误', '重复题', '其他'],
      papers: [],
      paperRegion: null,
      subProg: {},
      submodules: [],
      streak: 0,
      bestStreak: 0,
      autoSaved: false,
      dueReview: 0,
      resultSent: false,
      percentile: null,
      dailyStats: null,
      dailyErr: false,
      dailyBoard: [],
      redoReport: null,
      fixReport: null,
      backLabel: '返回首页',
      examMode: false,
      examLeft: 0,
      examTimer: null,
      pstats: { byModule: {}, days: {} },
      loginNudgeOff: true,
      pushNudge: false,
      pushNudgeDone: false,
      autoTimer: null,
      cardOpen: false,
      toolsOpen: false,
      quitOpen: false,
      quitSum: null,
      resumeOpen: false,
      resumeAsk: null,
      qsecs: 0,
      qTimer: null,
      fontLv: normFontLv(uni.getStorageSync('fontLv')),
      sfxOn: uni.getStorageSync('sfxOff') ? false : true,
      vibrateOn: uni.getStorageSync('vibrateOff') ? false : true,
      beiMode: false,
      timedMode: uni.getStorageSync('timedMode') ? true : false,
      favs: uni.getStorageSync('favQuestions') || [],
      autoNext: uni.getStorageSync('autoNextOff') ? false : true,
      daily: uni.getStorageSync('dailyPlan') || { days: {} },
      szDaily: loadSzDaily(anonUid()),
      realMode: uni.getStorageSync('realMode') ? true : false,
      realYears: [],
      realRegions: [],
      realYear: uni.getStorageSync('realYear') || null,
      realRegion: uni.getStorageSync('realRegion') || null,
      groupSize: uni.getStorageSync('groupSize') || 10,
      dailyGoal: uni.getStorageSync('dailyGoal') || 20,
      hsRated: {},
      announce: null,
      matOpen: {},
      REASONS: ['粗心大意', '概念不清', '方法不会', '纯蒙的'],
    };
  },
  computed: {
    isMulti() {
      return !!(this.cur && typeof this.cur.answer === 'string' && this.cur.answer.trim().length > 1);
    },
    curAskSeen() {
      void this.askSeenTick;
      return findAskSid(uni.getStorageSync('askSessions'), uni.getStorageSync('askCurSession'), this.cur && !this.cur._sz && this.cur.id);
    },
    moduleBreakdown() {
      const map = {};
      for (const q of this.items) {
        const m = q.module || 'other';
        if (!map[m]) map[m] = { mod: m, n: 0, right: 0 };
        map[m].n++;
        if (q._picked && q._picked === q.answer) map[m].right++;
      }
      const order = ['changshi', 'yanyu', 'shuliang', 'panduan', 'ziliao'];
      return Object.values(map)
        .map((b) => ({ ...b, pct: Math.round((b.right / b.n) * 100) }))
        .sort((a, b) => order.indexOf(a.mod) - order.indexOf(b.mod));
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
    kpChain() {
      const q = this.cur;
      if (!q) return '';
      const parts = [this.modName(q.module)];
      if (q.submodule) parts.push(q.submodule);
      if (q.question_type) {
        const kp = q.question_type.replace(/^.+-/, '');
        if (kp && kp !== q.submodule) parts.push(kp);
      }
      return parts.filter(Boolean).join(' › ');
    },
    qStatLine() {
      return qStatLine(this.cur);
    },
    matInfo() {
      const q = this.cur;
      if (!q || q.module !== 'ziliao' || this.idx === 0) return null;
      const prev = this.items[this.idx - 1];
      if (!prev || prev.module !== 'ziliao' || !sameMaterial(prev.question, q.question)) return null;
      return splitMaterial(q.question);
    },
    qSegs() {
      const q = this.cur;
      if (!q || (!this.picked && !this.beiMode) || this.examMode) return null;
      const src = [q.hs_explanation, q.explanation, q.xp_explanation].filter(Boolean).join('\n');
      if (!src) return null;
      const toks = new Set();
      for (const m of src.match(/\d[\d.,]*[%％万亿倍]?/g) || []) {
        if (m.replace(/[.,]/g, '').length >= 2 && q.question.includes(m)) toks.add(m);
      }
      const CONJ = ['但是', '然而', '因此', '所以', '总之', '可见', '也就是说', '实际上', '换句话说', '不仅', '而且', '否则', '如果', '只有', '除非'];
      for (const c of CONJ) {
        if (src.includes(c) && q.question.includes(c)) toks.add(c);
      }
      if (!toks.size) return null;
      const list = [...toks].sort((a, b) => b.length - a.length).slice(0, 20);
      const text = q.question;
      const isD = (ch) => ch >= '0' && ch <= '9';
      const ivs = [];
      for (const t of list) {
        let p = 0;
        while ((p = text.indexOf(t, p)) !== -1) {
          const pre = text[p - 1];
          const post = text[p + t.length];
          if (!(isD(t[0]) && ((pre && isD(pre)) || (post && (isD(post) || post === '.')))) &&
              !ivs.some((v) => p < v[1] && p + t.length > v[0])) {
            ivs.push([p, p + t.length]);
          }
          p += t.length;
        }
      }
      if (!ivs.length) return null;
      ivs.sort((a, b) => a[0] - b[0]);
      const segs = [];
      let last = 0;
      for (const [s, e] of ivs) {
        if (s > last) segs.push({ t: text.slice(last, s), hl: false });
        segs.push({ t: text.slice(s, e), hl: true });
        last = e;
      }
      if (last < text.length) segs.push({ t: text.slice(last), hl: false });
      return segs;
    },
    targetSecs() {
      const t = { changshi: 40, yanyu: 50, shuliang: 90, panduan: 60, ziliao: 80 };
      return (this.cur && t[this.cur.module]) || 60;
    },
    todayCount() {
      const days = (this.pstats && this.pstats.days) || {};
      return days[dayKey()] || 0;
    },
    cur() {
      return this.items[this.idx] || null;
    },
    wrongCount() {
      return this.items.filter((q) => q._picked && q._picked !== q.answer).length;
    },
    // 完成页登录引导：匿名重度用户（累计≥ 30 题）且未关闭过才显示，返回累计题数
    loginNudgeN() {
      if (this.loginNudgeOff) return 0;
      let n = 0;
      for (const s of Object.values(this.pstats.byModule || {})) n += s.done || 0;
      return n >= 30 ? n : 0;
    },
    // 完成页薄弱考点：本组错题按考点聚合、同名合并，错题数倒序取前 3
    weakSpots() {
      return buildWeakSpots(this.items, (m) => this.modName(m));
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
    isFav() {
      if (!this.cur) return false;
      return this.favs.some((f) => f.question === this.cur.question);
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
    dailyModName() {
      return this.modName(this.dailyModule);
    },
    dailyStreak() {
      let n = 0;
      const d = new Date();
      if (!this.todayDone) d.setDate(d.getDate() - 1);
      while (this.daily.days[dayKey(d)]) {
        n++;
        d.setDate(d.getDate() - 1);
      }
      return n;
    },
    answeredCount() {
      return this.items.filter((q) => q._picked).length;
    },
    qCard() {
      const q = this.cur;
      const m = this.matInfo;
      return {
        id: q.id,
        module: q.module,
        tag3: q.submodule || this.lastSubmodule || '',
        stem: m ? m.stem : String(q.question || ''),
        material: m ? m.material : '',
        images: q.image ? [this.imgUrl(q.image)] : [],
        difficulty: qDifficulty(q),
        difficultyLabel: q.difficulty_label || null,
        accuracy: q.correct_ratio,
        attemptCount: q.attempt_count,
        isReal: !!q.is_real,
        dueMix: !!q.due_mid,
        groupSeq: q.group_seq || 0,
      };
    },
    optList() {
      const o = (this.cur && this.cur.options) || {};
      return Object.keys(o).map((k) => ({ key: k, text: String(o[k] == null ? '' : o[k]) }));
    },
    mainExplanation() {
      const q = this.cur;
      return String(q.hs_explanation || q.explanation || '');
    },
    anaStats() {
      const q = this.cur;
      return { attemptCount: q.attempt_count, accuracy: q.correct_ratio, mostWrong: q.most_wrong, avgSecs: q.avg_secs };
    },
    kpTags() {
      return this.kpChain ? this.kpChain.split(' › ') : [];
    },
    barPrimary() {
      const last = this.idx + 1 >= this.items.length;
      if (this.examMode) return { text: '交卷', disabled: false, go: () => this.confirmFinishExam() };
      if (!this.picked && !this.beiMode) return { text: '请选择答案', disabled: true, go: () => {} };
      return { text: last ? '完成' : '下一题', disabled: false, go: () => this.next() };
    },
    doneStats() {
      return [
        { label: '总用时', value: this.fmtSecs(this.totalSecs) },
        { label: '平均每题', value: this.avgSecs, unit: 's' },
        { label: '错题', value: this.wrongCount, tone: 'bad' },
      ];
    },
    dailyStatsText() {
      const d = this.dailyStats;
      if (!d) return '';
      let s = dailySetLine(d);
      if (d.streak >= 2) s += `，已连续参与 ${d.streak} 天`;
      return s;
    },
    totalSecs() {
      return this.items.reduce((a, q) => a + (q._secs || 0), 0);
    },
    avgSecs() {
      return this.items.length ? Math.round(this.totalSecs / this.items.length) : 0;
    },
    loadHint() {
      if (this.loadState !== 'loading') return '正在准备练习…';
      if (this.loadSecs < 3) return '出题中…';
      if (this.loadSecs < 10) return `题库首次加载稍慢，请稍候…（${this.loadSecs}秒）`;
      return `网络较慢，仍在努力加载…（${this.loadSecs}秒）`;
    },
  },
  onLoad(query) {
    // SEO 题目页「做这道题」直链：/practice?qid=N[&tag3=xx][&module=xx]，该题领跑其后接同考点/模块题包
    const leadQid = leadQidOf(query);
    if (leadQid) {
      let tag3 = query.tag3 || null;
      let module = query.module || null;
      try {
        if (tag3) tag3 = decodeURIComponent(tag3);
        if (module) module = decodeURIComponent(module);
      } catch (e) {
        /* 保留原值 */
      }
      this._urlLaunch = { tag3, module, qid: leadQid, pick: leadPickOf(query), source: query.source || 'seo_q' };
    } else if (query && query.tag3) {
      // SEO 详情页「在线练习此考点」直链：/practice?tag3=xx&module=xx 自动开练
      let tag3 = query.tag3;
      let module = query.module || null;
      try {
        tag3 = decodeURIComponent(tag3);
        if (module) module = decodeURIComponent(module);
      } catch (e) {
        /* 保留原值 */
      }
      this._urlLaunch = { tag3, module, source: query.source || 'seo' };
    } else if (query && query.year && query.module) {
      // SEO 年份真题页直链：/practice?module=xx&real=1&year=xxxx 自动开练该年真题
      let module = query.module;
      try {
        module = decodeURIComponent(module);
      } catch (e) {
        /* 保留原值 */
      }
      this._urlLaunch = { module, year: parseInt(query.year, 10) || null, source: query.source || 'seo' };
    } else if (query && query.daily) {
      // 每日一练直达深链（同题挑战分享/SEO 页 CTA），date 可选指向往期题组
      this._urlLaunch = { daily: true, date: query.date || '', src: query.src || 'link' };
    } else if (query && query.module) {
      // 仅带模块的深链（分享/外链直开）：直接开练该模块
      let module = query.module;
      try {
        module = decodeURIComponent(module);
      } catch (e) {
        /* 保留原值 */
      }
      this._urlLaunch = { module, source: query.source || 'link' };
    }
  },
  onShow() {
    this.askSeenTick++;
    this.backLabel = backLabel(getCurrentPages());
    this._navTitle = '';
    this.syncNavTitle();
    // #ifdef H5
    if (!this._pkHandler && typeof window !== 'undefined') {
      this._pkHandler = (e) => this.onPKeydown(e);
      window.addEventListener('keydown', this._pkHandler);
    }
    // #endif
    this.pstats = loadPStats();
    this.loginNudgeOff = !!getAuthUser() || !!uni.getStorageSync('loginNudgeDismissed');
    this.favs = uni.getStorageSync('favQuestions') || [];
    this.syncFavs();
    this.realMode = uni.getStorageSync('realMode') ? true : false;
    this.realYear = uni.getStorageSync('realYear') || null;
    this.realRegion = uni.getStorageSync('realRegion') || null;
    this.groupSize = uni.getStorageSync('groupSize') || 10;
    this.dailyGoal = uni.getStorageSync('dailyGoal') || 20;
    this.syncDailyGoal();
    if (this._urlLaunch) {
      const q = this._urlLaunch;
      this._urlLaunch = null;
      if (q.daily) {
        this.startDaily(q.date, q.src);
        return;
      }
      this._leadQid = q.qid || null;
      this._leadPick = q.pick || null;
      this.start(q.module, null, null, false, q.year ? true : undefined, q.tag3, q.source, q.year);
      return;
    }
    const launch = uni.getStorageSync('practiceLaunch');
    if (launch && launch.kind) {
      uni.removeStorageSync('practiceLaunch');
      if (launch.kind === 'daily') {
        this.startDaily(launch.date, 'home');
        return;
      }
      if (launch.kind === 'shizheng') {
        this.startShizheng(launch.date);
        return;
      }
      if (launch.kind === 'szreview') {
        this.reviewShizheng();
        return;
      }
      if (launch.kind === 'paper') {
        this.startPaper({ source: launch.source, pid: launch.pid, title: launch.title || '真题卷' }, !!launch.untimed, launch.wrong === true);
        return;
      }
      if (launch.kind === 'reinforce') {
        this.startReinforce(launch);
        return;
      }
      if (launch.kind === 'resume') {
        this.resumeNow();
        return;
      }
      if (launch.kind === 'start') {
        this.start(launch.module || null, launch.submodule || null, launch.count || null, !!launch.adaptive, launch.forceReal, launch.tag3 || null, launch.source || null);
        return;
      }
    }
    const redoSet = uni.getStorageSync('redoSet');
    const redoNote = uni.getStorageSync('redoNote');
    uni.removeStorageSync('redoNote');
    if (redoSet && redoSet.length) {
      uni.removeStorageSync('redoSet');
      this._redoItems = redoSet;
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
      }
      this.items = redoSet.map((q) => ({ ...q, _saved: false }));
      this.idx = 0;
      this.picked = '';
      this.right = 0;
      this.streak = 0;
      this.bestStreak = 0;
      this.autoSaved = false;
      this.resultSent = false;
      this.percentile = null;
      this.lastModule = null;
      this.lastSubmodule = null;
      this._source = 'redo';
      this._ptitle = null;
      this._reinforce = null;
      this.session = true;
      this.startQTimer();
      this.saveSession();
      if (redoNote) uni.showToast({ title: '错题重练开始 · ' + redoNote, icon: 'none', duration: 3500 });
      else uni.showToast({ title: '错题重练开始', icon: 'none' });
      return;
    }
    const preset = uni.getStorageSync('practicePreset');
    if (preset && preset.module) {
      uni.removeStorageSync('practicePreset');
      this.start(preset.module, preset.submodule || null, preset.count || 10, preset.adaptive, undefined, preset.tag3 || null, preset.source || null);
      return;
    }
    const pm = uni.getStorageSync('practiceModule');
    if (pm) {
      uni.removeStorageSync('practiceModule');
      this.start(pm);
      return;
    }
    if (!this.session && !this.tryResume()) {
      // 裸直达路由（无任何启动参数）：直接按上次模块开练，避免停留在无反馈的准备页
      this.start(uni.getStorageSync('lastModule') || null, null, null, false, undefined, null, 'direct');
    }
  },
  onHide() {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.stopQTimer();
    // #ifdef H5
    if (this._pkHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._pkHandler);
      this._pkHandler = null;
    }
    // #endif
  },
  onUnload() {
    // #ifdef H5
    if (this._pkHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._pkHandler);
      this._pkHandler = null;
    }
    // #endif
  },
  watch: {
    items() {
      this.matOpen = {};
    },
    session() {
      this.syncNavTitle();
    },
    idx() {
      this.multiSel = [];
    },
    resumeOpen(v) {
      if (!v && resumeDismissAction(this._resumeAct) === 'cont') this.resumePick(true);
    },
  },
  methods: {
    ...dailyOps,
    ...sessionOps,
    percentileLine,
    exclVisible,
    isExplanationCovered,
    toggleMat() {
      this.matOpen = { ...this.matOpen, [this.idx]: !this.matOpen[this.idx] };
    },
    modName(m) {
      return MODULES[m] ? moduleLabel(m) : m === 'shenlun' ? '申论' : m || '未知';
    },
    // 导航栏标题随会话来源（卷名 / 错题重练 / 每日一练 / 模块 · 专项练习），与小程序 navTitleFor 同口径；非会话态回「刷题」
    syncNavTitle() {
      const title = practiceNavTitle(
        {
          session: this.session,
          ptitle: this._ptitle,
          source: this._source,
          daily: this._daily,
          dailyPast: this._dailyPast,
          shizheng: this._shizheng,
          szPast: this._szPast,
          reinforce: !!this._reinforce,
          module: this.lastModule,
          submodule: this.lastSubmodule,
        },
        (m) => this.modName(m)
      );
      if (title === this._navTitle) return;
      if (!practicePageOnTop(getCurrentPages())) return;
      this._navTitle = title;
      uni.setNavigationBarTitle({ title, fail: () => {} });
    },
    imgUrl(p) {
      return /^https?:/.test(p) ? p : (BASE_URL || '') + p;
    },
    previewImg(p) {
      uni.previewImage({ urls: [this.imgUrl(p)] });
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
    async loadAnnounce() {
      try {
        const d = await request('/api/announcement');
        const item = d.item;
        if (item && uni.getStorageSync('annDismissed') !== String(item.id)) this.announce = item;
      } catch (e) { /* 非关键路径 */ }
    },
    setGoal(g) {
      this.dailyGoal = g;
      uni.setStorageSync('dailyGoal', g);
      request('/api/profile', { method: 'POST', data: { uid: anonUid(), daily_goal: g } }).catch(() => {});
    },
    syncDailyGoal() {
      if (this._goalSynced) return;
      this._goalSynced = true;
      request('/api/profile?uid=' + anonUid())
        .then((d) => {
          const g = adoptServerDailyGoal(this.dailyGoal, d && d.profile);
          if (g != null) {
            this.dailyGoal = g;
            uni.setStorageSync('dailyGoal', g);
          }
          const p = adoptServerPracticePrefs(
            { groupSize: this.groupSize, timedMode: this.timedMode, autoNext: this.autoNext },
            d && d.profile
          );
          if (p.groupSize != null) {
            this.groupSize = p.groupSize;
            uni.setStorageSync('groupSize', p.groupSize);
          }
          if (p.timedMode != null) {
            this.timedMode = p.timedMode;
            uni.setStorageSync('timedMode', p.timedMode ? '1' : '');
          }
          if (p.autoNext != null) {
            this.autoNext = p.autoNext;
            uni.setStorageSync('autoNextOff', p.autoNext ? '' : '1');
          }
        })
        .catch(() => {});
    },
    dismissAnn() {
      if (this.announce) uni.setStorageSync('annDismissed', String(this.announce.id));
      this.announce = null;
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
          this.start(module);
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
        this.start(module);
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
    goMini() {
      uni.navigateTo({ url: '/pkgA/exam/exam?mini=1' });
    },
    goExamList() {
      uni.navigateTo({ url: '/pkgA/exam/list' });
    },
    goSearch() {
      uni.navigateTo({ url: '/pkgA/search/search' });
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
    async startPaper(p, untimed = false, wantWrong = false) {
      if (this._starting) return;
      this._starting = true;
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
      }
      uni.showLoading({ title: '加载试卷…', mask: true });
      try {
        const d = await request('/api/paper_questions?' + paperQuery(p, untimed, anonUid()));
        uni.hideLoading();
        let items = d.items || [];
        let wrongOnly = false;
        if (items.length < 20) {
          uni.showToast({ title: '试卷题目不足，换一张试试', icon: 'none' });
          return;
        }
        const direct = untimed ? paperWrongLaunch(items, wantWrong) : null;
        if (direct) {
          items = direct;
          wrongOnly = true;
        } else if (untimed) {
          const plan = paperContinuePlan(items);
          if (plan.doneN > 0 && plan.remaining.length === 0) {
            const wrong = paperWrongPlan(items);
            if (wrong.length) {
              const pick = await new Promise((resolve) => uni.showActionSheet({
                title: `本卷 ${items.length} 题已全部练过，上次答错 ${wrong.length} 题`,
                itemList: [`只练错题（${wrong.length} 题）`, '重新练一遍'],
                success: (r) => resolve(r.tapIndex),
                fail: () => resolve(-1),
              }));
              if (pick !== 0 && pick !== 1) return;
              if (pick === 0) {
                items = wrong;
                wrongOnly = true;
              }
            } else {
              const again = await new Promise((resolve) => uni.showModal({
                title: '本卷已练完',
                content: `本卷 ${items.length} 题已全部练过，重新练一遍？`,
                confirmText: '重新练', cancelText: '不用了',
                success: (r) => resolve(!!r.confirm),
                fail: () => resolve(false),
              }));
              if (!again) return;
            }
          }
          if (plan.doneN > 0 && plan.remaining.length > 0) {
            const cont = await new Promise((resolve) => uni.showModal({
              title: '继续上次进度？',
              content: `本卷已练过 ${plan.doneN} 题，只练剩下的 ${plan.remaining.length} 题？`,
              confirmText: '只练剩余', cancelText: '从头练',
              success: (r) => resolve(!!r.confirm),
              fail: () => resolve(false),
            }));
            if (cont) items = plan.remaining;
          }
        }
        this.paperSheet = false;
        this._source = untimed ? (p.source || null) : null;
        this._ptitle = untimed ? (p.title || null) : null;
        this._reinforce = null;
        this.items = items;
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.resultSent = false;
        this.percentile = null;
        this.lastModule = null;
        this.lastSubmodule = null;
        this.session = true;
        if (untimed) {
          this.examMode = false;
          if (this.examTimer) clearInterval(this.examTimer);
          this.startQTimer();
          this.saveSession();
          uni.showToast({ title: wrongOnly ? '只练本卷上次答错的题' : p.title + ' 开始：不计时逐题练', icon: 'none', duration: 1800 });
        } else {
          this.examMode = true;
          this.examLeft = 120 * 60;
          this.startQTimer();
          if (this.examTimer) clearInterval(this.examTimer);
          this.examTimer = setInterval(() => {
            this.examLeft--;
            if (this.examLeft <= 0) {
              uni.showToast({ title: '时间到，自动交卷', icon: 'none' });
              this.finishExam();
            }
          }, 1000);
          uni.showToast({ title: p.title + ' 开始：交卷后统一判分', icon: 'none', duration: 1800 });
        }
      } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      } finally {
        this._starting = false;
      }
    },
    confirmFinishExam() {
      const left = this.items.filter((q) => !q._picked).length;
      if (!left) {
        this.finishExam();
        return;
      }
      uni.showModal({
        title: '确认交卷？',
        content: '还有 ' + left + ' 题未作答，交卷后未答题不得分',
        confirmText: '交卷',
        cancelText: '继续作答',
        success: (res) => {
          if (res.confirm) this.finishExam();
        },
      });
    },
    finishExam() {
      if (!this.examMode) return;
      this._wasExam = true;
      this.examMode = false;
      if (this.examTimer) {
        clearInterval(this.examTimer);
        this.examTimer = null;
      }
      this.cardOpen = false;
      this.stopQTimer();
      this.right = this.items.filter((q) => q._picked === q.answer).length;
      this.items.forEach((q) => {
        if (q._picked && q._picked !== q.answer) this.saveExamWrong(q);
      });
      this.idx = this.items.length;
      this.picked = '';
      this.submitResult();
    },
    async saveExamWrong(q) {
      if (q._saved) return;
      const optText = Object.entries(q.options).map(([k, v]) => `${k}.${v}`).join(' ');
      try {
        const res = await request('/api/mistakes', {
          method: 'POST',
          data: {
            uid: anonUid(),
            question_id: q._sz ? null : q.id || null,
            module: q.module,
            question_type: q.question_type || q.submodule,
            question_text: q.question + '\n' + optText,
            user_answer: q._picked,
            correct_answer: q.answer,
            explanation: q.explanation || q.hs_explanation || '',
          },
        });
        q._mid = res.id;
        q._saved = true;
        this.autoSaved = true;
      } catch (e) {
        enqueueMistake({
          uid: anonUid(),
          question_id: q._sz ? null : q.id || null,
          module: q.module,
          question_type: q.question_type || q.submodule,
          question_text: q.question + '\n' + optText,
          user_answer: q._picked,
          correct_answer: q.answer,
          explanation: q.explanation || q.hs_explanation || '',
        });
        q._saved = true;
        this.autoSaved = true;
      }
    },
    openPoster() {
      uni.navigateTo({ url: '/pkgA/social/poster' });
    },
    // 顶栏星星与错题本收藏 tab 同口径：云收藏对账后刷新本机列表（别处收藏过的题星星也亮）
    async syncFavs() {
      const seq = this._favSeq || 0;
      const list = await syncCloudFavs();
      if (!list) return;
      if ((this._favSeq || 0) !== seq) {
        uni.setStorageSync('favQuestions', this.favs);
        return;
      }
      this.favs = list;
    },
    toggleFav() {
      if (!this.cur) return;
      const qid = this.cur._sz ? null : this.cur.id;
      const i = this.favs.findIndex((f) => f.question === this.cur.question);
      if (i >= 0) {
        this.favs.splice(i, 1);
        this._favSeq = (this._favSeq || 0) + 1;
        if (qid) removeFav(qid).catch(() => {});
        uni.showToast({ title: '已取消收藏', icon: 'none', duration: 900 });
      } else {
        const favQ = this.cur.question;
        if (qid) setFav(qid).catch(() => this.favLocalOnly(favQ));
        const { question, options, answer, explanation, hs_explanation, xp_explanation, xp_school, module, submodule, is_real, exam_year, exam_region, image, image_credit } = this.cur;
        this.favs.unshift({ t: Date.now(), id: qid || null, question, options, answer, explanation, hs_explanation, xp_explanation, xp_school, module: this.cur._sz ? '时政' : module, submodule, is_real, exam_year, exam_region, image, image_credit });
        if (this.favs.length > 200) this.favs.length = 200;
        uni.showToast({ title: '已收藏，可在错题本查看', icon: 'none', duration: 900 });
      }
      uni.setStorageSync('favQuestions', this.favs);
    },
    favLocalOnly(question) {
      this.favs = markFavLocalOnly(uni.getStorageSync('favQuestions') || [], question);
      uni.setStorageSync('favQuestions', this.favs);
    },
    async startDaily(archiveDate, src) {
      trackEvent('daily_open', src || 'app', archiveDate ? 'archive:' + archiveDate : '');
      this._daily = true;
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
        uni.showToast({ title: '每日一练按做题模式进行', icon: 'none', duration: 1200 });
      }
      if (this._starting) return;
      const cnDay = cnDayOf(Date.now());
      // 同一天的题组本机已有未做完快照时接着做，不重拉同一组从第 1 题覆盖进度
      const pend = uni.getStorageSync('pendingSession');
      if (!this.session && dailyPendingFor(pend, archiveDate || cnDay, Date.now())) {
        this.adoptLocalPending(pend);
        return;
      }
      this._starting = true;
      let fallback = false;
      uni.showLoading({ title: '出题中…', mask: true });
      try {
        // 首页预取的题组按日确定，date 匹配当日即可复用（秒开，不再等网络）
        const past = archiveDate && archiveDate !== cnDay;
        const cached = uni.getStorageSync('dailySet');
        const d = past
          ? await request('/api/daily_set?date=' + encodeURIComponent(archiveDate))
          : cached && cached.date === cnDay && (cached.items || []).length ? cached : await request('/api/daily_set');
        uni.hideLoading();
        if (!d.items || !d.items.length) throw new Error('empty');
        this._dailyDate = d.date;
        this._dailyPast = d.date !== cnDay;
        this.items = d.items.map((q) => ({ ...q, _saved: false }));
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.resultSent = false;
        this.percentile = null;
        this.lastModule = null;
        this.lastSubmodule = null;
        this._source = 'daily';
        this._ptitle = null;
        this._reinforce = null;
        this._redoItems = null;
        this._reviewed = [];
        this.session = true;
        this.startQTimer();
        this.saveSession();
        uni.showToast({ title: this._dailyPast ? '往期每日一练 · ' + d.date : '每日一练 · 今日全站同题', icon: 'none' });
      } catch (e) {
        // 接口异常回退随机抽题，每日一练不因后端故障不可用；start() 有 _starting 互斥，须在 finally 复位后再回退
        uni.hideLoading();
        this._dailyDate = '';
        this._dailyPast = false;
        fallback = true;
      } finally {
        this._starting = false;
      }
      if (fallback) this.start(this.dailyModule);
    },
    async startShizheng(archiveDate) {
      if (this._starting) return;
      this._starting = true;
      uni.showLoading({ title: '出题中…', mask: true });
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
      }
      try {
        const past = archiveDate && archiveDate !== dayKey();
        const d = await request(past ? '/api/shizheng/daily?date=' + encodeURIComponent(archiveDate) : '/api/shizheng/daily');
        uni.hideLoading();
        if (!d.items || !d.items.length) {
          uni.showToast({ title: '时政题库准备中，敬请期待', icon: 'none' });
          return;
        }
        this._shizheng = true;
        this._szPast = past;
        this._szDate = d.date;
        this.lastModule = '时政';
        this.lastSubmodule = null;
        this.items = d.items.map((q) => this._mapShizheng(q));
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.resultSent = false;
        this.percentile = null;
        this.session = true;
        this.startQTimer();
      } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      } finally {
        this._starting = false;
      }
    },
    async reviewShizheng() {
      const day = dayKey();
      const rec = this.szDaily.days[day];
      if (!rec) {
        this.startShizheng();
        return;
      }
      uni.showLoading({ title: '加载回顾…', mask: true });
      try {
        const d = await request('/api/shizheng/daily');
        uni.hideLoading();
        this._shizheng = false;
        this.lastModule = '时政';
        this.items = (d.items || []).map((q, i) => ({
          ...this._mapShizheng(q),
          _picked: (rec.picks || [])[i] || '',
          _secs: (rec.secs || [])[i] || 0,
          _logged: true,
          _saved: true,
        }));
        this.right = rec.right || 0;
        this.bestStreak = rec.best || 0;
        this.idx = this.items.length;
        this.picked = '';
        this.resultSent = true;
        this.session = true;
        this.stopQTimer();
      } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
    async startReinforce(launch) {
      if (this._starting) return;
      this._starting = true;
      this._source = launch.source || 'reinforce';
      this._ptitle = null;
      uni.showLoading({ title: '组题中…', mask: true });
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
      }
      const uid = anonUid();
      const q =
        '/api/questions?mode=reinforce&limit=' + (launch.count || 5) +
        '&uid=' + encodeURIComponent(uid) +
        (launch.module ? '&module=' + launch.module : '') +
        (launch.submodule ? '&submodule=' + encodeURIComponent(launch.submodule) : '') +
        (launch.tag3 ? '&tag3=' + encodeURIComponent(launch.tag3) : '');
      try {
        const d = await request(q);
        uni.hideLoading();
        if (!d.items || !d.items.length) {
          uni.showToast({ title: '该考点暂无新题，换个考点试试', icon: 'none' });
          return;
        }
        this._reinforce = { tag3: launch.tag3 || null, mastery: launch.mastery };
        this.lastModule = launch.module || null;
        this.lastSubmodule = launch.submodule || null;
        this.items = d.items.map((it) => ({ ...it, _saved: false }));
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.resultSent = false;
        this.percentile = null;
        this.session = true;
        this.startQTimer();
        uni.showToast({ title: '同考点强化开始：均为未做过的新题', icon: 'none', duration: 1500 });
      } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: '组题失败：' + e.message, icon: 'none' });
      } finally {
        this._starting = false;
      }
    },
    loginNudgeGo() {
      trackEvent('login_nudge_click');
      uni.navigateTo({ url: '/pkgA/user/login' });
    },
    dismissLoginNudge() {
      this.loginNudgeOff = true;
      uni.setStorageSync('loginNudgeDismissed', '1');
      trackEvent('login_nudge_dismiss');
    },
    // #ifdef H5
    async initPushNudge() {
      if (this.pushNudge || uni.getStorageSync('pushNudgeOff')) return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return;
      try {
        const { key } = await request('/api/push/pubkey');
        if (!key) return;
        this._pushKey = key;
        const reg = await navigator.serviceWorker.ready;
        if (await reg.pushManager.getSubscription()) return;
        this.pushNudge = true;
        trackEvent('push_nudge_show');
      } catch (e) {
        /* 推送不可用不打扰 */
      }
    },
    async pushNudgeGo() {
      try {
        if ((await requestNotificationPermission()) !== 'granted') {
          uni.showToast({ title: '需要通知权限才能推送', icon: 'none' });
          trackEvent('push_nudge_fail', null, 'denied');
          return;
        }
        const pad = '='.repeat((4 - (this._pushKey.length % 4)) % 4);
        const raw = atob((this._pushKey + pad).replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
        await request('/api/push/subscribe', { method: 'POST', data: { uid: anonUid(), sub: sub.toJSON() } });
        this.pushNudgeDone = true;
        trackEvent('push_nudge_ok');
      } catch (e) {
        uni.showToast({ title: '开启失败，请稍后再试', icon: 'none' });
        trackEvent('push_nudge_fail', null, 'error');
      }
    },
    dismissPushNudge() {
      this.pushNudge = false;
      uni.setStorageSync('pushNudgeOff', '1');
      trackEvent('push_nudge_dismiss');
    },
    // #endif
    reinforceWeak(w) {
      this.startReinforce({ module: w.module, submodule: w.submodule, tag3: w.tag3, count: 5, source: 'session-report' });
    },
    // 完成页归卷态：按卷会话（_ptitle 非空）显卷名与回卷库出路；模板方法调用规避非响应式 _ptitle
    paperFinish() {
      return paperFinishState(this._ptitle);
    },
    // 完成页错题重练入口（按卷/普通练习）：模板方法调用规避非响应式 _ptitle 影响的缓存
    wrongRetry() {
      return wrongRetryPlan(this.items, this._ptitle);
    },
    // 完成页固定底栏两出路（与小程序 doneBarPlan 同口径）；模板方法调用规避非响应式 _ptitle
    doneBar() {
      return doneBarPlan(this.items, this._ptitle, this.beiMode, this.backLabel);
    },
    doneAct(act) {
      if (act === 'redo') this.retryWrong();
      else if (act === 'retry') this.retryGroup();
      else if (act === 'list') this.goExamList();
      else this.quit();
    },
    // 完成页「只重练本组/本卷错题」：就地以本会话答错题重开会话，保留 _source/_ptitle/lastModule；落 pendingSession 供刷新/前进恢复
    retryWrong() {
      const plan = wrongRetryPlan(this.items, this._ptitle);
      const wrong = paperWrongItems(this.items);
      if (!plan || !wrong.length) return;
      this.items = wrong;
      this.idx = 0;
      this.picked = '';
      this.right = 0;
      this.streak = 0;
      this.bestStreak = 0;
      this.autoSaved = false;
      this.resultSent = false;
      this.percentile = null;
      this.session = true;
      this.startQTimer();
      this.saveSession();
      uni.showToast({ title: plan.toast, icon: 'none' });
    },
    // 完成页「再来一组」：错题重练场次重用同一组错题，其余按原模块重新抽题
    retryGroup() {
      if (this._redoItems && this._redoItems.length && !this.lastModule) {
        this.items = this._redoItems.map((q) => ({ ...q, _saved: false }));
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.resultSent = false;
        this.percentile = null;
        this.session = true;
        this.startQTimer();
        this.saveSession();
        uni.showToast({ title: '错题重练再来一组', icon: 'none' });
        return;
      }
      this.start(this.lastModule, this.lastSubmodule);
    },
    beginLoadState() {
      this.loadState = 'loading';
      this.loadSecs = 0;
      this.loadFailMsg = '';
      if (this._loadTick) clearInterval(this._loadTick);
      this._loadTick = setInterval(() => { this.loadSecs++; }, 1000);
    },
    endLoadState(failMsg) {
      if (this._loadTick) { clearInterval(this._loadTick); this._loadTick = null; }
      if (failMsg) {
        this.loadState = 'fail';
        this.loadFailMsg = failMsg;
      } else {
        this.loadState = '';
      }
    },
    async start(module, submodule, count, adaptive, forceReal, tag3, source, year) {
      this._redoItems = null;
      if (this._starting) return;
      this._starting = true;
      this._lastStartArgs = [module, submodule, count, adaptive, forceReal, tag3, source, year];
      this._reviewed = [];
      // 推荐埋点：记录本次练习的入口来源（reco/weak 等），随 answer_log 落库
      this._source = source || null;
      this._ptitle = null;
      this._reinforce = null;
      this.session = false;
      this.beginLoadState();
      this.lastModule = module;
      this.lastSubmodule = submodule || null;
      this.subSelect = null;
      const limit = count || this.groupSize || 10;
      const realQ = forceReal
        ? '&real=1' + (year ? '&year=' + year : '')
        : this.realMode
        ? '&real=1' +
          (this.realYear ? '&year=' + this.realYear : '') +
          (this.realRegion ? '&region=' + encodeURIComponent(this.realRegion) : '')
        : '';
      const uid = uni.getStorageSync('anonUid');
      const uidQ = uid ? '&uid=' + encodeURIComponent(uid) : '';
      // 普通练习混入 ≤2 道本人到期错题（服务端在真题/考点/自适应筛选下忽略）：抽题排除答过的题，否则永远碰不到自己的错题
      const mixQ = uid ? '&mix_due=1' : '';
      const adQ = adaptive && uid ? '&adaptive=1' : '';
      const grpQ = module === 'ziliao' && !submodule && !tag3 && !this.realMode ? '&grouped=1' : '';
      const tagQ = tag3 ? '&tag3=' + encodeURIComponent(tag3) : '';
      const leadQid = this._leadQid || null;
      const leadPick = this._leadPick || null;
      this._leadQid = null;
      this._leadPick = null;
      try {
        // 领跑题（SEO 题目页深链）与题包并行取；取不到（下线/404/超时）静默按原题包开练
        const leadP = leadQid
          ? request('/api/question/' + leadQid, { timeout: 8000 }).then((r) => (r && r.item) || null).catch(() => null)
          : Promise.resolve(null);
        // 首页预取题包命中时零等待开练
        const pre = this.takePrefetch(module, limit, uid, submodule, adaptive, forceReal, tag3);
        let d = pre
          ? { items: pre }
          : await request(
              '/api/questions?limit=' + limit + realQ + uidQ + mixQ + adQ + grpQ + tagQ +
                (module ? '&module=' + module : '') +
                (submodule ? '&submodule=' + encodeURIComponent(submodule) : ''),
              { timeout: 20000 }
            );
        if (!d.items.length && tag3) {
          d = await request(
            '/api/questions?limit=' + limit + realQ + uidQ + adQ +
              (module ? '&module=' + module : '') +
              (submodule ? '&submodule=' + encodeURIComponent(submodule) : '')
          );
        }
        if (!d.items.length && submodule) {
          this.lastSubmodule = null;
          d = await request('/api/questions?limit=' + limit + realQ + uidQ + mixQ + (module ? '&module=' + module : ''));
        }
        if (!d.items.length && this.realMode && (this.realYear || this.realRegion)) {
          uni.showToast({ title: '该年份/地区暂无此模块真题，已放宽筛选', icon: 'none' });
          d = await request('/api/questions?limit=' + limit + '&real=1' + uidQ + (module ? '&module=' + module : ''));
        }
        if (!d.items.length && this.realMode) {
          uni.showToast({ title: '真题还在搜集中，已切回题库模式', icon: 'none' });
          d = await request('/api/questions?limit=' + limit + uidQ + mixQ + (module ? '&module=' + module : ''));
        }
        const lead = await leadP;
        const items = mergeLead(lead, d.items);
        this.leadHint = leadQid && items.length && items[0].id === leadQid ? leadHintText(tag3, items.length) : '';
        if (!items.length) {
          this._starting = false;
          this.endLoadState('该模块暂无题目，换个模块试试');
          return;
        }
        this.items = items.map((q) => ({ ...q, _saved: false }));
        this._plainStart =
          !(submodule || adaptive || forceReal || tag3 || this.realMode) && module !== 'ziliao';
        this._prefetched = false;
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.autoSaved = false;
        this.resultSent = false;
        this.percentile = null;
        this.session = true;
        this.startQTimer();
        this.saveSession();
        uni.setStorageSync('lastModule', module || '');
        this.offline = false;
        this._autoRetried = false;
        flushOfflineQueue();
        // 落地页上点的那个选项就是作答：第 1 题直接出判定，不自动跳题，留给用户看解析
        if (this.leadHint && leadPick && this.cur && this.cur.options && this.cur.options[leadPick] != null) {
          this.$nextTick(() => {
            if (this.idx !== 0 || this.picked) return;
            this.pick(leadPick);
            if (this.autoTimer) {
              clearTimeout(this.autoTimer);
              this.autoTimer = null;
            }
          });
        }
      } catch (e) {
        // 无网络：尝试使用已下载的离线题包（本地判分，作答记录进队列待同步）
        const offItems = module ? drawOffline(module, limit) : null;
        if (offItems && offItems.length) {
          this.items = offItems.map((q) => ({ ...q, _saved: false }));
          this.idx = 0;
          this.picked = '';
          this.right = 0;
          this.streak = 0;
          this.bestStreak = 0;
          this.autoSaved = false;
          this.resultSent = false;
          this.percentile = null;
          this.offline = true;
          this.session = true;
          this.startQTimer();
          uni.setStorageSync('lastModule', module || '');
          uni.showToast({ title: '当前无网络，已切换离线题包模式', icon: 'none', duration: 1800 });
        } else if (!this._autoRetried) {
          this._autoRetried = true;
          setTimeout(() => { if (!this.session) this.retryStart(); }, 1500);
        } else {
          this.endLoadState((e.message || '网络错误') + '（可在我的→离线题包提前下载）');
        }
      } finally {
        if (this.loadState !== 'fail') this.endLoadState();
        this._starting = false;
      }
    },
    recordStat(module, correct, submodule) {
      const s = this.pstats;
      if (!s.byModule[module]) s.byModule[module] = { done: 0, correct: 0 };
      s.byModule[module].done++;
      if (correct) s.byModule[module].correct++;
      if (submodule) {
        if (!s.bySub) s.bySub = {};
        const key = module + '|' + submodule;
        if (!s.bySub[key]) s.bySub[key] = { done: 0, correct: 0 };
        s.bySub[key].done++;
        if (correct) s.bySub[key].correct++;
      }
      const day = dayKey();
      s.days[day] = (s.days[day] || 0) + 1;
      if (!s.daysCorrect) s.daysCorrect = {};
      if (correct) s.daysCorrect[day] = (s.daysCorrect[day] || 0) + 1;
      savePStats(s);
      this.checkBadgeMilestone();
    },
    async checkBadgeMilestone() {
      // 本地连击只做「疑似达标」预检；解锁与展示以服务端 /api/checkin/badges 的 streak 为准
      const MILESTONES = [3, 7, 14, 30, 60, 100];
      const days = this.pstats.days || {};
      let localStreak = 0;
      const d = new Date();
      while (days[dayKey(d)]) {
        localStreak++;
        d.setDate(d.getDate() - 1);
      }
      const seen = Number(uni.getStorageSync('badgeSeenMax') || 0);
      if (!MILESTONES.some((m) => localStreak >= m && m > seen) || this._badgeChecking) return;
      this._badgeChecking = true;
      try {
        const b = await fetchCheckinBadges();
        const srvStreak = b.streak || 0;
        const hit = MILESTONES.filter(
          (m) => srvStreak >= m && m > seen && (b.badges || []).some((x) => x.days === m && x.unlocked)
        ).pop();
        if (hit) {
          uni.setStorageSync('badgeSeenMax', hit);
          trackEvent('badge_unlock', 'badge', String(hit));
          uni.showModal({
            title: '🏅 解锁新徽章！',
            content: `连续打卡 ${srvStreak} 天，解锁 ${hit} 天徽章，坚持就是实力。生成专属海报，晒给考友看？`,
            confirmText: '生成海报',
            cancelText: '稍后再看',
            success: (r) => {
              if (r.confirm) uni.navigateTo({ url: '/pkgA/social/poster?badge=' + hit });
            },
          });
        }
      } catch (e) { /* 非关键路径 */ }
      this._badgeChecking = false;
    },
    fmtSecs(s) {
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },
    startQTimer() {
      this.stopQTimer();
      this.qsecs = 0;
      this.qTimer = setInterval(() => {
        this.qsecs++;
        if (this.timedMode && !this.examMode && !this.beiMode && this.qsecs === this.targetSecs + 1) {
          uni.showToast({ title: '超时了，考场上建议果断猜选跳过', icon: 'none' });
        }
      }, 1000);
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
    toggleVibrate() {
      this.vibrateOn = !this.vibrateOn;
      uni.setStorageSync('vibrateOff', this.vibrateOn ? '' : '1');
      uni.showToast({ title: this.vibrateOn ? '震动已开启' : '震动已关闭', icon: 'none', duration: 800 });
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
      // #ifndef H5
      // 小程序 / App 无 WebAudio 合成能力 → 用触感反馈代替提示音
      uni.vibrateShort({ type: correct ? 'light' : 'heavy', fail: () => {} });
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
      if (this.examMode) return 'cur';
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
      const next = q._reason === rz ? '' : rz;
      q._reason = next;
      this.$forceUpdate();
      if (q._mid) {
        try {
          await request('/api/mistakes/' + q._mid, { method: 'PATCH', data: { uid: anonUid(), error_reason: next } });
        } catch (e) { /* 非关键路径 */ }
      }
    },
    // #ifdef H5
    onPKeydown(e) {
      if (typeof window === 'undefined' || window.innerWidth < 1024) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (!this.session || !this.cur) return;
      if (this.cardOpen || this.toolsOpen || this.reportOpen || this.paperSheet || this.customOpen || this.quitOpen || this.resumeOpen) return;
      const k = e.key;
      if (/^[a-dA-D]$/.test(k) && !this.picked && !this.beiMode) {
        const K = k.toUpperCase();
        if (this.cur.options && this.cur.options[K] != null) {
          e.preventDefault();
          this.pick(K);
        }
      } else if (k === 'Enter' && (this.picked || this.beiMode) && !this.examMode) {
        e.preventDefault();
        this.next();
      } else if (k === 'ArrowLeft' && this.idx > 0) {
        e.preventDefault();
        this.jumpTo(this.idx - 1);
      } else if (k === 'ArrowRight' && this.idx + 1 < this.items.length) {
        e.preventDefault();
        this.jumpTo(this.idx + 1);
      }
    },
    // #endif
    toggleExclOpt(k) {
      if (this.beiMode || this.picked) return;
      this.cur._excl = toggleExcl(this.cur._excl, k, '').excl;
      this.$forceUpdate();
      this.saveSession();
    },
    pick(k) {
      if (this.picked) return;
      if (this.isMulti) {
        this.multiSel = this.multiSel.includes(k) ? this.multiSel.filter((x) => x !== k) : [...this.multiSel, k];
        return;
      }
      this.commitPick(k);
    },
    commitPick(k) {
      if (this.picked) return;
      this.cur._excl = pickWithExcl(this.cur._excl, k);
      this.picked = k;
      this.cur._picked = k;
      this.cur._secs = this.qsecs;
      this.stopQTimer();
      if (this.examMode) {
        setTimeout(() => {
          if (this.idx + 1 < this.items.length) {
            this.next();
            return;
          }
          const un = this.items.findIndex((q) => !q._picked);
          if (un === -1) this.finishExam();
          else {
            uni.showToast({ title: '还有未答题目，答完自动交卷', icon: 'none' });
            this.jumpTo(un);
          }
        }, 200);
        return;
      }
      const correct = k === this.cur.answer.trim();
      // #ifdef H5
      announce(pickAnnounceText(correct, this.cur.answer, this.streak + (correct ? 1 : 0)));
      // #endif
      if (!this.beiMode) this.logAttempts([this.cur]);
      this.recordStat(this.cur.module, correct, this.cur.submodule);
      this.playSfx(correct);
      if (this.vibrateOn) {
        try { uni.vibrateShort({ type: correct ? 'light' : 'medium', fail: () => {} }); } catch (e) { /* 不支持则忽略 */ }
      }
      if (correct) {
        this.right++;
        this.streak++;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        const s = this.pstats;
        if (this.streak > (s.bestStreak || 0)) {
          s.bestStreak = this.streak;
          savePStats(s);
        }
        if (this.autoNext) {
          this.autoTimer = setTimeout(() => {
            this.autoTimer = null;
            if (this.picked === k) this.next();
          }, 1200);
        }
      } else {
        this.streak = 0;
        this.saveWrong();
        this.$nextTick(() => this.revealAfter());
      }
      this.saveSession();
    },
    // 答错时把「正确答案 + 解析」卡开头顶到判分横幅之上，否则在小屏上被横幅盖住看不到
    revealAfter() {
      try {
        const q = uni.createSelectorQuery().in(this);
        q.select('.after').boundingClientRect();
        q.selectViewport().scrollOffset();
        q.exec((res) => {
          const rect = res && res[0];
          if (!rect) return;
          const winH = uni.getSystemInfoSync().windowHeight || 0;
          const visibleBottom = winH - 150;
          const want = rect.top + 220;
          if (want <= visibleBottom) return;
          const cur = (res[1] && res[1].scrollTop) || 0;
          uni.pageScrollTo({ scrollTop: Math.max(0, cur + want - visibleBottom), duration: 200 });
        });
      } catch (e) {
        /* 不支持则不滚 */
      }
    },
    startDefault() {
      if (this.session) return;
      this.start(uni.getStorageSync('lastModule') || null, null, null, false, undefined, null, 'direct');
    },
    async relinkWrongMids() {
      const lost = unlinkedWrongItems(this.items);
      if (!lost.length) return;
      const items = this.items;
      let d;
      try {
        d = await request('/api/mistakes?uid=' + anonUid());
      } catch (e) { return; }
      const pre = lost.filter((q) => q._reason).map((q) => [q, q._reason]);
      if (this.items !== items || !relinkMistakeIds(items, d && d.items)) return;
      // 回填前用户已在本地选了错因：补发一次 PATCH
      pre.forEach(([q, rz]) => {
        if (q._mid && q._reason === rz) request('/api/mistakes/' + q._mid, { method: 'PATCH', data: { uid: anonUid(), error_reason: rz } }).catch(() => {});
      });
      this.$forceUpdate();
      if (this.session && items.some((x) => !x._picked)) this.saveSession();
    },
    async rateHs(q, up) {
      this.hsRated[q.id] = up ? 'up' : 'down';
      try {
        await request('/api/rate', { method: 'POST', data: { question_id: q.id, up } });
      } catch (e) { /* 静默失败 */ }
      uni.showToast({ title: up ? '感谢反馈' : '已记录，我们会核查这条解析', icon: 'none' });
    },
    toggleAutoNext() {
      this.autoNext = !this.autoNext;
      uni.setStorageSync('autoNextOff', this.autoNext ? '' : '1');
      request('/api/profile', { method: 'POST', data: { uid: anonUid(), auto_next: this.autoNext ? 1 : 0 } }).catch(() => {});
      uni.showToast({ title: this.autoNext ? '答对自动跳下一题' : '答对后停留看解析', icon: 'none', duration: 1200 });
    },
    toggleTimed() {
      this.timedMode = !this.timedMode;
      uni.setStorageSync('timedMode', this.timedMode ? '1' : '');
      request('/api/profile', { method: 'POST', data: { uid: anonUid(), timed_mode: this.timedMode ? 1 : 0 } }).catch(() => {});
      uni.showToast({ title: this.timedMode ? '限时训练开启：按考场建议用时倒计时' : '已关闭限时训练', icon: 'none', duration: 1500 });
    },
    toggleBei() {
      this.beiMode = !this.beiMode;
      uni.setStorageSync('beiMode', this.beiMode ? '1' : '');
      uni.showToast({ title: this.beiMode ? '背题模式：直接看答案解析，不计入正确率' : '已切回做题模式', icon: 'none', duration: 1500 });
    },
    hasKey(ans, k) {
      return typeof ans === 'string' && ans.indexOf(k) !== -1;
    },
    ansKeys(ans) {
      return typeof ans === 'string' ? ans.trim().split('') : [];
    },
    optClass(k) {
      if (this.examMode) return this.hasKey(this.picked, k) || this.multiSel.includes(k) ? 'sel' : '';
      if (this.beiMode) return this.hasKey(this.cur.answer, k) ? 'right' : '';
      if (!this.picked) return this.multiSel.includes(k) ? 'sel' : '';
      if (this.hasKey(this.cur.answer, k)) return 'right';
      if (this.hasKey(this.picked, k)) return 'wrong';
      return 'dim';
    },
    confirmMulti() {
      if (this.picked || !this.multiSel.length) return;
      const k = Object.keys(this.cur.options || {}).filter((x) => this.multiSel.includes(x)).join('');
      this.multiSel = [];
      this.commitPick(k);
    },
    async saveWrong() {
      const q = this.cur;
      if (q._saved) return;
      const optText = Object.entries(q.options).map(([k, v]) => `${k}.${v}`).join(' ');
      try {
        const res = await request('/api/mistakes', {
          method: 'POST',
          data: {
            uid: anonUid(),
            question_id: q._sz ? null : q.id || null,
            module: q.module,
            question_type: q.question_type || q.submodule,
            question_text: q.question + '\n' + optText,
            user_answer: this.picked,
            correct_answer: q.answer,
            explanation: q.explanation || q.hs_explanation || '',
          },
        });
        q._mid = res.id;
        if (q._reason) {
          request('/api/mistakes/' + q._mid, { method: 'PATCH', data: { uid: anonUid(), error_reason: q._reason } });
        }
        q._saved = true;
        this.autoSaved = true;
      } catch (e) {
        // 断网：错题进本地队列，联网后补传
        enqueueMistake({
          uid: anonUid(),
          question_id: q._sz ? null : q.id || null,
          module: q.module,
          question_type: q.question_type || q.submodule,
          question_text: q.question + '\n' + optText,
          user_answer: this.picked,
          correct_answer: q.answer,
          explanation: q.explanation || q.hs_explanation || '',
        });
        q._saved = true;
        this.autoSaved = true;
      }
      // 回包晚于作答时的 saveSession，补写快照让 _mid/_saved 跨退出/刷新不丢（否则恢复后错因自评无 mid 可 PATCH）
      if (this.session && this.items.some((x) => !x._picked)) {
        this.saveSession();
        return;
      }
      // 已「退出并保留」才回包：直接补进已存快照；「不保留」快照已清则不重建
      const kept = patchPendingMistake(uni.getStorageSync('pendingSession'), q);
      if (kept) uni.setStorageSync('pendingSession', kept);
    },
    shareResult() {
      if (this._dailyDoneDate && (this.dailyStats || this.dailyErr)) {
        const ds = this.dailyStats || {};
        let txt = '我完成了答岸 ' + this._dailyDoneDate + ' 每日一练（全站同题 ' + this.items.length + ' 题），答对 ' + this.right + ' 题';
        txt += dailySetShareTail(ds);
        if (ds.streak >= 2) txt += '，已连续参与 ' + ds.streak + ' 天';
        txt += '！同题挑战我：https://kaogong.zalize.com/#/pages/practice/practice?daily=1&src=share';
        trackEvent('share_result_copy', 'practice', 'daily');
        uni.setClipboardData({
          data: txt,
          success: () => uni.showToast({ title: '成绩已复制，去粘贴给研友吧', icon: 'none', duration: 1600 }),
        });
        return;
      }
      const pct = Math.round((this.right / this.items.length) * 100);
      const paperBase = paperShareText(this._ptitle, this.items.length, pct);
      let txt =
        paperBase ||
        '我在答岸刷了 ' + this.items.length + ' 道' + (this.lastModule ? this.modName(this.lastModule) : '行测') + '题，正确率 ' + pct + '%';
      if (this.bestStreak >= 3) txt += '，最高连对 ' + this.bestStreak + ' 题';
      txt += percentileShareTail(this.percentile);
      txt += paperBase ? '！也来练这套卷：https://kaogong.zalize.com/#/pkgA/exam/list' : '！一起来刷：https://kaogong.zalize.com';
      trackEvent('share_result_copy', 'practice', paperBase ? 'paper' : this.lastModule || null);
      uni.setClipboardData({
        data: txt,
        success: () => uni.showToast({ title: '成绩已复制，去粘贴给研友吧', icon: 'none', duration: 1600 }),
      });
    },
    reportQuestion() {
      const q = this.cur;
      if (!q || !q.id) return;
      this.reportType = '';
      this.reportDetail = '';
      this.reportOpen = true;
    },
    async submitReport() {
      const q = this.cur;
      if (!q || !this.reportType || this.reportBusy) return;
      this.reportBusy = true;
      try {
        await request('/api/question_report', {
          method: 'POST',
          data: { question_id: q.id, uid: anonUid(), type: this.reportType, detail: this.reportDetail.slice(0, 500) },
        });
        q._reported = true;
        this.reportOpen = false;
        uni.showToast({ title: '感谢反馈，我们会尽快核查', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '提交失败：' + e.message, icon: 'none' });
      } finally {
        this.reportBusy = false;
      }
    },
    openSeenAsk() {
      if (!this.curAskSeen) return;
      if (this.curAskSeen.sid > 0) uni.setStorageSync('askOpenSid', this.curAskSeen.sid);
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    deepExplain() {
      const q = this.cur;
      const text = askPrefill(q.question, q.options);
      if (!text) return;
      uni.setStorageSync('redoQuestion', text);
      const qid = q._sz ? 0 : askQid(q.id);
      if (qid) uni.setStorageSync('redoQid', qid);
      else uni.removeStorageSync('redoQid');
      const ans = askAnswerLetter(this.picked);
      if (ans) uni.setStorageSync('redoAnswer', ans);
      else uni.removeStorageSync('redoAnswer');
      trackEvent('practice_ask_click', q.module || '', q._sz ? 'sz' : String(qid || ''));
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    goBook() {
      uni.switchTab({ url: '/pages/book/book' });
    },
    goShenlun() {
      uni.navigateTo({ url: '/pkgA/shenlun/shenlun' });
    },
    next() {
      if (this.autoTimer) {
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
      }
      this.idx++;
      this.picked = (this.items[this.idx] && this.items[this.idx]._picked) || '';
      this.saveSession();
      if (this.session && this.idx >= this.items.length - 3) this.prefetchNextGroup();
      if (this.cur && !this.picked) this.startQTimer();
      else this.stopQTimer();
      if (!this.cur) {
        this.markDailyDone();
        this.markShizhengDone();
        this.submitResult();
      }
    },
    async submitResult() {
      if (this.beiMode || this.resultSent || !this.items.length) return;
      this.dailyStats = null;
      this.dailyErr = false;
      this.resultSent = true;
      this.dailyBoard = [];
      this.pushNudge = false;
      this.pushNudgeDone = false;
      this.dueReview = 0;
      if (this.loginNudgeN) trackEvent('login_nudge_show');
      uni.removeStorageSync('pendingSession');
      this.clearServerProgress();
      try {
        const hist = uni.getStorageSync('practiceHistory') || [];
        hist.unshift({
          t: Date.now(),
          uid: anonUid(),
          module: this.lastModule || '',
          n: this.items.length,
          correct: this.right,
          secs: this.totalSecs,
          exam: this._wasExam ? (this.items.length > 50 ? 'full' : 'mini') : '',
        });
        uni.setStorageSync('practiceHistory', hist.slice(0, 100));
      } catch (e) { /* 非关键路径 */ }
      this._wasExam = false;
      try {
        const d = await request('/api/practice_result', {
          method: 'POST',
          data: { uid: anonUid(), module: this.lastModule || '', n: this.items.length, correct: this.right, secs: this.totalSecs }
        });
        if (d.percentile != null) this.percentile = d.percentile;
      } catch (e) { /* 非关键路径 */ }
      await this.logAttempts(this.items);
      await this.syncRedoReviews();
      this.loadDueReview();
      // #ifdef H5
      if (this.items.length >= 5) this.initPushNudge();
      // #endif
    },
    // 复习推进由 /api/answer_log 服务端统一完成（任何场次答对曾错题都算）；这里只等在途落库请求回来，汇总效果报告
    async syncRedoReviews() {
      this.redoReport = null;
      this.fixReport = null;
      try { await Promise.all((this._logPending || []).map((p) => p.catch(() => null))); } catch (e) { /* 非关键路径 */ }
      this._logPending = [];
      const reviewed = this._reviewed || [];
      this._reviewed = [];
      const isRedo = this._redoItems && this._redoItems.length && !this.lastModule;
      if (isRedo) {
        const answered = this.items.filter((q) => q._picked && q.mistake_id);
        if (!answered.length) return;
        const fixed = answered.filter((q) => q._picked === q.answer).length;
        this.redoReport = { fixed, still: answered.length - fixed, mastered: reviewedMasteredCount(reviewed) };
        return;
      }
      if (reviewed.length) this.fixReport = { n: reviewed.length, mastered: reviewedMasteredCount(reviewed) };
    },
    async loadDueReview() {
      try {
        const r = await request('/api/review?uid=' + encodeURIComponent(anonUid()));
        this.dueReview = r.total || (r.items || []).length;
      } catch (e) { /* 非关键路径 */ }
    },
    fixReportText,
    goReview() {
      trackEvent('review_entry_click', 'practice_done');
      uni.setStorageSync('autoStartReview', 1);
      uni.switchTab({ url: '/pages/book/book' });
    },
    async logAttempts(qs) {
      try {
        let uid = uni.getStorageSync('anonUid');
        if (!uid) {
          uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
          uni.setStorageSync('anonUid', uid);
        }
        const pending = qs.filter((q) => q._picked && !q._logged);
        const items = pending.map((q) => ({
          qid: q._sz ? null : q.id || null,
          mid: q.mistake_id || q.due_mid || undefined,
          module: q.module || this.lastModule || null,
          submodule: q.submodule || null,
          correct: q._picked === q.answer,
          secs: q._secs || 0,
          picked: q._picked,
          source: this._source || null,
        }));
        if (items.length) {
          // 先标记再发请求，避免请求在途期间并发调用重复落库
          pending.forEach((q) => { q._logged = true; });
          const p = request('/api/answer_log', { method: 'POST', data: { uid, items } });
          (this._logPending = this._logPending || []).push(p);
          try {
            const r = await p;
            if (r && Array.isArray(r.reviewed) && r.reviewed.length) {
              this._reviewed = (this._reviewed || []).concat(r.reviewed);
              // 回包晚于作答时的 saveSession，补写快照让 reviewed 跨刷新不丢；已全答完则不重复清快照
              if (this.session && this.items.some((q) => !q._picked)) this.saveSession();
            }
          } catch (err) {
            // 断网：进本地队列，恢复网络后自动同步（按 key 去重）
            enqueueAnswers(uid, items.map((it, i) => ({ ...it, t: Date.now() + i })));
          }
        }
      } catch (e) { /* 非关键路径 */ }
    },
    quit() {
      const sum = quitSummary(this.items, this.session && !this.examMode && !this.beiMode && !this._shizheng);
      if (!sum) {
        this.leave(false);
        return;
      }
      this.quitSum = sum;
      this.quitOpen = true;
    },
    leave(keep) {
      if (!this.beiMode && this.items.length) this.logAttempts(this.items);
      this._reviewed = [];
      this._logPending = [];
      if (keep) {
        clearTimeout(this._ppTimer);
        this.pushPracticeProgress();
      } else {
        uni.removeStorageSync('pendingSession');
        if (!this.beiMode && !this.examMode && !this._shizheng) this.clearServerProgress();
      }
      this.examMode = false;
      if (this.examTimer) {
        clearInterval(this.examTimer);
        this.examTimer = null;
      }
      this.session = false;
      this.items = [];
      this.idx = 0;
      this.picked = '';
      this.cardOpen = false;
      this.leadHint = '';
      this.stopQTimer();
      this.pstats = loadPStats();
      // H5 的 navigateBack 只是 history.go(-1) 且永不 fail：深链直达（页面栈仅 1 页）时会回到站外/整页重载
      if (getCurrentPages().length > 1) uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/home/home' }) });
      else uni.switchTab({ url: '/pages/home/home' });
    },
  },
};
</script>

<style scoped>
.page { padding: var(--sp-16) var(--page-x) var(--sp-24); }
.page.has-bar { padding-bottom: calc(var(--bar-h) + var(--sp-24) + env(safe-area-inset-bottom, 0px)); }
.pskel { display: flex; flex-direction: column; align-items: center; gap: var(--sp-12); }
.pskel :deep(.kg-skel) { width: 100%; }
.pskel-hint { font-size: var(--fs-sub); color: var(--ink-2); }

/* 顶栏 */
.modechips { display: flex; flex-wrap: wrap; gap: var(--sp-8); margin-bottom: var(--sp-8); }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-12); min-height: var(--hit-min); margin-bottom: var(--sp-12); }
.top-mod { display: inline-flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); min-width: 0; }
.pos { font-size: var(--fs-sub); color: var(--ink-2); }
.hstats { display: flex; align-items: center; gap: var(--sp-8); flex-shrink: 0; }
.timer { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.timer.examleft, .timer.overtime { color: var(--bad-strong); }
.cnt { font-size: var(--fs-sub); font-weight: 500; }
.cnt.okc { color: var(--ok-strong); }
.cnt.badc { color: var(--bad-strong); }
.cnt.fire { display: inline-flex; align-items: center; gap: var(--sp-4); color: var(--streak); }
.icon-btn { width: var(--hit-min); height: var(--hit-min); display: flex; align-items: center; justify-content: center; border-radius: var(--r-full); margin-right: calc(-1 * var(--sp-8)); }
.tool-hover { background: var(--fill); }
.kg-tool.on { background: var(--warn-soft); }

/* 题面 */
.qhl { background: var(--warn-soft); color: var(--warn-strong); border-radius: var(--r-xs); padding: 0 2px; font-weight: 600; }
.qhl-tip { display: block; margin: var(--sp-8) 0 var(--sp-12); font-size: var(--fs-caption); color: var(--warn-strong); }
.img-credit { display: block; margin-bottom: var(--sp-12); font-size: var(--fs-caption); color: var(--ink-3); }

/* 作答后 */
.after { display: flex; flex-direction: column; gap: var(--sp-12); margin-top: var(--sp-12); }
.reasons { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-8); }
.rz-t { font-size: var(--fs-sub); color: var(--ink-2); margin-right: var(--sp-4); }
.rz {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 var(--sp-16); border-radius: var(--r-full);
  border: 1px solid var(--line); background: var(--card); font-size: var(--fs-sub); color: var(--ink-2);
}
.rz.on { border-color: var(--brand); background: var(--brand-soft); color: var(--brand-text); font-weight: 600; }
.tm-cmp { display: block; margin-bottom: var(--sp-8); font-size: var(--fs-sub); color: var(--ok-strong); }
.tm-cmp.over { color: var(--bad-strong); }
.hs-rate { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-8); }
.hs-rate-t, .hs-rate-done { font-size: var(--fs-sub); color: var(--ink-2); margin-right: var(--sp-4); }
.xp-k { display: block; font-size: var(--fs-sub); font-weight: 600; color: var(--warn-strong); margin-bottom: var(--sp-4); }
.xp-b { display: block; font-size: var(--fs-body); color: var(--ink-2); line-height: var(--lh-question); white-space: pre-wrap; }
.multi-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); margin: var(--sp-12) 0 var(--sp-4); }
.multi-hint { font-size: var(--fs-caption); color: var(--ink-3); }
.deep-acts { display: flex; flex-direction: column; align-items: center; gap: var(--sp-8); }
.deep-acts :deep(.kg-btn--block) { width: 100%; }

/* 答题卡 */
.acard-grid { display: flex; flex-wrap: wrap; gap: var(--sp-8); padding: var(--sp-4) 0 var(--sp-12); }
.acard-n {
  width: var(--acard-cell); height: var(--acard-cell); line-height: var(--acard-cell); text-align: center; border-radius: var(--r-full);
  background: var(--fill); border: 1px solid var(--line); font-size: var(--fs-sub); color: var(--ink-2); box-sizing: border-box;
}
.acard-n.ok { background: var(--ok-soft); border-color: var(--ok); color: var(--ok-strong); }
.acard-n.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad-strong); }
.acard-n.skip { background: var(--fill); color: var(--ink-3); }
.acard-n.cur { box-shadow: 0 0 0 2px var(--brand-soft-2); border-color: var(--brand); color: var(--brand-text); }
.acard-foot { display: block; font-size: var(--fs-sub); color: var(--ink-3); padding: var(--sp-4) 0 var(--sp-12); }

/* 工具 / 纠错 sheet */
.tool-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-12); min-height: var(--cell-h); border-bottom: 1px solid var(--line); }
.tool-row:last-child { border-bottom: 0; }
.tool-name { font-size: var(--fs-body); color: var(--ink); }
.tool-val { font-size: var(--fs-sub); color: var(--ink-3); flex-shrink: 0; }
.tool-val.on { color: var(--brand-text); font-weight: 600; }
.quit-tip { display: block; font-size: var(--fs-sub); color: var(--ink-3); line-height: 1.6; padding: var(--sp-4) 0 var(--sp-8); }
.sheet-acts { display: grid; gap: var(--sp-8); }
.rp-types { display: flex; flex-wrap: wrap; gap: var(--sp-8); margin-bottom: var(--sp-16); }
.rp-detail {
  width: 100%; box-sizing: border-box; min-height: 96px; background: var(--fill); border-radius: var(--r-sm);
  padding: var(--sp-12); font-size: var(--fs-body); color: var(--ink); margin-bottom: var(--sp-16);
}

/* 结算段 */
.sec { margin-top: var(--card-gap); }
.hero-s { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); color: var(--on-brand); opacity: 0.85; }
.sec-h { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); }
.sec-t { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); margin-bottom: var(--sp-8); }
.sec-r { font-size: var(--fs-sub); font-weight: 600; color: var(--brand-text); }
.sec-tip { display: block; margin-top: var(--sp-8); font-size: var(--fs-caption); color: var(--ink-3); line-height: 1.6; }
.dsb-row { display: flex; align-items: center; gap: var(--sp-12); min-height: 40px; }
.dsb-name { flex: 1; min-width: 0; font-size: var(--fs-body); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsb-score { flex-shrink: 0; font-size: var(--fs-sub); color: var(--ink-2); }
.fr-t { font-size: var(--fs-sub); color: var(--ink-2); line-height: 1.6; }
.wr-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-12); min-height: var(--hit-min); }
.wr-l { display: flex; flex-direction: column; gap: var(--sp-4); min-width: 0; }
.wr-name { font-size: var(--fs-body); font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wr-meta { font-size: var(--fs-caption); color: var(--bad-strong); }
.mb-row { display: flex; align-items: center; gap: var(--sp-12); min-height: 32px; }
.mb-name { width: 64px; flex-shrink: 0; font-size: var(--fs-sub); color: var(--ink); }
.mb-bar { flex: 1; }
.mb-pct { width: 96px; flex-shrink: 0; text-align: right; font-size: var(--fs-caption); color: var(--ink-2); }
.nudge-t { display: block; font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.nudge-s { display: block; margin-top: var(--sp-4); font-size: var(--fs-caption); color: var(--ink-2); }
.done-acts { display: flex; flex-direction: column; gap: var(--sp-12); margin-top: var(--sp-24); }
/* 结算底栏：主按钮文案带题数（「只重练本组错题（N 题）」）时给主位更多宽度，375 不换行 */
.done-bar.done-bar--long :deep(.kg-btn--primary) { flex: 1.7; }
.done-bar :deep(.kg-btn) { min-width: 0; }

/* #ifdef H5 */
.page :deep(.kg-two__aside) { display: none; }
.side-card { margin-bottom: var(--card-gap); }
.side-h { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-8); }
.side-t { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.side-grid { max-height: 46vh; overflow-y: auto; }
.kbd-row { display: flex; align-items: center; gap: var(--sp-4); margin-top: var(--sp-8); }
.kbd {
  display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 var(--sp-4); box-sizing: border-box;
  background: var(--fill); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: var(--r-xs); font-size: var(--fs-caption); font-weight: 600; color: var(--ink-2);
}
.kbd-d { font-size: var(--fs-caption); color: var(--ink-2); margin-left: var(--sp-4); }
@media (min-width: 1024px) {
  .page { max-width: 1064px; margin: 0 auto; }
  .page.has-bar { padding-bottom: var(--sp-24); }
  .page :deep(.kg-two__aside) { display: block; }
  .kg-tool, .acard-n, .rz, .tool-row, .icon-btn, .top-mod { cursor: pointer; }
}
/* #endif */
</style>
