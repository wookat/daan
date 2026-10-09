// AI 问答（对齐 frontend-uni/src/pages/ask/ask.vue）：拍题/文字讲解（流式优先）、答案卡、追问、同款题、
// 存错题本、评分、进行中会话本机+服务端快照、历史会话跨设备同步与删除墓碑。
import { postMistake, trackEvent } from '../../api/index';
import { voiceStart, voiceStop } from '../../utils/kg-voice';
import {
  deleteAskSession,
  fetchAccessInfo,
  fetchAskCur,
  fetchAskSessions,
  followup,
  rateExplain,
  saveAskCur,
  saveAskSession,
  similarQuestion,
  streamExplain,
} from '../../api/social';
import type { ExplainMeta } from '../../api/social';
import { getAccessCode } from '../../utils/auth';
import { promptAccessCode } from '../../utils/request';
import { md, splitAnswer, stripStop } from '../../utils/md';
import type { AnsCard } from '../../utils/md';
import {
  addTombstone,
  askQid,
  filterTombstoned,
  mergeAskSessions,
  parseRemoteCur,
  pruneTombstones,
  removeTombstone,
  sanitizeCurItems,
  upsertLocalSession,
} from '../../utils/ask-sessions';
import type { AskFu, AskItem, AskSession } from '../../utils/ask-sessions';
import { toastErr, toastInfo, toastOk } from '../../utils/toast';

interface FuMsg extends AskFu {
  html: string;
}

interface SimState {
  raw: string;
  rawAns: string;
  qHtml: string;
  ansHtml: string;
  correct: string | null;
  picked: string;
  saved: boolean;
  optCls: Record<string, string>;
}

interface Rec {
  ts: number;
  qid: number;
  module: string;
  module_name: string;
  question_type: string;
  question_text: string;
  explanation: string;
  explain_key: string;
  user_answer: string;
  userText: string;
  userImage: string;
  html: string;
  ansCard: AnsCard | null;
  saved: boolean;
  rated: string;
  sim: SimState | null;
  simLoading: boolean;
  simSecs: number;
  // 出同款题难度档（B6：easier/same/harder/combo，默认持平）
  simDiff: string;
  fu: FuMsg[];
  fuLoading: boolean;
  streaming: boolean;
}

interface RecentItem {
  ts: number;
  module_name: string;
  question_type: string;
  ans: string;
  brief: string;
  meta?: string;
  time?: string;
}

const OPTS = ['A', 'B', 'C', 'D'];

function fmtRec(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => (x < 10 ? '0' + x : String(x));
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function blankRec(ts: number): Rec {
  return {
    ts,
    qid: 0,
    module: '',
    module_name: '',
    question_type: '',
    question_text: '',
    explanation: '',
    explain_key: '',
    user_answer: '',
    userText: '',
    userImage: '',
    html: '',
    ansCard: null,
    saved: false,
    rated: '',
    sim: null,
    simLoading: false,
    simSecs: 0,
    simDiff: 'same',
    fu: [],
    fuLoading: false,
    streaming: false,
  };
}

function applyMeta(r: Rec, m: ExplainMeta): void {
  // 服务端确认的题号优先，否则保留深链带入的（缓存命中 / 题干未命中题库时服务端不回 qid）
  r.qid = askQid(m.qid) || r.qid;
  r.module = m.module || '';
  r.module_name = m.module_name || '';
  r.question_type = m.question_type || '';
  r.question_text = m.question_text || '';
  r.explain_key = m.explain_key || '';
}

function simOptCls(sim: SimState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of OPTS) {
    if (!sim.picked) out[o] = '';
    else if (sim.correct && o === sim.correct) out[o] = 'ok';
    else if (o === sim.picked && sim.correct && o !== sim.correct) out[o] = 'bad';
    else out[o] = 'dim';
  }
  return out;
}

