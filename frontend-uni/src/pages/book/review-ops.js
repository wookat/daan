// 错题本复习会话域：组卷/快照/作答/判定/同类题/强化（book.vue 抽离；this 仍指组件实例）

import { md } from '../../md.js';
import { request, anonUid, trackEvent } from '../../api.js';
import { fontSizes } from '../../font-size.js';
import { askPrefill } from '../../ask-prefill.js';
import { askQid, findAskSid } from '../../ask-link.js';
import { similarItemFromQuestion, mistakeRecFromExtra, reviewReasonMid, reviewAskAnswer, similarSubmodule, hasSimilarPool } from '../../review-similar.js';
import { buildReviewSnap, parseReviewSnap, reviewElapsedSecs } from '../../review-snap.js';
import { nextReviewText, reviewSummary, similarRoom, reviewDueLeft } from '../../review-summary.js';
import { reviewOptions, reviewOptionsFull, extractLetter } from '../../review-opts.js';

export const reviewComputed = {

    qStyle() { return { fontSize: fontSizes(this.fontLv).q }; },

    askableReview() {
      return !!askPrefill(this.cur && this.cur.question_text, this.cur && this.cur.options);
    },

    similarableReview() {
      return hasSimilarPool(this.cur);
    },

    curOpts() {
      return reviewOptions(this.cur);
    },

    curOptFull() {
      return reviewOptionsFull(this.curOpts);
    },

    reviewAskSeen() {
      void this.askSeenTick;
      return findAskSid(uni.getStorageSync('askSessions'), uni.getStorageSync('askCurSession'), this.cur && this.cur.question_id);
    },

    optStyle() { return { fontSize: fontSizes(this.fontLv).opt }; },

    cur() {
      return this.rItems[this.rIdx] || {};
    },

    curLetter() {
      return extractLetter(this.cur.correct_answer);
    },

    curMulti() {
      return !!this.curLetter && this.curLetter.length > 1;
    },

    curHtml() {
      return md(this.cur.explanation || '');
    },
};

