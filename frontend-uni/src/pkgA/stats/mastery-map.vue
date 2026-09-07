<template>
  <view class="page" :class="{ 'has-bar': selected }">
    <!-- 冷启动：还不到解锁题量 -->
    <kg-card v-if="cold" class="cold">
      <kg-empty-state
        compact
        icon="chart-pie"
        :title="'再练 ' + Math.max(0, need - nTotal) + ' 题解锁掌握度地图'"
        :desc="'累计作答 ' + nTotal + '/' + need + ' 题后，按三级考点展示你的掌握度色阶'"
      />
      <kg-progress :value="nTotal" :max="need" :thickness="8" aria-label="解锁进度" class="cold-bar" />
      <kg-button variant="primary" size="lg" block @click="goPractice()">去刷题</kg-button>
    </kg-card>

    <template v-else-if="map">
      <kg-two-col aside-first>
        <template #aside>
          <!-- 覆盖度总览 -->
          <kg-card class="head">
            <kg-progress shape="ring" :value="map.coverage.pct" :size="72" aria-label="考点覆盖度" />
            <view class="head-r">
              <text class="head-t">考点掌握度地图</text>
              <text class="head-s">已练 <text class="num">{{ map.coverage.practiced }}/{{ map.coverage.total }}</text> 个考点 · 累计 <text class="num">{{ map.n_total }}</text> 题</text>
              <view class="legend">
                <text v-for="l in LEVELS" :key="l.key" class="lg" :class="l.key">{{ l.label }}</text>
              </view>
            </view>
          </kg-card>

          <!-- 模块导航：≥1024 竖排在辅栏；移动端为横向 chip -->
          <kg-card class="side-nav" :padding="12">
            <view v-for="m in map.modules" :key="'s-' + m.module" class="side-item" :class="{ on: curMod === m.module }" role="button" @click="curMod = m.module">
              <kg-tag tone="module" :module="m.module">{{ m.name }}</kg-tag>
              <text class="side-pct num">{{ m.n ? Math.round(m.mastery * 100) + '%' : '未练' }}</text>
            </view>
          </kg-card>
        </template>

        <template #main>
          <kg-chip-row v-model="curMod" :options="modChips" class="tabs" />

          <view class="toolbar">
            <wd-segmented :value="viewLabel" :options="viewOpts" size="small" @change="onViewChange" />
          </view>

          <!-- 二级题型卡 + 三级考点 -->
          <kg-card v-for="g in curSubs" :key="g.code" class="grp">
            <view class="grp-h">
              <text class="grp-name">{{ g.submodule }}</text>
              <text class="grp-meta num">{{ g.n ? Math.round(g.mastery * 100) + '% · ' + g.n + ' 题' : '未练习' }}</text>
            </view>
            <!-- 网格：色阶格 -->
            <view v-if="view === 'grid'" class="tiles">
              <view
                v-for="t in g.tag3s"
                :key="t.code"
                class="tile"
                :class="[t.level, { sel: selected && selected.code === t.code }]"
                role="button"
                :aria-pressed="selected && selected.code === t.code ? 'true' : 'false'"
                @click="pick(g, t)"
              >
                <text class="tile-name">{{ t.name }}</text>
                <text class="tile-meta num">{{ t.n ? Math.round(t.mastery * 100) + '%' : '未练' }}</text>
                <view v-if="t.due_mistakes" class="dot num">{{ t.due_mistakes > 9 ? '9+' : t.due_mistakes }}</view>
              </view>
            </view>
            <!-- 列表：名称 + 8px 进度 + 百分比 -->
            <view v-else class="rows">
              <view
                v-for="t in g.tag3s"
                :key="t.code"
                class="row"
                :class="{ sel: selected && selected.code === t.code }"
                role="button"
                :aria-pressed="selected && selected.code === t.code ? 'true' : 'false'"
                @click="pick(g, t)"
              >
                <view class="row-main">
                  <view class="row-top">
                    <text class="row-name">{{ t.name }}</text>
                    <kg-tag v-if="t.due_mistakes" tone="bad">{{ t.due_mistakes }} 道到期</kg-tag>
                  </view>
                  <kg-progress :value="t.n ? Math.round(t.mastery * 100) : 0" :thickness="8" :module="curMod" :aria-label="t.name + ' 掌握度'" />
                </view>
                <text class="row-pct num" :class="t.level">{{ t.n ? Math.round(t.mastery * 100) + '%' : '未练' }}</text>
              </view>
            </view>
          </kg-card>
        </template>
      </kg-two-col>

      <!-- 选中考点吸底操作条 -->
      <kg-action-bar v-if="selected" layout="input" class="sheet">
        <view class="sheet-l">
          <text class="sheet-t">{{ selected.name }}</text>
          <text class="sheet-s">
            {{ selected.n ? '掌握度 ' + Math.round(selected.mastery * 100) + '% · 已练 ' + selected.n + ' 题 · 正确率 ' + Math.round(selected.acc * 100) + '%' : '还没练过，来试试' }}
            <template v-if="selected.due_mistakes"> · {{ selected.due_mistakes }} 道错题到期</template>
          </text>
        </view>
        <kg-button v-if="selected.due_mistakes" variant="ghost" size="md" @click="goReview">去复习</kg-button>
        <kg-button variant="primary" size="md" @click="goPractice(selected)">练 10 题</kg-button>
      </kg-action-bar>
    </template>

    <kg-empty-state
      v-else-if="err"
      icon="wifi-off"
      :title="err"
      cta-text="重试"
      @cta="load"
    />
    <view v-else class="skel" aria-busy="true">
      <kg-skeleton preset="hero" />
      <kg-skeleton preset="cards" />
    </view>
  </view>
