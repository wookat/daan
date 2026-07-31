<template>
  <view class="wrap">
    <view class="hero">
      <text class="hero-t">花生十三错题助手</text>
      <text class="hero-s">拍题即得你学的方法体系讲解</text>
    </view>
    <view class="today">
      <view class="goal-ring" :class="{ hit: todayDone >= goal }" :style="goalRingStyle" @click="cycleGoal">
        <view class="goal-in">
          <text class="goal-n">{{ todayDone }}</text>
          <text class="goal-t">/{{ goal }}题</text>
        </view>
      </view>
      <view class="today-l">
        <text class="today-t">{{ todayDone >= goal ? '🎉 今日目标达成' : '今日 ' + todayDone + '/' + goal + ' 题' }}</text>
        <text class="today-s">{{ streakDays > 0 ? '🔥 连续打卡 ' + streakDays + ' 天' : '开始今天的练习吧' }}</text>
      </view>
      <view class="today-btn" @click="goPractice">{{ dueCount > 0 ? '先复习 ' + dueCount + ' 道' : '继续刷题 ›' }}</view>
    </view>
    <view class="card">
      <view class="seg">
        <view class="seg-i" :class="{ on: mode === 'img' }" @click="mode = 'img'">📷 拍图识题</view>
        <view class="seg-i" :class="{ on: mode === 'text' }" @click="mode = 'text'">⌨️ 粘贴文字</view>
      </view>
      <template v-if="mode === 'img'">
        <view v-if="!imagePath" class="drop" @click="pickImage">
          <text class="drop-ico">📷</text>
          <text class="drop-t">拍照 / 从相册选择</text>
          <text class="drop-s">支持错题截图、试卷拍照</text>
        </view>
        <view v-if="imagePath" class="preview-wrap">
          <image :src="imagePath" mode="widthFix" class="preview" />
          <view class="preview-x" @click="clearImage">✕ 移除图片</view>
        </view>
      </template>
      <template v-else>
        <textarea v-model="qtext" class="ta" placeholder="粘贴题干和选项…" :maxlength="-1" auto-height />
      </template>
      <text class="label">你选的答案（可选，填了会帮你分析错因）</text>
      <input v-model="uanswer" class="inp" placeholder="如：A" maxlength="10" />
      <view style="height: 24rpx" />
      <button class="btn" :disabled="loading" @click="doExplain">用花生十三方法讲解</button>
    </view>

    <view v-if="loading" class="card spin">{{ loadingText }}</view>
    <view v-if="error" class="card err">失败：{{ error }}，请重试</view>

    <view v-for="(r, i) in results" :key="r.ts" class="card">
      <view v-if="i > 0" class="hist" @click="r.folded = !r.folded">🕓 历史讲解（点此展开/折叠）</view>
      <template v-if="i === 0 || !r.folded">
        <view class="tags">
          <text class="tag">{{ r.module_name }}</text>
          <text class="tag">{{ r.question_type }}</text>
        </view>
        <rich-text :nodes="r.html" />
        <view style="height: 20rpx" />
        <view class="row">
          <button class="btn ghost sm" :disabled="r.saved" @click="save(r)">{{ r.saved ? '✓ 已存入错题本' : '存入错题本' }}</button>
          <button class="btn ghost sm" :disabled="r.simLoading" @click="genSimilar(r)">{{ r.simLoading ? '出题中…（' + r.simSecs + '秒）' : '举一反三' }}</button>
        </view>
        <view v-if="r.sim" class="simbox">
          <view class="dash" />
          <rich-text :nodes="r.sim.qHtml" />
          <text class="label">先选你的答案再看解析：</text>
          <view class="row">
            <button
              v-for="o in ['A', 'B', 'C', 'D']"
              :key="o"
              class="btn ghost sm"
              :class="optClass(r, o)"
              :disabled="!!r.sim.picked"
              @click="pick(r, o)"
            >{{ o }}</button>
          </view>
          <view v-if="r.sim.picked && r.sim.ansHtml">
            <rich-text :nodes="r.sim.ansHtml" />
            <view class="row">
              <button class="btn ghost sm" @click="explainSim(r)">用花生十三方法详解这道题</button>
              <button
                v-if="r.sim.correct && r.sim.picked !== r.sim.correct"
                class="btn ghost sm"
                :disabled="r.sim.saved"
                @click="saveSim(r)"
              >{{ r.sim.saved ? '✓ 已存入错题本' : '存入错题本' }}</button>
            </view>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script>
