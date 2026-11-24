<template>
  <view class="page" :class="{ 'is-detail': tab === 'q' && detail }">
    <wd-segmented ref="seg" :value="tabLabel" :options="tabOpts" class="seg" @change="onTabChange" />

    <!-- 真题列表 -->
    <template v-if="tab === 'q' && !detail">
      <kg-chip-row :model-value="qFavOnly ? -1 : QTYPES.indexOf(qtype)" :options="qtypeChips" class="chips" @update:model-value="setQtype(QTYPES[$event])" />
      <view class="fltbar">
        <kg-tag v-if="paper" tone="brand" class="paper-tag tappable" role="button" :aria-label="'清除套卷筛选：' + paper" @click="clearPaper">{{ paper }} ✕</kg-tag>
        <kg-button :variant="region ? 'secondary' : 'ghost'" size="sm" icon="chevron-down" @click="fltOpen = true">{{ region || '地区' }}</kg-button>
        <kg-button :variant="year ? 'secondary' : 'ghost'" size="sm" icon="chevron-down" @click="fltOpen = true">{{ year || '年份' }}</kg-button>
        <kg-button :variant="qFavOnly ? 'secondary' : 'ghost'" size="sm" icon="star" :aria-pressed="qFavOnly ? 'true' : 'false'" @click="toggleQFavOnly">收藏{{ qFavIds.length ? ' ' + qFavIds.length : '' }}</kg-button>
        <view class="grow"></view>
        <kg-button v-if="fltCount || paper || qtype !== '全部' || qFavOnly" variant="text" size="sm" @click="clearFlt">重置</kg-button>
      </view>

      <kg-sheet v-model="fltOpen" title="筛选">
        <view class="sheet-body">
          <text v-if="years.length" class="sheet-k">年份</text>
          <kg-chip-row v-if="years.length" :model-value="year" :options="yearChips" size="sm" @update:model-value="setYear" />
          <text v-if="regions.length" class="sheet-k">地区</text>
          <wd-radio-group v-if="regions.length" :model-value="region" shape="button" @change="onRegionChange">
            <wd-radio value="">全部</wd-radio>
            <wd-radio v-for="r in regions" :key="r" :value="r">{{ r }}</wd-radio>
          </wd-radio-group>
        </view>
        <template #footer>
          <view class="sheet-foot">
            <kg-button variant="ghost" size="lg" @click="clearFlt">重置</kg-button>
            <kg-button variant="primary" size="lg" class="grow" @click="fltOpen = false">查看 {{ qTotal }} 道题</kg-button>
          </view>
        </template>
      </kg-sheet>

      <kg-skeleton v-if="loading" preset="cards" />
      <kg-empty-state
        v-else-if="qErr"
        icon="wifi-off"
        :title="'加载失败：' + qErr"
        cta-text="重试"
        @cta="loadQs()"
      />
      <kg-empty-state
        v-else-if="!shownQs.length"
        icon="pen-line"
        :title="qFavOnly ? '还没有收藏真题' : '暂无题目'"
        :desc="qFavOnly ? '点题目右上角星标收藏，收藏的题会汇总在这里' : '换个题型或年份试试，更多真题陆续上线'"
        :cta-text="qFavOnly || fltCount || paper || qtype !== '全部' ? '查看全部真题' : ''"
        @cta="clearFlt"
      />
      <view v-else class="qgrid kg-cards">
        <kg-card v-for="q in shownQs" :key="q.id" clickable class="q-item" @click="openQ(q.id)">
          <view class="q-top">
            <view class="q-tags">
              <kg-tag tone="brand">{{ q.qtype }}</kg-tag>
              <kg-tag v-if="q.paper" tone="neutral" class="tappable" role="button" :aria-label="'只看本套卷：' + q.paper" @click.stop="applyPaper(q.paper)">{{ q.paper }}</kg-tag>
              <text v-else class="q-paper">{{ q.exam_year + ' · ' + (q.exam_region || '') }}</text>
            </view>
            <view class="star-btn" role="button" :aria-label="qFavIds.includes(q.id) ? '取消收藏本题' : '收藏本题'" @click.stop="toggleQFav(q)">
              <l-icon name="star" :size="20" :tone="qFavIds.includes(q.id) ? 'warn' : 'faint'" :fill="qFavIds.includes(q.id) ? 'currentColor' : 'none'" />
            </view>
          </view>
          <text class="q-text ellip3">{{ q.question }}</text>
          <view class="q-foot">
            <text class="q-meta">{{ qMeta(q.question) }}</text>
            <kg-button variant="secondary" size="sm" icon="chevron-right" @click.stop="openQ(q.id)">作答</kg-button>
          </view>
        </kg-card>
      </view>
      <kg-button v-if="!loading && !qErr && !qFavOnly && !qEnd && qs.length >= 20" variant="secondary" size="md" block class="more" @click="loadMore">加载更多</kg-button>
    </template>

    <!-- 真题详情 / 作答（≥768px 双栏独立滚动；材料卡外壳与标题固定，仅内部文本滚动） -->
    <template v-if="tab === 'q' && detail">
      <kg-button variant="text" size="sm" icon="chevron-left" class="back" @click="detail = null">返回列表</kg-button>
      <view class="d-cols">
        <view class="d-col d-col-l" :style="splitH ? { height: splitH + 'px' } : {}">
          <kg-card class="d-card d-card-l">
            <view class="d-l-hd">
              <text class="q-paper d-paper">{{ detail.paper || (detail.exam_year + ' · ' + (detail.exam_region || '')) }}</text>
              <view class="q-meta-bar">
                <kg-tag tone="brand">{{ detail.qtype }}</kg-tag>
                <view class="q-meta-acts">
                  <view class="star-btn" role="button" :aria-label="qFavIds.includes(detail.id) ? '取消收藏本题' : '收藏本题'" @click="toggleQFav(detail)">
                    <l-icon name="star" :size="20" :tone="qFavIds.includes(detail.id) ? 'warn' : 'faint'" :fill="qFavIds.includes(detail.id) ? 'currentColor' : 'none'" />
                  </view>
                  <kg-button variant="text" size="sm" icon="copy" aria-label="复制本题链接" @click="copyQLink">复制链接</kg-button>
                </view>
              </view>
            </view>
            <scroll-view scroll-y class="d-l-body" :show-scrollbar="false">
              <view :key="detail.id" :class="'kg-q-enter-' + navDir">
                <text class="d-h">作答要求</text>
                <text class="d-q">{{ detail.question }}</text>
                <view class="d-toggle" role="button" :aria-expanded="showMat ? 'true' : 'false'" @click="showMat = !showMat">
                  <text class="d-h">给定资料</text>
                  <l-icon name="chevron-down" :size="20" tone="muted" class="fold-ico" :class="{ flip: showMat }" />
                </view>
                <kg-collapse :open="showMat">
                  <text class="d-mat">{{ detail.material }}</text>
                </kg-collapse>
              </view>
            </scroll-view>
          </kg-card>
          <view v-if="qNav.idx >= 0 && qNav.total > 1" class="d-nav">
            <kg-button variant="ghost" size="md" icon="chevron-left" :disabled="!qNav.prevId" aria-label="上一题" @click="qNav.prevId && openQ(qNav.prevId, 'prev')">上一题</kg-button>
            <text class="d-nav-pos num">{{ qNav.idx + 1 }} / {{ qNav.total }}</text>
            <kg-button variant="ghost" size="md" :disabled="!qNav.nextId" aria-label="下一题" @click="qNav.nextId && openQ(qNav.nextId, 'next')">下一题</kg-button>
          </view>
        </view>
        <view class="d-col d-col-r" :style="splitH ? { height: splitH + 'px' } : {}">
          <kg-card class="d-card d-card-r">
            <!-- 作答头固定不滚：长文作答时字数统计始终可见 -->
            <view class="d-ans-h">
              <text class="d-h">我的作答</text>
              <text v-if="qWordLim" class="d-save num" :class="qWordSt">{{ myAnswer ? ('已保存 · ' + myAnswer.length + ' / 限' + qWordLim.label + (qWordSt === 'over' ? '（超 ' + (myAnswer.length - qWordLim.max) + ' 字）' : '')) : '限' + qWordLim.label }}</text>
              <text v-else-if="myAnswer" class="d-save">已自动保存 · <text class="num">{{ myAnswer.length }}</text> 字</text>
            </view>
            <scroll-view scroll-y class="d-ans-body" :show-scrollbar="false">
              <textarea v-model="myAnswer" class="d-ta" :maxlength="3000" placeholder="在此作答后点击下方按钮，AI 按采分点批改（大作文为结构点评+参考档位）。草稿自动保存，换设备可续写" placeholder-style="color: var(--ink-4)" auto-height @input="saveDraft" />
              <kg-button variant="primary" size="lg" block :disabled="grading || !myAnswer.trim()" :loading="grading" class="grade-btn" @click="grade">{{ grading ? 'AI 批改中…' : '提交 AI 批改' }}</kg-button>
              <view v-if="showSyncTip" class="sl-sync" role="button" @click="goSyncLogin">
                <l-icon name="cloud" :size="16" tone="brand-text" />
                <text class="sl-sync-t">登录账号，申论草稿与 AI 批改记录多端永久同步</text>
                <text class="sl-sync-go">去登录 ›</text>
              </view>
              <view v-if="gradeResult" class="d-grade">
                <text class="d-h">批改结果<text class="g-note">（AI 参考，非官方评分）</text></text>
                <text class="g-body">{{ gradeResult }}</text>
              </view>
              <view v-if="history.length" class="d-toggle" role="button" :aria-expanded="showHist ? 'true' : 'false'" @click="showHist = !showHist">
                <text class="d-h">历史作答（{{ history.length }}）</text>
                <l-icon name="chevron-down" :size="20" tone="muted" class="fold-ico" :class="{ flip: showHist }" />
              </view>
              <kg-collapse :open="showHist">
                <view v-for="h in history" :key="h.id" class="hist-item" role="button" title="还原这次作答与批改" @click="applyHist(h)">
                  <text class="hist-time num">{{ fmtTime(h.created_at) }}</text>
                  <text class="hist-ans">{{ h.answer }}</text>
                  <text v-if="h.result" class="hist-res">{{ h.result }}</text>
                </view>
              </kg-collapse>
              <view class="d-toggle ref" role="button" :aria-expanded="showRef ? 'true' : 'false'" @click="showRef = !showRef">
                <text class="d-h ref-t">{{ showRef ? '收起参考要点' : '写完再看 · 参考要点' }}</text>
                <l-icon name="chevron-down" :size="20" tone="brand-text" class="fold-ico" :class="{ flip: showRef }" />
              </view>
              <kg-collapse :open="showRef">
                <text class="d-ref">{{ detail.reference }}</text>
                <text v-if="detail.notes" class="d-notes">{{ detail.notes }}</text>
              </kg-collapse>
            </scroll-view>
          </kg-card>
        </view>
      </view>
    </template>

    <!-- 素材/范文 -->
    <template v-if="tab === 'm'">
      <view class="fltbar m-fltbar">
        <kg-chip-row :model-value="favOnly ? -1 : MTYPES.indexOf(mtype)" :options="mtypeChips" class="chips m-chips" @update:model-value="setMtype(MTYPES[$event])" />
        <view class="m-flt-act">
          <kg-button v-if="mtype === '我的笔记'" variant="secondary" size="sm" icon="square-pen" @click="openNoteForm()">写笔记</kg-button>
          <kg-button v-else-if="mtype !== '热点'" :variant="favOnly ? 'secondary' : 'ghost'" size="sm" icon="star" :aria-pressed="favOnly ? 'true' : 'false'" @click="toggleFavOnly">收藏{{ favIds.length ? ' ' + favIds.length : '' }}</kg-button>
        </view>
      </view>
      <kg-skeleton v-if="loading" preset="cards" />
      <kg-empty-state
        v-else-if="mErr"
        icon="wifi-off"
        :title="'加载失败：' + mErr"
        cta-text="重试"
        @cta="loadMats()"
      />
      <!-- 热点：内涵/角度/金句 三段式（归入 loading/mErr 之后的同一条件链，防止加载中骨架屏与「暂无素材」同屏渲染） -->
      <template v-else-if="mtype === '热点'">
        <kg-empty-state v-if="!hots.length" icon="book-open" title="暂无热点素材" desc="按「内涵/角度/金句」整理的热点将陆续上线" />
        <view v-else class="mgrid kg-cards">
          <kg-card v-for="g in hots" :key="g.topic" class="m-item">
            <view class="q-top" role="button" @click="expanded = expanded === 'h' + g.topic ? 0 : 'h' + g.topic">
              <text class="m-topic">{{ g.topic }}</text>
              <l-icon name="chevron-down" :size="16" tone="faint" class="fold-ico" :class="{ flip: expanded === 'h' + g.topic }" />
            </view>
            <kg-collapse :open="expanded === 'h' + g.topic">
              <view v-for="seg in hotSegRows(g)" :key="seg.name" class="hot-seg">
                <text class="hot-seg-name">{{ seg.name }}</text>
                <view v-for="m in seg.items" :key="m.id" class="hot-line">
                  <text class="hot-line-t">{{ m.content }}</text>
                  <view class="star-btn" role="button" @click="toggleFav(m)">
                    <l-icon name="star" :size="16" :tone="favIds.includes(m.id) ? 'warn' : 'faint'" :fill="favIds.includes(m.id) ? 'currentColor' : 'none'" />
                  </view>
                </view>
              </view>
              <view v-if="g.others && g.others.length" class="hot-seg">
                <text class="hot-seg-name hot-more" role="button" @click="hotOthers[g.topic] = !hotOthers[g.topic]">其他 {{ g.others.length }} 条 {{ hotOthers[g.topic] ? '收起' : '展开' }}</text>
                <template v-if="hotOthers[g.topic]">
                  <view v-for="m in g.others" :key="m.id" class="hot-line">
                    <text class="hot-line-t">{{ m.type }}·{{ m.content }}</text>
                    <view class="star-btn" role="button" @click="toggleFav(m)">
                      <l-icon name="star" :size="16" :tone="favIds.includes(m.id) ? 'warn' : 'faint'" :fill="favIds.includes(m.id) ? 'currentColor' : 'none'" />
                    </view>
                  </view>
                </template>
              </view>
            </kg-collapse>
          </kg-card>
        </view>
        <kg-button v-if="!hotEnd && hots.length >= 20" variant="secondary" size="md" block class="more" @click="loadMoreMat">加载更多</kg-button>
      </template>

      <!-- 我的笔记 -->
      <template v-else-if="mtype === '我的笔记'">
        <kg-empty-state v-if="!notes.length" icon="square-pen" title="还没有笔记" desc="自己的金句、案例、写作框架记在这里，和素材库放在一起" cta-text="写一条" @cta="openNoteForm()" />
        <view v-else class="mgrid kg-cards">
          <kg-card v-for="n in notes" :key="n.id" class="m-item">
            <view class="q-top">
              <text class="m-topic">{{ n.title || n.topic || '笔记' }}</text>
              <text class="hist-time num">{{ fmtTime(n.updated_at || n.created_at) }}</text>
            </view>
            <text v-if="n.topic && n.title" class="note-topic">{{ n.topic }}</text>
            <text class="m-content">{{ n.content }}</text>
            <view class="m-foot">
              <view class="grow"></view>
              <kg-button variant="text" size="sm" icon="square-pen" @click="openNoteForm(n)">编辑</kg-button>
              <kg-button variant="text" size="sm" @click="delNote(n)">删除</kg-button>
            </view>
          </kg-card>
        </view>
      </template>

      <kg-empty-state
        v-else-if="!shownMats.length"
        icon="book-open"
        :title="favOnly ? '还没有收藏素材' : '暂无素材'"
        :desc="favOnly ? '点素材右上角星标收藏，方便写作时随手翻' : '换个类型看看，金句/案例/范文陆续补充'"
        :cta-text="favOnly || mtype !== '全部' ? '查看全部素材' : ''"
        @cta="setMtype('全部')"
      />
      <template v-else>
        <view class="mgrid kg-cards">
          <kg-card v-for="m in shownMats" :key="m.id" class="m-item">
            <view class="q-top">
              <view class="q-tags">
                <text class="m-topic">{{ m.topic }}</text>
                <kg-tag v-if="m.id === hitMid" tone="warn">搜索命中</kg-tag>
              </view>
              <view class="q-top-r">
                <kg-tag tone="neutral">{{ m.type }}</kg-tag>
                <view class="star-btn" role="button" :aria-label="favIds.includes(m.id) ? '取消收藏' : '收藏素材'" @click="toggleFav(m)">
                  <l-icon name="star" :size="20" :tone="favIds.includes(m.id) ? 'warn' : 'faint'" :fill="favIds.includes(m.id) ? 'currentColor' : 'none'" />
                </view>
              </view>
            </view>
            <text class="m-content" :class="{ ellip3: expanded !== m.id }" @click="expanded = expanded === m.id ? 0 : m.id">{{ m.content }}</text>
            <view class="m-foot">
              <text v-if="m.source" class="m-src ellip">出处：{{ m.source }}</text>
              <view class="grow"></view>
              <kg-button variant="text" size="sm" icon="copy" :aria-label="'复制素材链接：' + m.topic" @click="copyMatLink(m)">复制链接</kg-button>
            </view>
          </kg-card>
        </view>
        <kg-button v-if="!favOnly && !mEnd && mats.length >= 20" variant="secondary" size="md" block class="more" @click="loadMoreMat">加载更多</kg-button>
      </template>
    </template>

    <!-- 作答记录 -->
    <template v-if="tab === 'r'">
      <kg-skeleton v-if="recLoading" preset="cards" />
      <kg-empty-state
        v-else-if="rErr"
        icon="wifi-off"
        :title="'加载失败：' + rErr"
        cta-text="重试"
        @cta="loadRecs()"
      />
      <kg-empty-state
        v-else-if="!recs.length"
        icon="square-pen"
        title="还没有作答记录"
        desc="去题库作答并提交 AI 批改后，作答与批改结果会自动保存在这里"
        cta-text="去题库作答"
        @cta="tapQ"
      />
      <view v-else class="rgrid kg-cards">
        <kg-card v-for="r in recs" :key="r.id" class="r-item" clickable @click="openRec(r)">
          <view class="q-top">
            <text class="hist-time num">{{ fmtTime(r.created_at) }}</text>
            <kg-tag tone="brand">{{ r.qtype || '申论' }}</kg-tag>
          </view>
          <text class="q-text link" role="link" @click.stop="openRec(r)">{{ r.question || '（题目已下线）' }}</text>
          <text class="m-content" :class="{ ellip3: expanded !== 'r' + r.id }" @click.stop="expanded = expanded === 'r' + r.id ? 0 : 'r' + r.id">{{ '【我的作答】\n' + r.answer + (r.result ? '\n\n【批改结果】\n' + r.result : '') }}</text>
          <text class="rec-cta">点卡片还原「材料 + 作答 + 批改」完整界面 ›</text>
        </kg-card>
      </view>
    </template>

    <!-- 写/编辑笔记 -->
    <kg-sheet v-model="noteForm.open" :title="noteForm.id ? '编辑笔记' : '写笔记'">
      <view class="note-form">
        <text class="sheet-k">主题（选填）</text>
        <input v-model="noteForm.topic" class="note-input" placeholder="如：基层治理" maxlength="60" />
        <text class="sheet-k">标题（选填）</text>
        <input v-model="noteForm.title" class="note-input" placeholder="如：万能开头句式" maxlength="60" />
        <text class="sheet-k">内容</text>
        <textarea v-model="noteForm.content" class="note-ta" placeholder="自己的金句、案例、框架…" maxlength="3000" />
        <kg-button variant="primary" size="lg" block :disabled="noteSaving" :loading="noteSaving" @click="saveNote">{{ noteSaving ? '保存中…' : '保存' }}</kg-button>
      </view>
    </kg-sheet>

    <kg-confirm-sheet
      :model-value="!!delNoteTarget"
      title="删除这条笔记？"
      desc="删除后不可恢复"
      confirm-text="删除笔记"
      cancel-text="留着"
      danger
      @confirm="confirmDelNote"
      @cancel="delNoteTarget = null"
    />
    <kg-undo-bar />
  </view>