</template>

<script>
import { request, snapPeek, anonUid } from '../../api.js';
import { buildMasteryUrl, parseMasteryOpts } from '../../mastery-url.js';

const LEVELS = [
  { key: 'untouched', label: '未接触' },
  { key: 'rumen', label: '入门' },
  { key: 'gonggu', label: '巩固' },
  { key: 'shulian', label: '熟练' },
  { key: 'jingtong', label: '精通' },
];
const VIEW_OPTS = [
  { label: '网格', value: 'grid' },
  { label: '列表', value: 'list' },
];

export default {
  data() {
    return { LEVELS, map: null, cold: false, nTotal: 0, need: 30, curMod: '', selected: null, selGrp: null, err: '', view: 'grid' };
  },
  computed: {
    curSubs() {
      const m = (this.map?.modules || []).find((x) => x.module === this.curMod);
      return m ? m.subs : [];
    },
    modChips() {
      return (this.map?.modules || []).map((m) => ({
        label: m.name + (m.n ? ' ' + Math.round(m.mastery * 100) + '%' : ''),
        value: m.module,
      }));
    },
    viewOpts() {
      return VIEW_OPTS.map((o) => o.label);
    },
    viewLabel() {
      return (VIEW_OPTS.find((o) => o.value === this.view) || VIEW_OPTS[0]).label;
    },
  },
  onLoad(opts) {
    this._pendingMod = parseMasteryOpts(opts).mod;
  },
  onShow() {
    this.load();
  },
  watch: {
    curMod() {
      this.syncUrl();
    },
  },
  methods: {
    async load() {
      this.err = '';
      const p = '/api/mastery/map?uid=' + encodeURIComponent(anonUid());
      // 快照即显：uid API 长尾下先用最近成功快照铺屏，真实响应到达后覆盖
      const snap = snapPeek(p);
      if (snap) this.applyMap(snap);
      try {
        this.applyMap(await request(p));
      } catch (e) {
        this.err = '加载失败：' + e.message;
      }
    },
    applyMap(d) {
      this.nTotal = d.n_total || 0;
      this.need = d.need || 30;
      if (d.cold) {
        this.cold = true;
        return;
      }
      this.cold = false;
      this.map = d;
      if (this._pendingMod && d.modules.some((x) => x.module === this._pendingMod)) {
        this.curMod = this._pendingMod;
        this._pendingMod = '';
      }
      if (!this.curMod && d.modules.length) this.curMod = d.modules[0].module;
    },
    syncUrl() {
      // #ifdef H5
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', buildMasteryUrl({ mod: this.curMod }));
      }
      // #endif
    },
    onViewChange(opt) {
      const o = VIEW_OPTS.find((x) => x.label === (opt && opt.value));
      if (o) this.view = o.value;
    },
    pick(g, t) {
      this.selected = this.selected && this.selected.code === t.code ? null : t;
      this.selGrp = g;
    },
    goPractice(t) {
      const m = (this.map?.modules || []).find((x) => x.module === this.curMod);
      uni.setStorageSync('practiceLaunch', {
        kind: 'start',
        module: t && m ? m.module : this.curMod || null,
        submodule: t && this.selGrp ? this.selGrp.submodule : null,
        tag3: t ? t.code : null,
        count: 10,
      });
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goReview() {
      uni.switchTab({ url: '/pages/book/book' });
    },
  },
};
</script>

