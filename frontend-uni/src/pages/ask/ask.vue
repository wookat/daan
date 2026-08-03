<template>
  <view class="wrap">
    <view class="hero">
      <text class="hero-t">拍题讲解</text>
      <text class="hero-s">拍题即得花生十三方法体系讲解</text>
    </view>
    <view class="today">
      <view class="goal-ring" :class="{ hit: todayDone >= goal }" :style="goalRingStyle" @click="cycleGoal">
        <view class="goal-in">
          <text class="goal-n">{{ todayDone }}<text class="goal-t">/{{ goal }}</text></text>
        </view>
      </view>
      <view class="today-l">
        <text class="today-t">{{ todayDone >= goal ? '今日目标达成' : '今日 ' + todayDone + '/' + goal + ' 题' }}</text>
        <view class="today-s"><uni-icons v-if="streakDays > 0" type="fire-filled" size="14" color="#ffd6a0" /><text class="today-s-t">{{ streakDays > 0 ? '连续打卡 ' + streakDays + ' 天' : '开始今天的练习吧' }}</text></view>
      </view>
      <text class="today-link" @click="goPractice">{{ dueCount > 0 ? '复习 ' + Math.min(dueCount, 20) + ' 道 ›' : '继续刷题 ›' }}</text>
    </view>
    <view class="card">
      <view class="seg">
        <view class="seg-i" :class="{ on: mode === 'img' }" @click="mode = 'img'"><uni-icons type="camera-filled" size="16" :color="mode === 'img' ? '#3b6ff5' : '#8a90a0'" /><text class="seg-t">拍图识题</text></view>
        <view class="seg-i" :class="{ on: mode === 'text' }" @click="mode = 'text'"><uni-icons type="compose" size="16" :color="mode === 'text' ? '#3b6ff5' : '#8a90a0'" /><text class="seg-t">粘贴文字</text></view>
      </view>
      <template v-if="mode === 'img'">
        <view v-if="!imagePath" class="drop" @click="pickImage">
          <view class="drop-ico"><uni-icons type="camera-filled" size="44" color="#3b6ff5" /></view>
          <text class="drop-t">拍照 / 从相册选择</text>
          <text class="drop-s">支持错题截图、试卷拍照</text>
        </view>
        <view v-if="imagePath" class="preview-wrap">
          <image :src="imagePath" mode="widthFix" class="preview" />
          <view class="preview-x" @click="clearImage"><uni-icons type="closeempty" size="14" color="#dc2626" /><text> 移除图片</text></view>
        </view>
      </template>
      <template v-else>
        <textarea v-model="qtext" class="ta" placeholder="粘贴题干和选项…" :maxlength="-1" auto-height />
      </template>
      <text class="label">你选的答案（可选，填了会帮你分析错因）</text>
      <view class="ans-chips">
        <text v-for="o in ['A', 'B', 'C', 'D']" :key="o" class="ans-chip" :class="{ on: uanswer === o }" @click="uanswer = uanswer === o ? '' : o">{{ o }}</text>
      </view>
      <view style="height: 24rpx" />
      <button class="btn" :disabled="loading" @click="doExplain">用花生十三方法讲解</button>
    </view>

    <view v-if="loading" class="card">
      <view class="spin">{{ loadingText }}</view>
      <view class="sk sk1" /><view class="sk sk2" /><view class="sk sk3" />
    </view>
    <view v-if="error" class="card err">失败：{{ error }}{{ error.includes('再试') ? '' : '，请重试' }}</view>

    <view v-for="(r, i) in results" :key="r.ts" class="card">
      <view v-if="i > 0" class="hist" @click="r.folded = !r.folded"><uni-icons type="undo" size="14" color="#6b7280" /><text> 历史讲解（点此展开/折叠）</text></view>
      <template v-if="i === 0 || !r.folded">
        <view v-if="r.module_name || r.question_type" class="tags">
          <text v-if="r.module_name" class="tag">{{ r.module_name }}</text>
          <text v-if="r.question_type" class="tag">{{ r.question_type }}</text>
        </view>
        <view v-if="r.ansCard" class="anscard">
          <view class="ans-big">{{ r.ansCard.ans }}</view>
          <view class="ans-r">
            <view v-if="r.ansCard.method" class="ans-method">{{ r.ansCard.method }}</view>
            <text class="ans-brief">{{ r.ansCard.brief }}</text>
          </view>
        </view>
        <rich-text :nodes="r.html" />
        <view v-if="r.explain_key && !r.streaming" class="raterow">
          <text class="rate-q">{{ r.rated ? (r.rated === 'up' ? '已反馈：有用 👍' : '已反馈：有误 👎，我们会核查') : '这条解析对你有帮助吗？' }}</text>
          <view v-if="!r.rated" class="rate-btns">
            <text class="rate-btn" @click="rate(r, true)">👍 有用</text>
            <text class="rate-btn bad" @click="rate(r, false)">👎 有误</text>
          </view>
        </view>
        <view v-if="!r.streaming" class="fu">
          <view v-for="(m, mi) in r.fu || []" :key="mi" class="fu-msg" :class="m.role">
            <rich-text v-if="m.role === 'ai'" :nodes="m.html" />
            <text v-else>{{ m.content }}</text>
          </view>
          <view class="fu-row">
            <input v-model="r.fuText" class="fu-inp" placeholder="对讲解有疑问？向 AI 追问…" confirm-type="send" @confirm="askFollowup(r)" />
            <button class="btn sm fu-btn" :disabled="r.fuLoading" @click="askFollowup(r)">{{ r.fuLoading ? '思考中…' : '追问' }}</button>
          </view>
        </view>
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

    <view v-if="!results.length && !loading" class="card">
      <view class="rec-h">最近讲解</view>
      <template v-if="recent.length">
        <view v-for="(r, i) in recent" :key="r.ts" class="rec-row">
          <view class="rec-ans">{{ r.ans || '？' }}</view>
          <view class="rec-main">
            <text class="rec-brief">{{ r.brief || '已讲解' }}</text>
            <text class="rec-meta">{{ [r.module_name, r.question_type].filter(Boolean).join(' · ') || '拍题讲解' }} · {{ fmtRec(r.ts) }}</text>
          </view>
        </view>
      </template>
      <view v-else class="rec-empty">
        <text class="rec-e1">还没有讲解记录</text>
        <text class="rec-e2">示例：拍下一道做错的行测题，AI 会用花生十三方法体系给出答案、速解思路与可迁移技巧，还能追问和举一反三</text>
      </view>
    </view>
  </view>