</template>

<script>
import { fmtYMDHM } from '../../utils/fmt.js';
import { request, anonUid, snapPeek, hasAccessCode, fetchAccessInfo, promptAccessCode, getAuthUser, trackEvent } from '../../api/api.js';
import { buildShenlunUrl, buildShenlunFilterUrl, buildShenlunTabUrl, buildShenlunMatUrl } from '../../shenlun/shenlun-url.js';
import { toggleQFav as qfavToggle, missingSnapIds, mergeQFavSync } from '../../shenlun/shenlun-qfav.js';
import { qNavState } from '../../shenlun/shenlun-qnav.js';
import { parseWordLimit, wordState } from '../../shenlun/shenlun-words.js';
import { adoptServerDraft } from '../../shenlun/shenlun-draft.js';
import { segResizeMixin } from '../../utils/seg-resize.js';
import { withBasePath } from '../../utils/hash-url.js';
import { toastOk, toastInfo, toastErrFrom, showUndoToast, dismissUndoToast } from '../../utils/toast.js';

const QTYPES = ['全部', '归纳概括', '综合分析', '提出对策', '贯彻执行', '大作文'];
const MTYPES = ['全部', '热点', '金句', '案例', '政策理论', '范文', '我的笔记'];
const TABS = [
  { label: '真题题库', value: 'q' },
  { label: '素材/范文', value: 'm' },
  { label: '作答记录', value: 'r' },
];