export const reviewOps = {

    startReview() {
      this.rItems = [...this.due];
      this.rIdx = 0;
      this.resetQ();
      this.reviewing = true;
      this.resumeInfo = null;
      this.saveReviewSnap();
    },

    saveReviewSnap() {
      const snap = buildReviewSnap(this, anonUid(), Date.now() / 1000);
      if (!snap) return;
      uni.setStorageSync('reviewSnap', snap);
      if (this._snapPostTimer) clearTimeout(this._snapPostTimer);
      this._snapPostTimer = setTimeout(() => {
        this._snapPostTimer = null;
        request('/api/review/cur', { method: 'POST', data: { uid: anonUid(), snap } }).catch(() => {});
      }, 1500);
    },

    clearReviewSnap() {
      uni.removeStorageSync('reviewSnap');
      this.resumeInfo = null;
      if (this._snapPostTimer) {
        clearTimeout(this._snapPostTimer);
        this._snapPostTimer = null;
      }
      request('/api/review/cur', { method: 'POST', data: { uid: anonUid(), snap: null } }).catch(() => {});
    },

    restoreRemoteSnap() {
      const uid = anonUid();
      const wantResume = this._reviewIntent;
      this._reviewIntent = false;
      request('/api/review/cur?uid=' + encodeURIComponent(uid))
        .then((r) => {
          if (this.reviewing || this.resumeInfo) return;
          if (parseReviewSnap(uni.getStorageSync('reviewSnap'), uid, Date.now() / 1000)) return;
          this.resumeInfo = parseReviewSnap(r && r.snap, uid, Date.now() / 1000);
          if (this.resumeInfo && wantResume) this.resumeReview();
        })
        .catch(() => {});
    },

    resumeReview() {
      const r = this.resumeInfo;
      if (!r) return;
      trackEvent('review_resume_click', 'book');
      this.rItems = r.items.map((x) => ({ ...x }));
      this.rIdx = r.rIdx;
      this.picked = r.picked;
      this.answered = r.answered;
      this.wasCorrect = r.wasCorrect;
      this.nextDays = r.nextDays;
      this.streak = Number(this.rItems[this.rIdx]?._streak) || 0;
      this._qStart = Date.now();
      this.reviewing = true;
      this.resumeInfo = null;
    },

    discardResume() {
      this.clearReviewSnap();
    },

    resetQ() {
      this.picked = null;
      this.answered = false;
      this.wasCorrect = false;
      this.nextDays = 0;
      this._qStart = Date.now();
    },

    reviewSecs() {
      return reviewElapsedSecs(this._qStart, Date.now());
    },

    async pick(o) {
      if (this.answered) return;
      if (this.curMulti) {
        const set = new Set((this.picked || '').split(''));
        if (set.has(o)) set.delete(o);
        else set.add(o);
        this.picked = [...set].sort().join('');
        return;
      }
      this.picked = o;
      await this.record(o === this.curLetter);
      this.saveReviewSnap();
    },

    async confirmMulti() {
      if (this.answered || !this.picked) return;
      await this.record(this.picked === this.curLetter);
      this.saveReviewSnap();
    },

    async selfJudge(correct) {
      await this.record(correct);
      this.saveReviewSnap();
    },

    async record(correct) {
      this.wasCorrect = correct;
      this.answered = true;
      this.cur._res = correct;
      if (this.cur._extra) {
        if (!correct) this.saveExtraWrong(this.cur);
        return;
      }
      if (!correct && !this.cur._requeued) {
        const { _res, ...rest } = this.cur;
        void _res;
        this.rItems.push({ ...rest, _requeued: true });
      }
      if (!correct) this.appendSimilar(this.cur);
      try {
        const res = await request('/api/review/' + this.cur.id, {
          method: 'POST',
          data: { correct, uid: anonUid(), picked: this.picked || undefined, secs: this.reviewSecs() },
        });
        this.nextDays = res.next_review_days;
        this.streak = res.streak;
        this.cur._nextDays = res.next_review_days;
        this.cur._streak = res.streak;
        this.cur._mastered = res.mastered === true;
      } catch (e) {
        uni.showToast({ title: '记录失败：' + e.message, icon: 'none' });
      }
    },

    async appendSimilar(m) {
      // 答错自动加推：本轮末尾追加最多 2 道同类新题（不写 SRS，不影响复习记录）
      if (m._simFetched || m._requeued || !hasSimilarPool(m)) return;
      const room = similarRoom(this.rItems);
      if (!room) return;
      m._simFetched = true;
      const sub = similarSubmodule(m);
      try {
        let q = '/api/questions?limit=' + room + '&uid=' + encodeURIComponent(anonUid()) + '&module=' + encodeURIComponent(m.module);
        if (sub) q += '&submodule=' + encodeURIComponent(sub);
        const d = await request(q);
        const add = (d.items || [])
          .filter((x) => x.id !== m.question_id)
          .slice(0, room)
          .map(similarItemFromQuestion)
          .filter(Boolean);
        if (add.length) {
          this.rItems.push(...add);
          m._appended = add.length;
          this.$forceUpdate();
          this.saveReviewSnap();
          trackEvent('review_similar_auto', m.module || '');
        }
      } catch (e) { /* 非关键路径 */ }
    },

    async setReviewReason(rz) {
      const m = this.cur;
      const mid = reviewReasonMid(m);
      if (!mid) return;
      m.error_reason = rz;
      this.$forceUpdate();
      try {
        await request('/api/mistakes/' + mid, { method: 'PATCH', data: { uid: anonUid(), error_reason: rz } });
        this.saveReviewSnap();
        trackEvent('review_reason_tag', rz || '未标注');
      } catch (e) { /* 非关键路径 */ }
    },

    async saveExtraWrong(item) {
      if (item._saved) return;
      const rec = mistakeRecFromExtra(item, this.picked, anonUid());
      if (!rec) return;
      try {
        const res = await request('/api/mistakes', { method: 'POST', data: rec });
        const mid = reviewReasonMid({ id: res && res.id });
        if (!mid) return;
        item._mid = mid;
        item._saved = true;
        this.$forceUpdate();
        this.saveReviewSnap();
      } catch (e) { /* 非关键路径 */ }
    },

    similarFromReview() {
      trackEvent('review_similar_click', this.cur.module || '');
      this.practiceSimilar(this.cur);
    },

    openSeenAsk() {
      if (!this.reviewAskSeen) return;
      if (this.reviewAskSeen.sid > 0) uni.setStorageSync('askOpenSid', this.reviewAskSeen.sid);
      uni.switchTab({ url: '/pages/ask/ask' });
    },

    askFromReview() {
      const text = askPrefill(this.cur.question_text, this.cur.options);
      if (!text) return;
      trackEvent('review_ask_click', this.cur.module || '');
      uni.setStorageSync('redoQuestion', text);
      const qid = askQid(this.cur.question_id);
      if (qid) uni.setStorageSync('redoQid', qid);
      else uni.removeStorageSync('redoQid');
      const ans = reviewAskAnswer(this.cur, this.picked);
      if (ans) uni.setStorageSync('redoAnswer', ans);
      else uni.removeStorageSync('redoAnswer');
      uni.switchTab({ url: '/pages/ask/ask' });
    },

    nextReview() {
      if (this.rIdx + 1 < this.rItems.length) {
        this.rIdx++;
        this.resetQ();
        this.saveReviewSnap();
      } else {
        this.celebrateN = this.rItems.filter((q) => !q._extra && !q._requeued).length;
        this.dueLeft = reviewDueLeft(this.dueTotal, this.celebrateN);
        this.rSummary = reviewSummary(this.rItems);
        this.nextText = nextReviewText(this.rItems);
        this.reinforce = null;
        this.reinforceItems = [];
        this.exitReview();
        this.celebrate = true;
        trackEvent('review_done_celebrate', 'book');
        this.fetchReinforce();
      }
    },

    closeCelebrate() {
      this.celebrate = false;
      this.reinforce = null;
    },

    async continueReview() {
      trackEvent('review_entry_click', 'next_batch');
      this.closeCelebrate();
      await this.load();
      if (this.due.length) this.startReview();
      else uni.showToast({ title: '到期错题已复习完', icon: 'none' });
    },

    async fetchReinforce() {
      try {
        const d = await request('/api/reinforce/suggest?uid=' + encodeURIComponent(anonUid()));
        if (!this.celebrate) return;
        this.reinforceItems = d.items || [];
        this.reinforce = d.picked || null;
      } catch (e) { /* 非关键路径 */ }
    },

    swapReinforce() {
      const i = this.reinforceItems.findIndex((x) => x.skill === this.reinforce.skill);
      this.reinforce = this.reinforceItems[(i + 1) % this.reinforceItems.length];
    },

    startReinforce(item) {
      this.reinforce = null;
      this.celebrate = false;
      uni.setStorageSync('practiceLaunch', {
        kind: 'reinforce',
        module: item.module,
        submodule: item.submodule,
        tag3: item.tag3 || null,
        count: 5,
        mastery: item.mastery,
      });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },

    exitReview() {
      this.reviewing = false;
      this.clearReviewSnap();
      this.load();
      uni.pageScrollTo({ scrollTop: 0, duration: 0 });
    },

    optClass(o) {
      if (!this.answered) return this.curMulti && (this.picked || '').includes(o) ? 'sel' : '';
      if ((this.curLetter || '').includes(o)) return 'ok';
      if ((this.picked || '').includes(o)) return 'bad';
      return 'dim';
    },
};
