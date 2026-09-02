<template>
  <view class="wrap" :class="[reviewing ? 'bookwrap-review' : 'bookwrap', { noside: !items.length }]">
    <view v-if="offlineView" class="offbar"><l-icon name="plane" :size="15" color="#b45309" /><text>当前离线 · 展示已缓存错题，联网后自动更新</text></view>
    <!-- 复习模式 -->
    <view v-if="reviewing" class="card review">
      <view class="rhead">
        <text class="tag">{{ cur._extra ? '加练同类' : '复习' }} {{ rIdx + 1 }}/{{ rItems.length }}</text>
        <text class="op" @click="exitReview">退出复习</text>
      </view>
      <view class="q" :style="qStyle">{{ cur.question_text }}</view>
      <view v-if="curLetter" class="opts">
        <view
          v-for="o in ['A', 'B', 'C', 'D']"
          :key="o"
          class="opt"
          :class="optClass(o)"
          @click="pick(o)"
        >{{ o }}</view>
      </view>
      <view v-if="answered">
        <view class="verdict" :class="wasCorrect ? 'good' : 'badv'">
          <template v-if="cur._extra">{{ wasCorrect ? '答对了，这个考法稳了 ✓' : '还没稳，仔细看讲解' }}</template>
          <template v-else>{{ wasCorrect ? (cur._requeued ? '这次答对了，本轮已纠正 ✓' : '答对了！连对 ' + streak + ' 次') : '又错了，看讲解（稍后本轮会再出现）' }}（下次复习：{{ nextDays }} 天后）</template>
        </view>
        <view v-if="wasCorrect === false && cur._appended" class="appended-tip">已为你在本轮末尾加练 {{ cur._appended }} 道同类题</view>
        <view v-if="!wasCorrect && !cur._extra" class="reasons">
          <text class="rz-t">错因自评：</text>
          <text
            v-for="rz in REASONS"
            :key="rz"
            class="rz"
            :class="{ on: cur.error_reason === rz }"
            @click="setReviewReason(rz)"
          >{{ rz }}</text>
        </view>
        <view :style="optStyle"><rich-text :nodes="curHtml" /></view>
        <view v-if="!wasCorrect && cur.module && !cur._extra" class="sim-row" @click="similarFromReview">
          <text class="sim-t">还不稳？练 3 道同类题巩固 ›</text>
        </view>
        <wd-button type="primary" block custom-class="next-btn" @click="nextReview">{{ rIdx + 1 < rItems.length ? '下一题' : '完成复习' }}</wd-button>
      </view>
      <view v-else-if="curMulti" class="selfjudge">
        <view class="q2">多选题：选完所有选项后确认</view>
        <wd-button type="primary" block :disabled="!picked" custom-class="next-btn" @click="confirmMulti">确认答案{{ picked ? '（已选 ' + picked + '）' : '' }}</wd-button>
      </view>
      <view v-else-if="!curLetter" class="selfjudge">
        <view class="q2">先自己做，然后：</view>
        <view class="sj-row">
          <wd-button type="success" plain custom-class="sj-btn" @click="selfJudge(true)">我做对了</wd-button>
          <wd-button type="error" plain custom-class="sj-btn" @click="selfJudge(false)">我做错了</wd-button>
        </view>
      </view>
    </view>

    <!-- 复习清零庆祝态 -->
    <view v-if="celebrate" class="mask" @click="closeCelebrate">
      <view class="cb-card" @click.stop>
        <view class="cb-emoji">🎉</view>
        <view class="cb-t">今日复习已清零！</view>
        <view class="cb-s">{{ celebrateN }} 道到期错题全部复习完成，遗忘曲线稳住了</view>
        <button class="cb-btn" @click="closeCelebrate">太棒了，继续 ›</button>
      </view>
    </view>

    <!-- 复习完成后：同考点强化卡（spec-03） -->
    <view v-if="!reviewing && reinforce" class="mask" @click="reinforce = null">
      <view class="rf-card" @click.stop>
        <view class="rf-t">本轮复习完成！趁热打铁强化一下？</view>
        <view class="rf-name">{{ reinforce.tag3_name || reinforce.submodule }}</view>
        <view class="rf-meta">{{ reinforce.module_name }}<template v-if="reinforce.tag3_name"> · {{ reinforce.submodule }}</template> · 掌握度 {{ Math.round(reinforce.mastery * 100) }}%（{{ reinforce.level_name }}） · 今日错 {{ reinforce.wrong_today }} 道</view>
        <button class="rf-btn" @click="startReinforce(reinforce)">强化 5 道新题（未做过）</button>
        <view class="rf-row2">
          <text v-if="reinforceItems.length > 1" class="rf-alt" @click="swapReinforce">换个考点</text>
          <text class="rf-alt" @click="reinforce = null">下次再说</text>
        </view>
      </view>
    </view>

    <!-- 列表模式 -->
    <template v-if="!reviewing">
      <view v-if="items.length" class="ovrow bk-side">
        <view class="ov-c"><text class="ov-n">{{ items.length }}</text><text class="ov-t">全部错题</text></view>
        <view class="ov-c"><text class="ov-n warn">{{ todoItems.length }}</text><text class="ov-t">待掌握</text></view>
        <view class="ov-c"><text class="ov-n ok">{{ doneItems.length }}</text><text class="ov-t">已掌握</text></view>
      </view>
      <view v-if="due.length" class="card duecard bk-main" @click="startReviewFromCard">
        <view>
          <view class="duetxt"><l-icon name="calendar-check" :size="16" color="#ffffff" /><text class="duetxt-t">今日待复习 {{ dueTotal }} 道</text></view>
          <text class="duesub">按遗忘曲线安排 · 预计 {{ Math.max(1, Math.ceil(due.length * 0.8)) }} 分钟</text>
        </view>
        <text class="duego">开始复习</text>
      </view>
      <view v-if="weekTrend" class="card trendcard bk-side">
        <text class="trend-t">错题趋势（近 4 周）</text>
        <view class="trend-bars">
          <view v-for="w in weekTrend.weeks" :key="w.label" class="trend-col">
            <view class="trend-barwrap">
              <view class="trend-bar" :style="{ height: w.pct + '%' }" />
              <view class="trend-bar killed" :style="{ height: w.kpct + '%' }" />
            </view>
            <text class="trend-n">{{ w.n }}<text v-if="w.k" class="trend-kn">/{{ w.k }}</text></text>
            <text class="trend-lb">{{ w.label }}</text>
          </view>
        </view>
        <view class="trend-legend">
          <view class="trend-lg"><view class="trend-dot" /><text class="trend-lgt">新增</text></view>
          <view class="trend-lg"><view class="trend-dot killed" /><text class="trend-lgt">消灭（达成掌握）</text></view>
        </view>
        <text class="trend-sum">近 7 天新增 {{ weekTrend.last7 }} 道 · 消灭 {{ weekTrend.klast7 }} 道 · 累计已掌握 {{ doneItems.length }} 道</text>
      </view>
      <view v-if="monthRecap.total" class="card recap bk-side">
        <view class="recap-h" @click="recapOpen = !recapOpen">
          <text class="recap-t">本月错题复盘 · 新增 {{ monthRecap.total }} 道</text>
          <text class="recap-x">{{ recapOpen ? '收起' : '展开' }}</text>
        </view>
        <view v-if="recapOpen">
          <view class="recap-sec">
            <text class="recap-st">按模块</text>
            <view v-for="g in monthRecap.byModule" :key="g.name" class="recap-row">
              <text class="recap-name">{{ g.name }}</text>
              <view class="recap-bar"><view class="recap-fill" :style="{ width: Math.round((g.n / monthRecap.total) * 100) + '%' }" /></view>
              <text class="recap-n">{{ g.n }}</text>
            </view>
          </view>
          <view class="recap-sec">
            <text class="recap-st">按错因</text>
            <view v-for="g in monthRecap.byReason" :key="g.name" class="recap-row">
              <text class="recap-name">{{ g.name }}</text>
              <view class="recap-bar"><view class="recap-fill warnfill" :style="{ width: Math.round((g.n / monthRecap.total) * 100) + '%' }" /></view>
              <text class="recap-n">{{ g.n }}</text>
            </view>
          </view>
          <text class="recap-tip">高频错因是提分洼地：优先复习对应模块的待掌握错题</text>
        </view>
      </view>
      <view v-if="items.length" class="segrow bk-main">
        <view class="seg">
          <view class="seg-i" :class="{ on: tab === 'todo' }" @click="tab = 'todo'">待掌握 {{ todoItems.length }}</view>
          <view class="seg-i" :class="{ on: tab === 'done' }" @click="tab = 'done'">已掌握 {{ doneItems.length }}</view>
          <view class="seg-i" :class="{ on: tab === 'fav' }" @click="tab = 'fav'">收藏{{ favs.length ? ' ' + favs.length : '' }}</view>
        </view>
        <view v-if="tab !== 'fav'" class="filterbtn" @click="filterOpen = true">
          <l-icon name="sliders-horizontal" :size="16" color="#646a73" /><text class="filterbtn-t">筛选</text>
        </view>
        <view v-if="tab !== 'fav' && shownItems.length" class="filterbtn" :class="{ bon: batchMode }" @click="toggleBatch">
          <text class="filterbtn-t" :class="{ bont: batchMode }">{{ batchMode ? '完成' : '批量' }}</text>
        </view>
      </view>
      <template v-if="tab === 'fav'">
        <view class="card redoentry bk-main" @click="openFavPage">
          <view class="redo-l">
            <view class="redo-ico"><l-icon name="star" :size="16" color="#f59e0b" /></view>
            <view>
              <text class="redo-t">收藏夹与笔记</text>
              <text class="redo-s">多夹分组 · 每题笔记 · 可按夹重练</text>
            </view>
          </view>
          <text class="redo-go">打开</text>
        </view>
        <view v-if="!favs.length" class="card empty bk-main">
          <view class="e-t">还没有本机收藏</view>
          <view class="e-s">刷题时点顶栏星星即可收藏好题</view>
        </view>
        <view v-if="favs.length > 3" class="searchbar bk-main">
          <l-icon name="search" :size="16" color="#8a90a0" />
          <input v-model="favKw" class="searchinput" placeholder="搜收藏题干或题型" confirm-type="search" />
          <view v-if="favKw" class="searchclear" role="button" aria-label="清空搜索" @click="favKw = ''"><l-icon name="x" :size="16" color="#8a90a0" /></view>
        </view>
        <view v-for="f in favShown" :key="f.t" class="card mcard bk-main" @click="f._open = !f._open">
          <view class="mhead">
            <text class="tag">{{ f.submodule || modName(f.module) }}</text>
            <text v-if="f.is_real" class="rvbadge">真题{{ f.exam_year ? ' · ' + f.exam_year : '' }}{{ f.exam_region ? ' · ' + f.exam_region : '' }}</text>
          </view>
          <view class="q" :class="{ clamp: !f._open }">{{ (f.question || '').slice(0, 200) }}</view>
          <template v-if="f._open">
            <view v-for="(v, k) in f.options" :key="k" class="anscmp"><text :class="k === f.answer ? 'ca' : ''">{{ k }}. {{ v }}</text></view>
            <rich-text :nodes="md(f.hs_explanation || f.explanation || '暂无解析')" />
            <template v-if="f.xp_explanation">
              <view class="xp-k">{{ f.xp_school || '第二名师视角' }}</view>
              <view class="xp-body">{{ f.xp_explanation }}</view>
            </template>
          </template>
          <view class="mfoot">
            <text class="meta">{{ fmt(f.t / 1000) }}</text>
            <view class="acts">
              <text class="op del" @click.stop="unfavItem(f)">取消收藏</text>
            </view>
          </view>
        </view>
      </template>
      <view v-if="tab !== 'fav' && todoItems.length >= 3" class="card redoentry bk-side" @click="aiAnalysis">
        <view class="redo-l">
          <view class="redo-ico"><l-icon name="bot-message-square" :size="16" color="#2e5bff" /></view>
          <view>
            <text class="redo-t">AI 错题分析</text>
            <text class="redo-s">基于你的错题分布与近期作答生成诊断与复习建议</text>
          </view>
        </view>
        <text class="redo-go">生成</text>
      </view>
      <view v-if="aiOpen" class="mask" @click="aiOpen = false">
        <view class="sheet" @click.stop>
          <view class="sheet-h">
            <text class="sheet-t">AI 错题分析</text>
            <view class="sheet-x" role="button" aria-label="关闭" @click="aiOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
          </view>
          <view v-if="aiLoading" class="ai-loading">正在分析你的错题与作答数据，约需 30-60 秒…</view>
          <rich-text v-else :nodes="aiHtml" />
        </view>
      </view>
      <!-- 扫描答题卡/手动录入已收进右下角 + 浮动菜单，错题列表作为页面主体 -->
      <view v-if="manualOpen" class="mask" @click="manualOpen = false">
        <view class="sheet" @click.stop>
          <view class="sheet-h">
            <text class="sheet-t">手动录入答案</text>
            <view class="sheet-x" role="button" aria-label="关闭" @click="manualOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
          </view>
          <template v-if="!manualPaper">
            <view v-if="recentPapers.length" class="sheet-k">最近导出的试卷</view>
            <view v-if="recentPapers.length" class="kpchips">
              <text v-for="p in recentPapers" :key="p.code" class="kpchip" @click="manualLookup(p.code)">{{ p.title }} · {{ p.code }}</text>
            </view>
            <view class="sheet-k">或输入卷面上的卷码</view>
            <view class="searchbar manual-codebar">
              <input v-model="manualCode" class="searchinput" placeholder="如 A1B2C3D4（封面/答题卡顶部）" confirm-type="done" @confirm="manualLookup(manualCode)" />
            </view>
            <view class="sheet-done" @click="manualLookup(manualCode)">{{ manualLoading ? '查找中…' : '查找试卷' }}</view>
          </template>
          <template v-else>
            <view class="scan-sum">{{ manualPaper.title || '试卷' }} · 卷码 {{ manualPaper.code }} · 共 {{ manualPaper.n }} 题 · 已选 {{ manualPickedCount }}</view>
            <scroll-view scroll-y class="scan-list manual-list">
              <view v-for="no in manualPaper.n" :key="no" class="manual-row">
                <text class="scan-no">{{ no }}</text>
                <text v-for="L in ['A','B','C','D']" :key="L" class="manual-opt" :class="{ on: manualPicks[no] === L }" @click="manualPick(no, L)">{{ L }}</text>
              </view>
            </scroll-view>
            <view class="sheet-done" :class="{ dim: !manualPickedCount }" :aria-disabled="String(!manualPickedCount)" @click="manualSubmit">{{ manualSubmitting ? '判分中…' : '交卷判分（' + manualPickedCount + ' 题）' }}</view>
            <view class="manual-back" @click="manualPaper = null">‹ 换一份试卷</view>
          </template>
        </view>
      </view>
      <view v-if="scanOpen && scanResult" class="mask" @click="scanOpen = false">
        <view class="sheet" @click.stop>
          <view class="sheet-h">
            <text class="sheet-t">对答案结果 · {{ scanResult.title || '试卷' }}</text>
            <view class="sheet-x" role="button" aria-label="关闭" @click="scanOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
          </view>
          <view class="scan-sum">卷码 {{ scanResult.code }}{{ scanResult.page ? ' · 第 ' + scanResult.page + ' 页' : '' }} · 已作答 {{ scanResult.answered }}/{{ scanResult.total }} · 答对 <text class="scan-good">{{ scanResult.correct }}</text> 题{{ scanResult.saved ? ' · 已记入做题记录' : '' }}</view>
          <scroll-view scroll-y class="scan-list">
            <view v-for="r in scanResult.items" :key="r.no" class="scan-row">
              <text class="scan-no">{{ r.no }}</text>
              <text class="scan-pick" :class="{ good: r.correct, bad: r.status === 'ok' && !r.correct }">{{ r.status === 'blank' ? '未涂' : r.status === 'multi' ? '多涂 ' + r.picked : r.picked }}</text>
              <text class="scan-ans">答案 {{ r.answer || '—' }}</text>
              <text class="scan-mark">{{ r.correct ? '✓' : r.status === 'ok' ? '✗' : '—' }}</text>
            </view>
          </scroll-view>
          <view class="sheet-done" @click="scanOpen = false; load()">完成</view>
        </view>
      </view>
      <view v-if="tab !== 'fav' && todoItems.length" class="card redoentry bk-side" @click="redoAll">
        <view class="redo-l">
          <view class="redo-ico"><l-icon name="rotate-ccw" :size="16" color="#2e5bff" /></view>
          <view>
            <text class="redo-t">错题重练{{ kpFilter ? ' · ' + kpFilter : '' }}</text>
            <text class="redo-s">{{ kpFilter ? '只重练当前筛选题型的待掌握错题（最多 10 题）' : '把待掌握错题按刷题模式重做一遍（最多 10 题）' }}</text>
          </view>
        </view>
        <text class="redo-go">开始</text>
      </view>
      <view v-if="tab !== 'fav' && items.length > 5" class="searchbar bk-main">
        <l-icon name="search" :size="16" color="#8a90a0" />
        <input v-model="kw" class="searchinput" placeholder="搜题干关键词或题型，如：增长率 / 类比推理" confirm-type="search" />
        <view v-if="kw" class="searchclear" role="button" aria-label="清空搜索" @click="kw = ''"><l-icon name="x" :size="16" color="#8a90a0" /></view>
      </view>
      <view v-if="tab !== 'fav' && modGroups.length" class="card modgroup bk-side">
        <view class="mg-h">按模块查看</view>
        <view v-for="g in modGroups" :key="g.key" class="mg-blk">
          <view class="mg-row" @click="toggleGroup(g.key)">
            <text class="mg-arrow">{{ mgOpen[g.key] ? '▾' : '▸' }}</text>
            <text class="mg-name">{{ g.name }}</text>
            <text v-if="masteryMods[g.key]" class="mg-mst">掌握 {{ masteryMods[g.key].pct }}% · {{ masteryMods[g.key].level }}</text>
            <text class="mg-badge">{{ g.n }}</text>
            <text class="mg-go" @click.stop="pickGroup(g.key, '')">查看 ›</text>
          </view>
          <view v-if="mgOpen[g.key]">
            <template v-for="s in g.subs" :key="s.name">
              <view class="mg-sub" @click="pickGroup(g.key, s.name)">
                <text class="mg-sub-name">{{ s.name }}</text>
                <text class="mg-badge">{{ s.n }}</text>
              </view>
              <view
                v-for="t in s.t3"
                :key="s.name + '/' + t.name"
                class="mg-sub mg-sub3"
                @click="pickGroup(g.key, s.name, t.name)"
              >
                <text class="mg-sub-name">{{ t.name }}</text>
                <text v-if="masteryT3[t.name] != null" class="mg-mst">{{ masteryT3[t.name] }}%</text>
                <text class="mg-badge">{{ t.n }}</text>
              </view>
            </template>
          </view>
        </view>
      </view>
      <!-- #ifdef H5 -->
      <view class="card kbdcard bk-side">
        <view class="kbd-h">键盘快捷键</view>
        <view class="kbd-row"><text class="kbd">J</text><text class="kbd">K</text><text class="kbd-d">上下切题</text></view>
        <view class="kbd-row"><text class="kbd">Enter</text><text class="kbd-d">展开/收起详解</text></view>
        <view class="kbd-row"><text class="kbd">A</text><text class="kbd">–</text><text class="kbd">D</text><text class="kbd-d">复习模式作答</text></view>
        <text class="kbd-more" @click="kbdHelp = true">按 ? 查看全部 ›</text>
      </view>
      <view v-if="kbdHelp" class="mask" @click="kbdHelp = false">
        <view class="sheet" @click.stop>
          <view class="sheet-h">
            <text class="sheet-t">键盘快捷键</text>
            <view class="sheet-x" role="button" aria-label="关闭" @click="kbdHelp = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
          </view>
          <view class="sheet-k">错题列表</view>
          <view class="kbd-row"><text class="kbd">J</text><text class="kbd">↓</text><text class="kbd-d">下一张错题</text></view>
          <view class="kbd-row"><text class="kbd">K</text><text class="kbd">↑</text><text class="kbd-d">上一张错题</text></view>
          <view class="kbd-row"><text class="kbd">Enter</text><text class="kbd">空格</text><text class="kbd-d">展开/收起当前错题详解</text></view>
          <view class="sheet-k">复习模式</view>
          <view class="kbd-row"><text class="kbd">A</text><text class="kbd">B</text><text class="kbd">C</text><text class="kbd">D</text><text class="kbd-d">直接作答（单选）</text></view>
          <view class="kbd-row"><text class="kbd">Enter</text><text class="kbd-d">多选确认 / 已作答进入下一题</text></view>
          <view class="sheet-k">通用</view>
          <view class="kbd-row"><text class="kbd">?</text><text class="kbd-d">打开本面板</text></view>
          <view class="kbd-row"><text class="kbd">Esc</text><text class="kbd-d">关闭本面板</text></view>
        </view>
      </view>
      <!-- #endif -->
      <view v-if="tab !== 'fav' && (filterMod || kpFilter || kp3Filter || srcFilter)" class="curfilter bk-main">
        <text v-if="filterMod || kpFilter || kp3Filter" class="kpchip on" @click="filterMod = ''; kpFilter = ''; kp3Filter = ''">{{ kp3Filter || kpFilter || modName(filterMod) }} ✕</text>
        <text v-if="srcFilter" class="kpchip on" @click="srcFilter = ''">{{ srcFilter === 'exam' ? '模考错题' : '练习错题' }} ✕</text>
        <text v-if="sortBy !== 'time'" class="kpchip" @click="filterOpen = true">{{ (SORTS.find(s => s.k === sortBy) || {}).name }}</text>
      </view>
      <view v-else-if="tab !== 'fav' && sortBy !== 'time'" class="curfilter bk-main">
        <text class="kpchip on" @click="sortBy = 'time'">{{ (SORTS.find(s => s.k === sortBy) || {}).name }} ✕</text>
      </view>
      <view v-if="filterOpen" class="mask" @click="filterOpen = false">
        <view class="sheet" @click.stop>
          <view class="sheet-h">
            <text class="sheet-t">筛选与排序</text>
            <view class="sheet-x" role="button" aria-label="关闭" @click="filterOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
          </view>
          <view class="sheet-k">排序</view>
          <view class="kpchips">
            <text v-for="s in SORTS" :key="s.k" class="kpchip" :class="{ on: sortBy === s.k }" @click="sortBy = s.k">{{ s.name }}</text>
          </view>
          <view class="sheet-k">模块</view>
          <view class="kpchips">
            <text v-for="c in chipList" :key="c.key" class="kpchip" :class="{ on: filterMod === c.key }" @click="filterMod = c.key; kpFilter = ''; kp3Filter = ''">{{ c.name }}</text>
          </view>
          <view v-if="typeGroups.length > 1" class="sheet-k">题型</view>
          <view v-if="typeGroups.length > 1" class="kpchips">
            <text v-for="g in typeGroups" :key="g.name" class="kpchip" :class="{ on: kpFilter === g.name }" @click="kpFilter = kpFilter === g.name ? '' : g.name; kp3Filter = ''">{{ g.name }} ×{{ g.n }}</text>
          </view>
          <view v-if="hasExamMistakes" class="sheet-k">来源</view>
          <view v-if="hasExamMistakes" class="kpchips">
            <text class="kpchip" :class="{ on: srcFilter === '' }" @click="srcFilter = ''">全部</text>
            <text class="kpchip" :class="{ on: srcFilter === 'exam' }" @click="srcFilter = 'exam'">模考</text>
            <text class="kpchip" :class="{ on: srcFilter === 'practice' }" @click="srcFilter = 'practice'">练习</text>
          </view>
          <view class="sheet-done" @click="filterOpen = false">完成</view>
          <view class="sheet-export" @click="exportConfirm = true">{{ exporting ? '正在生成 PDF…' : '导出当前筛选为错题卷 PDF' }}</view>
        </view>
      </view>

      <export-confirm
        :visible="exportConfirm"
        scope="错题本 · 当前筛选"
        :count="Math.min(shownItems.length, 100)"
        :busy="exporting"
        above-tabbar
        @close="exportConfirm = false"
        @confirm="exportMistakes"
      />
      <view v-if="tab !== 'fav' && loading" class="card spin bk-main">加载中…</view>
      <view v-else-if="tab !== 'fav' && loadErr && !items.length" class="card empty bk-main">
        <view class="e-t">加载失败</view>
        <view class="e-s">{{ loadErr }}</view>
        <view class="retry" @click="load">重试 ›</view>
      </view>
      <view v-else-if="tab !== 'fav' && !items.length" class="card empty bk-main">
        <view class="e-ico"><l-icon name="folder-plus" :size="52" color="#c7cad4" :stroke-width="1.5" /></view>
        <view class="e-t">错题本还是空的</view>
        <view class="e-s">去拍题讲解或刷题，答错的题会汇集到这里，之后按遗忘曲线安排复习</view>
        <wd-button type="primary" custom-class="e-btn2" @click="goPractice">去刷题</wd-button>
      </view>
      <view v-if="tab !== 'fav' && items.length && !shownItems.length && !loading" class="card empty bk-main">
        <view class="e-t">没有匹配的错题</view>
        <view class="e-s">换个关键词或清除筛选试试</view>
      </view>
      <view v-for="m in shownPage" :key="m.id" :id="'mc-' + m.id" class="card mcard bk-main" :class="[masteryClass(m), { bsel: batchMode && selIds[m.id], kbf: kbId === m.id }]" @click="batchMode ? toggleSel(m) : toggleCard(m)">
        <view class="mhead">
          <view v-if="batchMode" class="bchk" :class="{ on: selIds[m.id] }">{{ selIds[m.id] ? '✓' : '' }}</view>
          <text class="tag">{{ tagName(m) }}</text>
          <text v-if="m.source === 'exam'" class="srcbadge">模考</text>
          <text v-if="m.times >= 2" class="timesbadge">错 {{ m.times }} 次</text>
          <text v-if="m.mastered" class="zhan">已掌握</text>
          <view v-else-if="nextReviewText(m)" class="duehint" :class="{ due: isDue(m) }">
            <view class="duedot" /><text>{{ nextReviewText(m) }}</text>
          </view>
          <text class="meta mtime">{{ fmt(m.created_at) }}</text>
        </view>
        <view class="q" :class="{ clamp: !m.open }">{{ (m.question_text || '').slice(0, 200) }}</view>
        <view v-if="m.open && ansLetter(m.user_answer)" class="anscmp">
          <text class="rpill wrong">我选 {{ ansLetter(m.user_answer) }}</text>
          <text v-if="ansLetter(m.correct_answer)" class="rpill right">答案 {{ ansLetter(m.correct_answer) }}</text>
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
          <text class="op hint">点开看答案与详解</text>
          <text class="op more" @click.stop="itemSheet(m)">···</text>
        </view>
        <view v-else class="mfoot">
          <view class="acts">
            <text v-if="!m.mastered" class="op redo" @click.stop="redo(m)">AI 详解</text>
            <text v-else class="op redo" @click.stop="master(m, false)">恢复复习</text>
            <text v-if="m.question_id" class="op reportop" @click.stop="openReport(m)">{{ m._reported ? '已纠错' : '纠错' }}</text>
          </view>
          <text class="op more" @click.stop="itemSheet(m)">···</text>
        </view>
        <rich-text v-if="m.open" :nodes="m.html" />
      </view>
      <view v-if="tab !== 'fav' && pageN < shownItems.length" class="loadmore bk-main" @click="pageN += 20">上滑或点击加载更多（{{ shownPage.length }}/{{ shownItems.length }}）</view>
      <!-- 批量操作条 -->
      <view v-if="batchMode && tab !== 'fav'" class="batchbar">
        <text class="bb-sel" @click="selAll">{{ selCount === shownPage.length ? '取消全选' : '全选本页' }}</text>
        <text class="bb-n">已选 {{ selCount }}</text>
        <view class="bb-acts">
          <text v-if="tab === 'todo'" class="bb-btn ok" :class="{ dis: !selCount || batchBusy }" @click="batchMaster(true)">标已掌握</text>
          <text v-else class="bb-btn ok" :class="{ dis: !selCount || batchBusy }" @click="batchMaster(false)">恢复复习</text>
          <text class="bb-btn danger" :class="{ dis: !selCount || batchBusy }" @click="batchDel">删除</text>
        </view>
      </view>
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
          <view class="sheet-done rp-submit" :class="{ off: !reportType || reportBusy }" @click="submitReport">{{ reportBusy ? '提交中…' : '提交纠错' }}</view>
        </view>
      </view>
      <view v-if="tab !== 'fav' && !batchMode" class="fabmenu">
        <template v-if="fabOpen">
          <view class="fab-item" @click="fabOpen = false; scanSheetPick()">
            <l-icon name="scan-line" :size="16" color="#2e5bff" /><text>{{ scanning ? '识别中…' : '扫描答题卡' }}</text>
          </view>
          <view class="fab-item" @click="fabOpen = false; manualOpenSheet()">
            <l-icon name="pencil-line" :size="16" color="#2e5bff" /><text>手动录入答案</text>
          </view>
        </template>
        <view class="fab-main" :class="{ open: fabOpen }" @click="fabOpen = !fabOpen">＋</view>
      </view>
    </template>
  </view>
