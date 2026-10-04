<template>
  <view class="page">
    <kg-skeleton v-if="loading" preset="lines" />
    <kg-empty-state
      v-else-if="errMsg"
      icon="triangle-alert"
      :title="errMsg"
      desc="题目可能已被删除或链接不完整，10万+ 题库仍可免费刷"
      cta-text="去刷题"
      @cta="goHome"
    />

    <template v-else-if="d">
      <kg-hero-card :label="d.from_name + ' 分享了一道题'" :value="d.answered || d.is_sharer ? (answers.length || d.n_answered) : '?'" :unit="d.answered || d.is_sharer ? ' 人已作答' : ''">
        <text class="hero-s">{{ d.answered || d.is_sharer ? '看看大家都选了什么' : '先作答，再看答案和大家的选择' }}</text>
      </kg-hero-card>

      <kg-question-card :q="qCard" class="sec">
        <kg-option-group
          :options="optList"
          :model-value="optPicked"
          :answer="revealed ? String(d.question.answer || '').split('') : []"
          :revealed="revealed"
          :readonly="revealed || submitting"
          :multiple="isMulti"
          @select="pick"
        />
      </kg-question-card>
      <view v-if="isMulti && !revealed" class="multi-bar">
        <text class="multi-hint">多选题：选完所有正确项后确认</text>
        <kg-button variant="primary" size="lg" :disabled="!multiSel.length || submitting" @click="confirmMulti">
          确认答案{{ multiSel.length ? '（' + multiSel.length + '）' : '' }}
        </kg-button>
      </view>

      <!-- 作答后 / 分享者：答案与解析 -->
      <template v-if="revealed">
        <kg-banner v-if="myResult" :tone="myResult.correct ? 'ok' : 'bad'" :closable="false" class="sec"
          :text="myResult.correct ? '答对了！正确答案 ' + d.question.answer : '答错了，正确答案是 ' + d.question.answer + '，你选了 ' + myResult.picked" />
        <kg-banner v-if="beatText" tone="warn" icon="trophy" :closable="false" class="sec" :text="beatText" />

        <kg-analysis-card
          v-if="d.question.explanation"
          class="sec"
          :answer="d.question.answer"
          :picked="myResult ? myResult.picked : ''"
          :analysis="d.question.explanation"
          :tags="d.question.submodule ? [d.question.submodule] : []"
        />

        <kg-card variant="flat" class="sec">
          <text class="h">大家的作答（{{ answers.length }} 人）</text>
          <kg-empty-state v-if="!answers.length" compact icon="users" title="还没有人作答" desc="把链接再发给几个考友吧" />
          <view v-for="(a, i) in answers" :key="i" class="ans-row">
            <text class="ans-name">{{ a.nickname }}</text>
            <text class="ans-pick">选 {{ a.picked }}</text>
            <kg-tag :tone="a.correct ? 'ok' : 'bad'">{{ a.correct ? '对' : '错' }}</kg-tag>
          </view>
        </kg-card>

        <kg-card v-if="teamInvite && !teamJoined" variant="flat" class="sec team-cta">
          <view class="tc-l">
            <text class="tc-t">和 {{ d.from_name }} 组队刷题</text>
            <text class="tc-s">加入小队「{{ teamInvite.name }}」，每天互相监督打卡</text>
          </view>
          <kg-button size="md" :loading="joining" @click="joinTeam">一键加入</kg-button>
        </kg-card>
        <kg-card v-else-if="teamJoined" variant="flat" class="sec team-cta joined">
          <view class="tc-l">
            <text class="tc-t">🎉 已加入「{{ teamInvite.name }}」</text>
            <text class="tc-s">每天刷题就是打卡，队友都能看到你的进度</text>
          </view>
          <kg-button size="md" variant="ghost" @click="goTeamPage">看队友</kg-button>
        </kg-card>

        <kg-action-bar layout="actions" primary-text="去刷同类题" :secondary-text="d.is_sharer ? '复制分享链接' : ''" @primary="goSimilar" @secondary="copyLink" />
      </template>

      <view class="reg-tip">
        <kg-button variant="text" size="md" @click="goLogin">登录 / 注册岸上见，10万+ 题库免费刷</kg-button>
      </view>
    </template>
  </view>
</template>

<script>
import { shareDetail, shareAnswer, trackEvent, teamJoin, qShareText, canonicalizeSharePath } from '../../api.js';
import { MODULES, moduleLabel } from '../../module-meta.js';
import { shareBeatLine } from '../../exam-copy.js';
import { togglePickLetter } from '../../exam-excl.js';

const modName = (m) => (MODULES[m] ? moduleLabel(m) : m === 'shenlun' ? '申论' : m || '行测');

