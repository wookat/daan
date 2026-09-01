<template>
  <view class="wrap" :class="{ 'has-banner': picked, pdesk: session && cur }">
    <!-- 加载/空态（本页仅承载答题会话，选题在首页） -->
    <view v-if="!session && loadState === 'fail'" class="card loadfail">
      <text class="lf-t">题目加载失败</text>
      <text class="lf-s">{{ loadFailMsg || '网络不稳定或服务暂时无响应' }}</text>
      <view class="lf-acts">
        <view class="lf-btn main" @click="retryStart">重试</view>
        <view class="lf-btn" @click="quit">返回首页</view>
      </view>
    </view>
    <view v-else-if="!session" class="pskel">
      <view class="card">
        <view class="sk-row"><view class="sk-line sk-w30" /><view class="sk-line sk-w15" /></view>
        <view class="sk-line sk-w90" />
        <view class="sk-line sk-w80" />
        <view class="sk-line sk-w60" />
        <view v-for="i in 4" :key="i" class="sk-opt" />
      </view>
      <view class="pskel-hint">{{ loadHint }}</view>
      <view class="pskel-quit" @click="quit">返回首页</view>
    </view>
    <!-- 桌面常驻侧栏：答题卡 + 快捷键（仅 H5 ≥1024px 显示） -->
    <!-- #ifdef H5 -->
    <view v-if="session && cur" class="pside">
      <view class="card pside-card">
        <view class="ps-h">答题卡</view>
        <view class="acard-grid">
          <view
            v-for="(q, i) in items"
            :key="i"
            class="acard-n"
            :class="acardClass(q, i)"
            @click="jumpTo(i)"
          >{{ i + 1 }}</view>
        </view>
        <view class="acard-foot">已答 {{ answeredCount }}/{{ items.length }}<template v-if="!examMode"> · 正确 {{ right }}</template></view>
        <button v-if="examMode" class="btn" style="margin-top: 16rpx" @click="confirmFinishExam">交卷</button>
      </view>
      <view class="card pside-card">
        <view class="ps-h">键盘快捷键</view>
        <view class="kbd-row"><text class="kbd">A</text><text class="kbd">–</text><text class="kbd">D</text><text class="kbd-d">选择答案</text></view>
        <view class="kbd-row"><text class="kbd">Enter</text><text class="kbd-d">下一题</text></view>
        <view class="kbd-row"><text class="kbd">←</text><text class="kbd">→</text><text class="kbd-d">上一题 / 下一题</text></view>
      </view>
    </view>
    <!-- #endif -->
    <!-- 答题 -->
    <view v-if="session && cur" class="card pmain">
      <view v-if="beiMode || timedMode || cur.is_real" class="modechips">
        <text v-if="beiMode" class="mchip brand">背题模式</text>
        <text v-if="timedMode && !beiMode && !examMode" class="mchip info">限时训练</text>
        <text v-if="examMode" class="mchip bad">模考态 · 交卷统一判分</text>
      </view>
      <view class="rhead">
        <text class="tag" @click="cardOpen = true">{{ modName(cur.module) }}{{ lastSubmodule ? ' · ' + lastSubmodule : '' }} · {{ idx + 1 }}/{{ items.length }} ▾</text>
        <view class="hstats">
          <text class="timer" :class="{ examleft: examMode, overtime: timedMode && !examMode && qsecs > targetSecs }">{{ examMode ? fmtSecs(examLeft) : timedMode ? (qsecs > targetSecs ? '超时+' + fmtSecs(qsecs - targetSecs) : fmtSecs(targetSecs - qsecs)) : fmtSecs(qsecs) }}</text>
          <text v-if="!examMode" class="cnt okc">✓{{ right }}</text>
          <text v-if="!examMode" class="cnt badc">✗{{ wrongCount }}</text>
          <view v-if="streak >= 3" class="cnt fire"><l-icon name="flame" :size="13" color="#f97316" fill="#fdba74" /><text class="fire-n">{{ streak }}</text></view>
          <view class="fontbtn iconbtn" @click="toggleFav"><l-icon name="star" :size="16" :color="isFav ? '#f59e0b' : '#8a90a0'" :fill="isFav ? '#f59e0b' : 'none'" /></view>
          <text class="fontbtn" @click="toolsOpen = true">···</text>
          <text class="op" @click="quit">退出</text>
        </view>
      </view>
      <view v-if="toolsOpen" class="mask" @click="toolsOpen = false">
        <view class="sheet" @click.stop>
          <view class="sheet-h">
            <text class="sheet-t">练习工具</text>
            <view class="sheet-x" role="button" aria-label="关闭" @click="toolsOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
          </view>
          <view class="tool-row" @click="cycleFont">
            <text class="tool-name">字号大小</text>
            <text class="tool-val">{{ ['小', '标准', '大'][fontLv] || '标准' }} · 点击切换</text>
          </view>
          <view v-if="!examMode" class="tool-row" @click="toggleBei">
            <text class="tool-name">背题模式</text>
            <text class="tool-val" :class="{ on: beiMode }">{{ beiMode ? '已开启' : '已关闭' }}</text>
          </view>
          <view v-if="!examMode" class="tool-row" @click="toggleAutoNext">
            <text class="tool-name">答对自动跳下一题</text>
            <text class="tool-val" :class="{ on: autoNext }">{{ autoNext ? '已开启' : '已关闭' }}</text>
          </view>
          <view v-if="!examMode && !beiMode" class="tool-row" @click="toggleTimed">
            <text class="tool-name">限时训练（按模块建议用时倒计时）</text>
            <text class="tool-val" :class="{ on: timedMode }">{{ timedMode ? '已开启' : '已关闭' }}</text>
          </view>
          <view class="tool-row" @click="toggleSfx">
            <text class="tool-name">答题音效</text>
            <text class="tool-val" :class="{ on: sfxOn }">{{ sfxOn ? '已开启' : '已关闭' }}</text>
          </view>
        </view>
      </view>
      <view class="progress"><view class="pfill" :style="{ width: (idx / items.length) * 100 + '%' }" /></view>
      <view v-if="offline" class="offline-tag"><l-icon name="plane" :size="14" color="#b45309" /> 离线题包模式 · 本地判分，作答记录联网后自动同步（AI 讲解等需联网）</view>
      <view v-if="cur.is_real" class="real-tag">真题{{ cur.exam_year ? ' · ' + cur.exam_year : '' }}{{ cur.exam_region ? ' · ' + cur.exam_region : '' }}</view>
      <view v-if="cur.group_seq" class="grp-tag">同材料题组 {{ cur.group_seq }}</view>
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
      <view class="q" :style="qStyle">
        <template v-if="matInfo && !matOpen[idx]">{{ matInfo.stem }}</template>
        <template v-else-if="qSegs"><text v-for="(s, si) in qSegs" :key="si" :class="{ qhl: s.hl }">{{ s.t }}</text></template>
        <template v-else>{{ cur.question }}</template>
      </view>
      <view v-if="qSegs && qSegs.some(s => s.hl)" class="qhl-tip">已标注题干重点（解析涉及的关键数字/关键词），对照检查是否找对了信息</view>
      <image v-if="cur.image" class="qimg" :src="imgUrl(cur.image)" mode="widthFix" @click="previewImg(cur.image)" />
      <view v-if="cur.image && cur.image_credit" class="qimg-credit">图源：{{ cur.image_credit }}</view>
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
        <text v-if="!examMode && (picked || beiMode) && k === cur.answer" class="omark good">✓</text>
        <text v-else-if="!examMode && picked && k === picked" class="omark badm">✗</text>
      </view>
      <view v-if="(picked || beiMode) && !examMode" class="after">
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
            <text v-if="timedMode && !beiMode && cur._secs != null" class="tm-cmp" :class="{ over: cur._secs > targetSecs }">用时 {{ cur._secs }}s / 目标 {{ targetSecs }}s</text>
          </view>
          <view v-if="qStatLine" class="exp-row">
            <text class="exp-k">全站数据</text>
            <text class="exp-v">{{ qStatLine }}</text>
          </view>
          <view v-if="cur.hs_explanation" class="exp-row col">
            <text class="exp-k hs">花生十三方法解析</text>
            <view class="exp hsx">{{ cur.hs_explanation }}</view>
            <template v-if="cur.xp_explanation">
              <text class="exp-k xp">{{ cur.xp_school || '第二名师视角' }}</text>
              <view class="exp xpx">{{ cur.xp_explanation }}</view>
            </template>
            <view class="hs-rate">
              <text v-if="hsRated[cur.id]" class="hs-rate-done">{{ hsRated[cur.id] === 'up' ? '已反馈：有用' : '已反馈：有误' }}</text>
              <template v-else>
                <view class="hs-rate-btn" @click="rateHs(cur, true)"><l-icon name="thumbs-up" :size="13" color="#2e5bff" /><text>有用</text></view>
                <view class="hs-rate-btn bad" @click="rateHs(cur, false)"><l-icon name="thumbs-down" :size="13" color="#b91c1c" /><text>有误</text></view>
              </template>
            </view>
          </view>
          <view v-if="cur.explanation" class="exp-row col">
            <text class="exp-k">解析</text>
            <view class="exp">{{ cur.explanation }}</view>
          </view>
          <view v-if="kpChain" class="exp-row">
            <text class="exp-k">考点</text>
            <text class="exp-v">{{ kpChain }}</text>
          </view>
          <view v-if="cur.source" class="exp-row">
            <text class="exp-k">来源</text>
            <text class="exp-v">{{ cur.source }}</text>
          </view>
        </view>
        <view class="deep" @click="deepExplain">用花生十三方法详解这道题 ›</view>
        <view v-if="!cur._sz" class="report-link" @click="reportQuestion">{{ cur._reported ? '已提交纠错，感谢反馈' : '题目有问题？纠错' }}</view>
        <q-social-bar v-if="cur.id && !cur._sz" :question-id="cur.id" />
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
      <view v-if="!beiMode && percentile != null" class="beat">本组正确率击败了 {{ percentile }}% 的刷题记录</view>
      <view v-if="!beiMode && dailyStats" class="beat dsbeat">
        <template v-if="dailyStats.already">今日全站同题成绩已记录（首次 {{ dailyStats.my_right }} 对） · {{ dailyStats.participants }} 人完成</template>
        <template v-else-if="dailyStats.beat_pct == null">今日全站同题 · 你是今天第 1 位完成者</template>
        <template v-else>今日全站同题 · {{ dailyStats.participants }} 人完成 · 击败 {{ dailyStats.beat_pct }}%</template>
        <template v-if="dailyStats.streak >= 2"> · 🔥 已连续参与 {{ dailyStats.streak }} 天</template>
      </view>
      <view v-if="!beiMode && dailyStats && dailyBoard.length" class="dsboard">
        <view class="rr-t">今日排行榜<text v-if="dailyStats.my_rank" class="dsb-mine">我的名次：第 {{ dailyStats.my_rank }} 名</text></view>
        <view v-for="r in dailyBoard.slice(0, 10)" :key="r.rank" class="dsb-row">
          <text class="dsb-rank" :class="{ top: r.rank <= 3 }">{{ r.rank }}</text>
          <text class="dsb-name">{{ r.name }}</text>
          <text class="dsb-score">答对 {{ r.right }}/{{ r.total }}<template v-if="r.secs"> · {{ fmtSecs(r.secs) }}</template></text>
        </view>
      </view>
      <view v-if="!beiMode && redoReport" class="redoreport">
        <view class="rr-t">错题重练效果</view>
        <view class="rr-row">
          <view class="rr-cell"><text class="rr-n rr-ok">{{ redoReport.fixed }}</text><text class="rr-l">已纠正</text></view>
          <view class="rr-cell"><text class="rr-n rr-bad">{{ redoReport.still }}</text><text class="rr-l">仍错</text></view>
          <view class="rr-cell"><text class="rr-n rr-master">{{ redoReport.mastered }}</text><text class="rr-l">达成掌握</text></view>
        </view>
        <text class="rr-tip">答对的已推进复习计划<template v-if="redoReport.still">；仍错的已重置复习，明天优先再练</template></text>
        <view class="rr-go" @click="goReview">回错题本查看 ›</view>
      </view>
      <view v-if="!beiMode && !examMode && weakSpots.length" class="weakrf">
        <view class="rr-t">薄弱考点 · 趁热打铁</view>
        <view v-for="w in weakSpots" :key="w.key" class="wr-row">
          <view class="wr-l">
            <text class="wr-name">{{ w.name }}</text>
            <text class="wr-meta">本组错 {{ w.n }} 题</text>
          </view>
          <view class="wr-btn" @click="reinforceWeak(w)">强化 5 道新题</view>
        </view>
      </view>
      <view v-if="!beiMode" class="report">
        <view class="report-row">
          <view class="report-cell"><text class="report-n">{{ fmtSecs(totalSecs) }}</text><text class="report-t">总用时</text></view>
          <view class="report-cell"><text class="report-n">{{ avgSecs }}s</text><text class="report-t">平均每题</text></view>
          <view class="report-cell"><text class="report-n badc2">{{ wrongCount }}</text><text class="report-t">错题</text></view>
        </view>
        <view v-if="moduleBreakdown.length >= 2" class="mb-list">
          <view v-for="b in moduleBreakdown" :key="b.mod" class="mb-row">
            <text class="mb-name">{{ modName(b.mod) }}</text>
            <view class="mb-bar"><view class="mb-fill" :class="{ lo: b.pct < 60, mid: b.pct >= 60 && b.pct < 80 }" :style="{ width: b.pct + '%' }" /></view>
            <text class="mb-pct">{{ b.right }}/{{ b.n }} · {{ b.pct }}%</text>
          </view>
        </view>
        <view class="report-grid">
          <view
            v-for="(q, i) in items"
            :key="i"
            class="acard-n"
            :class="!q._picked ? 'skip' : q._picked === q.answer ? 'ok' : 'bad'"
            @click="jumpTo(i)"
          >{{ i + 1 }}</view>
        </view>
        <view class="report-tip">点题号可回看题目与解析<template v-if="items.some(q => !q._picked)">（灰色为未作答）</template></view>
      </view>
      <view v-if="!beiMode && dueReview" class="duenudge" @click="goReview">
        <view class="duenudge-l">
          <text class="duenudge-t">今日还有 {{ dueReview }} 题到期待复习</text>
          <text class="duenudge-s">趁热打铁，按遗忘曲线巩固一遍</text>
        </view>
        <text class="duenudge-go">去复习 ›</text>
      </view>
      <view v-if="!beiMode && loginNudgeN" class="loginnudge">
        <view class="duenudge-l">
          <text class="duenudge-t">已累计刷 {{ loginNudgeN }} 题 · 登录保进度</text>
          <text class="duenudge-s">错题本、做题记录云同步，换设备/清缓存不丢</text>
        </view>
        <text class="duenudge-go" @click="loginNudgeGo">去登录 ›</text>
        <text class="loginnudge-x" @click="dismissLoginNudge">✕</text>
      </view>
      <!-- #ifdef H5 -->
      <view v-if="!beiMode && pushNudge" class="loginnudge">
        <view class="duenudge-l">
          <text class="duenudge-t">{{ pushNudgeDone ? '已开启每日一练提醒 ✓' : dailyStats && dailyStats.streak >= 2 ? '别断了连续 ' + dailyStats.streak + ' 天' : '开启每日一练提醒' }}</text>
          <text class="duenudge-s">{{ pushNudgeDone ? '明早 8 点推送今日全站同题' : '明早 8 点推送全站同题 10 题，关闭页面也能收到' }}</text>
        </view>
        <text v-if="!pushNudgeDone" class="duenudge-go" @click="pushNudgeGo">开启 ›</text>
        <text v-if="!pushNudgeDone" class="loginnudge-x" @click="dismissPushNudge">✕</text>
      </view>
      <!-- #endif -->
      <button class="btn" @click="retryGroup">再来一组</button>
      <button v-if="!beiMode" class="btn ghost" style="margin-top: 16rpx" @click="shareResult">分享成绩</button>
      <button class="btn plain" style="margin-top: 8rpx" @click="quit">返回首页</button>
    </view>

    <!-- 答题卡 -->
    <view v-if="cardOpen && session" class="mask" @click="cardOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">答题卡</text>
          <view class="sheet-x" role="button" aria-label="关闭" @click="cardOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
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
        <view class="acard-foot">已答 {{ answeredCount }}/{{ items.length }}<template v-if="!examMode"> · 正确 {{ right }}</template></view>
        <button v-if="examMode" class="btn" style="margin-top: 16rpx" @click="confirmFinishExam">交卷</button>
      </view>
    </view>

    <!-- 题目纠错弹层 -->
    <view v-if="reportOpen" class="mask" @click="reportOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">题目纠错</text>
          <view class="sheet-x" role="button" aria-label="关闭" @click="reportOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <view class="rp-types">
          <text
            v-for="t in reportTypes"
            :key="t"
            class="rp-chip"
            :class="{ on: reportType === t }"
            @click="reportType = t"
          >{{ t }}</text>
        </view>
        <textarea
          v-model="reportDetail"
          class="rp-detail"
          placeholder="补充说明（选填，500 字以内）"
          :maxlength="500"
        />
        <button class="btn rp-submit" :disabled="!reportType || reportBusy" @click="submitReport">
          {{ reportBusy ? '提交中…' : '提交纠错' }}
        </button>
      </view>
    </view>

    <!-- 判分横幅 -->
    <view v-if="cur && !examMode && (picked || beiMode)" class="banner" :class="beiMode || picked === cur.answer ? 'bok' : 'bbad'">
      <view class="binfo">
        <text class="btitle">{{ beiMode ? '背题模式 · 答案 ' + cur.answer : picked === cur.answer ? '✓ 回答正确' + (streak >= 3 ? ' · 连对 ' + streak + ' 题！' : '') : '✗ 正确答案 ' + cur.answer }}</text>
        <text v-if="!beiMode && picked !== cur.answer" class="bsub">{{ cur._saved ? '已自动存入错题本' : '' }}</text>
      </view>
      <button v-if="!beiMode && picked === cur.answer && autoTimer" class="bnext bstay" @click="stayHere">看解析</button>
      <button class="bnext" :class="beiMode || picked === cur.answer ? 'nok' : 'nbad'" @click="next">
        {{ idx + 1 < items.length ? '下一题' : '完成' }}
      </button>
    </view>
  </view>
