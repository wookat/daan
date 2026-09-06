<template>
  <view class="page">
    <wd-segmented :value="tabLabel" :options="tabOpts" class="seg" @change="onTabChange" />

    <!-- 真题列表 -->
    <template v-if="tab === 'q' && !detail">
      <kg-chip-row :model-value="qFavOnly ? -1 : QTYPES.indexOf(qtype)" :options="qtypeChips" class="chips" @update:model-value="setQtype(QTYPES[$event])" />
      <view class="fltbar">
        <kg-tag v-if="paper" tone="brand" class="paper-tag" role="button" :aria-label="'清除套卷筛选：' + paper" @click="clearPaper">{{ paper }} ✕</kg-tag>
        <kg-button variant="secondary" size="sm" icon="chevron-down" :tone="region ? 'brand' : undefined" @click="fltOpen = true">{{ region || '地区' }}</kg-button>
        <kg-button variant="secondary" size="sm" icon="chevron-down" :tone="year ? 'brand' : undefined" @click="fltOpen = true">{{ year || '年份' }}</kg-button>
        <kg-button variant="secondary" size="sm" icon="star" :tone="qFavOnly ? 'brand' : undefined" :aria-pressed="qFavOnly ? 'true' : 'false'" @click="toggleQFavOnly">收藏{{ qFavIds.length ? ' ' + qFavIds.length : '' }}</kg-button>
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
        :cta-text="qFavOnly || fltCount || qtype !== '全部' ? '查看全部真题' : ''"
        @cta="clearFlt"
      />
      <view v-else class="qgrid">
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

    <!-- 真题详情 / 作答 -->
    <template v-if="tab === 'q' && detail">
      <kg-button variant="text" size="sm" icon="chevron-left" class="back" @click="detail = null">返回列表</kg-button>
      <kg-two-col>
        <template #main>
          <kg-card class="d-card">
            <view class="q-top">
              <text class="q-paper">{{ detail.paper || (detail.exam_year + ' · ' + (detail.exam_region || '')) }}</text>
              <view class="q-top-r">
                <kg-tag tone="brand">{{ detail.qtype }}</kg-tag>
                <view class="star-btn" role="button" :aria-label="qFavIds.includes(detail.id) ? '取消收藏本题' : '收藏本题'" @click="toggleQFav(detail)">
                  <l-icon name="star" :size="20" :tone="qFavIds.includes(detail.id) ? 'warn' : 'faint'" :fill="qFavIds.includes(detail.id) ? 'currentColor' : 'none'" />
                </view>
                <kg-button variant="text" size="sm" icon="copy" aria-label="复制本题链接" @click="copyQLink">复制链接</kg-button>
              </view>
            </view>
            <text class="d-h">作答要求</text>
            <text class="d-q">{{ detail.question }}</text>
            <view class="d-toggle" role="button" :aria-expanded="showMat ? 'true' : 'false'" @click="showMat = !showMat">
              <text class="d-h">给定资料</text>
              <l-icon name="chevron-down" :size="20" tone="muted" :class="{ flip: showMat }" />
            </view>
            <text v-if="showMat" class="d-mat">{{ detail.material }}</text>
          </kg-card>
          <view v-if="qNav.idx >= 0 && qNav.total > 1" class="d-nav">
            <kg-button variant="ghost" size="md" icon="chevron-left" :disabled="!qNav.prevId" aria-label="上一题" @click="qNav.prevId && openQ(qNav.prevId)">上一题</kg-button>
            <text class="d-nav-pos num">{{ qNav.idx + 1 }} / {{ qNav.total }}</text>
            <kg-button variant="ghost" size="md" :disabled="!qNav.nextId" aria-label="下一题" @click="qNav.nextId && openQ(qNav.nextId)">下一题</kg-button>
          </view>
        </template>
        <template #aside>
          <kg-card class="d-card">
            <view class="d-ans-h">
              <text class="d-h">我的作答</text>
              <text v-if="qWordLim" class="d-save num" :class="qWordSt">{{ myAnswer ? (myAnswer.length + ' / 限' + qWordLim.label + (qWordSt === 'over' ? '，已超 ' + (myAnswer.length - qWordLim.max) + ' 字' : '')) : '限' + qWordLim.label }}</text>
              <text v-else-if="myAnswer" class="d-save">已自动保存 · <text class="num">{{ myAnswer.length }}</text> 字</text>
            </view>
            <textarea v-model="myAnswer" class="d-ta" :maxlength="3000" placeholder="在此作答后点击下方按钮，AI 按采分点批改（大作文为结构点评+参考档位）。草稿自动保存，换设备可续写" placeholder-style="color: var(--ink-4)" auto-height @input="saveDraft" />
            <kg-button variant="primary" size="lg" block :disabled="grading || !myAnswer.trim()" :loading="grading" class="grade-btn" @click="grade">{{ grading ? 'AI 批改中…' : '提交 AI 批改' }}</kg-button>
            <view v-if="gradeResult" class="d-grade">
              <text class="d-h">批改结果<text class="g-note">（AI 参考，非官方评分）</text></text>
              <text class="g-body">{{ gradeResult }}</text>
            </view>
            <view v-if="history.length" class="d-toggle" role="button" :aria-expanded="showHist ? 'true' : 'false'" @click="showHist = !showHist">
              <text class="d-h">历史作答（{{ history.length }}）</text>
              <l-icon name="chevron-down" :size="20" tone="muted" :class="{ flip: showHist }" />
            </view>
            <view v-if="showHist">
              <view v-for="h in history" :key="h.id" class="hist-item">
                <text class="hist-time num">{{ fmtTime(h.created_at) }}</text>
                <text class="hist-ans">{{ h.answer }}</text>
                <text v-if="h.result" class="hist-res">{{ h.result }}</text>
              </view>
            </view>
            <view class="d-toggle ref" role="button" :aria-expanded="showRef ? 'true' : 'false'" @click="showRef = !showRef">
              <text class="d-h ref-t">{{ showRef ? '收起参考要点' : '写完再看 · 参考要点' }}</text>
              <l-icon name="chevron-down" :size="20" tone="brand-text" :class="{ flip: showRef }" />
            </view>
            <text v-if="showRef" class="d-ref">{{ detail.reference }}</text>
            <text v-if="showRef && detail.notes" class="d-notes">{{ detail.notes }}</text>
          </kg-card>
        </template>
      </kg-two-col>
    </template>

    <!-- 素材/范文 -->
    <template v-if="tab === 'm'">
      <view class="fltbar">
        <kg-chip-row :model-value="favOnly ? -1 : MTYPES.indexOf(mtype)" :options="mtypeChips" class="chips grow" @update:model-value="setMtype(MTYPES[$event])" />
        <kg-button variant="secondary" size="sm" icon="star" :tone="favOnly ? 'brand' : undefined" :aria-pressed="favOnly ? 'true' : 'false'" @click="toggleFavOnly">收藏{{ favIds.length ? ' ' + favIds.length : '' }}</kg-button>
      </view>
      <kg-skeleton v-if="loading" preset="cards" />
      <kg-empty-state
        v-else-if="mErr"
        icon="wifi-off"
        :title="'加载失败：' + mErr"
        cta-text="重试"
        @cta="loadMats()"
      />
      <kg-empty-state
        v-else-if="!shownMats.length"
        icon="book-open"
        :title="favOnly ? '还没有收藏素材' : '暂无素材'"
        :desc="favOnly ? '点素材右上角星标收藏，方便写作时随手翻' : '换个类型看看，金句/案例/范文陆续补充'"
        :cta-text="favOnly || mtype !== '全部' ? '查看全部素材' : ''"
        @cta="setMtype('全部')"
      />
      <view v-else class="mgrid">
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
      <kg-button v-if="!loading && !mErr && !favOnly && !mEnd && mats.length >= 20" variant="secondary" size="md" block class="more" @click="loadMoreMat">加载更多</kg-button>
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
      <view v-else class="rgrid">
        <kg-card v-for="r in recs" :key="r.id" class="r-item">
          <view class="q-top">
            <text class="hist-time num">{{ fmtTime(r.created_at) }}</text>
            <kg-tag tone="brand">{{ r.qtype || '申论' }}</kg-tag>
          </view>
          <text class="q-text link" role="link" @click="openQ(r.qid); tab = 'q'">{{ r.question || '（题目已下线）' }}</text>
          <text class="m-content" :class="{ ellip3: expanded !== 'r' + r.id }" @click="expanded = expanded === 'r' + r.id ? 0 : 'r' + r.id">{{ '【我的作答】\n' + r.answer + (r.result ? '\n\n【批改结果】\n' + r.result : '') }}</text>
        </kg-card>
      </view>
    </template>
  </view>
