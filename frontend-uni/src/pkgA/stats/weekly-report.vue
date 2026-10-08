<template>
  <view class="wrap">
    <view v-if="loading" class="skel" aria-busy="true">
      <kg-skeleton preset="hero" />
      <kg-skeleton preset="cards" />
    </view>

    <!-- 空状态 -->
    <kg-empty-state
      v-else-if="empty"
      icon="calendar"
      title="这一周没有练题记录"
      :desc="weeklyEmptyDesc(range)"
      cta-text="去刷题"
      @cta="goPractice()"
    />

    <!-- 未结束周 -->
    <kg-empty-state
      v-else-if="pending"
      icon="clock"
      title="这周还没过完"
      :desc="weeklyPendingDesc(range)"
      cta-text="查看上一周周报"
      @cta="goPrevWeek()"
    />

    <!-- 加载失败 -->
    <kg-empty-state
      v-else-if="error"
      icon="wifi-off"
      title="加载失败"
      :desc="error"
      cta-text="重试"
      @cta="reload()"
    />

    <template v-else-if="r">
      <kg-two-col aside-first>
        <template #aside>
          <!-- 1. 头部概览 -->
          <kg-hero-card variant="plain" :label="r.range" :value="r.summary.n" unit="题" class="hero">
            <kg-stat-row :items="heroStats" class="hero-stats" />
          </kg-hero-card>

          <!-- 2. 徽章 -->
          <view v-if="r.badges.length" class="badges">
            <view v-for="b in r.badges" :key="b.key" class="badge">
              <l-icon name="medal" :size="20" tone="warn" />
              <view class="badge-main">
                <text class="badge-t">{{ b.title }}</text>
                <text class="badge-s">{{ b.desc }}</text>
              </view>
            </view>
          </view>

          <!-- 3. 本周 vs 上周 -->
          <kg-card class="sec">
            <text class="h">本周 vs 上周</text>
            <view class="cmp-row"><text class="cmp-k">刷题量</text><text class="cmp-v num">{{ r.compare.n[0] }} 题</text><text class="cmp-p num">上周 {{ r.compare.n[1] }}</text></view>
            <view class="cmp-row"><text class="cmp-k">正确率</text><text class="cmp-v num">{{ pct(r.compare.acc[0]) }}%</text><text class="cmp-p num">上周 {{ pct(r.compare.acc[1]) }}%</text></view>
            <view class="cmp-row"><text class="cmp-k">学习时长</text><text class="cmp-v num">{{ mins(r.compare.secs[0]) }}</text><text class="cmp-p num">上周 {{ mins(r.compare.secs[1]) }}</text></view>
            <view class="cmp-row"><text class="cmp-k">学习天数</text><text class="cmp-v num">{{ r.compare.days[0] }} 天</text><text class="cmp-p num">上周 {{ r.compare.days[1] }} 天</text></view>
          </kg-card>
        </template>

        <template #main>
          <!-- 4. 掌握度变化 -->
          <kg-card v-if="r.mastery.up.length || r.mastery.down.length" class="sec">
            <text class="h">考点掌握变化</text>
            <view v-for="m in r.mastery.up" :key="'u' + m.submodule" class="ms-row">
              <view class="ms-tag up"><text class="ms-tag-t">↑</text></view>
              <text class="ms-t">{{ m.submodule }}</text>
              <text class="ms-v num">{{ pct(m.prev_acc) }}% → {{ pct(m.acc) }}%</text>
            </view>
            <view v-for="m in r.mastery.down" :key="'d' + m.submodule" class="ms-row">
              <view class="ms-tag down"><text class="ms-tag-t">↓</text></view>
              <text class="ms-t">{{ m.submodule }}</text>
              <text class="ms-v num">{{ pct(m.prev_acc) }}% → {{ pct(m.acc) }}%</text>
            </view>
          </kg-card>

          <!-- 5. 错因分布 -->
          <kg-card v-if="r.reasons.length" class="sec">
            <text class="h">本周错因分布</text>
            <view v-for="x in r.reasons" :key="x.reason" class="rs-row">
              <text class="rs-k">{{ x.reason }}</text>
              <view class="rs-bar"><view class="rs-fill" :style="{ width: reasonPct(x.n) + '%' }" /></view>
              <text class="rs-v num">{{ x.n }}<text class="rs-p">（上周 {{ x.prev_n }}）</text></text>
            </view>
          </kg-card>

          <!-- 6. 典型错题 -->
          <kg-card v-if="r.typical && r.typical.length" class="sec">
            <text class="h">本周典型错题</text>
            <view v-for="t in r.typical" :key="t.mid" class="tp-item">
              <view class="tp-meta">
                <kg-tag v-if="t.module" tone="brand">{{ t.module }}</kg-tag>
                <kg-tag v-if="t.tag3" tone="neutral">{{ t.tag3 }}</kg-tag>
                <text v-if="t.reason" class="tp-reason">{{ t.reason }}</text>
              </view>
              <text class="tp-stem">{{ t.stem }}</text>
            </view>
          </kg-card>

          <!-- 7. 模考回顾 -->
          <kg-card class="sec">
            <text class="h">模考回顾</text>
            <template v-if="r.mock">
              <text class="mk-line">本周模考最高 <text class="mk-n num">{{ r.mock.score }}</text> 分（共 {{ r.mock.n_exams }} 次）</text>
              <text v-if="r.mock.event_title" class="mk-line sub">{{ weeklyMockLine(r.mock) }}</text>
              <kg-button variant="text" size="md" icon="chevron-right" class="link" @click="openAttempt(r.mock.attempt_id)">查看成绩报告</kg-button>
            </template>
            <template v-else>
              <text class="mk-none">本周未模考</text>
              <kg-button v-if="nextEvent" variant="text" size="md" icon="chevron-right" class="link" @click="goContest">下一场：{{ nextEvent.title }} · {{ fmtDay(nextEvent.open_at) }}</kg-button>
            </template>
          </kg-card>

          <!-- 8. 下周计划 -->
          <kg-card v-if="r.plan || r.actions.length" class="sec">
            <text class="h">下周计划</text>
            <template v-if="r.plan">
              <view v-if="r.plan.focus && r.plan.focus.length" class="plan-focus">
                <kg-tag v-for="(f, i) in r.plan.focus" :key="i" tone="warn">攻克 {{ f }}</kg-tag>
              </view>
              <text v-if="r.plan.target_n" class="plan-target">目标：完成 {{ r.plan.target_n }} 题</text>
            </template>
            <view v-for="(a, i) in r.actions" :key="i" class="act-row" role="button" @click="goAction(a)">
              <text class="act-t">{{ a.title }}</text>
              <text class="act-go">去完成</text>
              <l-icon name="chevron-right" :size="16" tone="brand-text" />
            </view>
          </kg-card>

          <!-- 8. 分享 -->
          <kg-button variant="primary" size="lg" block icon="share-2" @click="sharing = true; buildShare()">生成分享图</kg-button>
        </template>
      </kg-two-col>

      <kg-sheet v-model="sharing" title="分享周报">
        <image v-if="shareImg" :src="shareImg" class="share-img" mode="widthFix" @longpress="saveShare" />
        <view v-else class="share-wait">
          <kg-skeleton v-if="!shareErr" preset="hero" />
          <text class="share-wait-t">{{ shareErr || '生成中…' }}</text>
        </view>
        <template v-if="shareImg" #footer>
          <kg-button variant="primary" size="lg" block icon="save" @click="saveShare">保存图片</kg-button>
        </template>
      </kg-sheet>
      <!-- #ifdef MP-WEIXIN -->
      <canvas id="weeklyCanvas" type="2d" class="hidden-canvas" />
      <!-- #endif -->
    </template>
  </view>