</template>

<script>
import { request, BASE_URL, anonUid, pkNickname, exportPdf, removeFav, setFav, fetchCheckinBadges, getAuthUser, trackEvent, submitDailySet } from '../../api.js';
import { drawOffline, enqueueAnswers, enqueueMistake, flushOfflineQueue } from '../../offline.js';
import { dayKey, loadSzDaily, saveSzDaily } from '../../checkin.js';
import { splitMaterial, sameMaterial } from '../../material.js';
// #ifdef H5
import { requestNotificationPermission } from '../../reminder.js';
import { announce } from '../../a11y-live.js';
import { pickAnnounceText } from '../../live-policy.js';
// #endif

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
      loadState: '',
      loadSecs: 0,
      loadFailMsg: '',
      offline: false,
      items: [],
      idx: 0,
      picked: '',
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
      exporting: false,
      expSheet: true,
      expAns: true,
      expOnly: false,
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
      dailyBoard: [],
      redoReport: null,
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
      qsecs: 0,
      qTimer: null,
      fontLv: uni.getStorageSync('fontLv') || 1,
      sfxOn: uni.getStorageSync('sfxOff') ? false : true,
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
      const q = this.cur;
      if (!q || !q.attempt_count || q.attempt_count < 5 || q.correct_ratio == null) return '';
      const r = q.correct_ratio;
      const stars = '★'.repeat(r > 85 ? 1 : r > 70 ? 2 : r > 55 ? 3 : r > 40 ? 4 : 5);
      let s = `难度${stars} · 全站正确率 ${r}%（${q.attempt_count} 人次）`;
      if (q.most_wrong && q.most_wrong !== q.answer) s += ` · 易错项 ${q.most_wrong}`;
      return s;
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
    // 完成页薄弱考点：本组错题按考点聚合，错题数倒序取前 3
    weakSpots() {
      const map = {};
      for (const q of this.items) {
        if (!q._picked || q._picked === q.answer) continue;
        const key = q.tag3 || q.question_type || q.module || 'other';
        if (!map[key]) {
          const qt = q.question_type || '';
          const sub = qt.includes('-') ? qt.split('-').slice(1).join('-') : qt || null;
          map[key] = { key, name: sub || this.modName(q.module), module: q.module, submodule: sub, tag3: q.tag3 || null, n: 0 };
        }
        map[key].n++;
      }
      return Object.values(map).sort((a, b) => b.n - a.n).slice(0, 3);
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
    qStyle() {
      return { fontSize: [26, 30, 34][this.fontLv] + 'rpx' };
    },
    optStyle() {
      return { fontSize: [25, 29, 33][this.fontLv] + 'rpx' };
    },
    totalSecs() {
      return this.items.reduce((a, q) => a + (q._secs || 0), 0);
    },
    avgSecs() {
      return this.items.length ? Math.round(this.totalSecs / this.items.length) : 0;
    },
    ringStyle() {
      const pct = Math.round((this.right / (this.items.length || 1)) * 100);
      const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
      return { background: `conic-gradient(${color} 0% ${pct}%, var(--brand-soft) ${pct}% 100%)` };
    },
    loadHint() {
      if (this.loadState !== 'loading') return '正在准备练习…';
      if (this.loadSecs < 3) return '出题中…';
      if (this.loadSecs < 10) return `题库首次加载稍慢，请稍候…（${this.loadSecs}秒）`;
      return `网络较慢，仍在努力加载…（${this.loadSecs}秒）`;
    },
  },
  onLoad(query) {
    // SEO 详情页「在线练习此考点」直链：/practice?tag3=xx&module=xx 自动开练
    if (query && query.tag3) {
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
    // #ifdef H5
    if (!this._pkHandler && typeof window !== 'undefined') {
      this._pkHandler = (e) => this.onPKeydown(e);
      window.addEventListener('keydown', this._pkHandler);
    }
    // #endif
    this.pstats = loadPStats();
    this.loginNudgeOff = !!getAuthUser() || !!uni.getStorageSync('loginNudgeDismissed');
    this.favs = uni.getStorageSync('favQuestions') || [];
    this.realMode = uni.getStorageSync('realMode') ? true : false;
    this.realYear = uni.getStorageSync('realYear') || null;
    this.realRegion = uni.getStorageSync('realRegion') || null;
    this.groupSize = uni.getStorageSync('groupSize') || 10;
    this.dailyGoal = uni.getStorageSync('dailyGoal') || 20;
    if (this._urlLaunch) {
      const q = this._urlLaunch;
      this._urlLaunch = null;
      if (q.daily) {
        this.startDaily(q.date, q.src);
        return;
      }
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
        this.startPaper({ source: launch.source, title: launch.title || '真题卷' });
        return;
      }
      if (launch.kind === 'reinforce') {
        this.startReinforce(launch);
        return;
      }
      if (launch.kind === 'start') {
        this.start(launch.module || null, launch.submodule || null, launch.count || null, !!launch.adaptive, launch.forceReal, launch.tag3 || null, launch.source || null);
        return;
      }
    }
    const redoSet = uni.getStorageSync('redoSet');
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
      this.session = true;
      this.startQTimer();
      uni.showToast({ title: '错题重练开始', icon: 'none' });
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
  },
  methods: {
    toggleMat() {
      this.matOpen = { ...this.matOpen, [this.idx]: !this.matOpen[this.idx] };
    },
    modName(m) {
      return NAMES[m] || m || '未知';
    },
    imgUrl(p) {
      return /^https?:/.test(p) ? p : (BASE_URL || '') + p;
    },
    previewImg(p) {
      uni.previewImage({ urls: [this.imgUrl(p)] });
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
    async startPaper(p) {
      if (this._starting) return;
      this._starting = true;
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
      }
      uni.showLoading({ title: '加载试卷…', mask: true });
      try {
        const d = await request('/api/paper_questions?src=' + encodeURIComponent(p.source));
        const items = d.items || [];
        if (items.length < 20) {
          uni.showToast({ title: '试卷题目不足，换一张试试', icon: 'none' });
          return;
        }
        this.paperSheet = false;
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
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      } finally {
        uni.hideLoading();
        this._starting = false;
      }
    },
    async startExam(full) {
      if (this._starting) return;
      this._starting = true;
      if (this.beiMode) {
        this.beiMode = false;
        uni.setStorageSync('beiMode', '');
      }
      uni.showLoading({ title: '组卷中…', mask: true });
      try {
        let items = [];
        if (full) {
          const plan = [
            ['changshi', 15],
            ['yanyu', 30],
            ['shuliang', 10],
            ['panduan', 30],
            ['ziliao', 15],
          ];
          const parts = await Promise.all(
            plan.map(([m, n]) => request('/api/questions?limit=' + n + '&module=' + m + '&real=1').catch(() => ({ items: [] })))
          );
          for (let i = 0; i < plan.length; i++) {
            let got = parts[i].items || [];
            if (got.length < plan[i][1]) {
              const extra = await request('/api/questions?limit=' + (plan[i][1] - got.length) + '&module=' + plan[i][0]).catch(() => ({ items: [] }));
              got = got.concat(extra.items || []);
            }
            items = items.concat(got.slice(0, plan[i][1]));
          }
        } else {
          const d = await request('/api/questions?limit=25');
          items = d.items || [];
        }
        if (items.length < 5) {
          uni.showToast({ title: '题目不足，稍后再试', icon: 'none' });
          return;
        }
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
        this.examMode = true;
        this.examLeft = (full ? 100 : 20) * 60;
        this.startQTimer();
        if (this.examTimer) clearInterval(this.examTimer);
        this.examTimer = setInterval(() => {
          this.examLeft--;
          if (this.examLeft <= 0) {
            uni.showToast({ title: '时间到，自动交卷', icon: 'none' });
            this.finishExam();
          }
        }, 1000);
        uni.showToast({ title: (full ? '全真模考开始' : '模考开始') + '：交卷后统一判分', icon: 'none', duration: 1500 });
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      } finally {
        uni.hideLoading();
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
            explanation: q.explanation || '',
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
          explanation: q.explanation || '',
        });
        q._saved = true;
        this.autoSaved = true;
      }
    },
    openPoster() {
      uni.navigateTo({ url: '/pkgA/social/poster' });
    },
    toggleFav() {
      if (!this.cur) return;
      const qid = this.cur._sz ? null : this.cur.id;
      const i = this.favs.findIndex((f) => f.question === this.cur.question);
      if (i >= 0) {
        this.favs.splice(i, 1);
        if (qid) removeFav(qid).catch(() => {});
        uni.showToast({ title: '已取消收藏', icon: 'none', duration: 900 });
      } else {
        if (qid) setFav(qid).catch(() => {});
        const { question, options, answer, explanation, hs_explanation, xp_explanation, xp_school, module, submodule, is_real, exam_year, exam_region, image, image_credit } = this.cur;
        this.favs.unshift({ t: Date.now(), question, options, answer, explanation, hs_explanation, xp_explanation, xp_school, module: this.cur._sz ? '时政' : module, submodule, is_real, exam_year, exam_region, image, image_credit });
        if (this.favs.length > 200) this.favs.length = 200;
        uni.showToast({ title: '已收藏，可在错题本查看', icon: 'none', duration: 900 });
      }
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
      this._starting = true;
      uni.showLoading({ title: '出题中…', mask: true });
      try {
        // 首页预取的题组按日确定，date 匹配当日即可复用（秒开，不再等网络）
        const cnDay = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
        const past = archiveDate && archiveDate !== cnDay;
        const cached = uni.getStorageSync('dailySet');
        const d = past
          ? await request('/api/daily_set?date=' + encodeURIComponent(archiveDate))
          : cached && cached.date === cnDay && (cached.items || []).length ? cached : await request('/api/daily_set');
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
        this.session = true;
        this.startQTimer();
        uni.showToast({ title: this._dailyPast ? '往期每日一练 · ' + d.date : '每日一练 · 今日全站同题', icon: 'none' });
      } catch (e) {
        // 接口异常回退随机抽题，每日一练不因后端故障不可用
        this._dailyDate = '';
        this._dailyPast = false;
        this.start(this.dailyModule);
      } finally {
        uni.hideLoading();
        this._starting = false;
      }
    },
    markDailyDone() {
      if (!this._daily) return;
      this._daily = false;
      const past = this._dailyPast;
      this._dailyPast = false;
      if (past) {
        // 往期补练：成绩/榜单/streak 均为当日语义，不提交不打卡，完成页走普通成绩展示
        this._dailyDate = '';
        uni.showToast({ title: '往期补练完成', icon: 'none' });
        return;
      }
      this.daily.days[dayKey()] = true;
      uni.setStorageSync('dailyPlan', this.daily);
      uni.showToast({ title: '今日一练完成，打卡成功！', icon: 'none' });
      const date = this._dailyDate;
      this._dailyDate = '';
      if (!date) return;
      this._dailyDoneDate = date;
      submitDailySet({ uid: anonUid(), nickname: pkNickname(), date, right: this.right, total: this.items.length, secs: this.totalSecs })
        .then((d) => {
          this.dailyStats = d;
          // #ifdef H5
          this.initPushNudge();
          // #endif
          return request('/api/daily_set/board').then((b) => { this.dailyBoard = (b && b.items) || []; });
        })
        .catch(() => {});
    },
    _mapShizheng(q) {
      return {
        ...q,
        explanation: (q.explanation || '') + (q.source_note ? '\n【出处】' + q.source_note : ''),
        _sz: true,
        _saved: false,
      };
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
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      } finally {
        uni.hideLoading();
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
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },
    markShizhengDone() {
      if (!this._shizheng) return;
      this._shizheng = false;
      if (this._szPast) {
        this._szPast = false;
        uni.showToast({ title: '往期时政补练完成', icon: 'none' });
        return;
      }
      const day = dayKey();
      this.szDaily.days[day] = { right: this.right, best: this.bestStreak, picks: this.items.map((q) => q._picked || ''), secs: this.items.map((q) => q._secs || 0) };
      saveSzDaily(anonUid(), this.szDaily);
      uni.showToast({ title: '时政每日一练完成！', icon: 'none' });
    },
    async startReinforce(launch) {
      if (this._starting) return;
      this._starting = true;
      this._source = launch.source || 'reinforce';
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
        uni.showToast({ title: '组题失败：' + e.message, icon: 'none' });
      } finally {
        uni.hideLoading();
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
      }
    },
    dismissPushNudge() {
      this.pushNudge = false;
      uni.setStorageSync('pushNudgeOff', '1');
    },
    // #endif
    reinforceWeak(w) {
      this.startReinforce({ module: w.module, submodule: w.submodule, tag3: w.tag3, count: 5, source: 'session-report' });
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
    retryStart() {
      if (this._lastStartArgs) this.start(...this._lastStartArgs);
      else this.start(uni.getStorageSync('lastModule') || null);
    },
    // 练习中场静默预取下一组，「再来一组」命中 prefetchPack 零等待
    prefetchNextGroup() {
      if (!this._plainStart || this._prefetched || this.beiMode || this._daily || this._shizheng) return;
      this._prefetched = true;
      const module = this.lastModule || '';
      const limit = this.groupSize || 10;
      const uid = uni.getStorageSync('anonUid') || '';
      const pk = uni.getStorageSync('prefetchPack');
      if (pk && pk.module === module && pk.limit === limit && pk.uid === uid && Date.now() - pk.ts < 5 * 60 * 1000) return;
      const seen = new Set(this.items.map((q) => q.id));
      request(
        '/api/questions?limit=' + limit + (uid ? '&uid=' + encodeURIComponent(uid) : '') + (module ? '&module=' + module : ''),
        { timeout: 45000 }
      )
        .then((d) => {
          const items = ((d && d.items) || []).filter((q) => !seen.has(q.id));
          if (items.length) uni.setStorageSync('prefetchPack', { module, limit, uid, items, ts: Date.now() });
        })
        .catch(() => {});
    },
    takePrefetch(module, limit, uid, submodule, adaptive, forceReal, tag3) {
      if (submodule || adaptive || forceReal || tag3 || this.realMode) return null;
      const pk = uni.getStorageSync('prefetchPack');
      if (!pk || !pk.items || !pk.items.length) return null;
      if (pk.module !== (module || '') || pk.limit !== limit || pk.uid !== (uid || '')) return null;
      if (Date.now() - pk.ts > 10 * 60 * 1000) return null;
      uni.removeStorageSync('prefetchPack');
      return pk.items;
    },
    async start(module, submodule, count, adaptive, forceReal, tag3, source, year) {
      this._redoItems = null;
      if (this._starting) return;
      this._starting = true;
      this._lastStartArgs = [module, submodule, count, adaptive, forceReal, tag3, source, year];
      // 推荐埋点：记录本次练习的入口来源（reco/weak 等），随 answer_log 落库
      this._source = source || null;
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
      const adQ = adaptive && uid ? '&adaptive=1' : '';
      const grpQ = module === 'ziliao' && !submodule && !tag3 && !this.realMode ? '&grouped=1' : '';
      const tagQ = tag3 ? '&tag3=' + encodeURIComponent(tag3) : '';
      try {
        // 首页预取题包命中时零等待开练
        const pre = this.takePrefetch(module, limit, uid, submodule, adaptive, forceReal, tag3);
        let d = pre
          ? { items: pre }
          : await request(
              '/api/questions?limit=' + limit + realQ + uidQ + adQ + grpQ + tagQ +
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
          d = await request('/api/questions?limit=' + limit + realQ + uidQ + (module ? '&module=' + module : ''));
        }
        if (!d.items.length && this.realMode && (this.realYear || this.realRegion)) {
          uni.showToast({ title: '该年份/地区暂无此模块真题，已放宽筛选', icon: 'none' });
          d = await request('/api/questions?limit=' + limit + '&real=1' + uidQ + (module ? '&module=' + module : ''));
        }
        if (!d.items.length && this.realMode) {
          uni.showToast({ title: '真题还在搜集中，已切回题库模式', icon: 'none' });
          d = await request('/api/questions?limit=' + limit + uidQ + (module ? '&module=' + module : ''));
        }
        if (!d.items.length) {
          this._starting = false;
          this.endLoadState('该模块暂无题目，换个模块试试');
          return;
        }
        this.items = d.items.map((q) => ({ ...q, _saved: false }));
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
        uni.setStorageSync('lastModule', module || '');
        this.offline = false;
        this._autoRetried = false;
        flushOfflineQueue();
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
      q._reason = rz;
      this.$forceUpdate();
      if (q._mid) {
        try {
          await request('/api/mistakes/' + q._mid, { method: 'PATCH', data: { uid: anonUid(), error_reason: rz } });
        } catch (e) { /* 非关键路径 */ }
      }
    },
    // #ifdef H5
    onPKeydown(e) {
      if (typeof window === 'undefined' || window.innerWidth < 1024) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (!this.session || !this.cur) return;
      if (this.cardOpen || this.toolsOpen || this.reportOpen || this.paperSheet || this.customOpen) return;
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
    pick(k) {
      if (this.picked) return;
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
      const correct = k === this.cur.answer;
      // #ifdef H5
      announce(pickAnnounceText(correct, this.cur.answer, this.streak + (correct ? 1 : 0)));
      // #endif
      if (!this.beiMode) this.logAttempts([this.cur]);
      this.recordStat(this.cur.module, correct, this.cur.submodule);
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
        if (this.autoNext) {
          this.autoTimer = setTimeout(() => {
            this.autoTimer = null;
            if (this.picked === k) this.next();
          }, 1200);
        }
      } else {
        this.streak = 0;
        this.saveWrong();
      }
      this.saveSession();
    },
    saveSession() {
      if (this.examMode || this.beiMode || this._shizheng || !this.session || !this.items.length) return;
      if (this.items.every((q) => q._picked)) {
        uni.removeStorageSync('pendingSession');
        return;
      }
      uni.setStorageSync('pendingSession', {
        t: Date.now(),
        items: this.items,
        idx: this.idx,
        right: this.right,
        streak: this.streak,
        bestStreak: this.bestStreak,
        lastModule: this.lastModule,
        lastSubmodule: this.lastSubmodule,
      });
    },
    tryResume() {
      const s = uni.getStorageSync('pendingSession');
      if (!s || !s.items || !s.items.length) return false;
      if (Date.now() - s.t > 24 * 3600 * 1000) {
        uni.removeStorageSync('pendingSession');
        return false;
      }
      const done = s.items.filter((q) => q._picked).length;
      uni.showModal({
        title: '继续上次练习？',
        content: '上次还有一组未做完（' + done + '/' + s.items.length + ' 题），是否继续？',
        confirmText: '继续',
        cancelText: '不用了',
        success: (res) => {
          if (res.confirm) {
            s.items.forEach((q) => { if (q._picked) q._logged = true; });
            this.items = s.items;
            this.idx = Math.min(s.idx, s.items.length - 1);
            this.picked = this.items[this.idx]._picked || '';
            this.right = s.right;
            this.streak = s.streak;
            this.bestStreak = s.bestStreak;
            this.lastModule = s.lastModule;
            this.lastSubmodule = s.lastSubmodule;
            this.autoSaved = false;
            this.resultSent = false;
            this.percentile = null;
            this.session = true;
            this.startQTimer();
          } else {
            uni.removeStorageSync('pendingSession');
            this.start(s.lastModule || uni.getStorageSync('lastModule') || null, null, null, false, undefined, null, 'direct');
          }
        },
      });
      return true;
    },
    async rateHs(q, up) {
      this.hsRated[q.id] = up ? 'up' : 'down';
      try {
        await request('/api/rate', { method: 'POST', data: { question_id: q.id, up } });
      } catch (e) { /* 静默失败 */ }
      uni.showToast({ title: up ? '感谢反馈' : '已记录，我们会核查这条解析', icon: 'none' });
    },
    stayHere() {
      if (this.autoTimer) {
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
      }
    },
    toggleAutoNext() {
      this.autoNext = !this.autoNext;
      uni.setStorageSync('autoNextOff', this.autoNext ? '' : '1');
      uni.showToast({ title: this.autoNext ? '答对自动跳下一题' : '答对后停留看解析', icon: 'none', duration: 1200 });
    },
    toggleTimed() {
      this.timedMode = !this.timedMode;
      uni.setStorageSync('timedMode', this.timedMode ? '1' : '');
      uni.showToast({ title: this.timedMode ? '限时训练开启：按考场建议用时倒计时' : '已关闭限时训练', icon: 'none', duration: 1500 });
    },
    toggleBei() {
      this.beiMode = !this.beiMode;
      uni.setStorageSync('beiMode', this.beiMode ? '1' : '');
      uni.showToast({ title: this.beiMode ? '背题模式：直接看答案解析，不计入正确率' : '已切回做题模式', icon: 'none', duration: 1500 });
    },
    optClass(k) {
      if (this.examMode) return k === this.picked ? 'sel' : '';
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
            uid: anonUid(),
            question_id: q._sz ? null : q.id || null,
            module: q.module,
            question_type: q.question_type || q.submodule,
            question_text: q.question + '\n' + optText,
            user_answer: this.picked,
            correct_answer: q.answer,
            explanation: q.explanation || '',
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
          explanation: q.explanation || '',
        });
        q._saved = true;
        this.autoSaved = true;
      }
    },
    shareResult() {
      if (this.dailyStats && this._dailyDoneDate) {
        let txt = '我完成了错题邦 ' + this._dailyDoneDate + ' 每日一练（全站同题 ' + this.items.length + ' 题），答对 ' + this.right + ' 题';
        if (this.dailyStats.beat_pct != null) txt += '，击败全站 ' + this.dailyStats.beat_pct + '%';
        if (this.dailyStats.streak >= 2) txt += '，已连续参与 ' + this.dailyStats.streak + ' 天';
        txt += '！同题挑战我：https://kaogong.zalize.com/#/pages/practice/practice?daily=1&src=share';
        trackEvent('share_result_copy', 'practice', 'daily');
        uni.setClipboardData({
          data: txt,
          success: () => uni.showToast({ title: '成绩已复制，去粘贴给研友吧', icon: 'none', duration: 1600 }),
        });
        return;
      }
      const pct = Math.round((this.right / this.items.length) * 100);
      let txt =
        '我在错题邦刷了 ' + this.items.length + ' 道' + (this.lastModule ? this.modName(this.lastModule) : '行测') + '题，正确率 ' + pct + '%';
      if (this.bestStreak >= 3) txt += '，最高连对 ' + this.bestStreak + ' 题';
      if (this.percentile != null) txt += '，击败了 ' + this.percentile + '% 的刷题记录';
      txt += '！一起来刷：https://kaogong.zalize.com';
      trackEvent('share_result_copy', 'practice', this.lastModule || null);
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
    deepExplain() {
      const q = this.cur;
      const optText = Object.entries(q.options).map(([k, v]) => `${k}.${v}`).join(' ');
      uni.setStorageSync('redoQuestion', q.question + '\n' + optText);
      uni.switchTab({ url: '/pages/ask/ask' });
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
    goBook() {
      uni.switchTab({ url: '/pages/book/book' });
    },
    goShenlun() {
      uni.navigateTo({ url: '/pkgA/shenlun/shenlun' });
    },
    next() {
      this.saveSession();
      if (this.autoTimer) {
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
      }
      this.idx++;
      this.picked = (this.items[this.idx] && this.items[this.idx]._picked) || '';
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
      this.resultSent = true;
      this.dailyBoard = [];
      this.pushNudge = false;
      this.pushNudgeDone = false;
      this.dueReview = 0;
      if (this.loginNudgeN) trackEvent('login_nudge_show');
      uni.removeStorageSync('pendingSession');
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
          data: { module: this.lastModule || '', n: this.items.length, correct: this.right, secs: this.totalSecs }
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
    // 错题重练场次：答对的题推进 SRS 复习计划（答错走既有自动存错题路径重置复习），并汇总效果报告
    async syncRedoReviews() {
      this.redoReport = null;
      const isRedo = this._redoItems && this._redoItems.length && !this.lastModule;
      if (!isRedo) return;
      const answered = this.items.filter((q) => q._picked && q.mistake_id);
      if (!answered.length) return;
      const uid = anonUid();
      let fixed = 0;
      let still = 0;
      let mastered = 0;
      for (const q of answered) {
        if (q._picked !== q.answer) {
          still++;
          continue;
        }
        fixed++;
        try {
          const r = await request('/api/review/' + q.mistake_id, { method: 'POST', data: { correct: true, uid } });
          if (r && r.mastered) mastered++;
        } catch (e) { /* 非关键路径 */ }
      }
      this.redoReport = { fixed, still, mastered };
    },
    async loadDueReview() {
      try {
        const r = await request('/api/review?uid=' + encodeURIComponent(anonUid()));
        this.dueReview = r.total || (r.items || []).length;
      } catch (e) { /* 非关键路径 */ }
    },
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
          qid: q.id || null,
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
          try {
            await request('/api/answer_log', { method: 'POST', data: { uid, items } });
          } catch (err) {
            // 断网：进本地队列，恢复网络后自动同步（按 key 去重）
            enqueueAnswers(uid, items.map((it, i) => ({ ...it, t: Date.now() + i })));
          }
        }
      } catch (e) { /* 非关键路径 */ }
    },
    quit() {
      if (!this.beiMode && this.items.length) this.logAttempts(this.items);
      uni.removeStorageSync('pendingSession');
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
      this.stopQTimer();
      this.pstats = loadPStats();
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/home/home' }) });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.grid4 { display: flex; padding: 20rpx 8rpx; }
.g4 { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 10rpx 0; }
.g4-ic { width: 88rpx; height: 88rpx; border-radius: 24rpx; display: flex; align-items: center; justify-content: center; margin-bottom: 10rpx; }
.g4-t { font-size: 24rpx; color: var(--ink-2); }
.custom-row { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 28rpx; }
.custom-start { margin-top: 24rpx; background: var(--brand); color: #fff; text-align: center; border-radius: 999rpx; padding: 22rpx 0; font-size: 28rpx; font-weight: 500; }
.exp-opts { display: flex; gap: 12rpx; margin-top: 20rpx; }
.expchip { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--line); border-radius: 12rpx; font-size: 24rpx; color: var(--ink-2); background: var(--fill); }
.expchip.on { border-color: var(--brand-text); color: var(--brand-text); background: var(--brand-soft); font-weight: 600; }
.custom-export { margin-top: 16rpx; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; text-align: center; border: 1rpx solid var(--brand); color: var(--brand-text); border-radius: 999rpx; padding: 20rpx 0; font-size: 27rpx; font-weight: 500; }
.custom-note { margin-top: 14rpx; text-align: center; font-size: 21rpx; color: var(--ink-3); }
.wrap.has-banner { padding-bottom: calc(280rpx + env(safe-area-inset-bottom)); }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 600; margin-bottom: 20rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 24rpx; }
.pskel { padding-top: 8rpx; }
.sk-row { display: flex; justify-content: space-between; gap: 16rpx; }
.sk-line { height: 28rpx; border-radius: 8rpx; background: var(--fill, #eceef3); margin-bottom: 20rpx; animation: sk-pulse 1.2s ease-in-out infinite; }
.sk-w15 { width: 15%; }
.sk-w30 { width: 30%; }
.sk-w60 { width: 60%; }
.sk-w80 { width: 80%; }
.sk-w90 { width: 90%; }
.sk-opt { height: 80rpx; border-radius: 12rpx; background: var(--fill, #eceef3); margin-top: 20rpx; animation: sk-pulse 1.2s ease-in-out infinite; }
@keyframes sk-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
.pskel-hint { text-align: center; color: var(--ink-2); font-size: 26rpx; margin-top: 24rpx; }
.pskel-quit { text-align: center; color: var(--brand-text); font-size: 26rpx; margin-top: 20rpx; min-height: 44px; display: flex; align-items: center; justify-content: center; }
.loadfail { text-align: center; padding: 56rpx 32rpx; }
.lf-t { display: block; font-size: 32rpx; font-weight: 700; color: var(--ink); }
.lf-s { display: block; font-size: 25rpx; color: var(--ink-2); margin-top: 12rpx; line-height: 1.6; }
.lf-acts { display: flex; gap: 20rpx; margin-top: 36rpx; }
.lf-btn { flex: 1; min-height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 16rpx; font-size: 28rpx; font-weight: 600; background: var(--fill, #eceef3); color: var(--ink-2); }
.lf-btn.main { background: var(--brand); color: #fff; }
.goal { margin-bottom: 22rpx; }
.goal-top { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-bottom: 10rpx; flex-wrap: wrap; }
.goal-t { font-size: 24rpx; color: var(--ink-2); }
.goal-set { display: flex; gap: 8rpx; }
.goal-chip { font-size: 22rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 8rpx 20rpx; }
.goal-chip.on { color: #fff; background: var(--brand); border-color: var(--brand-text); }
.goal-bar { height: 12rpx; background: var(--brand-soft); border-radius: 999rpx; overflow: hidden; }
.goal-fill { height: 100%; background: var(--brand); border-radius: 999rpx; transition: width 0.3s; }
.goal-fill.done { background: #16a34a; }
.setrow { display: flex; align-items: center; gap: 18rpx; margin-bottom: 16rpx; flex-wrap: wrap; }
.set-k { font-size: 24rpx; color: var(--ink-2); }
.set-kwrap { display: flex; flex-direction: column; min-width: 150rpx; }
.set-sub { font-size: 19rpx; color: var(--ink-3); margin-top: 2rpx; }
.set-chips { display: flex; gap: 12rpx; flex-wrap: wrap; }
.set-chips.scrollx { flex-wrap: nowrap; overflow-x: auto; max-width: 70%; padding-bottom: 4rpx; }
.set-chips.scrollx .set-chip { flex-shrink: 0; }
.set-chip { font-size: 23rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 12rpx 24rpx; }
.set-chip.on { color: #fff; background: var(--brand); border-color: var(--brand-text); }
.new-tag { font-size: 19rpx; color: #fff; background: #f43f5e; border-radius: 999rpx; padding: 2rpx 12rpx; margin-left: 10rpx; }
.real-tag { display: inline-block; font-size: 21rpx; color: #b45309; background: #fef3c7; border-radius: 8rpx; padding: 4rpx 14rpx; margin-bottom: 10rpx; }
.offline-tag { font-size: 21rpx; color: var(--warn); background: var(--warn-soft); border-radius: 8rpx; padding: 8rpx 14rpx; margin-bottom: 10rpx; line-height: 1.5; }
.mat-fold { display: flex; justify-content: space-between; align-items: center; background: #f0fdfa; border: 1rpx solid #99f6e4; border-radius: 12rpx; padding: 14rpx 20rpx; margin-bottom: 14rpx; }
.mat-fold-t { font-size: 24rpx; color: #0f766e; }
.mat-fold-a { font-size: 24rpx; color: #0d9488; font-weight: 600; flex-shrink: 0; margin-left: 16rpx; }
.grp-tag { display: inline-block; font-size: 21rpx; color: #0e7490; background: #cffafe; border-radius: 8rpx; padding: 4rpx 14rpx; margin-bottom: 10rpx; margin-left: 10rpx; }
.daily { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(120deg, var(--brand), #5c82ff); border-radius: 20rpx; padding: 24rpx 28rpx; margin-bottom: 20rpx; }
.daily.done { background: linear-gradient(135deg, #10b981, #059669); }
.daily.sz { background: linear-gradient(120deg, #d9480f, #f59e0b); }
.daily.sz.done { background: linear-gradient(135deg, #10b981, #059669); }
.daily.sz .daily-go { color: #d9480f; }
.daily.sz.done .daily-go { color: #059669; }
.daily-t { display: flex; align-items: center; gap: 8rpx; }
.daily-t-t { font-size: 27rpx; font-weight: 700; color: #fff; }
.daily-s { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.85); margin-top: 4rpx; }
.daily-go { background: var(--card); color: var(--brand-text); font-size: 24rpx; font-weight: 600; border-radius: 999rpx; padding: 10rpx 26rpx; flex-shrink: 0; }
.smart { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #f97316, #f43f5e); border-radius: 20rpx; padding: 24rpx 28rpx; margin-bottom: 20rpx; }
.smart-t { display: flex; align-items: center; gap: 8rpx; font-size: 27rpx; font-weight: 700; color: #fff; }
.smart-t-t { font-size: 27rpx; font-weight: 700; color: #fff; }
.smart-s { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.8); margin-top: 4rpx; }
.smart-go { background: var(--card); color: #f43f5e; font-size: 24rpx; font-weight: 600; border-radius: 999rpx; padding: 10rpx 26rpx; flex-shrink: 0; }
.grid { display: flex; flex-wrap: wrap; gap: 20rpx; }
.mcard { width: calc(50% - 10rpx); box-sizing: border-box; background: var(--soft-bg); border: 1rpx solid var(--line); border-radius: 20rpx; padding: 24rpx; }
.mcard.all { background: linear-gradient(135deg, #5c82ff, var(--brand)); border: none; }
.mcard.all .mname, .mcard.all .mn { color: #fff; }
.mtop { display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.mico { width: 48rpx; height: 48rpx; line-height: 48rpx; text-align: center; border-radius: 12rpx; font-size: 24rpx; font-weight: 600; }
.mname { font-size: 29rpx; font-weight: 600; color: var(--ink); }
.mn { display: block; font-size: 21rpx; color: var(--ink-2); margin: 4rpx 0 10rpx; }
.mbar { height: 8rpx; background: var(--line); border-radius: 999rpx; overflow: hidden; }
.mfill { height: 100%; background: var(--brand); border-radius: 999rpx; transition: width 0.4s ease; }
.modechips { display: flex; gap: 12rpx; margin-bottom: 14rpx; flex-wrap: wrap; }
.mchip { font-size: 21rpx; border-radius: 12rpx; padding: 4rpx 16rpx; font-weight: 500; }
.mchip.brand { background: var(--brand-soft); color: var(--brand-text); }
.mchip.info { background: #cffafe; color: #0e7490; }
.mchip.bad { background: var(--bad-soft); color: var(--bad-strong); }
.rhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14rpx; }
.tag { display: inline-block; background: var(--brand-soft); color: var(--brand-text); border-radius: 12rpx; padding: 6rpx 20rpx; font-size: 22rpx; min-width: 0; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hstats { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.tool-row { display: flex; justify-content: space-between; align-items: center; min-height: 44px; padding: 8rpx 4rpx; border-bottom: 1rpx solid var(--line); }
.tool-row:last-child { border-bottom: none; }
.tool-name { font-size: 27rpx; color: var(--ink); }
.tool-val { font-size: 24rpx; color: var(--ink-2); }
.tool-val.on { color: var(--brand-text); font-weight: 600; }
.cnt { font-size: 22rpx; border-radius: 999rpx; padding: 2rpx 14rpx; font-weight: 600; }
.okc { background: var(--ok-soft); color: var(--ok-strong); }
.badc { background: var(--bad-soft); color: var(--bad-strong); }
.fire { background: var(--warn-soft); color: #ea580c; display: inline-flex; align-items: center; gap: 2rpx; }
.fire-n { font-size: 22rpx; color: #ea580c; font-weight: 700; }
.iconbtn { display: inline-flex; align-items: center; }
.timer { font-size: 22rpx; color: var(--ink-2); }
.fontbtn { font-size: 24rpx; font-weight: 700; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 10rpx; padding: 2rpx 12rpx; position: relative; }
.fontbtn::after { content: ''; position: absolute; inset: -16rpx; }
.fontbtn.beion { background: var(--brand); border-color: var(--brand-text); color: #fff; }
.reasons { display: flex; flex-wrap: wrap; align-items: center; gap: 12rpx; margin-bottom: 16rpx; }
.rz-t { font-size: 23rpx; color: var(--ink-2); }
.rz { font-size: 23rpx; color: var(--ink-2); border: 1rpx solid var(--line); background: var(--soft-bg); border-radius: 999rpx; padding: 8rpx 22rpx; }
.rz.on { background: var(--brand); border-color: var(--brand-text); color: #fff; font-weight: 600; }
.acard-grid { display: flex; flex-wrap: wrap; gap: 20rpx; padding: 8rpx 0 20rpx; }
.acard-n { width: 80rpx; height: 80rpx; line-height: 80rpx; text-align: center; border-radius: 50%; background: var(--soft-bg); border: 2rpx solid var(--line); font-size: 27rpx; font-weight: 600; color: var(--ink-2); box-sizing: border-box; }
.acard-n.ok { background: var(--ok-soft); border-color: #86efac; color: #15803d; }
.acard-n.bad { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }
.acard-n.cur { border-color: var(--brand-text); color: var(--brand-text); background: var(--brand-soft); }
.acard-foot { text-align: center; font-size: 23rpx; color: var(--ink-2); padding-bottom: 8rpx; }
.op { font-size: 24rpx; color: var(--ink-2); margin-left: 6rpx; }
.progress { height: 6rpx; background: var(--fill); border-radius: 999rpx; overflow: hidden; margin-bottom: 22rpx; }
.pfill { height: 100%; background: linear-gradient(90deg, #5c82ff, var(--brand)); border-radius: 999rpx; transition: width 0.3s ease; }
.q { font-size: 30rpx; line-height: 1.7; margin-bottom: 22rpx; white-space: pre-wrap; word-break: break-all; }
.qimg { width: 100%; border-radius: 12rpx; margin-bottom: 8rpx; background: var(--fill); }
.qimg-credit { font-size: 20rpx; color: var(--ink-2); margin-bottom: 16rpx; }
.opt { display: flex; align-items: center; border: 2rpx solid var(--line); border-radius: 20rpx; padding: 22rpx 24rpx; margin-bottom: 20rpx; font-size: 29rpx; line-height: 1.6; transition: border-color 0.15s, background 0.15s; }
.okey { flex-shrink: 0; width: 52rpx; height: 52rpx; line-height: 52rpx; text-align: center; border-radius: 50%; background: var(--soft-bg); color: var(--ink-2); font-weight: 600; font-size: 26rpx; margin-right: 20rpx; border: 1rpx solid var(--line); }
.otext { flex: 1; word-break: break-all; }
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
.exp-k.hs { color: var(--brand-text); }
.exp.hsx { border-left: 5rpx solid var(--brand); background: var(--brand-soft); }
.exp-k.xp { color: #b45309; margin-top: 12rpx; }
.exp.xpx { border-left: 5rpx solid #f59e0b; background: var(--warn-soft); }
.hs-rate { display: flex; gap: 14rpx; margin-top: 10rpx; align-items: center; }
.hs-rate-btn { display: inline-flex; align-items: center; gap: 6rpx; font-size: 23rpx; color: var(--brand-text); border: 1rpx solid var(--brand); border-radius: 999rpx; padding: 6rpx 22rpx; }
.hs-rate-btn.bad { color: var(--bad); border-color: var(--bad); }
.hs-rate-done { font-size: 23rpx; color: var(--ink-2); }
.exp { background: var(--soft-bg); border-radius: 14rpx; padding: 20rpx; font-size: 25rpx; line-height: 1.7; color: var(--ink); white-space: pre-wrap; word-break: break-all; margin-top: 8rpx; }
.exp-sec { background: linear-gradient(180deg, var(--brand-soft), var(--card) 40%); border: 1rpx solid var(--brand-soft-2); border-radius: 20rpx; padding: 20rpx; margin-bottom: 16rpx; }
.exp-row { display: flex; align-items: baseline; gap: 16rpx; margin-bottom: 12rpx; }
.exp-row:last-child { margin-bottom: 0; }
.exp-row.col { display: block; }
.exp-k { flex-shrink: 0; font-size: 22rpx; color: var(--ink-2); font-weight: 600; }
.exp-v { font-size: 24rpx; color: var(--ink); }
.exp-ans { font-size: 32rpx; font-weight: 800; }
.exp-ans.okc2 { color: var(--ok); }
.exp-ans.badc2 { color: var(--bad); }
.rp-types { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 20rpx; }
.rp-chip { padding: 18rpx 26rpx; min-height: 44rpx; border-radius: 999rpx; background: var(--soft-bg); font-size: 26rpx; color: var(--ink-2); }
.rp-chip.on { background: rgba(46, 91, 255, 0.12); color: var(--brand-text); font-weight: 600; }
.rp-detail { width: 100%; box-sizing: border-box; min-height: 140rpx; background: var(--soft-bg); border-radius: 16rpx; padding: 20rpx; font-size: 26rpx; margin-bottom: 24rpx; }
.rp-submit { width: 100%; }
.rp-submit[disabled] { opacity: 0.5; }
.report-link {
  text-align: center;
  font-size: 22rpx;
  color: var(--ink-2);
  padding-top: 14rpx;
  text-decoration: underline;
}
.deep { margin-top: 6rpx; text-align: center; font-size: 25rpx; color: var(--brand-text); border: 1rpx solid var(--brand); border-radius: 999rpx; padding: 14rpx 0; }
.banner { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 28rpx 32rpx calc(28rpx + env(safe-area-inset-bottom)); animation: slideup 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); }
/* #ifdef H5 */
@media (max-width: 767px) {
  .banner { bottom: calc(50px + env(safe-area-inset-bottom)); padding-bottom: 28rpx; }
  .wrap.has-banner { padding-bottom: calc(300rpx + 50px + env(safe-area-inset-bottom)); }
}
/* #endif */
@keyframes slideup {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.banner { background: rgba(255, 255, 255, 0.97); border-top: 1rpx solid var(--line); box-shadow: 0 -8rpx 24rpx rgba(23, 24, 28, 0.08); }
.theme-dark .banner { background: rgba(29, 31, 40, 0.97); }
.binfo { flex: 1; min-width: 0; }
.btitle { display: block; font-size: 30rpx; font-weight: 700; }
.bok .btitle { color: var(--ok); }
.bbad .btitle { color: var(--bad); }
.bsub { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.bnext { flex-shrink: 0; border-radius: 999rpx; font-size: 28rpx; font-weight: 600; color: #fff; padding: 0 44rpx; min-height: 44px; line-height: 44px; margin: 0; }
.bnext.nok, .bnext.nbad { background: linear-gradient(180deg, #4a7bf7, #3567ec); box-shadow: 0 6rpx 16rpx rgba(46, 91, 255, 0.25); }
.bnext.bstay { background: transparent; border: 2rpx solid var(--brand); color: var(--brand-text); margin-right: 12rpx; box-shadow: none; }
.ann { display: flex; align-items: flex-start; gap: 12rpx; background: var(--info-soft); border: 1rpx solid #bae6fd; border-radius: 16rpx; padding: 18rpx 22rpx; margin-bottom: 20rpx; }
.ann-c { flex: 1; }
.ann-t { display: block; font-size: 26rpx; font-weight: 600; color: #0369a1; }
.ann-b { display: block; font-size: 23rpx; color: #0284c7; margin-top: 4rpx; }
.ann-x { color: #0369a1; font-size: 26rpx; padding: 8rpx 16rpx; }
.daily.exam { background: var(--card); border: 1rpx solid var(--line); box-shadow: 0 2rpx 8rpx rgba(23,24,28,.04); }
.exam-ico { width: 56rpx; height: 56rpx; border-radius: 16rpx; display: inline-flex; align-items: center; justify-content: center; }
.exam-ico.warn { background: var(--warn-soft); }
.exam-ico.err { background: var(--bad-soft); }
.daily-t-t.dark { color: var(--ink); }
.daily-s.dark { color: var(--ink-2); }
.daily.exam .daily-go { background: var(--brand-soft); color: var(--brand-text); }

.timer.examleft { color: #ef4444; font-weight: 700; }
.timer.overtime { color: #ef4444; font-weight: 700; }
.tm-cmp { margin-left: auto; font-size: 22rpx; color: #16a34a; }
.tm-cmp.over { color: #ef4444; }
.qhl { background: var(--hl-bg, #fef08a); color: var(--hl-ink, inherit); border-radius: 4rpx; padding: 0 2rpx; font-weight: 600; }
.qhl-tip { margin-top: 8rpx; font-size: 21rpx; color: var(--warn); }
.opt.sel { border-color: var(--brand-text); background: var(--soft-bg); }
.acard-n.skip { background: var(--line); color: var(--ink-2); }
.beat { margin-top: 10rpx; font-size: 25rpx; color: var(--brand-text); background: var(--soft-bg); border-radius: 999rpx; padding: 10rpx 26rpx; }
.redoreport { width: 100%; margin-top: 24rpx; background: var(--soft-bg); border: 1rpx solid var(--line); border-radius: 18rpx; padding: 24rpx 28rpx; box-sizing: border-box; text-align: left; }
.dsboard { width: 100%; margin-top: 24rpx; background: var(--soft-bg); border: 1rpx solid var(--line); border-radius: 18rpx; padding: 24rpx 28rpx; box-sizing: border-box; text-align: left; }
.dsb-mine { float: right; font-size: 23rpx; font-weight: 600; color: var(--brand-text); }
.dsb-row { display: flex; align-items: center; gap: 16rpx; margin-top: 14rpx; }
.dsb-rank { flex-shrink: 0; width: 40rpx; text-align: center; font-size: 24rpx; font-weight: 700; color: var(--ink-2); }
.dsb-rank.top { color: var(--brand-text); }
.dsb-name { flex: 1; min-width: 0; font-size: 25rpx; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsb-score { flex-shrink: 0; font-size: 23rpx; color: var(--ink-2); }
.weakrf { width: 100%; margin-top: 24rpx; background: var(--soft-bg); border: 1rpx solid var(--line); border-radius: 18rpx; padding: 24rpx 28rpx; box-sizing: border-box; text-align: left; }
.wr-row { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 18rpx; }
.wr-l { display: flex; flex-direction: column; gap: 4rpx; min-width: 0; }
.wr-name { font-size: 26rpx; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wr-meta { font-size: 22rpx; color: var(--bad-strong); }
.wr-btn { flex-shrink: 0; font-size: 24rpx; font-weight: 600; color: var(--brand-text); border: 1rpx solid var(--brand); border-radius: 999rpx; padding: 8rpx 22rpx; }
@media (min-width: 768px) { .wr-btn { cursor: pointer; } .wr-btn:hover { background: var(--brand); color: #fff; } }
.rr-t { font-size: 27rpx; font-weight: 700; color: var(--ink); }
.rr-row { display: flex; gap: 16rpx; margin: 18rpx 0 12rpx; }
.rr-cell { flex: 1; text-align: center; background: var(--card-bg, #fff); border-radius: 14rpx; padding: 16rpx 0; }
.rr-n { display: block; font-size: 40rpx; font-weight: 800; color: var(--ink); }
.rr-n.rr-ok { color: #16a34a; }
.rr-n.rr-bad { color: #dc2626; }
.rr-n.rr-master { color: var(--brand-text); }
.rr-l { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.rr-tip { display: block; font-size: 22rpx; color: var(--ink-2); line-height: 1.6; }
.rr-go { margin-top: 10rpx; font-size: 24rpx; font-weight: 600; color: var(--brand-text); }
.report { width: 100%; margin: 20rpx 0 28rpx; }
.report-row { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.report-cell { flex: 1; background: var(--soft-bg); border-radius: 16rpx; padding: 20rpx 0; display: flex; flex-direction: column; align-items: center; gap: 6rpx; }
.report-n { font-size: 34rpx; font-weight: 700; color: var(--ink); }
.report-n.badc2 { color: var(--bad); }
.report-t { font-size: 22rpx; color: var(--ink-2); }
.mb-list { margin-bottom: 24rpx; }
.mb-row { display: flex; align-items: center; gap: 16rpx; margin-bottom: 12rpx; }
.mb-name { font-size: 23rpx; color: var(--ink); width: 130rpx; text-align: left; flex-shrink: 0; }
.mb-bar { flex: 1; height: 14rpx; background: var(--line); border-radius: 999rpx; overflow: hidden; }
.mb-fill { height: 100%; border-radius: 999rpx; background: #22c55e; }
.mb-fill.mid { background: #f59e0b; }
.mb-fill.lo { background: #ef4444; }
.mb-pct { font-size: 22rpx; color: var(--ink-2); width: 150rpx; text-align: right; flex-shrink: 0; }
.report-grid { display: flex; flex-wrap: wrap; gap: 16rpx; justify-content: center; }
.report-tip { text-align: center; font-size: 22rpx; color: var(--ink-2); margin-top: 14rpx; }
.btn { background: linear-gradient(135deg, #5c82ff, var(--brand)); color: #fff; border-radius: 18rpx; font-size: 30rpx; font-weight: 600; box-shadow: 0 6rpx 16rpx rgba(46, 91, 255, 0.25); min-height: 44px; line-height: 44px; }
.btn.ghost { background: var(--brand-soft); color: var(--brand-text); box-shadow: none; }
.btn.plain { background: none; color: var(--ink-2); box-shadow: none; }
.done { text-align: center; padding: 48rpx 28rpx; }
.duenudge { display: flex; justify-content: space-between; align-items: center; text-align: left; background: linear-gradient(180deg, #4a7bf7, #3567ec); border-radius: 18rpx; box-shadow: 0 6rpx 16rpx rgba(46, 91, 255, 0.25); padding: 24rpx 28rpx; margin: 24rpx 0; }
.duenudge-t { display: block; font-size: 27rpx; font-weight: 700; color: #ffffff; }
.duenudge-s { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.75); margin-top: 4rpx; }
.duenudge-go { flex-shrink: 0; background: rgba(255, 255, 255, 0.18); color: #ffffff; font-size: 25rpx; font-weight: 600; border-radius: 999rpx; padding: 12rpx 30rpx; }
.loginnudge { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; text-align: left; background: var(--card); border: 1rpx solid var(--line); border-radius: 18rpx; padding: 24rpx 28rpx; margin: 24rpx 0; }
.loginnudge .duenudge-t { color: var(--ink); }
.loginnudge .duenudge-s { color: var(--ink-2); }
.loginnudge .duenudge-go { background: var(--brand-soft); color: var(--brand-text); }
.loginnudge-x { flex-shrink: 0; color: var(--ink-3); font-size: 26rpx; padding: 8rpx; }
.ring { width: 200rpx; height: 200rpx; border-radius: 50%; margin: 0 auto 24rpx; display: flex; align-items: center; justify-content: center; }
.ring-in { width: 156rpx; height: 156rpx; border-radius: 50%; background: var(--card); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-n { font-size: 40rpx; font-weight: 700; color: var(--ink); }
.ring-t { font-size: 20rpx; color: var(--ink-2); }
.big { font-size: 40rpx; font-weight: 700; margin-bottom: 12rpx; }
.sub { font-size: 26rpx; color: var(--ink-2); margin-bottom: 28rpx; }
.mask { position: fixed; inset: 0; background: rgba(15, 18, 30, 0.5); z-index: 90; display: flex; align-items: flex-end; }
.sheet { width: 100%; box-sizing: border-box; background: var(--card); border-radius: 32rpx 32rpx 0 0; padding: 32rpx 28rpx calc(130rpx + env(safe-area-inset-bottom)); max-height: 70vh; overflow-y: auto; animation: slideup 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.sheet-t { font-size: 30rpx; font-weight: 700; }
.sheet-x { font-size: 28rpx; color: var(--ink-2); padding: 8rpx 16rpx; }
.sub-chip { display: flex; justify-content: space-between; align-items: center; border: 1rpx solid var(--line); background: var(--soft-bg); border-radius: 18rpx; padding: 24rpx 28rpx; margin-bottom: 16rpx; }
.sub-l { display: flex; flex-direction: column; gap: 4rpx; min-width: 0; }
.pr-scroll { white-space: nowrap; margin-bottom: 20rpx; }
.pr-scroll .set-chip { display: inline-block; margin-right: 12rpx; }
.sub-prog { font-size: 22rpx; color: var(--muted); }
.sub-chip.all-chip { background: linear-gradient(135deg, #5c82ff, var(--brand)); border: none; }
.sub-chip.all-chip .sub-name, .sub-chip.all-chip .sub-n { color: #fff; }
.sub-name { font-size: 28rpx; font-weight: 600; color: var(--ink); }
.sub-n { font-size: 22rpx; color: var(--ink-2); }
.searchbar { display: flex; align-items: center; gap: 12rpx; background: var(--card); border-radius: 999rpx; padding: 16rpx 26rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04); }
.searchbar-t { font-size: 26rpx; color: var(--ink-3); }

/* 桌面常驻侧栏（答题卡 + 快捷键）——仅 H5 ≥1024px */
.pside { display: none; }
.ps-h { font-size: 26rpx; font-weight: 600; color: var(--ink); margin-bottom: 8rpx; }
.kbd-row { display: flex; align-items: center; gap: 8rpx; margin-top: 14rpx; }
.kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 40rpx; height: 40rpx; padding: 0 10rpx; box-sizing: border-box; background: var(--card); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 8rpx; font-size: 21rpx; font-weight: 600; color: var(--ink-2); }
.kbd-d { font-size: 22rpx; color: var(--ink-2); margin-left: 8rpx; }
/* #ifdef H5 */
@media (min-width: 1024px) {
  .wrap.pdesk { max-width: 1044px !important; margin: 0 auto; box-sizing: border-box; }
  .wrap.pdesk::after { content: ''; display: block; clear: both; }
  .pside { display: block; float: right; width: 320px; }
  .pside-card { margin-bottom: 20rpx; }
  .card.pmain { margin-right: 344px; }
}
/* #endif */
</style>
