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
          {{ wasCorrect ? (cur._requeued ? '这次答对了，本轮已纠正 ✓' : '答对了！连对 ' + streak + ' 次') : '又错了，看讲解（稍后本轮会再出现）' }}（下次复习：{{ nextDays }} 天后）
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
        <view>
          <text class="duetxt">📚 今日待复习 {{ due.length }} 道</text>
          <text class="duesub">按遗忘曲线安排 · 预计 {{ Math.max(1, Math.ceil(due.length * 0.8)) }} 分钟</text>
        </view>
        <text class="duego">开始复习</text>
      </view>
      <scroll-view v-if="items.length" scroll-x class="chips">
        <view
          v-for="c in chipList"
          :key="c.key"
          class="chip"
          :class="{ on: filterMod === c.key }"
          @click="filterMod = c.key"
        >{{ c.name }}</view>
      </scroll-view>
      <view v-if="loading" class="card spin">加载中…</view>
      <view v-else-if="!items.length" class="card empty">
        <view class="e-ico">📖</view>
        <view class="e-t">错题本还是空的</view>
        <view class="e-s">去拍题讲解或刷题，答错的题会汇集到这里，之后按遗忘曲线安排复习</view>
        <button class="e-btn" @click="goPractice">去刷题</button>
      </view>
      <view v-for="m in shownItems" :key="m.id" class="card mcard" :class="masteryClass(m)" @click="m.open = !m.open">
        <view class="mhead">
          <text class="tag">{{ m.question_type || modName(m.module) }}</text>
          <text v-if="m.review_count" class="rvbadge">已复习{{ m.review_count }}次</text>
        </view>
        <view class="q" :class="{ clamp: !m.open }">{{ (m.question_text || '').slice(0, 200) }}</view>
        <view class="mfoot">
          <text class="meta">{{ fmt(m.created_at) }}</text>
          <view class="acts">
            <text class="op redo" @click.stop="redo(m)">重做</text>
            <text class="op del" @click.stop="del(m)">删除</text>
          </view>
        </view>
        <rich-text v-if="m.open" :nodes="m.html" />
      </view>
    </template>
  </view>
</template>

<script>
import { md } from '../../md.js';
import { request } from '../../api.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };

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
      streak: 0,
      filterMod: '',
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
    chipList() {
      const mods = [...new Set(this.items.map((m) => m.module).filter(Boolean))];
      return [{ key: '', name: '全部' }, ...mods.map((m) => ({ key: m, name: NAMES[m] || m }))];
    },
    shownItems() {
      return this.filterMod ? this.items.filter((m) => m.module === this.filterMod) : this.items;
    },
  },
  onShow() {
    this.load();
  },
  methods: {
    modName(m) {
      return NAMES[m] || m || '';
    },
    masteryClass(m) {
      if (!m.review_count) return 'lv-new';
      return m.review_count >= 2 ? 'lv-good' : 'lv-mid';
    },
    goPractice() {
      uni.switchTab({ url: '/pages/practice/practice' });
    },
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
      this.picked = o;
      await this.record(o === this.curLetter);
    },
    async selfJudge(correct) {
      await this.record(correct);
    },
    async record(correct) {
      this.wasCorrect = correct;
      this.answered = true;
      if (!correct && !this.cur._requeued) {
        this.rItems.push({ ...this.cur, _requeued: true });
      }
      try {
        const res = await request('/api/review/' + this.cur.id, { method: 'POST', data: { correct } });
        this.nextDays = res.next_review_days;
        this.streak = res.streak;
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
.card { background: var(--card); border-radius: var(--radius); padding: 24rpx; margin-bottom: 24rpx; border-left: 6rpx solid var(--brand); border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.empty { text-align: center; padding: 56rpx 32rpx; }
.e-ico { font-size: 72rpx; margin-bottom: 16rpx; }
.e-t { font-size: 32rpx; font-weight: 600; margin-bottom: 10rpx; }
.e-s { font-size: 24rpx; color: var(--ink-2); line-height: 1.7; margin-bottom: 28rpx; }
.e-btn { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border-radius: 18rpx; font-size: 28rpx; font-weight: 600; width: 60%; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; border-left: none; }
.chips { white-space: nowrap; margin-bottom: 24rpx; }
.chip { display: inline-block; padding: 10rpx 30rpx; margin-right: 16rpx; border-radius: 999rpx; background: var(--card); border: 1rpx solid var(--line); font-size: 25rpx; color: var(--ink-2); }
.chip.on { background: var(--brand); border-color: var(--brand); color: #fff; font-weight: 600; }
.mcard { border-left-width: 8rpx; }
.mcard.lv-new { border-left-color: var(--bad); }
.mcard.lv-mid { border-left-color: #f59e0b; }
.mcard.lv-good { border-left-color: var(--ok); }
.mhead { display: flex; align-items: center; gap: 12rpx; }
.rvbadge { font-size: 20rpx; color: var(--ink-2); background: var(--soft-bg); border-radius: 999rpx; padding: 4rpx 14rpx; }
.mfoot { display: flex; justify-content: space-between; align-items: center; margin-top: 12rpx; }
.acts { display: flex; gap: 8rpx; }
.op { font-size: 24rpx; margin-left: 16rpx; padding: 6rpx 20rpx; border-radius: 999rpx; }
.redo { color: var(--brand); border: 1rpx solid var(--brand); }
.del { color: #c33; }
.tag { display: inline-block; background: var(--brand-soft); color: var(--brand); border-radius: 10rpx; padding: 4rpx 14rpx; font-size: 22rpx; }
.q { font-size: 26rpx; line-height: 1.5; margin-top: 10rpx; }
.q.clamp { max-height: 120rpx; overflow: hidden; }
.meta { font-size: 22rpx; color: var(--ink-2); }
.duecard { background: linear-gradient(135deg, #3b6ef6, #7c5cfc); border: none; display: flex; justify-content: space-between; align-items: center; }
.duetxt { display: block; font-size: 28rpx; font-weight: 700; color: #fff; }
.duesub { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.75); margin-top: 6rpx; }
.duego { background: #fff; color: #4f46e5; font-size: 25rpx; font-weight: 600; border-radius: 999rpx; padding: 12rpx 30rpx; }
.review { border-left-color: #f5a623; }
.rhead { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.opts { display: flex; gap: 16rpx; margin: 20rpx 0; }
.opt { flex: 1; text-align: center; padding: 16rpx 0; border: 2rpx solid #d9dee8; border-radius: 12rpx; font-size: 28rpx; }
.opt.ok { background: #e6f7e6; border-color: #3aa53a; color: #2a7a2a; }
.opt.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
.opt.dim { opacity: 0.4; }
.verdict { font-size: 26rpx; font-weight: 600; margin: 12rpx 0; }
.verdict.good { color: #2a7a2a; }
.verdict.badv { color: #b03030; }
.next { margin-top: 20rpx; background: var(--brand); color: #fff; font-size: 28rpx; border-radius: 12rpx; }
.selfjudge { margin-top: 20rpx; }
.q2 { font-size: 24rpx; color: var(--ink-2); margin-bottom: 12rpx; }
.sj { display: inline-block; width: 45%; margin-right: 4%; font-size: 26rpx; border-radius: 12rpx; }
.sj.ok { background: #e6f7e6; color: #2a7a2a; }
.sj.bad { background: var(--bad-soft); color: var(--bad); }
</style>