export default {
  data() {
    return {
      sid: '',
      d: null,
      loading: true,
      errMsg: '',
      picked: '',
      multiSel: '',
      myResult: null,
      answers: [],
      startTs: 0,
      submitting: false,
      qStats: null,
      teamInvite: null,
      teamJoined: false,
      joining: false,
      joinedTeamId: null,
      variant: '',
    };
  },
  computed: {
    revealed() {
      return !!(this.d && (this.d.is_sharer || this.d.answered || this.myResult));
    },
    isMulti() {
      return !!(this.d && this.d.question && this.d.question.multi);
    },
    modLabel() {
      return modName(this.d && this.d.question.module);
    },
    qCard() {
      const q = this.d.question;
      return { id: q.id, module: q.module, tag3: q.submodule || '', stem: String(q.question || '') };
    },
    optList() {
      const o = (this.d && this.d.question.options) || {};
      return Object.keys(o).map((k) => ({ key: k, text: String(o[k] == null ? '' : o[k]) }));
    },
    optPicked() {
      const v = this.revealed && this.myResult ? this.myResult.picked : this.isMulti ? this.multiSel : this.picked;
      return String(v || '').split('');
    },
    nAnsweredText() {
      return `${this.answers.length || this.d.n_answered} 人已作答`;
    },
    beatText() {
      return shareBeatLine(this.qStats, this.myResult);
    },
  },
  onLoad(query) {
    this.sid = query && query.sid ? String(query.sid) : '';
    const v = query && query.v ? String(query.v) : '';
    this.variant = v === 'a' || v === 'b' ? v : '';
    trackEvent('share_open', this.variant ? 'share_' + this.variant : 'share', this.sid || null);
    if (this.sid) canonicalizeSharePath('/s/' + encodeURIComponent(this.sid));
    uni.setStorageSync('regSource', 'share');
    this.load();
  },
  methods: {
    async load() {
      if (!this.sid) {
        this.loading = false;
        this.errMsg = '分享链接无效';
        return;
      }
      try {
        const d = await shareDetail(this.sid);
        this.d = d;
        this.answers = d.answers || [];
        if (d.my_answer) this.myResult = d.my_answer;
        if (d.q_stats) this.qStats = d.q_stats;
        this.teamInvite = d.team_invite || null;
        this.startTs = Date.now();
        uni.setNavigationBarTitle({ title: `${d.from_name} 考了你一道${d.question.submodule || modName(d.question.module)}题，你能做对吗？- 岸上见` });
      } catch (e) {
        this.errMsg = e.message || '分享不存在或已过期';
      }
      this.loading = false;
    },
    pick(k) {
      if (this.revealed || this.submitting) return;
      if (this.isMulti) {
        this.multiSel = togglePickLetter(this.multiSel, k);
        return;
      }
      this.submit(k);
    },
    confirmMulti() {
      if (this.revealed || this.submitting || !this.multiSel) return;
      this.submit(this.multiSel);
    },
    async submit(k) {
      this.picked = k;
      this.submitting = true;
      try {
        const secs = Math.round((Date.now() - this.startTs) / 1000);
        const r = await shareAnswer(this.sid, k, secs);
        this.myResult = { picked: k, correct: r.correct };
        this.d.question.answer = r.answer;
        this.d.question.explanation = r.explanation;
        this.answers = r.answers || [];
        if (r.q_stats) this.qStats = r.q_stats;
        if (r.team_invite) this.teamInvite = r.team_invite;
        trackEvent('share_answer', this.variant ? 'share_' + this.variant : 'share', this.sid);
      } catch (e) {
        this.picked = '';
        uni.showToast({ title: e.message || '提交失败', icon: 'none' });
      }
      this.submitting = false;
    },
    goSimilar() {
      uni.setStorageSync('practiceLaunch', {
        kind: 'start',
        module: this.d.question.module || null,
        submodule: this.d.question.submodule || null,
        count: 10,
        source: 'share',
      });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    copyLink() {
      const mod = this.d.question.submodule || modName(this.d.question.module);
      trackEvent('share_copy', 'share_q', this.sid);
      uni.setClipboardData({
        data: qShareText(mod, this.sid, this.myResult ? !!this.myResult.correct : undefined),
        success: () => uni.showToast({ title: '分享链接已复制', icon: 'none' }),
      });
    },
    async joinTeam() {
      if (this.joining) return;
      this.joining = true;
      try {
        const d = await teamJoin(this.teamInvite.code);
        this.teamJoined = true;
        this.joinedTeamId = d.team.id;
        trackEvent('share_team_join', 'share_q', this.sid);
        uni.showToast({ title: d.already ? '你已在该小队' : '加入成功！', icon: 'none' });
      } catch (e) {
        uni.showToast({ title: e.message || '加入失败', icon: 'none' });
      }
      this.joining = false;
    },
    goTeamPage() {
      uni.navigateTo({ url: '/pkgA/team/team?id=' + this.joinedTeamId });
    },
    goHome() {
      uni.reLaunch({ url: '/pages/home/home' });
    },
    goLogin() {
      uni.navigateTo({ url: '/pkgA/user/login' });
    },
  },
};
</script>

<style scoped>
.page { padding: var(--sp-16) var(--page-x) calc(var(--bar-h) + var(--sp-24) + env(safe-area-inset-bottom, 0px)); }
.sec { margin-top: var(--card-gap); }
.h { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); margin-bottom: var(--sp-12); }
.hero-s { display: block; font-size: var(--fs-sub); color: var(--on-brand); opacity: 0.85; margin-top: var(--sp-8); }
.ans-row { display: flex; align-items: center; gap: var(--sp-12); min-height: var(--hit-min); padding: var(--sp-4) 0; border-bottom: 1px solid var(--line); }
.ans-row:last-child { border-bottom: none; }
.ans-name { flex: 1; font-size: var(--fs-body); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ans-pick { font-size: var(--fs-sub); color: var(--ink-2); }
.team-cta { display: flex; align-items: center; gap: var(--sp-12); }
.team-cta.joined { background: var(--ok-soft); }
.tc-l { flex: 1; min-width: 0; }
.tc-t { display: block; font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.tc-s { display: block; font-size: var(--fs-caption); color: var(--ink-2); margin-top: var(--sp-4); }
.reg-tip { display: flex; justify-content: center; padding: var(--sp-12) 0; }

.multi-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-12); margin-top: var(--sp-8); }
.multi-hint { font-size: var(--fs-caption); color: var(--ink-2); }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .page { max-width: 760px; margin: 0 auto; padding-bottom: var(--sp-24); }
}
/* #endif */
</style>
