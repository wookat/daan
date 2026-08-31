<template>
  <view class="page">
    <!-- 冷启动 -->
    <view v-if="cold" class="card cold">
      <view class="cold-t">再练 {{ Math.max(0, need - nTotal) }} 题解锁掌握度地图</view>
      <view class="cold-s">累计作答 {{ nTotal }}/{{ need }} 题后，按三级考点展示你的掌握度色阶</view>
      <view class="cold-bar"><view class="cold-fill" :style="{ width: Math.min(100, (nTotal / need) * 100) + '%' }" /></view>
      <button class="btn" @click="goPractice()">去刷题</button>
    </view>

    <template v-else-if="map">
      <!-- 桌面侧栏模块导航（≥1024px 显示，与横向 tab 同状态） -->
      <view class="side-nav">
        <view v-for="m in map.modules" :key="'s-' + m.module" class="side-item" :class="{ on: curMod === m.module }" @click="curMod = m.module">
          <text class="side-name">{{ m.name }}</text>
          <text class="side-pct">{{ m.n ? Math.round(m.mastery * 100) + '%' : '未练' }}</text>
        </view>
      </view>

      <view class="main-col">
      <!-- 覆盖度总览 -->
      <view class="card head">
        <view class="cov-ring" :style="covStyle">
          <view class="cov-in">
            <text class="cov-n">{{ map.coverage.pct }}%</text>
            <text class="cov-t">覆盖度</text>
          </view>
        </view>
        <view class="head-r">
          <view class="head-t">考点掌握度地图</view>
          <view class="head-s">已练 {{ map.coverage.practiced }}/{{ map.coverage.total }} 个考点 · 累计 {{ map.n_total }} 题</view>
          <view class="legend">
            <text class="lg untouched">未接触</text>
            <text class="lg rumen">入门</text>
            <text class="lg gonggu">巩固</text>
            <text class="lg shulian">熟练</text>
            <text class="lg jingtong">精通</text>
          </view>
        </view>
      </view>

      <!-- 模块 tab -->
      <scroll-view scroll-x class="tabs">
        <view v-for="m in map.modules" :key="m.module" class="tab" :class="{ on: curMod === m.module }" @click="curMod = m.module">
          <text>{{ m.name }}</text>
          <text class="tab-pct">{{ Math.round(m.mastery * 100) }}%</text>
        </view>
      </scroll-view>

      <!-- 二级题型卡 + 三级考点色格 -->
      <view v-for="g in curSubs" :key="g.code" class="card grp">
        <view class="grp-h">
          <text class="grp-name">{{ g.submodule }}</text>
          <text class="grp-meta">{{ g.n ? Math.round(g.mastery * 100) + '% · ' + g.n + ' 题' : '未练习' }}</text>
        </view>
        <view class="tiles">
          <view
            v-for="t in g.tag3s"
            :key="t.code"
            class="tile"
            :class="[t.level, { sel: selected && selected.code === t.code }]"
            @click="pick(g, t)"
          >
            <text class="tile-name">{{ t.name }}</text>
            <text class="tile-meta">{{ t.n ? Math.round(t.mastery * 100) + '%' : '未练' }}</text>
            <view v-if="t.due_mistakes" class="dot">{{ t.due_mistakes > 9 ? '9+' : t.due_mistakes }}</view>
          </view>
        </view>
      </view>

      <view class="safe-pad" />
      </view>

      <!-- 选中考点吸底操作条 -->
      <view v-if="selected" class="sheet">
        <view class="sheet-l">
          <view class="sheet-t">{{ selected.name }}</view>
          <view class="sheet-s">
            {{ selected.n ? '掌握度 ' + Math.round(selected.mastery * 100) + '% · 已练 ' + selected.n + ' 题 · 正确率 ' + Math.round(selected.acc * 100) + '%' : '还没练过，来试试' }}
            <template v-if="selected.due_mistakes"> · {{ selected.due_mistakes }} 道错题到期</template>
          </view>
        </view>
        <button v-if="selected.due_mistakes" class="s-btn ghost" @click="goReview">去复习</button>
        <button class="s-btn" @click="goPractice(selected)">练 10 题</button>
      </view>
    </template>

    <view v-else class="card cold"><view class="cold-s">{{ err || '加载中…' }}</view></view>
  </view>
</template>

<script>
import { request, anonUid } from '../../api.js';