</template>

<script>
import { md } from '../../md.js';
import { request, anonUid, exportPdf, scanSheet, shareCreate, trackEvent, qShareText, shareVariant } from '../../api.js';
import { buildBookUrl, parseBookOpts } from '../../book-url.js';
import { cacheMistakes, getCachedMistakes } from '../../offline.js';
import { qStatLine } from '../../q-stat.js';
import { fontSizes } from '../../font-size.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };

function extractLetter(s) {
  const m = /[A-D]+/.exec(String(s || '').toUpperCase());
  return m ? [...new Set(m[0])].sort().join('') : null;
}

export default {
  data() {
    return {
      items: [],
      loading: true,
      loadErr: '',
      offlineView: false,
      due: [],
      dueTotal: 0,
      autoReview: false,
      reviewing: false,
      fontLv: uni.getStorageSync('fontLv') || 1,
      celebrate: false,
      celebrateN: 0,
      reinforce: null,
      reinforceItems: [],
      rItems: [],
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
      scanning: false,
      scanOpen: false,
      scanResult: null,
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
      sortBy: 'time',
      pageN: 20,
      batchMode: false,
      kbId: null,
      kbdHelp: false,
      selIds: {},
      batchBusy: false,
      recapOpen: typeof window !== 'undefined' && window.innerWidth >= 1024,
      REASONS: ['粗心大意', '概念不清', '方法不会', '纯蒙的'],
      SORTS: [
        { k: 'time', name: '最新' },
        { k: 'due', name: '待复习优先' },
        { k: 'times', name: '错次多' },
        { k: 'type', name: '按题型' },
        { k: 'reason', name: '按错因' },
      ],
    };
  },
  computed: {
    qStyle() { return { fontSize: fontSizes(this.fontLv).q }; },
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
      base = [...base];
      if (this.sortBy === 'times') base.sort((a, b) => (b.times || 1) - (a.times || 1));
      else if (this.sortBy === 'type') base.sort((a, b) => String(a.question_type || a.module || '').localeCompare(String(b.question_type || b.module || ''), 'zh'));
      else if (this.sortBy === 'reason') base.sort((a, b) => String(a.error_reason || '\uffff').localeCompare(String(b.error_reason || '\uffff'), 'zh'));
      else if (this.sortBy === 'due') base.sort((a, b) => (a.next_review || 9e12) - (b.next_review || 9e12));
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
    kw() { this.pageN = 20; },
    kpFilter() { this.pageN = 20; },
    kp3Filter() { this.pageN = 20; },
    sortBy() { this.pageN = 20; this.syncBookUrl(); },
    srcFilter() { this.syncBookUrl(); },
  },
  onLoad(opts) {
    const p = parseBookOpts(opts);
    if (p.tab) this.tab = p.tab;
    if (p.mod) this.filterMod = p.mod;
    if (p.src) this.srcFilter = p.src;
    if (p.sort) this.sortBy = p.sort;
    if (p.review) uni.setStorageSync('autoStartReview', 1);
  },
  onReachBottom() {
    if (this.tab !== 'fav' && this.pageN < this.shownItems.length) this.pageN += 20;
  },
  onShow() {
    this.fontLv = uni.getStorageSync('fontLv') || 1;
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
    // #ifdef H5
    if (this._kbHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._kbHandler);
      this._kbHandler = null;
    }
    // #endif
  },
  methods: {
    syncBookUrl() {
      // #ifdef H5
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', buildBookUrl({ tab: this.tab, mod: this.filterMod, src: this.srcFilter, sort: this.sortBy }));
      }
      // #endif
    },
    // #ifdef H5
    onKeydown(e) {
      if (typeof window === 'undefined' || window.innerWidth < 1024) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      const k = e.key;
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
            this.scanResult = d;
            this.scanOpen = true;
          } catch (e) {
            uni.showToast({ title: '识别失败：' + e.message, icon: 'none', duration: 3500 });
          }
          this.scanning = false;
        },
      });
    },
    async exportMistakes(opts) {
      if (this.exporting) return;
      this.exporting = true;
      try {
        const list = this.shownItems.slice(0, 100);
        if (!list.length) throw new Error('当前筛选没有错题');
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
    async aiAnalysis() {
      this.aiOpen = true;
      if (this.aiHtml) return;
      this.aiLoading = true;
      try {
        const d = await request('/api/mistakes/analysis', { method: 'POST', data: { uid: anonUid() }, timeout: 420000 });
        this.aiHtml = md(d.analysis || '分析失败，请稍后重试');
      } catch (e) {
        this.aiHtml = md('分析失败：' + e.message);
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
      if (!qt) return this.modName(m.module);
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
      await request('/api/mistakes/' + m.id, { method: 'PATCH', data: { uid: anonUid(), mastered: on ? 1 : 0 } });
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
        cacheMistakes(d.items, anonUid());
        this.loadMastery();
        try {
          if (this.dueTotal > 0) uni.setTabBarBadge({ index: 1, text: String(this.dueTotal > 99 ? '99+' : this.dueTotal) });
          else uni.removeTabBarBadge({ index: 1 });
        } catch (e) { /* tabBar 未就绪时忽略 */ }
      } catch (e) {
        if (seq !== this._loadSeq) return;
        const c = getCachedMistakes(anonUid());
        if (c && c.items && c.items.length) {
          this.items = c.items.map((m) => ({ ...m, open: false, html: md(m.explanation || '') }));
          this.offlineView = true;
          uni.showToast({ title: '当前无网络，展示已缓存的错题', icon: 'none' });
        } else {
          this.loadErr = e.message || '网络异常';
          uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
        }
      }
      this.loading = false;
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
    },
    async confirmMulti() {
      if (this.answered || !this.picked) return;
      await this.record(this.picked === this.curLetter);
    },
    async selfJudge(correct) {
      await this.record(correct);
    },
    async record(correct) {
      this.wasCorrect = correct;
      this.answered = true;
      if (this.cur._extra) return;
      if (!correct && !this.cur._requeued) {
        this.rItems.push({ ...this.cur, _requeued: true });
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
      if (m._simFetched || m._requeued || !m.module) return;
      m._simFetched = true;
      const qt = m.question_type || '';
      const sub = qt.includes('-') ? qt.split('-').slice(1).join('-') : null;
      try {
        let q = '/api/questions?limit=2&uid=' + encodeURIComponent(anonUid()) + '&module=' + encodeURIComponent(m.module);
        if (sub) q += '&submodule=' + encodeURIComponent(sub);
        const d = await request(q);
        const add = (d.items || [])
          .filter((x) => x.id !== m.question_id)
          .slice(0, 2)
          .map((x) => ({
            _extra: true,
            module: x.module,
            question_text: x.question + '\n' + Object.entries(x.options || {}).map(([k, v]) => `${k}.${v}`).join(' '),
            correct_answer: x.answer,
            explanation: x.hs_explanation || x.explanation || '',
          }));
        if (add.length) {
          this.rItems.push(...add);
          m._appended = add.length;
          this.$forceUpdate();
          trackEvent('review_similar_auto', m.module || '');
        }
      } catch (e) { /* 非关键路径 */ }
    },
    async setReviewReason(rz) {
      const m = this.cur;
      m.error_reason = rz;
      this.$forceUpdate();
      try {
        await request('/api/mistakes/' + m.id, { method: 'PATCH', data: { uid: anonUid(), error_reason: rz } });
        trackEvent('review_reason_tag', rz);
      } catch (e) { /* 非关键路径 */ }
    },
    similarFromReview() {
      trackEvent('review_similar_click', this.cur.module || '');
      this.practiceSimilar(this.cur);
    },
    nextReview() {
      if (this.rIdx + 1 < this.rItems.length) {
        this.rIdx++;
        this.resetQ();
      } else {
        this.celebrateN = this.rItems.filter((q) => !q._extra && !q._requeued).length;
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
      this.load();
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
    async redoAll() {
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
    redo(m) {
      uni.setStorageSync('redoQuestion', m.question_text || '');
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    reinforceFromMistake(m) {
      const qt = m.question_type || '';
      const sub = qt.includes('-') ? qt.split('-').slice(1).join('-') : qt || null;
      this.startReinforce({ module: m.module, submodule: sub, tag3: m.tag3, mastery: null });
    },
    practiceSimilar(m) {
      const qt = m.question_type || '';
      const sub = qt.includes('-') ? qt.split('-').slice(1).join('-') : null;
      uni.setStorageSync('practicePreset', { module: m.module, submodule: sub, count: 3 });
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
      if (m.module) acts.push({ t: '练3道同类', f: () => this.practiceSimilar(m) });
      if (m.question_id) acts.push({ t: '题目纠错', f: () => this.openReport(m) });
      if (m.question_id) acts.push({ t: '分享给队友', f: () => this.shareToMates(m) });
      if (!m.mastered) acts.push({ t: '标为已掌握', f: () => this.master(m) });
      else acts.push({ t: '恢复复习', f: () => this.master(m, false) });
      acts.push({ t: '删除', f: () => this.del(m) });
      uni.showActionSheet({
        itemList: acts.map((a) => a.t),
        success: (r) => acts[r.tapIndex].f(),
      });
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
          await request('/api/mistakes/' + m.id + '?uid=' + encodeURIComponent(anonUid()), { method: 'DELETE' });
          this.load();
        },
      });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; }
.offbar { background: var(--warn-soft); border-radius: 16rpx; padding: 16rpx 22rpx; font-size: 24rpx; color: var(--warn); margin-bottom: 20rpx; }
.ovrow { display: flex; gap: 16rpx; margin-bottom: 20rpx; }
.ov-c { flex: 1; background: var(--card, #fff); border-radius: 20rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 22rpx 0; display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.ov-n { font-size: 44rpx; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.ov-n.warn { color: #d97706; }
.ov-n.ok { color: #16a34a; }
.ov-t { font-size: 21rpx; color: var(--ink-2); }
.card { background: var(--card); border-radius: var(--radius); padding: 24rpx; margin-bottom: 24rpx; border-left: 6rpx solid var(--brand); border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.empty { text-align: center; padding: 56rpx 32rpx; }
.e-ico { font-size: 72rpx; margin-bottom: 16rpx; }
.e-t { font-size: 32rpx; font-weight: 600; margin-bottom: 10rpx; }
.e-s { font-size: 24rpx; color: var(--ink-2); line-height: 1.7; margin-bottom: 28rpx; }
:deep(.e-btn2) { margin-top: 8rpx; min-width: 60%; border-radius: 18rpx !important; background: linear-gradient(135deg, #5c82ff, var(--brand)) !important; font-weight: 600; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; border-left: none; }
.retry { margin-top: 12rpx; color: var(--brand-text); font-size: 26rpx; font-weight: 500; }
.searchbar { display: flex; align-items: center; gap: 12rpx; background: var(--card); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 14rpx 26rpx; margin-bottom: 20rpx; }
.searchinput { flex: 1; font-size: 26rpx; color: var(--ink); height: 40rpx; line-height: 40rpx; }
.searchclear { display: flex; align-items: center; padding: 0 8rpx; }
.sortrow { display: flex; align-items: center; gap: 10rpx; margin-bottom: 16rpx; flex-wrap: wrap; }
.sort-k { font-size: 22rpx; color: var(--ink-2); }
.sort-chip { font-size: 22rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 4rpx 18rpx; background: var(--card); }
.sort-chip.on { color: #fff; background: var(--brand); border-color: var(--brand-text); }
.kpwrap { margin-bottom: 16rpx; }
.kpchips { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 8rpx; }
.kpchip { font-size: 22rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 6rpx 18rpx; background: var(--card); }
.kpchip.on { color: #fff; background: var(--brand); border-color: var(--brand-text); }
.chips { white-space: nowrap; margin-bottom: 24rpx; }
.chip { display: inline-block; padding: 10rpx 30rpx; margin-right: 16rpx; border-radius: 999rpx; background: var(--card); border: 1rpx solid var(--line); font-size: 25rpx; color: var(--ink-2); }
.chip.on { background: var(--brand); border-color: var(--brand-text); color: #fff; font-weight: 600; }
.mhead { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
.mtime { margin-left: auto; white-space: nowrap; }
.duehint { display: inline-flex; align-items: center; gap: 8rpx; font-size: 21rpx; color: var(--ink-2); }
.duehint.due { color: #c2410c; }
.duedot { width: 12rpx; height: 12rpx; border-radius: 50%; background: var(--ink-4); }
.duehint.due .duedot { background: #f59e0b; }
.rvbadge { font-size: 20rpx; color: var(--ink-2); background: var(--soft-bg); border-radius: 999rpx; padding: 4rpx 14rpx; }
.rzbadge { font-size: 20rpx; color: #b45309; background: #fef3c7; border-radius: 999rpx; padding: 4rpx 14rpx; }
.srcbadge { font-size: 20rpx; color: #6d28d9; background: #ede9fe; border-radius: 999rpx; padding: 4rpx 14rpx; }
.zhan { margin-left: auto; font-size: 22rpx; font-weight: 700; color: var(--ok); border: 3rpx solid var(--ok); border-radius: 8rpx; padding: 2rpx 12rpx; transform: rotate(-8deg); }
.anscmp { margin-top: 12rpx; font-size: 23rpx; display: flex; gap: 12rpx; align-items: center; flex-wrap: wrap; }
.mstat { margin-top: 10rpx; font-size: 22rpx; color: var(--ink-2); }
.anscmp .ca { color: var(--ok); font-weight: 600; }
.rpill { font-size: 22rpx; font-weight: 600; border-radius: 999rpx; padding: 6rpx 20rpx; }
.rpill.wrong { background: #fee2e2; color: #b91c1c; }
.rpill.right { background: var(--ok-soft); color: #15803d; }
.zop { color: var(--ok); border: 1rpx solid var(--ok); }
.segrow { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; }
.seg { flex: 1; display: flex; background: var(--fill); border-radius: 16rpx; padding: 6rpx; }
.seg-i { flex: 1; text-align: center; padding: 14rpx 0; border-radius: 12rpx; font-size: 25rpx; color: var(--ink-2); }
.seg-i.on { background: var(--card); color: var(--ink); font-weight: 600; box-shadow: 0 2rpx 8rpx rgba(31, 35, 41, 0.08); }
.filterbtn { display: inline-flex; align-items: center; gap: 6rpx; background: var(--card); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 0 24rpx; min-height: 44px; box-sizing: border-box; flex-shrink: 0; }
.filterbtn-t { font-size: 24rpx; color: var(--ink-2); }
.filterbtn.bon { background: var(--brand); border-color: var(--brand-text); }
.filterbtn-t.bont { color: #fff; font-weight: 600; }
.bchk { width: 36rpx; height: 36rpx; border-radius: 50%; border: 3rpx solid var(--line); margin-right: 12rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 24rpx; color: #fff; box-sizing: border-box; }
.bchk.on { background: var(--brand); border-color: var(--brand-text); }
.mcard.bsel { border-color: var(--brand-text); box-shadow: 0 0 0 2rpx var(--brand-soft); }
.fabmenu { position: fixed; right: 32rpx; bottom: calc(50px + env(safe-area-inset-bottom) + 32rpx); z-index: 60; display: flex; flex-direction: column; align-items: flex-end; gap: 18rpx; }
/* #ifndef H5 */
.fabmenu { bottom: calc(env(safe-area-inset-bottom) + 32rpx); }
/* #endif */
.fab-item { display: inline-flex; align-items: center; gap: 10rpx; min-height: 44px; box-sizing: border-box; padding: 0 26rpx; background: var(--card); color: var(--ink); font-size: 26rpx; font-weight: 600; border: 1rpx solid var(--line); border-radius: 999rpx; box-shadow: 0 8rpx 24rpx rgba(31, 36, 48, 0.14); }
.fab-main { width: 104rpx; height: 104rpx; border-radius: 50%; background: var(--brand); color: #fff; font-size: 52rpx; font-weight: 400; display: flex; align-items: center; justify-content: center; box-shadow: 0 10rpx 28rpx rgba(46, 91, 255, 0.35); transition: transform 0.3s ease; }
.fab-main.open { transform: rotate(45deg); }
.batchbar { position: fixed; left: 24rpx; right: 24rpx; bottom: calc(120rpx + env(safe-area-inset-bottom)); z-index: 50; background: var(--card); border: 1rpx solid var(--line); border-radius: 24rpx; box-shadow: 0 8rpx 32rpx rgba(31, 36, 48, 0.16); padding: 16rpx 24rpx; display: flex; align-items: center; gap: 16rpx; }
.bb-sel { font-size: 24rpx; color: var(--brand-text); min-height: 44px; display: inline-flex; align-items: center; }
.bb-n { font-size: 24rpx; color: var(--ink-2); flex: 1; }
.bb-acts { display: flex; gap: 12rpx; }
.bb-btn { font-size: 24rpx; font-weight: 600; border-radius: 999rpx; padding: 0 24rpx; min-height: 44px; display: inline-flex; align-items: center; }
.bb-btn.ok { color: #15803d; background: var(--ok-soft); }
.bb-btn.danger { color: #c33; background: rgba(204, 51, 51, 0.08); }
.bb-btn.dis { opacity: 0.4; }
.modgroup { padding: 20rpx 24rpx; }
.mg-h { font-size: 24rpx; color: var(--ink-2); margin-bottom: 6rpx; }
.mg-row { display: flex; align-items: center; gap: 12rpx; min-height: 56px; border-bottom: 1rpx solid var(--line); }
.mg-blk:last-child .mg-row { border-bottom: none; }
.mg-arrow { font-size: 24rpx; color: var(--ink-3); width: 28rpx; }
.mg-name { font-size: 29rpx; font-weight: 600; color: var(--ink); flex: 1; }
.mg-badge { background: var(--fill); color: var(--ink-2); border-radius: 999rpx; font-size: 22rpx; padding: 4rpx 18rpx; }
.mg-mst { font-size: 21rpx; color: var(--ink-3); white-space: nowrap; }
.mg-go { font-size: 24rpx; color: var(--brand-text); padding: 18rpx 0 18rpx 24rpx; }
.mg-sub { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding-left: 60rpx; border-bottom: 1rpx dashed var(--line); }
.mg-sub-name { font-size: 26rpx; color: var(--ink); }
.mg-sub3 { padding-left: 110rpx; min-height: 42px; }
.mg-sub3 .mg-sub-name { font-size: 24rpx; color: var(--ink-2); }
.curfilter { display: flex; gap: 12rpx; margin-bottom: 16rpx; flex-wrap: wrap; }
.attempts { margin-top: 14rpx; background: var(--soft-bg); border-radius: 12rpx; padding: 14rpx 18rpx; }
.att-h { font-size: 22rpx; color: var(--ink-2); margin-bottom: 6rpx; }
.att-row { display: flex; align-items: center; gap: 16rpx; font-size: 23rpx; padding: 6rpx 0; }
.att-mark { font-weight: 600; }
.att-mark.aok { color: var(--ok, #12b76a); }
.att-mark.abad { color: var(--bad, #f04438); }
.att-pick { color: var(--ink); }
.att-secs { color: var(--ink-2); }
.att-time { margin-left: auto; color: var(--ink-3); font-size: 21rpx; }
.ai-loading { text-align: center; color: var(--ink-2); font-size: 25rpx; padding: 60rpx 0; }
.mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 99; display: flex; align-items: flex-end; }
.rf-card { width: 100%; background: var(--card, #fff); border-radius: 28rpx 28rpx 0 0; padding: 40rpx 32rpx calc(40rpx + env(safe-area-inset-bottom)); }
.rf-t { font-size: 26rpx; color: var(--ink-2, #646a73); }
.rf-name { font-size: 34rpx; font-weight: 700; margin-top: 10rpx; }
.rf-meta { font-size: 22rpx; color: var(--ink-2, #8a90a0); margin: 8rpx 0 26rpx; }
.rf-btn { background: var(--brand, #2e5bff); color: #fff; border-radius: 999rpx; font-size: 28rpx; }
.rf-row2 { display: flex; justify-content: center; gap: 48rpx; margin-top: 22rpx; }
.rf-alt { font-size: 24rpx; color: var(--ink-2, #8a90a0); padding: 8rpx 16rpx; }
.sheet { width: 100%; background: var(--card); border-radius: 24rpx 24rpx 0 0; padding: 28rpx 28rpx 48rpx; max-height: 70vh; overflow-y: auto; box-sizing: border-box; }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.sheet-t { font-size: 30rpx; font-weight: 600; }
.sheet-x { font-size: 30rpx; color: var(--ink-2); padding: 10rpx 20rpx; }
.sheet-k { font-size: 23rpx; color: var(--ink-2); margin: 20rpx 0 10rpx; }
.sheet-done { margin-top: 32rpx; background: var(--brand); color: #fff; text-align: center; border-radius: 999rpx; padding: 22rpx 0; font-size: 28rpx; font-weight: 500; }
.scan-sum { font-size: 25rpx; color: var(--ink-2); margin: 8rpx 0 12rpx; }
.scan-good { color: #12b76a; font-weight: 600; }
.scan-list { max-height: 50vh; }
.scan-row { display: flex; align-items: center; min-height: 60rpx; border-bottom: 1rpx solid var(--fill); font-size: 26rpx; }
.scan-no { width: 70rpx; color: var(--ink-3); }
.scan-pick { flex: 1; color: var(--ink); }
.scan-pick.good { color: #12b76a; }
.scan-pick.bad { color: #f04438; }
.scan-ans { width: 140rpx; color: var(--ink-2); }
.scan-mark { width: 50rpx; text-align: right; color: var(--ink-3); }
.manual-list { max-height: 44vh; }
.manual-row { display: flex; align-items: center; gap: 16rpx; min-height: 88rpx; border-bottom: 1rpx solid var(--fill); }
.manual-opt { flex: 1; text-align: center; line-height: 68rpx; border: 1rpx solid var(--line); border-radius: 12rpx; font-size: 28rpx; color: var(--ink-2); }
.manual-opt.on { background: var(--brand); border-color: var(--brand-text); color: #fff; font-weight: 600; }
.manual-codebar { margin: 0; }
.manual-back { text-align: center; color: var(--ink-2); font-size: 25rpx; padding: 20rpx 0 4rpx; }
.sheet-done.dim { opacity: 0.45; }
.sheet-export { margin-top: 16rpx; margin-bottom: 110rpx; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--brand); color: var(--brand-text); text-align: center; border-radius: 999rpx; padding: 20rpx 0; font-size: 27rpx; font-weight: 500; }
.xp-k { margin-top: 12rpx; font-size: 22rpx; font-weight: 700; color: #ea580c; border-left: 6rpx solid #ea580c; padding-left: 10rpx; }
.xp-body { margin-top: 6rpx; font-size: 23rpx; color: var(--ink); background: var(--warn-soft); border-radius: 10rpx; padding: 12rpx; line-height: 1.6; }
.mfoot { display: flex; justify-content: space-between; align-items: center; margin-top: 12rpx; border-top: 1rpx solid var(--line); padding-top: 8rpx; }
.op.more { color: var(--ink-2); font-weight: 700; padding: 18rpx 30rpx; margin-left: 0; }
.op.hint { color: var(--ink-3); margin-left: 0; padding-left: 0; }
.loadmore { text-align: center; font-size: 24rpx; color: var(--ink-2); padding: 24rpx 0 140rpx; }
.acts { display: flex; gap: 8rpx; }
.op { font-size: 24rpx; margin-left: 16rpx; padding: 18rpx 24rpx; border-radius: 999rpx; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; }
.op.sim { background: var(--brand-soft); color: var(--brand-text); }
.op.reportop { color: var(--ink-3); text-decoration: underline; }
.rp-types { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 20rpx; }
.rp-chip { padding: 18rpx 26rpx; border-radius: 999rpx; background: var(--soft-bg); font-size: 26rpx; color: var(--ink-2); }
.rp-chip.on { background: rgba(46, 91, 255, 0.12); color: var(--brand-text); font-weight: 600; }
.rp-detail { width: 100%; box-sizing: border-box; min-height: 140rpx; background: var(--soft-bg); border-radius: 16rpx; padding: 20rpx; font-size: 26rpx; }
.rp-submit { margin-bottom: 110rpx; }
.rp-submit.off { opacity: 0.45; pointer-events: none; }
.redo { color: var(--brand-text); border: 1rpx solid var(--brand); }
.del { color: #c33; }
.tag { display: inline-block; background: var(--brand-soft); color: var(--brand-text); border-radius: 10rpx; padding: 4rpx 14rpx; font-size: 22rpx; }
.q { font-size: 26rpx; line-height: 1.5; margin-top: 10rpx; }
.q.clamp { max-height: 120rpx; overflow: hidden; }
.meta { font-size: 22rpx; color: var(--ink-2); }
.duecard { background: linear-gradient(180deg, #4a7bf7, #3567ec); border: none; box-shadow: 0 6rpx 16rpx rgba(46, 91, 255, 0.25); display: flex; justify-content: space-between; align-items: center; }
.redoentry { display: flex; justify-content: space-between; align-items: center; }
.redo-l { display: flex; align-items: center; gap: 16rpx; }
.redo-ico { width: 64rpx; height: 64rpx; border-radius: 50%; background: var(--brand-soft); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.redo-t { display: block; font-size: 27rpx; font-weight: 600; color: var(--ink); }
.redo-s { display: block; font-size: 21rpx; color: var(--ink-2); margin-top: 4rpx; }
.redo-go { background: var(--brand-soft); color: var(--brand-text); font-size: 25rpx; font-weight: 600; border-radius: 999rpx; padding: 0 34rpx; min-height: 44px; line-height: 44px; flex-shrink: 0; box-sizing: border-box; }
.nrbadge {
  display: inline-block;
  background: var(--brand-soft);
  color: var(--brand-text);
  border-radius: 10rpx;
  padding: 4rpx 14rpx;
  font-size: 22rpx;
  margin-left: 8rpx;
}
.nrbadge.due {
  background: var(--warn-soft);
  color: #c2410c;
}
.timesbadge { display: inline-block; background: #fee2e2; color: #b91c1c; border-radius: 10rpx; padding: 4rpx 14rpx; font-size: 22rpx; margin-left: 8rpx; }
.duetxt { display: flex; align-items: center; gap: 8rpx; font-size: 28rpx; font-weight: 700; color: #fff; }
.duetxt-t { font-size: 28rpx; font-weight: 700; color: #fff; }
.duesub { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.75); margin-top: 6rpx; }
.duego { background: var(--card); color: var(--brand-text); font-size: 25rpx; font-weight: 600; border-radius: 999rpx; padding: 0 34rpx; min-height: 44px; line-height: 44px; display: inline-block; box-sizing: border-box; }
.review { border-left-color: #f5a623; }
.cb-card { background: var(--card); border-radius: 28rpx; padding: 56rpx 44rpx 40rpx; margin: 0 60rpx calc(env(safe-area-inset-bottom) + 120rpx); text-align: center; max-width: 560rpx; animation: cb-pop 0.35s ease-out; }
.cb-emoji { font-size: 88rpx; line-height: 1; animation: cb-bounce 0.8s ease-out; }
.cb-t { font-size: 34rpx; font-weight: 800; color: #16a34a; margin-top: 20rpx; }
.cb-s { font-size: 24rpx; color: var(--ink-2); margin-top: 12rpx; }
.cb-btn { margin-top: 32rpx; background: linear-gradient(135deg, #5b8af8, var(--brand)); color: #fff; font-size: 27rpx; font-weight: 600; border-radius: 999rpx; }
@keyframes cb-pop {
  0% { transform: scale(0.7); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes cb-bounce {
  0% { transform: translateY(-30rpx); }
  50% { transform: translateY(8rpx); }
  100% { transform: translateY(0); }
}
.rhead { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.opts { display: flex; gap: 16rpx; margin: 20rpx 0; }
.opt { flex: 1; text-align: center; padding: 16rpx 0; border: 2rpx solid var(--line); border-radius: 12rpx; font-size: 28rpx; }
.opt.ok { background: var(--ok-soft); border-color: #3aa53a; color: #2a7a2a; }
.opt.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
.opt.dim { opacity: 0.4; }
.opt.sel { background: var(--brand-soft, #eef3ff); border-color: var(--brand, #2e5bff); color: var(--brand, #2e5bff); }
.verdict { font-size: 26rpx; font-weight: 600; margin: 12rpx 0; }
.verdict.good { color: #2a7a2a; }
.verdict.badv { color: #b03030; }
:deep(.next-btn) { margin-top: 20rpx; width: 100%; border-radius: 12rpx !important; }
.reasons { display: flex; flex-wrap: wrap; align-items: center; gap: 12rpx; margin: 8rpx 0 16rpx; }
.rz-t { font-size: 23rpx; color: var(--ink-2); }
.rz { font-size: 23rpx; color: var(--ink-2); border: 1rpx solid var(--line); background: var(--soft-bg); border-radius: 999rpx; padding: 8rpx 22rpx; }
.rz.on { background: var(--brand); border-color: var(--brand-text); color: #fff; font-weight: 600; }
.appended-tip { font-size: 23rpx; color: var(--brand, #2e5bff); background: var(--brand-soft, #eef3ff); border-radius: 10rpx; padding: 10rpx 16rpx; margin-bottom: 12rpx; }
.sim-row { margin-top: 16rpx; text-align: center; }
.sim-t { font-size: 25rpx; color: var(--brand, #2e5bff); font-weight: 600; }
.recap-h { display: flex; justify-content: space-between; align-items: center; }
.recap-t { font-size: 26rpx; font-weight: 700; color: var(--ink-1, #1f2329); }
.recap-x { font-size: 23rpx; color: var(--brand, #2e5bff); }
.recap-sec { margin-top: 16rpx; }
.recap-st { font-size: 22rpx; color: var(--ink-2); }
.recap-row { display: flex; align-items: center; gap: 12rpx; margin-top: 10rpx; }
.recap-name { flex: 0 0 160rpx; font-size: 23rpx; color: var(--ink-1, #1f2329); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recap-bar { flex: 1; height: 14rpx; background: var(--soft-bg); border-radius: 999rpx; overflow: hidden; }
.recap-fill { height: 100%; background: var(--brand, #2e5bff); border-radius: 999rpx; }
.recap-fill.warnfill { background: #f59e0b; }
.recap-n { flex: 0 0 40rpx; text-align: right; font-size: 22rpx; color: var(--ink-2); }
.recap-tip { display: block; margin-top: 14rpx; font-size: 22rpx; color: var(--ink-2); }
.selfjudge { margin-top: 20rpx; }
.q2 { font-size: 24rpx; color: var(--ink-2); margin-bottom: 12rpx; }
.sj-row { display: flex; gap: 20rpx; }
:deep(.sj-btn) { flex: 1; border-radius: 12rpx !important; }

/* 快捷键提示卡（仅桌面侧栏展示）与速查面板 */
.kbdcard { display: none; }
.kbd-h { font-size: 26rpx; font-weight: 600; color: var(--ink); }
.kbd-row { display: flex; align-items: center; gap: 8rpx; margin-top: 14rpx; }
.kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 40rpx; height: 40rpx; padding: 0 10rpx; box-sizing: border-box; background: var(--card); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 8rpx; font-size: 21rpx; font-weight: 600; color: var(--ink-2); }
.kbd-d { font-size: 22rpx; color: var(--ink-2); margin-left: 8rpx; }
.kbd-more { display: block; margin-top: 16rpx; font-size: 22rpx; color: var(--brand-text); cursor: pointer; }

/* 错题趋势卡（仅桌面侧栏展示） */
.trendcard { display: none; }
.trend-t { font-size: 26rpx; font-weight: 600; color: var(--ink); }
.trend-bars { display: flex; gap: 18rpx; align-items: flex-end; margin-top: 18rpx; }
.trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.trend-barwrap { width: 100%; height: 96rpx; display: flex; align-items: flex-end; justify-content: center; gap: 4rpx; }
.trend-bar { width: 22rpx; background: var(--brand, #2e5bff); border-radius: 6rpx 6rpx 0 0; min-height: 0; }
.trend-bar.killed { background: #22c55e; }
.trend-n { font-size: 22rpx; font-weight: 600; color: var(--ink); }
.trend-kn { font-size: 20rpx; font-weight: 600; color: #16a34a; }
.trend-lb { font-size: 20rpx; color: var(--ink-3); }
.trend-legend { display: flex; gap: 24rpx; margin-top: 12rpx; }
.trend-lg { display: flex; align-items: center; gap: 6rpx; }
.trend-dot { width: 14rpx; height: 14rpx; border-radius: 4rpx; background: var(--brand, #2e5bff); }
.trend-dot.killed { background: #22c55e; }
.trend-lgt { font-size: 20rpx; color: var(--ink-2); }
.trend-sum { display: block; margin-top: 14rpx; font-size: 22rpx; color: var(--ink-2); }

/* #ifdef H5 */
/* 桌面操作台（round-3）：≥1024px 双栏工作台，主列=列表工作流，侧栏=统计/复盘/工具 */
@media (min-width: 1024px) {
  .bookwrap { max-width: 920px !important; }
  .mcard.kbf { outline: 2px solid var(--brand); outline-offset: -2px; }
  .bookwrap::after { content: ''; display: block; clear: both; }
  /* 主列走常规文档流（仅预留右侧栏宽度），侧栏用右浮动堆叠：
     避免左列元素受“浮动框顶不得高于文档序更早浮动框顶”的约束被右列高卡推低形成空洞 */
  .bookwrap .bk-main { margin-right: 344px; box-sizing: border-box; }
  .bookwrap .bk-side { float: right; clear: right; width: 320px; box-sizing: border-box; }
  .bookwrap .trendcard { display: block; }
  .bookwrap .kbdcard { display: block; }
  .bookwrap.noside .bk-main { margin-right: 0; }
  .bookwrap-review { max-width: 760px !important; }
}
/* #endif */
</style>