export default {
  mixins: [segResizeMixin],
  data() {
    return {
      QTYPES,
      MTYPES,
      tab: 'q',
      qtype: '全部',
      mtype: '全部',
      qs: [],
      mats: [],
      detail: null,
      showMat: true,
      showRef: false,
      expanded: 0,
      loading: false,
      qErr: '',
      mErr: '',
      rErr: '',
      myAnswer: '',
      grading: false,
      gradeResult: '',
      history: [],
      showHist: false,
      recs: [],
      recLoading: false,
      pinMid: 0,
      hitMid: 0,
      hots: [],
      hotEnd: false,
      hOffset: 0,
      hotOthers: {},
      notes: [],
      noteForm: { open: false, id: 0, topic: '', title: '', content: '' },
      noteSaving: false,
      delNoteTarget: null,
      navDir: 'fade',
      favOnly: false,
      favIds: uni.getStorageSync('slMatFavIds') || [],
      favMats: uni.getStorageSync('slMatFavs') || [],
      favSynced: false,
      qOffset: 0,
      mOffset: 0,
      qEnd: false,
      mEnd: false,
      qTotal: 0,
      authed: !!getAuthUser(),
      qFavIds: uni.getStorageSync('slQFavIds') || [],
      qFavs: uni.getStorageSync('slQFavs') || [],
      qFavOnly: false,
      years: [],
      regions: [],
      year: 0,
      region: '',
      paper: '',
      fltOpen: false,
      splitH: 0,
    };
  },
  watch: {
    detail(v) {
      // #ifdef H5
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(window.history.state, '', withBasePath(v && v.id ? buildShenlunUrl(v.id) : this.filterUrl()));
      }
      // #endif
      if (v) this.measureSplit();
      else this.splitH = 0;
    },
  },
  computed: {
    tabOpts() {
      return TABS.map((t) => t.label);
    },
    tabLabel() {
      return (TABS.find((t) => t.value === this.tab) || TABS[0]).label;
    },
    qtypeChips() {
      return QTYPES.map((t, i) => ({ label: t === '全部' ? '全部题型' : t, value: i }));
    },
    mtypeChips() {
      return MTYPES.map((t, i) => ({ label: t, value: i }));
    },
    yearChips() {
      return [{ label: '全部', value: 0 }].concat(this.years.map((y) => ({ label: String(y), value: y })));
    },
    shownMats() {
      return this.favOnly ? this.favMats : this.mats;
    },
    shownQs() {
      return this.qFavOnly ? this.qFavs : this.qs;
    },
    fltCount() {
      return (this.year ? 1 : 0) + (this.region ? 1 : 0);
    },
    qNav() {
      return qNavState(this.shownQs.map((q) => q && q.id), this.detail ? this.detail.id : 0);
    },
    qWordLim() {
      return this.detail ? parseWordLimit(this.detail.question) : null;
    },
    qWordSt() {
      return wordState(this.myAnswer.length, this.qWordLim);
    },
    showSyncTip() {
      return !this.authed && (Boolean(this.gradeResult) || (this.myAnswer && this.myAnswer.trim().length >= 30));
    },
  },
  onShow() {
    this.authed = !!getAuthUser();
    // #ifdef H5
    if (!this._slKeyHandler && typeof window !== 'undefined') {
      this._slKeyHandler = (e) => this.onSlKeydown(e);
      window.addEventListener('keydown', this._slKeyHandler);
    }
    // #endif
  },
  onHide() {
    this.flushDraft();
    // #ifdef H5
    if (this._slKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._slKeyHandler);
      this._slKeyHandler = null;
    }
    // #endif
  },
  onUnload() {
    this._unmounted = true;
    dismissUndoToast(true);
    this.flushDraft();
    // #ifdef H5
    if (this._slKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._slKeyHandler);
      this._slKeyHandler = null;
    }
    // #endif
  },
  onResize() {
    if (this.detail) this.measureSplit();
  },
  onLoad(opts) {
    const tab = (opts && opts.tab) || 'q';
    if (opts && typeof opts.paper === 'string' && opts.paper && opts.paper.length <= 100) this.paper = opts.paper;
    this.loadFilters().then(() => {
      if (!opts || tab !== 'q' || this.qFavOnly || !(opts.year || opts.region)) return;
      const y = Number(opts.year || '');
      if (this.years.includes(y)) this.year = y;
      if (this.regions.includes(opts.region || '')) this.region = opts.region;
      this.qOffset = 0;
      this.qEnd = false;
      this.syncFilterUrl();
      this.loadQs();
    });
    if (tab === 'r') this.switchRec();
    else if (tab === 'm') {
      if (MTYPES.includes(opts.mtype || '')) this.mtype = opts.mtype;
      if (/^\d+$/.test(opts.mid || '')) this.pinMid = Number(opts.mid);
      else if (opts.fav === '1') this.favOnly = true;
      this.switchMat();
    } else {
      if (opts && QTYPES.includes(opts.qtype || '')) this.qtype = opts.qtype;
      if (opts && opts.fav === '1') this.enterQFavView();
      else if (!(opts && (opts.year || opts.region))) this.loadQs();
    }
    if (opts && /^\d+$/.test(opts.id || '')) this.openQ(Number(opts.id));
    this.syncQFavs();
  },
  methods: {
    async loadQs(append) {
      const seq = (this._qSeq = (this._qSeq || 0) + 1);
      this.loading = !append;
      this.qErr = '';
      try {
        const t = this.qtype === '全部' ? '' : '&qtype=' + encodeURIComponent(this.qtype);
        const y = this.year ? '&year=' + this.year : '';
        const rg = this.region ? '&region=' + encodeURIComponent(this.region) : '';
        const pp = this.paper ? '&paper=' + encodeURIComponent(this.paper) : '';
        const d = await request('/api/shenlun/questions?limit=20&offset=' + this.qOffset + t + y + rg + pp);
        if (seq !== this._qSeq) return;
        const items = d.items || [];
        this.qEnd = items.length < 20;
        this.qTotal = d.total || items.length;
        this.qs = append ? this.qs.concat(items) : items;
      } catch (e) {
        if (seq !== this._qSeq) return;
        this.qErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      if (seq === this._qSeq) this.loading = false;
    },
    async loadMats(append) {
      if (this.mtype === '热点') return this.loadHots(append);
      if (this.mtype === '我的笔记') return this.loadNotes();
      this.loading = !append;
      this.mErr = '';
      try {
        const t = this.mtype === '全部' ? '' : '&type=' + encodeURIComponent(this.mtype);
        const d = await request('/api/shenlun/materials?limit=20&offset=' + this.mOffset + t);
        const items = d.items || [];
        this.mEnd = items.length < 20;
        this.mats = append ? this.mats.concat(items) : items;
        if (!append && this.pinMid) {
          const midv = this.pinMid;
          this.pinMid = 0;
          let hit = this.mats.find((m) => m.id === midv);
          if (!hit) {
            try {
              const r = await request('/api/shenlun/materials?id=' + midv);
              hit = (r.items || [])[0];
            } catch (e2) {
              /* 深链命中拉取失败不阻断列表 */
            }
          }
          if (hit) {
            this.mats = [hit].concat(this.mats.filter((m) => m.id !== midv));
            this.hitMid = midv;
            this.expanded = midv;
          }
        }
      } catch (e) {
        this.mErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async loadFilters() {
      try {
        const d = await request('/api/shenlun/filters');
        this.years = d.years || [];
        this.regions = d.regions || [];
      } catch (e) {
        /* 筛选项加载失败不阻断列表 */
      }
    },
    setYear(y) {
      this.qFavOnly = false;
      this.year = y;
      this.qOffset = 0;
      this.qEnd = false;
      this.detail = null;
      this.syncFilterUrl();
      this.loadQs();
    },
    clearPaper() {
      this.applyPaper('');
    },
    applyPaper(p) {
      const next = typeof p === 'string' && p.length <= 100 ? p : '';
      if (next === this.paper) return;
      this.qFavOnly = false;
      this.paper = next;
      this.qOffset = 0;
      this.qEnd = false;
      this.syncFilterUrl();
      this.loadQs();
    },
    filterUrl() {
      if (this.tab !== 'q') return buildShenlunTabUrl(this.tab, this.mtype, this.favOnly);
      return buildShenlunFilterUrl({ paper: this.paper, qtype: this.qtype, year: this.year, region: this.region, fav: this.qFavOnly });
    },
    syncFilterUrl() {
      // #ifdef H5
      if (!this._unmounted && typeof window !== 'undefined' && window.history && !this.detail) {
        window.history.replaceState(window.history.state, '', withBasePath(this.filterUrl()));
      }
      // #endif
    },
    onTabChange(opt) {
      const label = opt && typeof opt === 'object' ? opt.value : opt;
      const t = TABS.find((x) => x.label === label);
      if (!t || t.value === this.tab) return;
      if (t.value === 'q') this.tapQ();
      else if (t.value === 'm') this.tapMat();
      else this.tapRec();
    },
    onRegionChange({ value }) {
      this.setRegion(value || '');
    },
    tapQ() {
      this.tab = 'q';
      this.syncFilterUrl();
    },
    tapMat() {
      this.detail = null;
      this.switchMat();
      this.syncFilterUrl();
    },
    tapRec() {
      this.detail = null;
      this.switchRec();
      this.syncFilterUrl();
    },
    clearFlt() {
      this.qFavOnly = false;
      this.qtype = '全部';
      this.year = 0;
      this.region = '';
      this.paper = '';
      this.syncFilterUrl();
      this.qOffset = 0;
      this.qEnd = false;
      this.loadQs();
    },
    setRegion(r) {
      this.qFavOnly = false;
      this.region = r;
      this.qOffset = 0;
      this.qEnd = false;
      this.detail = null;
      this.syncFilterUrl();
      this.loadQs();
    },
    switchMat() {
      this.tab = 'm';
      const empty = this.mtype === '热点' ? !this.hots.length : this.mtype === '我的笔记' ? !this.notes.length : !this.mats.length;
      if (empty) this.loadMats();
      if (!this.favSynced) {
        this.favSynced = true;
        this.syncFavs();
      }
    },
    async switchRec() {
      this.tab = 'r';
      const uid = anonUid();
      if (!uid) {
        this.recs = [];
        return;
      }
      this.rErr = '';
      const p = '/api/shenlun/history?limit=50&uid=' + encodeURIComponent(uid);

      // 快照即显：uid API 长尾下先用最近成功快照铺屏，真实响应到达后覆盖
      const snap = snapPeek(p);
      if (snap) this.recs = snap.items || [];
      this.recLoading = !snap;

      try {
        const d = await request(p);
        this.recs = d.items || [];
      } catch (e) {
        this.rErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.recLoading = false;
    },
    setQtype(t) {
      this.qFavOnly = false;
      this.qtype = t;
      this.qOffset = 0;
      this.qEnd = false;
      this.detail = null;
      this.syncFilterUrl();
      this.loadQs();
    },
    qMeta(text) {
      const s = String(text || '');
      const score = (s.match(/(\d+)\s*分/) || [])[1];
      const words = (s.match(/不超过\s*(\d+)\s*字/) || [])[1];
      const parts = [];
      if (score) parts.push(score + ' 分');
      if (words) parts.push('≤' + words + ' 字');
      return parts.join(' · ');
    },
    toggleQFav(q) {
      const r = qfavToggle({ ids: this.qFavIds, snaps: this.qFavs }, q);
      this.qFavIds = r.ids;
      this.qFavs = r.snaps;
      uni.setStorageSync('slQFavIds', this.qFavIds);
      uni.setStorageSync('slQFavs', this.qFavs);
      const uid = anonUid();
      if (uid) request('/api/shenlun/qfavs', { method: 'POST', data: { uid, qid: q.id, on: r.added } }).catch(() => {});
      if (!r.added) showUndoToast({ text: '已取消收藏题目', onUndo: () => { if (!this.qFavIds.includes(Number(q && q.id))) this.toggleQFav(q); } });
      else {
        dismissUndoToast(false);
        toastOk('已收藏题目');
      }
    },
    async syncQFavs() {
      const uid = anonUid();
      if (!uid) return;
      try {
        const d = await request('/api/shenlun/qfavs?uid=' + encodeURIComponent(uid));
        const r = mergeQFavSync({ ids: this.qFavIds, snaps: this.qFavs }, d);
        for (const id of r.pushIds) {
          request('/api/shenlun/qfavs', { method: 'POST', data: { uid, qid: id, on: true } }).catch(() => {});
        }
        this.qFavIds = r.ids;
        this.qFavs = r.snaps;
        uni.setStorageSync('slQFavIds', this.qFavIds);
        uni.setStorageSync('slQFavs', this.qFavs);
      } catch (e) { /* 非关键路径 */ }
    },
    toggleQFavOnly() {
      if (this.qFavOnly) this.qFavOnly = false;
      else this.enterQFavView();
      this.syncFilterUrl();
    },
    enterQFavView() {
      this.qFavOnly = true;
      this.detail = null;
      for (const id of missingSnapIds(this.qFavIds, this.qFavs).slice(0, 20)) {
        request('/api/shenlun/questions/' + id)
          .then((d) => {
            const it = d && d.item;
            if (it && !this.qFavs.some((x) => x && x.id === it.id)) {
              this.qFavs = this.qFavs.concat([{ id: it.id, qtype: it.qtype, paper: it.paper, exam_year: it.exam_year, exam_region: it.exam_region, question: it.question }]);
              uni.setStorageSync('slQFavs', this.qFavs);
            }
          })
          .catch(() => {});
      }
    },
    toggleFav(m) {
      const i = this.favIds.indexOf(m.id);
      const on = i < 0;
      if (on) {
        this.favIds.push(m.id);
        this.favMats.unshift(m);
      } else {
        this.favIds.splice(i, 1);
        this.favMats = this.favMats.filter((x) => x.id !== m.id);
      }
      uni.setStorageSync('slMatFavIds', this.favIds);
      uni.setStorageSync('slMatFavs', this.favMats);
      const uid = anonUid();
      if (uid) request('/api/shenlun/mat_favs', { method: 'POST', data: { uid, mid: m.id, on } }).catch(() => {});
      if (!on) showUndoToast({ text: '已取消收藏素材', onUndo: () => { if (!this.favIds.includes(m.id)) this.toggleFav(m); } });
      else {
        dismissUndoToast(false);
        toastOk('已收藏素材');
      }
    },
    async syncFavs() {
      const uid = anonUid();
      if (!uid) return;
      try {
        const d = await request('/api/shenlun/mat_favs?uid=' + encodeURIComponent(uid));
        const serverIds = d.ids || [];
        const localOnly = this.favIds.filter((id) => !serverIds.includes(id));
        for (const id of localOnly) {
          request('/api/shenlun/mat_favs', { method: 'POST', data: { uid, mid: id, on: true } }).catch(() => {});
        }
        const merged = (d.items || []).filter((x) => !localOnly.includes(x.id));
        this.favMats = [...this.favMats.filter((x) => localOnly.includes(x.id)), ...merged];
        this.favIds = this.favMats.map((x) => x.id);
        uni.setStorageSync('slMatFavIds', this.favIds);
        uni.setStorageSync('slMatFavs', this.favMats);
      } catch (e) { /* 非关键路径 */ }
    },
    toggleFavOnly() {
      this.favOnly = !this.favOnly;
      this.syncFilterUrl();
    },
    setMtype(t) {
      this.favOnly = false;
      this.mtype = t;
      this.mOffset = 0;
      this.mEnd = false;
      this.hOffset = 0;
      this.hotEnd = false;
      this.syncFilterUrl();
      this.loadMats();
    },
    loadMore() {
      this.qOffset += 20;
      this.loadQs(true);
    },
    loadMoreMat() {
      if (this.mtype === '热点') {
        this.hOffset += 20;
        this.loadHots(true);
        return;
      }
      if (this.mtype === '我的笔记') return;
      this.mOffset += 20;
      this.loadMats(true);
    },
    // ---------- 热点三段式 ----------
    hotSegRows(g) {
      return ['内涵', '角度', '金句'].map((name) => ({ name, items: (g.segs && g.segs[name]) || [] })).filter((r) => r.items.length);
    },
    async loadHots(append) {
      this.loading = !append;
      this.mErr = '';
      try {
        const d = await request('/api/shenlun/hotspots?limit=20&offset=' + this.hOffset);
        const items = d.items || [];
        this.hotEnd = items.length < 20;
        this.hots = append ? this.hots.concat(items) : items;
      } catch (e) {
        this.mErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    // ---------- 我的笔记 ----------
    async loadNotes() {
      this.loading = true;
      this.mErr = '';
      try {
        const uid = anonUid();
        const d = await request('/api/shenlun/notes?uid=' + encodeURIComponent(uid));
        this.notes = d.items || [];
      } catch (e) {
        this.mErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    openNoteForm(n) {
      this.noteForm = n
        ? { open: true, id: n.id, topic: n.topic || '', title: n.title || '', content: n.content }
        : { open: true, id: 0, topic: '', title: '', content: '' };
    },
    async saveNote() {
      const f = this.noteForm;
      if (this.noteSaving) return;
      if (!f.content.trim()) {
        toastInfo('请填写笔记内容');
        return;
      }
      this.noteSaving = true;
      try {
        const uid = anonUid();
        await request('/api/shenlun/notes', {
          method: 'POST',
          data: { uid, id: f.id || undefined, topic: f.topic, title: f.title, content: f.content },
        });
        this.noteForm.open = false;
        this.loadNotes();
        toastOk('笔记已保存');
      } catch (e) {
        toastErrFrom(e, '保存失败，请稍后重试');
      } finally {
        this.noteSaving = false;
      }
    },
    delNote(n) {
      this.delNoteTarget = n;
    },
    async confirmDelNote() {
      const n = this.delNoteTarget;
      this.delNoteTarget = null;
      if (!n) return;
      try {
        const uid = anonUid();
        await request('/api/shenlun/notes/delete', { method: 'POST', data: { uid, id: n.id } });
        this.loadNotes();
        toastOk('笔记已删除');
      } catch (e) {
        toastErrFrom(e, '删除失败，请稍后重试');
      }
    },
    // #ifdef H5
    onSlKeydown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (this.delNoteTarget) {
        if (e.key === 'Escape') this.delNoteTarget = null;
        return;
      }
      if (this.tab !== 'q' || !this.detail) return;
      if (e.key === 'ArrowLeft' && this.qNav.prevId) { e.preventDefault(); this.openQ(this.qNav.prevId, 'prev'); }
      else if (e.key === 'ArrowRight' && this.qNav.nextId) { e.preventDefault(); this.openQ(this.qNav.nextId, 'next'); }
    },
    // #endif
    // ≥768 双栏独立滚动：量出分栏顶部到视口底的高度，交给两列 scroll-view
    measureSplit() {
      const win = (uni.getSystemInfoSync && uni.getSystemInfoSync()) || {};
      if ((win.windowWidth || 0) < 768) {
        this.splitH = 0;
        return;
      }
      this.$nextTick(() => {
        uni.createSelectorQuery()
          .in(this)
          .select('.d-cols')
          .boundingClientRect((r) => {
            const top = r && r.top != null ? r.top : 0;
            const vh = (typeof window !== 'undefined' && window.innerHeight) || win.windowHeight || 700;
            const safeTop = top > 0 ? top : 96;
            this.splitH = Math.max(360, Math.floor(vh - safeTop - 16));
          })
          .exec();
      });
    },
    async openQ(id, dir = 'fade') {
      if (this.detail && this.detail.id && this.detail.id !== id) this.flushDraft();
      const seq = (this._openSeq = (this._openSeq || 0) + 1);
      try {
        const d = await request('/api/shenlun/questions/' + id);
        if (seq !== this._openSeq || this._unmounted) return;
        this.navDir = dir;
        this.detail = d.item;
        this.showMat = true;
        this.showRef = false;
        this.myAnswer = uni.getStorageSync('slDraft:' + id) || '';
        this.syncDraft(id);
        this.gradeResult = '';
        this.history = [];
        this.showHist = false;
        this.loadHistory(id);
        uni.pageScrollTo({ scrollTop: 0, duration: 0 });
      } catch (e) {
        if (seq !== this._openSeq) return;
        toastErrFrom(e, '题目加载失败，请稍后重试');
      }
    },
    // 作答记录直达：还原「材料 + 当次作答 + 批改结果」的完整作答界面（若有未交草稿，还原后支持 4.5s 撤销）
    async openRec(r) {
      if (!r || !r.qid) return;
      const curDraft = (this.detail && this.detail.id === r.qid ? this.myAnswer : uni.getStorageSync('slDraft:' + r.qid)) || '';
      this.tab = 'q';
      await this.openQ(r.qid);
      if (!this.detail || this.detail.id !== r.qid) return;
      const prevRes = this.gradeResult;
      if (r.answer) {
        this.myAnswer = r.answer;
        uni.setStorageSync('slDraft:' + r.qid, r.answer);
      }
      this.gradeResult = r.result || '';
      if (curDraft && curDraft !== r.answer) {
        const qid = r.qid;
        showUndoToast({
          text: '已还原历史作答，原草稿可撤销恢复',
          onUndo: () => {
            uni.setStorageSync('slDraft:' + qid, curDraft);
            if (this.detail && this.detail.id === qid) {
              this.myAnswer = curDraft;
              this.gradeResult = prevRes;
            }
            toastOk('已恢复原草稿');
          },
        });
      } else {
        toastOk('已还原本次作答与批改结果');
      }
    },
    // 同题历史作答：点条目即换回那次作答与批改（若有不同草稿，提供 4.5s 撤销恢复）
    async applyHist(h) {
      if (!h || !this.detail) return;
      const target = h.answer || '';
      const prevDraft = this.myAnswer || '';
      const prevRes = this.gradeResult;
      const qid = this.detail.id;
      if (target) {
        this.myAnswer = target;
        uni.setStorageSync('slDraft:' + qid, target);
      }
      this.gradeResult = h.result || '';
      if (prevDraft && prevDraft !== target) {
        showUndoToast({
          text: '已还原历史作答，原草稿可撤销恢复',
          onUndo: () => {
            uni.setStorageSync('slDraft:' + qid, prevDraft);
            if (this.detail && this.detail.id === qid) {
              this.myAnswer = prevDraft;
              this.gradeResult = prevRes;
            }
            toastOk('已恢复原草稿');
          },
        });
      } else {
        toastOk('已还原这次作答与批改');
      }
    },
    copyQLink() {
      if (!this.detail) return;
      const url = (typeof window !== 'undefined' ? window.location.origin : '') + buildShenlunUrl(this.detail.id);
      uni.setClipboardData({ data: url, success: () => toastOk('链接已复制，发给考友直达本题') });
    },
    copyMatLink(m) {
      const url = (typeof window !== 'undefined' ? window.location.origin : '') + buildShenlunMatUrl(m.id, m.type);
      uni.setClipboardData({ data: url, success: () => toastOk('链接已复制，发给考友直达本条素材') });
    },
    flushDraft() {
      if (this._draftTimer) {
        clearTimeout(this._draftTimer);
        this._draftTimer = null;
        if (this.detail && this.detail.id) this.pushDraft(this.detail.id);
      }
    },
    saveDraft() {
      if (!this.detail) return;
      const k = 'slDraft:' + this.detail.id;
      if (this.myAnswer) uni.setStorageSync(k, this.myAnswer);
      else uni.removeStorageSync(k);
      const qid = this.detail.id;
      clearTimeout(this._draftTimer);
      this._draftTimer = setTimeout(() => this.pushDraft(qid), 1500);
    },
    pushDraft(qid, content) {
      const uid = anonUid();
      if (!uid) return;
      const c = content !== undefined ? content : (this.detail && this.detail.id === qid ? this.myAnswer : uni.getStorageSync('slDraft:' + qid) || '');
      request('/api/shenlun/draft', { method: 'POST', data: { uid, qid, content: c } }).catch(() => {});
    },
    async syncDraft(id) {
      const uid = anonUid();
      if (!uid) return;
      try {
        const d = await request('/api/shenlun/draft?uid=' + encodeURIComponent(uid) + '&qid=' + id);
        if (!this.detail || this.detail.id !== id) return;
        const adopted = adoptServerDraft(this.myAnswer, d);
        if (adopted !== null) {
          this.myAnswer = adopted;
          uni.setStorageSync('slDraft:' + id, adopted);
        }
      } catch (e) { /* 非关键路径 */ }
    },
    async loadHistory(id) {
      const uid = anonUid();
      if (!uid) return;
      try {
        const d = await request('/api/shenlun/history?qid=' + id + '&uid=' + encodeURIComponent(uid));
        if (this.detail && this.detail.id === id) this.history = d.items || [];
      } catch (e) {
        /* 历史加载失败不阻断 */
      }
    },
    fmtTime(ts) {
      return fmtYMDHM(ts);
    },
    goSyncLogin() {
      trackEvent('login_nudge_click', 'shenlun_sync');
      uni.navigateTo({ url: '/pkgA/user/login' });
    },
    async grade() {
      const qid = this.detail && this.detail.id;
      const ans = (this.myAnswer || '').trim();
      if (!qid || this.grading || !ans) return;
      // AI 批改需访问码（内测）：提前提示；取消时草稿保留
      if (!hasAccessCode()) {
        const info = await fetchAccessInfo();
        if (info && info.required) {
          const ok = await promptAccessCode();
          if (!ok) {
            uni.showToast({ title: '已取消，作答内容已保留为草稿', icon: 'none' });
            this.saveDraft();
            return;
          }
        }
      }
      this.grading = true;
      this.gradeResult = '';
      try {
        const d = await request('/api/shenlun/grade', {
          method: 'POST',
          data: { qid, answer: this.myAnswer, uid: anonUid() },
        });
        uni.removeStorageSync('slDraft:' + qid);
        clearTimeout(this._draftTimer);
        this.pushDraft(qid, '');
        if (!this._unmounted && this.detail && this.detail.id === qid) {
          this.gradeResult = d.result;
          this.loadHistory(qid);
        } else if (!this._unmounted) {
          toastOk('AI 批改已完成，可前往「作答记录」查看');
        }
      } catch (e) {
        toastErrFrom(e, '批改失败，请稍后重试');
      }
      this.grading = false;
    },
  },
};
</script>

<style scoped>
.page { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.page.is-detail { padding-bottom: var(--sp-16); }
.seg { margin-bottom: var(--sp-12); }
.chips { margin-bottom: var(--sp-12); }
.grow { flex: 1; min-width: 0; }
.fltbar { display: flex; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-12); flex-wrap: wrap; }
.fltbar .chips { flex: 1; min-width: 0; margin-bottom: 0; }
.m-fltbar { flex-direction: column; align-items: stretch; gap: var(--sp-8); }
.m-fltbar .m-chips { width: 100%; flex: none; }
.m-flt-act { display: flex; justify-content: flex-end; }
@media (min-width: 768px) {
  .m-fltbar { flex-direction: row; align-items: center; }
  .m-fltbar .m-chips { flex: 1; width: auto; min-width: 0; }
}
/* kg-tag 内部 .kg-tag__t 已自带单行省略；外层不再加 overflow:hidden 以免裁剪 .tappable::after 热区 */
.paper-tag { max-width: 60%; }
.tappable { cursor: pointer; position: relative; }
.tappable::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 40px; transform: translateY(-50%); }
.more { margin-top: var(--sp-8); }
.back { margin-bottom: var(--sp-8); align-self: flex-start; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ellip3 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }

.sheet-body { padding-bottom: var(--sp-8); }
.sheet-k { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin: var(--sp-12) 0 var(--sp-8); }
.sheet-foot { display: flex; gap: var(--sp-12); }
.sheet-body :deep(.wd-radio-group) { display: flex; flex-wrap: wrap; gap: var(--sp-8); --wot-radio-label-color: var(--ink); --wot-radio-button-bg: var(--fill); --wot-radio-button-border: var(--line); }

/* 卡间距由全局 .kg-cards 统一提供（gap + 卡外边距清零），勿再叠加兄弟边距 */
.q-top { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); }
.q-tags { display: flex; align-items: center; gap: var(--sp-8); flex: 1; min-width: 0; flex-wrap: wrap; }
.q-top-r { display: flex; align-items: center; gap: var(--sp-4); flex-shrink: 0; }
.q-paper { font-size: var(--fs-caption); color: var(--ink-2); }
.star-btn { width: var(--hit-min); height: var(--hit-min); margin: calc((var(--hit-min) - 20px) / -2) 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: var(--r-full); cursor: pointer; transition: transform var(--dur-instant) var(--ease-standard); }
.star-btn:active { transform: scale(0.9); }
.q-text { display: block; margin-top: var(--sp-8); font-size: var(--fs-body); line-height: var(--lh-question); color: var(--ink); }
.q-text.link { color: var(--brand-text); }
.q-item, .m-item { display: flex; flex-direction: column; }
.q-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); margin-top: auto; padding-top: var(--sp-8); }
.q-meta { font-size: var(--fs-caption); color: var(--ink-3); flex: 1; min-width: 0; }

.d-card { margin-bottom: var(--card-gap); }
.d-h { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); margin-top: var(--sp-12); }
.d-q { display: block; margin-top: var(--sp-8); font-size: var(--fs-body); line-height: var(--lh-question); color: var(--ink); white-space: pre-wrap; }
.d-toggle { display: flex; align-items: center; justify-content: space-between; min-height: var(--hit-min); cursor: pointer; }
.d-toggle .d-h { margin-top: 0; }
.d-toggle.ref .ref-t { color: var(--brand-text); }
.fold-ico { flex-shrink: 0; transition: transform var(--dur-fast) var(--ease-standard); }
.flip { transform: rotate(180deg); }
.d-mat { display: block; font-size: var(--fs-sub); line-height: var(--lh-body); color: var(--ink-2); white-space: pre-wrap; }

/* ≥768 双栏独立滚动；材料卡外壳与头部固定，仅内部 .d-l-body 滚动；窄屏材料区限高内滚，作答区顺接在下方 */
.d-cols { display: flex; flex-direction: column; gap: var(--card-gap); }
.d-col { min-width: 0; }
.d-col-l, .d-col-r { display: flex; flex-direction: column; min-width: 0; }
.d-card-l, .d-card-r { display: flex; flex-direction: column; min-height: 0; flex: 1; margin-bottom: 0; box-sizing: border-box; }
.d-l-hd { flex-shrink: 0; padding-bottom: var(--sp-8); border-bottom: 1px solid var(--line); }
.d-paper { display: block; font-size: var(--fs-sub); font-weight: 500; line-height: var(--lh-sub); color: var(--ink); word-break: break-word; }
.q-meta-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); margin-top: var(--sp-8); flex-wrap: wrap; }
.q-meta-acts { display: flex; align-items: center; gap: var(--sp-4); flex-shrink: 0; }
.d-l-body { flex: 1; min-height: 0; max-height: 52vh; overflow-y: auto; overscroll-behavior: contain; }
.d-l-body .d-h:first-child { margin-top: var(--sp-8); }
.d-ans-body { flex: 1; min-height: 0; }
:deep(.d-l-body .uni-scroll-view),
:deep(.d-ans-body .uni-scroll-view) { overscroll-behavior: contain; }
@media (min-width: 768px) {
  .d-cols { flex-direction: row; align-items: stretch; gap: var(--sp-16); }
  .d-col, .d-col-l, .d-col-r { flex: 1 1 0; }
  .d-card-l, .d-card-r { height: 100%; box-sizing: border-box; }
  .d-l-body { max-height: none; }
}
/* 窄屏单列：作答头吸顶，字数统计滚出材料区后仍可见 */
@media (max-width: 767.9px) {
  .d-ans-h { position: sticky; top: var(--window-top, 0px); z-index: var(--z-sticky); background: var(--card); border-radius: var(--r-md) var(--r-md) 0 0; margin: calc(var(--card-pad, 14px) * -1) calc(var(--card-pad, 14px) * -1) 0; padding: var(--card-pad, 14px) var(--card-pad, 14px) var(--sp-8); }
}