</template>

<script>
import { request, snapPeek, hasAccessCode, fetchAccessInfo, promptAccessCode } from '../../api';
import { buildShenlunUrl, buildShenlunFilterUrl, buildShenlunTabUrl, buildShenlunMatUrl } from '../../shenlun-url.js';
import { toggleQFav as qfavToggle, missingSnapIds, mergeQFavSync } from '../../shenlun-qfav.js';
import { qNavState } from '../../shenlun-qnav.js';
import { parseWordLimit, wordState } from '../../shenlun-words.js';
import { adoptServerDraft } from '../../shenlun-draft.js';

const QTYPES = ['全部', '归纳概括', '综合分析', '提出对策', '贯彻执行', '大作文'];
const MTYPES = ['全部', '金句', '案例', '政策理论', '范文'];
const TABS = [
  { label: '真题题库', value: 'q' },
  { label: '素材/范文', value: 'm' },
  { label: '作答记录', value: 'r' },
];

export default {
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
      favOnly: false,
      favIds: uni.getStorageSync('slMatFavIds') || [],
      favMats: uni.getStorageSync('slMatFavs') || [],
      favSynced: false,
      qOffset: 0,
      mOffset: 0,
      qEnd: false,
      mEnd: false,
      qTotal: 0,
      qFavIds: uni.getStorageSync('slQFavIds') || [],
      qFavs: uni.getStorageSync('slQFavs') || [],
      qFavOnly: false,
      years: [],
      regions: [],
      year: 0,
      region: '',
      paper: '',
      fltOpen: false,
    };
  },
  watch: {
    detail(v) {
      // #ifdef H5
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', v && v.id ? buildShenlunUrl(v.id) : this.filterUrl());
      }
      // #endif
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
  },
  onShow() {
    // #ifdef H5
    if (!this._slKeyHandler && typeof window !== 'undefined') {
      this._slKeyHandler = (e) => this.onSlKeydown(e);
      window.addEventListener('keydown', this._slKeyHandler);
    }
    // #endif
  },
  onHide() {
    // #ifdef H5
    if (this._slKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._slKeyHandler);
      this._slKeyHandler = null;
    }
    // #endif
  },
  onUnload() {
    // #ifdef H5
    if (this._slKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._slKeyHandler);
      this._slKeyHandler = null;
    }
    // #endif
  },
  onLoad(opts) {
    if (opts && typeof opts.paper === 'string' && opts.paper && opts.paper.length <= 100) this.paper = opts.paper;
    this.loadQs();
    this.loadFilters().then(() => {
      if (!opts) return;
      const y = Number(opts.year || '');
      if (this.years.includes(y)) this.setYear(y);
      if (this.regions.includes(opts.region || '')) this.setRegion(opts.region);
    });
    if (opts && opts.tab === 'r') this.switchRec();
    else if (opts && opts.tab === 'm') {
      if (MTYPES.includes(opts.mtype || '')) this.mtype = opts.mtype;
      if (/^\d+$/.test(opts.mid || '')) this.pinMid = Number(opts.mid);
      else if (opts.fav === '1') this.favOnly = true;
      this.switchMat();
    }
    if (opts && QTYPES.includes(opts.qtype || '')) this.setQtype(opts.qtype);
    if (opts && (!opts.tab || opts.tab === 'q') && opts.fav === '1') this.enterQFavView();
    if (opts && /^\d+$/.test(opts.id || '')) this.openQ(Number(opts.id));
    this.syncQFavs();
  },
  methods: {
    async loadQs(append) {
      this.loading = !append;
      this.qErr = '';
      try {
        const t = this.qtype === '全部' ? '' : '&qtype=' + encodeURIComponent(this.qtype);
        const y = this.year ? '&year=' + this.year : '';
        const rg = this.region ? '&region=' + encodeURIComponent(this.region) : '';
        const pp = this.paper ? '&paper=' + encodeURIComponent(this.paper) : '';
        const d = await request('/api/shenlun/questions?limit=20&offset=' + this.qOffset + t + y + rg + pp);
        const items = d.items || [];
        this.qEnd = items.length < 20;
        this.qTotal = d.total || items.length;
        this.qs = append ? this.qs.concat(items) : items;
      } catch (e) {
        this.qErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async loadMats(append) {
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
      if (typeof window !== 'undefined' && window.history && !this.detail) {
        window.history.replaceState(null, '', this.filterUrl());
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
      this.switchMat();
      this.syncFilterUrl();
    },
    tapRec() {
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
      if (!this.mats.length) this.loadMats();
      if (!this.favSynced) {
        this.favSynced = true;
        this.syncFavs();
      }
    },
    async switchRec() {
      this.tab = 'r';
      const uid = uni.getStorageSync('anonUid');
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
      const uid = uni.getStorageSync('anonUid');
      if (uid) request('/api/shenlun/qfavs', { method: 'POST', data: { uid, qid: q.id, on: r.added } }).catch(() => {});
    },
    async syncQFavs() {
      const uid = uni.getStorageSync('anonUid');
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
      const uid = uni.getStorageSync('anonUid');
      if (uid) request('/api/shenlun/mat_favs', { method: 'POST', data: { uid, mid: m.id, on } }).catch(() => {});
    },
    async syncFavs() {
      const uid = uni.getStorageSync('anonUid');
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
      this.syncFilterUrl();
      this.loadMats();
    },
    loadMore() {
      this.qOffset += 20;
      this.loadQs(true);
    },
    loadMoreMat() {
      this.mOffset += 20;
      this.loadMats(true);
    },
    // #ifdef H5
    onSlKeydown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (this.tab !== 'q' || !this.detail) return;
      if (e.key === 'ArrowLeft' && this.qNav.prevId) { e.preventDefault(); this.openQ(this.qNav.prevId); }
      else if (e.key === 'ArrowRight' && this.qNav.nextId) { e.preventDefault(); this.openQ(this.qNav.nextId); }
    },
    // #endif
    async openQ(id) {
      try {
        const d = await request('/api/shenlun/questions/' + id);
        this.detail = d.item;
        this.showMat = true;
        this.showRef = false;
        this.myAnswer = uni.getStorageSync('slDraft:' + id) || '';
        this.syncDraft(id);
        this.gradeResult = '';
        this.history = [];
        this.showHist = false;
        this.loadHistory(id);
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
    copyQLink() {
      if (!this.detail) return;
      const url = (typeof window !== 'undefined' ? window.location.origin : '') + buildShenlunUrl(this.detail.id);
      uni.setClipboardData({ data: url, success: () => uni.showToast({ title: '链接已复制，发给考友直达本题', icon: 'none' }) });
    },
    copyMatLink(m) {
      const url = (typeof window !== 'undefined' ? window.location.origin : '') + buildShenlunMatUrl(m.id, m.type);
      uni.setClipboardData({ data: url, success: () => uni.showToast({ title: '链接已复制，发给考友直达本条素材', icon: 'none' }) });
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
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      const c = content !== undefined ? content : (this.detail && this.detail.id === qid ? this.myAnswer : uni.getStorageSync('slDraft:' + qid) || '');
      request('/api/shenlun/draft', { method: 'POST', data: { uid, qid, content: c } }).catch(() => {});
    },
    async syncDraft(id) {
      const uid = uni.getStorageSync('anonUid');
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
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      try {
        const d = await request('/api/shenlun/history?qid=' + id + '&uid=' + encodeURIComponent(uid));
        if (this.detail && this.detail.id === id) this.history = d.items || [];
      } catch (e) {
        /* 历史加载失败不阻断 */
      }
    },
    fmtTime(ts) {
      const d = new Date((ts || 0) * 1000);
      const p = (n) => (n < 10 ? '0' + n : n);
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },
    async grade() {
      if (this.grading || !this.myAnswer.trim()) return;
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
          data: { qid: this.detail.id, answer: this.myAnswer, uid: uni.getStorageSync('anonUid') || '' },
        });
        this.gradeResult = d.result;
        this.loadHistory(this.detail.id);
        uni.removeStorageSync('slDraft:' + this.detail.id);
        clearTimeout(this._draftTimer);
        this.pushDraft(this.detail.id, '');
      } catch (e) {
        uni.showToast({ title: e.message || '批改失败，请稍后重试', icon: 'none' });
      }
      this.grading = false;
    },
  },
};
</script>