<style scoped>
.page { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.page.has-bar { padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px)); }
.skel { display: flex; flex-direction: column; gap: var(--sp-12); }
.cold-bar { margin: var(--sp-16) 0; }

.head { display: flex; align-items: center; gap: var(--sp-16); margin-bottom: var(--card-gap); }
.head-r { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.head-t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.head-s { font-size: var(--fs-caption); color: var(--ink-2); margin: var(--sp-4) 0 var(--sp-8); }
.legend { display: flex; gap: var(--sp-4); flex-wrap: wrap; }
.lg { font-size: var(--fs-caption); line-height: var(--lh-caption); padding: 0 var(--sp-8); border-radius: var(--r-xs); }

/* 掌握度 4 级色阶：语义 soft/strong 对（深色模式随 token 反转）；无接触=中性 */
.untouched { background: var(--fill); color: var(--ink-3); }
.rumen { background: var(--bad-soft); color: var(--bad-strong); }
.gonggu { background: var(--warn-soft); color: var(--warn-strong); }
.shulian { background: var(--ok-soft); color: var(--ok-strong); }
.jingtong { background: var(--ok-strong); color: var(--on-brand); }

.side-nav { display: none; }
.tabs { margin-bottom: var(--sp-12); }
.toolbar { display: flex; justify-content: flex-end; margin-bottom: var(--sp-12); }

.grp { margin-bottom: var(--card-gap); }
.grp-h { display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-8); margin-bottom: var(--sp-12); }
.grp-name { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.grp-meta { flex-shrink: 0; font-size: var(--fs-caption); color: var(--ink-2); }

.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--sp-8); }
.tile { position: relative; min-height: var(--hit-min); border-radius: var(--r-sm); padding: var(--sp-8); box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
.tile.untouched { border: 1px dashed var(--line-strong); }
.tile.sel { outline: 2px solid var(--brand); outline-offset: 1px; }
.tile-name { font-size: var(--fs-caption); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tile-meta { font-size: var(--fs-caption); opacity: 0.85; }
.dot { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; border-radius: var(--r-full); background: var(--bad); color: var(--on-brand); font-size: var(--fs-caption); line-height: 16px; text-align: center; padding: 0 var(--sp-4); border: 2px solid var(--card); box-sizing: content-box; }

.rows { display: flex; flex-direction: column; }
.row { display: flex; align-items: center; gap: var(--sp-12); min-height: var(--hit-min); padding: var(--sp-8) 0; border-bottom: 1px solid var(--line); }
.row:last-child { border-bottom: none; }
.row.sel .row-name { color: var(--brand-text); }
.row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-4); }
.row-top { display: flex; align-items: center; gap: var(--sp-8); }
.row-name { flex: 1; min-width: 0; font-size: var(--fs-sub); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-pct { flex-shrink: 0; width: 44px; text-align: right; font-size: var(--fs-sub); font-weight: 600; background: none; }
.row-pct.untouched { color: var(--ink-3); }

.sheet-l { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.sheet-t { font-size: var(--fs-body); font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sheet-s { font-size: var(--fs-caption); color: var(--ink-2); margin-top: 2px; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .tile:hover, .row:hover, .side-item:hover { cursor: pointer; }
}
@media (min-width: 1024px) {
  .page { max-width: 1044px !important; }
  .tabs { display: none; }
  .side-nav { display: block; }
  .side-item { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); min-height: var(--hit-min); padding: 0 var(--sp-8); border-radius: var(--r-sm); }
  .side-item.on { background: var(--brand-soft); }
  .side-pct { font-size: var(--fs-caption); color: var(--ink-2); }
  .tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
/* #endif */
</style>