.d-ans-h { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); flex-shrink: 0; }
.d-ans-h .d-h { margin-top: 0; }
.rec-cta { display: block; margin-top: var(--sp-8); font-size: var(--fs-caption); color: var(--brand-text); }
.d-save { font-size: var(--fs-caption); color: var(--ink-3); }
.d-save.near { color: var(--warn-strong); }
.d-save.over { color: var(--bad-strong); font-weight: 600; }
.d-ta { width: 100%; box-sizing: border-box; min-height: 160px; margin-top: var(--sp-8); padding: var(--sp-12); background: var(--fill); border-radius: var(--r-sm); color: var(--ink); font-size: var(--fs-body); line-height: var(--lh-body); }
.grade-btn { margin-top: var(--sp-12); }
.sl-sync { display: flex; align-items: center; gap: var(--sp-8); min-height: 40px; margin-top: var(--sp-8); padding: var(--sp-4) var(--sp-12); border-radius: var(--r-sm); background: var(--brand-soft); box-sizing: border-box; cursor: pointer; }
.sl-sync-t { flex: 1; font-size: var(--fs-caption); color: var(--ink-2); line-height: var(--lh-caption); }
.sl-sync-go { flex-shrink: 0; font-size: var(--fs-caption); font-weight: 600; color: var(--brand-text); }
.d-grade { margin-top: var(--sp-4); }
.g-note { font-size: var(--fs-caption); font-weight: 400; color: var(--ink-3); }
.g-body { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); line-height: var(--lh-body); color: var(--ink); white-space: pre-wrap; }
.hist-item { padding: var(--sp-8) 0; border-top: 1px solid var(--line); cursor: pointer; }
.hist-time { display: block; font-size: var(--fs-caption); color: var(--ink-3); }
.hist-ans { display: block; margin-top: var(--sp-4); font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--ink); white-space: pre-wrap; }
.hist-res { display: block; margin-top: var(--sp-4); font-size: var(--fs-caption); line-height: var(--lh-sub); color: var(--ink-2); white-space: pre-wrap; }
.d-ref, .d-notes { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); line-height: var(--lh-body); color: var(--ink); white-space: pre-wrap; }
.d-notes { color: var(--ink-2); }
.d-nav { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); margin-top: var(--sp-8); }
.d-nav-pos { font-size: var(--fs-sub); color: var(--ink-2); }

