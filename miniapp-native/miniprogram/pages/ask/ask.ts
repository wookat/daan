import {
  fetchAccessInfo,
  postFollowup,
  rateExplain,
  streamExplain,
} from '../../api/p3';
import type { AnsCard } from '../../utils/text';
import { postMistake } from '../../api/index';
import { getAccessCode } from '../../utils/auth';
import { promptAccessCode } from '../../utils/request';
import { fmtClock, mdToPlain, splitAnswer, stripStop } from '../../utils/text';

interface FuMsg {
  role: 'user' | 'ai';
  content: string;
  plain?: string;
}

interface AskItem {
  ts: number;
  module: string;
  module_name: string;
  question_type: string;
  question_text: string;
  explanation: string;
  explain_key: string;
  user_answer: string;
  userImage: string;
  userText: string;
  ansCard: AnsCard | null;
  plain: string;
  streaming: boolean;
  saved: boolean;
  rated: '' | 'up' | 'down';
  fu: FuMsg[];
  fuLoading: boolean;
}

interface RecentItem {
  ts: number;
  module_name: string;
  question_type: string;
  ans: string;
  brief: string;
  timeText?: string;
}

interface AskSession {
  id: number;
  ts: number;
  title: string;
  n: number;
  items: AskItem[];
  timeText?: string;
}

function loadRecent(): RecentItem[] {
  const r = wx.getStorageSync<RecentItem[]>('recentExplains');
  return Array.isArray(r) ? r : [];
}

function loadSessions(): AskSession[] {
  const s = wx.getStorageSync<AskSession[]>('askSessions');
  return Array.isArray(s) ? s : [];
}

