<template>
  <view class="page">
    <!-- 吸顶：搜索框 + 范围 chip -->
    <view class="sticky">
      <wd-search
        v-model="kw"
        placeholder="题号 / 题干关键词 / 考点 / 申论"
        placeholder-left
        focus
        :maxlength="64"
        cancel-txt="取消"
        @search="doSearch"
        @change="onInput"
        @clear="onClear"
        @cancel="goBack"
      />
      <kg-chip-row :model-value="tab" :options="tabChips" size="sm" class="tabs" @update:model-value="onTab" />
    </view>

    <kg-two-col v-if="loading || loadErr || result">
      <template #main>
        <view v-if="loading" class="skel" aria-busy="true">
          <kg-skeleton preset="lines" />
          <kg-skeleton preset="cards" />
        </view>
        <kg-empty-state
          v-else-if="loadErr"
          icon="wifi-off"
          :title="'搜索失败：' + loadErr"
          cta-text="重试"
          @cta="doSearch"
        />
        <template v-else-if="result">
          <!-- 题号直达：始终居主栏首位，避免桌面端被挤进 320px 侧栏 -->
          <kg-card v-if="result.code_hit" clickable class="qitem hit" @click="toggleDetail(result.code_hit)">
            <view class="q-top">
              <kg-tag tone="brand">题号直达</kg-tag>
              <text class="q-code num">{{ result.code_hit.code }}</text>
              <kg-tag tone="module" :module="result.code_hit.module">{{ modName(result.code_hit.module) }}</kg-tag>
            </view>
            <rich-text class="q-text stem" :nodes="hl(result.code_hit.question)" />
            <view v-if="detailWant === result.code_hit.id && !(detail && detail.id === result.code_hit.id)" class="q-loading"><kg-skeleton preset="lines" /></view>
            <view v-if="detail && detail.id === result.code_hit.id" class="q-detail" @click.stop>
              <kg-fit-img v-if="detail.image" :src="imgUrl(detail.image)" mode="widthFix" class="optimg" />
              <view v-for="(v, k) in detail.options" :key="k" class="q-opt" :class="{ ans: (detail.answer || '').indexOf(k) !== -1 }">{{ k }}. {{ v }}<kg-fit-img v-for="(im, ii) in (detail.option_imgs && detail.option_imgs[k]) || []" :key="ii" :src="imgUrl(im)" class="optimg" /></view>
              <text class="q-ans">答案：<text class="num">{{ detail.answer }}</text></text>
              <text v-if="detail.explanation" class="q-exp">{{ detail.explanation }}</text>
              <view class="d-acts">
                <kg-button v-if="detailAskSeen" variant="text" size="sm" @click.stop="openSeenAsk">回看 AI 详解</kg-button>
                <kg-button variant="secondary" size="sm" icon="sparkles" @click.stop="askFromSearch(detail)">AI 详解本题</kg-button>
                <kg-button variant="text" size="sm" icon="copy" @click.stop="copyQLink(detail.id)">复制链接</kg-button>
              </view>
            </view>
          </kg-card>

          <!-- 题目 -->
          <view v-if="hasQuestions" class="sec">
            <kg-section-header :title="'题目 · ' + result.questions.total" />
            <kg-card v-for="it in result.questions.items" :key="it.id" clickable class="qitem" @click="toggleDetail(it)">
              <view class="q-top">
                <text class="q-code num">{{ it.code }}</text>
                <kg-tag v-if="it.is_real" tone="warn">真题{{ it.exam_year ? ' ' + it.exam_year : '' }}</kg-tag>
                <kg-tag tone="module" :module="it.module">{{ modName(it.module) }}{{ it.submodule ? ' · ' + it.submodule : '' }}</kg-tag>
              </view>
              <rich-text class="q-text stem" :nodes="hl(it.question)" />
              <view v-if="detailWant === it.id && !(detail && detail.id === it.id)" class="q-loading"><kg-skeleton preset="lines" /></view>
              <view v-if="detail && detail.id === it.id" class="q-detail" @click.stop>
                <kg-fit-img v-if="detail.image" :src="imgUrl(detail.image)" mode="widthFix" class="optimg" />
                <view v-for="(v, k) in detail.options" :key="k" class="q-opt" :class="{ ans: (detail.answer || '').indexOf(k) !== -1 }">{{ k }}. {{ v }}<kg-fit-img v-for="(im, ii) in (detail.option_imgs && detail.option_imgs[k]) || []" :key="ii" :src="imgUrl(im)" class="optimg" /></view>
                <text class="q-ans">答案：<text class="num">{{ detail.answer }}</text></text>
                <text v-if="detail.explanation" class="q-exp">{{ detail.explanation }}</text>
                <view class="d-acts">
                  <kg-button v-if="detailAskSeen" variant="text" size="sm" @click.stop="openSeenAsk">回看 AI 详解</kg-button>
                  <kg-button variant="secondary" size="sm" icon="sparkles" @click.stop="askFromSearch(detail)">AI 详解本题</kg-button>
                  <kg-button variant="text" size="sm" icon="copy" @click.stop="copyQLink(detail.id)">复制链接</kg-button>
                </view>
              </view>
            </kg-card>
            <kg-button
              v-if="result.questions.total > result.questions.items.length"
              variant="ghost"
              size="md"
              block
              :loading="moreLoading"
              :disabled="moreLoading"
              class="more"
              @click="loadMore"
            >加载更多</kg-button>
          </view>

          <!-- 无题目列表（例如切到 考点/试卷/申论 Tab）：结果直接进主栏，杜绝桌面左侧 984px 全空 -->
          <template v-if="!hasQuestions && hasSide">
            <view v-if="showSec('topic') && result.topics && result.topics.length" class="sec">
              <kg-section-header title="考点" />
              <kg-card v-for="t in result.topics" :key="t.code" clickable chevron class="titem" :padding="12" @click="goTopic(t)">
                <view class="t-l">
                  <rich-text class="t-name" :nodes="hl(t.name)" />
                  <text class="t-sub">{{ t.module_name }} · {{ t.group_name }}{{ t.n ? ' · ' + t.n + ' 题' : '' }}</text>
                </view>
              </kg-card>
            </view>
            <view v-if="showSec('paper') && result.papers && result.papers.length" class="sec">
              <kg-section-header title="试卷" />
              <kg-card v-for="p in result.papers" :key="p.id" clickable chevron class="titem" :padding="12" @click="goPaper(p)">
                <view class="t-l">
                  <rich-text class="t-name" :nodes="hl(p.title)" />
                  <text class="t-sub">{{ p.year || '' }}{{ p.region ? ' · ' + p.region : '' }}</text>
                </view>
              </kg-card>
            </view>
            <view v-if="showSec('shenlun') && result.shenlun && result.shenlun.length" class="sec">
              <kg-section-header title="申论真题" />
              <kg-card v-for="s in result.shenlun" :key="s.id" clickable chevron class="titem" :padding="12" @click="goShenlun(s)">
                <view class="t-l">
                  <rich-text class="t-name" :nodes="hl(s.question)" />
                  <text class="t-sub">{{ s.exam_year || '' }}{{ s.exam_region ? ' · ' + s.exam_region : '' }}{{ s.qtype ? ' · ' + s.qtype : '' }}</text>
                </view>
              </kg-card>
            </view>
            <view v-if="showSec('shenlun') && result.shenlun_mats && result.shenlun_mats.length" class="sec">
              <kg-section-header title="申论素材" />
              <kg-card v-for="m in result.shenlun_mats" :key="m.id" clickable chevron class="titem" :padding="12" @click="goShenlunMat(m)">
                <view class="t-l">
                  <text class="t-sub">{{ m.topic }}{{ m.type ? ' · ' + m.type : '' }}</text>
                  <rich-text class="mt-content" :nodes="hl(m.content)" />
                </view>
              </kg-card>
            </view>
          </template>

          <kg-empty-state
            v-if="isEmpty"
            icon="search"
            :title="'没有找到「' + result.q + '」相关内容'"
            desc="可尝试题号（如 ZL-JQ-2024-000914）、题干关键词或考点名"
          />
        </template>
      </template>

      <template v-if="result && !loading && !loadErr && hasQuestions && hasSide" #aside>
        <!-- 考点 -->
        <view v-if="showSec('topic') && result.topics && result.topics.length" class="sec">
          <kg-section-header title="考点" />
          <kg-card v-for="t in result.topics" :key="t.code" clickable chevron class="titem" :padding="12" @click="goTopic(t)">
            <view class="t-l">
              <rich-text class="t-name" :nodes="hl(t.name)" />
              <text class="t-sub">{{ t.module_name }} · {{ t.group_name }}{{ t.n ? ' · ' + t.n + ' 题' : '' }}</text>
            </view>
          </kg-card>
        </view>
        <!-- 试卷 -->
        <view v-if="showSec('paper') && result.papers && result.papers.length" class="sec">
          <kg-section-header title="试卷" />
          <kg-card v-for="p in result.papers" :key="p.id" clickable chevron class="titem" :padding="12" @click="goPaper(p)">
            <view class="t-l">
              <rich-text class="t-name" :nodes="hl(p.title)" />
              <text class="t-sub">{{ p.year || '' }}{{ p.region ? ' · ' + p.region : '' }}</text>
            </view>
          </kg-card>
        </view>
        <!-- 申论真题 -->
        <view v-if="showSec('shenlun') && result.shenlun && result.shenlun.length" class="sec">
          <kg-section-header title="申论真题" />
          <kg-card v-for="s in result.shenlun" :key="s.id" clickable chevron class="titem" :padding="12" @click="goShenlun(s)">
            <view class="t-l">
              <rich-text class="t-name" :nodes="hl(s.question)" />
              <text class="t-sub">{{ s.exam_year || '' }}{{ s.exam_region ? ' · ' + s.exam_region : '' }}{{ s.qtype ? ' · ' + s.qtype : '' }}</text>
            </view>
          </kg-card>
        </view>
        <!-- 申论素材 -->
        <view v-if="showSec('shenlun') && result.shenlun_mats && result.shenlun_mats.length" class="sec">
          <kg-section-header title="申论素材" />
          <kg-card v-for="m in result.shenlun_mats" :key="m.id" clickable chevron class="titem" :padding="12" @click="goShenlunMat(m)">
            <view class="t-l">
              <text class="t-sub">{{ m.topic }}{{ m.type ? ' · ' + m.type : '' }}</text>
              <rich-text class="mt-content" :nodes="hl(m.content)" />
            </view>
          </kg-card>
        </view>
      </template>
    </kg-two-col>

    <!-- 输入态（T5 段）：最近搜索 chips -->
    <view v-else class="idle">
      <view v-if="hist.length" class="hist">
        <kg-section-header title="最近搜索" />
        <view class="hist-chips">
          <view v-for="h in hist" :key="h" class="hist-chip" role="button" :aria-label="'搜索 ' + h" @click="kw = h; doSearch()">
            <l-icon name="clock" :size="16" tone="muted" />
            <text class="hist-chip-t">{{ h }}</text>
          </view>
        </view>
        <kg-button variant="text" size="sm" icon="trash-2" class="hist-clear" @click="clearHist">清空历史</kg-button>
      </view>
      <kg-empty-state
        v-else
        compact
        icon="search"
        title="搜题、考点、试卷、申论"
        desc="支持题号语义码（如 ZL-JQ-2024-000914）、题干关键词、考点名、试卷名、申论真题/素材"
      />
    </view>
  </view>
