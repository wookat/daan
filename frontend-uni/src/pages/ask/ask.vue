<template>
  <view class="wrap chatwrap">
    <!-- 顶部工具行 -->
    <view class="topbar">
      <view class="top-l">
        <text class="top-t">AI 问答</text>
        <text class="top-s">花生十三方法体系 · 拍题 / 文字皆可</text>
      </view>
      <view class="top-acts">
        <text class="top-btn" @click="openHistory">历史</text>
        <text v-if="results.length" class="top-btn" @click="newSession">新对话</text>
      </view>
    </view>

    <!-- 空态：相机优先取景屏 -->
    <view v-if="!results.length && !loading" class="camscreen">
      <view class="cam-top">
        <view class="cam-quick" @click="openHistory"><l-icon name="rotate-ccw" :size="14" color="#e5e9f5" /><text>历史</text></view>
        <view class="cam-quick" @click="goBook"><l-icon name="book-open" :size="14" color="#e5e9f5" /><text>错题</text></view>
      </view>
      <view class="cam-frame" @click="openCamera">
        <view class="cam-corner tl" /><view class="cam-corner tr" /><view class="cam-corner bl" /><view class="cam-corner br" />
        <l-icon name="camera" :size="34" color="#8fa3d9" />
        <text class="cam-tip">将题目放入框内拍下，AI 讲给你听</text>
        <text class="cam-tip2">答案 + 花生十三速解方法 + 可迁移技巧</text>
      </view>
      <view class="cam-modes">
        <text class="cam-mode on">拍单题</text>
        <text class="cam-mode dim" aria-disabled="true">整页批改 · 即将上线</text>
        <text class="cam-mode" @click="textOpen = true">文字输入</text>
      </view>
      <view class="cam-acts">
        <view class="cam-side" @click="openAlbum"><l-icon name="files" :size="22" color="#e5e9f5" /><text>相册</text></view>
        <view class="cam-shutter" @click="openCamera"><view class="cam-shutter-in" /></view>
        <view class="cam-side" @click="goInterview"><l-icon name="mic" :size="22" color="#e5e9f5" /><text>面试</text></view>
      </view>
    </view>

    <!-- 桌面空态操作台：粘贴/上传优先（仅 H5 ≥1024px） -->
    <!-- #ifdef H5 -->
    <view v-if="!results.length && !loading" class="deskstart card">
      <view class="ds-col">
        <view class="ds-h"><l-icon name="clipboard-list" :size="18" color="#2e5bff" /><text class="ds-t">粘贴题目文字</text></view>
        <textarea v-model="qtext" class="ta ds-ta" placeholder="粘贴题干和选项…" :maxlength="-1" />
        <text class="label">你选的答案（可选，填了会帮你分析错因）</text>
        <view class="ans-chips">
          <text v-for="o in ['A', 'B', 'C', 'D']" :key="o" class="ans-chip" :class="{ on: uanswer === o }" @click="uanswer = uanswer === o ? '' : o">{{ o }}</text>
        </view>
        <button class="btn sheetbtn" :disabled="loading" @click="submitText">用花生十三方法讲解</button>
      </view>
      <view class="ds-col">
        <view class="ds-h"><l-icon name="camera" :size="18" color="#2e5bff" /><text class="ds-t">上传题目截图</text></view>
        <view class="ds-drop" @click="openAlbum">
          <l-icon name="files" :size="30" color="#8fa3d9" />
          <text class="ds-d1">点击选择图片，或拖拽到这里</text>
          <text class="ds-d2">也可直接 Ctrl+V 粘贴截图</text>
        </view>
      </view>
    </view>
    <!-- #endif -->

    <view v-if="!results.length && !loading && recent.length" class="card reccard">
      <view class="rec-h">最近讲解</view>
      <view v-for="r in recent" :key="r.ts" class="rec-row">
        <view class="rec-ans">{{ r.ans || '？' }}</view>
        <view class="rec-main">
          <text class="rec-brief">{{ r.brief || '已讲解' }}</text>
          <text class="rec-meta">{{ [r.module_name, r.question_type].filter(Boolean).join(' · ') || '拍题讲解' }} · {{ fmtRec(r.ts) }}</text>
        </view>
      </view>
    </view>

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
        <view class="bubble ab">
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
          <rich-text v-if="r.html" :nodes="r.html" />
          <view v-else-if="r.streaming" class="spin">生成中…</view>
          <view v-if="r.explain_key && !r.streaming" class="raterow">
            <text class="rate-q">{{ r.rated ? (r.rated === 'up' ? '已反馈：有用' : '已反馈：有误，我们会核查') : '这条解析有帮助吗？' }}</text>
            <view v-if="!r.rated" class="rate-btns">
              <view class="rate-btn" @click="rate(r, true)"><l-icon name="thumbs-up" :size="13" color="#2e5bff" /><text>有用</text></view>
              <view class="rate-btn bad" @click="rate(r, false)"><l-icon name="thumbs-down" :size="13" color="#b91c1c" /><text>有误</text></view>
            </view>
          </view>
          <!-- 追问建议 + 操作 chips -->
          <view v-if="!r.streaming" class="chips">
            <text class="chip" @click="quickFollowup(r, '请再讲得更细一点，逐步推导每一步')">再讲细一点</text>
            <text class="chip" :class="{ dim: r.simLoading }" :aria-disabled="String(!!r.simLoading)" @click="genSimilar(r)">{{ r.simLoading ? '出题中…' + r.simSecs + 's' : '出一道同款题' }}</text>
            <text class="chip" :class="{ ok: r.saved }" @click="save(r)">{{ r.saved ? '✓ 已存错题本' : '存入错题本' }}</text>
          </view>
        </view>
      </view>
      <!-- 举一反三 -->
      <view v-if="r.sim" class="msg ai">
        <view class="bubble ab">
          <view class="tags"><text class="tag">举一反三</text></view>
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
            <view class="chips">
              <text class="chip" @click="explainSim(r)">详解这道题</text>
              <text
                v-if="r.sim.correct && r.sim.picked !== r.sim.correct"
                class="chip"
                :class="{ ok: r.sim.saved }"
                @click="saveSim(r)"
              >{{ r.sim.saved ? '✓ 已存错题本' : '存入错题本' }}</text>
            </view>
          </view>
        </view>
      </view>
      <!-- 追问消息 -->
      <template v-for="(m, mi) in r.fu || []" :key="r.ts + '-fu-' + mi">
        <view class="msg" :class="m.role === 'ai' ? 'ai' : 'user'">
          <view class="bubble" :class="m.role === 'ai' ? 'ab' : 'ub'">
            <rich-text v-if="m.role === 'ai'" :nodes="m.html" />
            <text v-else class="ub-t">{{ m.content }}</text>
          </view>
        </view>
      </template>
      <view v-if="r.fuLoading" class="msg ai"><view class="bubble ab"><view class="spin">思考中…</view></view></view>
    </view>

    <view v-if="loading" class="msgs">
      <view class="msg user">
        <view class="bubble ub">
          <image v-if="stagedImage" :src="stagedImage" mode="widthFix" class="ub-img" />
          <text v-if="stagedText" class="ub-t">{{ stagedText }}</text>
        </view>
      </view>
      <view class="msg ai"><view class="bubble ab"><view class="spin">{{ loadingText }}</view></view></view>
    </view>
    <view v-if="error" class="card err">失败：{{ error }}{{ error.includes('再试') ? '' : '，请重试' }}</view>

    <view class="bottompad" />

    <!-- 底部输入栏（结果页持续行动栏：相机=再拍一题 / 文字 / 追问） -->
    <view class="inputbar">
      <view class="ib-cam" @click="openCamera"><l-icon name="camera" :size="20" color="#40434e" /></view>
      <view class="ib-txt" @click="textOpen = true"><l-icon name="clipboard-list" :size="20" color="#40434e" /></view>
      <input
        v-model="fuText"
        class="ib-inp"
        :placeholder="results.length ? '对讲解有疑问？追问 AI…' : '先拍题或粘贴题目开始'"
        confirm-type="send"
        :disabled="!results.length"
        @confirm="sendFollowup"
      />
      <view class="ib-send" :class="{ dim: !results.length || !fuText.trim() }" :aria-disabled="String(!results.length || !fuText.trim())" @click="sendFollowup">发送</view>
    </view>

    <!-- 新题文字输入 sheet -->
    <view v-if="textOpen" class="mask" @click="textOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">粘贴题目文字</text>
          <view class="sheet-x" role="button" aria-label="关闭" @click="textOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <textarea v-model="qtext" class="ta" placeholder="粘贴题干和选项…" :maxlength="-1" auto-height />
        <text class="label">你选的答案（可选，填了会帮你分析错因）</text>
        <view class="ans-chips">
          <text v-for="o in ['A', 'B', 'C', 'D']" :key="o" class="ans-chip" :class="{ on: uanswer === o }" @click="uanswer = uanswer === o ? '' : o">{{ o }}</text>
        </view>
        <button class="btn sheetbtn" :disabled="loading" @click="submitText">用花生十三方法讲解</button>
      </view>
    </view>

    <!-- 图片确认 sheet -->
    <view v-if="imagePath" class="mask" @click="clearImage">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">确认题目图片</text>
          <view class="sheet-x" role="button" aria-label="移除图片" @click="clearImage"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <image :src="imagePath" mode="widthFix" class="preview" />
        <text class="label">你选的答案（可选，填了会帮你分析错因）</text>
        <view class="ans-chips">
          <text v-for="o in ['A', 'B', 'C', 'D']" :key="o" class="ans-chip" :class="{ on: uanswer === o }" @click="uanswer = uanswer === o ? '' : o">{{ o }}</text>
        </view>
        <button class="btn sheetbtn" :disabled="loading" @click="submitImage">用花生十三方法讲解</button>
      </view>
    </view>

    <!-- 历史会话 sheet -->
    <view v-if="historyOpen" class="mask" @click="historyOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-h">
          <text class="sheet-t">历史会话</text>
          <view class="sheet-x" role="button" aria-label="关闭" @click="historyOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view>
        </view>
        <view v-if="!sessions.length" class="rec-empty">
          <text class="rec-e1">还没有历史会话</text>
          <text class="rec-e2">每次「新对话」后，之前的问答会自动存到这里（仅保存在本机）</text>
        </view>
        <view v-for="(s, si) in sessions" :key="s.id" class="rec-row" @click="loadSession(si)">
          <view class="rec-ans">{{ s.n }}</view>
          <view class="rec-main">
            <text class="rec-brief">{{ s.title }}</text>
            <text class="rec-meta">{{ s.n }} 次问答 · {{ fmtRec(s.ts) }}</text>
          </view>
          <text class="rec-del" @click.stop="delSession(si)">删除</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { md } from '../../md.js';
