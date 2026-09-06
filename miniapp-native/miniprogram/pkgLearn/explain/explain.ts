// AI 讲解（对齐 H5 pages/ask/ask.vue 文本讲解链路）：
// /api/explain/stream（enableChunked 分块，不支持时降级 /api/explain）→ 答案卡 + Markdown 讲解 → 评分 /api/rate(key)
// → 追问 /api/followup → 举一反三 /api/similar → 存入错题本 /api/mistakes → 查看原题（搜索深链）
import {
  type ExplainMeta,
  type ExplainResp,
  explainText,
  type FollowupMsg,
  followup,
  rateExplainKey,
  similarQuestion,
  streamExplain,
} from '../../api/learn';
import { postMistake, trackEvent } from '../../api/index';
import { EXPLAIN_HANDOFF_KEY, type ExplainHandoff } from '../../utils/ask-prefill';
import { type AnsCard, md, splitAnswer, stripStop } from '../../utils/md';

interface FuVM {
  role: 'user' | 'ai';
  content: string;
  html: string;
}
interface SimVM {
  raw: string;
  rawAns: string;
  qHtml: string;
  ansHtml: string;
  correct: string | null;
  picked: string;
  saved: boolean;
  optCls: Record<string, string>;
}
interface ResultVM {
  qid: number;
  module: string;
  module_name: string;
  question_type: string;
  question_text: string;
  explanation: string;
  explain_key: string;
  user_answer: string;
  userText: string;
  ansCard: AnsCard | null;
  html: string;
  rated: '' | 'up' | 'down';
  saved: boolean;
  streaming: boolean;
  fu: FuVM[];
  fuLoading: boolean;
  sim: SimVM | null;
  simLoading: boolean;
  simSecs: number;
}

const SIM_OPTS = ['A', 'B', 'C', 'D'];

function emptyResult(txt: string, uans: string, qid: number): ResultVM {
  return {
    qid,
    module: '',
    module_name: '',
    question_type: '',
    question_text: txt,
    explanation: '',
    explain_key: '',
    user_answer: uans,
    userText: txt,
    ansCard: null,
    html: '',
    rated: '',
    saved: false,
    streaming: true,
    fu: [],
    fuLoading: false,
    sim: null,
    simLoading: false,
    simSecs: 0,
  };
}

// 与 H5 applyExplain 同规则：首行仅「【答案】」且无换行时先不渲染，等到完整段落再出答案卡
function applyExplain(r: ResultVM, raw: string): void {
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
}

function simOptCls(sim: SimVM): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of SIM_OPTS) {
    if (!sim.picked) out[o] = '';
    else if (sim.correct && o === sim.correct) out[o] = 'ok';
    else if (o === sim.picked && sim.correct && o !== sim.correct) out[o] = 'bad';
    else out[o] = 'dim';
  }
  return out;
}