Page({
  data: {
    results: [] as AskItem[],
    recent: [] as RecentItem[],
    sessions: [] as AskSession[],
    loading: false,
    loadingText: '',
    stagedImage: '',
    stagedText: '',
    error: '',
    // 弹层
    textOpen: false,
    historyOpen: false,
    imagePath: '',
    qtext: '',
    uanswer: '',
    fuText: '',
    scrollInto: '',
  },
  _timer: 0 as number | ReturnType<typeof setInterval>,

  onLoad() {
    this.setData({
      recent: loadRecent().map((r) => ({ ...r, timeText: fmtClock(r.ts) })),
      sessions: loadSessions().map((s) => ({ ...s, timeText: fmtClock(s.ts) })),
    });
    this.restoreSession();
  },
  onUnload() {
    this.stopTimer();
  },

  restoreSession() {
    const items = wx.getStorageSync<AskItem[]>('askCurSession');
    if (!Array.isArray(items) || !items.length) return;
    const results = items.map((r) => this.rebuild(r));
    this.setData({ results });
  },
  rebuild(r: AskItem): AskItem {
    const full = stripStop(r.explanation || '');
    const { card, rest } = splitAnswer(full);
    return {
      ...r,
      ansCard: card,
      plain: mdToPlain(card ? rest : full),
      streaming: false,
      fuLoading: false,
      userImage: '',
      fu: (r.fu || []).map((m) => ({ ...m, plain: m.role === 'ai' ? mdToPlain(m.content) : '' })),
    };
  },

  // ---------- 访问码（内测） ----------
  async ensureAccess(): Promise<boolean> {
    if (getAccessCode()) return true;
    const info = await fetchAccessInfo();
    if (!info || !info.required) return true;
    const ok = await promptAccessCode();
    if (!ok) wx.showToast({ title: '已取消，输入的内容已保留', icon: 'none' });
    return ok;
  },

  // ---------- 输入 ----------
  onPickImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        this.setData({ imagePath: res.tempFiles[0].tempFilePath });
      },
    });
  },
  onClearImage() {
    this.setData({ imagePath: '' });
  },
  onOpenText() {
    this.setData({ textOpen: true });
  },
  onCloseText() {
    this.setData({ textOpen: false });
  },
  onQtextInput(e: WechatMiniprogram.Input) {
    this.setData({ qtext: e.detail.value });
  },
  onPickAns(e: WechatMiniprogram.TouchEvent) {
    const o = String(e.currentTarget.dataset.o);
    this.setData({ uanswer: this.data.uanswer === o ? '' : o });
  },
  async onSubmitText() {
    const txt = this.data.qtext.trim();
    if (!txt) {
      wx.showToast({ title: '请粘贴题目文字', icon: 'none' });
      return;
    }
    if (!(await this.ensureAccess())) return;
    this.setData({ textOpen: false });
    this.doExplain('', txt);
  },
  async onSubmitImage() {
    if (!(await this.ensureAccess())) return;
    const img = this.data.imagePath;
    this.setData({ imagePath: '' });
    this.doExplain(img, '');
  },

  startTimer() {
    let secs = 0;
    this.setData({ loadingText: '⏳ AI 识题中…（0秒）' });
    this._timer = setInterval(() => {
      secs++;
      const t =
        secs < 8
          ? `⏳ AI 识题中…（${secs}秒）`
          : secs < 25
            ? `已识题，正在匹配花生十三方法…（${secs}秒）`
            : `正在生成分步讲解，马上好…（${secs}秒）`;
      this.setData({ loadingText: t });
    }, 1000);
  },
  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer as ReturnType<typeof setInterval>);
      this._timer = 0;
    }
  },

  async doExplain(img: string, txt: string) {
    if (!img && !txt) return;
    const uans = this.data.uanswer.trim();
    this.setData({ loading: true, error: '', stagedImage: img, stagedText: txt });
    this.startTimer();
    const rec: AskItem = {
      ts: Date.now(),
      module: '',
      module_name: '',
      question_type: '',
      question_text: '',
      explanation: '',
      explain_key: '',
      user_answer: uans,
      userImage: img,
      userText: txt,
      ansCard: null,
      plain: '',
      streaming: true,
      saved: false,
      rated: '',
      fu: [],
      fuLoading: false,
    };
    let inserted = false;
    const applyDelta = (full: string) => {
      const clean = stripStop(full);
      const { card, rest } = splitAnswer(clean);
      const idx = this.data.results.length - 1;
      this.setData({
        [`results[${idx}].ansCard`]: card,
        [`results[${idx}].plain`]: mdToPlain(card ? rest : clean),
      });
    };
    try {
      const d = await streamExplain({
        filePath: img || null,
        text: txt || null,
        userAnswer: uans || null,
        onMeta: (m) => {
          Object.assign(rec, m);
          inserted = true;
          this.stopTimer();
          this.setData({
            loading: false,
            results: [...this.data.results, rec],
            scrollInto: 'msg-' + rec.ts,
          });
        },
        onDelta: (full) => {
          if (inserted) applyDelta(full);
        },
      });
      if (!inserted) {
        this.setData({ results: [...this.data.results, rec] });
      }
      const idx = this.data.results.length - 1;
      const merged = { ...this.data.results[idx], ...d, streaming: false } as AskItem;
      const done = this.rebuild(merged);
      this.setData({ [`results[${idx}]`]: done, uanswer: '', qtext: '', scrollInto: 'msg-' + done.ts });
      this.saveRecent(done);
      this.persistSession();
    } catch (e) {
      this.setData({ error: (e as Error).message });
    }
    this.stopTimer();
    this.setData({ loading: false });
  },

  saveRecent(r: AskItem) {
    const recent = loadRecent();
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
    this.setData({ recent: next.map((x) => ({ ...x, timeText: fmtClock(x.ts) })) });
  },

  // ---------- 追问 ----------
  onFuInput(e: WechatMiniprogram.Input) {
    this.setData({ fuText: e.detail.value });
  },
  onSendFollowup() {
    const q = this.data.fuText.trim();
    if (!q || !this.data.results.length) return;
    this.setData({ fuText: '' });
    this.followup(this.data.results.length - 1, q);
  },
  onChipDetail(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    this.followup(idx, '请再讲得更细一点，逐步推导每一步');
  },
  async followup(idx: number, q: string) {
    const r = this.data.results[idx];
    if (!r || r.fuLoading || r.streaming) return;
    const fu = [...r.fu, { role: 'user', content: q } as FuMsg];
    this.setData({
      [`results[${idx}].fu`]: fu,
      [`results[${idx}].fuLoading`]: true,
      scrollInto: 'msg-' + r.ts,
    });
    try {
      const d = await postFollowup({
        question_text: r.question_text,
        explanation: r.explanation,
        history: fu.slice(0, -1).map((m) => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.content,
        })),
        query: q,
      });
      const ans = stripStop(d.answer);
      this.setData({
        [`results[${idx}].fu`]: [...fu, { role: 'ai', content: ans, plain: mdToPlain(ans) }],
        [`results[${idx}].fuLoading`]: false,
      });
      this.persistSession();
    } catch (e) {
      wx.showToast({ title: '追问失败：' + (e as Error).message, icon: 'none' });
      this.setData({ [`results[${idx}].fuLoading`]: false });
    }
  },

  // ---------- 反馈 / 存错题本 ----------
  async onRate(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    const up = e.currentTarget.dataset.up === '1';
    const r = this.data.results[idx];
    if (!r || r.rated) return;
    this.setData({ [`results[${idx}].rated`]: up ? 'up' : 'down' });
    try {
      await rateExplain(r.explain_key, up);
    } catch (err) {
      /* 静默失败 */
    }
    wx.showToast({ title: up ? '感谢反馈' : '已记录，我们会核查这条解析', icon: 'none' });
  },
  async onSave(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    const r = this.data.results[idx];
    if (!r || r.saved) return;
    try {
      await postMistake({
        question_id: null,
        module: r.module || '',
        question_type: r.question_type || null,
        question_text: r.question_text,
        user_answer: r.user_answer,
        correct_answer: (r.ansCard && r.ansCard.ans) || '',
        explanation: r.explanation,
      });
      this.setData({ [`results[${idx}].saved`]: true });
      this.persistSession();
      wx.showToast({ title: '已存入错题本', icon: 'none' });
    } catch (err) {
      wx.showToast({ title: '保存失败：' + (err as Error).message, icon: 'none' });
    }
  },

  // ---------- 历史会话（本机保存，与 frontend-uni storage key 一致） ----------
  persistSession() {
    const items = this.data.results.map((r) => ({
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
    wx.setStorageSync('askCurSession', items);
  },
  onNewSession() {
    this.archiveCurrent();
    this.setData({ results: [], error: '' });
    wx.removeStorageSync('askCurSession');
  },
  archiveCurrent() {
    if (!this.data.results.length) return;
    const first = this.data.results[0];
    const title = (
      (first.ansCard && first.ansCard.brief) ||
      first.userText ||
      first.question_text ||
      '问答会话'
    ).slice(0, 30);
    const items = wx.getStorageSync<AskItem[]>('askCurSession') || [];
    if (!items.length) return;
    const sessions = [
      { id: Date.now(), ts: Date.now(), title, n: items.length, items },
      ...loadSessions(),
    ].slice(0, 20);
    wx.setStorageSync('askSessions', sessions);
    this.setData({ sessions: sessions.map((s) => ({ ...s, timeText: fmtClock(s.ts) })) });
  },
  onOpenHistory() {
    this.setData({ historyOpen: true });
  },
  onCloseHistory() {
    this.setData({ historyOpen: false });
  },
  onLoadSession(e: WechatMiniprogram.TouchEvent) {
    const i = Number(e.currentTarget.dataset.index);
    const sessions = loadSessions();
    const s = sessions[i];
    if (!s) return;
    this.archiveCurrent();
    const rest = loadSessions().filter((x) => x.id !== s.id);
    wx.setStorageSync('askSessions', rest);
    const results = (s.items || []).map((r) => this.rebuild(r));
    this.setData({
      sessions: rest.map((x) => ({ ...x, timeText: fmtClock(x.ts) })),
      results,
      historyOpen: false,
    });
    this.persistSession();
  },
  onDelSession(e: WechatMiniprogram.TouchEvent) {
    const i = Number(e.currentTarget.dataset.index);
    const sessions = loadSessions();
    sessions.splice(i, 1);
    wx.setStorageSync('askSessions', sessions);
    this.setData({ sessions: sessions.map((x) => ({ ...x, timeText: fmtClock(x.ts) })) });
  },

  onGoInterview() {
    wx.navigateTo({ url: '/pages/interview/interview' });
  },
  noop() {
    /* 阻止冒泡 */
  },
});