</template>

<script>
import { request, snapPeek, anonUid } from '../../api.js';
import { fmtDayHour } from '../../contest-time.js';
import { weeklyMockLine, weeklyEmptyDesc, weeklyPendingDesc } from '../../exam-copy.js';

const W = 660;
const H = 760;

function roundRect(ctx, x, y, w, h, rr) {
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawShare(ctx, r) {
  const g = ctx.createLinearGradient(0, 0, W * 0.7, H);
  g.addColorStop(0, '#5B8AF8');
  g.addColorStop(1, '#2C5AD6');
  roundRect(ctx, 0, 0, W, H, 36);
  ctx.fillStyle = g;
  ctx.fill();
  const pad = 44;
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '24px sans-serif';
  ctx.fillText('答岸 · 周学习报告', pad, 52);
  ctx.fillStyle = '#fff';
  ctx.font = '800 52px sans-serif';
  ctx.fillText(r.range, pad, 100);
  const stats = [
    [String(r.summary.days), '学习天数'],
    [String(r.summary.n), '刷题量'],
    [Math.round(r.summary.acc * 100) + '%', '正确率'],
    [Math.round(r.summary.secs / 60) + '分', '学习时长'],
  ];
  roundRect(ctx, pad, 200, W - pad * 2, 128, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  const cw = (W - pad * 2) / 4;
  stats.forEach(([v, l], i) => {
    const cx = pad + cw * i + cw / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '800 40px sans-serif';
    ctx.fillText(v, cx, 226);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '20px sans-serif';
    ctx.fillText(l, cx, 282);
  });
  ctx.textAlign = 'left';
  let y = 380;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '26px sans-serif';
  for (const b of r.badges.slice(0, 3)) {
    ctx.fillText('🏅 ' + b.title + ' · ' + b.desc, pad, y);
    y += 46;
  }
  if (r.mock) {
    ctx.fillText('📝 本周模考最高 ' + r.mock.score + ' 分', pad, y);
    y += 46;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '20px sans-serif';
  ctx.fillText('kaogong.zalize.com · 每周一自动生成', pad, H - 80);
}

export default {
  data() {
    return {
      loading: true,
      empty: false,
      pending: false,
      prevWeek: '',
      error: '',
      range: '',
      r: null,
      nextEvent: null,
      sharing: false,
      shareImg: '',
      shareErr: '',
    };
  },
  onLoad(opt) {
    this.week = opt.week || '';
    this.load();
  },
  methods: {
    weeklyMockLine,
    weeklyEmptyDesc,
    weeklyPendingDesc,
    pct(v) { return Math.round((v || 0) * 100); },
    mins(s) { return Math.round((s || 0) / 60) + ' 分钟'; },
    async load() {
      const p = '/api/report/weekly?uid=' + encodeURIComponent(anonUid()) + (this.week ? '&week=' + this.week : '');

      // 快照即显：uid API 长尾下先用最近成功快照铺屏，真实响应到达后覆盖
      const snap = snapPeek(p);
      if (snap) {
        this.applyReport(snap, true);
        this.loading = false;
      }

      try {
        this.applyReport(await request(p));
      } catch (e) {
        this.error = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    applyReport(d, stale) {
      this.empty = false;
      this.pending = false;
      if (d.status === 'empty') {
        this.empty = true;
        this.range = d.range || '';
      } else if (d.status === 'pending') {
        this.pending = true;
        this.range = d.range || '';
        this.prevWeek = d.prev_week || '';
      } else {
        this.r = d;
        if (!stale) {
          this.markRead(d);
          this.loadNextEvent();
        }
      }
    },
    async markRead(d) {
      try {
        const day = d.range.slice(0, 10);
        await request('/api/report/weekly/read', { method: 'POST', data: { uid: anonUid(), week: day } });
        uni.setStorageSync('weeklyReadWs', d.week_start);
      } catch (e) { /* 非关键路径 */ }
    },
    async loadNextEvent() {
      try {
        const d = await request('/api/report/weekly/next_event');
        this.nextEvent = d.event;
      } catch (e) { /* 非关键路径 */ }
    },
    reasonPct(n) {
      const max = Math.max(...this.r.reasons.map((x) => x.n), 1);
      return Math.max(6, (n / max) * 100);
    },
    trend() {
      const [cur, prev] = this.r.compare.acc;
      if (!this.r.prev.n) return 'new';
      if (cur > prev + 0.01) return 'up';
      if (cur < prev - 0.01) return 'down';
      return 'flat';
    },
    reload() {
      this.loading = true;
      this.empty = false;
      this.pending = false;
      this.error = '';
      this.load();
    },
    goPrevWeek() {
      this.week = this.prevWeek;
      this.reload();
    },
    goPractice() {
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goContest() {
      uni.navigateTo({ url: '/pkgA/exam/contest' });
    },
    openAttempt(aid) {
      uni.navigateTo({ url: '/pkgA/exam/report?attempt_id=' + aid });
    },
    goAction(a) {
      if (a.type === 'review') {
        uni.switchTab({ url: '/pages/book/book' });
      } else if (a.type === 'mock') {
        this.goContest();
      } else {
        const m = /tag3=([^&]+)/.exec(a.url || '');
        uni.setStorageSync('practiceLaunch', {
          kind: 'start',
          tag3: m ? decodeURIComponent(m[1]) : null,
          module: (/module=([^&]+)/.exec(a.url || '') || [])[1] || null,
          submodule: decodeURIComponent((/submodule=([^&]+)/.exec(a.url || '') || [])[1] || '') || null,
          adaptive: true,
        });
        uni.navigateTo({ url: '/pages/practice/practice' });
      }
    },
    fmtDay(t) {
      return fmtDayHour(t);
    },
    async buildShare() {
      if (this.shareImg) return;
      try {
        // #ifdef H5
        const dpr = Math.min(window.devicePixelRatio || 2, 3);
        const canvas = document.createElement('canvas');
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        drawShare(ctx, this.r);
        this.shareImg = canvas.toDataURL('image/png');
        // #endif
        // #ifdef MP-WEIXIN
        const node = await new Promise((resolve, reject) => {
          uni.createSelectorQuery()
            .in(this)
            .select('#weeklyCanvas')
            .fields({ node: true, size: true })
            .exec((res) => (res && res[0] && res[0].node ? resolve(res[0].node) : reject(new Error('canvas 不可用'))));
        });
        const dpr = uni.getSystemInfoSync().pixelRatio || 2;
        node.width = W * dpr;
        node.height = H * dpr;
        const ctx = node.getContext('2d');
        ctx.scale(dpr, dpr);
        drawShare(ctx, this.r);
        this.shareImg = await new Promise((resolve, reject) => {
          uni.canvasToTempFilePath({
            canvas: node,
            success: (res) => resolve(res.tempFilePath),
            fail: (e) => reject(new Error(e.errMsg || '导出失败')),
          }, this);
        });
        // #endif
      } catch (e) {
        this.shareErr = e.message;
      }
    },
    saveShare() {
      if (!this.shareImg) return;
      // #ifdef H5
      const a = document.createElement('a');
      a.href = this.shareImg;
      a.download = 'weekly-report.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      uni.showToast({ title: '已保存图片', icon: 'none' });
      // #endif
      // #ifdef MP-WEIXIN
      uni.saveImageToPhotosAlbum({
        filePath: this.shareImg,
        success: () => uni.showToast({ title: '已保存到相册', icon: 'none' }),
        fail: () => uni.showToast({ title: '保存失败', icon: 'none' }),
      });
      // #endif
    },
  },
  computed: {
    trendIcon() {
      return { up: '↑ 进步', down: '↓ 回落', flat: '→ 持平', new: '✦ 新开始' }[this.trend()];
    },
    heroStats() {
      const t = this.trend();
      return [
        { label: '学习天数', value: this.r.summary.days },
        { label: '正确率', value: this.pct(this.r.summary.acc) + '%', tone: 'brand' },
        { label: '较上周', value: this.trendIcon, tone: t === 'up' ? 'ok' : t === 'down' ? 'bad' : undefined },
      ];
    },
  },
};
</script>

<style scoped>
.wrap { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.skel { display: flex; flex-direction: column; gap: var(--sp-12); }
.hero { margin-bottom: var(--card-gap); }
.hero-stats { margin-top: var(--sp-12); }
.sec { margin-bottom: var(--card-gap); }
.h { display: block; font-size: var(--fs-h3); font-weight: 600; color: var(--ink); margin-bottom: var(--sp-12); }
.badges { display: flex; flex-direction: column; gap: var(--sp-8); margin-bottom: var(--card-gap); }
.badge { display: flex; align-items: center; gap: var(--sp-12); background: var(--warn-soft); border-radius: var(--r-md); padding: var(--sp-12) var(--sp-16); min-height: var(--hit-min); }
.badge-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.badge-t { font-size: var(--fs-body); font-weight: 600; color: var(--warn-strong); }
.badge-s { font-size: var(--fs-caption); color: var(--warn-strong); margin-top: 2px; }
.cmp-row { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); border-bottom: 1px solid var(--line); }
.cmp-row:last-child { border-bottom: none; }
.cmp-k { flex-shrink: 0; width: 72px; font-size: var(--fs-sub); color: var(--ink-2); }
.cmp-v { flex: 1; font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.cmp-p { flex-shrink: 0; font-size: var(--fs-caption); color: var(--ink-3); }
.ms-row { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); }
.ms-tag { flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: var(--r-full); }
.ms-tag-t { font-size: var(--fs-caption); font-weight: 600; line-height: 1; }
.ms-tag.up { background: var(--ok-soft); color: var(--ok-strong); }
.ms-tag.down { background: var(--bad-soft); color: var(--bad-strong); }
.ms-t { flex: 1; min-width: 0; font-size: var(--fs-sub); color: var(--ink); }
.ms-v { flex-shrink: 0; font-size: var(--fs-caption); color: var(--ink-2); }
.rs-row { display: flex; align-items: center; gap: var(--sp-8); min-height: var(--hit-min); }
.rs-k { flex-shrink: 0; width: 72px; font-size: var(--fs-caption); color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rs-bar { flex: 1; height: 8px; background: var(--bad-soft); border-radius: var(--r-full); overflow: hidden; }
.rs-fill { height: 100%; background: var(--bad); border-radius: var(--r-full); }
.rs-v { flex-shrink: 0; font-size: var(--fs-sub); font-weight: 600; color: var(--ink); }
.rs-p { font-size: var(--fs-caption); color: var(--ink-3); font-weight: 400; }
.mk-line { display: block; font-size: var(--fs-body); color: var(--ink); margin-bottom: var(--sp-8); }
.mk-line.sub { font-size: var(--fs-sub); color: var(--ink-2); }
.mk-n { font-size: var(--fs-h2); font-weight: 600; color: var(--brand-text); }
.mk-none { display: block; font-size: var(--fs-sub); color: var(--ink-2); margin-bottom: var(--sp-8); }
.link { align-self: flex-start; }
.act-row { display: flex; align-items: center; gap: var(--sp-4); min-height: var(--hit-min); border-bottom: 1px solid var(--line); }
.act-row:last-child { border-bottom: none; }
.act-t { flex: 1; min-width: 0; font-size: var(--fs-sub); color: var(--ink); }
.act-go { flex-shrink: 0; font-size: var(--fs-sub); color: var(--brand-text); font-weight: 600; }
.tp-item { padding: var(--sp-8) 0; border-top: 1px solid var(--line); }
.tp-item:first-of-type { border-top: none; }
.tp-meta { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-4); }
.tp-reason { font-size: var(--fs-caption); color: var(--warn); }
.tp-stem { display: block; margin-top: var(--sp-4); font-size: var(--fs-sub); line-height: var(--lh-body); color: var(--ink-2); }
.plan-focus { display: flex; flex-wrap: wrap; gap: var(--sp-8); margin-top: var(--sp-4); }
.plan-target { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); color: var(--ink-3); }
.share-img { width: 100%; border-radius: var(--r-md); }
.share-wait { display: flex; flex-direction: column; align-items: center; gap: var(--sp-12); padding: var(--sp-16) 0; }
.share-wait-t { font-size: var(--fs-sub); color: var(--ink-2); }
.hidden-canvas { position: fixed; left: -9999px; top: 0; width: 660px; height: 760px; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .act-row:hover { cursor: pointer; }
}
@media (min-width: 1024px) {
  .wrap { max-width: 1044px !important; }
}
/* #endif */
</style>
