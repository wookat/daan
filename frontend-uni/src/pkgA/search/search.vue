<template>
  <view class="wrap">
    <view class="sbar">
      <view class="sbox">
        <l-icon name="search" :size="18" color="#9ca3af" />
        <input v-model="kw" class="sinput" placeholder="题号 / 题干关键词 / 考点 / 申论" confirm-type="search" focus @confirm="doSearch" @input="onInput" />
        <view v-if="kw" class="sclear" role="button" aria-label="清空搜索" @click="kw = ''; result = null; loadErr = ''; syncUrl()"><l-icon name="x" :size="16" color="#8a90a0" /></view>
      </view>
      <text class="scancel" @click="goBack">取消</text>
    </view>
    <view class="tabs">
      <text v-for="t in TABS" :key="t.k" class="tab" :class="{ on: tab === t.k }" @click="tab = t.k; doSearch()">{{ t.n }}</text>
    </view>

    <view v-if="loading" class="empty">搜索中…</view>
    <view v-else-if="loadErr" class="empty">
      <text class="empty-t">搜索失败：{{ loadErr }}</text>
      <view class="retry" role="button" aria-label="重试搜索" @click="doSearch">重试 ›</view>
    </view>
    <template v-else-if="result">
      <!-- 题号直达 -->
      <view v-if="result.code_hit" class="card qitem" @click="toggleDetail(result.code_hit)">
        <view class="q-top"><text class="q-code">{{ result.code_hit.code }}</text><text class="q-mod">{{ modName(result.code_hit.module) }}</text></view>
        <rich-text class="q-text" :nodes="hl(result.code_hit.question)" />
        <view v-if="detailWant === result.code_hit.id && !(detail && detail.id === result.code_hit.id)" class="q-loading">解析加载中…</view>
        <view v-if="detail && detail.id === result.code_hit.id" class="q-detail">
          <text v-for="(v, k) in detail.options" :key="k" class="q-opt" :class="{ ans: (detail.answer || '').indexOf(k) !== -1 }">{{ k }}. {{ v }}</text>
          <text class="q-ans">答案：{{ detail.answer }}</text>
          <text v-if="detail.explanation" class="q-exp">{{ detail.explanation }}</text>
          <view class="d-acts">
            <text v-if="detailAskSeen" class="d-copy seen" role="button" aria-label="回看 AI 详解" @click.stop="openSeenAsk">回看 AI 详解</text>
            <text class="d-copy" role="button" aria-label="AI 详解本题" @click.stop="askFromSearch(detail)">AI 详解本题</text>
            <text class="d-copy" role="button" aria-label="复制本题链接" @click.stop="copyQLink(detail.id)">复制本题链接</text>
          </view>
        </view>
      </view>
      <view class="res-cols" :class="{ two: tab === 'all' && hasSide }">
      <view class="res-side">
      <!-- 考点 -->
      <view v-if="showSec('topic') && result.topics && result.topics.length" class="sec">
        <text class="sec-t">考点</text>
        <view v-for="t in result.topics" :key="t.code" class="card titem" @click="goTopic(t)">
          <view class="t-l">
            <rich-text class="t-name" :nodes="hl(t.name)" />
            <text class="t-sub">{{ t.module_name }} · {{ t.group_name }}{{ t.n ? ' · ' + t.n + ' 题' : '' }}</text>
          </view>
          <text class="t-go">去练习 ›</text>
        </view>
      </view>
      <!-- 试卷 -->
      <view v-if="showSec('paper') && result.papers && result.papers.length" class="sec">
        <text class="sec-t">试卷</text>
        <view v-for="p in result.papers" :key="p.id" class="card titem" @click="goPaper(p)">
          <view class="t-l">
            <rich-text class="t-name" :nodes="hl(p.title)" />
            <text class="t-sub">{{ p.year || '' }}{{ p.region ? ' · ' + p.region : '' }}</text>
          </view>
          <text class="t-go">去做卷 ›</text>
        </view>
      </view>
      <!-- 申论真题 -->
      <view v-if="showSec('shenlun') && result.shenlun && result.shenlun.length" class="sec">
        <text class="sec-t">申论真题</text>
        <view v-for="s in result.shenlun" :key="s.id" class="card titem" @click="goShenlun(s)">
          <view class="t-l">
            <rich-text class="t-name" :nodes="hl(s.question)" />
            <text class="t-sub">{{ s.exam_year || '' }}{{ s.exam_region ? ' · ' + s.exam_region : '' }}{{ s.qtype ? ' · ' + s.qtype : '' }}</text>
          </view>
          <text class="t-go">去作答 ›</text>
        </view>
      </view>
      <!-- 申论素材 -->
      <view v-if="showSec('shenlun') && result.shenlun_mats && result.shenlun_mats.length" class="sec">
        <text class="sec-t">申论素材</text>
        <view v-for="m in result.shenlun_mats" :key="m.id" class="card titem" @click="goShenlunMat(m)">
          <view class="t-l">
            <text class="t-sub">{{ m.topic }}{{ m.type ? ' · ' + m.type : '' }}</text>
            <rich-text class="mt-content" :nodes="hl(m.content)" />
          </view>
          <text class="t-go">素材库 ›</text>
        </view>
      </view>
      </view>
      <view class="res-main">
      <!-- 题目 -->
      <view v-if="showSec('question') && result.questions && result.questions.items.length" class="sec">
        <text class="sec-t">题目（{{ result.questions.total }}）</text>
        <view v-for="it in result.questions.items" :key="it.id" class="card qitem" @click="toggleDetail(it)">
          <view class="q-top">
            <text class="q-code">{{ it.code }}</text>
            <text v-if="it.is_real" class="q-real">真题{{ it.exam_year ? ' ' + it.exam_year : '' }}</text>
            <text class="q-mod">{{ modName(it.module) }}{{ it.submodule ? ' · ' + it.submodule : '' }}</text>
          </view>
          <rich-text class="q-text" :nodes="hl(it.question)" />
          <view v-if="detailWant === it.id && !(detail && detail.id === it.id)" class="q-loading">解析加载中…</view>
          <view v-if="detail && detail.id === it.id" class="q-detail">
            <text v-for="(v, k) in detail.options" :key="k" class="q-opt" :class="{ ans: (detail.answer || '').indexOf(k) !== -1 }">{{ k }}. {{ v }}</text>
            <text class="q-ans">答案：{{ detail.answer }}</text>
            <text v-if="detail.explanation" class="q-exp">{{ detail.explanation }}</text>
            <view class="d-acts">
              <text v-if="detailAskSeen" class="d-copy seen" role="button" aria-label="回看 AI 详解" @click.stop="openSeenAsk">回看 AI 详解</text>
              <text class="d-copy" role="button" aria-label="AI 详解本题" @click.stop="askFromSearch(detail)">AI 详解本题</text>
              <text class="d-copy" role="button" aria-label="复制本题链接" @click.stop="copyQLink(detail.id)">复制本题链接</text>
            </view>
          </view>
        </view>
        <view v-if="result.questions.total > result.questions.items.length" class="more" @click="loadMore">{{ moreLoading ? '加载中…' : '加载更多' }}</view>
      </view>
      </view>
      </view>
      <view v-if="isEmpty" class="empty">
        <text>没有找到「{{ result.q }}」相关内容</text>
        <text>可尝试题号（如 ZL-JQ-2024-000914）、题干关键词或考点名</text>
      </view>
    </template>
    <template v-else>
      <view v-if="hist.length" class="hist">
        <view class="hist-top">
          <text class="hist-t">搜索历史</text>
          <view class="hist-clear" role="button" aria-label="清空搜索历史" @click="clearHist">清空</view>
        </view>
        <view class="hist-chips">
          <text v-for="h in hist" :key="h" class="hist-chip" role="button" :aria-label="'搜索 ' + h" @click="kw = h; doSearch()">{{ h }}</text>
        </view>
      </view>
      <view class="empty">支持搜索：题号语义码、题干关键词、考点名、试卷名、申论真题/素材</view>
    </template>
  </view>
