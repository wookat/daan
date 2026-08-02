<template>
  <view class="page">
    <view class="tabs">
      <text class="tab" :class="{ on: tab === 'q' }" @click="tab = 'q'">真题题库</text>
      <text class="tab" :class="{ on: tab === 'm' }" @click="switchMat">素材/范文</text>
    </view>

    <template v-if="tab === 'q' && !detail">
      <view class="chips">
        <text v-for="t in QTYPES" :key="t" class="chip" :class="{ on: qtype === t }" @click="setQtype(t)">{{ t }}</text>
      </view>
      <view v-if="loading" class="spin">加载中…</view>
      <view v-else-if="!qs.length" class="spin">暂无题目，敬请期待</view>
      <view v-for="q in qs" :key="q.id" class="card q-item" @click="openQ(q.id)">
        <view class="q-top">
          <text class="q-paper">{{ q.paper || (q.exam_year + ' · ' + (q.exam_region || '')) }}</text>
          <text class="q-type">{{ q.qtype }}</text>
        </view>
        <text class="q-text">{{ q.question }}</text>
      </view>
      <view v-if="qs.length >= 20" class="more" @click="loadMore">加载更多</view>
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
        <textarea v-model="myAnswer" class="d-ta" :maxlength="3000" placeholder="在此作答后点击下方按钮，AI 按采分点批改（大作文为结构点评+参考档位）" auto-height />
        <view class="grade-btn" :class="{ dis: grading || !myAnswer.trim() }" @click="grade">{{ grading ? 'AI 批改中…' : 'AI 批改' }}</view>
        <view v-if="gradeResult" class="d-grade">
          <view class="d-h">批改结果<text class="g-note">（AI 参考，非官方评分）</text></view>
          <text class="g-body">{{ gradeResult }}</text>
        </view>
        <view class="d-h toggle ref" @click="showRef = !showRef">{{ showRef ? '收起参考要点 ▲' : '写完再看 · 参考要点 ▼' }}</view>
        <text v-if="showRef" class="d-ref">{{ detail.reference }}</text>
        <text v-if="showRef && detail.notes" class="d-notes">{{ detail.notes }}</text>
      </view>
    </template>

    <template v-if="tab === 'm'">
      <view class="chips">
        <text v-for="t in MTYPES" :key="t" class="chip" :class="{ on: mtype === t }" @click="setMtype(t)">{{ t }}</text>
      </view>
      <view v-if="loading" class="spin">加载中…</view>
      <view v-else-if="!mats.length" class="spin">暂无素材，敬请期待</view>
      <view v-for="m in mats" :key="m.id" class="card m-item">
        <view class="q-top">
          <text class="m-topic">{{ m.topic }}</text>
          <text class="q-type">{{ m.type }}</text>
        </view>
        <text class="m-content" :class="{ clamp: expanded !== m.id }" @click="expanded = expanded === m.id ? 0 : m.id">{{ m.content }}</text>
        <text v-if="m.source" class="m-src">出处：{{ m.source }}</text>
      </view>
      <view v-if="mats.length >= 20" class="more" @click="loadMoreMat">加载更多</view>
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
      qOffset: 0,
      mOffset: 0,
    };
  },
  onLoad() {
    this.loadQs();
  },
  methods: {
    async loadQs(append) {
      this.loading = !append;
      try {
        const t = this.qtype === '全部' ? '' : '&qtype=' + encodeURIComponent(this.qtype);
        const d = await request('/api/shenlun/questions?limit=20&offset=' + this.qOffset + t);
        this.qs = append ? this.qs.concat(d.items || []) : d.items || [];
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
        this.mats = append ? this.mats.concat(d.items || []) : d.items || [];
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    switchMat() {
      this.tab = 'm';
      if (!this.mats.length) this.loadMats();
    },
    setQtype(t) {
      this.qtype = t;
      this.qOffset = 0;
      this.detail = null;
      this.loadQs();
    },
    setMtype(t) {
      this.mtype = t;
      this.mOffset = 0;
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
        this.myAnswer = '';
        this.gradeResult = '';
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
    async grade() {
      if (this.grading || !this.myAnswer.trim()) return;
      this.grading = true;
      this.gradeResult = '';
      try {
        const d = await request('/api/shenlun/grade', {
          method: 'POST',
          data: { qid: this.detail.id, answer: this.myAnswer },
        });
        this.gradeResult = d.result;
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
.m-content { font-size: 25rpx; color: var(--ink-2, #4b5563); line-height: 1.8; white-space: pre-wrap; display: block; margin: 8rpx 0; }
.m-content.clamp { display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
.m-src { font-size: 22rpx; color: var(--ink-3, #9ca3af); }
.d-ta { width: 100%; box-sizing: border-box; min-height: 220rpx; background: #f8f9fc; border: 1rpx solid var(--line, #e5e7eb); border-radius: 12rpx; padding: 18rpx; font-size: 25rpx; line-height: 1.7; }
.grade-btn { margin-top: 16rpx; text-align: center; background: var(--brand, #4f46e5); color: #fff; font-size: 27rpx; font-weight: 600; border-radius: 999rpx; padding: 20rpx 0; }
.grade-btn.dis { opacity: 0.5; }
.d-grade { margin-top: 8rpx; }
.g-note { font-size: 21rpx; color: var(--ink-3, #9ca3af); font-weight: 400; }
.g-body { font-size: 25rpx; color: var(--ink-1, #1f2937); background: #fffbeb; border-radius: 12rpx; padding: 18rpx; line-height: 1.8; white-space: pre-wrap; display: block; }
</style>