import { md } from '../../md.js';
import { request, uploadExplain, streamExplain } from '../../api.js';

export default {
  data() {
    return {
      mode: 'img',
      imagePath: '',
      imageFile: null,
      qtext: '',
      uanswer: '',
      loading: false,
      loadingText: '',
      error: '',
      results: [],
      timer: null,
      todayDone: 0,
      streakDays: 0,
      dueCount: 0,
      goal: uni.getStorageSync('dailyGoal') || 20,
    };
  },
  computed: {
    goalRingStyle() {
      const pct = Math.min(100, Math.round((this.todayDone / this.goal) * 100));
      const c = this.todayDone >= this.goal ? '#f59e0b' : '#ffffff';
      return { background: `conic-gradient(${c} 0% ${pct}%, rgba(255,255,255,0.25) ${pct}% 100%)` };
    },
  },
  onShow() {
    this.loadToday();
    const redo = uni.getStorageSync('redoQuestion');
    if (redo) {
      this.mode = 'text';
      this.qtext = redo;
      this.uanswer = '';
      this.imagePath = '';
      this.imageFile = null;
      uni.removeStorageSync('redoQuestion');
      uni.showToast({ title: '题目已填入，先自己做一遍再点讲解', icon: 'none', duration: 2500 });
    }
  },
  methods: {
    cycleGoal() {
      const opts = [10, 20, 50];
      this.goal = opts[(opts.indexOf(this.goal) + 1) % opts.length];
      uni.setStorageSync('dailyGoal', this.goal);
      uni.showToast({ title: '每日目标：' + this.goal + ' 题', icon: 'none', duration: 800 });
    },
    goPractice() {
      const target = this.dueCount > 0 ? '/pages/book/book' : '/pages/practice/practice';
      uni.switchTab({ url: target });
    },
    async loadToday() {
      const s = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
      const days = s.days || {};
      const todayKey = new Date().toISOString().slice(0, 10);
      this.todayDone = days[todayKey] || 0;
      let n = 0;
      const d = new Date();
      if (!days[todayKey]) d.setDate(d.getDate() - 1);
      for (;;) {
        const key = d.toISOString().slice(0, 10);
        if (days[key]) {
          n++;
          d.setDate(d.getDate() - 1);
        } else break;
      }
      this.streakDays = n;
      try {
        const r = await request('/api/review');
        this.dueCount = (r.items || []).length;
      } catch (e) {
        this.dueCount = 0;
      }
    },
    clearImage() {
      this.imagePath = '';
      this.imageFile = null;
    },
    pickImage() {
      uni.chooseImage({
        count: 1,
        success: (res) => {
          this.imagePath = res.tempFilePaths[0];
          this.imageFile = (res.tempFiles && res.tempFiles[0]) || null;
        },
      });
    },
    startTimer() {
      let secs = 0;
      this.loadingText = '⏳ AI 识题中…（0秒）';
      this.timer = setInterval(() => {
        secs++;
        this.loadingText = secs < 8 ? `⏳ AI 识题中…（${secs}秒）`
          : secs < 25 ? `🧭 已识题，正在匹配花生十三方法…（${secs}秒）`
          : `✍️ 正在生成分步讲解，马上好…（${secs}秒）`;
      }, 1000);
    },
    async doExplain() {
      const useImg = this.mode === 'img';
      const img = useImg ? this.imagePath : '';
      const imgFile = useImg ? this.imageFile : null;
      const txt = useImg ? '' : this.qtext.trim();
      if (!img && !txt) {
        uni.showToast({ title: useImg ? '请先选择图片' : '请粘贴题目文字', icon: 'none' });
        return;
      }
      this.loading = true;
      this.error = '';
      this.startTimer();
      try {
        let d;
        // #ifdef H5
        const rec = {
          ts: Date.now(),
          module_name: '',
          question_type: '',
          html: '',
          saved: false,
          folded: false,
          sim: null,
          simLoading: false,
          simSecs: 0,
          streaming: true,
        };
        if (img && !imgFile) {
          // 无 File 对象（如重做回填），退回非流式
          d = await uploadExplain({
            filePath: img,
            text: txt || null,
            userAnswer: this.uanswer.trim() || null,
          });
          this.results.unshift({ ...rec, ...d, html: md(d.explanation), streaming: false });
          this.results.forEach((r, i) => { if (i > 0) r.folded = true; });
          clearInterval(this.timer);
          this.loading = false;
          return;
        }
        let inserted = false;
        let live = rec; // 插入后改用响应式代理，保证增量更新触发渲染
        d = await streamExplain({
          file: imgFile,
          text: txt || null,
          userAnswer: this.uanswer.trim() || null,
          onMeta: (m) => {
            Object.assign(rec, m);
            this.results.unshift(rec);
            this.results.forEach((r, i) => { if (i > 0) r.folded = true; });
            live = this.results[0];
            inserted = true;
            clearInterval(this.timer);
            this.loading = false;
          },
          onDelta: (full) => { live.html = md(full); },
        });
        Object.assign(live, d, { html: md(d.explanation), streaming: false });
        if (!inserted) {
          this.results.unshift(rec);
          this.results.forEach((r, i) => { if (i > 0) r.folded = true; });
        }
        // #endif
        // #ifndef H5
        d = await uploadExplain({
          filePath: img || null,
          text: txt || null,
          userAnswer: this.uanswer.trim() || null,
        });
        this.results.unshift({
          ...d,
          ts: Date.now(),
          html: md(d.explanation),
          saved: false,
          folded: false,
          sim: null,
          simLoading: false,
          simSecs: 0,
        });
        this.results.forEach((r, i) => { if (i > 0) r.folded = true; });
        // #endif
      } catch (e) {
        this.error = e.message;
      }
      clearInterval(this.timer);
      this.loading = false;
    },
    async save(r) {
      if (r.saved) return;
      await request('/api/mistakes', {
        method: 'POST',
        data: {
          module: r.module,
          question_type: r.question_type,
          question_text: r.question_text,
          user_answer: r.user_answer,
          explanation: r.explanation,
        },
      });
      r.saved = true;
    },
    async genSimilar(r) {
      r.simLoading = true;
      r.simSecs = 0;
      const t = setInterval(() => { r.simSecs++; }, 1000);
      try {
        const d = await request('/api/similar', {
          method: 'POST',
          data: { question_text: r.question_text, question_type: r.question_type },
        });
        const parts = d.content.split('<!--answer-->');
        const m = (parts[1] || '').match(/答案[：:\s*]*([A-D])/);
        r.sim = {
          raw: parts[0],
          rawAns: parts[1] || '',
          qHtml: md(parts[0]),
          ansHtml: parts[1] ? md(parts[1]) : '',
          correct: m ? m[1] : null,
          picked: '',
          saved: false,
        };
      } catch (e) {
        uni.showToast({ title: '出题失败：' + e.message, icon: 'none' });
      }
      clearInterval(t);
      r.simLoading = false;
    },
    pick(r, o) {
      r.sim.picked = o;
    },
    optClass(r, o) {
      if (!r.sim || !r.sim.picked) return '';
      if (r.sim.correct && o === r.sim.correct) return 'ok';
      if (o === r.sim.picked && r.sim.correct && o !== r.sim.correct) return 'bad';
      return 'dim';
    },
    async saveSim(r) {
      if (r.sim.saved) return;
      const qtext = (r.sim.raw || '').replace(/^##\s*练习题\s*/, '').replace(/##\s*提示[\s\S]*$/, '').trim();
      await request('/api/mistakes', {
        method: 'POST',
        data: {
          module: r.module,
          question_type: r.question_type,
          question_text: qtext,
          user_answer: r.sim.picked,
          correct_answer: r.sim.correct,
          explanation: ((r.sim.raw || '') + '\n' + (r.sim.rawAns || '')).trim(),
        },
      });
      r.sim.saved = true;
      uni.showToast({ title: '已存入错题本', icon: 'success' });
    },
    explainSim(r) {
      this.mode = 'text';
      this.qtext = (r.sim.raw || '').replace(/^##\s*练习题\s*/, '').replace(/##\s*提示[\s\S]*$/, '').trim();
      this.uanswer = r.sim.picked || '';
      this.imagePath = '';
      this.imageFile = null;
      uni.pageScrollTo({ scrollTop: 0, duration: 200 });
      this.doExplain();
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.hero { padding: 28rpx 8rpx 20rpx; }
.hero-t { display: block; font-size: 40rpx; font-weight: 700; color: var(--ink); letter-spacing: 1rpx; }
.hero-s { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 6rpx; }
.today { display: flex; justify-content: space-between; align-items: center; gap: 20rpx; background: linear-gradient(135deg, #3b6ef6, #7c5cfc); border-radius: var(--radius); padding: 26rpx 30rpx; margin-bottom: 24rpx; }
.goal-ring { flex-shrink: 0; width: 112rpx; height: 112rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.goal-in { width: 88rpx; height: 88rpx; border-radius: 50%; background: rgba(30, 41, 99, 0.35); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.goal-n { font-size: 30rpx; font-weight: 700; color: #fff; line-height: 1.1; }
.goal-t { font-size: 17rpx; color: rgba(255, 255, 255, 0.8); }
.today-l { flex: 1; min-width: 0; }
.today-t { display: block; font-size: 28rpx; font-weight: 700; color: #fff; }
.today-s { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.78); margin-top: 6rpx; }
.today-btn { background: #fff; color: #4f46e5; font-size: 25rpx; font-weight: 600; border-radius: 999rpx; padding: 12rpx 28rpx; flex-shrink: 0; }
.drop { border: 2rpx dashed var(--brand); background: var(--brand-soft); border-radius: 24rpx; padding: 48rpx 24rpx; text-align: center; margin-bottom: 8rpx; }
.drop-ico { display: block; font-size: 64rpx; margin-bottom: 12rpx; }
.drop-t { display: block; font-size: 29rpx; font-weight: 600; color: var(--brand); }
.drop-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 8rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.label { font-size: 24rpx; color: var(--ink-2); display: block; margin: 20rpx 0 10rpx; }
.seg { display: flex; background: var(--soft-bg); border-radius: 16rpx; padding: 6rpx; margin-bottom: 20rpx; }
.seg-i { flex: 1; text-align: center; padding: 14rpx 0; font-size: 27rpx; color: var(--ink-2); border-radius: 12rpx; }
.seg-i.on { background: var(--card); color: var(--brand); font-weight: 600; box-shadow: 0 2rpx 8rpx rgba(31, 36, 48, 0.08); }
.btn { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border-radius: 18rpx; font-size: 30rpx; font-weight: 600; box-shadow: 0 6rpx 16rpx rgba(79, 70, 229, 0.25); }
.btn[disabled] { opacity: 0.6; }
.btn.ghost { background: var(--brand-soft); color: var(--brand); box-shadow: none; }
.btn.sm { font-size: 26rpx; flex: 1; }
.btn.ok { background: var(--ok); color: #fff; opacity: 1 !important; box-shadow: none; }
.btn.bad { background: var(--bad); color: #fff; box-shadow: none; }
.btn.dim { opacity: 0.35; }
.ta { width: 100%; min-height: 160rpx; border: 1rpx solid var(--line); border-radius: 18rpx; padding: 18rpx; font-size: 28rpx; box-sizing: border-box; background: var(--soft-bg); }
.inp { width: 100%; border: 1rpx solid var(--line); border-radius: 18rpx; padding: 18rpx; font-size: 28rpx; box-sizing: border-box; background: var(--soft-bg); }
.preview-wrap { position: relative; }
.preview-x {
  display: inline-block;
  margin-top: 8rpx;
  padding: 8rpx 24rpx;
  border-radius: 999rpx;
  background: var(--bad-soft);
  color: var(--bad);
  font-size: 24rpx;
}
.preview { width: 100%; border-radius: 18rpx; margin-top: 14rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; }
.err { color: var(--bad); background: var(--bad-soft); font-size: 26rpx; }
.tags { margin-bottom: 10rpx; }
.tag { display: inline-block; background: var(--brand-soft); color: var(--brand); border-radius: 999rpx; padding: 6rpx 20rpx; font-size: 22rpx; margin-right: 10rpx; }
.row { display: flex; gap: 14rpx; margin: 10rpx 0; }
.hist { font-size: 22rpx; color: var(--ink-2); margin-bottom: 10rpx; }
.dash { border-top: 1rpx dashed var(--line); margin: 20rpx 0; }
.simbox { margin-top: 10rpx; }
</style>