</template>

<script>
import { request, trackEvent, imgUrl } from '../../api/api.js';
import { buildSearchUrl, buildTikuQPath } from '../../utils/search-url.js';
import { withBasePath } from '../../utils/hash-url.js';
import { askPrefill } from '../../ask/ask-prefill.js';
import { askQid, findAskSid } from '../../ask/ask-link.js';
import { MODULES } from '../../utils/module-meta.js';

const MODS = { shenlun: '申论' };

export default {
  data() {
    return {
      kw: '',
      tab: 'all',
      TABS: [
        { k: 'all', n: '全部' },
        { k: 'question', n: '题目' },
        { k: 'topic', n: '考点' },
        { k: 'paper', n: '试卷' },
        { k: 'shenlun', n: '申论' }
      ],
      loading: false,
      loadErr: '',
      result: null,
      detail: null,
      detailWant: null,
      timer: null,
      searchSeq: 0,
      moreLoading: false,
      askSeenTick: 0,
      hist: uni.getStorageSync('kgSearchHist') || []
    };
  },
  onLoad(options) {
    let raw = options && options.q ? options.q : '';
    try { raw = decodeURIComponent(raw); } catch (e) { /* 畸形百分比编码原样保留 */ }
    const q = raw.trim();
    if (!q) return;
    if (options.tab && this.TABS.some((t) => t.k === options.tab)) this.tab = options.tab;
    if (/^\d+$/.test(options.qid || '')) this._urlQid = Number(options.qid);
    this.kw = q.slice(0, 64);
    this.doSearch();
  },
  onShow() {
    this.askSeenTick++;
  },
  onUnload() {
    this._unmounted = true;
    clearTimeout(this.timer);
    this.timer = null;
  },
  computed: {
    tabChips() {
      return this.TABS.map((t) => ({ label: t.n, value: t.k }));
    },
    detailAskSeen() {
      void this.askSeenTick;
      return findAskSid(uni.getStorageSync('askSessions'), uni.getStorageSync('askCurSession'), this.detail && this.detail.id);
    },
    hasQuestions() {
      const r = this.result;
      return !!(this.showSec('question') && r && r.questions && r.questions.items && r.questions.items.length);
    },
    hasSide() {
      const r = this.result;
      return !!(r && (
        (this.showSec('topic') && (r.topics || []).length) ||
        (this.showSec('paper') && (r.papers || []).length) ||
        (this.showSec('shenlun') && ((r.shenlun || []).length || (r.shenlun_mats || []).length))
      ));
    },
    isEmpty() {
      const r = this.result;
      if (!r) return false;
      if (r.code_hit) return false;
      return !((r.topics || []).length || (r.papers || []).length || (r.shenlun || []).length || (r.shenlun_mats || []).length || (r.questions && r.questions.items.length));
    }
  },
  methods: {
    imgUrl,
    modName(m) {
      return MODULES[m] ? MODULES[m].short : MODS[m] || m || '';
    },
    onTab(k) {
      this.tab = k;
      this.doSearch();
    },
    onClear() {
      clearTimeout(this.timer);
      this.timer = null;
      this.searchSeq++;
      this.kw = '';
      this.loading = false;
      this.result = null;
      this.detail = null;
      this.detailWant = null;
      this.loadErr = '';
      this.syncUrl();
    },
    openSeenAsk() {
      if (!this.detailAskSeen) return;
      if (this.detailAskSeen.sid > 0) uni.setStorageSync('askOpenSid', this.detailAskSeen.sid);
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    askFromSearch(d) {
      const text = askPrefill(d && d.question, d && d.options);
      if (!text) return;
      trackEvent('search_ask_click', d.module || '');
      uni.setStorageSync('redoQuestion', text);
      const qid = askQid(d && d.id);
      if (qid) uni.setStorageSync('redoQid', qid);
      else uni.removeStorageSync('redoQid');
      uni.removeStorageSync('redoAnswer');
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    copyQLink(id) {
      const origin = typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : 'https://kaogong.zalize.com';
      const url = origin + buildTikuQPath(id);
      uni.setClipboardData({ data: url, success: () => uni.showToast({ title: '链接已复制，发给考友直达本题', icon: 'none' }) });
    },
    showSec(k) {
      return this.tab === 'all' || this.tab === k;
    },
    saveHist(q) {
      const h = this.hist.filter((x) => x !== q);
      h.unshift(q);
      this.hist = h.slice(0, 10);
      uni.setStorageSync('kgSearchHist', this.hist);
    },
    syncUrl() {
      // #ifdef H5
      if (this._unmounted || typeof window === 'undefined' || !window.history) return;
      window.history.replaceState(window.history.state, '', withBasePath(buildSearchUrl(this.kw, this.tab, this.detail && this.detail.id)));
      // #endif
    },
    clearHist() {
      this.hist = [];
      uni.removeStorageSync('kgSearchHist');
    },
    onInput() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.doSearch(), 400);
    },
    async doSearch() {
      clearTimeout(this.timer);
      this.timer = null;
      const q = this.kw.trim();
      const seq = ++this.searchSeq;
      if (!q) {
        this.loading = false;
        this.result = null;
        this.detail = null;
        this.detailWant = null;
        this.loadErr = '';
        this.syncUrl();
        return;
      }
      this.loading = true;
      this.detail = null;
      this.detailWant = null;
      try {
        const d = await request('/api/search?q=' + encodeURIComponent(q) + '&type=' + this.tab);
        if (this._unmounted || seq !== this.searchSeq) return;
        this.result = d;
        this.loadErr = '';
        this.saveHist(q);
        this.syncUrl();
        if (this._urlQid) {
          const qid = this._urlQid;
          this._urlQid = null;
          const hit = (d.code_hit && d.code_hit.id === qid && d.code_hit) || (d.questions && d.questions.items.find((x) => x.id === qid));
          if (hit) this.toggleDetail(hit);
        }
      } catch (e) {
        if (this._unmounted || seq !== this.searchSeq) return;
        if (this.result) {
          uni.showToast({ title: e.message || '搜索失败', icon: 'none' });
        } else {
          this.loadErr = e.message || '搜索失败';
        }
      }
      if (!this._unmounted && seq === this.searchSeq) this.loading = false;
    },
    async loadMore() {
      if (this.moreLoading) return;
      this.moreLoading = true;
      const r = this.result;
      const q = r.q;
      const off = r.questions.items.length;
      try {
        const d = await request('/api/search?q=' + encodeURIComponent(q) + '&type=question&offset=' + off);
        if (r !== this.result) return;
        if (d.questions) {
          const seen = new Set(r.questions.items.map((x) => x.id));
          r.questions.items.push(...d.questions.items.filter((x) => !seen.has(x.id)));
          if (d.questions.total != null) r.questions.total = d.questions.total;
        }
      } catch (e) {
        if (r !== this.result) return;
        uni.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        this.moreLoading = false;
      }
    },
    async toggleDetail(it) {
      if (this.detail && this.detail.id === it.id) {
        this.detail = null;
        this.detailWant = null;
        this.syncUrl();
        return;
      }
      if (this.detailWant === it.id) return;
      this.detailWant = it.id;
      try {
        const d = await request('/api/search/question/' + it.id);
        if (this.detailWant !== it.id) return;
        this.detail = d;
        this.syncUrl();
      } catch (e) {
        if (this.detailWant !== it.id) return;
        this.detailWant = null;
        uni.showToast({ title: '加载失败', icon: 'none' });
      }
    },
    goTopic(t) {
      uni.setStorageSync('practicePreset', { module: t.module, count: 10, adaptive: true, tag3: t.code || null, source: 'search' });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goPaper(p) {
      uni.navigateTo({ url: '/pkgA/exam/exam?paper_id=' + p.id });
    },
    goShenlun(s) {
      uni.navigateTo({ url: '/pkgA/shenlun/shenlun?id=' + s.id });
    },
    goShenlunMat(m) {
      const t = m && m.type ? '&mtype=' + encodeURIComponent(m.type) : '';
      uni.navigateTo({ url: '/pkgA/shenlun/shenlun?tab=m&mid=' + m.id + t });
    },
    goBack() {
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/home/home' }) });
    },
    esc(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    hl(text) {
      const t = this.esc(text);
      const q = this.esc(this.result && this.result.q);
      if (!q) return t;
      return t.split(q).join('<span style="color:var(--brand-text);font-weight:600">' + q + '</span>');
    }
  }
};
</script>

<style scoped>
.page { padding: 0 var(--page-x) var(--sp-48); box-sizing: border-box; }
.sticky { position: sticky; top: var(--window-top, 0px); z-index: var(--z-sticky); background: var(--bg); margin: 0 calc(-1 * var(--page-x)); padding: var(--sp-8) var(--page-x) var(--sp-8); }
.sticky :deep(.wd-search) { background: var(--bg); padding-left: 0; padding-right: 0; --wot-search-cancel-color: var(--ink-2); --wot-search-placeholder-color: var(--ink-4); }
.tabs { margin-top: var(--sp-4); }
.skel { display: flex; flex-direction: column; gap: var(--sp-12); }
.sec { margin-bottom: var(--sp-16); }
.qitem { margin-bottom: var(--sp-8); }
.q-top { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-8); margin-bottom: var(--sp-8); }
.q-code { font-size: var(--fs-caption); color: var(--ink-3); }
.stem { display: block; font-size: var(--fs-body); line-height: var(--lh-question); color: var(--ink); }
.q-loading { margin-top: var(--sp-8); }
.q-detail { margin-top: var(--sp-12); padding-top: var(--sp-12); border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: var(--sp-4); }
.q-opt { font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--ink-2); }
.q-opt.ans { color: var(--ok-strong); font-weight: 600; }
.optimg { max-width: 100%; margin: var(--sp-8) var(--sp-8) 0 0; border-radius: var(--r-xs); display: inline-block; vertical-align: middle; }
.q-ans { margin-top: var(--sp-4); font-size: var(--fs-sub); font-weight: 600; color: var(--ink); }
.q-exp { font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--ink-2); }
.d-acts { display: flex; flex-wrap: wrap; gap: var(--sp-4); margin-top: var(--sp-8); }
.more { margin-top: var(--sp-8); }
.titem { margin-bottom: var(--sp-8); }
.t-l { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding-right: var(--sp-24); box-sizing: border-box; }
.t-name { font-size: var(--fs-body); color: var(--ink); }
.t-sub { font-size: var(--fs-caption); color: var(--ink-3); }
.mt-content { font-size: var(--fs-sub); line-height: var(--lh-sub); color: var(--ink-2); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
.idle { padding-top: var(--sp-16); }
.hist-chips { display: flex; flex-wrap: wrap; gap: var(--sp-8); }
.hist-chip { display: inline-flex; align-items: center; gap: var(--sp-4); min-height: 40px; padding: 0 var(--sp-12); border-radius: var(--r-full); background: var(--card); border: 1px solid var(--line); max-width: 100%; }
.hist-chip-t { font-size: var(--fs-sub); color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hist-clear { margin-top: var(--sp-8); }
/* #ifdef H5 */
@media (min-width: 768px) {
  .page { max-width: 720px; margin: 0 auto; }
  .hist-chip:hover { cursor: pointer; border-color: var(--brand); }
}
@media (min-width: 1024px) {
  .page { max-width: 1064px; margin: 0 auto; }
  .page :deep(.kg-two__aside) {
    top: calc(var(--window-top, 0px) + 112px);
    max-height: calc(100vh - var(--window-top, 0px) - 128px);
  }
}
/* #endif */
</style>