function simStem(sim: SimVM): string {
  return (sim.raw || '')
    .replace(/^##\s*练习题\s*/, '')
    .replace(/##\s*提示[\s\S]*$/, '')
    .trim();
}

Page({
  data: {
    r: null as ResultVM | null,
    loading: false,
    secs: 0,
    error: '',
    fuText: '',
    simOpts: SIM_OPTS,
    /** 输入面板（无 handoff 时手动粘贴题目） */
    qtext: '',
    uanswer: '',
  },
  _timer: 0 as ReturnType<typeof setInterval> | 0,
  _pending: null as ExplainHandoff | null,

  onLoad() {
    const h = wx.getStorageSync<ExplainHandoff | ''>(EXPLAIN_HANDOFF_KEY);
    if (h && h.text) {
      wx.removeStorageSync(EXPLAIN_HANDOFF_KEY);
      this._pending = h;
      this.setData({ qtext: h.text, uanswer: h.answer || '' });
      this.doExplain(h.text, h.answer || '', h.qid || 0);
    }
  },
  onUnload() {
    this.stopTimer();
  },

  startTimer() {
    this.stopTimer();
    this.setData({ secs: 0 });
    this._timer = setInterval(() => this.setData({ secs: this.data.secs + 1 }), 1000);
  },
  stopTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = 0;
  },

  onQtext(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ qtext: e.detail.value });
  },
  onUanswer(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ uanswer: String(e.detail.value || '').toUpperCase().slice(0, 1) });
  },
  onSubmitText() {
    const txt = this.data.qtext.trim();
    if (!txt) {
      wx.showToast({ title: '请粘贴题目文字', icon: 'none' });
      return;
    }
    this.doExplain(txt, this.data.uanswer.trim(), 0);
  },
  onRetry() {
    const r = this.data.r;
    const txt = (r && r.userText) || this.data.qtext.trim();
    if (txt) this.doExplain(txt, this.data.uanswer.trim(), r ? r.qid : 0);
  },

  async doExplain(txt: string, uans: string, qid: number) {
    if (!txt || this.data.loading) return;
    this.setData({ loading: true, error: '', r: null });
    this.startTimer();
    const rec = emptyResult(txt, uans, qid);
    let shown = false;
    const show = () => {
      if (!shown) {
        shown = true;
        this.stopTimer();
        this.setData({ loading: false });
      }
      this.setData({ r: rec });
    };
    try {
      let d: ExplainResp;
      try {
        d = await streamExplain({
          text: txt,
          userAnswer: uans || null,
          onMeta: (m: ExplainMeta) => {
            Object.assign(rec, {
              module: m.module || '',
              module_name: m.module_name || '',
              question_type: m.question_type || '',
              question_text: m.question_text || txt,
              explain_key: m.explain_key || '',
            });
            show();
          },
          onDelta: (full) => {
            applyExplain(rec, full);
            show();
          },
        });
      } catch (e) {
        // 访问码/鉴权类失败走 request() 的访问码弹窗流程（非流式）
        if (/HTTP 40[13]/.test((e as Error).message)) d = await explainText(txt, uans || null);
        else throw e;
      }
      Object.assign(rec, {
        module: d.module || '',
        module_name: d.module_name || '',
        question_type: d.question_type || '',
        question_text: d.question_text || txt,
        explanation: stripStop(d.explanation),
        explain_key: d.explain_key || '',
        streaming: false,
      });
      applyExplain(rec, d.explanation);
      show();
    } catch (e) {
      this.stopTimer();
      this.setData({ loading: false, error: (e as Error).message || '生成失败' });
    }
  },

  // ---------- 评分 ----------
  onRateUp() {
    this.rate(true);
  },
  onRateDown() {
    this.rate(false);
  },
  async rate(up: boolean) {
    const r = this.data.r;
    if (!r || !r.explain_key || r.rated) return;
    this.setData({ 'r.rated': up ? 'up' : 'down' });
    try {
      await rateExplainKey(r.explain_key, up);
    } catch {
      /* 静默失败 */
    }
    wx.showToast({ title: up ? '感谢反馈' : '已记录，我们会核查这条解析', icon: 'none' });
  },

  // ---------- 追问 ----------
  onFuText(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ fuText: e.detail.value });
  },
  onSendFollowup() {
    const q = this.data.fuText.trim();
    if (!q) return;
    this.setData({ fuText: '' });
    this.quickFollowup(q);
  },
  onFollowupDetail() {
    this.quickFollowup('请再讲得更细一点，逐步推导每一步');
  },
  async quickFollowup(q: string) {
    const r = this.data.r;
    if (!r || r.fuLoading || r.streaming) return;
    const fu = r.fu.concat([{ role: 'user', content: q, html: '' }]);
    this.setData({ 'r.fu': fu, 'r.fuLoading': true });
    try {
      const history: FollowupMsg[] = fu
        .slice(0, -1)
        .map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));
      const d = await followup(r.question_text, r.explanation, history, q);
      const ans = stripStop(d.answer);
      this.setData({ 'r.fu': fu.concat([{ role: 'ai', content: ans, html: md(ans) }]) });
    } catch (e) {
      wx.showToast({ title: '追问失败：' + ((e as Error).message || ''), icon: 'none' });
    }
    this.setData({ 'r.fuLoading': false });
  },

  // ---------- 举一反三 ----------
  async onGenSimilar() {
    const r = this.data.r;
    if (!r || r.simLoading) return;
    this.setData({ 'r.simLoading': true, 'r.simSecs': 0 });
    const t = setInterval(() => this.setData({ 'r.simSecs': (this.data.r ? this.data.r.simSecs : 0) + 1 }), 1000);
    try {
      const d = await similarQuestion(r.question_text, r.question_type || null);
      const parts = String(d.content || '').split('<!--answer-->');
      const m = (parts[1] || '').match(/答案[：:\s*]*([A-D])/);
      const sim: SimVM = {
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
      this.setData({ 'r.sim': sim });
    } catch (e) {
      wx.showToast({ title: '出题失败：' + ((e as Error).message || ''), icon: 'none' });
    }
    clearInterval(t);
    this.setData({ 'r.simLoading': false });
  },
  onPickSim(e: WechatMiniprogram.TouchEvent) {
    const r = this.data.r;
    if (!r || !r.sim || r.sim.picked) return;
    const o = String((e.currentTarget.dataset as { o: string }).o || '');
    if (!SIM_OPTS.includes(o)) return;
    const sim = { ...r.sim, picked: o };
    sim.optCls = simOptCls(sim);
    this.setData({ 'r.sim': sim });
  },
  onExplainSim() {
    const r = this.data.r;
    if (!r || !r.sim) return;
    const txt = simStem(r.sim);
    this.setData({ uanswer: r.sim.picked || '', qtext: txt });
    this.doExplain(txt, r.sim.picked || '', 0);
  },
  async onSaveSim() {
    const r = this.data.r;
    if (!r || !r.sim || r.sim.saved) return;
    try {
      await postMistake({
        question_id: null,
        module: r.module,
        question_type: r.question_type || null,
        question_text: simStem(r.sim),
        user_answer: r.sim.picked,
        correct_answer: r.sim.correct || '',
        explanation: ((r.sim.raw || '') + '\n' + (r.sim.rawAns || '')).trim(),
      });
      this.setData({ 'r.sim.saved': true });
      wx.showToast({ title: '已存入错题本', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '保存失败：' + ((e as Error).message || ''), icon: 'none' });
    }
  },

  // ---------- 存入错题本 / 查看原题 ----------
  async onSave() {
    const r = this.data.r;
    if (!r || r.saved) return;
    try {
      await postMistake({
        question_id: r.qid || null,
        module: r.module,
        question_type: r.question_type || null,
        question_text: r.question_text,
        user_answer: r.user_answer,
        correct_answer: (r.ansCard && r.ansCard.ans) || '',
        explanation: r.explanation,
      });
      this.setData({ 'r.saved': true });
    } catch (e) {
      wx.showToast({ title: '保存失败：' + ((e as Error).message || ''), icon: 'none' });
    }
  },
  onViewQuestion() {
    const r = this.data.r;
    if (!r || !r.qid) return;
    trackEvent('ask_view_question');
    wx.navigateTo({ url: '/pkgLearn/search/search?q=' + r.qid + '&qid=' + r.qid });
  },
});
