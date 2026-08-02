<template>
  <view class="page">
    <view class="tabs">
      <text class="tab" :class="{ on: tab === 'q' }" @click="tab = 'q'">真题题库</text>
      <text class="tab" :class="{ on: tab === 'm' }" @click="switchMat">素材/范文</text>
      <text class="tab" :class="{ on: tab === 'r' }" @click="switchRec">作答记录</text>
    </view>

    <template v-if="tab === 'q' && !detail">
      <view class="chips">
        <text v-for="t in QTYPES" :key="t" class="chip" :class="{ on: qtype === t }" @click="setQtype(t)">{{ t }}</text>
      </view>
      <scroll-view v-if="years.length" scroll-x class="chips-x">
        <text class="chip sm" :class="{ on: !year }" @click="setYear(0)">全部年份</text>
        <text v-for="y in years" :key="y" class="chip sm" :class="{ on: year === y }" @click="setYear(y)">{{ y }}</text>
      </scroll-view>
      <scroll-view v-if="regions.length" scroll-x class="chips-x">
        <text class="chip sm" :class="{ on: !region }" @click="setRegion('')">全部地区</text>
        <text v-for="r in regions" :key="r" class="chip sm" :class="{ on: region === r }" @click="setRegion(r)">{{ r }}</text>
      </scroll-view>
      <view v-if="loading" class="spin">加载中…</view>
      <view v-else-if="!qs.length" class="spin">暂无题目，敬请期待</view>
      <view v-for="q in qs" :key="q.id" class="card q-item" @click="openQ(q.id)">
        <view class="q-top">
          <text class="q-paper">{{ q.paper || (q.exam_year + ' · ' + (q.exam_region || '')) }}</text>
          <text class="q-type">{{ q.qtype }}</text>
        </view>
        <text class="q-text">{{ q.question }}</text>
      </view>
      <view v-if="!qEnd && qs.length >= 20" class="more" @click="loadMore">加载更多</view>
    </template>

    <template v-if="tab === 'q' && detail">
      <view class="back" @click="detail = null">‹ 返回列表</view>
      <view class="card">
        <view class="q-top">
          <text class="q-paper">{{ detail.paper || (detail.exam_year + ' · ' + (detail.exam_region || '')) }}</text>
          <text class="q-type">{{ detail.qtype }}</text>
        </view>
        <view class="d-h">作答要求</view>
        <text class="d-q">{{ detail.question }}</text>
        <view class="d-h toggle" @click="showMat = !showMat">给定资料 {{ showMat ? '▲' : '▼' }}</view>
        <text v-if="showMat" class="d-mat">{{ detail.material }}</text>
        <view class="d-h">我的作答</view>
        <textarea v-model="myAnswer" class="d-ta" :maxlength="3000" placeholder="在此作答后点击下方按钮，AI 按采分点批改（大作文为结构点评+参考档位）。草稿自动保存在本机" auto-height @input="saveDraft" />
        <view class="grade-btn" :class="{ dis: grading || !myAnswer.trim() }" @click="grade">{{ grading ? 'AI 批改中…' : 'AI 批改' }}</view>
        <view v-if="gradeResult" class="d-grade">
          <view class="d-h">批改结果<text class="g-note">（AI 参考，非官方评分）</text></view>
          <text class="g-body">{{ gradeResult }}</text>
        </view>
        <view v-if="history.length" class="d-h toggle" @click="showHist = !showHist">历史作答（{{ history.length }}） {{ showHist ? '▲' : '▼' }}</view>
        <view v-if="showHist">
          <view v-for="h in history" :key="h.id" class="hist-item">
            <text class="hist-time">{{ fmtTime(h.created_at) }}</text>
            <text class="hist-ans">{{ h.answer }}</text>
            <text v-if="h.result" class="hist-res">{{ h.result }}</text>
          </view>
        </view>
        <view class="d-h toggle ref" @click="showRef = !showRef">{{ showRef ? '收起参考要点 ▲' : '写完再看 · 参考要点 ▼' }}</view>
        <text v-if="showRef" class="d-ref">{{ detail.reference }}</text>
        <text v-if="showRef && detail.notes" class="d-notes">{{ detail.notes }}</text>
      </view>
    </template>

    <template v-if="tab === 'm'">
      <view class="chips">
        <text v-for="t in MTYPES" :key="t" class="chip" :class="{ on: mtype === t && !favOnly }" @click="setMtype(t)">{{ t }}</text>
        <text class="chip fav" :class="{ on: favOnly }" @click="toggleFavOnly">★ 收藏{{ favIds.length ? ' ' + favIds.length : '' }}</text>
      </view>
      <view v-if="loading" class="spin">加载中…</view>
      <view v-else-if="!shownMats.length" class="spin">{{ favOnly ? '还没有收藏素材，点素材右上☆收藏' : '暂无素材，敬请期待' }}</view>
      <view v-for="m in shownMats" :key="m.id" class="card m-item">
        <view class="q-top">
          <text class="m-topic">{{ m.topic }}</text>
          <view class="q-top-r">
            <text class="q-type">{{ m.type }}</text>
            <text class="m-star" :class="{ on: favIds.includes(m.id) }" @click="toggleFav(m)">{{ favIds.includes(m.id) ? '★' : '☆' }}</text>
          </view>
        </view>
        <text class="m-content" :class="{ clamp: expanded !== m.id }" @click="expanded = expanded === m.id ? 0 : m.id">{{ m.content }}</text>
        <text v-if="m.source" class="m-src">出处：{{ m.source }}</text>
      </view>
      <view v-if="!favOnly && !mEnd && mats.length >= 20" class="more" @click="loadMoreMat">加载更多</view>
    </template>

    <template v-if="tab === 'r'">
      <view v-if="recLoading" class="spin">加载中…</view>
      <view v-else-if="!recs.length" class="spin">还没有作答记录，去题库作答并 AI 批改后会自动保存</view>
      <view v-for="r in recs" :key="r.id" class="card">
        <view class="q-top">
          <text class="hist-time">{{ fmtTime(r.created_at) }}</text>
          <text class="q-type">{{ r.qtype || '申论' }}</text>
        </view>
        <text class="q-text" @click="openQ(r.qid); tab = 'q'">{{ r.question || '（题目已下线）' }}</text>
        <text class="m-content" :class="{ clamp: expanded !== 'r' + r.id }" @click="expanded = expanded === 'r' + r.id ? 0 : 'r' + r.id">{{ '【我的作答】\n' + r.answer + (r.result ? '\n\n【批改结果】\n' + r.result : '') }}</text>
      </view>
    </template>
  </view>