<style scoped>
.page { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.seg { margin-bottom: var(--sp-12); }
.chips { margin-bottom: var(--sp-12); }
.grow { flex: 1; min-width: 0; }
.fltbar { display: flex; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-12); flex-wrap: wrap; }
.fltbar .chips { margin-bottom: 0; }
.paper-tag { max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tappable { cursor: pointer; }
.more { margin-top: var(--sp-8); }
.back { margin-bottom: var(--sp-8); align-self: flex-start; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ellip3 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }

.sheet-body { padding-bottom: var(--sp-8); }
.sheet-k { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin: var(--sp-12) 0 var(--sp-8); }
.sheet-foot { display: flex; gap: var(--sp-12); }
.sheet-body :deep(.wd-radio-group) { display: flex; flex-wrap: wrap; gap: var(--sp-8); --wot-radio-label-color: var(--ink); --wot-radio-button-bg: var(--fill); --wot-radio-button-border: var(--line); }

.qgrid, .mgrid, .rgrid { display: flex; flex-direction: column; gap: var(--card-gap); }
.q-top { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); }
.q-tags { display: flex; align-items: center; gap: var(--sp-8); flex: 1; min-width: 0; flex-wrap: wrap; }
.q-top-r { display: flex; align-items: center; gap: var(--sp-4); flex-shrink: 0; }
.q-paper { font-size: var(--fs-caption); color: var(--ink-2); }
.star-btn { width: var(--hit-min); height: var(--hit-min); margin: calc((var(--hit-min) - 20px) / -2) 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: var(--r-full); }
.q-text { display: block; margin-top: var(--sp-8); font-size: var(--fs-body); line-height: var(--lh-question); color: var(--ink); }
.q-text.link { color: var(--brand-text); }
.q-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); margin-top: var(--sp-8); }
.q-meta { font-size: var(--fs-caption); color: var(--ink-3); flex: 1; min-width: 0; }

