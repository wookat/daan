<template>
  <view class="wrap ask">
    <!-- 顶部工具行 -->
    <view class="topbar">
      <view class="top-l">
        <text class="top-t">AI 问答</text>
        <text class="top-s">花生十三方法体系 · 拍题 / 文字皆可</text>
      </view>
      <view class="top-acts">
        <kg-button variant="secondary" size="lg" icon="rotate-ccw" aria-label="历史会话" @click="openHistory">历史{{ sessions.length ? ' ' + sessions.length : '' }}</kg-button>
        <kg-button v-if="results.length" variant="secondary" size="lg" icon="plus" @click="newSession">新对话</kg-button>
      </view>
    </view>

    <kg-two-col>
      <template #main>
        <!-- 空态引导：拍题 / 粘贴题目两个动作（移动端） -->
        <template v-if="!results.length && !loading">
          <kg-card class="mob-empty">
            <kg-empty-state icon="camera" title="拍一道题，AI 讲给你听" desc="答案 + 花生十三速解方法 + 可迁移技巧；也可粘贴题目文字或从相册选图" cta-text="拍题讲解" secondary-text="粘贴题目文字" @cta="openCamera" @secondary="textOpen = true" />
            <view class="mob-acts">
              <kg-button variant="text" size="lg" icon="files" @click="openAlbum">从相册选图</kg-button>
              <kg-button variant="text" size="lg" icon="book-open" @click="goBook">看错题本</kg-button>
            </view>
          </kg-card>

          <!-- 桌面（无摄像头）首屏：粘贴题目 / 上传图片（仅 H5 ≥1024px） -->
          <!-- #ifdef H5 -->
          <view class="deskstart">
            <kg-card class="ds-col">
              <view class="ds-h"><l-icon name="clipboard-list" :size="18" tone="brand" /><text class="ds-t">粘贴题目文字</text></view>
              <textarea v-model="qtext" class="ta ds-ta" placeholder="粘贴题干和选项…" :maxlength="-1" />
              <text class="label">你选的答案（可选，填了会帮你分析错因）</text>
              <view class="ans-chips">
                <view v-for="o in ['A', 'B', 'C', 'D']" :key="o" class="ans-chip" :class="{ on: uanswer === o }" role="button" @click="uanswer = uanswer === o ? '' : o">{{ o }}</view>
              </view>
              <view class="ds-act">
                <kg-button variant="primary" size="lg" block :disabled="loading || !qtext.trim()" @click="submitText">用花生十三方法讲解</kg-button>
              </view>
            </kg-card>
            <kg-card class="ds-col">
              <view class="ds-h"><l-icon name="camera" :size="18" tone="brand" /><text class="ds-t">上传题目截图</text></view>
              <view class="ds-drop" role="button" @click="openAlbum">
                <l-icon name="files" :size="30" tone="brand" />
                <text class="ds-d1">点击选择图片，或拖拽到这里</text>
                <text class="ds-d2">也可直接 Ctrl+V 粘贴截图</text>
              </view>
            </kg-card>
          </view>
          <!-- #endif -->

          <kg-card v-if="recent.length" class="reccard">
            <kg-section-header title="最近讲解" />
            <view v-for="r in recent" :key="r.ts" class="rec-row">
              <view class="rec-ans num">{{ r.ans || '？' }}</view>
              <view class="rec-main">
                <text class="rec-brief">{{ r.brief || '已讲解' }}</text>
                <text class="rec-meta">{{ [r.module_name, r.question_type].filter(Boolean).join(' · ') || '拍题讲解' }} · {{ fmtRec(r.ts) }}</text>
              </view>
            </view>
          </kg-card>
        </template>

        <!-- 消息流 -->
        <view v-for="r in convo" :key="r.ts" class="msgs">
          <!-- 用户消息 -->
          <view class="msg user">
            <view class="bubble ub">
              <image v-if="r.userImage" :src="r.userImage" mode="widthFix" class="ub-img" />
              <text v-if="r.userText" class="ub-t">{{ r.userText }}</text>
              <text v-if="r.user_answer" class="ub-ans">我选：{{ r.user_answer }}</text>
            </view>
          </view>
          <!-- AI 消息 -->
          <view class="msg ai">
            <kg-card variant="soft" class="bubble ab">
              <view v-if="r.module_name || r.question_type" class="tags">
                <kg-tag v-if="r.module_name" tone="brand">{{ r.module_name }}</kg-tag>
                <kg-tag v-if="r.question_type" tone="neutral">{{ r.question_type }}</kg-tag>
              </view>
              <view v-if="r.ansCard" class="anscard">
                <view class="ans-big num">{{ r.ansCard.ans }}</view>
                <view class="ans-r">
                  <kg-tag v-if="r.ansCard.method" tone="brand">{{ r.ansCard.method }}</kg-tag>
                  <text class="ans-brief">{{ r.ansCard.brief }}</text>
                </view>
              </view>
              <rich-text v-if="r.html" :nodes="r.html" />
              <view v-else-if="r.streaming"><text class="spin">{{ thinkingText(r) }}</text><kg-skeleton preset="lines" /></view>
              <view v-if="r.explain_key && !r.streaming" class="raterow">
                <text class="rate-q">{{ r.rated ? (r.rated === 'up' ? '已反馈：有用' : '已反馈：有误，我们会核查') : '这条解析有帮助吗？' }}</text>
                <view v-if="!r.rated" class="rate-btns">
                  <kg-button variant="ghost" size="sm" icon="thumbs-up" @click="rate(r, true)">有用</kg-button>
                  <kg-button variant="ghost" size="sm" tone="bad" icon="thumbs-down" @click="rate(r, false)">有误</kg-button>
                </view>
              </view>
              <!-- 追问建议 + 操作 chips -->
              <view v-if="!r.streaming" class="chips">
                <kg-button variant="secondary" size="sm" @click="quickFollowup(r, '请再讲得更细一点，逐步推导每一步')">再讲细一点</kg-button>
                <kg-button variant="secondary" size="sm" :loading="!!r.simLoading" :aria-disabled="String(!!r.simLoading)" @click="genSimilar(r)">{{ r.simLoading ? '出题中…' + r.simSecs + 's' : '出一道同款题' }}</kg-button>
                <kg-button :variant="r.saved ? 'ghost' : 'secondary'" size="sm" :icon="r.saved ? 'check' : ''" @click="save(r)">{{ r.saved ? '已存错题本' : '存入错题本' }}</kg-button>
                <kg-button v-if="viewUrl(r)" variant="text" size="sm" @click="viewQuestion(r)">查看原题</kg-button>
              </view>
              <view v-if="!r.streaming" class="diff-row">
                <text class="diff-k">出题难度</text>
                <view v-for="o in simDiffOpts" :key="o.v" class="diff-chip" :class="{ on: (r.simDiff || 'same') === o.v }" role="radio" :aria-checked="(r.simDiff || 'same') === o.v ? 'true' : 'false'" @click="r.simDiff = o.v">{{ o.t }}</view>
              </view>
              <view v-if="!r.streaming && r.explanation" class="wenze-row">
                <view v-for="q in wenzeChips" :key="q" class="wenze-chip" role="button" @click="quickFollowup(r, q)">{{ q }}</view>
              </view>
            </kg-card>
          </view>
          <!-- 举一反三 -->
          <view v-if="r.sim" class="msg ai">
            <kg-card variant="soft" class="bubble ab">
              <view class="tags"><kg-tag tone="brand">举一反三</kg-tag></view>
              <rich-text :nodes="r.sim.qHtml" />
              <text class="label">先选你的答案再看解析：</text>
              <view class="ans-chips">
                <view
                  v-for="o in ['A', 'B', 'C', 'D']"
                  :key="o"
                  class="ans-chip"
                  :class="[optClass(r, o), { locked: !!r.sim.picked }]"
                  role="button"
                  :aria-disabled="String(!!r.sim.picked)"
                  @click="!r.sim.picked && pick(r, o)"
                >{{ o }}</view>
              </view>
              <view v-if="r.sim.picked && r.sim.ansHtml">
                <rich-text :nodes="r.sim.ansHtml" />
                <view class="chips">
                  <kg-button variant="secondary" size="sm" @click="explainSim(r)">详解这道题</kg-button>
                  <kg-button
                    v-if="r.sim.correct && r.sim.picked !== r.sim.correct"
                    :variant="r.sim.saved ? 'ghost' : 'secondary'"
                    size="sm"
                    :icon="r.sim.saved ? 'check' : ''"
                    @click="saveSim(r)"
                  >{{ r.sim.saved ? '已存错题本' : '存入错题本' }}</kg-button>
                </view>
              </view>
            </kg-card>
          </view>
          <!-- 追问消息 -->
          <template v-for="(m, mi) in r.fu || []" :key="r.ts + '-fu-' + mi">
            <view class="msg" :class="m.role === 'ai' ? 'ai' : 'user'">
              <kg-card v-if="m.role === 'ai'" variant="soft" class="bubble ab"><rich-text :nodes="m.html" /></kg-card>
              <view v-else class="bubble ub"><text class="ub-t">{{ m.content }}</text></view>
            </view>
          </template>
          <view v-if="r.fuLoading" class="msg ai"><kg-card variant="soft" class="bubble ab"><text class="spin">思考中…</text></kg-card></view>
        </view>

        <view v-if="loading" class="msgs">
          <view class="msg user">
            <view class="bubble ub">
              <image v-if="stagedImage" :src="stagedImage" mode="widthFix" class="ub-img" />
              <text v-if="stagedText" class="ub-t">{{ stagedText }}</text>
            </view>
          </view>
          <view class="msg ai"><kg-card variant="soft" class="bubble ab"><text class="spin">{{ loadingText }}</text><kg-skeleton preset="lines" /></kg-card></view>
        </view>
        <kg-banner v-if="error" tone="bad" icon="triangle-alert" :text="errorText" :closable="false" />
      </template>

      <!-- 会话列表：桌面辅栏 / 移动端跟随主列 -->
      <template #aside>
        <kg-card class="sesscard">
          <kg-section-header title="历史会话" :more="sessions.length ? '管理' : ''" @more="openHistory" />
          <kg-empty-state v-if="!sessions.length" compact icon="rotate-ccw" title="还没有历史会话" desc="每次「新对话」后，之前的问答会自动存到这里（同一账号换设备也能看）" />
          <view v-for="(s, si) in sessions.slice(0, 5)" :key="s.id" class="rec-row" role="button" :class="{ on: s.id === curSid }" @click="loadSession(si)">
            <view class="rec-ans num">{{ s.n }}</view>
            <view class="rec-main">
              <text class="rec-brief">{{ s.title }}</text>
              <text class="rec-meta">{{ s.n }} 次问答 · {{ fmtRec(s.ts) }}</text>
            </view>
            <l-icon name="chevron-right" :size="16" tone="faint" />
          </view>
          <kg-button v-if="sessions.length > 5" variant="text" size="md" block @click="openHistory">查看全部 {{ sessions.length }} 个会话 ›</kg-button>
        </kg-card>
      </template>
    </kg-two-col>

    <view class="bottompad" />

    <!-- 底部输入栏（结果页持续行动栏：相机=再拍一题 / 文字 / 追问） -->
    <kg-action-bar layout="input" class="askbar">
      <view class="kg-tool ib-tool" role="button" aria-label="拍题" @click="openCamera"><l-icon name="camera" :size="20" tone="ink-2" /></view>
      <view class="kg-tool ib-tool" role="button" aria-label="粘贴题目文字" @click="textOpen = true"><l-icon name="clipboard-list" :size="20" tone="ink-2" /></view>
      <input
        v-model="fuText"
        class="ib-inp"
        :placeholder="results.length ? '对讲解有疑问？追问 AI…' : '先拍题或粘贴题目开始'"
        confirm-type="send"
        :disabled="!results.length"
        @confirm="sendFollowup"
      />
      <kg-button variant="primary" size="lg" icon="send" aria-label="发送" :disabled="!results.length || !fuText.trim()" @click="sendFollowup" />
    </kg-action-bar>

    <!-- 新题文字输入 sheet -->
    <kg-sheet v-model="textOpen" title="粘贴题目文字">
      <kg-banner v-if="error" tone="bad" icon="triangle-alert" :text="errorText" :closable="false" class="sheet-err" />
      <textarea v-model="qtext" class="ta" placeholder="粘贴题干和选项…" :maxlength="-1" auto-height />
      <text class="label">你选的答案（可选，填了会帮你分析错因）</text>
      <view class="ans-chips">
        <view v-for="o in ['A', 'B', 'C', 'D']" :key="o" class="ans-chip" :class="{ on: uanswer === o }" role="button" @click="uanswer = uanswer === o ? '' : o">{{ o }}</view>
      </view>
      <template #footer><kg-button variant="primary" size="lg" block :disabled="loading" @click="submitText">用花生十三方法讲解</kg-button></template>
    </kg-sheet>

    <!-- 图片确认 sheet -->
    <kg-sheet :model-value="!!imagePath" title="确认题目图片" @update:model-value="(v) => { if (!v) clearImage(); }">
      <image :src="imagePath" mode="widthFix" class="preview" />
      <text class="label">你选的答案（可选，填了会帮你分析错因）</text>
      <view class="ans-chips">
        <view v-for="o in ['A', 'B', 'C', 'D']" :key="o" class="ans-chip" :class="{ on: uanswer === o }" role="button" @click="uanswer = uanswer === o ? '' : o">{{ o }}</view>
      </view>
      <template #footer><kg-button variant="primary" size="lg" block :disabled="loading" @click="submitImage">用花生十三方法讲解</kg-button></template>
    </kg-sheet>

    <!-- 历史会话 sheet -->
    <kg-sheet v-model="historyOpen" title="历史会话">
      <kg-empty-state v-if="!sessions.length" compact icon="rotate-ccw" title="还没有历史会话" desc="每次「新对话」后，之前的问答会自动存到这里（同一账号换设备也能看）" />
      <view v-for="(s, si) in sessions" :key="s.id" class="rec-row" role="button" :class="{ on: s.id === curSid }" @click="loadSession(si)">
        <view class="rec-ans num">{{ s.n }}</view>
        <view class="rec-main">
          <text class="rec-brief">{{ s.title }}</text>
          <text class="rec-meta">{{ s.n }} 次问答 · {{ fmtRec(s.ts) }}</text>
        </view>
        <kg-button variant="text" size="sm" tone="bad" @click.stop="delSession(si)">删除</kg-button>
      </view>
    </kg-sheet>
  </view>
