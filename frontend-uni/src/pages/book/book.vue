<template>
  <view class="wrap book" :class="{ 'is-review': reviewing }">
    <kg-banner v-if="offlineView" tone="warn" icon="plane" text="当前离线 · 展示已缓存错题，联网后自动更新" :closable="false" class="offbar" />

    <!-- 复习模式 -->
    <kg-card v-if="reviewing" class="review">
      <view class="rhead">
        <kg-tag tone="warn">{{ cur._extra ? '加练同类' : '复习' }} {{ rIdx + 1 }}/{{ rItems.length }}</kg-tag>
        <kg-button variant="text" size="sm" @click="exitReview">退出复习</kg-button>
      </view>
      <view class="q" :style="qStyle">{{ cur.question_text }}</view>
      <view v-if="curLetter" class="opts" :class="{ full: curOptFull }">
        <view
          v-for="o in curOpts"
          :key="o.k"
          class="opt"
          :class="[curOptFull ? 'full' : 'num', optClass(o.k)]"
          role="button"
          :aria-label="o.t ? o.k + '. ' + o.t : o.k"
          @click="pick(o.k)"
        ><text class="opt-k">{{ o.k }}</text><text v-if="o.t" class="opt-t" :style="optStyle">{{ o.t }}</text></view>
      </view>
      <view v-if="answered">
        <view class="verdict" :class="wasCorrect ? 'good' : 'badv'">
          <template v-if="cur._extra">{{ wasCorrect ? '答对了，这个考法稳了 ✓' : '还没稳，仔细看讲解' }}</template>
          <template v-else>{{ wasCorrect ? (cur._requeued ? '这次答对了，本轮已纠正 ✓' : '答对了！连对 ' + streak + ' 次') : '又错了，看讲解（稍后本轮会再出现）' }}（下次复习：{{ nextDays }} 天后）</template>
        </view>
        <view v-if="wasCorrect === false && cur._appended" class="appended-tip">已为你在本轮末尾加练 {{ cur._appended }} 道同类题</view>
        <view v-if="cur._extra && !wasCorrect && cur._saved" class="appended-tip">已加入错题本，之后会安排复习</view>
        <view v-if="!wasCorrect && reviewReasonMid(cur)" class="reasons">
          <text class="rz-t">错因自评：</text>
          <kg-chip-row size="sm" :options="REASONS.map((rz) => ({ label: rz, value: rz }))" :model-value="cur.error_reason || ''" :scroll-to-selected="false" @update:model-value="setReviewReason" />
        </view>
        <view :style="optStyle"><rich-text :nodes="curHtml" /></view>
        <view class="sim-rows">
          <kg-button v-if="!wasCorrect && similarableReview && !cur._extra" variant="text" size="md" block @click="similarFromReview">还不稳？练 3 道同类题巩固 ›</kg-button>
          <kg-button v-if="askableReview" variant="text" size="md" block aria-label="看不懂？AI 详解本题" @click="askFromReview">看不懂？AI 详解本题 ›</kg-button>
          <kg-button v-if="reviewAskSeen" variant="text" size="md" block aria-label="回看 AI 详解" @click="openSeenAsk">回看 AI 详解 ›</kg-button>
        </view>
        <q-social-bar v-if="cur.question_id" :question-id="cur.question_id" />
        <kg-button variant="primary" size="lg" block class="next-btn" @click="nextReview">{{ rIdx + 1 < rItems.length ? '下一题' : '完成复习' }}</kg-button>
      </view>
      <view v-else-if="curMulti" class="selfjudge">
        <text class="q2">多选题：选完所有选项后确认</text>
        <kg-button variant="primary" size="lg" block :disabled="!picked" class="next-btn" @click="confirmMulti">确认答案{{ picked ? '（已选 ' + picked + '）' : '' }}</kg-button>
      </view>
      <view v-else-if="!curLetter" class="selfjudge">
        <text class="q2">先自己做，然后：</text>
        <view class="sj-row">
          <kg-button variant="secondary" size="lg" block @click="selfJudge(true)">我做对了</kg-button>
          <kg-button variant="secondary" size="lg" tone="bad" block @click="selfJudge(false)">我做错了</kg-button>
        </view>
      </view>
    </kg-card>

    <!-- 复习清零庆祝态 -->
    <kg-sheet :model-value="celebrate" title="今日复习已清零" @update:model-value="(v) => { if (!v) closeCelebrate(); }">
      <view class="cb">
        <l-icon name="party-popper" :size="48" tone="ok" />
        <template v-if="rSummary">
          <text class="cb-s">到期 {{ celebrateN }} 道全部复习完成<template v-if="rSummary.pct !== null"> · 首答对 {{ rSummary.dueRight }} 道（{{ rSummary.pct }}%）</template></text>
          <text v-if="rSummary.dueWrong" class="cb-s">答错 {{ rSummary.dueWrong }} 道已重出巩固<template v-if="rSummary.corrected"> · 纠正 {{ rSummary.corrected }} 道</template></text>
          <text v-if="rSummary.extra" class="cb-s">加练同类题 {{ rSummary.extra }} 道 · 答对 {{ rSummary.extraRight }} 道</text>
        </template>
        <text v-else class="cb-s">{{ celebrateN }} 道到期错题全部复习完成，遗忘曲线稳住了</text>
      </view>
      <template #footer><kg-button variant="primary" size="lg" block @click="closeCelebrate">太棒了，继续 ›</kg-button></template>
    </kg-sheet>

    <!-- 复习完成后：同考点强化卡（spec-03） -->
    <kg-sheet :model-value="!reviewing && !!reinforce" title="本轮复习完成！趁热打铁强化一下？" @update:model-value="(v) => { if (!v) reinforce = null; }">
      <view v-if="reinforce" class="rf">
        <text class="rf-name">{{ reinforce.tag3_name || reinforce.submodule }}</text>
        <text class="rf-meta">{{ reinforce.module_name }}<template v-if="reinforce.tag3_name"> · {{ reinforce.submodule }}</template> · 掌握度 {{ Math.round(reinforce.mastery * 100) }}%（{{ reinforce.level_name }}） · 今日错 {{ reinforce.wrong_today }} 道</text>
      </view>
      <template #footer>
        <view class="sheet-acts">
          <kg-button variant="primary" size="lg" block @click="startReinforce(reinforce)">强化 5 道新题（未做过）</kg-button>
          <view class="rf-row2">
            <kg-button v-if="reinforceItems.length > 1" variant="text" size="md" @click="swapReinforce">换个考点</kg-button>
            <kg-button variant="text" size="md" @click="reinforce = null">下次再说</kg-button>
          </view>
        </view>
      </template>
    </kg-sheet>

    <!-- 列表模式 -->
    <template v-if="!reviewing">
      <kg-two-col>
        <template #main>
          <!-- 首屏：今日待复习 N · 预计 M 分钟 · 累计 K + 开始复习 -->
          <kg-card v-if="!loading || items.length || due.length" class="head">
            <kg-stat-row :items="[
              { label: '今日待复习', value: dueTotal, unit: '题', tone: due.length ? 'brand' : undefined },
              { label: '预计', value: due.length ? Math.max(1, Math.ceil(due.length * 0.8)) : 0, unit: '分钟' },
              { label: '累计错题', value: items.length, unit: '题' },
            ]" />
            <kg-button v-if="due.length" variant="primary" size="lg" block class="head-cta" @click="startReviewFromCard">开始复习</kg-button>
            <text v-else-if="items.length" class="head-tip">今日没有到期错题 · 待掌握 {{ todoItems.length }} · 已掌握 {{ doneItems.length }}</text>
          </kg-card>
          <kg-card v-if="resumeInfo" variant="soft" class="resumecard" role="button" aria-label="继续刚才的复习">
            <view class="rs-row">
              <view class="grow">
                <view class="rs-tr"><l-icon name="clock" :size="16" tone="warn" /><text class="rs-t">上次复习中断在第 {{ resumeInfo.rIdx + 1 }}/{{ resumeInfo.items.length }} 题</text></view>
                <text class="rs-s">进度已保留，可原位继续</text>
              </view>
              <kg-button variant="text" size="md" role="button" aria-label="放弃本轮复习进度" @click.stop="discardResume">放弃</kg-button>
              <kg-button variant="secondary" size="lg" @click="resumeReview">继续复习</kg-button>
            </view>
          </kg-card>

          <view v-if="items.length || favs.length" class="segrow">
            <view class="seg" role="tablist">
              <view class="seg-i" :class="{ on: tab === 'todo' }" role="tab" @click="tab = 'todo'">待掌握 {{ todoItems.length }}</view>
              <view class="seg-i" :class="{ on: tab === 'done' }" role="tab" @click="tab = 'done'">已掌握 {{ doneItems.length }}</view>
              <view class="seg-i" :class="{ on: tab === 'fav' }" role="tab" @click="tab = 'fav'">收藏{{ favs.length ? ' ' + favs.length : '' }}</view>
            </view>
            <kg-button v-if="tab !== 'fav'" variant="secondary" size="md" icon="sliders-horizontal" aria-label="筛选与排序" @click="filterOpen = true" />
            <kg-button v-if="tab !== 'fav' && shownItems.length" :variant="batchMode ? 'primary' : 'secondary'" size="md" @click="toggleBatch">{{ batchMode ? '完成' : '批量' }}</kg-button>
          </view>
          <kg-chip-row v-if="tab !== 'fav' && chipList.length > 2" class="modchips" :options="chipList.map((c) => ({ label: c.name, value: c.key }))" :model-value="filterMod" @update:model-value="(v) => { filterMod = v; kpFilter = ''; kp3Filter = ''; }" />

          <template v-if="tab === 'fav'">
            <kg-card clickable chevron class="entry" @click="openFavPage">
              <view class="entry-in">
                <view class="entry-ico is-warn"><l-icon name="star" :size="20" tone="warn" /></view>
                <view class="grow">
                  <text class="entry-t">收藏夹与笔记</text>
                  <text class="entry-s">多夹分组 · 每题笔记 · 可按夹重练</text>
                </view>
              </view>
            </kg-card>
            <kg-empty-state v-if="!favs.length" compact icon="star" title="还没有本机收藏" desc="刷题时点顶栏星星即可收藏好题" />
            <view v-if="favs.length > 3" class="searchbar">
              <l-icon name="search" :size="16" tone="muted" />
              <input v-model="favKw" class="searchinput" placeholder="搜收藏题干或题型" confirm-type="search" />
              <view v-if="favKw" class="searchclear" role="button" aria-label="清空搜索" @click="favKw = ''"><l-icon name="x" :size="16" tone="muted" /></view>
            </view>
            <kg-card v-for="f in favShown" :key="f.t" clickable class="mcard" @click="f._open = !f._open">
              <view class="mhead">
                <kg-tag tone="brand">{{ f.submodule || modName(f.module) }}</kg-tag>
                <kg-tag v-if="f.is_real" tone="neutral">真题{{ f.exam_year ? ' · ' + f.exam_year : '' }}{{ f.exam_region ? ' · ' + f.exam_region : '' }}</kg-tag>
              </view>
              <view class="q" :class="{ clamp: !f._open }">{{ (f.question || '').slice(0, 200) }}</view>
              <template v-if="f._open">
                <view v-for="(v, k) in f.options" :key="k" class="anscmp"><text :class="(f.answer || '').indexOf(k) !== -1 ? 'ca' : ''">{{ k }}. {{ v }}</text></view>
                <rich-text :nodes="md(f.hs_explanation || f.explanation || '暂无解析')" />
                <template v-if="f.xp_explanation">
                  <view class="xp-k">{{ f.xp_school || '第二名师视角' }}</view>
                  <view class="xp-body">{{ f.xp_explanation }}</view>
                </template>
              </template>
              <view class="mfoot">
                <text class="meta">{{ fmt(f.t / 1000) }}</text>
                <kg-button variant="text" size="sm" tone="bad" @click.stop="unfavItem(f)">取消收藏</kg-button>
              </view>
            </kg-card>
          </template>

          <kg-card v-if="tab !== 'fav' && todoItems.length" clickable chevron class="entry" @click="redoAll">
            <view class="entry-in">
              <view class="entry-ico"><l-icon name="rotate-ccw" :size="20" tone="brand" /></view>
              <view class="grow">
                <text class="entry-t">{{ pidFilter ? '重练本卷错题 · ' + pidLabel : '错题重练' + (kp3Filter ? ' · ' + kp3Filter : kpFilter ? ' · ' + kpFilter : rzFilter ? ' · ' + rzFilter : srcFilter ? ' · ' + (srcFilter === 'exam' ? '模考错题' : '练习错题') : '') }}</text>
                <text class="entry-s">{{ pidFilter ? '按卷面顺序只练本卷上次答错的题（答对过即不再算错）' : kp3Filter ? '只重练当前筛选考点的待掌握错题（最多 10 题）' : kpFilter ? '只重练当前筛选题型的待掌握错题（最多 10 题）' : rzFilter ? '只重练当前筛选错因的待掌握错题（最多 10 题）' : srcFilter ? '只重练当前筛选来源的待掌握错题（最多 10 题）' : '把待掌握错题按刷题模式重做一遍（最多 10 题）' }}</text>
              </view>
            </view>
          </kg-card>
          <view v-if="tab !== 'fav' && items.length > 5" class="searchbar">
            <l-icon name="search" :size="16" tone="muted" />
            <input v-model="kw" class="searchinput" placeholder="搜题干关键词或题型，如：增长率 / 类比推理" confirm-type="search" />
            <view v-if="kw" class="searchclear" role="button" aria-label="清空搜索" @click="kw = ''"><l-icon name="x" :size="16" tone="muted" /></view>
          </view>
          <view v-if="tab !== 'fav' && (filterMod || kpFilter || kp3Filter || srcFilter || rzFilter || pidFilter)" class="curfilter">
            <kg-tag v-if="filterMod || kpFilter || kp3Filter" tone="brand" icon="x" class="cf" @click="filterMod = ''; kpFilter = ''; kp3Filter = ''">{{ kp3Filter || kpFilter || modName(filterMod) }}</kg-tag>
            <kg-tag v-if="srcFilter" tone="brand" icon="x" class="cf" @click="srcFilter = ''">{{ srcFilter === 'exam' ? '模考错题' : '练习错题' }}</kg-tag>
            <kg-tag v-if="pidFilter" tone="brand" icon="x" class="cf" @click="pidFilter = 0">{{ pidLabel }}</kg-tag>
            <kg-button v-if="pidFilter" variant="text" size="sm" @click="goPaper(pidFilter)">练本卷 ›</kg-button>
            <kg-tag v-if="rzFilter" tone="brand" icon="x" class="cf" @click="rzFilter = ''">错因：{{ rzFilter }}</kg-tag>
            <kg-tag v-if="sortBy !== 'time'" tone="neutral" class="cf" @click="filterOpen = true">{{ (SORTS.find(s => s.k === sortBy) || {}).name }}</kg-tag>
          </view>
          <view v-else-if="tab !== 'fav' && sortBy !== 'time'" class="curfilter">
            <kg-tag tone="brand" icon="x" class="cf" @click="sortBy = 'time'">{{ (SORTS.find(s => s.k === sortBy) || {}).name }}</kg-tag>
          </view>

          <kg-skeleton v-if="tab !== 'fav' && loading" preset="cards" />
          <kg-empty-state v-else-if="tab !== 'fav' && loadErr && !items.length" icon="wifi-off" title="加载失败" :desc="loadErr" cta-text="重试" @cta="load" />
          <kg-empty-state
            v-else-if="tab !== 'fav' && !items.length"
            icon="folder-plus"
            title="错题本还是空的"
            desc="刷题或拍题讲解时答错的题会汇集到这里，之后按遗忘曲线安排复习；右下角「＋」可扫描答题卡或手动录入答案"
            cta-text="去刷题"
            secondary-text="拍题录入"
            @cta="goPractice"
            @secondary="goAskScan"
          />
          <template v-if="tab !== 'fav' && items.length && !shownItems.length && !loading">
            <kg-empty-state v-if="tab === 'done' && !kw && !hasFilter" compact icon="circle-check" title="还没有已掌握的错题" desc="在待掌握错题的「···」里标为已掌握，或复习连对后自动进入这里" />
            <kg-empty-state v-else-if="tab === 'todo' && !kw && !hasFilter" compact icon="circle-check" title="待掌握已清零" :desc="doneItems.length + ' 道错题已全部掌握；再错的题会回到这里，也可去「已掌握」里恢复复习'" cta-text="去刷题" @cta="goPractice" />
            <kg-empty-state v-else compact icon="search" title="没有匹配的错题" desc="换个关键词或清除筛选试试" />
          </template>

          <kg-card
            v-for="m in shownPage"
            :key="m.id"
            :id="'mc-' + m.id"
            clickable
            :selected="batchMode && !!selIds[m.id]"
            class="mcard"
            :class="[masteryClass(m), { kbf: kbId === m.id }]"
            @click="batchMode ? toggleSel(m) : toggleCard(m)"
          >
            <view class="mhead">
              <view v-if="batchMode" class="bchk" :class="{ on: selIds[m.id] }" role="checkbox" :aria-checked="String(!!selIds[m.id])"><l-icon v-if="selIds[m.id]" name="check" :size="14" tone="on-brand" /></view>
              <kg-tag tone="brand">{{ tagName(m) }}</kg-tag>
              <kg-tag v-if="m.source === 'exam'" tone="info">模考</kg-tag>
              <view v-if="mistakePaper(m)" class="pbadge-hit" role="button" @click.stop="pidFilter = mistakePaper(m).pid"><kg-tag tone="neutral" class="pbadge">{{ mistakePaper(m).psource }}</kg-tag></view>
              <kg-tag v-if="m.times >= 2" tone="bad">错 {{ m.times }} 次</kg-tag>
              <kg-tag v-if="m.mastered" tone="ok" class="mright">已掌握</kg-tag>
              <kg-tag v-else-if="nextReviewText(m)" :tone="isDue(m) ? 'warn' : 'neutral'" class="mright">{{ nextReviewText(m) }}</kg-tag>
              <text class="meta mtime">{{ fmt(m.created_at) }}</text>
            </view>
            <view class="q" :class="{ clamp: !m.open }">{{ (m.question_text || '').slice(0, 200) }}</view>
            <view v-if="m.open && m.options" class="mopts">
              <text
                v-for="(v, k) in m.options"
                :key="k"
                class="mopt"
                :class="{ 'mopt--ok': ansLetter(m.correct_answer).includes(k), 'mopt--bad': ansLetter(m.user_answer).includes(k) && !ansLetter(m.correct_answer).includes(k) }"
              >{{ k }}. {{ v }}</text>
            </view>
            <view v-if="m.open && ansLetter(m.user_answer)" class="anscmp">
              <kg-tag tone="bad">我选 {{ ansLetter(m.user_answer) }}</kg-tag>
              <kg-tag v-if="ansLetter(m.correct_answer)" tone="ok">答案 {{ ansLetter(m.correct_answer) }}</kg-tag>
            </view>
            <view v-if="m.open && mStatLine(m)" class="mstat">{{ mStatLine(m) }}</view>
            <view v-if="m.open && m.attempts && m.attempts.length" class="attempts">
              <view class="att-h">历次作答 · {{ m.attempts.length }} 次</view>
              <view v-for="(a, ai) in m.attempts" :key="ai" class="att-row">
                <text class="att-mark" :class="a.correct ? 'aok' : 'abad'">{{ a.correct ? '✓ 对' : '✗ 错' }}</text>
                <text class="att-pick">选 {{ a.picked || '—' }}</text>
                <text v-if="a.secs" class="att-secs">用时 {{ a.secs }}s</text>
                <text class="att-time">{{ fmt(a.created_at) }}</text>
              </view>
            </view>
            <view v-if="!m.open" class="mfoot">
              <text class="hint">点开看答案与详解</text>
              <kg-button variant="text" size="sm" icon="ellipsis" aria-label="更多操作" @click.stop="itemSheet(m)" />
            </view>
            <view v-else class="mfoot">
              <view class="acts">
                <kg-button v-if="askSeenTick >= 0 && mAskSeen(m)" variant="text" size="sm" aria-label="回看 AI 详解" @click.stop="openSeenAskM(m)">回看 AI 详解</kg-button>
                <kg-button v-if="!m.mastered" variant="secondary" size="sm" @click.stop="redo(m)">AI 详解</kg-button>
                <kg-button v-else variant="secondary" size="sm" @click.stop="master(m, false)">恢复复习</kg-button>
                <kg-button v-if="m.question_id" variant="text" size="sm" @click.stop="openReport(m)">{{ m._reported ? '已纠错' : '纠错' }}</kg-button>
              </view>
              <kg-button variant="text" size="sm" icon="ellipsis" aria-label="更多操作" @click.stop="itemSheet(m)" />
            </view>
            <rich-text v-if="m.open" :nodes="m.html" />
            <view v-if="m.open && m.question_id" @click.stop>
              <q-social-bar :question-id="m.question_id" />
            </view>
          </kg-card>
          <kg-button v-if="tab !== 'fav' && pageN < shownItems.length" variant="text" size="md" block class="loadmore" @click="pageN += 20">上滑或点击加载更多（{{ shownPage.length }}/{{ shownItems.length }}）</kg-button>
          <view v-else-if="tab !== 'fav' && !batchMode && shownPage.length" class="fabspace" />
        </template>

        <template #aside>
          <kg-card v-if="items.length" class="side">
            <kg-stat-row :items="[
              { label: '全部错题', value: items.length },
              { label: '待掌握', value: todoItems.length, tone: todoItems.length ? 'bad' : undefined },
              { label: '已掌握', value: doneItems.length, tone: 'ok' },
            ]" />
          </kg-card>
          <kg-card v-if="weekTrend" class="side trendcard">
            <text class="side-t">错题趋势（近 4 周）</text>
            <view class="trend-bars">
              <view v-for="w in weekTrend.weeks" :key="w.label" class="trend-col">
                <view class="trend-barwrap">
                  <view class="trend-bar" :style="{ height: w.pct + '%' }" />
                  <view class="trend-bar killed" :style="{ height: w.kpct + '%' }" />
                </view>
                <text class="trend-n num">{{ w.n }}<text v-if="w.k" class="trend-kn">/{{ w.k }}</text></text>
                <text class="trend-lb">{{ w.label }}</text>
              </view>
            </view>
            <view class="trend-legend">
              <view class="trend-lg"><view class="trend-dot" /><text class="trend-lgt">新增</text></view>
              <view class="trend-lg"><view class="trend-dot killed" /><text class="trend-lgt">消灭（达成掌握）</text></view>
            </view>
            <text class="side-s">近 7 天新增 {{ weekTrend.last7 }} 道 · 消灭 {{ weekTrend.klast7 }} 道 · 累计已掌握 {{ doneItems.length }} 道</text>
          </kg-card>
          <kg-card v-if="monthRecap.total" class="side recap">
            <kg-section-header :title="'本月错题复盘 · 新增 ' + monthRecap.total + ' 道'" :more="recapOpen ? '收起' : '展开'" @more="recapOpen = !recapOpen" />
            <view v-if="recapOpen">
              <view class="recap-sec">
                <text class="recap-st">按模块</text>
                <view v-for="g in monthRecap.byModule" :key="g.name" class="recap-row">
                  <text class="recap-name">{{ g.name }}</text>
                  <kg-progress :value="g.n" :max="monthRecap.total" class="grow" />
                  <text class="recap-n num">{{ g.n }}</text>
                </view>
              </view>
              <view class="recap-sec">
                <text class="recap-st">按错因</text>
                <view v-for="g in monthRecap.byReason" :key="g.name" class="recap-row recap-link" role="button" :aria-label="'筛选错因：' + g.name" @click="filterByReason(g.name)">
                  <text class="recap-name is-link">{{ g.name }} ›</text>
                  <kg-progress :value="g.n" :max="monthRecap.total" class="grow" />
                  <text class="recap-n num">{{ g.n }}</text>
                </view>
              </view>
              <text class="side-s">高频错因是提分洼地：优先复习对应模块的待掌握错题</text>
            </view>
          </kg-card>
          <kg-card v-if="tab !== 'fav' && todoItems.length >= 3" clickable chevron class="side entry" @click="aiAnalysis(false)">
            <view class="entry-in">
              <view class="entry-ico"><l-icon name="bot-message-square" :size="20" tone="brand" /></view>
              <view class="grow">
                <text class="entry-t">AI 错题分析</text>
                <text class="entry-s">基于你的错题分布与近期作答生成诊断与复习建议</text>
              </view>
            </view>
          </kg-card>
          <kg-card v-if="tab !== 'fav' && modGroups.length" class="side modgroup">
            <text class="side-t">按模块查看</text>
            <view v-for="g in modGroups" :key="g.key" class="mg-blk">
              <view class="mg-row" role="button" @click="toggleGroup(g.key)">
                <l-icon name="chevron-down" :size="16" tone="muted" class="mg-arrow" :class="{ 'is-open': mgOpen[g.key] }" />
                <text class="mg-name">{{ g.name }}</text>
                <text v-if="masteryMods[g.key]" class="mg-mst">掌握 {{ masteryMods[g.key].pct }}% · {{ masteryMods[g.key].level }}</text>
                <kg-tag tone="neutral">{{ g.n }}</kg-tag>
                <kg-button variant="text" size="sm" @click.stop="pickGroup(g.key, '')">查看 ›</kg-button>
              </view>
              <view v-if="mgOpen[g.key]">
                <template v-for="s in g.subs" :key="s.name">
                  <view class="mg-sub" role="button" @click="pickGroup(g.key, s.name)">
                    <text class="mg-sub-name">{{ s.name }}</text>
                    <kg-tag tone="neutral">{{ s.n }}</kg-tag>
                  </view>
                  <view
                    v-for="t in s.t3"
                    :key="s.name + '/' + t.name"
                    class="mg-sub mg-sub3"
                    role="button"
                    @click="pickGroup(g.key, s.name, t.name)"
                  >
                    <text class="mg-sub-name">{{ t.name }}</text>
                    <text v-if="masteryT3[t.name] != null" class="mg-mst">{{ masteryT3[t.name] }}%</text>
                    <kg-tag tone="neutral">{{ t.n }}</kg-tag>
                  </view>
                </template>
              </view>
            </view>
          </kg-card>
          <!-- #ifdef H5 -->
          <kg-card class="side kbdcard">
            <text class="side-t">键盘快捷键</text>
            <view class="kbd-row"><text class="kbd">J</text><text class="kbd">K</text><text class="kbd-d">上下切题</text></view>
            <view class="kbd-row"><text class="kbd">Enter</text><text class="kbd-d">展开/收起详解</text></view>
            <view class="kbd-row"><text class="kbd">A</text><text class="kbd">–</text><text class="kbd">D</text><text class="kbd-d">复习模式作答</text></view>
            <kg-button variant="text" size="sm" @click="kbdHelp = true">按 ? 查看全部 ›</kg-button>
          </kg-card>
          <!-- #endif -->
        </template>
      </kg-two-col>

      <!-- AI 错题分析 -->
      <kg-sheet v-model="aiOpen" title="AI 错题分析">
        <view v-if="aiLoading" class="ai-loading"><kg-skeleton preset="lines" /><text class="side-s">正在分析你的错题与作答数据，约需 30-60 秒…</text></view>
        <view v-else-if="aiErr" class="ai-err">
          <text class="side-s">分析失败：{{ aiErr }}</text>
          <kg-button variant="secondary" size="md" block @click="aiAnalysis(true)">重试</kg-button>
        </view>
        <view v-else>
          <rich-text :nodes="aiHtml" />
          <kg-button variant="secondary" size="md" block class="ai-regen" @click="aiAnalysis(true)">按当前错题重新生成</kg-button>
        </view>
      </kg-sheet>

      <!-- 手动录入答案（扫描答题卡/手动录入收在右下角「＋」） -->
      <kg-sheet v-model="manualOpen" title="手动录入答案">
        <template v-if="!manualPaper">
          <text v-if="recentPapers.length" class="sheet-k">最近导出的试卷</text>
          <kg-chip-row v-if="recentPapers.length" size="sm" :options="recentPapers.map((p) => ({ label: p.title + ' · ' + p.code, value: p.code }))" model-value="" :scroll-to-selected="false" @update:model-value="manualLookup" />
          <text class="sheet-k">或输入卷面上的卷码</text>
          <view class="searchbar manual-codebar">
            <input v-model="manualCode" class="searchinput num" placeholder="如 A1B2C3D4（封面/答题卡顶部）" confirm-type="done" @confirm="manualLookup(manualCode)" />
          </view>
        </template>
        <template v-else>
          <text class="scan-sum">{{ manualPaper.title || '试卷' }} · 卷码 {{ manualPaper.code }} · 共 {{ manualPaper.n }} 题 · 已选 {{ manualPickedCount }}</text>
          <text v-if="manualPaper.n && inlineSkipNote(manualPaper.inline_n)" class="scan-note">{{ inlineSkipNote(manualPaper.inline_n) }}</text>
          <text v-if="!manualPaper.n" class="manual-empty">这张卷的题目均为时政/手录题，不参与机读判分，无需在此录入；请对照卷末参考答案核对</text>
          <view v-else class="scan-list">
            <view v-for="no in manualPaper.n" :key="no" class="manual-row">
              <text class="scan-no num">{{ no }}</text>
              <text v-for="L in ['A','B','C','D']" :key="L" class="manual-opt num" :class="{ on: manualPicks[no] === L }" role="button" @click="manualPick(no, L)">{{ L }}</text>
            </view>
          </view>
        </template>
        <template #footer>
          <view class="sheet-acts">
            <kg-button v-if="!manualPaper" variant="primary" size="lg" block :loading="manualLoading" @click="manualLookup(manualCode)">{{ manualLoading ? '查找中…' : '查找试卷' }}</kg-button>
            <template v-else>
              <kg-button v-if="manualPaper.n" variant="primary" size="lg" block :disabled="!manualPickedCount" :loading="manualSubmitting" @click="manualSubmit">{{ manualSubmitting ? '判分中…' : '交卷判分（' + manualPickedCount + ' 题）' }}</kg-button>
              <kg-button variant="text" size="md" block @click="manualPaper = null">‹ 换一份试卷</kg-button>
            </template>
          </view>
        </template>
      </kg-sheet>

      <!-- 对答案结果 -->
      <kg-sheet :model-value="scanOpen && !!scanResult" :title="'对答案结果 · ' + ((scanResult && scanResult.title) || '试卷')" @update:model-value="(v) => { if (!v) closeScan(); }">
        <template v-if="scanResult">
          <text class="scan-sum">卷码 {{ scanResult.code }}{{ scanPageLabel(scanResult) ? ' · ' + scanPageLabel(scanResult) : '' }} · 已作答 {{ scanResult.answered }}/{{ scanResult.total }} · 答对 <text class="scan-good num">{{ scanResult.correct }}</text> 题{{ scanResult.saved ? ' · 已记入做题记录' : '' }}</text>
          <text v-if="scanPagesNote(scanResult, scanAcc)" class="scan-note">{{ scanPagesNote(scanResult, scanAcc) }}</text>
          <text v-if="inlineSkipNote(scanResult.inline_n)" class="scan-note">{{ inlineSkipNote(scanResult.inline_n) }}</text>
          <view class="scan-list">
            <view v-for="r in scanResult.items" :key="r.no" class="scan-row" :class="{ jump: scanRowJumpable(scanResult, r) }" :role="scanRowJumpable(scanResult, r) ? 'button' : null" @click="scanRowJump(r)">
              <text class="scan-no num">{{ r.no }}</text>
              <text class="scan-pick" :class="{ good: r.correct, bad: r.status === 'ok' && !r.correct }">{{ r.status === 'blank' ? '未涂' : r.status === 'multi' ? '多涂 ' + r.picked : r.picked }}</text>
              <text class="scan-ans">答案 {{ r.answer || '—' }}</text>
              <text class="scan-mark">{{ r.correct ? '✓' : r.status === 'ok' ? '✗' : '—' }}</text>
              <text v-if="scanRowJumpable(scanResult, r)" class="scan-jump">看错题 ›</text>
            </view>
          </view>
        </template>
        <template #footer><kg-button variant="primary" size="lg" block @click="closeScan">完成</kg-button></template>
      </kg-sheet>

      <!-- #ifdef H5 -->
      <kg-sheet v-model="kbdHelp" title="键盘快捷键">
        <text class="sheet-k">错题列表</text>
        <view class="kbd-row"><text class="kbd">J</text><text class="kbd">↓</text><text class="kbd-d">下一张错题</text></view>
        <view class="kbd-row"><text class="kbd">K</text><text class="kbd">↑</text><text class="kbd-d">上一张错题</text></view>
        <view class="kbd-row"><text class="kbd">Enter</text><text class="kbd">空格</text><text class="kbd-d">展开/收起当前错题详解</text></view>
        <text class="sheet-k">复习模式</text>
        <view class="kbd-row"><text class="kbd">A</text><text class="kbd">B</text><text class="kbd">C</text><text class="kbd">D</text><text class="kbd-d">直接作答（单选）</text></view>
        <view class="kbd-row"><text class="kbd">Enter</text><text class="kbd-d">多选确认 / 已作答进入下一题</text></view>
        <text class="sheet-k">通用</text>
        <view class="kbd-row"><text class="kbd">?</text><text class="kbd-d">打开本面板</text></view>
        <view class="kbd-row"><text class="kbd">Esc</text><text class="kbd-d">关闭本面板</text></view>
      </kg-sheet>
      <!-- #endif -->

      <!-- 筛选与排序 -->
      <kg-sheet v-model="filterOpen" title="筛选与排序">
        <text class="sheet-k">排序</text>
        <kg-chip-row size="sm" :options="SORTS.map((s) => ({ label: s.name, value: s.k }))" :model-value="sortBy" :scroll-to-selected="false" @update:model-value="(v) => (sortBy = v)" />
        <text class="sheet-k">模块</text>
        <kg-chip-row size="sm" :options="chipList.map((c) => ({ label: c.name, value: c.key }))" :model-value="filterMod" :scroll-to-selected="false" @update:model-value="(v) => { filterMod = v; kpFilter = ''; kp3Filter = ''; }" />
        <template v-if="typeGroups.length > 1">
          <text class="sheet-k">题型</text>
          <view class="kpchips">
            <kg-tag v-for="g in typeGroups" :key="g.name" :tone="kpFilter === g.name ? 'brand' : 'neutral'" class="kpchip" @click="kpFilter = kpFilter === g.name ? '' : g.name; kp3Filter = ''">{{ g.name }} ×{{ g.n }}</kg-tag>
          </view>
        </template>
        <template v-if="hasExamMistakes">
          <text class="sheet-k">来源</text>
          <kg-chip-row size="sm" :options="[{ label: '全部', value: '' }, { label: '模考', value: 'exam' }, { label: '练习', value: 'practice' }]" :model-value="srcFilter" :scroll-to-selected="false" @update:model-value="(v) => (srcFilter = v)" />
        </template>
        <template v-if="paperGroups.length">
          <text class="sheet-k">试卷</text>
          <view class="kpchips">
            <kg-tag :tone="pidFilter === 0 ? 'brand' : 'neutral'" class="kpchip" @click="pidFilter = 0">全部</kg-tag>
            <kg-tag v-for="g in paperGroups" :key="g.pid" :tone="pidFilter === g.pid ? 'brand' : 'neutral'" class="kpchip" @click="pidFilter = pidFilter === g.pid ? 0 : g.pid">{{ g.psource }} ×{{ g.n }}</kg-tag>
          </view>
        </template>
        <template v-if="hasReasonTagged">
          <text class="sheet-k">错因</text>
          <kg-chip-row size="sm" :options="[{ label: '全部', value: '' }].concat(REASONS.map((rz) => ({ label: rz, value: rz })), [{ label: '未标注', value: '未标注' }])" :model-value="rzFilter" :scroll-to-selected="false" @update:model-value="(v) => (rzFilter = v)" />
        </template>
        <template #footer>
          <view class="sheet-acts">
            <kg-button variant="primary" size="lg" block @click="filterOpen = false">完成</kg-button>
            <kg-button variant="secondary" size="lg" block :loading="exporting" @click="exportConfirm = true">{{ exporting ? '正在生成 PDF…' : '导出当前筛选为错题卷 PDF' }}</kg-button>
          </view>
        </template>
      </kg-sheet>

      <export-confirm
        :visible="exportConfirm"
        :scope="exportSel ? '错题本 · 已选' : '错题本 · 当前筛选'"
        :count="Math.min(exportList.length, 100)"
        :sheetless="exportSheetless"
        :busy="exporting"
        above-tabbar
        @close="closeExport"
        @confirm="exportMistakes"
      />

      <!-- 批量操作条 -->
      <kg-sheet :model-value="!!moreSheet" :title="moreSheet ? tagName(moreSheet.m) + ' · 更多操作' : ''" @update:model-value="(v) => { if (!v) moreSheet = null; }">
        <template v-if="moreSheet">
          <view v-if="!moreSheet.m.mastered" class="reasons more-reasons">
            <text class="rz-t">错因自评：</text>
            <kg-chip-row size="sm" :options="REASONS.map((rz) => ({ label: rz, value: rz }))" :model-value="moreSheet.m.error_reason || ''" :scroll-to-selected="false" @update:model-value="(v) => setItemReason(moreSheet.m, v)" />
          </view>
          <view v-for="a in moreSheet.acts" :key="a.t" class="more-act" :class="{ danger: a.danger }" role="button" @click="moreSheet = null; a.f()">{{ a.t }}</view>
          <view class="more-act cancel" role="button" @click="moreSheet = null">取消</view>
        </template>
      </kg-sheet>
      <view v-if="batchMode && tab !== 'fav'" class="batchbar">
        <kg-button v-if="shownPage.length" variant="text" size="md" @click="selAll">{{ selCount === shownPage.length ? '取消全选' : '全选本页' }}</kg-button>
        <text class="bb-n">已选 {{ selCount }}</text>
        <kg-button variant="text" size="md" aria-label="退出批量" @click="toggleBatch">退出</kg-button>
        <view class="bb-acts">
          <kg-button v-if="tab === 'todo'" variant="primary" size="md" aria-label="重练所选错题" :disabled="!selCount || batchBusy" @click="redoSel">重练</kg-button>
          <kg-button variant="secondary" size="md" aria-label="导出所选为 PDF" :disabled="!selCount || batchBusy || exporting" @click="openExportSel">导出</kg-button>
          <kg-button v-if="tab === 'todo'" variant="secondary" size="md" :disabled="!selCount || batchBusy" @click="batchMaster(true)">标已掌握</kg-button>
          <kg-button v-else variant="secondary" size="md" :disabled="!selCount || batchBusy" @click="batchMaster(false)">恢复复习</kg-button>
          <kg-button variant="secondary" size="md" tone="bad" :disabled="!selCount || batchBusy" @click="batchDel">删除</kg-button>
        </view>
      </view>

      <!-- 题目纠错 -->
      <kg-sheet v-model="reportOpen" title="题目纠错">
        <kg-chip-row size="sm" :options="reportTypes.map((t) => ({ label: t, value: t }))" wrap :model-value="reportType" :scroll-to-selected="false" @update:model-value="(v) => (reportType = v)" />
        <textarea
          v-model="reportDetail"
          class="rp-detail"
          placeholder="补充说明（选填，500 字以内）"
          :maxlength="500"
        />
        <template #footer><kg-button variant="primary" size="lg" block :disabled="!reportType || reportBusy" :loading="reportBusy" @click="submitReport">{{ reportBusy ? '提交中…' : '提交纠错' }}</kg-button></template>
      </kg-sheet>

      <!-- 右下角「＋」：扫描答题卡 / 手动录入 -->
      <view v-if="tab !== 'fav' && !batchMode" class="fabmenu">
        <template v-if="fabOpen">
          <kg-button variant="secondary" size="lg" icon="scan-line" @click="fabOpen = false; scanSheetPick()">{{ scanning ? '识别中…' : '扫描答题卡' }}</kg-button>
          <kg-button variant="secondary" size="lg" icon="pencil-line" @click="fabOpen = false; manualOpenSheet()">手动录入答案</kg-button>
        </template>
        <view class="fab-main" :class="{ open: fabOpen }" role="button" :aria-label="fabOpen ? '收起' : '录入错题'" @click="fabOpen = !fabOpen"><l-icon name="plus" :size="28" tone="on-brand" /></view>
      </view>
    </template>
  </view>
