<template>
  <view class="wrap">
    <view class="card">
      <text class="label">① 上传错题截图 / 拍照（或在下方粘贴题目文字）</text>
      <button class="btn ghost" @click="pickImage">📷 选择图片 / 拍照</button>
      <image v-if="imagePath" :src="imagePath" mode="widthFix" class="preview" />
      <text class="label">② 题目文字（可选，与图片二选一）</text>
      <textarea v-model="qtext" class="ta" placeholder="粘贴题干和选项…" :maxlength="-1" auto-height />
      <text class="label">③ 你选的答案（可选，填了会帮你分析错因）</text>
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
            <button class="btn ghost sm" @click="explainSim(r)">用花生十三方法详解这道题</button>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script>
import { md } from '../../md.js';
import { request, uploadExplain } from '../../api.js';

export default {
  data() {
    return {
      imagePath: '',
      qtext: '',
      uanswer: '',
      loading: false,
      loadingText: '',
      error: '',
      results: [],
      timer: null,
    };
  },
  onShow() {
    const redo = uni.getStorageSync('redoQuestion');
    if (redo) {
      this.qtext = redo;
      this.uanswer = '';
      this.imagePath = '';
      uni.removeStorageSync('redoQuestion');
      uni.showToast({ title: '题目已填入，先自己做一遍再点讲解', icon: 'none', duration: 2500 });
    }
  },
  methods: {
    pickImage() {
      uni.chooseImage({
        count: 1,
        success: (res) => { this.imagePath = res.tempFilePaths[0]; },
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
      if (!this.imagePath && !this.qtext.trim()) {
        uni.showToast({ title: '请上传图片或粘贴题目文字', icon: 'none' });
        return;
      }
      this.loading = true;
      this.error = '';
      this.startTimer();
      try {
        const d = await uploadExplain({
          filePath: this.imagePath || null,
          text: this.qtext.trim() || null,
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
          qHtml: md(parts[0]),
          ansHtml: parts[1] ? md(parts[1]) : '',
          correct: m ? m[1] : null,
          picked: '',
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
    explainSim(r) {
      this.qtext = (r.sim.raw || '').replace(/^##\s*练习题\s*/, '').replace(/##\s*提示[\s\S]*$/, '').trim();
      this.uanswer = r.sim.picked || '';
      this.imagePath = '';
      uni.pageScrollTo({ scrollTop: 0, duration: 200 });
      this.doExplain();
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx; box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.06); }
.label { font-size: 24rpx; color: #8a90a0; display: block; margin: 20rpx 0 10rpx; }
.btn { background: #2f6fed; color: #fff; border-radius: 18rpx; font-size: 30rpx; font-weight: 600; }
.btn.ghost { background: #eef2ff; color: #2f6fed; }
.btn.sm { font-size: 26rpx; flex: 1; }
.btn.ok { background: #2eaf62; color: #fff; opacity: 1 !important; }
.btn.bad { background: #d64545; color: #fff; }
.btn.dim { opacity: 0.4; }
.ta { width: 100%; min-height: 160rpx; border: 1rpx solid #dde1ea; border-radius: 18rpx; padding: 18rpx; font-size: 28rpx; box-sizing: border-box; }
.inp { width: 100%; border: 1rpx solid #dde1ea; border-radius: 18rpx; padding: 18rpx; font-size: 28rpx; box-sizing: border-box; }
.preview { width: 100%; border-radius: 18rpx; margin-top: 14rpx; }
.spin { text-align: center; color: #8a90a0; font-size: 26rpx; }
.err { color: #c33; font-size: 26rpx; }
.tags { margin-bottom: 10rpx; }
.tag { display: inline-block; background: #eef2ff; color: #2f6fed; border-radius: 10rpx; padding: 4rpx 14rpx; font-size: 22rpx; margin-right: 10rpx; }
.row { display: flex; gap: 14rpx; margin: 10rpx 0; }
.hist { font-size: 22rpx; color: #8a90a0; margin-bottom: 10rpx; }
.dash { border-top: 1rpx dashed #dde1ea; margin: 20rpx 0; }
.simbox { margin-top: 10rpx; }
</style>