import { request, uploadExplain, streamExplain, anonUid, hasAccessCode, fetchAccessInfo, promptAccessCode } from '../../api.js';
import { isNativeApp, pickImageNative } from '../../native.js';
import { mergeAskSessions, upsertLocalSession, addTombstone, removeTombstone, pruneTombstones, filterTombstoned } from '../../ask-sessions.js';

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
      recent: uni.getStorageSync('recentExplains') || [],
    };
  },
  computed: {
    convo() {
      return [...this.results].reverse();
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
    this.syncSessions();
    const redo = uni.getStorageSync('redoQuestion');
    if (redo) {
      this.qtext = redo;
      const ra = uni.getStorageSync('redoAnswer');
      this.uanswer = /^[A-D]$/.test(ra) ? ra : '';
      uni.removeStorageSync('redoAnswer');
      this.imagePath = '';
      this.imageFile = null;
      this.textOpen = true;
      uni.removeStorageSync('redoQuestion');
      uni.showToast({ title: '题目已填入，先自己做一遍再点讲解', icon: 'none', duration: 2500 });
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
    goInterview() {
      uni.navigateTo({ url: '/pkgA/interview/interview' });
    },
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
      const d = new Date(ts);
      const p = (x) => (x < 10 ? '0' + x : x);
      return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    async loadDue() {
      try {
        const r = await request('/api/review?uid=' + encodeURIComponent(anonUid()));
        const dueCount = r.total || (r.items || []).length;
        if (dueCount > 0) uni.setTabBarBadge({ index: 1, text: String(dueCount > 99 ? '99+' : dueCount) });
        else uni.removeTabBarBadge({ index: 1 });
      } catch (e) { /* tabBar 未就绪时忽略 */ }
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
      this.startTimer();
      try {
        let d;
        const rec = {
          ts: Date.now(),
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
          onMeta: (m) => {
            Object.assign(rec, m, { ansCard: null, userImage: img || '', userText: txt || '', user_answer: uans });
            this.results.unshift(rec);
            live = this.results[0];
            inserted = true;
            clearInterval(this.timer);
            this.loading = false;
            this.scrollBottom();
          },
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
    async genSimilar(r) {
      if (r.simLoading) return;
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
    },
    newSession() {
      this.archiveCurrent();
      this.results = [];
      this.error = '';
      uni.removeStorageSync('askCurSession');
      this.curSid = 0;
      uni.removeStorageSync('askCurSid');
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
    loadSession(i) {
      const s = this.sessions[i];
      if (!s) return;
      this.archiveCurrent();
      this.curSid = s.id;
      uni.setStorageSync('askCurSid', s.id);
      this.results = s.items.map((r) => {
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
      }
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; padding-bottom: 40rpx; }
.chatwrap { min-height: calc(100vh - 120px); }
.bottompad { height: 140rpx; }

.topbar { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 8rpx 20rpx; }
.top-t { display: block; font-size: 34rpx; font-weight: 700; color: var(--ink); }
.top-s { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 4rpx; }
.top-acts { display: flex; gap: 12rpx; }
.top-btn { font-size: 24rpx; color: var(--brand-text); background: var(--brand-soft); border-radius: 999rpx; padding: 0 24rpx; min-height: 44px; display: inline-flex; align-items: center; }

.camscreen { background: linear-gradient(180deg, #171c2b, #1f2740); border-radius: 24rpx; padding: 24rpx 24rpx 32rpx; margin-bottom: 24rpx; }
.cam-top { display: flex; justify-content: flex-end; gap: 14rpx; margin-bottom: 18rpx; }
.cam-quick { display: inline-flex; align-items: center; gap: 6rpx; min-height: 44px; box-sizing: border-box; padding: 0 22rpx; border-radius: 999rpx; background: rgba(255, 255, 255, 0.1); color: #e5e9f5; font-size: 23rpx; }
.cam-frame { position: relative; min-height: 380rpx; border-radius: 20rpx; background: rgba(255, 255, 255, 0.04); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; padding: 30rpx; }
.cam-corner { position: absolute; width: 40rpx; height: 40rpx; border: 4rpx solid #5b8af8; }
.cam-corner.tl { top: 18rpx; left: 18rpx; border-right: none; border-bottom: none; border-radius: 8rpx 0 0 0; }
.cam-corner.tr { top: 18rpx; right: 18rpx; border-left: none; border-bottom: none; border-radius: 0 8rpx 0 0; }
.cam-corner.bl { bottom: 18rpx; left: 18rpx; border-right: none; border-top: none; border-radius: 0 0 0 8rpx; }
.cam-corner.br { bottom: 18rpx; right: 18rpx; border-left: none; border-top: none; border-radius: 0 0 8rpx 0; }
.cam-tip { font-size: 27rpx; font-weight: 600; color: #e5e9f5; }
.cam-tip2 { font-size: 22rpx; color: #8fa3d9; }
.cam-modes { display: flex; justify-content: center; gap: 14rpx; margin: 24rpx 0 10rpx; }
.cam-mode { font-size: 23rpx; color: #b9c4e2; min-height: 44px; display: inline-flex; align-items: center; padding: 0 20rpx; border-radius: 999rpx; }
.cam-mode.on { color: #fff; font-weight: 700; background: rgba(91, 138, 248, 0.35); }
.cam-mode.dim { opacity: 0.45; }
.cam-acts { display: flex; align-items: center; justify-content: space-around; margin-top: 6rpx; }
.cam-side { display: flex; flex-direction: column; align-items: center; gap: 6rpx; color: #e5e9f5; font-size: 22rpx; min-width: 44px; min-height: 44px; justify-content: center; }
.cam-shutter { width: 128rpx; height: 128rpx; border-radius: 50%; border: 6rpx solid rgba(255, 255, 255, 0.85); display: flex; align-items: center; justify-content: center; }
.cam-shutter-in { width: 96rpx; height: 96rpx; border-radius: 50%; background: linear-gradient(135deg, #5b8af8, var(--brand)); box-shadow: 0 8rpx 24rpx rgba(46, 91, 255, 0.45); }
.reccard { text-align: left; }

.msgs { display: flex; flex-direction: column; }
.msg { display: flex; margin-bottom: 20rpx; }
.msg.user { justify-content: flex-end; }
.msg.ai { justify-content: flex-start; }
.bubble { max-width: 86%; border-radius: 28rpx; padding: 20rpx 26rpx; font-size: 27rpx; line-height: 1.7; box-sizing: border-box; }
.ub { background: var(--brand); color: #fff; border-bottom-right-radius: 8rpx; }
.ub-t { white-space: pre-wrap; word-break: break-all; }
.ub-img { width: 320rpx; border-radius: 14rpx; display: block; }
.ub-ans { display: block; margin-top: 8rpx; font-size: 22rpx; color: rgba(255, 255, 255, 0.85); }
.ab { background: var(--card); color: var(--ink); border: 1rpx solid var(--line); border-bottom-left-radius: 8rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); max-width: 94%; }

.chips { display: flex; gap: 12rpx; flex-wrap: wrap; margin-top: 16rpx; }
.chip { font-size: 24rpx; color: var(--brand-text); background: var(--brand-soft); border-radius: 999rpx; padding: 0 24rpx; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; }
.chip.ok { color: var(--ok); background: var(--ok-soft); }
.chip.dim { opacity: 0.5; }

.inputbar { position: fixed; left: 0; right: 0; bottom: calc(50px + env(safe-area-inset-bottom)); z-index: 40; display: flex; align-items: center; gap: 14rpx; background: var(--card); border-top: 1rpx solid var(--line); padding: 16rpx 24rpx; box-sizing: border-box; }
/* #ifndef H5 */
.inputbar { bottom: 0; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); }
/* #endif */
.ib-cam, .ib-txt { flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%; background: var(--soft-bg); display: flex; align-items: center; justify-content: center; font-size: 34rpx; }
.ib-inp { flex: 1; height: 44px; border: 1rpx solid var(--line); border-radius: 999rpx; padding: 0 26rpx; font-size: 26rpx; background: var(--soft-bg); box-sizing: border-box; }
.ib-send { flex-shrink: 0; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 30rpx; background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 26rpx; font-weight: 600; }
.ib-send.dim { opacity: 0.4; }

.mask { position: fixed; inset: 0; background: rgba(15, 18, 30, 0.5); z-index: 90; display: flex; align-items: flex-end; }
.sheet { width: 100%; box-sizing: border-box; background: var(--card); border-radius: 32rpx 32rpx 0 0; padding: 32rpx 28rpx calc(36rpx + env(safe-area-inset-bottom)); max-height: 76vh; overflow-y: auto; }
/* #ifdef H5 */
/* H5 底部 TabBar 常驻：整个弹层收在 TabBar 上方，内容再高也不会被遮挡 */
@media (max-width: 767px) {
  .mask { bottom: calc(50px + env(safe-area-inset-bottom)); }
}
/* #endif */
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.sheet-t { font-size: 30rpx; font-weight: 700; }
.sheet-x { font-size: 28rpx; color: var(--ink-2); padding: 8rpx 16rpx; }
.sheetbtn { margin-top: 28rpx; width: 100%; }

.card { background: var(--card); border-radius: var(--radius); padding: 28rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.label { font-size: 24rpx; color: var(--ink-2); display: block; margin: 20rpx 0 10rpx; }
.btn { background: var(--brand); color: #fff; border-radius: 18rpx; font-size: 30rpx; font-weight: 600; box-shadow: 0 6rpx 16rpx rgba(46, 91, 255, 0.25); min-height: 44px; line-height: 44px; }
.btn[disabled] { opacity: 0.6; }
.btn.ghost { background: var(--brand-soft); color: var(--brand-text); box-shadow: none; }
.btn.sm { font-size: 26rpx; flex: 1; }
.btn.ok { background: var(--ok); color: #fff; opacity: 1 !important; box-shadow: none; }
.btn.bad { background: var(--bad); color: #fff; box-shadow: none; }
.btn.dim { opacity: 0.35; }
.ta { width: 100%; min-height: 160rpx; border: 1rpx solid var(--line); border-radius: 18rpx; padding: 18rpx; font-size: 28rpx; box-sizing: border-box; background: var(--soft-bg); }
.ans-chips { display: flex; gap: 16rpx; }
.ans-chip { flex: 1; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; font-size: 28rpx; font-weight: 600; color: var(--ink-2); background: var(--soft-bg); border: 1rpx solid var(--line); border-radius: 16rpx; }
.ans-chip.on { color: var(--brand-text); background: var(--brand-soft); border-color: var(--brand-text); }
.preview { width: 100%; border-radius: 18rpx; margin-top: 8rpx; }
.spin { color: var(--ink-2); font-size: 25rpx; }
.raterow { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; background: var(--soft-bg); border-radius: 14rpx; padding: 16rpx 22rpx; margin-top: 16rpx; flex-wrap: wrap; }
.rate-q { font-size: 24rpx; color: var(--ink-2); }
.rate-btns { display: flex; gap: 14rpx; }
.rate-btn { display: inline-flex; align-items: center; gap: 6rpx; font-size: 24rpx; color: var(--brand-text); border: 1rpx solid var(--brand); border-radius: 999rpx; padding: 8rpx 24rpx; }
.rate-btn.bad { color: var(--bad); border-color: var(--bad); }
.anscard { display: flex; align-items: center; gap: 22rpx; background: var(--brand-soft); border: 1rpx solid var(--brand-soft-2); border-radius: 20rpx; padding: 22rpx 26rpx; margin: 6rpx 0 16rpx; }
.ans-big { flex-shrink: 0; min-width: 88rpx; height: 88rpx; padding: 0 14rpx; border-radius: 20rpx; background: var(--brand); color: #fff; font-size: 44rpx; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 6rpx 14rpx rgba(46, 91, 255, 0.3); }
.ans-r { flex: 1; min-width: 0; }
.ans-method { display: inline-block; background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 21rpx; font-weight: 600; padding: 4rpx 18rpx; margin-bottom: 8rpx; }
.ans-brief { display: block; font-size: 25rpx; color: var(--ink); line-height: 1.5; }
.err { color: var(--bad); background: var(--bad-soft); font-size: 26rpx; }
.tags { margin-bottom: 10rpx; }
.tag { display: inline-block; background: var(--brand-soft); color: var(--brand-text); border-radius: 999rpx; padding: 6rpx 20rpx; font-size: 22rpx; margin-right: 10rpx; }
.row { display: flex; gap: 14rpx; margin: 10rpx 0; }
.rec-h { font-size: 28rpx; font-weight: 600; margin-bottom: 14rpx; }
.rec-row { display: flex; align-items: center; gap: 18rpx; min-height: 112rpx; border-bottom: 1rpx solid var(--line); }
.rec-row:last-of-type { border-bottom: none; }
.rec-ans { width: 72rpx; height: 72rpx; border-radius: 16rpx; background: var(--brand-soft); color: var(--brand-text); font-size: 32rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rec-main { flex: 1; min-width: 0; }
.rec-brief { display: block; font-size: 25rpx; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rec-meta { display: block; font-size: 21rpx; color: var(--ink-2); margin-top: 4rpx; }
.rec-del { flex-shrink: 0; font-size: 23rpx; color: var(--bad); min-height: 44px; display: inline-flex; align-items: center; padding: 0 8rpx; }
.rec-empty { padding: 10rpx 0 6rpx; }
.rec-e1 { display: block; font-size: 26rpx; font-weight: 600; color: var(--ink-2); }
.rec-e2 { display: block; font-size: 23rpx; color: var(--ink-3); line-height: 1.7; margin-top: 8rpx; }

/* #ifdef H5 */
.deskstart { display: none; }

@media (min-width: 768px) {
  .wrap.chatwrap { max-width: 760px; }
  .inputbar { left: 208px; bottom: 0; padding: 16rpx 15%; }
  .bubble { max-width: 72%; }
  .chip:hover, .top-btn:hover, .eg-btn:hover { cursor: pointer; filter: brightness(0.97); }
}

/* 桌面空态操作台：粘贴/上传优先，取景屏仅留移动端 */
@media (min-width: 1024px) {
  .camscreen { display: none; }
  .deskstart { display: flex; gap: 32rpx; align-items: stretch; }
  .ds-col { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .ds-h { display: flex; align-items: center; gap: 10rpx; margin-bottom: 16rpx; }
  .ds-t { font-size: 28rpx; font-weight: 700; color: var(--ink); }
  .ds-ta { flex: 1; min-height: 220rpx; }
  .ds-drop { flex: 1; min-height: 300rpx; border: 2rpx dashed var(--brand-soft-2); border-radius: 20rpx; background: var(--brand-soft); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12rpx; cursor: pointer; }
  .ds-drop:hover { border-color: var(--brand-text); }
  .ds-d1 { font-size: 26rpx; font-weight: 600; color: var(--ink); }
  .ds-d2 { font-size: 23rpx; color: var(--ink-2); }
}
/* #endif */
</style>
