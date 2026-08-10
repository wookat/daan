<template>
  <view class="wrap">
    <view class="sbar">
      <view class="sbox">
        <l-icon name="search" :size="18" color="#9ca3af" />
        <input v-model="kw" class="sinput" placeholder="题号 / 题干关键词 / 考点名" confirm-type="search" focus @confirm="doSearch" @input="onInput" />
        <view v-if="kw" class="sclear" @click="kw = ''; result = null"><l-icon name="x" :size="16" color="#8a90a0" /></view>
      </view>
      <text class="scancel" @click="goBack">取消</text>
    </view>
    <view class="tabs">
      <text v-for="t in TABS" :key="t.k" class="tab" :class="{ on: tab === t.k }" @click="tab = t.k; doSearch()">{{ t.n }}</text>
    </view>

    <view v-if="loading" class="empty">搜索中…</view>
    <template v-else-if="result">
      <!-- 题号直达 -->
      <view v-if="result.code_hit" class="card qitem" @click="toggleDetail(result.code_hit)">
        <view class="q-top"><text class="q-code">{{ result.code_hit.code }}</text><text class="q-mod">{{ modName(result.code_hit.module) }}</text></view>
        <rich-text class="q-text" :nodes="hl(result.code_hit.question)" />
        <view v-if="detail && detail.id === result.code_hit.id" class="q-detail">
          <text v-for="(v, k) in detail.options" :key="k" class="q-opt" :class="{ ans: k === detail.answer }">{{ k }}. {{ v }}</text>
          <text class="q-ans">答案：{{ detail.answer }}</text>
          <text v-if="detail.explanation" class="q-exp">{{ detail.explanation }}</text>
        </view>
      </view>
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
          <view v-if="detail && detail.id === it.id" class="q-detail">
            <text v-for="(v, k) in detail.options" :key="k" class="q-opt" :class="{ ans: k === detail.answer }">{{ k }}. {{ v }}</text>
            <text class="q-ans">答案：{{ detail.answer }}</text>
            <text v-if="detail.explanation" class="q-exp">{{ detail.explanation }}</text>
          </view>
        </view>
        <view v-if="result.questions.total > result.questions.items.length" class="more" @click="loadMore">加载更多</view>
      </view>
      <view v-if="isEmpty" class="empty">没有找到「{{ result.q }}」相关内容\n可尝试题号（如 ZL-JQ-2024-000914）、题干关键词或考点名</view>
    </template>
    <view v-else class="empty">支持搜索：题号语义码、题干关键词、考点名、试卷名</view>
  </view>
</template>

<script>
import { request } from '../../api.js';

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
        { k: 'paper', n: '试卷' }
      ],
      loading: false,
      result: null,
      detail: null,
      timer: null
    };
  },
  computed: {
    isEmpty() {
      const r = this.result;
      if (!r) return false;
      if (r.code_hit) return false;
      return !((r.topics || []).length || (r.papers || []).length || (r.questions && r.questions.items.length));
    }
  },
  methods: {
    modName(m) {
      return MODS[m] || m || '';
    },
    showSec(k) {
      return this.tab === 'all' || this.tab === k;
    },
    onInput() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.doSearch(), 400);
    },
    async doSearch() {
      const q = this.kw.trim();
      if (!q) {
        this.result = null;
        return;
      }
      this.loading = true;
      this.detail = null;
      try {
        this.result = await request('/api/search?q=' + encodeURIComponent(q) + '&type=' + this.tab);
      } catch (e) {
        uni.showToast({ title: e.message || '搜索失败', icon: 'none' });
      }
      this.loading = false;
    },
    async loadMore() {
      const q = this.result.q;
      const off = this.result.questions.items.length;
      try {
        const d = await request('/api/search?q=' + encodeURIComponent(q) + '&type=question&offset=' + off);
        if (d.questions) this.result.questions.items.push(...d.questions.items);
      } catch (e) {
        uni.showToast({ title: '加载失败', icon: 'none' });
      }
    },
    async toggleDetail(it) {
      if (this.detail && this.detail.id === it.id) {
        this.detail = null;
        return;
      }
      try {
        this.detail = await request('/api/search/question/' + it.id);
      } catch (e) {
        uni.showToast({ title: '加载失败', icon: 'none' });
      }
    },
    goTopic() {
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goPaper(p) {
      uni.navigateTo({ url: '/pkgA/exam/exam?paper_id=' + p.id });
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
      return t.split(q).join('<span style="color:#3b6ff5;font-weight:600">' + q + '</span>');
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
.sec-t { display: block; font-size: 24rpx; color: var(--ink-3); margin: 12rpx 4rpx; }
.titem { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.t-l { flex: 1; display: flex; flex-direction: column; gap: 6rpx; }
.t-name { font-size: 28rpx; color: var(--ink); font-weight: 600; }
.t-sub { font-size: 22rpx; color: var(--ink-3); }
.t-go { font-size: 24rpx; color: var(--brand); flex-shrink: 0; }
.qitem { display: flex; flex-direction: column; gap: 10rpx; }
.q-top { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
.q-code { font-size: 20rpx; color: var(--ink-2); background: var(--fill); border-radius: 6rpx; padding: 2rpx 10rpx; font-family: monospace; }
.q-real { font-size: 20rpx; color: #b45309; background: var(--warn-soft); border-radius: 6rpx; padding: 2rpx 10rpx; }
.q-mod { font-size: 20rpx; color: var(--ink-3); }
.q-text { font-size: 26rpx; color: var(--ink-2); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.q-detail { border-top: 1rpx solid var(--fill); padding-top: 14rpx; display: flex; flex-direction: column; gap: 8rpx; }
.q-opt { font-size: 24rpx; color: var(--ink-2); }
.q-opt.ans { color: #12b76a; font-weight: 600; }
.q-ans { font-size: 24rpx; color: #12b76a; font-weight: 600; margin-top: 4rpx; }
.q-exp { font-size: 24rpx; color: var(--ink-2); line-height: 1.6; }
.more { text-align: center; font-size: 26rpx; color: var(--brand); padding: 16rpx; }
.empty { text-align: center; color: var(--ink-3); font-size: 26rpx; padding: 100rpx 40rpx; white-space: pre-line; }
</style>
