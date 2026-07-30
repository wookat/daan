<template>
  <view class="wrap">
    <!-- 选模块 -->
    <view v-if="!session" class="card">
      <view class="h">选择模块开始刷题</view>
      <view v-if="!counts.length" class="spin">题库为空，敬请期待</view>
      <view class="grid">
        <view
          v-for="c in counts"
          :key="c.module"
          class="mcard"
          @click="start(c.module)"
        >
          <text class="mname">{{ modName(c.module) }}</text>
          <text class="mn">{{ c.n }} 题</text>
        </view>
        <view v-if="counts.length" class="mcard all" @click="start(null)">
          <text class="mname">混合刷题</text>
          <text class="mn">全部模块</text>
        </view>
      </view>
    </view>

    <!-- 答题 -->
    <view v-if="session && cur" class="card">
      <view class="rhead">
        <text class="tag">{{ modName(cur.module) }} · {{ idx + 1 }}/{{ items.length }}</text>
        <text class="op" @click="quit">退出</text>
      </view>
      <view class="q">{{ cur.question }}</view>
      <view
        v-for="(v, k) in cur.options"
        :key="k"
        class="opt"
        :class="optClass(k)"
        @click="pick(k)"
      >
        <text class="ok-k">{{ k }}.</text> {{ v }}
      </view>
      <view v-if="picked" class="after">
        <view class="verdict" :class="picked === cur.answer ? 'good' : 'badv'">
          {{ picked === cur.answer ? '✓ 答对了' : '✗ 答错了，正确答案 ' + cur.answer }}
        </view>
        <view v-if="cur.explanation" class="exp">{{ cur.explanation }}</view>
        <view class="row">
          <button v-if="picked !== cur.answer" class="btn ghost sm" :disabled="cur._saved" @click="saveWrong">
            {{ cur._saved ? '✓ 已存入错题本' : '存入错题本' }}
          </button>
          <button class="btn sm" @click="next">{{ idx + 1 < items.length ? '下一题' : '完成' }}</button>
        </view>
      </view>
    </view>

    <!-- 完成 -->
    <view v-if="session && !cur" class="card done">
      <view class="big">🎉 本组完成</view>
      <view class="sub">答对 {{ right }}/{{ items.length }}，答错的已可存入错题本复习</view>
      <button class="btn" @click="start(lastModule)">再来一组</button>
      <button class="btn ghost" style="margin-top: 16rpx" @click="quit">返回选模块</button>
    </view>
  </view>
</template>

<script>
import { request } from '../../api.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };

export default {
  data() {
    return { counts: [], session: false, items: [], idx: 0, picked: '', right: 0, lastModule: null };
  },
  computed: {
    cur() {
      return this.items[this.idx] || null;
    },
  },
  onShow() {
    this.loadCounts();
  },
  methods: {
    modName(m) {
      return NAMES[m] || m || '未知';
    },
    async loadCounts() {
      try {
        const d = await request('/api/questions?limit=1');
        this.counts = d.counts || [];
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
    async start(module) {
      this.lastModule = module;
      try {
        const d = await request('/api/questions?limit=10' + (module ? '&module=' + module : ''));
        if (!d.items.length) {
          uni.showToast({ title: '该模块暂无题目', icon: 'none' });
          return;
        }
        this.items = d.items.map((q) => ({ ...q, _saved: false }));
        this.idx = 0;
        this.picked = '';
        this.right = 0;
        this.session = true;
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
    pick(k) {
      if (this.picked) return;
      this.picked = k;
      if (k === this.cur.answer) this.right++;
    },
    optClass(k) {
      if (!this.picked) return '';
      if (k === this.cur.answer) return 'right';
      if (k === this.picked) return 'wrong';
      return 'dim';
    },
    async saveWrong() {
      const q = this.cur;
      if (q._saved) return;
      const optText = Object.entries(q.options).map(([k, v]) => `${k}.${v}`).join(' ');
      await request('/api/mistakes', {
        method: 'POST',
        data: {
          module: q.module,
          question_type: q.question_type,
          question_text: q.question + '\n' + optText,
          user_answer: this.picked,
          correct_answer: q.answer,
          explanation: q.explanation || '',
        },
      });
      q._saved = true;
      uni.showToast({ title: '已存入错题本', icon: 'success' });
    },
    next() {
      this.idx++;
      this.picked = '';
    },
    quit() {
      this.session = false;
      this.items = [];
      this.idx = 0;
      this.picked = '';
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.card { background: #fff; border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 600; margin-bottom: 20rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 24rpx; }
.grid { display: flex; flex-wrap: wrap; gap: 20rpx; }
.mcard { width: calc(50% - 10rpx); box-sizing: border-box; background: var(--brand-soft); border-radius: 20rpx; padding: 28rpx 24rpx; }
.mcard.all { background: linear-gradient(135deg, #6366f1, #4f46e5); }
.mcard.all .mname, .mcard.all .mn { color: #fff; }
.mname { display: block; font-size: 30rpx; font-weight: 600; color: var(--brand); }
.mn { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 6rpx; }
.rhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.tag { display: inline-block; background: var(--brand-soft); color: var(--brand); border-radius: 999rpx; padding: 6rpx 20rpx; font-size: 22rpx; }
.op { font-size: 24rpx; color: var(--ink-2); }
.q { font-size: 28rpx; line-height: 1.7; margin-bottom: 20rpx; white-space: pre-wrap; }
.opt { border: 1rpx solid var(--line); border-radius: 16rpx; padding: 20rpx; margin-bottom: 14rpx; font-size: 27rpx; line-height: 1.6; }
.opt .ok-k { font-weight: 600; color: var(--brand); margin-right: 6rpx; }
.opt.right { background: var(--ok-soft); border-color: var(--ok); }
.opt.right .ok-k { color: var(--ok); }
.opt.wrong { background: var(--bad-soft); border-color: var(--bad); }
.opt.wrong .ok-k { color: var(--bad); }
.opt.dim { opacity: 0.55; }
.after { margin-top: 8rpx; }
.verdict { font-size: 28rpx; font-weight: 600; margin-bottom: 12rpx; }
.verdict.good { color: var(--ok); }
.verdict.badv { color: var(--bad); }
.exp { background: #f8f9fc; border-radius: 14rpx; padding: 20rpx; font-size: 25rpx; line-height: 1.7; color: var(--ink); white-space: pre-wrap; margin-bottom: 16rpx; }
.row { display: flex; gap: 16rpx; }
.btn { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border-radius: 18rpx; font-size: 30rpx; font-weight: 600; box-shadow: 0 6rpx 16rpx rgba(79, 70, 229, 0.25); }
.btn.ghost { background: var(--brand-soft); color: var(--brand); box-shadow: none; }
.btn.sm { font-size: 26rpx; padding: 0 30rpx; line-height: 2.6; flex: 1; }
.btn[disabled] { opacity: 0.6; }
.done { text-align: center; padding: 48rpx 28rpx; }
.big { font-size: 40rpx; font-weight: 700; margin-bottom: 12rpx; }
.sub { font-size: 26rpx; color: var(--ink-2); margin-bottom: 28rpx; }
</style>