.d-card { margin-bottom: var(--card-gap); }
.d-h { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); margin-top: var(--sp-12); }
.d-q { display: block; margin-top: var(--sp-8); font-size: var(--fs-body); line-height: var(--lh-question); color: var(--ink); white-space: pre-wrap; }
.d-toggle { display: flex; align-items: center; justify-content: space-between; min-height: var(--hit-min); cursor: pointer; }
.d-toggle .d-h { margin-top: 0; }
.d-toggle.ref .ref-t { color: var(--brand-text); }
.flip { transform: rotate(180deg); }
.d-mat { display: block; font-size: var(--fs-sub); line-height: var(--lh-body); color: var(--ink-2); white-space: pre-wrap; }
.d-ans-h { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); }
.d-ans-h .d-h { margin-top: 0; }
.d-save { font-size: var(--fs-caption); color: var(--ink-3); }
.d-save.near { color: var(--warn-strong); }
.d-save.over { color: var(--bad); font-weight: 600; }
.d-ta { width: 100%; box-sizing: border-box; min-height: 160px; margin-top: var(--sp-8); padding: var(--sp-12); background: var(--fill); border-radius: var(--r-sm); color: var(--ink); font-size: var(--fs-body); line-height: var(--lh-body); }
.grade-btn { margin-top: var(--sp-12); }
.d-grade { margin-top: var(--sp-4); }
.g-note { font-size: var(--fs-caption); font-weight: 400; color: var(--ink-3); }
.g-body { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); line-height: var(--lh-body); color: var(--ink); white-space: pre-wrap; }
.hist-item { padding: var(--sp-8) 0; border-top: 1px solid var(--line); }
.hist-time { display: block; font-size: var(--fs-caption); color: var(--ink-3); }
.hist-ans { display: block; margin-top: var(--sp-4); font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--ink); white-space: pre-wrap; }
.hist-res { display: block; margin-top: var(--sp-4); font-size: var(--fs-caption); line-height: var(--lh-sub); color: var(--ink-2); white-space: pre-wrap; }
.d-ref, .d-notes { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); line-height: var(--lh-body); color: var(--ink); white-space: pre-wrap; }
.d-notes { color: var(--ink-2); }
.d-nav { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); }
.d-nav-pos { font-size: var(--fs-sub); color: var(--ink-2); }

.m-topic { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.m-content { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); line-height: var(--lh-body); color: var(--ink); white-space: pre-wrap; }
.m-foot { display: flex; align-items: center; gap: var(--sp-8); margin-top: var(--sp-4); }
.m-src { font-size: var(--fs-caption); color: var(--ink-3); max-width: 60%; }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .qgrid, .mgrid, .rgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .d-ta { min-height: 320px; }
}
/* #endif */
</style>