</template>

<script>
import { fmtSlashMD } from '../../fmt.js';
import { md } from '../../md.js';
import { request, uploadExplain, streamExplain, anonUid, hasAccessCode, fetchAccessInfo, promptAccessCode, trackEvent } from '../../api.js';
import { failBannerText } from '../../api-policy.js';
import { isNativeApp, pickImageNative } from '../../native.js';
import { setBookBadge } from '../../tabbar-badge.js';
import { mergeAskSessions, upsertLocalSession, addTombstone, removeTombstone, pruneTombstones, filterTombstoned, sanitizeCurItems, parseRemoteCur } from '../../ask-sessions.js';
import { askQid, askViewUrl, thinkingSecs, thinkingLabel } from '../../ask-link.js';

export default {
  data() {
    return {
      imagePath: '',
      imageFile: null,
      qtext: '',
      uanswer: '',
      fuText: '',
      textOpen: false,
      historyOpen: false,
      loading: false,
      loadingText: '',
      stagedImage: '',
      stagedText: '',
      error: '',
      results: [],
      sessions: uni.getStorageSync('askSessions') || [],
      curSid: Number(uni.getStorageSync('askCurSid')) || 0,
      timer: null,
      pendingQid: 0,
      recent: uni.getStorageSync('recentExplains') || [],
      simDiffOpts: [
        { v: 'easier', t: '降干扰' },
        { v: 'same', t: '持平' },
        { v: 'harder', t: '加复杂度' },
        { v: 'combo', t: '加综合度' },
      ],
      wenzeChips: ['这道题陷阱在哪', '换个方法怎么解', '给一道变式'],
    };
  },
  computed: {
    convo() {
      return [...this.results].reverse();
    },
    errorText() {
      return failBannerText(this.error);
    },
  },
  onShow() {
    // #ifdef H5
    if (!this._onPaste) {
      this._onPaste = (e) => this.handlePaste(e);
      window.addEventListener('paste', this._onPaste);
    }
    if (!this._onDragOver) {
      // uni-app H5 不代理 drag 类事件，需原生监听
      this._onDragOver = (e) => {
        if (e.target.closest && e.target.closest('.ds-drop')) e.preventDefault();
      };
      this._onDrop = (e) => {
        if (e.target.closest && e.target.closest('.ds-drop')) {
          e.preventDefault();
          this.onDrop(e);
        }
      };
      document.addEventListener('dragover', this._onDragOver);
      document.addEventListener('drop', this._onDrop);
    }
    // #endif
    this.loadDue();
    this.restoreCurSession();
    this.syncSessions();
    this.openLinkedSession();
    const redo = uni.getStorageSync('redoQuestion');
    if (redo) {
      this.qtext = redo;
      const ra = uni.getStorageSync('redoAnswer');
      this.uanswer = /^[A-D]$/.test(ra) ? ra : '';
      uni.removeStorageSync('redoAnswer');
      this.pendingQid = askQid(uni.getStorageSync('redoQid'));
      uni.removeStorageSync('redoQid');
      this.imagePath = '';
      this.imageFile = null;
      this.textOpen = true;
      uni.removeStorageSync('redoQuestion');
      uni.showToast({ title: '题目已填入，先自己做一遍再点讲解', icon: 'none', duration: 2500 });
    }
    const seed = uni.getStorageSync('simSeed');
    if (seed && seed.q) {
      uni.removeStorageSync('simSeed');
      this.openSimSeed(seed);
    }
  },
  // #ifdef H5
  onHide() {
    this.removePaste();
  },
  onUnload() {
    this.removePaste();
  },
  // #endif
  methods: {
    viewUrl(r) {
      return askViewUrl(r && r.qid);
    },
    viewQuestion(r) {
      const url = this.viewUrl(r);
      if (!url) return;
      trackEvent('ask_view_question');
      uni.navigateTo({ url });
    },
    // #ifdef H5
    removePaste() {
      if (this._onPaste) {
        window.removeEventListener('paste', this._onPaste);
        this._onPaste = null;
      }
      if (this._onDragOver) {
        document.removeEventListener('dragover', this._onDragOver);
        document.removeEventListener('drop', this._onDrop);
        this._onDragOver = null;
        this._onDrop = null;
      }
    },
    handlePaste(e) {
      if (this.loading || window.innerWidth < 1024) return;
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) {
            this.imageFile = f;
            this.imagePath = URL.createObjectURL(f);
            e.preventDefault();
          }
          return;
        }
      }
    },
    onDrop(e) {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && f.type.startsWith('image/')) {
        this.imageFile = f;
        this.imagePath = URL.createObjectURL(f);
      }
    },
    // #endif
    stripStop(s) {
      return (s || '').replace(/<\|[a-z_]+\|>/gi, '').trimEnd();
    },
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
    applyExplain(r, raw) {
      const full = this.stripStop(raw);
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
      return fmtSlashMD(ts);
    },
    async loadDue() {
      try {
        const r = await request('/api/review?uid=' + encodeURIComponent(anonUid()));
        setBookBadge(r.total || (r.items || []).length);
      } catch (e) { /* 接口失败时忽略 */ }
    },
    clearImage() {
      this.imagePath = '';
      this.imageFile = null;
    },
    goBook() {
      uni.switchTab({ url: '/pages/book/book' });
    },
    pickImage() {
      // #ifdef H5
      if (isNativeApp()) {
        pickImageNative()
          .then(({ path, file }) => {
            this.imagePath = path;
            this.imageFile = file;
          })
          .catch(() => {});
        return;
      }
      // #endif
      uni.chooseImage({
        count: 1,
        success: (res) => {
          this.imagePath = res.tempFilePaths[0];
          this.imageFile = (res.tempFiles && res.tempFiles[0]) || null;
        },
      });
    },
    // 相机优先：H5 用 file input capture 直接拉起系统相机，小程序/App 用 sourceType camera
    openCamera() {
      // #ifdef H5
      if (isNativeApp()) {
        this.pickImage();
        return;
      }
      this.h5Pick(true);
      return;
      // #endif
      // eslint-disable-next-line no-unreachable
      uni.chooseImage({
        count: 1,
        sourceType: ['camera'],
        success: (res) => {
          this.imagePath = res.tempFilePaths[0];
          this.imageFile = (res.tempFiles && res.tempFiles[0]) || null;
        },
      });
    },
    openAlbum() {
      // #ifdef H5
      if (isNativeApp()) {
        this.pickImage();
        return;
      }
      this.h5Pick(false);
      return;
      // #endif
      // eslint-disable-next-line no-unreachable
      uni.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: (res) => {
          this.imagePath = res.tempFilePaths[0];
          this.imageFile = (res.tempFiles && res.tempFiles[0]) || null;
        },
      });
    },
    // #ifdef H5
    h5Pick(camera) {
      const old = document.getElementById('ask-cap-input');
      if (old) old.remove();
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      if (camera) inp.setAttribute('capture', 'environment');
      inp.id = 'ask-cap-input';
      inp.style.display = 'none';
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (f) {
          this.imageFile = f;
          this.imagePath = URL.createObjectURL(f);
        }
        inp.remove();
      };
      document.body.appendChild(inp);
      inp.click();
    },
    // #endif
    thinkingText(r) {
      return thinkingLabel(r.thinkSecs);
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
    // AI 问答需访问码（内测）：提前提示；取消时不丢失已输入内容
    async ensureAccess() {
      if (hasAccessCode()) return true;
      const info = await fetchAccessInfo();
      if (!info || !info.required) return true;
      const ok = await promptAccessCode();
      if (!ok) uni.showToast({ title: '已取消，输入的内容已保留', icon: 'none' });
      return ok;
    },
    async submitText() {
      const txt = this.qtext.trim();
      if (!txt) {
        uni.showToast({ title: '请粘贴题目文字', icon: 'none' });
        return;
      }
      if (!(await this.ensureAccess())) return;
      this.textOpen = false;
      this.doExplain('', null, txt);
    },
    async submitImage() {
      if (!(await this.ensureAccess())) return;
      const img = this.imagePath;
      const file = this.imageFile;
      this.imagePath = '';
      this.imageFile = null;
      this.doExplain(img, file, '');
    },
    async doExplain(img, imgFile, txt) {
      if (!img && !txt) return;
      this.loading = true;
      this.error = '';
      this.stagedImage = img || '';
      this.stagedText = txt || '';
      const uans = this.uanswer.trim();
      const qid = txt ? this.pendingQid || 0 : 0;
      this.pendingQid = 0;
      this.startTimer();
      try {
        let d;
        const rec = {
          ts: Date.now(),
          qid,
          module_name: '',
          question_type: '',
          html: '',
          userImage: img || '',
          userText: txt || '',
          user_answer: uans,
          saved: false,
          sim: null,
          simLoading: false,
          simSecs: 0,
          fu: [],
          fuLoading: false,
          streaming: true,
          thinkSecs: 0,
        };
        // H5 图片重做回填时无 File 对象，退回非流式
        // #ifdef H5
        if (img && !imgFile) {
          d = await uploadExplain({
            filePath: img,
            text: txt || null,
            userAnswer: uans || null,
          });
          const nr = { ...rec, ...d, userImage: img, user_answer: uans, ansCard: null, streaming: false };
          this.applyExplain(nr, d.explanation);
          this.results.unshift(nr);
          this.uanswer = '';
          this.qtext = '';
          this.persistSession();
          clearInterval(this.timer);
          this.loading = false;
          this.scrollBottom();
          return;
        }
        // #endif
        let inserted = false;
        let live = rec; // 插入后改用响应式代理，保证增量更新触发渲染
        d = await streamExplain({
          file: imgFile,
          filePath: img || null,
          text: txt || null,
          userAnswer: uans || null,
          questionId: qid,
          onMeta: (m) => {
            Object.assign(rec, m, { qid: askQid(m.qid) || qid, ansCard: null, userImage: img || '', userText: txt || '', user_answer: uans });
            this.results.unshift(rec);
            live = this.results[0];
            inserted = true;
            clearInterval(this.timer);
            this.loading = false;
            this.scrollBottom();
          },
          onThinking: (t) => { live.thinkSecs = thinkingSecs(t); },
          onDelta: (full) => { this.applyExplain(live, full); },
        });
        if (!inserted) {
          this.results.unshift(rec);
          live = this.results[0];
        }
        Object.assign(live, d, { streaming: false, userImage: img || '', userText: txt || '', user_answer: uans });
        this.applyExplain(live, d.explanation);
        this.uanswer = '';
        this.qtext = '';
        this.persistSession();
      } catch (e) {
        this.error = e.message;
        // 失败时重新展开文本面板，已粘贴的题目原文保留可重试
        if (txt) this.textOpen = true;
      }
      clearInterval(this.timer);
      this.loading = false;
      this.scrollBottom();
    },
    scrollBottom() {
      this.$nextTick(() => {
        uni.pageScrollTo({ scrollTop: 999999, duration: 200 });
      });
    },
    async save(r) {
      if (r.saved) return;
      await request('/api/mistakes', {
        method: 'POST',
        data: {
          uid: anonUid(),
          question_id: askQid(r.qid) || null,
          module: r.module,
          question_type: r.question_type,
          question_text: r.question_text,
          user_answer: r.user_answer,
          explanation: r.explanation,
        },
      });
      r.saved = true;
      this.persistSession();
    },
    openSimSeed(seed) {
      const diffs = ['easier', 'same', 'harder', 'combo'];
      const rec = {
        ts: Date.now(),
        qid: '',
        module_name: seed.modName || '',
        module: seed.mod || '',
        question_type: seed.qt || '',
        question_text: seed.q,
        html: '',
        userImage: '',
        userText: (seed.q || '').slice(0, 200),
        user_answer: '',
        explanation: '',
        saved: false,
        sim: null,
        simLoading: false,
        simSecs: 0,
        simDiff: diffs.indexOf(seed.diff) >= 0 ? seed.diff : 'same',
        fu: [],
        fuLoading: false,
        streaming: false,
        ansCard: null,
      };
      this.results.unshift(rec);
      this.scrollBottom();
      this.genSimilar(rec);
    },
    async genSimilar(r) {
      if (r.simLoading) return;
      r.simLoading = true;
      r.simSecs = 0;
      const t = setInterval(() => { r.simSecs++; }, 1000);
      try {
        const d = await request('/api/similar', {
          method: 'POST',
          data: { question_text: r.question_text, question_type: r.question_type, difficulty: r.simDiff || 'same' },
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
        this.scrollBottom();
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
    sendFollowup() {
      const q = this.fuText.trim();
      if (!q || !this.results.length) return;
      this.fuText = '';
      this.quickFollowup(this.results[0], q);
    },
    async quickFollowup(r, q) {
      if (r.fuLoading || r.streaming) return;
      if (!r.fu) r.fu = [];
      r.fu.push({ role: 'user', content: q });
      r.fuLoading = true;
      this.$forceUpdate();
      this.scrollBottom();
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
        const ans = this.stripStop(d.answer);
        r.fu.push({ role: 'ai', content: ans, html: md(ans) });
        this.persistSession();
      } catch (e) {
        uni.showToast({ title: '追问失败：' + e.message, icon: 'none' });
      }
      r.fuLoading = false;
      this.$forceUpdate();
      this.scrollBottom();
    },
    explainSim(r) {
      const txt = (r.sim.raw || '').replace(/^##\s*练习题\s*/, '').replace(/##\s*提示[\s\S]*$/, '').trim();
      this.uanswer = r.sim.picked || '';
      this.doExplain('', null, txt);
    },
    // ---------- 历史会话（本机保存） ----------
    persistSession() {
      const items = this.results.map((r) => ({
        ts: r.ts,
        qid: askQid(r.qid),
        module: r.module || '',
        module_name: r.module_name || '',
        question_type: r.question_type || '',
        question_text: r.question_text || '',
        explanation: r.explanation || '',
        explain_key: r.explain_key || '',
        user_answer: r.user_answer || '',
        userText: r.userText || '',
        saved: !!r.saved,
        fu: (r.fu || []).map((m) => ({ role: m.role, content: m.content })),
      }));
      uni.setStorageSync('askCurSession', items);
      this.pushCurSession();
    },
    pushCurSession() {
      clearTimeout(this._curPushT);
      this._curPushT = setTimeout(() => {
        const items = uni.getStorageSync('askCurSession') || [];
        if (!Array.isArray(items) || !items.length) return;
        request('/api/ask/cur', {
          method: 'POST',
          data: { uid: anonUid(), sid: this.curSid || Number(uni.getStorageSync('askCurSid')) || 0, ts: Date.now(), items },
        }).catch(() => {});
      }, 1500);
    },
    newSession() {
      this.archiveCurrent();
      this.clearCurrent();
    },
    clearCurrent() {
      this.results = [];
      this.error = '';
      uni.removeStorageSync('askCurSession');
      this.curSid = 0;
      uni.removeStorageSync('askCurSid');
      this._curCleared = true;
      clearTimeout(this._curPushT);
      request('/api/ask/cur', { method: 'POST', data: { uid: anonUid(), items: [] } }).catch(() => {});
    },
    archiveCurrent() {
      if (!this.results.length) return;
      const first = this.results[this.results.length - 1];
      const title = ((first.ansCard && first.ansCard.brief) || first.userText || first.question_text || '问答会话').slice(0, 30);
      const items = uni.getStorageSync('askCurSession') || [];
      if (!items.length) return;
      const sid = this.curSid || Number(uni.getStorageSync('askCurSid')) || Date.now();
      const sess = { id: sid, ts: Date.now(), title, n: items.length, items };
      uni.setStorageSync('askDelTombs', removeTombstone(uni.getStorageSync('askDelTombs'), sid));
      this.sessions = upsertLocalSession(this.sessions, sess);
      uni.setStorageSync('askSessions', this.sessions);
      this.curSid = 0;
      uni.removeStorageSync('askCurSid');
      request('/api/ask/sessions', {
        method: 'POST',
        data: { uid: anonUid(), sid: sess.id, ts: sess.ts, title: sess.title, n: sess.n, items: sess.items },
      }).catch(() => {});
    },
    syncSessions() {
      const tombs = pruneTombstones(uni.getStorageSync('askDelTombs'));
      uni.setStorageSync('askDelTombs', tombs);
      request('/api/ask/sessions?uid=' + encodeURIComponent(anonUid()))
        .then((r) => {
          this.sessions = mergeAskSessions(this.sessions, filterTombstoned((r && r.items) || [], tombs));
          uni.setStorageSync('askSessions', this.sessions);
        })
        .catch(() => {});
      for (const k of Object.keys(tombs)) this.dropRemoteSession(Number(k));
    },
    dropRemoteSession(sid) {
      request('/api/ask/sessions/' + sid + '?uid=' + encodeURIComponent(anonUid()), { method: 'DELETE' })
        .then(() => {
          uni.setStorageSync('askDelTombs', removeTombstone(uni.getStorageSync('askDelTombs'), sid));
        })
        .catch(() => {});
    },
    openHistory() {
      this.historyOpen = true;
    },
    openLinkedSession() {
      const sid = askQid(uni.getStorageSync('askOpenSid'));
      uni.removeStorageSync('askOpenSid');
      if (!sid) return;
      const i = this.sessions.findIndex((s) => s && s.id === sid);
      if (i >= 0) this.loadSession(i);
    },
    restoreCurSession() {
      if (this.results.length) return;
      const items = sanitizeCurItems(uni.getStorageSync('askCurSession'));
      if (items.length) {
        this.results = this.adoptItems(items);
        this.persistSession();
        return;
      }
      // 本机无快照：异步取服务端进行中快照（R332，失败静默）
      request('/api/ask/cur?uid=' + encodeURIComponent(anonUid()))
        .then((r) => {
          if (this.results.length || this._curCleared) return;
          if (sanitizeCurItems(uni.getStorageSync('askCurSession')).length) return;
          const cur = parseRemoteCur(r);
          if (!cur) return;
          if (cur.sid > 0) {
            this.curSid = cur.sid;
            uni.setStorageSync('askCurSid', cur.sid);
          }
          this.results = this.adoptItems(cur.items);
          this.persistSession();
        })
        .catch(() => {});
    },
    adoptItems(items) {
      return items.map((r) => {
        const nr = {
          ...r,
          html: '',
          ansCard: null,
          saved: !!r.saved,
          sim: null,
          simLoading: false,
          simSecs: 0,
          fuLoading: false,
          streaming: false,
          userImage: '',
          fu: (r.fu || []).map((m) => ({ ...m, html: m.role === 'ai' ? md(m.content) : '' })),
        };
        this.applyExplain(nr, r.explanation);
        return nr;
      });
    },
    loadSession(i) {
      const s = this.sessions[i];
      if (!s) return;
      this.archiveCurrent();
      this.curSid = s.id;
      uni.setStorageSync('askCurSid', s.id);
      this.results = this.adoptItems(s.items);
      this.persistSession();
      this.historyOpen = false;
      this.scrollBottom();
    },
    delSession(i) {
      const s = this.sessions[i];
      this.sessions.splice(i, 1);
      uni.setStorageSync('askSessions', this.sessions);
      if (s) {
        uni.setStorageSync('askDelTombs', addTombstone(uni.getStorageSync('askDelTombs'), s.id));
        this.dropRemoteSession(s.id);
        if (s.id === (this.curSid || Number(uni.getStorageSync('askCurSid')) || 0)) this.clearCurrent();
      }
    },
  },
};
</script>

<style scoped>
.wrap { padding: var(--sp-12) var(--page-x) var(--sp-24); min-height: calc(100vh - 120px); box-sizing: border-box; }
.bottompad { height: calc(72px + env(safe-area-inset-bottom)); }

.topbar { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-8); padding: var(--sp-8) 0 var(--sp-12); }
.top-t { display: block; font-size: var(--fs-h2); font-weight: 600; color: var(--ink); }
.top-s { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }
.top-acts { display: flex; gap: var(--sp-8); flex-shrink: 0; }

/* 空态引导 */
.mob-empty { margin-bottom: var(--card-gap); }
.mob-acts { display: flex; justify-content: center; gap: var(--sp-8); }
.deskstart { display: none; }
.reccard { margin-bottom: var(--card-gap); }
.rec-row { display: flex; align-items: center; gap: var(--sp-12); min-height: 56px; border-bottom: 1px solid var(--line); }
.rec-row:last-of-type { border-bottom: none; }
.rec-row.on .rec-brief { color: var(--brand-text); font-weight: 600; }
.rec-ans { width: 36px; height: 36px; border-radius: var(--r-sm); background: var(--brand-soft); color: var(--brand-text); font-size: var(--fs-h3); font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rec-main { flex: 1; min-width: 0; }
.rec-brief { display: block; font-size: var(--fs-sub); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rec-meta { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-4); }
.sesscard { margin-bottom: var(--card-gap); }

/* 消息流 */
.msgs { display: flex; flex-direction: column; }
.msg { display: flex; margin-bottom: var(--sp-12); }
.msg.user { justify-content: flex-end; }
.msg.ai { justify-content: flex-start; }
.bubble { max-width: 86%; border-radius: var(--r-lg); padding: var(--sp-12) var(--sp-16); font-size: var(--fs-body); line-height: var(--lh-body); box-sizing: border-box; }
.ub { background: var(--brand); color: var(--on-brand); border-bottom-right-radius: var(--r-xs); }
.ub-t { white-space: pre-wrap; overflow-wrap: anywhere; }
.ub-img { width: 160px; max-width: 100%; border-radius: var(--r-sm); display: block; }
.ub-ans { display: block; margin-top: var(--sp-4); font-size: var(--fs-caption); color: var(--on-brand-2); }
.ab { max-width: 94%; border-bottom-left-radius: var(--r-xs); }
.spin { display: block; color: var(--ink-3); font-size: var(--fs-sub); margin-bottom: var(--sp-8); }
.tags { display: flex; gap: var(--sp-8); flex-wrap: wrap; margin-bottom: var(--sp-8); }
.anscard { display: flex; align-items: center; gap: var(--sp-12); background: var(--card); border: 1px solid var(--brand-soft-2); border-radius: var(--r-md); padding: var(--sp-12) var(--sp-16); margin: var(--sp-4) 0 var(--sp-12); }
.ans-big { flex-shrink: 0; min-width: 44px; height: 44px; padding: 0 var(--sp-8); border-radius: var(--r-sm); background: var(--brand); color: var(--on-brand); font-size: var(--fs-h1); font-weight: 600; display: flex; align-items: center; justify-content: center; }
.ans-r { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-4); }
.ans-brief { display: block; font-size: var(--fs-sub); color: var(--ink); line-height: var(--lh-sub); }
.raterow { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); background: var(--fill); border-radius: var(--r-sm); padding: var(--sp-8) var(--sp-12); margin-top: var(--sp-12); flex-wrap: wrap; }
.rate-q { font-size: var(--fs-caption); color: var(--ink-3); }
.rate-btns { display: flex; gap: var(--sp-8); }
.chips { display: flex; gap: var(--sp-8); flex-wrap: wrap; margin-top: var(--sp-12); }
.label { font-size: var(--fs-caption); color: var(--ink-3); display: block; margin: var(--sp-12) 0 var(--sp-8); }
.sheet-err { margin-bottom: var(--sp-12); }
.ans-chips { display: flex; gap: var(--sp-8); }
.ans-chip { flex: 1; min-height: var(--hit-min); display: inline-flex; align-items: center; justify-content: center; font-size: var(--fs-body); font-weight: 600; color: var(--ink-2); background: var(--card); border: 1px solid var(--line-strong); border-radius: var(--r-sm); }
.ans-chip.on { color: var(--brand-text); background: var(--brand-soft); border-color: var(--brand); }
.ans-chip.ok { color: var(--ok-strong); background: var(--ok-soft); border-color: var(--ok); }
.ans-chip.bad { color: var(--bad); background: var(--bad-soft); border-color: var(--bad); }
.ans-chip.dim { opacity: 0.4; }
.ans-chip.locked { cursor: default; }
.diff-row { display: flex; align-items: center; gap: var(--sp-8); flex-wrap: wrap; margin-top: var(--sp-8); }
.diff-k { font-size: var(--fs-caption); color: var(--ink-3); }
.diff-chip { display: inline-flex; align-items: center; height: var(--chip-h); padding: 0 var(--sp-12); border-radius: var(--r-full); border: 1px solid var(--line); background: var(--card); color: var(--ink-2); font-size: var(--fs-sub); }
.diff-chip.on { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.wenze-row { display: flex; gap: var(--sp-8); flex-wrap: wrap; margin-top: var(--sp-8); }
.wenze-chip { display: inline-flex; align-items: center; height: var(--chip-h); padding: 0 var(--sp-12); border-radius: var(--r-full); border: 1px dashed var(--line-strong); background: transparent; color: var(--ink-2); font-size: var(--fs-sub); }
.wenze-chip:hover { border-color: var(--brand); color: var(--brand-text); }
.ta { width: 100%; min-height: 96px; border: 1px solid var(--line); border-radius: var(--r-sm); padding: var(--sp-12); font-size: var(--fs-body); box-sizing: border-box; background: var(--fill); color: var(--ink); }
.preview { width: 100%; border-radius: var(--r-sm); margin-top: var(--sp-4); }

/* 底部固定输入条（H5 Tab 页需抬到 TabBar 之上） */
.askbar { gap: var(--sp-8); }
/* #ifdef H5 */
.askbar { bottom: calc(50px + env(safe-area-inset-bottom)); padding-bottom: var(--sp-12); }
/* #endif */
.ib-tool { flex-shrink: 0; width: var(--hit-min); height: var(--hit-min); border-radius: var(--r-full); background: var(--fill); display: flex; align-items: center; justify-content: center; }
.ib-inp { flex: 1; min-width: 0; height: var(--input-h); border: 1px solid var(--line); border-radius: var(--r-full); padding: 0 var(--sp-16); font-size: var(--fs-sub); color: var(--ink); background: var(--fill); box-sizing: border-box; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .askbar { left: 208px; bottom: 0; }
  .bubble { max-width: 72%; }
}
/* 桌面（无摄像头）：取景/拍题引导隐藏，改粘贴/上传；输入条随主列 sticky */
@media (min-width: 1024px) {
  .wrap.ask { max-width: 1064px; padding-top: var(--sp-24); }
  .mob-empty { display: none; }
  .deskstart { display: flex; gap: var(--sp-16); align-items: stretch; margin-bottom: var(--card-gap); }
  .ds-col { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .ds-h { display: flex; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-12); }
  .ds-t { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
  .ds-ta { flex: 1; min-height: 120px; }
  .ds-act { margin-top: var(--sp-16); }
  .ds-drop { flex: 1; min-height: 180px; border: 2px dashed var(--brand-soft-2); border-radius: var(--r-md); background: var(--brand-soft); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-8); cursor: pointer; }
  .ds-drop:hover { border-color: var(--brand); }
  .ds-d1 { font-size: var(--fs-sub); font-weight: 600; color: var(--ink); }
  .ds-d2 { font-size: var(--fs-caption); color: var(--ink-3); }
  .bottompad { height: 0; }
}
/* #endif */
</style>
