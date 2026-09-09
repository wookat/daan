<template>
  <kg-card v-if="data" variant="flat" class="rcard">
    <view class="r-head">
      <text class="r-title">全卷排名</text>
      <text v-if="data.small_sample" class="r-tag">样本 {{ data.total }} 人</text>
    </view>
    <view class="r-main">
      <view v-if="beatView.pct != null" class="r-beat">
        <text class="r-beat-n">{{ beatView.pct }}%</text>
        <text class="r-beat-l">{{ beatView.label }}</text>
      </view>
      <view v-else class="r-beat">
        <text class="r-beat-tiny">{{ beatView.line }}</text>
      </view>
      <view class="r-kv">
        <view class="r-kv-i"><text class="r-k">排名</text><text class="r-v">{{ data.rank }}<text class="r-v-s">/{{ data.total }}</text></text></view>
        <view class="r-kv-i"><text class="r-k">平均分</text><text class="r-v">{{ data.avg }}</text></view>
      </view>
    </view>
    <!-- 分数分布 -->
    <view class="r-dist">
      <view v-for="(n, i) in data.distribution" :key="i" class="r-col">
        <view class="r-bar-w"><view class="r-bar" :class="{ me: i === data.my_bucket }" :style="{ height: barH(n) + '%' }" /></view>
        <text class="r-col-l">{{ i * 10 }}</text>
      </view>
    </view>
    <text class="r-hint">你在 {{ data.my_bucket * 10 }}-{{ data.my_bucket * 10 + 10 }} 分段（蓝色）</text>
    <!-- 同卷排行榜（每人取最高分口径，与超过比例一致） -->
    <view v-if="boardRows" class="r-board">
      <text class="r-board-t">同卷排行榜</text>
      <view v-for="b in boardRows" :key="b.rank + b.name" class="r-brow" :class="{ me: b.me }">
        <text class="r-brank">{{ b.rank }}</text>
        <text class="r-bname">{{ b.name }}<text v-if="b.me && b.name !== '我'" class="r-bme">（我）</text></text>
        <text class="r-bscore">{{ b.score }} 分</text>
      </view>
    </view>
  </kg-card>
</template>

<script>
import { request, anonUid } from '../../api.js';
import { examBoardRows } from '../../exam-board.js';
import { rankCardView } from '../../exam-copy.js';

export default {
  name: 'RankCard',
  props: { attemptId: { type: [Number, String], required: true } },
  data() {
    return { data: null };
  },
  computed: {
    beatView() {
      return rankCardView(this.data);
    },
    boardRows() {
      return examBoardRows(this.data);
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    async load() {
      try {
        this.data = await request('/api/exam/rank/' + this.attemptId + '?uid=' + encodeURIComponent(anonUid()));
        if (this.data) this.$emit('loaded', this.data);
      } catch (e) {
        this.data = null;
      }
    },
    barH(n) {
      const max = Math.max(...this.data.distribution, 1);
      return n ? 15 + (n / max) * 85 : 4;
    }
  }
};
</script>

<style scoped>
.r-head { display: flex; justify-content: space-between; align-items: center; }
.r-title { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.r-tag { font-size: var(--fs-caption); color: var(--warn-strong); background: var(--warn-soft); border-radius: var(--r-full); padding: 2px var(--sp-8); }
.r-main { display: flex; align-items: center; gap: var(--sp-20); margin: var(--sp-12) 0 var(--sp-4); }
.r-beat { display: flex; flex-direction: column; }
.r-beat-n { font-size: var(--fs-h1); font-weight: 600; color: var(--brand-text); line-height: 1.1; }
.r-beat-l { font-size: var(--fs-caption); color: var(--ink-2); }
.r-beat-tiny { font-size: var(--fs-caption); color: var(--ink-2); line-height: 1.6; }
.r-kv { display: flex; gap: var(--sp-20); }
.r-kv-i { display: flex; flex-direction: column; }
.r-k { font-size: var(--fs-caption); color: var(--ink-3); }
.r-v { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.r-v-s { font-size: var(--fs-caption); color: var(--ink-3); font-weight: 400; }
.r-dist { display: flex; align-items: flex-end; gap: var(--sp-4); height: 70px; margin-top: var(--sp-8); }
.r-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.r-bar-w { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.r-bar { width: 60%; min-height: 2px; background: var(--line); border-radius: 2px 2px 0 0; }
.r-bar.me { background: var(--brand); }
.r-col-l { font-size: var(--fs-caption); color: var(--ink-3); margin-top: 2px; }
.r-hint { font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }
.r-board { margin-top: var(--sp-12); border-top: 1px solid var(--line); padding-top: var(--sp-8); }
.r-board-t { font-size: var(--fs-sub); font-weight: 600; color: var(--ink); display: block; margin-bottom: var(--sp-4); }
.r-brow { display: flex; align-items: center; gap: var(--sp-8); padding: var(--sp-4) 6px; border-radius: var(--r-xs); }
.r-brow.me { background: var(--brand-soft); }
.r-brank { width: 22px; font-size: var(--fs-sub); font-weight: 600; color: var(--ink-3); text-align: center; }
.r-brow.me .r-brank { color: var(--brand-text); }
.r-bname { flex: 1; font-size: var(--fs-sub); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.r-bme { font-size: var(--fs-caption); color: var(--brand-text); }
.r-bscore { font-size: var(--fs-sub); font-weight: 600; color: var(--ink); }
</style>