function simQuestionText(sim: SimState): string {
  return (sim.raw || '').replace(/^##\s*练习题\s*/, '').replace(/##\s*提示[\s\S]*$/, '').trim();
}

Page({
  data: {
    opts: OPTS,
    imagePath: '',
    qtext: '',
    uanswer: '',
    fuText: '',
    voiceOn: false,
    voiceFor: '' as '' | 'qtext' | 'fuText',
    textOpen: false,
    historyOpen: false,
    loading: false,
    loadingText: '',
    stagedImage: '',
    stagedText: '',
    error: '',
    errorText: '',
    convo: [] as Rec[],
    hasResults: false,
    sessions: [] as AskSession[],
    sessionRows: [] as { id: number; n: number; title: string; meta: string; on: boolean }[],
    // 同款题难度四档（与后端 SIMILAR_LEVELS 一致）
    simDiffOpts: [
      { value: 'easier', label: '降干扰' },
      { value: 'same', label: '持平' },
      { value: 'harder', label: '加复杂度' },
      { value: 'combo', label: '加综合度' },
    ],
    // 问泽快捷提问（B6）
    wenzeChips: ['这道题陷阱在哪', '换个方法怎么解', '给一道变式'],
    curSid: 0,
    recent: [] as RecentItem[],
    taSize: { minHeight: 96, maxHeight: 220 },
    scrollInto: '',
  },

  results: [] as Rec[],
  timer: 0 as ReturnType<typeof setInterval> | 0,
  curPushT: 0 as ReturnType<typeof setTimeout> | 0,
  curCleared: false,
  pendingQid: 0,

  onLoad() {
    const sessions = mergeAskSessions(wx.getStorageSync('askSessions'), []);
    const recent = (wx.getStorageSync('recentExplains') || []) as RecentItem[];
    this.setData({
      curSid: Number(wx.getStorageSync('askCurSid')) || 0,
      recent: recent.map((r) => ({
        ...r,
        meta: ([r.module_name, r.question_type].filter(Boolean).join(' · ') || '拍题讲解') + ' · ' + fmtRec(r.ts),
      })),
    });
    this.setSessions(sessions);
  },

  onShow() {
    this.restoreCurSession();
    this.syncSessions();
    this.openLinkedSession();
    const redo = wx.getStorageSync('redoQuestion') as string;
    if (redo) {
      const ra = wx.getStorageSync('redoAnswer') as string;
      wx.removeStorageSync('redoAnswer');
      this.pendingQid = askQid(wx.getStorageSync('redoQid'));
      wx.removeStorageSync('redoQid');
      wx.removeStorageSync('redoQuestion');
      this.setData({ qtext: redo, uanswer: /^[A-D]$/.test(ra) ? ra : '', imagePath: '', textOpen: true });
      wx.showToast({ title: '题目已填入，先自己做一遍再点讲解', icon: 'none', duration: 2500 });
    }
    // 「练一道同类题」深链（错题本/刷题详情 → storage simSeed）：落一条轻量 rec 并自动出题
    const seed = wx.getStorageSync('simSeed') as { q?: string; qt?: string; mod?: string; modName?: string; diff?: string } | '';
    if (seed && seed.q) {
      wx.removeStorageSync('simSeed');
      const r = blankRec(Date.now());
      r.question_text = seed.q;
      r.question_type = seed.qt || '';
      r.module = seed.mod || '';
      r.module_name = seed.modName || '';
      r.userText = seed.q;
      r.userText = r.userText.slice(0, 200);
      if (seed.diff && ['easier', 'harder', 'combo'].includes(seed.diff)) r.simDiff = seed.diff;
      r.html = '<p class="muted">从「练一道同类题」进入——已按你的难度档生成练习题，先做再讲</p>';
      this.results.unshift(r);
      this.syncConvo(true);
      this.genSimilar(r);
    }
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
    if (this.curPushT) clearTimeout(this.curPushT);
  },

  // ---------- 渲染同步 ----------
  syncConvo(scroll = false) {
    const convo = [...this.results].reverse();
    this.setData({ convo, hasResults: convo.length > 0 });
    if (scroll) this.scrollBottom();
  },

  patchRec(r: Rec, keys: (keyof Rec)[]) {
    const i = this.data.convo.findIndex((x) => x.ts === r.ts);
    if (i < 0) {
      this.syncConvo();
      return;
    }
    const patch: Record<string, unknown> = {};
    for (const k of keys) patch[`convo[${i}].${k}`] = r[k];
    this.setData(patch);
  },

  scrollBottom() {
    const last = this.results[0];
    this.setData({ scrollInto: last ? 'msg-' + last.ts : 'msg-loading' });
  },

  setSessions(sessions: AskSession[]) {
    const cur = this.data.curSid;
    this.setData({
      sessions,
      sessionRows: sessions.map((s) => ({
        id: s.id,
        n: s.n,
        title: s.title,
        meta: `${s.n} 次问答 · ${fmtRec(s.ts)}`,
        on: s.id === cur,
      })),
    });
  },

  setError(msg: string) {
    this.setData({ error: msg, errorText: msg ? '失败：' + msg + (msg.includes('再试') ? '' : '，请重试') : '' });
  },

  // ---------- 输入 ----------
  onQtext(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ qtext: e.detail.value });
  },
  onFuText(e: WechatMiniprogram.Input) {
    this.setData({ fuText: e.detail.value });
  },

  // 语音输入（微信同声传译插件；未开通时降级为不可用）
  onVoice(e: WechatMiniprogram.TouchEvent) {
    const forField = (e.currentTarget.dataset.for === 'qtext' ? 'qtext' : 'fuText') as 'qtext' | 'fuText';
    if (this.data.voiceOn) {
      voiceStop();
      return;
    }
    const field = forField;
    const base = this.data[field] || '';
    const ok = voiceStart({
      onRecognize: (text) => this.setData({ [field]: base + text }),
      onStop: (text) => {
        this.setData({ voiceOn: false, [field]: (base + (text || '')).trim() });
      },
      onError: (msg) => {
        this.setData({ voiceOn: false });
        wx.showToast({ title: msg || '语音不可用', icon: 'none' });
      },
    });
    if (!ok) {
      wx.showToast({ title: '语音识别不可用：请在小程序后台开通同声传译插件', icon: 'none' });
      return;
    }
    wx.showToast({ title: '正在聆听，说完点停止', icon: 'none' });
    this.setData({ voiceOn: true, voiceFor: field });
  },
  onPickAns(e: WechatMiniprogram.TouchEvent) {
    const o = String(e.currentTarget.dataset.o || '');
    this.setData({ uanswer: this.data.uanswer === o ? '' : o });
  },
  openText() {
    this.setData({ textOpen: true });
  },
  onTextVisible(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    if (!e.detail.visible) this.setData({ textOpen: false });
  },
  onImageVisible(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    if (!e.detail.visible) this.setData({ imagePath: '' });
  },
  onHistoryVisible(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    if (!e.detail.visible) this.setData({ historyOpen: false });
  },
  openHistory() {
    this.setData({ historyOpen: true });
  },
  goBook() {
    wx.switchTab({ url: '/pages/book/book' });
  },
  goBookAi() {
    wx.setStorageSync('bookAiOpen', 1);
    wx.switchTab({ url: '/pages/book/book' });
  },
  goInterview() {
    wx.navigateTo({ url: '/pkgSocial/interview/interview' });
  },

  chooseImage(source: 'camera' | 'album') {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: [source],
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (f) this.setData({ imagePath: f.tempFilePath });
      },
    });
  },
  openCamera() {
    this.chooseImage('camera');
  },
  openAlbum() {
    this.chooseImage('album');
  },

  // AI 问答需访问码（内测）：提前提示；取消时不丢失已输入内容
  async ensureAccess(): Promise<boolean> {
    if (getAccessCode()) return true;
    const info = await fetchAccessInfo();
    if (!info || !info.required) return true;
    const ok = await promptAccessCode();
    if (!ok) toastInfo('已取消，输入的内容已保留');
    return ok;
  },

  async submitText() {
    const txt = this.data.qtext.trim();
    if (!txt) {
      toastInfo('请粘贴题目文字');
      return;
    }
    if (!(await this.ensureAccess())) return;
    this.setData({ textOpen: false });
    this.doExplain('', txt);
  },

  async submitImage() {
    if (!(await this.ensureAccess())) return;
    const img = this.data.imagePath;
    this.setData({ imagePath: '' });
    this.doExplain(img, '');
  },

  startTimer() {
    let secs = 0;
    this.setData({ loadingText: '⏳ AI 识题中…（0秒）' });
    this.timer = setInterval(() => {
      secs++;
      this.setData({
        loadingText:
          secs < 8
            ? `⏳ AI 识题中…（${secs}秒）`
            : secs < 25
              ? `已识题，正在匹配花生十三方法…（${secs}秒）`
              : `正在生成分步讲解，马上好…（${secs}秒）`,
      });
    }, 1000);
  },
  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = 0;
  },

  applyExplain(r: Rec, raw: string) {
    const full = stripStop(raw);
    if (!r.ansCard) {
      const first = full.split('\n')[0] || '';
      if (first.startsWith('【答案】') && !full.includes('\n')) {
        r.html = '';
        return;
      }
    }
    const { card, rest } = splitAnswer(full);
    if (card) r.ansCard = card;
    r.html = md(card ? rest : full);
    if (!r.streaming) this.saveRecent(r);
  },

  saveRecent(r: Rec) {
    const recent = (wx.getStorageSync('recentExplains') || []) as RecentItem[];
    if (recent.some((x) => x.ts === r.ts)) return;
    const item: RecentItem = {
      ts: r.ts,
      module_name: r.module_name || '',
      question_type: r.question_type || '',
      ans: (r.ansCard && r.ansCard.ans) || '',
      brief: ((r.ansCard && r.ansCard.brief) || '').slice(0, 40),
    };
    const next = [item, ...recent].slice(0, 10);
    wx.setStorageSync('recentExplains', next);
    this.setData({
      recent: next.map((x) => ({
        ...x,
        meta: ([x.module_name, x.question_type].filter(Boolean).join(' · ') || '拍题讲解') + ' · ' + fmtRec(x.ts),
      })),
    });
  },

  async doExplain(img: string, txt: string) {
    if (!img && !txt) return;
    this.setError('');
    this.setData({ loading: true, stagedImage: img || '', stagedText: txt || '', scrollInto: 'msg-loading' });
    const uans = this.data.uanswer.trim();
    const qid = txt ? this.pendingQid || 0 : 0;
    this.pendingQid = 0;
    this.startTimer();
    const rec = blankRec(Date.now());
    rec.qid = qid;
    rec.userImage = img || '';
    rec.userText = txt || '';
    rec.user_answer = uans;
    rec.streaming = true;
    let inserted = false;
    try {
      const d = await streamExplain({
        filePath: img || null,
        text: txt || null,
        userAnswer: uans || null,
        questionId: qid || null,
        onMeta: (m) => {
          applyMeta(rec, m);
          this.results.unshift(rec);
          inserted = true;
          this.stopTimer();
          this.setData({ loading: false });
          this.syncConvo(true);
        },
        onDelta: (full) => {
          rec.explanation = full;
          this.applyExplain(rec, full);
          this.patchRec(rec, ['html', 'ansCard']);
        },
      });
      if (!inserted) this.results.unshift(rec);
      applyMeta(rec, d);
      rec.explanation = d.explanation || '';
      rec.streaming = false;
      this.applyExplain(rec, rec.explanation);
      this.setData({ uanswer: '', qtext: '' });
      this.persistSession();
    } catch (e) {
      // 失败时重新展开文本面板，已粘贴的题目原文保留可重试
      this.setError((e as Error).message || '生成失败');
      if (txt) this.setData({ textOpen: true });
    }
    this.stopTimer();
    this.setData({ loading: false });
    this.syncConvo(true);
  },

  // ---------- 单条操作 ----------
  recByEvent(e: WechatMiniprogram.BaseEvent): Rec | null {
    const ts = Number(e.currentTarget.dataset.ts);
    return this.results.find((r) => r.ts === ts) || null;
  },

  async onRate(e: WechatMiniprogram.BaseEvent) {
    const r = this.recByEvent(e);
    if (!r || r.rated) return;
    const up = String(e.currentTarget.dataset.up) === '1';
    r.rated = up ? 'up' : 'down';
    this.patchRec(r, ['rated']);
    try {
      await rateExplain(r.explain_key, up);
    } catch (err) {
      /* 静默失败 */
    }
    toastInfo(up ? '感谢反馈' : '已记录，我们会核查这条解析');
  },

  async onSave(e: WechatMiniprogram.BaseEvent) {
    const r = this.recByEvent(e);
    if (!r || r.saved) return;
    try {
      await postMistake({
        question_id: r.qid || null,
        module: r.module,
        question_type: r.question_type,
        question_text: r.question_text,
        user_answer: r.user_answer,
        correct_answer: (r.ansCard && r.ansCard.ans) || '',
        explanation: r.explanation,
      });
      r.saved = true;
      this.patchRec(r, ['saved']);
      this.persistSession();
    } catch (err) {
      toastErr('保存失败：' + (err as Error).message);
    }
  },

  onDetail(e: WechatMiniprogram.BaseEvent) {
    const r = this.recByEvent(e);
    if (r) this.quickFollowup(r, '请再讲得更细一点，逐步推导每一步');
  },

  sendFollowup() {
    const q = this.data.fuText.trim();
    if (!q || !this.results.length) return;
    this.setData({ fuText: '' });
    this.quickFollowup(this.results[0], q);
  },

  async quickFollowup(r: Rec, q: string) {
    if (r.fuLoading || r.streaming) return;
    r.fu.push({ role: 'user', content: q, html: '' });
    r.fuLoading = true;
    this.patchRec(r, ['fu', 'fuLoading']);
    this.scrollBottom();
    try {
      const d = await followup({
        question_text: r.question_text,
        explanation: r.explanation,
        history: r.fu.slice(0, -1).map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })),
        query: q,
      });
      const ans = stripStop(d.answer);
      r.fu.push({ role: 'ai', content: ans, html: md(ans) });
      this.persistSession();
    } catch (e) {
      toastErr('追问失败：' + (e as Error).message);
    }
    r.fuLoading = false;
    this.patchRec(r, ['fu', 'fuLoading']);
    this.scrollBottom();
  },

  onSimDiff(e: WechatMiniprogram.TouchEvent) {
    const r = this.recByEvent(e);
    const v = String(e.currentTarget.dataset.v || 'same');
    if (!r || r.simDiff === v) return;
    r.simDiff = v;
    this.patchRec(r, ['simDiff']);
  },

  // 问泽 chips：快捷追问（本题上下文，同 sendFollowup 管线）
  onWenze(e: WechatMiniprogram.BaseEvent) {
    const r = this.recByEvent(e);
    const q = String(e.currentTarget.dataset.q || '');
    if (r && q) this.quickFollowup(r, q);
  },

  async onSimilar(e: WechatMiniprogram.BaseEvent) {
    const r = this.recByEvent(e);
    if (r) await this.genSimilar(r);
  },

  async genSimilar(r: Rec) {
    if (!r || r.simLoading) return;
    r.simLoading = true;
    r.simSecs = 0;
    this.patchRec(r, ['simLoading', 'simSecs']);
    const t = setInterval(() => {
      r.simSecs++;
      this.patchRec(r, ['simSecs']);
    }, 1000);
    try {
      const d = await similarQuestion(r.question_text, r.question_type, r.simDiff);
      const parts = d.content.split('<!--answer-->');
      const m = (parts[1] || '').match(/答案[：:\s*]*([A-D])/);
      const sim: SimState = {
        raw: parts[0],
        rawAns: parts[1] || '',
        qHtml: md(parts[0]),
        ansHtml: parts[1] ? md(parts[1]) : '',
        correct: m ? m[1] : null,
        picked: '',
        saved: false,
        optCls: {},
      };
      sim.optCls = simOptCls(sim);
      r.sim = sim;
    } catch (err) {
      toastErr('出题失败：' + (err as Error).message);
    }
    clearInterval(t);
    r.simLoading = false;
    this.patchRec(r, ['sim', 'simLoading']);
    this.scrollBottom();
  },

  onPickSim(e: WechatMiniprogram.TouchEvent) {
    const r = this.recByEvent(e);
    if (!r || !r.sim || r.sim.picked) return;
    r.sim.picked = String(e.currentTarget.dataset.o || '');
    r.sim.optCls = simOptCls(r.sim);
    this.patchRec(r, ['sim']);
  },

  onExplainSim(e: WechatMiniprogram.BaseEvent) {
    const r = this.recByEvent(e);
    if (!r || !r.sim) return;
    this.setData({ uanswer: r.sim.picked || '' });
    this.doExplain('', simQuestionText(r.sim));
  },

  async onSaveSim(e: WechatMiniprogram.BaseEvent) {
    const r = this.recByEvent(e);
    if (!r || !r.sim || r.sim.saved) return;
    try {
      await postMistake({
        question_id: null,
        module: r.module,
        question_type: r.question_type,
        question_text: simQuestionText(r.sim),
        user_answer: r.sim.picked,
        correct_answer: r.sim.correct || '',
        explanation: ((r.sim.raw || '') + '\n' + (r.sim.rawAns || '')).trim(),
      });
      r.sim.saved = true;
      this.patchRec(r, ['sim']);
      toastOk('已存入错题本');
    } catch (err) {
      toastErr('保存失败：' + (err as Error).message);
    }
  },

  // ---------- 会话持久化（本机 + 服务端快照） ----------
  toItems(): AskItem[] {
    return this.results.map((r) => ({
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
      fu: r.fu.map((m) => ({ role: m.role, content: m.content })),
    }));
  },

  persistSession() {
    wx.setStorageSync('askCurSession', this.toItems());
    this.pushCurSession();
  },

  pushCurSession() {
    if (this.curPushT) clearTimeout(this.curPushT);
    this.curPushT = setTimeout(() => {
      const items = sanitizeCurItems(wx.getStorageSync('askCurSession'));
      if (!items.length) return;
      saveAskCur(this.data.curSid || Number(wx.getStorageSync('askCurSid')) || 0, items).catch(() => undefined);
    }, 1500);
  },

  newSession() {
    this.archiveCurrent();
    this.results = [];
    this.setError('');
    wx.removeStorageSync('askCurSession');
    wx.removeStorageSync('askCurSid');
    this.setData({ curSid: 0 });
    this.curCleared = true;
    if (this.curPushT) clearTimeout(this.curPushT);
    saveAskCur(0, []).catch(() => undefined);
    this.syncConvo();
    this.setSessions(this.data.sessions);
  },

  archiveCurrent() {
    if (!this.results.length) return;
    const first = this.results[this.results.length - 1];
    const title = ((first.ansCard && first.ansCard.brief) || first.userText || first.question_text || '问答会话').slice(0, 30);
    const items = sanitizeCurItems(wx.getStorageSync('askCurSession'));
    if (!items.length) return;
    const sid = this.data.curSid || Number(wx.getStorageSync('askCurSid')) || Date.now();
    const sess: AskSession = { id: sid, ts: Date.now(), title, n: items.length, items };
    wx.setStorageSync('askDelTombs', removeTombstone(wx.getStorageSync('askDelTombs'), sid));
    const sessions = upsertLocalSession(this.data.sessions, sess);
    wx.setStorageSync('askSessions', sessions);
    wx.removeStorageSync('askCurSid');
    this.setData({ curSid: 0 });
    this.setSessions(sessions);
    saveAskSession(sess).catch(() => undefined);
  },

  syncSessions() {
    const tombs = pruneTombstones(wx.getStorageSync('askDelTombs'));
    wx.setStorageSync('askDelTombs', tombs);
    fetchAskSessions()
      .then((r) => {
        const sessions = mergeAskSessions(this.data.sessions, filterTombstoned((r && r.items) || [], tombs));
        wx.setStorageSync('askSessions', sessions);
        this.setSessions(sessions);
      })
      .catch(() => undefined);
    for (const k of Object.keys(tombs)) this.dropRemoteSession(Number(k));
  },

  dropRemoteSession(sid: number) {
    deleteAskSession(sid)
      .then(() => {
        wx.setStorageSync('askDelTombs', removeTombstone(wx.getStorageSync('askDelTombs'), sid));
      })
      .catch(() => undefined);
  },

  openLinkedSession() {
    const sid = askQid(wx.getStorageSync('askOpenSid'));
    wx.removeStorageSync('askOpenSid');
    if (!sid) return;
    const i = this.data.sessions.findIndex((s) => s.id === sid);
    if (i >= 0) this.loadSessionAt(i);
  },

  restoreCurSession() {
    if (this.results.length) return;
    const items = sanitizeCurItems(wx.getStorageSync('askCurSession'));
    if (items.length) {
      this.results = this.adoptItems(items);
      this.syncConvo();
      this.persistSession();
      return;
    }
    // 本机无快照：异步取服务端进行中快照（失败静默）
    fetchAskCur()
      .then((r) => {
        if (this.results.length || this.curCleared) return;
        if (sanitizeCurItems(wx.getStorageSync('askCurSession')).length) return;
        const cur = parseRemoteCur(r);
        if (!cur) return;
        if (cur.sid > 0) {
          wx.setStorageSync('askCurSid', cur.sid);
          this.setData({ curSid: cur.sid });
        }
        this.results = this.adoptItems(cur.items);
        this.syncConvo();
        this.persistSession();
      })
      .catch(() => undefined);
  },

  adoptItems(items: AskItem[]): Rec[] {
    return items.map((it) => {
      const r = blankRec(it.ts);
      r.qid = askQid(it.qid);
      r.module = it.module || '';
      r.module_name = it.module_name || '';
      r.question_type = it.question_type || '';
      r.question_text = it.question_text || '';
      r.explanation = it.explanation || '';
      r.explain_key = it.explain_key || '';
      r.user_answer = it.user_answer || '';
      r.userText = it.userText || '';
      r.saved = !!it.saved;
      r.fu = (it.fu || []).map((m) => ({ ...m, html: m.role === 'ai' ? md(m.content) : '' }));
      this.applyExplain(r, r.explanation);
      return r;
    });
  },

  onLoadSession(e: WechatMiniprogram.BaseEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const i = this.data.sessions.findIndex((s) => s.id === id);
    if (i >= 0) this.loadSessionAt(i);
  },

  loadSessionAt(i: number) {
    const s = this.data.sessions[i];
    if (!s) return;
    this.archiveCurrent();
    wx.setStorageSync('askCurSid', s.id);
    this.setData({ curSid: s.id, historyOpen: false });
    this.results = this.adoptItems(s.items);
    this.setSessions(this.data.sessions);
    this.syncConvo(true);
    this.persistSession();
  },

  onDelSession(e: WechatMiniprogram.BaseEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const sessions = this.data.sessions.filter((s) => s.id !== id);
    wx.setStorageSync('askSessions', sessions);
    this.setSessions(sessions);
    if (id) {
      wx.setStorageSync('askDelTombs', addTombstone(wx.getStorageSync('askDelTombs'), id));
      this.dropRemoteSession(id);
    }
  },

  onShareAppMessage() {
    trackEvent('ask_share', 'ask');
    return { title: '拍一道题，AI 用花生十三方法讲给你听', path: '/pkgSocial/ask/ask' };
  },
});