export default {
  data() {
    return { map: null, cold: false, nTotal: 0, need: 30, curMod: '', selected: null, selGrp: null, err: '' };
  },
  computed: {
    curSubs() {
      const m = (this.map?.modules || []).find((x) => x.module === this.curMod);
      return m ? m.subs : [];
    },
    covStyle() {
      const pct = this.map ? this.map.coverage.pct : 0;
      return { background: `conic-gradient(#2e5bff 0% ${pct}%, #e8ecf5 ${pct}% 100%)` };
    },
  },
  onShow() {
    this.load();
  },
  methods: {
    async load() {
      try {
        const d = await request('/api/mastery/map?uid=' + encodeURIComponent(anonUid()));
        this.nTotal = d.n_total || 0;
        this.need = d.need || 30;
        if (d.cold) {
          this.cold = true;
          return;
        }
        this.cold = false;
        this.map = d;
        if (!this.curMod && d.modules.length) this.curMod = d.modules[0].module;
      } catch (e) {
        this.err = '加载失败：' + e.message;
      }
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
.page {
  padding: 24rpx;
}
.card {
  background: var(--card, #fff);
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
}
.cold {
  text-align: center;
  padding: 60rpx 40rpx;
}
.cold-t {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--ink, #17181c);
}
.cold-s {
  font-size: 24rpx;
  color: var(--ink-2, #5f6575);
  margin-top: 12rpx;
}
.cold-bar {
  height: 14rpx;
  background: #eef1f7;
  border-radius: 999rpx;
  margin: 28rpx 0;
  overflow: hidden;
}
.cold-fill {
  height: 100%;
  background: #2e5bff;
  border-radius: 999rpx;
}
.btn {
  background: #2e5bff;
  color: #fff;
  border-radius: 999rpx;
  font-size: 28rpx;
  margin-top: 8rpx;
}
.head {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.cov-ring {
  width: 132rpx;
  height: 132rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cov-in {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: var(--card, #fff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.cov-n {
  font-size: 28rpx;
  font-weight: 700;
  color: #2e5bff;
}
.cov-t {
  font-size: 18rpx;
  color: var(--ink-2, #5f6575);
}
.head-t {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--ink, #17181c);
}
.head-s {
  font-size: 22rpx;
  color: var(--ink-2, #5f6575);
  margin: 6rpx 0 10rpx;
}
.legend {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
}
.lg {
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  color: #fff;
}
.lg.untouched {
  background: #e5e7eb;
  color: #6b7280;
}
.lg.rumen {
  background: #f87171;
}
.lg.gonggu {
  background: #fbbf24;
}
.lg.shulian {
  background: #34d399;
}
.lg.jingtong {
  background: #059669;
}
.tabs {
  white-space: nowrap;
  margin-bottom: 20rpx;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 26rpx;
  background: var(--card, #fff);
  border-radius: 999rpx;
  margin-right: 14rpx;
  font-size: 26rpx;
  color: #4b5163;
}
.tab.on {
  background: #2e5bff;
  color: #fff;
}
.tab-pct {
  font-size: 20rpx;
  opacity: 0.75;
}
.grp-h {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 18rpx;
}
.grp-name {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--ink, #17181c);
}
.grp-meta {
  font-size: 22rpx;
  color: var(--ink-2, #5f6575);
}
.tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}
.tile {
  position: relative;
  width: calc(33.33% - 10rpx);
  border-radius: 14rpx;
  padding: 16rpx 12rpx;
  box-sizing: border-box;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.tile.untouched {
  background: #f3f4f6;
  border: 2rpx dashed #d1d5db;
  color: #6b7280;
}
.tile.rumen {
  background: #f87171;
}
.tile.gonggu {
  background: #fbbf24;
}
.tile.shulian {
  background: #34d399;
}
.tile.jingtong {
  background: #059669;
}
.tile.sel {
  outline: 4rpx solid #2e5bff;
}
.tile-name {
  font-size: 22rpx;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tile-meta {
  font-size: 18rpx;
  opacity: 0.85;
}
.dot {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  min-width: 30rpx;
  height: 30rpx;
  border-radius: 999rpx;
  background: #ef4444;
  color: #fff;
  font-size: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6rpx;
  border: 3rpx solid #fff;
}
.safe-pad {
  height: 160rpx;
}
.sheet {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: var(--card, #fff);
  border-radius: 20rpx;
  padding: 22rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  box-shadow: 0 8rpx 40rpx rgba(20, 30, 60, 0.16);
}
.sheet-l {
  flex: 1;
  min-width: 0;
}
.sheet-t {
  font-size: 28rpx;
  font-weight: 700;
}
.sheet-s {
  font-size: 20rpx;
  color: var(--ink-2, #5f6575);
  margin-top: 4rpx;
}
.s-btn {
  background: #2e5bff;
  color: #fff;
  border-radius: 999rpx;
  font-size: 24rpx;
  padding: 0 28rpx;
  height: 64rpx;
  line-height: 64rpx;
  margin: 0;
  flex-shrink: 0;
}
.s-btn.ghost {
  background: #eef3ff;
  color: #2e5bff;
}
.side-nav {
  display: none;
}
/* #ifdef H5 */
@media (min-width: 1024px) {
  .page {
    display: flex;
    align-items: flex-start;
    gap: 20px;
  }
  .side-nav {
    display: block;
    width: 220px;
    flex-shrink: 0;
    position: sticky;
    top: 16px;
    background: var(--card, #fff);
    border-radius: 12px;
    padding: 8px;
  }
  .side-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    border-radius: 8px;
    cursor: pointer;
    color: #4b5163;
    font-size: 14px;
  }
  .side-item:hover {
    background: #f2f5fc;
  }
  .side-item.on {
    background: #2e5bff;
    color: #fff;
  }
  .side-pct {
    font-size: 12px;
    opacity: 0.75;
  }
  .main-col {
    flex: 1;
    min-width: 0;
  }
  .tabs {
    display: none;
  }
  .tiles {
    gap: 10px;
  }
  .tile {
    width: calc(20% - 8px);
    cursor: pointer;
    transition: filter 0.15s, transform 0.15s;
  }
  .tile:hover {
    filter: brightness(1.06);
    transform: translateY(-1px);
  }
  .cold {
    max-width: 560px;
    margin: 40px auto;
  }
  .cold .btn {
    display: inline-block;
    padding: 0 40px;
  }
  .sheet {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: 720px;
    max-width: calc(100vw - 48px);
  }
  .s-btn {
    cursor: pointer;
  }
}
/* #endif */
</style>