</template>

<script>
import { request } from '../../api';

const QTYPES = ['全部', '归纳概括', '综合分析', '提出对策', '贯彻执行', '大作文'];
const MTYPES = ['全部', '金句', '案例', '政策理论', '范文'];

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
      myAnswer: '',
      grading: false,
      gradeResult: '',
      history: [],
      showHist: false,
      recs: [],
      recLoading: false,
      favOnly: false,
      favIds: uni.getStorageSync('slMatFavIds') || [],
      favMats: uni.getStorageSync('slMatFavs') || [],
      qOffset: 0,
      mOffset: 0,
      qEnd: false,
      mEnd: false,
      years: [],
      regions: [],
      year: 0,
      region: '',
    };
  },
  computed: {
    shownMats() {
      return this.favOnly ? this.favMats : this.mats;
    },
  },
  onLoad(opts) {
    this.loadQs();
    this.loadFilters();
    if (opts && opts.tab === 'r') this.switchRec();
    else if (opts && opts.tab === 'm') this.switchMat();
  },
  methods: {
    async loadQs(append) {
      this.loading = !append;
      try {
        const t = this.qtype === '全部' ? '' : '&qtype=' + encodeURIComponent(this.qtype);
        const y = this.year ? '&year=' + this.year : '';
        const rg = this.region ? '&region=' + encodeURIComponent(this.region) : '';
        const d = await request('/api/shenlun/questions?limit=20&offset=' + this.qOffset + t + y + rg);
        const items = d.items || [];
        this.qEnd = items.length < 20;
        this.qs = append ? this.qs.concat(items) : items;
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async loadMats(append) {
      this.loading = !append;
      try {
        const t = this.mtype === '全部' ? '' : '&type=' + encodeURIComponent(this.mtype);
        const d = await request('/api/shenlun/materials?limit=20&offset=' + this.mOffset + t);
        const items = d.items || [];
        this.mEnd = items.length < 20;
        this.mats = append ? this.mats.concat(items) : items;
      } catch (e) {
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
      this.year = y;
      this.qOffset = 0;
      this.qEnd = false;
      this.detail = null;
      this.loadQs();
    },
    setRegion(r) {
      this.region = r;
      this.qOffset = 0;
      this.qEnd = false;
      this.detail = null;
      this.loadQs();
    },
    switchMat() {
      this.tab = 'm';
      if (!this.mats.length) this.loadMats();
    },
    async switchRec() {
      this.tab = 'r';
      const uid = uni.getStorageSync('anonUid');
      if (!uid) {
        this.recs = [];
        return;
      }
      this.recLoading = true;
      try {
        const d = await request('/api/shenlun/history?limit=50&uid=' + encodeURIComponent(uid));
        this.recs = d.items || [];
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.recLoading = false;
    },
    setQtype(t) {
      this.qtype = t;
      this.qOffset = 0;
      this.qEnd = false;
      this.detail = null;
      this.loadQs();
    },
    toggleFav(m) {
      const i = this.favIds.indexOf(m.id);
      if (i >= 0) {
        this.favIds.splice(i, 1);
        this.favMats = this.favMats.filter((x) => x.id !== m.id);
      } else {
        this.favIds.push(m.id);
        this.favMats.unshift(m);
      }
      uni.setStorageSync('slMatFavIds', this.favIds);
      uni.setStorageSync('slMatFavs', this.favMats);
    },
    toggleFavOnly() {
      this.favOnly = !this.favOnly;
    },
    setMtype(t) {
      this.favOnly = false;
      this.mtype = t;
      this.mOffset = 0;
      this.mEnd = false;
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
    async openQ(id) {
      try {
        const d = await request('/api/shenlun/questions/' + id);
        this.detail = d.item;
        this.showMat = true;
        this.showRef = false;
        this.myAnswer = uni.getStorageSync('slDraft:' + id) || '';
        this.gradeResult = '';
        this.history = [];
        this.showHist = false;
        this.loadHistory(id);
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
    saveDraft() {
      if (!this.detail) return;
      const k = 'slDraft:' + this.detail.id;
      if (this.myAnswer) uni.setStorageSync(k, this.myAnswer);
      else uni.removeStorageSync(k);
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
      } catch (e) {
        uni.showToast({ title: e.message || '批改失败，请稍后重试', icon: 'none' });
      }
      this.grading = false;
    },
  },
};
</script>

<style>
.page { padding: 20rpx 24rpx 40rpx; }
.tabs { display: flex; gap: 12rpx; margin-bottom: 20rpx; }
.tab { flex: 1; text-align: center; font-size: 27rpx; color: var(--ink-2, #6b7280); background: #fff; border-radius: 16rpx; padding: 18rpx 0; }
.tab.on { color: #fff; background: var(--brand, #4f46e5); font-weight: 600; }
.chips { display: flex; gap: 12rpx; flex-wrap: wrap; margin-bottom: 20rpx; }
.chip { font-size: 23rpx; color: var(--ink-2, #6b7280); background: #fff; border: 1rpx solid var(--line, #e5e7eb); border-radius: 999rpx; padding: 12rpx 24rpx; }
.chip.on { color: #fff; background: var(--brand, #4f46e5); border-color: var(--brand, #4f46e5); }
.card { background: #fff; border-radius: 20rpx; padding: 26rpx 28rpx; margin-bottom: 18rpx; }
.hist-item { background: #f8f9fc; border-radius: 12rpx; padding: 16rpx 18rpx; margin-bottom: 12rpx; }
.hist-time { font-size: 21rpx; color: var(--ink-3, #9ca3af); display: block; margin-bottom: 6rpx; }
.hist-ans { font-size: 24rpx; color: var(--ink-1, #1f2937); line-height: 1.7; white-space: pre-wrap; display: block; max-height: 240rpx; overflow: hidden; }
.hist-res { font-size: 23rpx; color: var(--ink-2, #4b5563); background: #fffbeb; border-radius: 8rpx; padding: 12rpx 14rpx; margin-top: 10rpx; line-height: 1.7; white-space: pre-wrap; display: block; }
.spin { text-align: center; color: var(--ink-3, #9ca3af); font-size: 25rpx; padding: 60rpx 0; }
.q-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.q-paper { font-size: 22rpx; color: #b45309; background: #fef3c7; border-radius: 8rpx; padding: 4rpx 14rpx; }
.q-type { font-size: 22rpx; color: var(--brand, #4f46e5); background: var(--brand-soft, #eef1fd); border-radius: 8rpx; padding: 4rpx 14rpx; }
.q-text { font-size: 26rpx; color: var(--ink-1, #1f2937); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.more { text-align: center; color: var(--brand, #4f46e5); font-size: 25rpx; padding: 20rpx 0 40rpx; }
.back { color: var(--brand, #4f46e5); font-size: 26rpx; padding: 6rpx 0 18rpx; }
.d-h { font-size: 25rpx; font-weight: 700; color: var(--ink-1, #1f2937); margin: 22rpx 0 10rpx; }
.d-h.toggle { color: var(--brand, #4f46e5); }
.d-h.ref { color: #b45309; }
.d-q { font-size: 26rpx; color: var(--ink-1, #1f2937); line-height: 1.7; white-space: pre-wrap; }
.d-mat { font-size: 25rpx; color: var(--ink-2, #4b5563); line-height: 1.8; white-space: pre-wrap; }
.d-ref { font-size: 25rpx; color: #166534; background: #f0fdf4; border-radius: 12rpx; padding: 18rpx; line-height: 1.8; white-space: pre-wrap; display: block; }
.d-notes { font-size: 23rpx; color: var(--ink-2, #6b7280); margin-top: 12rpx; line-height: 1.7; white-space: pre-wrap; display: block; }
.m-topic { font-size: 24rpx; font-weight: 600; color: var(--ink-1, #1f2937); }
.q-top-r { display: flex; align-items: center; gap: 12rpx; }
.m-star { font-size: 34rpx; color: var(--ink-3, #c4c9d4); padding: 8rpx 12rpx; margin: -8rpx -12rpx -8rpx 0; }
.m-star.on { color: #f59e0b; }
.chip.fav.on { background: #fffbeb; color: #b45309; border-color: #fcd34d; }
.m-content { font-size: 25rpx; color: var(--ink-2, #4b5563); line-height: 1.8; white-space: pre-wrap; display: block; margin: 8rpx 0; word-break: break-all; overflow-wrap: anywhere; }
.m-content.clamp { display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
.chips-x { white-space: nowrap; margin-bottom: 14rpx; }
.chips-x .chip { display: inline-block; margin-right: 12rpx; }
.chip.sm { font-size: 22rpx; padding: 10rpx 20rpx; }
.m-src { font-size: 22rpx; color: var(--ink-3, #9ca3af); word-break: break-all; overflow-wrap: anywhere; display: block; }
.d-ta { width: 100%; box-sizing: border-box; min-height: 220rpx; background: #f8f9fc; border: 1rpx solid var(--line, #e5e7eb); border-radius: 12rpx; padding: 18rpx; font-size: 25rpx; line-height: 1.7; }
.grade-btn { margin-top: 16rpx; text-align: center; background: var(--brand, #4f46e5); color: #fff; font-size: 27rpx; font-weight: 600; border-radius: 999rpx; padding: 20rpx 0; }
.grade-btn.dis { opacity: 0.5; }
.d-grade { margin-top: 8rpx; }
.g-note { font-size: 21rpx; color: var(--ink-3, #9ca3af); font-weight: 400; }
.g-body { font-size: 25rpx; color: var(--ink-1, #1f2937); background: #fffbeb; border-radius: 12rpx; padding: 18rpx; line-height: 1.8; white-space: pre-wrap; display: block; }
</style>
