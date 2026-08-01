<template>
  <view class="wrap">
    <!-- 复习模式 -->
    <view v-if="reviewing" class="card review">
      <view class="rhead">
        <text class="tag">复习 {{ rIdx + 1 }}/{{ rItems.length }}</text>
        <text class="op" @click="exitReview">退出复习</text>
      </view>
      <view class="q">{{ cur.question_text }}</view>
      <view v-if="curLetter" class="opts">
        <view
          v-for="o in ['A', 'B', 'C', 'D']"
          :key="o"
          class="opt"
          :class="optClass(o)"
          @click="pick(o)"
        >{{ o }}</view>
      </view>
      <view v-if="answered">
        <view class="verdict" :class="wasCorrect ? 'good' : 'badv'">
          {{ wasCorrect ? (cur._requeued ? '这次答对了，本轮已纠正 ✓' : '答对了！连对 ' + streak + ' 次') : '又错了，看讲解（稍后本轮会再出现）' }}（下次复习：{{ nextDays }} 天后）
        </view>
        <rich-text :nodes="curHtml" />
        <button class="next" @click="nextReview">{{ rIdx + 1 < rItems.length ? '下一题' : '完成复习' }}</button>
      </view>
      <view v-else-if="!curLetter" class="selfjudge">
        <view class="q2">先自己做，然后：</view>
        <button class="sj ok" @click="selfJudge(true)">我做对了</button>
        <button class="sj bad" @click="selfJudge(false)">我做错了</button>
      </view>
    </view>

    <!-- 列表模式 -->
    <template v-else>
      <view v-if="due.length" class="card duecard" @click="startReview">
        <view>
          <view class="duetxt"><uni-icons type="calendar-filled" size="16" color="#ffffff" /><text class="duetxt-t">今日待复习 {{ dueTotal }} 道</text></view>
          <text class="duesub">按遗忘曲线安排 · 预计 {{ Math.max(1, Math.ceil(due.length * 0.8)) }} 分钟</text>
        </view>
        <text class="duego">开始复习</text>
      </view>
      <view v-if="items.length" class="toptabs">
        <view class="ttab" :class="{ on: tab === 'todo' }" @click="tab = 'todo'">待掌握 {{ todoItems.length }}</view>
        <view class="ttab" :class="{ on: tab === 'done' }" @click="tab = 'done'">已斩 {{ doneItems.length }}</view>
        <view v-if="favs.length" class="ttab" :class="{ on: tab === 'fav' }" @click="tab = 'fav'">收藏 {{ favs.length }}</view>
      </view>
      <template v-if="tab === 'fav'">
        <view v-if="!favs.length" class="card empty">
          <view class="e-t">还没有收藏题目</view>
          <view class="e-s">刷题时点顶栏星星即可收藏好题</view>
        </view>
        <view v-if="favs.length > 3" class="searchbar">
          <uni-icons type="search" size="16" color="#8a90a0" />
          <input v-model="favKw" class="searchinput" placeholder="搜收藏题干或题型" confirm-type="search" />
          <text v-if="favKw" class="searchclear" @click="favKw = ''">✕</text>
        </view>
        <view v-for="(f, fi) in favShown" :key="f.t" class="card mcard" @click="f._open = !f._open">
          <view class="mhead">
            <text class="tag">{{ f.submodule || modName(f.module) }}</text>
            <text v-if="f.is_real" class="rvbadge">真题{{ f.exam_year ? ' · ' + f.exam_year : '' }}{{ f.exam_region ? ' · ' + f.exam_region : '' }}</text>
          </view>
          <view class="q" :class="{ clamp: !f._open }">{{ (f.question || '').slice(0, 200) }}</view>
          <template v-if="f._open">
            <view v-for="(v, k) in f.options" :key="k" class="anscmp"><text :class="k === f.answer ? 'ca' : ''">{{ k }}. {{ v }}</text></view>
            <rich-text :nodes="md(f.hs_explanation || f.explanation || '暂无解析')" />
            <template v-if="f.xp_explanation">
              <view class="xp-k">{{ f.xp_school || '第二名师视角' }}</view>
              <view class="xp-body">{{ f.xp_explanation }}</view>
            </template>
          </template>
          <view class="mfoot">
            <text class="meta">{{ fmt(f.t / 1000) }}</text>
            <view class="acts">
              <text class="op del" @click.stop="unfavItem(f)">取消收藏</text>
            </view>
          </view>
        </view>
      </template>
      <view v-if="tab !== 'fav' && todoItems.length" class="card redoentry" @click="redoAll">
        <view class="redo-l">
          <view class="redo-ico"><uni-icons type="refreshempty" size="16" color="#4f46e5" /></view>
          <view>
            <text class="redo-t">错题重练</text>
            <text class="redo-s">把待掌握错题按刷题模式重做一遍（最多 10 题）</text>
          </view>
        </view>
        <text class="redo-go">开始</text>
      </view>
      <view v-if="tab !== 'fav' && items.length > 5" class="searchbar">
        <uni-icons type="search" size="16" color="#8a90a0" />
        <input v-model="kw" class="searchinput" placeholder="搜题干关键词或题型，如：增长率 / 类比推理" confirm-type="search" />
        <text v-if="kw" class="searchclear" @click="kw = ''">✕</text>
      </view>
      <view v-if="tab !== 'fav' && items.length > 5" class="sortrow">
        <text class="sort-k">排序</text>
        <text v-for="s in SORTS" :key="s.k" class="sort-chip" :class="{ on: sortBy === s.k }" @click="sortBy = s.k">{{ s.name }}</text>
      </view>
      <view v-if="tab !== 'fav' && typeGroups.length > 1" class="kpwrap">
        <text class="sort-k">题型聚合</text>
        <view class="kpchips">
          <text v-for="g in typeGroups" :key="g.name" class="kpchip" :class="{ on: kw === g.name }" @click="kw = kw === g.name ? '' : g.name">{{ g.name }} ×{{ g.n }}</text>
        </view>
      </view>
      <scroll-view v-if="tab !== 'fav' && items.length" scroll-x class="chips">
        <view
          v-for="c in chipList"
          :key="c.key"
          class="chip"
          :class="{ on: filterMod === c.key }"
          @click="filterMod = c.key"
        >{{ c.name }}</view>
      </scroll-view>
      <view v-if="tab !== 'fav' && loading" class="card spin">加载中…</view>
      <view v-else-if="tab !== 'fav' && !items.length" class="card empty">
        <view class="e-ico"><uni-icons type="folder-add" size="52" color="#c7cad4" /></view>
        <view class="e-t">错题本还是空的</view>
        <view class="e-s">去拍题讲解或刷题，答错的题会汇集到这里，之后按遗忘曲线安排复习</view>
        <button class="e-btn" @click="goPractice">去刷题</button>
      </view>
      <view v-if="tab !== 'fav' && items.length && !shownItems.length && !loading" class="card empty">
        <view class="e-t">没有匹配的错题</view>
        <view class="e-s">换个关键词或清除筛选试试</view>
      </view>
      <view v-for="m in shownPage" :key="m.id" class="card mcard" :class="masteryClass(m)" @click="m.open = !m.open">
        <view class="mhead">
          <text class="tag">{{ m.question_type || modName(m.module) }}</text>
          <text v-if="m.times >= 2" class="timesbadge">错 {{ m.times }} 次</text>
          <text v-if="m.mastered" class="zhan">已斩</text>
          <view v-else-if="nextReviewText(m)" class="duehint" :class="{ due: isDue(m) }">
            <view class="duedot" /><text>{{ nextReviewText(m) }}</text>
          </view>
          <text class="meta mtime">{{ fmt(m.created_at) }}</text>
        </view>
        <view class="q" :class="{ clamp: !m.open }">{{ (m.question_text || '').slice(0, 200) }}</view>
        <view v-if="ansLetter(m.user_answer)" class="anscmp">
          <text class="rpill wrong">我选 {{ ansLetter(m.user_answer) }}</text>
          <text v-if="ansLetter(m.correct_answer)" class="rpill right">答案 {{ ansLetter(m.correct_answer) }}</text>
        </view>
        <view class="mfoot">
          <view class="acts">
            <text v-if="!m.mastered" class="op redo" @click.stop="redo(m)">AI 详解</text>
            <text v-else class="op redo" @click.stop="master(m, false)">恢复复习</text>
          </view>
          <text class="op more" @click.stop="itemSheet(m)">···</text>
        </view>
        <rich-text v-if="m.open" :nodes="m.html" />
      </view>
      <view v-if="tab !== 'fav' && pageN < shownItems.length" class="loadmore" @click="pageN += 20">上滑或点击加载更多（{{ shownPage.length }}/{{ shownItems.length }}）</view>
    </template>
  </view>
