// 练习会话：预取/持久化/服务器续练/本地恢复与续练弹窗（practice.vue 抽离，方法 this 仍指组件实例）

import { request, anonUid, trackEvent } from '../api.js';
import { collectPracticeProgress, adoptPracticeResume, pendingTitle, redoItemsFromPending, dailyFromPending, resumeIndex, REDO_PENDING_TITLE } from '../practice-progress.js';
import { reviewedFromPending } from '../review-advance.js';
import { resumeAsk } from '../resume-ask.js';

export const sessionOps = {
    retryStart() {
      if (this._lastStartArgs) this.start(...this._lastStartArgs);
      else this.start(uni.getStorageSync('lastModule') || null);
    },
    // 练习中场静默预取下一组，「再来一组」命中 prefetchPack 零等待,

    prefetchNextGroup() {
      if (!this._plainStart || this._prefetched || this.beiMode || this._daily || this._shizheng) return;
      this._prefetched = true;
      const module = this.lastModule || '';
      const limit = this.groupSize || 10;
      const uid = uni.getStorageSync('anonUid') || '';
      const pk = uni.getStorageSync('prefetchPack');
      if (pk && pk.module === module && pk.limit === limit && pk.uid === uid && Date.now() - pk.ts < 5 * 60 * 1000) return;
      const seenIds = this.items.map((q) => q.id).filter((id) => Number.isInteger(id));
      const seen = new Set(seenIds);
      // 当组未答完的到期题尚无 answer_log，服务端要靠 exclude 才不会再次混入下一组
      request(
        '/api/questions?limit=' + limit +
          (uid ? '&uid=' + encodeURIComponent(uid) + '&mix_due=1&exclude=' + seenIds.join(',') : '') +
          (module ? '&module=' + module : ''),
        { timeout: 45000 }
      )
        .then((d) => {
          const items = ((d && d.items) || []).filter((q) => !seen.has(q.id));
          // 不足一组不缓存（否则「再来一组」只出 N-1 题），交给启动时实时拉取
          if (items.length >= limit) uni.setStorageSync('prefetchPack', { module, limit, uid, items, ts: Date.now() });
        })
        .catch(() => {});
    },

    takePrefetch(module, limit, uid, submodule, adaptive, forceReal, tag3) {
      if (submodule || adaptive || forceReal || tag3 || this.realMode) return null;
      const pk = uni.getStorageSync('prefetchPack');
      if (!pk || !pk.items || !pk.items.length) return null;
      if (pk.module !== (module || '') || pk.limit !== limit || pk.uid !== (uid || '')) return null;
      if (Date.now() - pk.ts > 10 * 60 * 1000) return null;
      uni.removeStorageSync('prefetchPack');
      return pk.items;
    },

    saveSession() {
      if (this.examMode || this.beiMode || this._shizheng || !this.session || !this.items.length) return;
      if (this.items.every((q) => q._picked)) {
        uni.removeStorageSync('pendingSession');
        this.clearServerProgress();
        return;
      }
      uni.setStorageSync('pendingSession', {
        t: Date.now(),
        items: this.items,
        idx: this.idx,
        right: this.right,
        streak: this.streak,
        bestStreak: this.bestStreak,
        lastModule: this.lastModule,
        lastSubmodule: this.lastSubmodule,
        source: this._source || '',
        ptitle: this._ptitle || '',
        redo: this._redoItems && this._redoItems.length && !this.lastModule ? 1 : 0,
        reviewed: this._reviewed || [],
        daily: this._daily && this._dailyDate ? { date: this._dailyDate, past: !!this._dailyPast } : null,
      });
      clearTimeout(this._ppTimer);
      this._ppTimer = setTimeout(() => this.pushPracticeProgress(), 1500);
    },

    pushPracticeProgress() {
      const payload = collectPracticeProgress(
        this.items, this.idx, this.right, this.streak, this.bestStreak,
        this.lastModule || '', this.lastSubmodule || '',
        this._source || '', this._ptitle || '',
        this._daily && this._dailyDate ? { date: this._dailyDate, past: !!this._dailyPast } : null
      );
      if (!payload) return;
      request('/api/practice/progress', { method: 'POST', data: { uid: anonUid(), ...payload } }).catch(() => {});
    },

    clearServerProgress() {
      clearTimeout(this._ppTimer);
      uni.setStorageSync('ppClearedAt', Date.now());
      request('/api/practice/progress', { method: 'POST', data: { uid: anonUid(), qids: [] } }).catch(() => {});
    },

    adoptLocalPending(s) {
      s.items.forEach((q) => { if (q._picked) q._logged = true; });
      this.items = s.items;
      this.idx = resumeIndex(s.items, s.idx);
      this.picked = this.items[this.idx]._picked || '';
      this.right = s.right;
      this.streak = s.streak;
      this.bestStreak = s.bestStreak;
      this.lastModule = s.lastModule;
      this.lastSubmodule = s.lastSubmodule;
      this._source = (typeof s.source === 'string' && s.source) || null;
      this._ptitle = (typeof s.ptitle === 'string' && s.ptitle) || null;
      this._reinforce = null;
      this._redoItems = redoItemsFromPending(s);
      this._reviewed = reviewedFromPending(s);
      const daily = dailyFromPending(s, Date.now());
      this._daily = !!daily;
      this._dailyDate = daily ? daily.date : '';
      this._dailyPast = daily ? daily.past : false;
      this.autoSaved = false;
      this.resultSent = false;
      this.percentile = null;
      this.session = true;
      this.startQTimer();
      this.relinkWrongMids();
      if (this._redoItems) uni.showToast({ title: '继续' + REDO_PENDING_TITLE, icon: 'none' });
      else if (daily) uni.showToast({ title: '继续' + (daily.past ? '往期每日一练' : '今日一练') + ' · 第 ' + (this.idx + 1) + '/' + this.items.length + ' 题', icon: 'none' });
    },
    // 恢复的错题若快照缺 _mid（POST 回包前就退出/刷新），按本人错题本回填，错因自评才有 mid 可 PATCH,

    adoptRemoteSnap(snap) {
      this.items = snap.items;
      this.idx = snap.idx;
      this.picked = this.items[this.idx]._picked || '';
      this.right = snap.right;
      this.streak = snap.streak;
      this.bestStreak = snap.bestStreak;
      this.lastModule = snap.module || null;
      this.lastSubmodule = snap.submodule || null;
      this._source = snap.source || null;
      this._ptitle = snap.ptitle || null;
      this._reinforce = null;
      this._redoItems = snap.redoItems;
      this._reviewed = [];
      this._daily = !!snap.daily;
      this._dailyDate = snap.daily ? snap.daily.date : '';
      this._dailyPast = snap.daily ? snap.daily.past : false;
      this.autoSaved = false;
      this.resultSent = false;
      this.percentile = null;
      this.session = true;
      this.startQTimer();
      if (this._redoItems) uni.showToast({ title: '继续' + REDO_PENDING_TITLE, icon: 'none' });
      else if (snap.daily) uni.showToast({ title: '继续' + (snap.daily.past ? '往期每日一练' : '今日一练') + ' · 第 ' + (this.idx + 1) + '/' + this.items.length + ' 题', icon: 'none' });
      this.saveSession();
      this.relinkWrongMids();
    },

    resumeNow() {
      const s = uni.getStorageSync('pendingSession');
      if (s && s.items && s.items.length && Date.now() - s.t <= 24 * 3600 * 1000) {
        this.adoptLocalPending(s);
        return;
      }
      if (this._srvResuming) return;
      this._srvResuming = true;
      request('/api/practice/resume?uid=' + anonUid())
        .then((d) => {
          this._srvResuming = false;
          if (this.session) return;
          const snap = adoptPracticeResume(d);
          if (!snap) {
            this.startDefault();
            return;
          }
          this.adoptRemoteSnap(snap);
        })
        .catch(() => {
          this._srvResuming = false;
          this.startDefault();
        });
    },

    tryServerResume() {
      if (this._srvResuming) return;
      const clearedAt = uni.getStorageSync('ppClearedAt');
      if (clearedAt && Date.now() - clearedAt < 30 * 1000) {
        this.startDefault();
        return;
      }
      this._srvResuming = true;
      request('/api/practice/resume?uid=' + anonUid())
        .then((d) => {
          this._srvResuming = false;
          if (this.session) return;
          const snap = adoptPracticeResume(d);
          if (!snap) {
            this.startDefault();
            return;
          }
          const done = snap.items.filter((q) => q._picked).length;
          if (done === 0) {
            this.adoptRemoteSnap(snap);
            return;
          }
          this.askResume(
            'remote',
            { title: snap.ptitle, done, total: snap.items.length },
            () => this.adoptRemoteSnap(snap),
            () => {
              this.clearServerProgress();
              this.startDefault();
            }
          );
        })
        .catch(() => {
          this._srvResuming = false;
          this.startDefault();
        });
    },

    tryResume() {
      const s = uni.getStorageSync('pendingSession');
      if (!s || !s.items || !s.items.length) {
        this.tryServerResume();
        return true;
      }
      if (Date.now() - s.t > 24 * 3600 * 1000) {
        uni.removeStorageSync('pendingSession');
        this.tryServerResume();
        return true;
      }
      const done = s.items.filter((q) => q._picked).length;
      if (done === 0) {
        this.adoptLocalPending(s);
        return true;
      }
      const title = pendingTitle(s);
      this.askResume(
        'local',
        { title, done, total: s.items.length },
        () => this.adoptLocalPending(s),
        () => {
          uni.removeStorageSync('pendingSession');
          this.clearServerProgress();
          this.start(s.lastModule || uni.getStorageSync('lastModule') || null, null, null, false, undefined, null, 'direct');
        }
      );
      return true;
    },

    stayHere() {
      if (this.autoTimer) {
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
      }
      trackEvent('practice_stay_here', this._source || 'practice');
    },

    askResume(kind, info, cont, drop) {
      this._resumeAct = { cont, drop, picked: false };
      this.resumeAsk = resumeAsk(kind, info);
      this.resumeOpen = true;
    },

    resumePick(cont) {
      const act = this._resumeAct;
      if (!act || act.picked) return;
      act.picked = true;
      this.resumeOpen = false;
      trackEvent(cont ? 'practice_resume_cont' : 'practice_resume_drop', this._source || 'practice');
      (cont ? act.cont : act.drop)();
    },

    quitPick(keep) {
      this.quitOpen = false;
      trackEvent(keep ? 'practice_quit_keep' : 'practice_quit_end', this._source || 'practice');
      this.leave(keep);
    },

};