.m-topic { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.m-content { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); line-height: var(--lh-body); color: var(--ink); white-space: pre-wrap; }
.m-foot { display: flex; align-items: center; gap: var(--sp-8); margin-top: var(--sp-4); }
.m-src { font-size: var(--fs-caption); color: var(--ink-3); max-width: 60%; }

/* 热点三段式 */
.hot-seg { margin-top: var(--sp-8); }
.hot-seg-name { display: block; font-size: var(--fs-caption); font-weight: var(--fw-semibold); color: var(--brand-text); margin-bottom: var(--sp-4); }
.hot-more { color: var(--ink-3); cursor: pointer; }
.hot-line { display: flex; align-items: flex-start; gap: var(--sp-8); padding: var(--sp-4) 0; }
.hot-line + .hot-line { border-top: 1px solid var(--line); }
.hot-line-t { flex: 1; font-size: var(--fs-sub); line-height: var(--lh-body); color: var(--ink); white-space: pre-wrap; }

/* 我的笔记 */
.note-topic { display: block; margin-top: var(--sp-4); font-size: var(--fs-caption); color: var(--ink-3); }
.note-form { display: flex; flex-direction: column; gap: var(--sp-8); }
.sheet-k { font-size: var(--fs-caption); color: var(--ink-3); }
.note-input { height: var(--input-h); padding: 0 var(--sp-12); border: 1px solid var(--line); border-radius: var(--r-md); font-size: var(--fs-body); color: var(--ink); background: var(--card); box-sizing: border-box; }
.note-ta { width: 100%; box-sizing: border-box; min-height: 100px; padding: var(--sp-8) var(--sp-12); border: 1px solid var(--line); border-radius: var(--r-md); font-size: var(--fs-body); line-height: var(--lh-body); color: var(--ink); background: var(--card); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .page { max-width: 720px; margin: 0 auto; }
  .qgrid, .mgrid, .rgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; }
}
@media (min-width: 1024px) {
  .page { max-width: 1064px; margin: 0 auto; }
  .d-ta { min-height: 320px; }
  .hist-item:hover { background: var(--fill); }
}
/* #endif */
</style>