</template>

<script>
import { md } from '../../md.js';
import { request, anonUid, exportPdf, scanSheet, shareCreate, trackEvent, qShareText, shareVariant, isStaleUidErr } from '../../api.js';
import { buildBookUrl, parseBookOpts } from '../../book-url.js';
import { setBookBadge } from '../../tabbar-badge.js';
import { mistakePaper, paperGroups, inPaper } from '../../book-paper.js';
import { cacheMistakes, getCachedMistakes } from '../../offline.js';
import { qStatLine } from '../../q-stat.js';
import { fontSizes, normFontLv } from '../../font-size.js';
import { askPrefill, askAnswerLetter } from '../../ask-prefill.js';
import { askQid, findAskSid } from '../../ask-link.js';
import { similarItemFromQuestion, mistakeRecFromExtra, reviewReasonMid, reviewAskAnswer, similarSubmodule, hasSimilarPool } from '../../review-similar.js';
import { buildReviewSnap, parseReviewSnap } from '../../review-snap.js';
import { reviewSummary } from '../../review-summary.js';
import { reviewOptions, reviewOptionsFull } from '../../review-opts.js';
import { redoSkippedNote } from '../../book-redo-skipped.js';
import { inlineSkipNote } from '../../paper-inline-note.js';
import { scanPageLabel, scanPagesNote, recordScanPage } from '../../paper-scan-pages.js';
import { scanRowJumpable, findScanMistake, pageNFor } from '../../paper-scan-jump.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };
// 只描述作答形式、不是题型/考点的 question_type（时政题库存的是「单选」）：标签退回模块名
const ANSWER_FORMATS = ['单选', '多选', '判断', '不定项'];

