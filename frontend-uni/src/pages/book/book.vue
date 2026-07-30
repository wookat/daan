<template>
  <view class="wrap">
    <!-- 复习模式 -->
    <view v-if="reviewing" class="card review">
      <view class="rhead">
        <text class="tag">复习 {{ rIdx + 1 }}/{{ rItems.length }}</text>
        <text class="op" @click="exitReview">退出复习</text>
      </view>
      <view class="q">{{ cur.question_text }}</view>
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
          {{ wasCorrect ? '答对了！' : '又错了，看讲解' }}（下次复习：{{ nextDays }} 天后）
        </view>
        <rich-text :nodes="curHtml" />
        <button class="next" @click="nextReview">{{ rIdx + 1 < rItems.length ? '下一题' : '完成复习' }}</button>
      </view>
      <view v-else-if="!curLetter" class="selfjudge">
        <view class="q2">先自己做，然后：</view>
        <button class="sj ok" @click="selfJudge(true)">我做对了</button>
        <button class="sj bad" @click="selfJudge(false)">我做错了</button>
      </view>
    </view>

    <!-- 列表模式 -->
    <template v-else>
      <view v-if="due.length" class="card duecard" @click="startReview">
        <text class="duetxt">📚 有 {{ due.length }} 道错题待复习</text>
        <text class="duego">开始复习 ›</text>
      </view>
      <view v-if="loading" class="card spin">加载中…</view>
      <view v-else-if="!items.length" class="card spin">错题本还是空的</view>
      <view v-for="m in items" :key="m.id" class="card" @click="m.open = !m.open">
        <view class="ops">
          <text class="op redo" @click.stop="redo(m)">重做</text>
          <text class="op del" @click.stop="del(m)">删除</text>
        </view>
        <text class="tag">{{ m.question_type || m.module || '' }}</text>
        <view class="q" :class="{ clamp: !m.open }">{{ (m.question_text || '').slice(0, 200) }}</view>
        <view class="meta">{{ fmt(m.created_at) }}<template v-if="m.review_count"> · 已复习{{ m.review_count }}次</template></view>
        <rich-text v-if="m.open" :nodes="m.html" />
      </view>
    </template>
  </view>
</template>

<script>
import { md } from '../../md.js';
import { request } from '../../api.js';

function extractLetter(s) {
  const m = /[A-D]/.exec(String(s || '').toUpperCase());
  return m ? m[0] : null;
}

export default {
  data() {
    return {
      items: [],
      loading: true,
      due: [],
      reviewing: false,
      rItems: [],
      rIdx: 0,
      picked: null,
      answered: false,
      wasCorrect: false,
      nextDays: 0,
    };
  },
  computed: {
    cur() {
      return this.rItems[this.rIdx] || {};
    },
    curLetter() {
      return extractLetter(this.cur.correct_answer);
    },
    curHtml() {
      return md(this.cur.explanation || '');
    },
  },
  onShow() {
    this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      try {
        const [d, r] = await Promise.all([request('/api/mistakes'), request('/api/review')]);
        this.items = d.items.map((m) => ({ ...m, open: false, html: md(m.explanation || '') }));
        this.due = r.items;
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    startReview() {
      this.rItems = this.due;
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
      this.picked = o;
      await this.record(o === this.curLetter);
    },
    async selfJudge(correct) {
      await this.record(correct);
    },
    async record(correct) {
      this.wasCorrect = correct;
      this.answered = true;
      try {
        const res = await request('/api/review/' + this.cur.id, { method: 'POST', data: { correct } });
        this.nextDays = res.next_review_days;
      } catch (e) {
        uni.showToast({ title: '记录失败：' + e.message, icon: 'none' });
      }
    },
    nextReview() {
      if (this.rIdx + 1 < this.rItems.length) {
        this.rIdx++;
        this.resetQ();
      } else {
        this.exitReview();
        uni.showToast({ title: '本轮复习完成！', icon: 'success' });
      }
    },
    exitReview() {
      this.reviewing = false;
      this.load();
    },
    optClass(o) {
      if (!this.answered) return '';
      if (o === this.curLetter) return 'ok';
      if (o === this.picked) return 'bad';
      return 'dim';
    },
    fmt(ts) {
      return new Date(ts * 1000).toLocaleString('zh-CN');
    },
    redo(m) {
      uni.setStorageSync('redoQuestion', m.question_text || '');
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    del(m) {
      uni.showModal({
        title: '确定删除这道错题？',
        success: async (res) => {
          if (!res.confirm) return;
          await request('/api/mistakes/' + m.id, { method: 'DELETE' });
          this.load();
        },
      });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx; border-left: 6rpx solid #2f6fed; box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.06); }
.spin { text-align: center; color: #8a90a0; font-size: 26rpx; border-left: none; }
.ops { float: right; }
.op { font-size: 24rpx; margin-left: 20rpx; padding: 4rpx 8rpx; color: #8a90a0; }
.redo { color: #2f6fed; }
.del { color: #c33; }
.tag { display: inline-block; background: #eef2ff; color: #2f6fed; border-radius: 10rpx; padding: 4rpx 14rpx; font-size: 22rpx; }
.q { font-size: 26rpx; line-height: 1.5; margin-top: 10rpx; }
.q.clamp { max-height: 120rpx; overflow: hidden; }
.meta { font-size: 22rpx; color: #8a90a0; margin-top: 10rpx; }
.duecard { border-left-color: #f5a623; display: flex; justify-content: space-between; align-items: center; }
.duetxt { font-size: 26rpx; font-weight: 600; }
.duego { color: #f5a623; font-size: 24rpx; }
.review { border-left-color: #f5a623; }
.rhead { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.opts { display: flex; gap: 16rpx; margin: 20rpx 0; }
.opt { flex: 1; text-align: center; padding: 16rpx 0; border: 2rpx solid #d9dee8; border-radius: 12rpx; font-size: 28rpx; }
.opt.ok { background: #e6f7e6; border-color: #3aa53a; color: #2a7a2a; }
.opt.bad { background: #fdeaea; border-color: #d05050; color: #b03030; }
.opt.dim { opacity: 0.4; }
.verdict { font-size: 26rpx; font-weight: 600; margin: 12rpx 0; }
.verdict.good { color: #2a7a2a; }
.verdict.badv { color: #b03030; }
.next { margin-top: 20rpx; background: #2f6fed; color: #fff; font-size: 28rpx; border-radius: 12rpx; }
.selfjudge { margin-top: 20rpx; }
.q2 { font-size: 24rpx; color: #8a90a0; margin-bottom: 12rpx; }
.sj { display: inline-block; width: 45%; margin-right: 4%; font-size: 26rpx; border-radius: 12rpx; }
.sj.ok { background: #e6f7e6; color: #2a7a2a; }
.sj.bad { background: #fdeaea; color: #b03030; }
</style>