</template>

<script>
import { md } from '../../md.js';
import { request, anonUid } from '../../api.js';

const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断', shenlun: '申论' };

function extractLetter(s) {
  const m = /[A-D]/.exec(String(s || '').toUpperCase());
  return m ? m[0] : null;
}

export default {
  data() {
    return {
      items: [],
      loading: true,
      due: [],
      dueTotal: 0,
      reviewing: false,
      rItems: [],
      rIdx: 0,
      picked: null,
      answered: false,
      wasCorrect: false,
      nextDays: 0,
      streak: 0,
      filterMod: '',
      kw: '',
      favKw: '',
      tab: 'todo',
      favs: [],
      sortBy: 'time',
      pageN: 20,
      SORTS: [
        { k: 'time', name: '最新' },
        { k: 'due', name: '待复习优先' },
        { k: 'times', name: '错次多' },
        { k: 'type', name: '按题型' },
        { k: 'reason', name: '按错因' },
      ],
    };
  },
  computed: {
    cur() {
      return this.rItems[this.rIdx] || {};
    },
    favShown() {
      const k = this.favKw.trim().toLowerCase();
      if (!k) return this.favs;
      return this.favs.filter((f) =>
        String(f.question || '').toLowerCase().includes(k) ||
        String(f.submodule || '').toLowerCase().includes(k) ||
        this.modName(f.module).includes(k)
      );
    },
    curLetter() {
      return extractLetter(this.cur.correct_answer);
    },
    curHtml() {
      return md(this.cur.explanation || '');
    },
    chipList() {
      const mods = [...new Set(this.items.map((m) => m.module).filter(Boolean))];
      return [{ key: '', name: '全部' }, ...mods.map((m) => ({ key: m, name: NAMES[m] || m }))];
    },
    todoItems() {
      return this.items.filter((m) => !m.mastered);
    },
    doneItems() {
      return this.items.filter((m) => m.mastered);
    },
    shownItems() {
      if (this.tab === 'fav') return [];
      let base = this.tab === 'done' ? this.doneItems : this.todoItems;
      if (this.filterMod) base = base.filter((m) => m.module === this.filterMod);
      base = [...base];
      if (this.sortBy === 'times') base.sort((a, b) => (b.times || 1) - (a.times || 1));
      else if (this.sortBy === 'type') base.sort((a, b) => String(a.question_type || a.module || '').localeCompare(String(b.question_type || b.module || ''), 'zh'));
      else if (this.sortBy === 'reason') base.sort((a, b) => String(a.error_reason || '￿').localeCompare(String(b.error_reason || '￿'), 'zh'));
      else if (this.sortBy === 'due') base.sort((a, b) => (a.next_review || 9e12) - (b.next_review || 9e12));
      const k = this.kw.trim().toLowerCase();
      if (k) {
        base = base.filter(
          (m) =>
            (m.question_text || '').toLowerCase().includes(k) ||
            (m.question_type || '').toLowerCase().includes(k) ||
            (m.error_reason || '').includes(k) ||
            (!m.question_type && (NAMES[m.module] || '').toLowerCase().includes(k))
        );
      }
      return base;
    },
    shownPage() {
      return this.shownItems.slice(0, this.pageN);
    },
    typeGroups() {
      if (this.tab === 'fav') return [];
      let base = this.tab === 'done' ? this.doneItems : this.todoItems;
      if (this.filterMod) base = base.filter((m) => m.module === this.filterMod);
      const map = {};
      for (const m of base) {
        const t = m.question_type || NAMES[m.module] || m.module || '其他';
        map[t] = (map[t] || 0) + 1;
      }
      return Object.entries(map)
        .map(([name, n]) => ({ name, n }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 12);
    },
  },
  watch: {
    tab() { this.pageN = 20; },
    filterMod() { this.pageN = 20; },
    kw() { this.pageN = 20; },
    sortBy() { this.pageN = 20; },
  },
  onReachBottom() {
    if (this.tab !== 'fav' && this.pageN < this.shownItems.length) this.pageN += 20;
  },
  onShow() {
    this.favs = (uni.getStorageSync('favQuestions') || []).map((f) => ({ ...f, _open: false }));
    if (this.tab === 'fav' && !this.favs.length) this.tab = 'todo';
    this.load();
  },
  methods: {
    md,
    unfavItem(f) {
      this.unfav(this.favs.indexOf(f));
    },
    unfav(i) {
      if (i < 0) return;
      this.favs.splice(i, 1);
      uni.setStorageSync('favQuestions', this.favs.map(({ _open, ...f }) => f));
      if (!this.favs.length) this.tab = 'todo';
    },
    isDue(m) {
      return !m.next_review || m.next_review <= Date.now() / 1000;
    },
    nextReviewText(m) {
      if (this.isDue(m)) return '今日待复习';
      const days = Math.ceil((m.next_review - Date.now() / 1000) / 86400);
      return days === 1 ? '明天复习' : days + ' 天后复习';
    },
    modName(m) {
      return NAMES[m] || m || '';
    },
    masteryClass(m) {
      if (m.mastered) return 'lv-good';
      if (!m.review_count) return 'lv-new';
      return m.review_count >= 2 ? 'lv-good' : 'lv-mid';
    },
    ansLetter(s) {
      const m = /[A-D]/.exec(String(s || '').toUpperCase());
      return m ? m[0] : '';
    },
    async master(m, on = true) {
      await request('/api/mistakes/' + m.id, { method: 'PATCH', data: { mastered: on ? 1 : 0 } });
      if (on) uni.showToast({ title: '已斩！', icon: 'success' });
      this.load();
    },
    goPractice() {
      uni.switchTab({ url: '/pages/practice/practice' });
    },
    async load() {
      this.loading = true;
      try {
        const uq = 'uid=' + encodeURIComponent(anonUid());
        const [d, r] = await Promise.all([request('/api/mistakes?' + uq), request('/api/review?' + uq)]);
        this.items = d.items.map((m) => ({ ...m, open: false, html: md(m.explanation || '') }));
        this.due = r.items;
        this.dueTotal = r.total || r.items.length;
        try {
          if (this.dueTotal > 0) uni.setTabBarBadge({ index: 2, text: String(this.dueTotal > 99 ? '99+' : this.dueTotal) });
          else uni.removeTabBarBadge({ index: 2 });
        } catch (e) { /* tabBar 未就绪时忽略 */ }
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    startReview() {
      this.rItems = [...this.due];
      this.rIdx = 0;
      this.resetQ();
      this.reviewing = true;
    },
    resetQ() {
      this.picked = null;
      this.answered = false;
      this.wasCorrect = false;
      this.nextDays = 0;
    },
    async pick(o) {
      if (this.answered) return;
      this.picked = o;
      await this.record(o === this.curLetter);
    },
    async selfJudge(correct) {
      await this.record(correct);
    },
    async record(correct) {
      this.wasCorrect = correct;
      this.answered = true;
      if (!correct && !this.cur._requeued) {
        this.rItems.push({ ...this.cur, _requeued: true });
      }
      try {
        const res = await request('/api/review/' + this.cur.id, { method: 'POST', data: { correct } });
        this.nextDays = res.next_review_days;
        this.streak = res.streak;
      } catch (e) {
        uni.showToast({ title: '记录失败：' + e.message, icon: 'none' });
      }
    },
    nextReview() {
      if (this.rIdx + 1 < this.rItems.length) {
        this.rIdx++;
        this.resetQ();
      } else {
        this.exitReview();
        uni.showToast({ title: '本轮复习完成！', icon: 'success' });
      }
    },
    exitReview() {
      this.reviewing = false;
      this.load();
    },
    optClass(o) {
      if (!this.answered) return '';
      if (o === this.curLetter) return 'ok';
      if (o === this.picked) return 'bad';
      return 'dim';
    },
    fmt(ts) {
      const d = new Date(ts * 1000);
      const now = new Date();
      const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      const sameDay = (a, b) => a.toDateString() === b.toDateString();
      if (sameDay(d, now)) return '今天 ' + hm;
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      if (sameDay(d, yest)) return '昨天 ' + hm;
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    },
    async redoAll() {
      try {
        const d = await request('/api/mistakes/redo?limit=10');
        if (!d.items || !d.items.length) {
          uni.showToast({ title: '错题未能匹配到题库原题', icon: 'none' });
          return;
        }
        uni.setStorageSync('redoSet', d.items);
        uni.switchTab({ url: '/pages/practice/practice' });
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
    redo(m) {
      uni.setStorageSync('redoQuestion', m.question_text || '');
      uni.switchTab({ url: '/pages/ask/ask' });
    },
    practiceSimilar(m) {
      const qt = m.question_type || '';
      const sub = qt.includes('-') ? qt.split('-').slice(1).join('-') : null;
      uni.setStorageSync('practicePreset', { module: m.module, submodule: sub, count: 3 });
      uni.switchTab({ url: '/pages/practice/practice' });
    },
    itemSheet(m) {
      const acts = [];
      if (m.module) acts.push({ t: '练3道同类', f: () => this.practiceSimilar(m) });
      if (!m.mastered) acts.push({ t: '标为已斩', f: () => this.master(m) });
      acts.push({ t: '删除', f: () => this.del(m) });
      uni.showActionSheet({
        itemList: acts.map((a) => a.t),
        success: (r) => acts[r.tapIndex].f(),
      });
    },
    del(m) {
      uni.showModal({
        title: '确定删除这道错题？',
        success: async (res) => {
          if (!res.confirm) return;
          await request('/api/mistakes/' + m.id, { method: 'DELETE' });
          this.load();
        },
      });
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 24rpx; margin-bottom: 24rpx; border-left: 6rpx solid var(--brand); border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.empty { text-align: center; padding: 56rpx 32rpx; }
.e-ico { font-size: 72rpx; margin-bottom: 16rpx; }
.e-t { font-size: 32rpx; font-weight: 600; margin-bottom: 10rpx; }
.e-s { font-size: 24rpx; color: var(--ink-2); line-height: 1.7; margin-bottom: 28rpx; }
.e-btn { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border-radius: 18rpx; font-size: 28rpx; font-weight: 600; width: 60%; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; border-left: none; }
.searchbar { display: flex; align-items: center; gap: 12rpx; background: var(--card); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 14rpx 26rpx; margin-bottom: 20rpx; }
.searchinput { flex: 1; font-size: 26rpx; color: var(--ink); height: 40rpx; line-height: 40rpx; }
.searchclear { font-size: 26rpx; color: var(--ink-2); padding: 0 8rpx; }
.sortrow { display: flex; align-items: center; gap: 10rpx; margin-bottom: 16rpx; flex-wrap: wrap; }
.sort-k { font-size: 22rpx; color: var(--ink-2); }
.sort-chip { font-size: 22rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 4rpx 18rpx; background: var(--card); }
.sort-chip.on { color: #fff; background: var(--brand, #4f6ef7); border-color: var(--brand, #4f6ef7); }
.kpwrap { margin-bottom: 16rpx; }
.kpchips { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 8rpx; }
.kpchip { font-size: 22rpx; color: var(--ink-2); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 6rpx 18rpx; background: var(--card); }
.kpchip.on { color: #fff; background: var(--brand, #4f6ef7); border-color: var(--brand, #4f6ef7); }
.chips { white-space: nowrap; margin-bottom: 24rpx; }
.chip { display: inline-block; padding: 10rpx 30rpx; margin-right: 16rpx; border-radius: 999rpx; background: var(--card); border: 1rpx solid var(--line); font-size: 25rpx; color: var(--ink-2); }
.chip.on { background: var(--brand); border-color: var(--brand); color: #fff; font-weight: 600; }
.mhead { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
.mtime { margin-left: auto; white-space: nowrap; }
.duehint { display: inline-flex; align-items: center; gap: 8rpx; font-size: 21rpx; color: var(--ink-2); }
.duehint.due { color: #c2410c; }
.duedot { width: 12rpx; height: 12rpx; border-radius: 50%; background: #c7cad4; }
.duehint.due .duedot { background: #f59e0b; }
.rvbadge { font-size: 20rpx; color: var(--ink-2); background: var(--soft-bg); border-radius: 999rpx; padding: 4rpx 14rpx; }
.rzbadge { font-size: 20rpx; color: #b45309; background: #fef3c7; border-radius: 999rpx; padding: 4rpx 14rpx; }
.zhan { margin-left: auto; font-size: 22rpx; font-weight: 700; color: var(--ok); border: 3rpx solid var(--ok); border-radius: 8rpx; padding: 2rpx 12rpx; transform: rotate(-8deg); }
.anscmp { margin-top: 12rpx; font-size: 23rpx; display: flex; gap: 12rpx; align-items: center; flex-wrap: wrap; }
.anscmp .ca { color: var(--ok); font-weight: 600; }
.rpill { font-size: 22rpx; font-weight: 600; border-radius: 999rpx; padding: 6rpx 20rpx; }
.rpill.wrong { background: #fee2e2; color: #b91c1c; }
.rpill.right { background: #dcfce7; color: #15803d; }
.zop { color: var(--ok); border: 1rpx solid var(--ok); }
.toptabs { display: flex; gap: 16rpx; margin-bottom: 20rpx; }
.ttab { flex: 1; text-align: center; padding: 16rpx 0; border-radius: 16rpx; background: var(--card); border: 1rpx solid var(--line); font-size: 26rpx; color: var(--ink-2); }
.ttab.on { background: var(--brand); border-color: var(--brand); color: #fff; font-weight: 600; }
.xp-k { margin-top: 12rpx; font-size: 22rpx; font-weight: 700; color: #ea580c; border-left: 6rpx solid #ea580c; padding-left: 10rpx; }
.xp-body { margin-top: 6rpx; font-size: 23rpx; color: var(--ink); background: #fff7ed; border-radius: 10rpx; padding: 12rpx; line-height: 1.6; }
.mfoot { display: flex; justify-content: space-between; align-items: center; margin-top: 12rpx; border-top: 1rpx solid var(--line); padding-top: 8rpx; }
.op.more { color: var(--ink-2); font-weight: 700; padding: 18rpx 30rpx; margin-left: 0; }
.loadmore { text-align: center; font-size: 24rpx; color: var(--ink-2); padding: 24rpx 0 140rpx; }
.acts { display: flex; gap: 8rpx; }
.op { font-size: 24rpx; margin-left: 16rpx; padding: 18rpx 24rpx; border-radius: 999rpx; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; }
.op.sim { background: var(--brand-soft); color: var(--brand); }
.redo { color: var(--brand); border: 1rpx solid var(--brand); }
.del { color: #c33; }
.tag { display: inline-block; background: var(--brand-soft); color: var(--brand); border-radius: 10rpx; padding: 4rpx 14rpx; font-size: 22rpx; }
.q { font-size: 26rpx; line-height: 1.5; margin-top: 10rpx; }
.q.clamp { max-height: 120rpx; overflow: hidden; }
.meta { font-size: 22rpx; color: var(--ink-2); }
.duecard { background: linear-gradient(135deg, #3b6ef6, #7c5cfc); border: none; display: flex; justify-content: space-between; align-items: center; }
.redoentry { display: flex; justify-content: space-between; align-items: center; }
.redo-l { display: flex; align-items: center; gap: 16rpx; }
.redo-ico { width: 64rpx; height: 64rpx; border-radius: 50%; background: var(--brand-soft, #eef2ff); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.redo-t { display: block; font-size: 27rpx; font-weight: 600; color: var(--ink); }
.redo-s { display: block; font-size: 21rpx; color: var(--ink-2); margin-top: 4rpx; }
.redo-go { background: var(--brand-soft, #eef2ff); color: var(--brand, #4f46e5); font-size: 25rpx; font-weight: 600; border-radius: 999rpx; padding: 0 34rpx; min-height: 44px; line-height: 44px; flex-shrink: 0; box-sizing: border-box; }
.nrbadge {
  display: inline-block;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 10rpx;
  padding: 4rpx 14rpx;
  font-size: 22rpx;
  margin-left: 8rpx;
}
.nrbadge.due {
  background: #fff7ed;
  color: #c2410c;
}
.timesbadge { display: inline-block; background: #fee2e2; color: #b91c1c; border-radius: 10rpx; padding: 4rpx 14rpx; font-size: 22rpx; margin-left: 8rpx; }
.duetxt { display: flex; align-items: center; gap: 8rpx; font-size: 28rpx; font-weight: 700; color: #fff; }
.duetxt-t { font-size: 28rpx; font-weight: 700; color: #fff; }
.duesub { display: block; font-size: 21rpx; color: rgba(255, 255, 255, 0.75); margin-top: 6rpx; }
.duego { background: #fff; color: #4f46e5; font-size: 25rpx; font-weight: 600; border-radius: 999rpx; padding: 0 34rpx; min-height: 44px; line-height: 44px; display: inline-block; box-sizing: border-box; }
.review { border-left-color: #f5a623; }
.rhead { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.opts { display: flex; gap: 16rpx; margin: 20rpx 0; }
.opt { flex: 1; text-align: center; padding: 16rpx 0; border: 2rpx solid #d9dee8; border-radius: 12rpx; font-size: 28rpx; }
.opt.ok { background: #e6f7e6; border-color: #3aa53a; color: #2a7a2a; }
.opt.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
.opt.dim { opacity: 0.4; }
.verdict { font-size: 26rpx; font-weight: 600; margin: 12rpx 0; }
.verdict.good { color: #2a7a2a; }
.verdict.badv { color: #b03030; }
.next { margin-top: 20rpx; background: var(--brand); color: #fff; font-size: 28rpx; border-radius: 12rpx; }
.selfjudge { margin-top: 20rpx; }
.q2 { font-size: 24rpx; color: var(--ink-2); margin-bottom: 12rpx; }
.sj { display: inline-block; width: 45%; margin-right: 4%; font-size: 26rpx; border-radius: 12rpx; }
.sj.ok { background: #e6f7e6; color: #2a7a2a; }
.sj.bad { background: var(--bad-soft); color: var(--bad); }
</style>