</template>

<script>
import { request, trackEvent } from '../../api.js';
import { buildSearchUrl, buildTikuQPath } from '../../search-url.js';
import { askPrefill } from '../../ask-prefill.js';
import { askQid, findAskSid } from '../../ask-link.js';

const MODS = { ziliao: '资料', shuliang: '数量', yanyu: '言语', panduan: '判断', changshi: '常识', shenlun: '申论' };

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
    const q = decodeURIComponent(options && options.q ? options.q : '').trim();
    if (!q) return;
    if (options.tab && this.TABS.some((t) => t.k === options.tab)) this.tab = options.tab;
    if (/^\d+$/.test(options.qid || '')) this._urlQid = Number(options.qid);
    this.kw = q.slice(0, 64);
    this.doSearch();
  },
  onShow() {
    this.askSeenTick++;
  },
  computed: {
    detailAskSeen() {
      void this.askSeenTick;
      return findAskSid(uni.getStorageSync('askSessions'), uni.getStorageSync('askCurSession'), this.detail && this.detail.id);
    },
    hasSide() {
      const r = this.result;
      return !!(r && ((r.topics || []).length || (r.papers || []).length || (r.shenlun || []).length || (r.shenlun_mats || []).length));
    },
    isEmpty() {
      const r = this.result;
      if (!r) return false;
      if (r.code_hit) return false;
      return !((r.topics || []).length || (r.papers || []).length || (r.shenlun || []).length || (r.shenlun_mats || []).length || (r.questions && r.questions.items.length));
    }
  },
  methods: {
    modName(m) {
      return MODS[m] || m || '';
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
      const url = (typeof window !== 'undefined' ? window.location.origin : '') + buildTikuQPath(id);
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
      if (typeof window === 'undefined' || !window.history) return;
      window.history.replaceState(null, '', buildSearchUrl(this.kw, this.tab, this.detail && this.detail.id));
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
      const q = this.kw.trim();
      const seq = ++this.searchSeq;
      if (!q) {
        this.result = null;
        this.loadErr = '';
        return;
      }
      this.loading = true;
      this.detail = null;
      this.detailWant = null;
      try {
        const d = await request('/api/search?q=' + encodeURIComponent(q) + '&type=' + this.tab);
        if (seq !== this.searchSeq) return;
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
        if (seq !== this.searchSeq) return;
        if (this.result) {
          uni.showToast({ title: e.message || '搜索失败', icon: 'none' });
        } else {
          this.loadErr = e.message || '搜索失败';
        }
      }
      if (seq === this.searchSeq) this.loading = false;
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
.wrap { min-height: 100vh; background: var(--fill); padding: 20rpx 24rpx 60rpx; box-sizing: border-box; }
.sbar { display: flex; align-items: center; gap: 20rpx; }
.sbox { flex: 1; display: flex; align-items: center; gap: 12rpx; background: var(--card); border-radius: 999rpx; padding: 14rpx 24rpx; }
.sinput { flex: 1; font-size: 28rpx; }
.sclear { color: var(--ink-3); font-size: 26rpx; padding: 0 8rpx; }
.scancel { font-size: 28rpx; color: var(--ink-2); }
.tabs { display: flex; gap: 12rpx; margin: 20rpx 0; }
.tab { font-size: 26rpx; color: var(--ink-2); background: var(--card); border-radius: 999rpx; padding: 8rpx 28rpx; }
.tab.on { color: #fff; background: var(--brand); font-weight: 600; }
.card { background: var(--card); border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; }
.sec { margin-bottom: 12rpx; }
.sec-t { display: block; font-size: 24rpx; color: var(--ink-2); margin: 12rpx 4rpx; }
.titem { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.t-l { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.t-name { font-size: 28rpx; color: var(--ink); font-weight: 600; }
.t-sub { font-size: 22rpx; color: var(--ink-3); }
.mt-content { font-size: 24rpx; color: var(--ink-2); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.t-go { font-size: 24rpx; color: var(--brand-text); flex-shrink: 0; }
.qitem { display: flex; flex-direction: column; gap: 10rpx; }
.q-top { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
.q-code { font-size: 20rpx; color: var(--ink-2); background: var(--fill); border-radius: 6rpx; padding: 2rpx 10rpx; font-family: monospace; }
.q-real { font-size: 20rpx; color: var(--warn-strong); background: var(--warn-soft); border-radius: 6rpx; padding: 2rpx 10rpx; }
.q-mod { font-size: 20rpx; color: var(--ink-3); }
.q-text { font-size: 26rpx; color: var(--ink-2); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.q-loading { font-size: 24rpx; color: var(--ink-3); padding-top: 10rpx; }
.q-detail { border-top: 1rpx solid var(--fill); padding-top: 14rpx; display: flex; flex-direction: column; gap: 8rpx; }
.q-opt { font-size: 24rpx; color: var(--ink-2); }
.q-opt.ans { color: var(--ok-strong); font-weight: 600; }
.q-ans { font-size: 24rpx; color: var(--ok-strong); font-weight: 600; margin-top: 4rpx; }
.q-exp { font-size: 24rpx; color: var(--ink-2); line-height: 1.6; }
.d-acts { display: flex; gap: 20rpx; }
.d-copy { font-size: 22rpx; color: var(--brand-text); text-decoration: underline; cursor: pointer; padding: 4rpx 6rpx; align-self: flex-start; }
.d-copy.seen { color: var(--ok-strong); }
.more { text-align: center; font-size: 26rpx; color: var(--brand-text); padding: 16rpx; }
.empty { display: flex; flex-direction: column; gap: 8rpx; text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 100rpx 40rpx; }
.empty-t { font-size: 26rpx; color: var(--ink-2); }
.retry { margin-top: 8rpx; font-size: 26rpx; color: var(--brand-text); font-weight: 600; }
.hist { margin-top: 28rpx; }
.hist-top { display: flex; align-items: center; justify-content: space-between; }
.hist-t { font-size: 26rpx; font-weight: 600; color: var(--ink-2); }
.hist-clear { font-size: 24rpx; color: var(--ink-3, #8a90a0); padding: 8rpx; }
.hist-chips { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 16rpx; }
.hist-chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 26rpx; color: var(--ink-1, #1f2430); background: var(--card, #fff); border: 1px solid var(--line, #e5e7eb); border-radius: 999rpx; padding: 10rpx 24rpx; }

/* 桌面（H5）：≥1024 左考点/试卷侧栏 + 右题目列表（仅「全部」tab） */
/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .tab:hover, .titem:hover, .qitem:hover, .more:hover { cursor: pointer; }
  .qitem:hover { box-shadow: 0 8rpx 24rpx rgba(31, 36, 48, 0.08); }
}
@media (min-width: 1024px) {
  .res-cols.two { display: flex; gap: 32rpx; align-items: flex-start; }
  .res-cols.two .res-side {
    width: 300px;
    flex: none;
    position: sticky;
    top: 24rpx;
  }
  .res-cols.two .res-main { flex: 1; min-width: 0; }
}
/* #endif */
</style>
