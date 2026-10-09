// 每日一练/时政每日答：完成标记、成绩上报与失败重投（practice.vue 抽离，方法 this 仍指组件实例）

import { request, anonUid, pkNickname, submitDailySet } from '../api.js';
import { dayKey, saveSzDaily } from '../checkin.js';

export const dailyOps = {
    markDailyDone() {
      if (!this._daily) return;
      this._daily = false;
      const past = this._dailyPast;
      this._dailyPast = false;
      if (past) {
        // 往期补练：成绩/榜单/streak 均为当日语义，不提交不打卡，完成页走普通成绩展示
        this._dailyDate = '';
        uni.showToast({ title: '往期补练完成', icon: 'none' });
        return;
      }
      this.daily.days[dayKey()] = true;
      uni.setStorageSync('dailyPlan', this.daily);
      uni.showToast({ title: '今日一练完成，打卡成功！', icon: 'none' });
      const date = this._dailyDate;
      this._dailyDate = '';
      if (!date) return;
      this._dailyDoneDate = date;
      this.sendDailyResult({ uid: anonUid(), nickname: pkNickname(), date, right: this.right, total: this.items.length, secs: this.totalSecs });
    },
    // 成绩上报：成功挂全站成绩 + 榜；提交失败置 dailyErr 供完成页重试（payload 已在 dailyPendingSubmit，首页 onShow 也会补传）；榜失败不算失败,

    sendDailyResult(payload) {
      this.dailyErr = false;
      return submitDailySet(payload)
        .then((d) => {
          this.dailyStats = d;
          // #ifdef H5
          this.initPushNudge();
          // #endif
          return request('/api/daily_set/board?uid=' + encodeURIComponent(anonUid())).then((b) => { this.dailyBoard = (b && b.items) || []; });
        })
        .catch(() => {
          if (!this.dailyStats) this.dailyErr = true;
        });
    },

    retryDailySubmit() {
      const p = uni.getStorageSync('dailyPendingSubmit');
      if (!p || !p.date || p.date !== this._dailyDoneDate) {
        this.dailyErr = false;
        return;
      }
      uni.showToast({ title: '重新上传成绩…', icon: 'none', duration: 1000 });
      this.sendDailyResult(p);
    },

    _mapShizheng(q) {
      return {
        ...q,
        explanation: (q.explanation || '') + (q.source_note ? '\n【出处】' + q.source_note : ''),
        _sz: true,
        _saved: false,
      };
    },

    markShizhengDone() {
      if (!this._shizheng) return;
      this._shizheng = false;
      if (this._szPast) {
        this._szPast = false;
        uni.showToast({ title: '往期时政补练完成', icon: 'none' });
        return;
      }
      const day = dayKey();
      this.szDaily.days[day] = { right: this.right, best: this.bestStreak, picks: this.items.map((q) => q._picked || ''), secs: this.items.map((q) => q._secs || 0) };
      saveSzDaily(anonUid(), this.szDaily);
      uni.showToast({ title: '时政每日一练完成！', icon: 'none' });
    },

};