function extractLetter(s) {
  const m = /[A-D]+/.exec(String(s || '').toUpperCase());
  return m ? [...new Set(m[0])].sort().join('') : null;
}

export default {
  data() {
    return {
      items: [],
      askSeenTick: 0,
      loading: true,
      loadErr: '',
      offlineView: false,
      due: [],
      dueTotal: 0,
      autoReview: false,
      reviewing: false,
      fontLv: normFontLv(uni.getStorageSync('fontLv')),
      celebrate: false,
      celebrateN: 0,
      rSummary: null,
      reinforce: null,
      reinforceItems: [],
      rItems: [],
      resumeInfo: null,
      rIdx: 0,
      picked: null,
      answered: false,
      reportOpen: false,
      reportTarget: null,
      reportType: '',
      reportDetail: '',
      reportBusy: false,
      reportTypes: ['答案错误', '解析错误', '题干或选项错字', '图片缺失', '分类错误', '重复题', '其他'],
      wasCorrect: false,
      nextDays: 0,
      streak: 0,
      filterMod: '',
      srcFilter: '',
      rzFilter: '',
      pidFilter: 0,
      masteryMods: {},
      masteryT3: {},
      kw: '',
      kpFilter: '',
      kp3Filter: '',
      favKw: '',
      tab: 'todo',
      favs: [],
      filterOpen: false,
      exporting: false,
      exportConfirm: false,
      exportSel: false,
      scanning: false,
      scanOpen: false,
      scanResult: null,
      scanAcc: {},
      manualOpen: false,
      manualCode: '',
      manualPaper: null,
      manualPicks: {},
      manualLoading: false,
      manualSubmitting: false,
      fabOpen: false,
      recentPapers: [],
      mgOpen: {},
      aiOpen: false,
      aiLoading: false,
      aiHtml: '',
      aiErr: '',
      sortBy: 'time',
      pageN: 20,
      batchMode: false,
      kbId: null,
      kbdHelp: false,
      moreSheet: null,
      selIds: {},
      batchBusy: false,
      recapOpen: typeof window !== 'undefined' && window.innerWidth >= 1024,
      REASONS: ['粗心大意', '概念不清', '方法不会', '纯蒙的'],
      SORTS: [
        { k: 'time', name: '最新' },
        { k: 'old', name: '最早' },
        { k: 'due', name: '待复习优先' },
        { k: 'times', name: '错次多' },
        { k: 'type', name: '按题型' },
        { k: 'reason', name: '按错因' },
      ],
    };
  },
  computed: {
    qStyle() { return { fontSize: fontSizes(this.fontLv).q }; },
    hasFilter() {
      return !!(this.filterMod || this.kpFilter || this.kp3Filter || this.srcFilter || this.rzFilter || this.pidFilter);
    },
    askableReview() {
      return !!askPrefill(this.cur && this.cur.question_text, this.cur && this.cur.options);
    },
    similarableReview() {
      return hasSimilarPool(this.cur);
    },
    curOpts() {
      return reviewOptions(this.cur);
    },
    curOptFull() {
      return reviewOptionsFull(this.curOpts);
    },
    reviewAskSeen() {
      void this.askSeenTick;
      return findAskSid(uni.getStorageSync('askSessions'), uni.getStorageSync('askCurSession'), this.cur && this.cur.question_id);
    },
    optStyle() { return { fontSize: fontSizes(this.fontLv).opt }; },
    manualPickedCount() {
      return Object.keys(this.manualPicks).length;
    },
    cur() {
      return this.rItems[this.rIdx] || {};
    },
    favShown() {
      const k = this.favKw.trim().toLowerCase();
      if (!k) return this.favs;
      return this.favs.filter((f) =>
        String(f.question || '').toLowerCase().includes(k) ||
        String(f.submodule || '').toLowerCase().includes(k) ||
        this.modName(f.module).includes(k)
      );
    },
    curLetter() {
      return extractLetter(this.cur.correct_answer);
    },
    curMulti() {
      return !!this.curLetter && this.curLetter.length > 1;
    },
    curHtml() {
      return md(this.cur.explanation || '');
    },
    chipList() {
      const mods = [...new Set(this.items.map((m) => m.module).filter(Boolean))];
      return [{ key: '', name: '全部' }, ...mods.map((m) => ({ key: m, name: NAMES[m] || m }))];
    },
    todoItems() {
      return this.items.filter((m) => !m.mastered);
    },
    hasExamMistakes() {
      return this.items.some((m) => m.source === 'exam');
    },
    hasReasonTagged() {
      return this.items.some((m) => m.error_reason);
    },
    paperGroups() {
      return paperGroups(this.items);
    },
    pidLabel() {
      const g = paperGroups(this.items, Infinity).find((x) => x.pid === this.pidFilter);
      return g ? g.psource : '本卷错题';
    },
    doneItems() {
      return this.items.filter((m) => m.mastered);
    },
    shownItems() {
      if (this.tab === 'fav') return [];
      let base = this.tab === 'done' ? this.doneItems : this.todoItems;
      if (this.filterMod) base = base.filter((m) => m.module === this.filterMod);
      if (this.kpFilter) base = base.filter((m) => this.groupKey(m) === this.kpFilter);
      if (this.kp3Filter) base = base.filter((m) => m.tag3_name === this.kp3Filter);
      if (this.srcFilter === 'exam') base = base.filter((m) => m.source === 'exam');
      else if (this.srcFilter === 'practice') base = base.filter((m) => m.source !== 'exam');
      if (this.pidFilter) base = base.filter((m) => inPaper(m, this.pidFilter));
      if (this.rzFilter === '未标注') base = base.filter((m) => !m.error_reason);
      else if (this.rzFilter) base = base.filter((m) => m.error_reason === this.rzFilter);
      base = [...base];
      if (this.sortBy === 'times') base.sort((a, b) => (b.times || 1) - (a.times || 1));
      else if (this.sortBy === 'type') base.sort((a, b) => String(a.question_type || a.module || '').localeCompare(String(b.question_type || b.module || ''), 'zh'));
      else if (this.sortBy === 'reason') base.sort((a, b) => String(a.error_reason || '\uffff').localeCompare(String(b.error_reason || '\uffff'), 'zh'));
      else if (this.sortBy === 'due') base.sort((a, b) => (a.next_review || 9e12) - (b.next_review || 9e12));
      else if (this.sortBy === 'old') base.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
      const k = this.kw.trim().toLowerCase();
      if (k) {
        base = base.filter(
          (m) =>
            (m.question_text || '').toLowerCase().includes(k) ||
            (m.question_type || '').toLowerCase().includes(k) ||
            (m.error_reason || '').includes(k) ||
            (!m.question_type && (NAMES[m.module] || '').toLowerCase().includes(k))
        );
      }
      return base;
    },
    shownPage() {
      return this.shownItems.slice(0, this.pageN);
    },
    selCount() {
      return Object.keys(this.selIds).length;
    },
    // 批量勾选的错题行（只看当前 tab，与 batchMaster/batchDel 同源；筛选变化后被隐藏的已选项仍算）
    selItems() {
      const base = this.tab === 'done' ? this.doneItems : this.todoItems;
      return base.filter((m) => this.selIds[m.id]);
    },
    exportSheetless() {
      return this.exportList.slice(0, 100).filter((m) => !m.question_id && (m.question_text || '').trim()).length;
    },
    exportList() {
      return this.exportSel ? this.selItems : this.shownItems;
    },
    weekTrend() {
      if (!this.items.length) return null;
      const DAY = 86400;
      const now = Date.now() / 1000;
      const weeks = [];
      for (let i = 3; i >= 0; i--) {
        const start = now - (i + 1) * 7 * DAY;
        const end = now - i * 7 * DAY;
        const inWin = (t) => t >= start && t < end;
        const n = this.items.filter((m) => inWin(m.created_at || 0)).length;
        const k = this.items.filter((m) => m.mastered && inWin(m.mastered_at || 0)).length;
        weeks.push({ label: i === 0 ? '本周' : i + '周前', n, k });
      }
      const max = Math.max(...weeks.map((w) => Math.max(w.n, w.k)), 1);
      for (const w of weeks) {
        w.pct = Math.max(Math.round((w.n / max) * 100), w.n ? 8 : 0);
        w.kpct = Math.max(Math.round((w.k / max) * 100), w.k ? 8 : 0);
      }
      const last7 = this.items.filter((m) => (m.created_at || 0) >= now - 7 * DAY).length;
      const klast7 = this.items.filter((m) => m.mastered && (m.mastered_at || 0) >= now - 7 * DAY).length;
      return { weeks, last7, klast7 };
    },
    monthRecap() {
      const now = new Date();
      const m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
      const cur = this.items.filter((m) => (m.created_at || 0) >= m0);
      const agg = (keyf) => {
        const map = {};
        for (const m of cur) {
          const k = keyf(m);
          map[k] = (map[k] || 0) + 1;
        }
        return Object.entries(map)
          .map(([name, n]) => ({ name, n }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 6);
      };
      return {
        total: cur.length,
        byModule: agg((m) => NAMES[m.module] || m.module || '其他'),
        byReason: agg((m) => m.error_reason || '未标注'),
      };
    },
    modGroups() {
      if (this.tab === 'fav') return [];
      const base = this.tab === 'done' ? this.doneItems : this.todoItems;
      const map = {};
      for (const m of base) {
        const key = m.module || 'other';
        if (!map[key]) map[key] = { key, name: NAMES[key] || key || '其他', n: 0, subs: {} };
        map[key].n++;
        const t = this.groupKey(m);
        if (!map[key].subs[t]) map[key].subs[t] = { n: 0, t3: {} };
        map[key].subs[t].n++;
        if (m.tag3_name) map[key].subs[t].t3[m.tag3_name] = (map[key].subs[t].t3[m.tag3_name] || 0) + 1;
      }
      return Object.values(map)
        .map((g) => ({
          ...g,
          subs: Object.entries(g.subs)
            .map(([name, s]) => ({
              name,
              n: s.n,
              t3: Object.entries(s.t3)
                .map(([tn, tc]) => ({ name: tn, n: tc }))
                .sort((a, b) => b.n - a.n),
            }))
            .sort((a, b) => b.n - a.n),
        }))
        .sort((a, b) => b.n - a.n);
    },
    typeGroups() {
      if (this.tab === 'fav') return [];
      let base = this.tab === 'done' ? this.doneItems : this.todoItems;
      if (this.filterMod) base = base.filter((m) => m.module === this.filterMod);
      const map = {};
      for (const m of base) {
        const t = this.groupKey(m);
        map[t] = (map[t] || 0) + 1;
      }
      return Object.entries(map)
        .map(([name, n]) => ({ name, n }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 12);
    },
  },
  watch: {
    tab() { this.pageN = 20; this.batchMode = false; this.selIds = {}; this.kbId = null; this.syncBookUrl(); },
    filterMod() { this.pageN = 20; this.syncBookUrl(); },
    kpFilter() { this.pageN = 20; this.syncBookUrl(); },
    kw() { this.pageN = 20; },
    kp3Filter() { this.pageN = 20; this.syncBookUrl(); },
    sortBy() { this.pageN = 20; this.syncBookUrl(); },
    srcFilter() { this.syncBookUrl(); },
    pidFilter() { this.pageN = 20; this.syncBookUrl(); },
    rzFilter() { this.pageN = 20; this.syncBookUrl(); },
  },
  onLoad(opts) {
    const p = parseBookOpts(opts);
    if (p.tab) this.tab = p.tab;
    if (p.mod) this.filterMod = p.mod;
    if (p.kp) this._pendingKp = p.kp;
    if (p.kp3) this._pendingKp3 = p.kp3;
    this._pendingKpFix = !!(opts && (opts.kp || opts.kp3)) && !p.kp && !p.kp3;
    if (p.src) this.srcFilter = p.src;
    if (p.pid) this.pidFilter = p.pid;
    if (p.rz) this.rzFilter = p.rz;
    if (p.sort) this.sortBy = p.sort;
    if (p.review) uni.setStorageSync('autoStartReview', 1);
    this._onAuth = () => {
      if (anonUid() === this._acctUid) return;
      this.resetAccountState();
    };
    uni.$on('authChanged', this._onAuth);
  },
  onReachBottom() {
    if (this.tab !== 'fav' && this.pageN < this.shownItems.length) this.pageN += 20;
  },
  onShow() {
    this.askSeenTick++;
    this.fontLv = normFontLv(uni.getStorageSync('fontLv'));
    this.favs = (uni.getStorageSync('favQuestions') || []).map((f) => ({ ...f, _open: false }));
    if (uni.getStorageSync('bookShowFavs')) {
      uni.removeStorageSync('bookShowFavs');
      if (this.favs.length) this.tab = 'fav';
    }
    if (this.tab === 'fav' && !this.favs.length) this.tab = 'todo';
    if (uni.getStorageSync('autoStartReview')) {
      uni.removeStorageSync('autoStartReview');
      this.autoReview = true;
    }
    const rvIntent = uni.getStorageSync('bookReviewIntent');
    if (rvIntent) uni.removeStorageSync('bookReviewIntent');
    this._acctUid = anonUid();
    if (!this.reviewing) {
      this.resumeInfo = parseReviewSnap(uni.getStorageSync('reviewSnap'), this._acctUid, Date.now() / 1000);
      if (this.resumeInfo && rvIntent) {
        this.resumeReview();
      } else if (!this.resumeInfo) {
        this._reviewIntent = !!rvIntent;
        this.restoreRemoteSnap();
      }
    }
    const rzIntent = uni.getStorageSync('bookRzIntent');
    if (rzIntent) {
      uni.removeStorageSync('bookRzIntent');
      if (this.REASONS.includes(rzIntent) || rzIntent === '未标注') {
        this.tab = 'todo';
        this.rzFilter = rzIntent;
      }
    }
    this.load();
    // #ifdef H5
    if (!this._kbHandler && typeof window !== 'undefined') {
      this._kbHandler = (e) => this.onKeydown(e);
      window.addEventListener('keydown', this._kbHandler);
    }
    // #endif
  },
  onHide() {
    // #ifdef H5
    if (this._kbHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._kbHandler);
      this._kbHandler = null;
    }
    // #endif
  },
  onUnload() {
    if (this._onAuth) uni.$off('authChanged', this._onAuth);
    // #ifdef H5
    if (this._kbHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._kbHandler);
      this._kbHandler = null;
    }
    // #endif
  },
  methods: {
    inlineSkipNote,
    scanPageLabel,
    scanPagesNote,
    scanRowJumpable,
    // 登录态变化（uid 已换）：清掉上一个账号的错题/到期/掌握度/AI 分析，按当前 uid 重拉
    resetAccountState() {
      this.items = [];
      this.due = [];
      this.dueTotal = 0;
      this.masteryMods = {};
      this.masteryT3 = {};
      this.offlineView = false;
      this.loadErr = '';
      this.aiOpen = false;
      this.aiHtml = '';
      this.aiErr = '';
      this.moreSheet = null;
      this.batchMode = false;
      this.selIds = {};
      this.pageN = 20;
      this.scanAcc = {};
      this._pendingScanQid = 0;
      this.reviewing = false;
      this.resumeInfo = null;
      setBookBadge(0);
      this._acctUid = anonUid();
      this.resumeInfo = parseReviewSnap(uni.getStorageSync('reviewSnap'), this._acctUid, Date.now() / 1000);
      if (!this.resumeInfo) {
        this._reviewIntent = false;
        this.restoreRemoteSnap();
      }
      this.load();
    },
    filterByReason(name) {
      if (!name) return;
      this.tab = 'todo';
      this.rzFilter = name;
      this.recapOpen = false;
    },
    syncBookUrl() {
      // #ifdef H5
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', buildBookUrl({ tab: this.tab, mod: this.filterMod, kp: this.kpFilter, kp3: this.kp3Filter, src: this.srcFilter, pid: this.pidFilter, rz: this.rzFilter, sort: this.sortBy }));
      }
      // #endif
    },
    mistakePaper,
    goPaper(pid) {
      if (!Number.isInteger(pid) || pid <= 0) return;
      trackEvent('book_go_paper', 'book', String(pid));
      uni.navigateTo({ url: '/pkgA/exam/list?pid=' + pid });
    },
    // #ifdef H5
    onKeydown(e) {
      if (typeof window === 'undefined' || window.innerWidth < 1024) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      const k = e.key;
      if (this.moreSheet) {
        if (k === 'Escape') { e.preventDefault(); this.moreSheet = null; }
        return;
      }
      if (this.kbdHelp) {
        if (k === 'Escape' || k === '?') { e.preventDefault(); this.kbdHelp = false; }
        return;
      }
      if (k === '?') {
        e.preventDefault();
        this.kbdHelp = true;
        return;
      }
      if (this.reviewing) {
        if (this.answered) {
          if (k === 'Enter') { e.preventDefault(); this.nextReview(); }
        } else if (this.curLetter && /^[a-dA-D]$/.test(k)) {
          e.preventDefault();
          this.pick(k.toUpperCase());
        } else if (this.curMulti && k === 'Enter' && this.picked) {
          e.preventDefault();
          this.confirmMulti();
        }
        return;
      }
      if (this.batchMode || this.manualOpen || this.celebrate || this.reinforce || this.aiOpen) return;
      const list = this.shownPage;
      if (!list.length) return;
      if (k === 'j' || k === 'k' || k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        const dir = k === 'j' || k === 'ArrowDown' ? 1 : -1;
        let idx = list.findIndex((m) => m.id === this.kbId);
        idx = idx < 0 ? (dir > 0 ? 0 : list.length - 1) : Math.min(Math.max(idx + dir, 0), list.length - 1);
        this.kbId = list[idx].id;
        const el = document.getElementById('mc-' + this.kbId);
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if ((k === 'Enter' || k === ' ') && this.kbId != null) {
        e.preventDefault();
        const m = list.find((x) => x.id === this.kbId);
        if (m) this.toggleCard(m);
      }
    },
    // #endif
    manualOpenSheet() {
      this.recentPapers = uni.getStorageSync('recentPapers') || [];
      this.manualPaper = null;
      this.manualPicks = {};
      this.manualCode = '';
      this.manualOpen = true;
    },
    async manualLookup(code) {
      code = String(code || '').trim().toUpperCase();
      if (!code) return uni.showToast({ title: '请输入卷码', icon: 'none' });
      if (this.manualLoading) return;
      this.manualLoading = true;
      try {
        this.manualPaper = await request('/api/paper/' + encodeURIComponent(code));
        this.manualPicks = {};
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none', duration: 3000 });
      }
      this.manualLoading = false;
    },
    manualPick(no, L) {
      const cur = { ...this.manualPicks };
      if (cur[no] === L) delete cur[no];
      else cur[no] = L;
      this.manualPicks = cur;
    },
    closeScan() {
      if (!this.scanOpen) return;
      this.scanOpen = false;
      this.load();
    },
    // 「✗」行 → 关结果 sheet → 列表重拉后定位并展开同 question_id 的错题卡（走既有卡片详情，不新造路由）
    scanRowJump(r) {
      if (!scanRowJumpable(this.scanResult, r)) return;
      this._pendingScanQid = r.question_id;
      trackEvent('book_scan_jump', this.scanResult.code || '', String(r.question_id));
      this.closeScan();
    },
    async applyPendingScanJump() {
      const qid = this._pendingScanQid;
      if (!qid) return;
      this._pendingScanQid = 0;
      const m = findScanMistake(this.items, qid);
      if (!m) {
        uni.showToast({ title: '错题本里未找到这道题', icon: 'none' });
        return;
      }
      this.tab = m.mastered ? 'done' : 'todo';
      this.kw = '';
      if (!this.shownItems.includes(m)) {
        this.filterMod = '';
        this.kpFilter = '';
        this.kp3Filter = '';
        this.srcFilter = '';
        this.pidFilter = 0;
        this.rzFilter = '';
      }
      await this.$nextTick();
      this.pageN = pageNFor(this.shownItems.indexOf(m), this.pageN);
      this.kbId = m.id;
      if (!m.open) this.toggleCard(m);
      await this.$nextTick();
      // #ifdef H5
      const el = typeof document !== 'undefined' && document.getElementById('mc-' + m.id);
      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      // #endif
      // #ifndef H5
      uni.pageScrollTo({ selector: '#mc-' + m.id, duration: 200 });
      // #endif
    },
    async manualSubmit() {
      if (this.manualSubmitting || !this.manualPickedCount) return;
      this.manualSubmitting = true;
      try {
        const d = await request('/api/paper_answers', {
          method: 'POST',
          data: { uid: anonUid(), code: this.manualPaper.code, picks: this.manualPicks },
        });
        this.manualOpen = false;
        this.scanResult = d;
        this.scanOpen = true;
      } catch (e) {
        uni.showToast({ title: '判分失败：' + e.message, icon: 'none', duration: 3000 });
      }
      this.manualSubmitting = false;
    },
    scanSheetPick() {
      if (this.scanning) return;
      uni.chooseImage({
        count: 1,
        success: async (res) => {
          this.scanning = true;
          try {
            const d = await scanSheet({ filePath: res.tempFilePaths[0], uid: anonUid() });
            this.scanAcc = recordScanPage(this.scanAcc, d);
            this.scanResult = d;
            this.scanOpen = true;
          } catch (e) {
            uni.showToast({ title: '识别失败：' + e.message, icon: 'none', duration: 3500 });
          }
          this.scanning = false;
        },
      });
    },
    openExportSel() {
      if (!this.selCount) return;
      this.exportSel = true;
      this.exportConfirm = true;
    },
    closeExport() {
      this.exportConfirm = false;
      this.exportSel = false;
    },
    async exportMistakes(opts) {
      if (this.exporting) return;
      this.exporting = true;
      try {
        const list = this.exportList.slice(0, 100);
        if (!list.length) throw new Error(this.exportSel ? '没有选中的错题' : '当前筛选没有错题');
        const ids = list.filter((m) => m.question_id).map((m) => m.question_id);
        const items = list
          .filter((m) => !m.question_id && (m.question_text || '').trim())
          .map((m) => ({
            module: NAMES[m.module] || m.module || '',
            question: m.question_text,
            answer: extractLetter(m.correct_answer) || '',
            analysis: m.explanation || '',
          }));
        const d = new Date();
        const title = '错题重练卷 ' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
        await exportPdf({
          title,
          question_ids: ids,
          items,
          ...opts,
        });
        this.exportConfirm = false;
        this.exportSel = false;
        uni.showToast({ title: 'PDF 已开始下载', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '导出失败：' + e.message, icon: 'none' });
      }
      this.exporting = false;
    },
    md,
    toggleCard(m) {
      m.open = !m.open;
      if (m.open && m.question_id && !m.attempts) {
        request('/api/attempts?uid=' + encodeURIComponent(anonUid()) + '&question_id=' + m.question_id)
          .then((d) => { m.attempts = (d && d.items) || []; })
          .catch(() => {});
      }
    },
    async aiAnalysis(retry) {
      this.aiOpen = true;
      if (this.aiLoading || (this.aiHtml && retry !== true)) return;
      this.aiErr = '';
      this.aiLoading = true;
      try {
        const d = await request('/api/mistakes/analysis', { method: 'POST', data: { uid: anonUid() }, timeout: 420000 });
        const text = typeof d.analysis === 'string' ? d.analysis.trim() : '';
        if (!text) throw new Error('AI 未返回内容，请稍后再试');
        this.aiHtml = md(text);
      } catch (e) {
        if (this.aiHtml) uni.showToast({ title: '重新生成失败：' + (e.message || '请稍后重试'), icon: 'none' });
        else this.aiErr = e.message || '请稍后重试';
      }
      this.aiLoading = false;
    },
    toggleGroup(key) {
      this.mgOpen = { ...this.mgOpen, [key]: !this.mgOpen[key] };
    },
    pickGroup(mod, sub, t3) {
      this.filterMod = mod;
      this.kpFilter = sub || '';
      this.kp3Filter = t3 || '';
    },
    groupKey(m) {
      return this.tagName(m) || '其他';
    },
    // 题型标签统一粒度：去掉「模块名-」前缀（历史数据两种格式并存），无题型时用模块名
    tagName(m) {
      const qt = m.question_type || '';
      if (!qt || ANSWER_FORMATS.includes(qt)) return this.modName(m.module);
      return qt.includes('-') ? qt.split('-').slice(1).join('-') : qt;
    },
    unfavItem(f) {
      this.unfav(this.favs.indexOf(f));
    },
    unfav(i) {
      if (i < 0) return;
      this.favs.splice(i, 1);
      uni.setStorageSync('favQuestions', this.favs.map(({ _open, ...f }) => f));
      if (!this.favs.length) this.tab = 'todo';
    },
    isDue(m) {
      return !m.next_review || m.next_review <= Date.now() / 1000;
    },
    nextReviewText(m) {
      if (this.isDue(m)) return '今日待复习';
      const days = Math.ceil((m.next_review - Date.now() / 1000) / 86400);
      return days === 1 ? '明天复习' : days + ' 天后复习';
    },
    modName(m) {
      return NAMES[m] || m || '';
    },
    masteryClass(m) {
      if (m.mastered) return 'lv-good';
      if (!m.review_count) return 'lv-new';
      return m.review_count >= 2 ? 'lv-good' : 'lv-mid';
    },
    mStatLine(m) {
      return qStatLine({
        attempt_count: m.attempt_count,
        correct_ratio: m.correct_ratio,
        most_wrong: m.most_wrong,
        answer: this.ansLetter(m.correct_answer),
      });
    },
    ansLetter(s) {
      const m = /[A-D]+/.exec(String(s || '').toUpperCase());
      return m ? [...new Set(m[0])].sort().join('') : '';
    },
    async master(m, on = true) {
      try {
        await request('/api/mistakes/' + m.id, { method: 'PATCH', data: { uid: anonUid(), mastered: on ? 1 : 0 } });
      } catch (e) {
        uni.showToast({ title: '操作失败：' + (e.message || '请稍后重试'), icon: 'none' });
        return;
      }
      m.mastered = on ? 1 : 0;
      m.mastered_at = on ? (m.mastered_at || Date.now() / 1000) : null;
      uni.showToast({ title: on ? '已掌握！' : '已恢复复习', icon: on ? 'success' : 'none' });
      this.load();
    },
    openFavPage() {
      uni.navigateTo({ url: '/pkgA/social/favorites' });
    },
    goPractice() {
      uni.switchTab({ url: '/pages/home/home' });
    },
    goAskScan() {
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    async load() {
      const seq = (this._loadSeq = (this._loadSeq || 0) + 1);
      this.loading = true;
      this.loadErr = '';
      // 快照即显：屏上已有列表或本地缓存有错题时先铺屏（uid API 长尾下不再停留 spinner），真实响应到达后覆盖
      if (!this.items.length) {
        const snap = getCachedMistakes(anonUid());
        if (snap && snap.items && snap.items.length) {
          this.items = snap.items.map((m) => ({ ...m, open: false, html: md(m.explanation || '') }));
        }
      }
      if (this.items.length) this.loading = false;
      try {
        const uq = 'uid=' + encodeURIComponent(anonUid());
        const [d, r] = await Promise.all([request('/api/mistakes?' + uq), request('/api/review?' + uq)]);
        if (seq !== this._loadSeq) return;
        this.items = d.items.map((m) => ({ ...m, open: false, html: md(m.explanation || '') }));
        this.due = r.items;
        this.dueTotal = r.total || r.items.length;
        if (this.autoReview) {
          this.autoReview = false;
          if (this.due.length && !this.reviewing) this.startReview();
        }
        this.offlineView = false;
        this.applyPendingKp();
        this.applyPendingScanJump();
        cacheMistakes(d.items, anonUid());
        this.loadMastery();
        setBookBadge(this.dueTotal);
      } catch (e) {
        if (seq !== this._loadSeq) return;
        if (isStaleUidErr(e)) {
          this.loading = false;
          return;
        }
        const c = getCachedMistakes(anonUid());
        if (c && c.items && c.items.length) {
          this.items = c.items.map((m) => ({ ...m, open: false, html: md(m.explanation || '') }));
          this.offlineView = true;
          uni.showToast({ title: '当前无网络，展示已缓存的错题', icon: 'none' });
        } else {
          this.loadErr = e.message || '网络异常';
          uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
        }
        this._pendingScanQid = 0;
      }
      this.loading = false;
    },
    // 入向 ?kp=/?kp3= 深链：列表到达后校验命中才生效（fail-closed：无命中丢弃并纠正 URL）
    applyPendingKp() {
      const kp = this._pendingKp;
      const kp3 = this._pendingKp3;
      if (!kp && !kp3) {
        if (this._pendingKpFix) {
          this._pendingKpFix = false;
          this.syncBookUrl();
        }
        return;
      }
      this._pendingKp = '';
      this._pendingKp3 = '';
      if (kp3) {
        const hit = this.items.find((m) => m.tag3_name === kp3);
        if (hit) {
          this.filterMod = hit.module || this.filterMod;
          this.kpFilter = kp && this.items.some((m) => this.groupKey(m) === kp) ? kp : '';
          this.kp3Filter = kp3;
          return;
        }
      }
      if (kp && this.items.some((m) => this.groupKey(m) === kp)) {
        this.kpFilter = kp;
        this.kp3Filter = '';
        return;
      }
      this.syncBookUrl();
    },
    async loadMastery() {
      try {
        const map = await request('/api/mastery/map?uid=' + encodeURIComponent(anonUid()));
        const mods = {};
        const t3s = {};
        for (const m of map.modules || []) {
          if (m.n) mods[m.module] = { pct: Math.round(m.mastery * 100), level: m.level_name };
          for (const s of m.subs || []) {
            for (const t of s.tag3s || []) {
              if (t.n) t3s[t.name] = Math.round(t.mastery * 100);
            }
          }
        }
        this.masteryMods = mods;
        this.masteryT3 = t3s;
      } catch (e) { /* 掌握度为增强信息，失败静默降级 */ }
    },
    startReviewFromCard() {
      trackEvent('review_entry_click', 'book_card');
      this.startReview();
    },
    startReview() {
      this.rItems = [...this.due];
      this.rIdx = 0;
      this.resetQ();
      this.reviewing = true;
      this.resumeInfo = null;
      this.saveReviewSnap();
    },
    saveReviewSnap() {
      const snap = buildReviewSnap(this, anonUid(), Date.now() / 1000);
      if (!snap) return;
      uni.setStorageSync('reviewSnap', snap);
      if (this._snapPostTimer) clearTimeout(this._snapPostTimer);
      this._snapPostTimer = setTimeout(() => {
        this._snapPostTimer = null;
        request('/api/review/cur', { method: 'POST', data: { uid: anonUid(), snap } }).catch(() => {});
      }, 1500);
    },
    clearReviewSnap() {
      uni.removeStorageSync('reviewSnap');
      this.resumeInfo = null;
      if (this._snapPostTimer) {
        clearTimeout(this._snapPostTimer);
        this._snapPostTimer = null;
      }
      request('/api/review/cur', { method: 'POST', data: { uid: anonUid(), snap: null } }).catch(() => {});
    },
    restoreRemoteSnap() {
      const uid = anonUid();
      const wantResume = this._reviewIntent;
      this._reviewIntent = false;
      request('/api/review/cur?uid=' + encodeURIComponent(uid))
        .then((r) => {
          if (this.reviewing || this.resumeInfo) return;
          if (parseReviewSnap(uni.getStorageSync('reviewSnap'), uid, Date.now() / 1000)) return;
          this.resumeInfo = parseReviewSnap(r && r.snap, uid, Date.now() / 1000);
          if (this.resumeInfo && wantResume) this.resumeReview();
        })
        .catch(() => {});
    },
    resumeReview() {
      const r = this.resumeInfo;
      if (!r) return;
      trackEvent('review_resume_click', 'book');
      this.rItems = r.items.map((x) => ({ ...x }));
      this.rIdx = r.rIdx;
      this.picked = r.picked;
      this.answered = r.answered;
      this.wasCorrect = r.wasCorrect;
      this.nextDays = r.nextDays;
      this.reviewing = true;
      this.resumeInfo = null;
    },
    discardResume() {
      this.clearReviewSnap();
    },
    resetQ() {
      this.picked = null;
      this.answered = false;
      this.wasCorrect = false;
      this.nextDays = 0;
    },
    async pick(o) {
      if (this.answered) return;
      if (this.curMulti) {
        const set = new Set((this.picked || '').split(''));
        if (set.has(o)) set.delete(o);
        else set.add(o);
        this.picked = [...set].sort().join('');
        return;
      }
      this.picked = o;
      await this.record(o === this.curLetter);
      this.saveReviewSnap();
    },
    async confirmMulti() {
      if (this.answered || !this.picked) return;
      await this.record(this.picked === this.curLetter);
      this.saveReviewSnap();
    },
    async selfJudge(correct) {
      await this.record(correct);
      this.saveReviewSnap();
    },
    async record(correct) {
      this.wasCorrect = correct;
      this.answered = true;
      this.cur._res = correct;
      if (this.cur._extra) {
        if (!correct) this.saveExtraWrong(this.cur);
        return;
      }
      if (!correct && !this.cur._requeued) {
        const { _res, ...rest } = this.cur;
        void _res;
        this.rItems.push({ ...rest, _requeued: true });
      }
      if (!correct) this.appendSimilar(this.cur);
      try {
        const res = await request('/api/review/' + this.cur.id, { method: 'POST', data: { correct, uid: anonUid() } });
        this.nextDays = res.next_review_days;
        this.streak = res.streak;
      } catch (e) {
        uni.showToast({ title: '记录失败：' + e.message, icon: 'none' });
      }
    },
    async appendSimilar(m) {
      // 答错自动加推：本轮末尾追加最多 2 道同类新题（不写 SRS，不影响复习记录）
      if (m._simFetched || m._requeued || !hasSimilarPool(m)) return;
      m._simFetched = true;
      const sub = similarSubmodule(m);
      try {
        let q = '/api/questions?limit=2&uid=' + encodeURIComponent(anonUid()) + '&module=' + encodeURIComponent(m.module);
        if (sub) q += '&submodule=' + encodeURIComponent(sub);
        const d = await request(q);
        const add = (d.items || [])
          .filter((x) => x.id !== m.question_id)
          .slice(0, 2)
          .map(similarItemFromQuestion)
          .filter(Boolean);
        if (add.length) {
          this.rItems.push(...add);
          m._appended = add.length;
          this.$forceUpdate();
          this.saveReviewSnap();
          trackEvent('review_similar_auto', m.module || '');
        }
      } catch (e) { /* 非关键路径 */ }
    },
    reviewReasonMid,
    async setReviewReason(rz) {
      const m = this.cur;
      const mid = reviewReasonMid(m);
      if (!mid) return;
      m.error_reason = rz;
      this.$forceUpdate();
      try {
        await request('/api/mistakes/' + mid, { method: 'PATCH', data: { uid: anonUid(), error_reason: rz } });
        this.saveReviewSnap();
        trackEvent('review_reason_tag', rz);
      } catch (e) { /* 非关键路径 */ }
    },
    async saveExtraWrong(item) {
      if (item._saved) return;
      const rec = mistakeRecFromExtra(item, this.picked, anonUid());
      if (!rec) return;
      try {
        const res = await request('/api/mistakes', { method: 'POST', data: rec });
        const mid = reviewReasonMid({ id: res && res.id });
        if (!mid) return;
        item._mid = mid;
        item._saved = true;
        this.$forceUpdate();
        this.saveReviewSnap();
      } catch (e) { /* 非关键路径 */ }
    },
    similarFromReview() {
      trackEvent('review_similar_click', this.cur.module || '');
      this.practiceSimilar(this.cur);
    },
    openSeenAsk() {
      if (!this.reviewAskSeen) return;
      if (this.reviewAskSeen.sid > 0) uni.setStorageSync('askOpenSid', this.reviewAskSeen.sid);
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    askFromReview() {
      const text = askPrefill(this.cur.question_text, this.cur.options);
      if (!text) return;
      trackEvent('review_ask_click', this.cur.module || '');
      uni.setStorageSync('redoQuestion', text);
      const qid = askQid(this.cur.question_id);
      if (qid) uni.setStorageSync('redoQid', qid);
      else uni.removeStorageSync('redoQid');
      const ans = reviewAskAnswer(this.cur, this.picked);
      if (ans) uni.setStorageSync('redoAnswer', ans);
      else uni.removeStorageSync('redoAnswer');
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    nextReview() {
      if (this.rIdx + 1 < this.rItems.length) {
        this.rIdx++;
        this.resetQ();
        this.saveReviewSnap();
      } else {
        this.celebrateN = this.rItems.filter((q) => !q._extra && !q._requeued).length;
        this.rSummary = reviewSummary(this.rItems);
        this.exitReview();
        this.celebrate = true;
        trackEvent('review_done_celebrate', 'book');
      }
    },
    closeCelebrate() {
      this.celebrate = false;
      this.fetchReinforce();
    },
    async fetchReinforce() {
      try {
        const d = await request('/api/reinforce/suggest?uid=' + encodeURIComponent(anonUid()));
        this.reinforceItems = d.items || [];
        if (d.picked) {
          this.reinforce = d.picked;
          return;
        }
      } catch (e) { /* 非关键路径 */ }
      uni.showToast({ title: '本轮复习完成！', icon: 'success' });
    },
    swapReinforce() {
      const i = this.reinforceItems.findIndex((x) => x.skill === this.reinforce.skill);
      this.reinforce = this.reinforceItems[(i + 1) % this.reinforceItems.length];
    },
    startReinforce(item) {
      this.reinforce = null;
      uni.setStorageSync('practiceLaunch', {
        kind: 'reinforce',
        module: item.module,
        submodule: item.submodule,
        tag3: item.tag3 || null,
        count: 5,
        mastery: item.mastery,
      });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    exitReview() {
      this.reviewing = false;
      this.clearReviewSnap();
      this.load();
      uni.pageScrollTo({ scrollTop: 0, duration: 0 });
    },
    optClass(o) {
      if (!this.answered) return this.curMulti && (this.picked || '').includes(o) ? 'sel' : '';
      if ((this.curLetter || '').includes(o)) return 'ok';
      if ((this.picked || '').includes(o)) return 'bad';
      return 'dim';
    },
    fmt(ts) {
      const d = new Date(ts * 1000);
      const now = new Date();
      const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      const sameDay = (a, b) => a.toDateString() === b.toDateString();
      if (sameDay(d, now)) return '今天 ' + hm;
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      if (sameDay(d, yest)) return '昨天 ' + hm;
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    },
    // 按卷筛选态：复用按卷「只练错题」协议直达，保留卷面顺序与归卷完成页
    redoPaper() {
      const g = paperGroups(this.items, Infinity).find((x) => x.pid === this.pidFilter);
      if (!g) return;
      trackEvent('book_redo_paper', 'book', String(g.pid));
      uni.setStorageSync('practiceLaunch', { kind: 'paper', source: g.psource, pid: g.pid, title: g.title || g.psource, untimed: true, wrong: true });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    // 批量勾选 → 只重练选中行（后端仍按 uid/mastered 约束，最多 25 题与接口上限一致）
    async redoSel() {
      const ids = this.selItems.filter((m) => !m.mastered).map((m) => m.id);
      if (!ids.length || this.batchBusy) return;
      if (ids.length > 25) {
        uni.showToast({ title: '一次最多重练 25 题，请减少勾选', icon: 'none' });
        return;
      }
      this.batchBusy = true;
      try {
        const d = await request('/api/mistakes/redo?limit=25&uid=' + encodeURIComponent(anonUid()) + '&mids=' + ids.join(','));
        if (!d.items || !d.items.length) {
          uni.showToast({ title: '选中的错题未能匹配到题库原题', icon: 'none' });
          return;
        }
        trackEvent('book_redo_sel', 'book', String(d.items.length));
        uni.setStorageSync('redoSet', d.items);
        uni.setStorageSync('redoNote', redoSkippedNote(ids.length, d.items.length));
        uni.navigateTo({ url: '/pages/practice/practice' });
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      } finally {
        this.batchBusy = false;
      }
    },
    async redoAll() {
      if (this.pidFilter) return this.redoPaper();
      try {
        let q = '/api/mistakes/redo?limit=10&uid=' + encodeURIComponent(anonUid());
        if (this.kpFilter) {
          const isModName = Object.values(NAMES).includes(this.kpFilter);
          if (isModName) {
            const key = Object.keys(NAMES).find((k) => NAMES[k] === this.kpFilter);
            q += '&module=' + key + '&noqt=1';
          } else {
            q += '&qtype=' + encodeURIComponent(this.kpFilter);
          }
        } else if (this.filterMod) {
          q += '&module=' + this.filterMod;
        }
        if (this.rzFilter) q += '&rz=' + encodeURIComponent(this.rzFilter);
        if (this.srcFilter) q += '&src=' + this.srcFilter;
        if (this.kp3Filter) {
          const hit = this.shownItems.find((m) => m.tag3_name === this.kp3Filter && m.tag3);
          if (hit) q += '&t3=' + encodeURIComponent(hit.tag3);
        }
        const d = await request(q);
        if (!d.items || !d.items.length) {
          uni.showToast({ title: '错题未能匹配到题库原题', icon: 'none' });
          return;
        }
        uni.setStorageSync('redoSet', d.items);
        uni.navigateTo({ url: '/pages/practice/practice' });
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
    mAskSeen(m) {
      return findAskSid(uni.getStorageSync('askSessions'), uni.getStorageSync('askCurSession'), m && m.question_id);
    },
    openSeenAskM(m) {
      const seen = this.mAskSeen(m);
      if (!seen) return;
      if (seen.sid > 0) uni.setStorageSync('askOpenSid', seen.sid);
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    redo(m) {
      const text = askPrefill(m.question_text, m.options);
      if (!text) return;
      uni.setStorageSync('redoQuestion', text);
      const qid = askQid(m.question_id);
      if (qid) uni.setStorageSync('redoQid', qid);
      else uni.removeStorageSync('redoQid');
      const ans = askAnswerLetter(m.user_answer);
      if (ans) uni.setStorageSync('redoAnswer', ans);
      else uni.removeStorageSync('redoAnswer');
      trackEvent('book_ask_click', m.module || '', String(qid || ''));
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    reinforceFromMistake(m) {
      const qt = m.question_type || '';
      const sub = qt.includes('-') ? qt.split('-').slice(1).join('-') : qt || null;
      this.startReinforce({ module: m.module, submodule: similarSubmodule(m) || sub, tag3: m.tag3, mastery: null });
    },
    practiceSimilar(m) {
      uni.setStorageSync('practicePreset', { module: m.module, submodule: similarSubmodule(m), count: 3 });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    openReport(m) {
      if (!m.question_id) return;
      this.reportTarget = m;
      this.reportType = '';
      this.reportDetail = '';
      this.reportOpen = true;
    },
    async submitReport() {
      const m = this.reportTarget;
      if (!m || !this.reportType || this.reportBusy) return;
      this.reportBusy = true;
      try {
        await request('/api/question_report', {
          method: 'POST',
          data: { question_id: m.question_id, uid: anonUid(), type: this.reportType, detail: this.reportDetail.slice(0, 500) },
        });
        m._reported = true;
        this.reportOpen = false;
        uni.showToast({ title: '感谢反馈，我们会尽快核查', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: '提交失败：' + e.message, icon: 'none' });
      } finally {
        this.reportBusy = false;
      }
    },
    itemSheet(m) {
      const acts = [];
      if (m.tag3) acts.push({ t: '同考点强化 5 道新题', f: () => this.reinforceFromMistake(m) });
      if (hasSimilarPool(m)) acts.push({ t: '练3道同类', f: () => this.practiceSimilar(m) });
      if (m.question_id) acts.push({ t: '题目纠错', f: () => this.openReport(m) });
      if (m.question_id) acts.push({ t: '分享给队友', f: () => this.shareToMates(m) });
      if (!m.mastered) acts.push({ t: '标为已掌握', f: () => this.master(m) });
      else acts.push({ t: '恢复复习', f: () => this.master(m, false) });
      acts.push({ t: '删除', danger: true, f: () => this.del(m) });
      this.moreSheet = { m, acts };
    },
    async setItemReason(m, rz) {
      const next = m.error_reason === rz ? '' : rz;
      m.error_reason = next;
      this.$forceUpdate();
      try {
        await request('/api/mistakes/' + m.id, { method: 'PATCH', data: { uid: anonUid(), error_reason: next } });
      } catch (e) {
        uni.showToast({ title: e.message || '保存失败', icon: 'none' });
      }
    },
    async shareToMates(m) {
      try {
        uni.showLoading({ title: '生成分享链接…' });
        const d = await shareCreate(m.question_id);
        uni.hideLoading();
        const mod = d.submodule || this.modName(d.module) || '行测';
        trackEvent('share_copy', 'book_' + shareVariant(), d.sid);
        uni.setClipboardData({
          data: qShareText(mod, d.sid),
          success: () => uni.showToast({ title: '分享链接已复制，发给队友吧', icon: 'none' }),
        });
      } catch (e) {
        uni.hideLoading();
        uni.showToast({ title: e.message || '分享失败', icon: 'none' });
      }
    },
    toggleBatch() {
      this.batchMode = !this.batchMode;
      this.selIds = {};
    },
    toggleSel(m) {
      if (this.selIds[m.id]) delete this.selIds[m.id];
      else this.selIds[m.id] = true;
      this.selIds = { ...this.selIds };
    },
    selAll() {
      if (this.selCount === this.shownPage.length) {
        this.selIds = {};
      } else {
        const s = {};
        this.shownPage.forEach((m) => { s[m.id] = true; });
        this.selIds = s;
      }
    },
    async batchMaster(on) {
      if (!this.selCount || this.batchBusy) return;
      this.batchBusy = true;
      try {
        await Promise.all(Object.keys(this.selIds).map((id) =>
          request('/api/mistakes/' + id, { method: 'PATCH', data: { uid: anonUid(), mastered: on ? 1 : 0 } })
        ));
        uni.showToast({ title: (on ? '已掌握 ' : '已恢复复习 ') + this.selCount + ' 题', icon: 'none' });
        this.selIds = {};
        this.load();
      } catch (e) {
        uni.showToast({ title: '部分操作失败：' + e.message, icon: 'none' });
        this.load();
      } finally {
        this.batchBusy = false;
      }
    },
    batchDel() {
      if (!this.selCount || this.batchBusy) return;
      uni.showModal({
        title: '删除选中的 ' + this.selCount + ' 道错题？',
        content: '删除后不可恢复，也不再进入复习队列',
        success: async (res) => {
          if (!res.confirm) return;
          this.batchBusy = true;
          try {
            await Promise.all(Object.keys(this.selIds).map((id) =>
              request('/api/mistakes/' + id + '?uid=' + encodeURIComponent(anonUid()), { method: 'DELETE' })
            ));
            uni.showToast({ title: '已删除 ' + this.selCount + ' 题', icon: 'none' });
          } catch (e) {
            uni.showToast({ title: '部分删除失败：' + e.message, icon: 'none' });
          } finally {
            this.selIds = {};
            this.batchBusy = false;
            this.load();
          }
        },
      });
    },
    del(m) {
      uni.showModal({
        title: '确定删除这道错题？',
        success: async (res) => {
          if (!res.confirm) return;
          try {
            await request('/api/mistakes/' + m.id + '?uid=' + encodeURIComponent(anonUid()), { method: 'DELETE' });
          } catch (e) {
            uni.showToast({ title: '删除失败：' + (e.message || '请稍后重试'), icon: 'none' });
            return;
          }
          this.load();
        },
      });
    },
  },
};
</script>

<style scoped>
.wrap { padding: var(--sp-12) var(--page-x) calc(var(--sp-40) + 50px + env(safe-area-inset-bottom)); }
.grow { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-4); }
.offbar { margin-bottom: var(--sp-12); }

/* 首屏数字行 + 主按钮 */
.head { display: grid; gap: var(--sp-16); margin-bottom: var(--card-gap); }
.head-tip { font-size: var(--fs-sub); color: var(--ink-3); text-align: center; }
.resumecard { margin-bottom: var(--card-gap); }
.rs-row { display: flex; align-items: center; gap: var(--sp-8); }
.rs-tr { display: flex; align-items: center; gap: var(--sp-4); }
.rs-t { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.rs-s { font-size: var(--fs-sub); color: var(--ink-3); }

/* 分段 + 筛选/批量 */
.segrow { display: flex; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-12); }
.seg { flex: 1; min-width: 0; display: flex; background: var(--fill); border-radius: var(--r-sm); padding: var(--sp-4); }
.seg-i { flex: 1; min-width: 0; text-align: center; min-height: 40px; display: flex; align-items: center; justify-content: center; border-radius: var(--r-xs); font-size: var(--fs-sub); color: var(--ink-2); white-space: nowrap; padding: 0 var(--sp-4); }
.seg-i.on { background: var(--card); color: var(--ink); font-weight: 600; box-shadow: var(--sh-1); }
.modchips { margin-bottom: var(--sp-12); }

/* 入口卡（重练 / 收藏夹 / AI 分析） */
.entry { margin-bottom: var(--card-gap); }
.entry-in { display: flex; align-items: center; gap: var(--sp-12); }
.entry-ico { width: 40px; height: 40px; border-radius: var(--r-sm); background: var(--brand-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.entry-ico.is-warn { background: var(--warn-soft); }
.entry-t { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.entry-s { font-size: var(--fs-sub); color: var(--ink-3); line-height: var(--lh-sub); }

/* 搜索 */
.searchbar { display: flex; align-items: center; gap: var(--sp-8); background: var(--card); border: 1px solid var(--line); border-radius: var(--r-full); padding: 0 var(--sp-16); min-height: var(--input-h); margin-bottom: var(--sp-12); }
.searchinput { flex: 1; min-width: 0; font-size: var(--fs-sub); color: var(--ink); height: var(--input-h); line-height: var(--input-h); }
.searchclear { display: flex; align-items: center; justify-content: center; width: var(--hit-min); height: var(--hit-min); margin-right: calc(var(--sp-12) * -1); }
.curfilter { display: flex; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-12); flex-wrap: wrap; }
.cf { cursor: pointer; min-height: 40px; }
.kpchips { display: flex; flex-wrap: wrap; gap: var(--sp-8); }
.kpchip { min-height: 40px; padding: 0 var(--sp-12); }

/* 错题卡 */
.mcard { margin-bottom: var(--card-gap); scroll-margin-top: calc(var(--window-top, 0px) + var(--sp-8)); }
.mcard.kbf { outline: 2px solid var(--brand); outline-offset: -2px; }
.mhead { display: flex; align-items: center; gap: var(--sp-8); flex-wrap: wrap; }
.mright { margin-left: auto; }
.mtime { white-space: nowrap; }
.mhead .mright + .mtime { margin-left: 0; }
.pbadge-hit { position: relative; z-index: 1; display: inline-flex; align-items: center; min-height: 40px; margin: -10px 0; max-width: 40vw; }
.pbadge { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bchk { width: 24px; height: 24px; border-radius: var(--r-full); border: 2px solid var(--line-strong); flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.bchk.on { background: var(--brand); border-color: var(--brand); }
.q { font-size: var(--fs-body); line-height: var(--lh-body); color: var(--ink); margin-top: var(--sp-8); }
.q.clamp { max-height: calc(var(--fs-body) * var(--lh-body) * 3); overflow: hidden; }
.meta { font-size: var(--fs-caption); color: var(--ink-3); }
.mopts { margin-top: var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-4); }
.mopt { font-size: var(--fs-sub); line-height: var(--lh-body); color: var(--ink-2); }
.mopt--ok { color: var(--ok-strong); }
.mopt--bad { color: var(--bad-strong); }
.anscmp { margin-top: var(--sp-8); font-size: var(--fs-sub); display: flex; gap: var(--sp-8); align-items: center; flex-wrap: wrap; }
.anscmp .ca { color: var(--ok); font-weight: 600; }
.mstat { margin-top: var(--sp-8); font-size: var(--fs-caption); color: var(--ink-3); }
.attempts { margin-top: var(--sp-8); background: var(--fill); border-radius: var(--r-xs); padding: var(--sp-8) var(--sp-12); }
.att-h { font-size: var(--fs-caption); color: var(--ink-3); margin-bottom: var(--sp-4); }
.att-row { display: flex; align-items: center; gap: var(--sp-8); font-size: var(--fs-sub); padding: var(--sp-4) 0; }
.att-mark { font-weight: 600; }
.att-mark.aok { color: var(--ok); }
.att-mark.abad { color: var(--bad); }
.att-pick { color: var(--ink); }
.att-secs { color: var(--ink-3); }
.att-time { margin-left: auto; color: var(--ink-4); font-size: var(--fs-caption); }
.mfoot { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-8); margin-top: var(--sp-8); border-top: 1px solid var(--line); padding-top: var(--sp-4); }
.hint { font-size: var(--fs-caption); color: var(--ink-4); }
.acts { display: flex; align-items: center; gap: var(--sp-4); flex-wrap: wrap; }
.xp-k { margin-top: var(--sp-8); font-size: var(--fs-caption); font-weight: 600; color: var(--warn-strong); border-left: 3px solid var(--warn); padding-left: var(--sp-8); }
.xp-body { margin-top: var(--sp-4); font-size: var(--fs-sub); color: var(--ink); background: var(--warn-soft); border-radius: var(--r-xs); padding: var(--sp-8); line-height: var(--lh-sub); }
.loadmore { margin: var(--sp-8) 0 var(--sp-24); }

/* 辅栏 */
.side { margin-bottom: var(--card-gap); }
.side-t { display: block; font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.side-s { display: block; margin-top: var(--sp-8); font-size: var(--fs-caption); color: var(--ink-3); line-height: var(--lh-caption); }
.trend-bars { display: flex; gap: var(--sp-8); align-items: flex-end; margin-top: var(--sp-12); }
.trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); }
.trend-barwrap { width: 100%; height: 48px; display: flex; align-items: flex-end; justify-content: center; gap: 2px; }
.trend-bar { width: 12px; background: var(--brand); border-radius: var(--r-xs) var(--r-xs) 0 0; min-height: 0; }
.trend-bar.killed { background: var(--ok); }
.trend-n { font-size: var(--fs-caption); color: var(--ink); }
.trend-kn { font-size: var(--fs-caption); color: var(--ok); }
.trend-lb { font-size: var(--fs-caption); color: var(--ink-4); }
.trend-legend { display: flex; gap: var(--sp-12); margin-top: var(--sp-8); }
.trend-lg { display: flex; align-items: center; gap: var(--sp-4); }
.trend-dot { width: 8px; height: 8px; border-radius: 2px; background: var(--brand); }
.trend-dot.killed { background: var(--ok); }
.trend-lgt { font-size: var(--fs-caption); color: var(--ink-3); }
.recap-sec { margin-top: var(--sp-8); }
.recap-st { font-size: var(--fs-caption); color: var(--ink-3); }
.recap-row { display: flex; align-items: center; gap: var(--sp-8); margin-top: var(--sp-8); min-height: 24px; }
.recap-link { cursor: pointer; min-height: 40px; }
.recap-name { flex: 0 0 80px; font-size: var(--fs-sub); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recap-name.is-link { color: var(--brand-text); }
.recap-n { flex: 0 0 24px; text-align: right; font-size: var(--fs-caption); color: var(--ink-3); }
.mg-blk { border-top: 1px solid var(--line); }
.mg-row { display: flex; align-items: center; gap: var(--sp-8); min-height: 52px; }
.mg-arrow { transition: transform var(--dur-instant) var(--ease-standard); flex-shrink: 0; }
.mg-arrow.is-open { transform: rotate(180deg); }
.mg-name { font-size: var(--fs-body); font-weight: 600; color: var(--ink); flex: 1; min-width: 0; }
.mg-mst { font-size: var(--fs-caption); color: var(--ink-4); white-space: nowrap; }
.mg-sub { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); min-height: var(--hit-min); padding-left: var(--sp-24); border-top: 1px dashed var(--line); }
.mg-sub-name { font-size: var(--fs-sub); color: var(--ink); flex: 1; min-width: 0; }
.mg-sub3 { padding-left: var(--sp-48); }
.mg-sub3 .mg-sub-name { color: var(--ink-3); }
.kbd-row { display: flex; align-items: center; gap: var(--sp-4); margin-top: var(--sp-8); }
.kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 var(--sp-4); box-sizing: border-box; background: var(--card); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: var(--r-xs); font-size: var(--fs-caption); font-weight: 600; color: var(--ink-2); }
.kbd-d { font-size: var(--fs-caption); color: var(--ink-3); margin-left: var(--sp-4); }
/* 趋势与快捷键卡只在桌面辅栏展示 */
.trendcard, .kbdcard { display: none; }

/* sheet 内容 */
.sheet-k { display: block; font-size: var(--fs-sub); color: var(--ink-3); margin: var(--sp-12) 0 var(--sp-8); }
.sheet-acts { display: grid; gap: var(--sp-8); }
.ai-loading { display: flex; flex-direction: column; gap: var(--sp-12); padding: var(--sp-12) 0; }
.ai-err { display: grid; gap: var(--sp-12); padding: var(--sp-12) 0; text-align: center; }
.scan-sum { display: block; font-size: var(--fs-sub); color: var(--ink-3); margin: var(--sp-4) 0 var(--sp-8); }
.manual-empty { display: block; font-size: var(--fs-sub); color: var(--ink-3); line-height: 1.6; padding: var(--sp-8) 0 var(--sp-12); }
.scan-note { display: block; font-size: var(--fs-sub); color: var(--ink-3); line-height: 1.6; margin: 0 0 var(--sp-8); }
.scan-good { color: var(--ok); }
.scan-row { display: flex; align-items: center; min-height: 36px; border-bottom: 1px solid var(--line); font-size: var(--fs-sub); }
.scan-no { width: 36px; color: var(--ink-4); }
.scan-pick { flex: 1; color: var(--ink); }
.scan-pick.good { color: var(--ok); }
.scan-pick.bad { color: var(--bad); }
.scan-ans { width: 72px; color: var(--ink-3); }
.scan-mark { width: 24px; text-align: right; color: var(--ink-4); }
.scan-row.jump { min-height: var(--hit-min); }
.scan-jump { margin-left: var(--sp-8); color: var(--brand); white-space: nowrap; }
.manual-row { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); padding: var(--sp-4) 0; border-bottom: 1px solid var(--line); }
.manual-opt { flex: 1; text-align: center; min-height: 36px; line-height: 36px; border: 1px solid var(--line); border-radius: var(--r-xs); font-size: var(--fs-body); color: var(--ink-2); }
.manual-opt.on { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.manual-codebar { margin: 0; }
.rp-detail { width: 100%; box-sizing: border-box; min-height: 88px; background: var(--fill); border-radius: var(--r-sm); padding: var(--sp-12); font-size: var(--fs-sub); color: var(--ink); margin-top: var(--sp-12); }
.cb { display: flex; flex-direction: column; align-items: center; gap: var(--sp-8); padding: var(--sp-16) 0; text-align: center; }
.cb-s { font-size: var(--fs-sub); color: var(--ink-2); line-height: var(--lh-sub); }
.rf { display: flex; flex-direction: column; gap: var(--sp-4); padding: var(--sp-8) 0; }
.rf-name { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.rf-meta { font-size: var(--fs-sub); color: var(--ink-3); line-height: var(--lh-sub); }
.rf-row2 { display: flex; justify-content: center; gap: var(--sp-16); }

/* 批量操作条 / 浮钮 */
.batchbar { position: fixed; left: var(--page-x); right: var(--page-x); bottom: calc(50px + var(--sp-12) + env(safe-area-inset-bottom)); z-index: var(--z-bar); background: var(--card); border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--sh-2); padding: var(--sp-8) var(--sp-12); display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-8); }
.bb-n { font-size: var(--fs-sub); color: var(--ink-3); flex: 1; }
/* 动作组容不下时整体折到第二行右对齐，不让单个按钮被挤窄 */
.bb-acts { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--sp-8); margin-left: auto; }
.fabmenu { position: fixed; right: var(--sp-16); bottom: calc(50px + env(safe-area-inset-bottom) + var(--sp-16)); z-index: var(--z-bar); display: flex; flex-direction: column; align-items: flex-end; gap: var(--sp-8); }
/* #ifndef H5 */
.fabmenu { bottom: calc(env(safe-area-inset-bottom) + var(--sp-16)); }
/* #endif */
.fab-main { width: 52px; height: 52px; border-radius: var(--r-full); background: var(--brand); display: flex; align-items: center; justify-content: center; box-shadow: var(--sh-2); transition: transform var(--dur-base) var(--ease-standard); }
.fab-main.open { transform: rotate(45deg); }
/* 列表见底时给悬浮「＋」（52px + 底距）让位，末卡「···」不被盖 */
.fabspace { height: calc(52px + var(--sp-32)); }
.more-reasons { margin: var(--sp-4) 0 var(--sp-12); flex-wrap: wrap; }
.more-act { min-height: 48px; display: flex; align-items: center; justify-content: center; font-size: var(--fs-body); color: var(--ink); border-top: 1px solid var(--line); }
.more-act.danger { color: var(--bad); }
.more-act.cancel { color: var(--ink-3); margin-top: var(--sp-12); border-top: none; background: var(--fill); border-radius: var(--r-full); }
.ai-regen { margin-top: var(--sp-12); }

/* 复习模式 */
.review { display: flex; flex-direction: column; gap: var(--sp-8); }
.rhead { display: flex; justify-content: space-between; align-items: center; }
.opts { display: flex; gap: var(--sp-8); margin: var(--sp-12) 0; }
.opt { flex: 1; text-align: center; min-height: var(--hit-min); display: flex; align-items: center; justify-content: center; border: 1px solid var(--line-strong); border-radius: var(--r-sm); font-size: var(--fs-body); color: var(--ink); background: var(--card); }
.opt.ok { background: var(--ok-soft); border-color: var(--ok); color: var(--ok-strong); }
.opt.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
.opt.dim { opacity: 0.4; }
.opt.sel { background: var(--brand-soft); border-color: var(--brand); color: var(--brand-text); }
.opts.full { flex-direction: column; }
.opt.full { flex: none; box-sizing: border-box; justify-content: flex-start; text-align: left; gap: var(--sp-8); padding: var(--sp-8) var(--sp-12); }
.opt.full .opt-k { flex: none; font-weight: var(--fw-semibold); }
.opt.full .opt-t { flex: 1; min-width: 0; line-height: var(--lh-body); word-break: break-word; }
.verdict { font-size: var(--fs-body); font-weight: 600; margin: var(--sp-8) 0; line-height: var(--lh-body); }
.verdict.good { color: var(--ok-strong); }
.verdict.badv { color: var(--bad); }
/* 作答后「下一题/确认答案」吸底：讲解长时不必滚到底才能继续；到自然位置后随内容停住。tab 页需让出 H5 TabBar（50px） */
.next-btn { margin-top: var(--sp-12); position: sticky; bottom: calc(50px + env(safe-area-inset-bottom) + var(--sp-8)); z-index: var(--z-sticky); box-shadow: var(--sh-2); }
/* #ifndef H5 */
.next-btn { bottom: calc(env(safe-area-inset-bottom) + var(--sp-8)); }
/* #endif */
.reasons { display: flex; align-items: center; gap: var(--sp-8); margin: var(--sp-4) 0 var(--sp-12); }
.rz-t { font-size: var(--fs-sub); color: var(--ink-3); flex-shrink: 0; }
.appended-tip { font-size: var(--fs-sub); color: var(--brand-text); background: var(--brand-soft); border-radius: var(--r-xs); padding: var(--sp-8) var(--sp-12); margin-bottom: var(--sp-8); }
.sim-rows { display: grid; margin-top: var(--sp-8); }
.selfjudge { margin-top: var(--sp-12); display: grid; gap: var(--sp-8); }
.q2 { font-size: var(--fs-sub); color: var(--ink-3); }
.sj-row { display: flex; gap: var(--sp-12); }
.sj-row > * { flex: 1; }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .wrap.book { max-width: 1064px; padding-top: var(--sp-24); }
  .trendcard, .kbdcard { display: block; }
  .wrap.is-review { max-width: 760px; margin: 0 auto; }
}
/* #endif */
</style>