</template>

<script>
import { md } from '../../md.js';
import { request, uploadExplain, streamExplain, anonUid } from '../../api.js';

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
      recent: uni.getStorageSync('recentExplains') || [],
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
    splitAnswer(full) {
      const text = full || '';
      const m = /^\s*【答案】\s*([^｜|\n]+?)\s*[｜|]\s*【方法】\s*([^｜|\n]+?)\s*[｜|]\s*【一句话】\s*([^\n]*)\n?/.exec(text);
      if (m) return { card: { ans: m[1].trim(), method: m[2].trim(), brief: m[3].trim() }, rest: text.slice(m.index + m[0].length) };
      const lines = text.split('\n');
      for (let i = 0; i < Math.min(lines.length, 6); i++) {
        const am = /【答案】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
        if (!am) continue;
        const mm = /【方法】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
        const bm = /【一句话】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
        const rest = lines.slice(0, i).concat(lines.slice(i + 1)).join('\n');
        return {
          card: { ans: am[1].trim(), method: mm ? mm[1].trim() : '', brief: bm ? bm[1].trim() : '' },
          rest,
        };
      }
      return { card: null, rest: text };
    },
    async rate(r, up) {
      r.rated = up ? 'up' : 'down';
      try {
        await request('/api/rate', { method: 'POST', data: { key: r.explain_key, up } });
      } catch (e) { /* 静默失败 */ }
      uni.showToast({ title: up ? '感谢反馈' : '已记录，我们会核查这条解析', icon: 'none' });
    },
    applyExplain(r, full) {
      if (!r.ansCard) {
        const first = (full || '').split('\n')[0] || '';
        if (first.startsWith('【答案】') && !(full || '').includes('\n')) { r.html = ''; return; }
      }
      const { card, rest } = this.splitAnswer(full);
      if (card) r.ansCard = card;
      r.html = md(card ? rest : full);
      if (!r.streaming) this.saveRecent(r);
    },
    saveRecent(r) {
      if (this.recent.some((x) => x.ts === r.ts)) return;
      const item = {
        ts: r.ts,
        module_name: r.module_name || '',
        question_type: r.question_type || '',
        ans: (r.ansCard && r.ansCard.ans) || '',
        brief: ((r.ansCard && r.ansCard.brief) || '').slice(0, 40),
      };
      this.recent = [item, ...this.recent].slice(0, 10);
      uni.setStorageSync('recentExplains', this.recent);
    },
    fmtRec(ts) {
      const d = new Date(ts);
      const p = (x) => (x < 10 ? '0' + x : x);
      return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    cycleGoal() {
      const opts = [20, 50, 100];
      const i = opts.indexOf(this.goal);
      this.goal = opts[(i + 1) % opts.length];
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
        const r = await request('/api/review?uid=' + encodeURIComponent(anonUid()));
        this.dueCount = r.total || (r.items || []).length;
      } catch (e) {
        this.dueCount = 0;
      }
      try {
        if (this.dueCount > 0) uni.setTabBarBadge({ index: 2, text: String(this.dueCount > 99 ? '99+' : this.dueCount) });
        else uni.removeTabBarBadge({ index: 2 });
      } catch (e) { /* tabBar 未就绪时忽略 */ }
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
          : secs < 25 ? `已识题，正在匹配花生十三方法…（${secs}秒）`
          : `正在生成分步讲解，马上好…（${secs}秒）`;
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
          const nr = { ...rec, ...d, ansCard: null, streaming: false };
          this.applyExplain(nr, d.explanation);
          this.results.unshift(nr);
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
            Object.assign(rec, m, { ansCard: null });
            this.results.unshift(rec);
            this.results.forEach((r, i) => { if (i > 0) r.folded = true; });
            live = this.results[0];
            inserted = true;
            clearInterval(this.timer);
            this.loading = false;
          },
          onDelta: (full) => { this.applyExplain(live, full); },
        });
        Object.assign(live, d, { streaming: false });
        this.applyExplain(live, d.explanation);
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
        const nr2 = {
          ...d,
          ts: Date.now(),
          html: '',
          ansCard: null,
          saved: false,
          folded: false,
          sim: null,
          simLoading: false,
          simSecs: 0,
        };
        this.applyExplain(nr2, d.explanation);
        this.results.unshift(nr2);
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
          uid: anonUid(),
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
          uid: anonUid(),
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
    async askFollowup(r) {
      const q = (r.fuText || '').trim();
      if (!q || r.fuLoading) return;
      if (!r.fu) r.fu = [];
      r.fu.push({ role: 'user', content: q });
      r.fuText = '';
      r.fuLoading = true;
      this.$forceUpdate();
      try {
        const d = await request('/api/followup', {
          method: 'POST',
          data: {
            question_text: r.question_text,
            explanation: r.explanation,
            history: r.fu.slice(0, -1).map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })),
            query: q,
          },
        });
        r.fu.push({ role: 'ai', content: d.answer, html: md(d.answer) });
      } catch (e) {
        uni.showToast({ title: '追问失败：' + e.message, icon: 'none' });
      }
      r.fuLoading = false;
      this.$forceUpdate();
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
.hero-t { display: block; font-size: 34rpx; font-weight: 700; color: var(--ink); letter-spacing: 1rpx; }
.hero-s { display: block; font-size: 24rpx; color: var(--ink-2); margin-top: 6rpx; }
.today { display: flex; justify-content: space-between; align-items: center; gap: 20rpx; background: linear-gradient(135deg, #3b6ff5, #2f5cd8); border-radius: var(--radius); padding: 26rpx 30rpx; margin-bottom: 24rpx; }
.goal-ring { flex-shrink: 0; width: 88rpx; height: 88rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.goal-in { width: 68rpx; height: 68rpx; border-radius: 50%; background: rgba(30, 41, 99, 0.35); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.goal-n { font-size: 26rpx; font-weight: 700; color: #fff; line-height: 1.1; }
.goal-t { font-size: 20rpx; font-weight: 400; color: rgba(255, 255, 255, 0.8); }
.today-l { flex: 1; min-width: 0; }
.today-t { display: block; font-size: 28rpx; font-weight: 700; color: #fff; }
.today-s { display: flex; align-items: center; gap: 6rpx; font-size: 21rpx; color: rgba(255, 255, 255, 0.78); margin-top: 6rpx; }
.today-s-t { font-size: 21rpx; color: rgba(255, 255, 255, 0.78); }
.today-link { color: #fff; font-size: 25rpx; font-weight: 600; flex-shrink: 0; padding: 14rpx 0 14rpx 14rpx; }
.drop { border: 2rpx dashed var(--brand); background: var(--brand-soft); border-radius: 24rpx; padding: 48rpx 24rpx; text-align: center; margin-bottom: 8rpx; }
.drop-ico { width: 112rpx; height: 112rpx; border-radius: 50%; background: #e0e7ff; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12rpx; }
.drop-t { display: block; font-size: 29rpx; font-weight: 600; color: var(--brand); }
.drop-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 8rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.label { font-size: 24rpx; color: var(--ink-2); display: block; margin: 20rpx 0 10rpx; }
.seg { display: flex; background: var(--soft-bg); border-radius: 16rpx; padding: 6rpx; margin-bottom: 20rpx; }
.seg-i { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8rpx; padding: 14rpx 0; font-size: 27rpx; color: var(--ink-2); border-radius: 12rpx; }
.seg-i.on { background: var(--card); color: var(--brand); font-weight: 600; box-shadow: 0 2rpx 8rpx rgba(31, 36, 48, 0.08); }
.btn { background: #3b6ff5; color: #fff; border-radius: 18rpx; font-size: 30rpx; font-weight: 600; box-shadow: 0 6rpx 16rpx rgba(59, 111, 245, 0.25); min-height: 44px; line-height: 44px; }
.btn[disabled] { opacity: 0.6; }
.btn.ghost { background: var(--brand-soft); color: var(--brand); box-shadow: none; }
.btn.sm { font-size: 26rpx; flex: 1; }
.btn.ok { background: var(--ok); color: #fff; opacity: 1 !important; box-shadow: none; }
.btn.bad { background: var(--bad); color: #fff; box-shadow: none; }
.btn.dim { opacity: 0.35; }
.ta { width: 100%; min-height: 160rpx; border: 1rpx solid var(--line); border-radius: 18rpx; padding: 18rpx; font-size: 28rpx; box-sizing: border-box; background: var(--soft-bg); }
.ans-chips { display: flex; gap: 16rpx; }
.ans-chip { flex: 1; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; font-size: 28rpx; font-weight: 600; color: var(--ink-2); background: var(--soft-bg); border: 1rpx solid var(--line); border-radius: 16rpx; }
.ans-chip.on { color: #3b6ff5; background: #edf3fe; border-color: #3b6ff5; }
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
.sk { height: 28rpx; border-radius: 8rpx; background: linear-gradient(90deg, #eef0f7 25%, #f7f8fc 50%, #eef0f7 75%); background-size: 400% 100%; animation: skm 1.4s ease infinite; margin-top: 18rpx; }
.sk1 { width: 45%; height: 44rpx; }
.sk2 { width: 90%; }
.sk3 { width: 75%; }
@keyframes skm { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
.fu { margin-top: 16rpx; }
.fu-msg { border-radius: 16rpx; padding: 16rpx 22rpx; margin-bottom: 12rpx; font-size: 25rpx; line-height: 1.7; }
.fu-msg.user { background: var(--brand-soft); color: var(--brand); margin-left: 15%; }
.fu-msg.ai { background: var(--soft-bg); color: var(--ink); margin-right: 5%; }
.fu-row { display: flex; gap: 14rpx; align-items: center; }
.fu-inp { flex: 1; height: 76rpx; border: 1rpx solid var(--line); border-radius: 999rpx; padding: 0 26rpx; font-size: 25rpx; background: var(--soft-bg); box-sizing: border-box; }
.fu-btn { flex: none; padding: 0 32rpx; font-size: 25rpx; line-height: 2.9; border-radius: 999rpx; }
.raterow { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; background: var(--soft-bg); border-radius: 14rpx; padding: 16rpx 22rpx; margin-top: 16rpx; flex-wrap: wrap; }
.rate-q { font-size: 24rpx; color: var(--ink-2); }
.rate-btns { display: flex; gap: 14rpx; }
.rate-btn { font-size: 24rpx; color: var(--brand); border: 1rpx solid var(--brand); border-radius: 999rpx; padding: 8rpx 24rpx; }
.rate-btn.bad { color: var(--bad); border-color: var(--bad); }
.anscard { display: flex; align-items: center; gap: 22rpx; background: #edf3fe; border: 1rpx solid #dbe6fd; border-radius: 20rpx; padding: 22rpx 26rpx; margin: 6rpx 0 16rpx; }
.ans-big { flex-shrink: 0; min-width: 88rpx; height: 88rpx; padding: 0 14rpx; border-radius: 20rpx; background: #3b6ff5; color: #fff; font-size: 44rpx; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 6rpx 14rpx rgba(59, 111, 245, 0.3); }
.ans-r { flex: 1; min-width: 0; }
.ans-method { display: inline-block; background: #3b6ff5; color: #fff; border-radius: 999rpx; font-size: 21rpx; font-weight: 600; padding: 4rpx 18rpx; margin-bottom: 8rpx; }
.ans-brief { display: block; font-size: 25rpx; color: var(--ink); line-height: 1.5; }
.err { color: var(--bad); background: var(--bad-soft); font-size: 26rpx; }
.tags { margin-bottom: 10rpx; }
.tag { display: inline-block; background: var(--brand-soft); color: var(--brand); border-radius: 999rpx; padding: 6rpx 20rpx; font-size: 22rpx; margin-right: 10rpx; }
.row { display: flex; gap: 14rpx; margin: 10rpx 0; }
.hist { font-size: 22rpx; color: var(--ink-2); margin-bottom: 10rpx; }
.dash { border-top: 1rpx dashed var(--line); margin: 20rpx 0; }
.rec-h { font-size: 28rpx; font-weight: 600; margin-bottom: 14rpx; }
.rec-row { display: flex; align-items: center; gap: 18rpx; min-height: 112rpx; border-bottom: 1rpx solid var(--line); }
.rec-row:last-of-type { border-bottom: none; }
.rec-ans { width: 72rpx; height: 72rpx; border-radius: 16rpx; background: var(--brand-soft, #edf3fe); color: var(--brand, #3b6ff5); font-size: 32rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rec-main { flex: 1; min-width: 0; }
.rec-brief { display: block; font-size: 25rpx; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rec-meta { display: block; font-size: 21rpx; color: var(--ink-2); margin-top: 4rpx; }
.rec-empty { padding: 10rpx 0 6rpx; }
.rec-e1 { display: block; font-size: 26rpx; font-weight: 600; color: var(--ink-2); }
.rec-e2 { display: block; font-size: 23rpx; color: var(--ink-3, #8f959e); line-height: 1.7; margin-top: 8rpx; }
.simbox { margin-top: 10rpx; }
</style>
