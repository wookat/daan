<template>
  <view class="page">
    <view class="seg">
      <text class="seg-i" :class="{ on: tab === 'q' }" @click="tapQ">真题题库</text>
      <text class="seg-i" :class="{ on: tab === 'm' }" @click="tapMat">素材/范文</text>
      <text class="seg-i" :class="{ on: tab === 'r' }" @click="tapRec">作答记录</text>
    </view>

    <template v-if="tab === 'q' && !detail">
      <view class="fltbar">
        <text v-if="paper" class="chip on" role="button" :aria-label="'清除套卷筛选：' + paper" @click="clearPaper">{{ paper }} ✕</text>
        <text class="chip" :class="{ on: !!region }" @click="fltOpen = true">{{ region || '地区' }} ▾</text>
        <text class="chip" :class="{ on: !!year }" @click="fltOpen = true">{{ year || '年份' }} ▾</text>
        <text class="chip" :class="{ on: qtype !== '全部' }" @click="fltOpen = true">{{ qtype === '全部' ? '题型' : qtype }} ▾</text>
        <view class="chip fav" :class="{ on: qFavOnly }" @click="toggleQFavOnly"><l-icon name="star" :size="13" :color="qFavOnly ? '#b45309' : '#8a90a0'" :fill="qFavOnly ? '#f59e0b' : 'none'" /><text>收藏{{ qFavIds.length ? ' ' + qFavIds.length : '' }}</text></view>
        <view class="grow"></view>
        <text class="chip clr" @click="clearFlt">重置</text>
      </view>
      <view v-if="fltOpen" class="mask" @click="fltOpen = false">
        <view class="sheet" @click.stop>
          <view class="sheet-h"><text class="sheet-t">筛选</text><view class="sheet-x" role="button" aria-label="关闭" @click="fltOpen = false"><l-icon name="x" :size="20" color="#6b7280" /></view></view>
          <view class="sheet-k">题型</view>
          <view class="chips">
            <text v-for="t in QTYPES" :key="t" class="chip sm" :class="{ on: qtype === t }" @click="setQtype(t)">{{ t }}</text>
          </view>
          <view v-if="years.length" class="sheet-k">年份</view>
          <view v-if="years.length" class="chips">
            <text class="chip sm" :class="{ on: !year }" @click="setYear(0)">全部</text>
            <text v-for="y in years" :key="y" class="chip sm" :class="{ on: year === y }" @click="setYear(y)">{{ y }}</text>
          </view>
          <view v-if="regions.length" class="sheet-k">地区</view>
          <view v-if="regions.length" class="chips">
            <text class="chip sm" :class="{ on: !region }" @click="setRegion('')">全部</text>
            <text v-for="r in regions" :key="r" class="chip sm" :class="{ on: region === r }" @click="setRegion(r)">{{ r }}</text>
          </view>
          <view class="sheet-foot">
            <view class="sf-btn ghost" @click="clearFlt">重置</view>
            <view class="sf-btn" @click="fltOpen = false">查看 {{ qTotal }} 道题</view>
          </view>
        </view>
      </view>
      <view v-if="loading" class="spin">加载中…</view>
      <view v-else-if="qErr" class="spin">加载失败：{{ qErr }}<view class="retry" @click="loadQs()">重试 ›</view></view>
      <view v-else-if="!shownQs.length" class="spin">{{ qFavOnly ? '还没有收藏真题，点题目右上星标收藏' : '暂无题目，敬请期待' }}</view>
      <view class="qgrid">
      <view v-for="q in shownQs" :key="q.id" class="card q-item" @click="openQ(q.id)">
        <view class="q-top">
          <view class="q-tags">
            <text class="q-type">{{ q.qtype }}</text>
            <text v-if="q.paper" class="q-paper tappable" role="button" :aria-label="'只看本套卷：' + q.paper" @click.stop="applyPaper(q.paper)">{{ q.paper }}</text>
            <text v-else class="q-paper">{{ q.exam_year + ' · ' + (q.exam_region || '') }}</text>
          </view>
          <view class="m-star" :class="{ on: qFavIds.includes(q.id) }" @click.stop="toggleQFav(q)"><l-icon name="star" :size="17" :color="qFavIds.includes(q.id) ? '#f59e0b' : '#8a90a0'" :fill="qFavIds.includes(q.id) ? '#f59e0b' : 'none'" /></view>
        </view>
        <text class="q-text">{{ q.question }}</text>
        <view class="q-foot">
          <text class="q-meta">{{ qMeta(q.question) }}</text>
          <text class="q-go" @click.stop="openQ(q.id)">去作答 ›</text>
        </view>
      </view>
      </view>
      <view v-if="!qFavOnly && !qEnd && qs.length >= 20" class="more" @click="loadMore">加载更多</view>
    </template>

    <template v-if="tab === 'q' && detail">
      <view class="back" @click="detail = null">‹ 返回列表</view>
      <view class="card">
        <view class="d-cols">
        <view class="d-left">
        <view class="q-top">
          <text class="q-paper">{{ detail.paper || (detail.exam_year + ' · ' + (detail.exam_region || '')) }}</text>
          <view class="q-top-r">
            <text class="q-type">{{ detail.qtype }}</text>
            <view class="m-star" :class="{ on: qFavIds.includes(detail.id) }" role="button" :aria-label="qFavIds.includes(detail.id) ? '取消收藏本题' : '收藏本题'" @click="toggleQFav(detail)"><l-icon name="star" :size="17" :color="qFavIds.includes(detail.id) ? '#f59e0b' : '#8a90a0'" :fill="qFavIds.includes(detail.id) ? '#f59e0b' : 'none'" /></view>
            <text class="d-copy" role="button" aria-label="复制本题链接" @click="copyQLink">复制本题链接</text>
          </view>
        </view>
        <view class="d-h">作答要求</view>
        <text class="d-q">{{ detail.question }}</text>
        <view class="d-h toggle" @click="showMat = !showMat">给定资料 {{ showMat ? '▲' : '▼' }}</view>
        <text v-if="showMat" class="d-mat">{{ detail.material }}</text>
        </view>
        <view class="d-right">
        <view class="d-ans-h"><view class="d-h" style="margin: 0">我的作答</view><text v-if="qWordLim" class="d-save d-wc" :class="qWordSt">{{ myAnswer ? (myAnswer.length + ' / 限' + qWordLim.label + (qWordSt === 'over' ? '，已超 ' + (myAnswer.length - qWordLim.max) + ' 字' : '')) : '限' + qWordLim.label }}</text><text v-else-if="myAnswer" class="d-save">已自动保存 · {{ myAnswer.length }} 字</text></view>
        <textarea v-model="myAnswer" class="d-ta" :maxlength="3000" placeholder="在此作答后点击下方按钮，AI 按采分点批改（大作文为结构点评+参考档位）。草稿自动保存，换设备可续写" auto-height @input="saveDraft" />
        <view class="grade-btn" :class="{ dis: grading || !myAnswer.trim() }" @click="grade">{{ grading ? 'AI 批改中…' : '提交 AI 批改' }}</view>
        <view v-if="gradeResult" class="d-grade">
          <view class="d-h">批改结果<text class="g-note">（AI 参考，非官方评分）</text></view>
          <text class="g-body">{{ gradeResult }}</text>
        </view>
        <view v-if="history.length" class="d-h toggle" @click="showHist = !showHist">历史作答（{{ history.length }}） {{ showHist ? '▲' : '▼' }}</view>
        <view v-if="showHist">
          <view v-for="h in history" :key="h.id" class="hist-item">
            <text class="hist-time">{{ fmtTime(h.created_at) }}</text>
            <text class="hist-ans">{{ h.answer }}</text>
            <text v-if="h.result" class="hist-res">{{ h.result }}</text>
          </view>
        </view>
        <view class="d-h toggle ref" @click="showRef = !showRef">{{ showRef ? '收起参考要点 ▲' : '写完再看 · 参考要点 ▼' }}</view>
        <text v-if="showRef" class="d-ref">{{ detail.reference }}</text>
        <text v-if="showRef && detail.notes" class="d-notes">{{ detail.notes }}</text>
        </view>
        </view>
        <view v-if="qNav.idx >= 0 && qNav.total > 1" class="d-nav">
          <text class="d-nav-btn" :class="{ dis: !qNav.prevId }" role="button" aria-label="上一题" :aria-disabled="!qNav.prevId" @click="qNav.prevId && openQ(qNav.prevId)">‹ 上一题</text>
          <text class="d-nav-pos">{{ qNav.idx + 1 }} / {{ qNav.total }}</text>
          <text class="d-nav-btn" :class="{ dis: !qNav.nextId }" role="button" aria-label="下一题" :aria-disabled="!qNav.nextId" @click="qNav.nextId && openQ(qNav.nextId)">下一题 ›</text>
        </view>
      </view>
    </template>

    <template v-if="tab === 'm'">
      <view class="chips">
        <text v-for="t in MTYPES" :key="t" class="chip" :class="{ on: mtype === t && !favOnly }" @click="setMtype(t)">{{ t }}</text>
        <view class="chip fav" :class="{ on: favOnly }" @click="toggleFavOnly"><l-icon name="star" :size="13" :color="favOnly ? '#b45309' : '#8a90a0'" :fill="favOnly ? '#f59e0b' : 'none'" /><text>收藏{{ favIds.length ? ' ' + favIds.length : '' }}</text></view>
      </view>
      <view v-if="loading" class="spin">加载中…</view>
      <view v-else-if="mErr" class="spin">加载失败：{{ mErr }}<view class="retry" @click="loadMats()">重试 ›</view></view>
      <view v-else-if="!shownMats.length" class="spin">{{ favOnly ? '还没有收藏素材，点素材右上星标收藏' : '暂无素材，敬请期待' }}</view>
      <view class="mgrid">
      <view v-for="m in shownMats" :key="m.id" class="card m-item">
        <view class="q-top">
          <text class="m-topic">{{ m.topic }}<text v-if="m.id === hitMid" class="m-hit">搜索命中</text></text>
          <view class="q-top-r">
            <text class="q-type">{{ m.type }}</text>
            <view class="m-star" :class="{ on: favIds.includes(m.id) }" @click="toggleFav(m)"><l-icon name="star" :size="17" :color="favIds.includes(m.id) ? '#f59e0b' : '#8a90a0'" :fill="favIds.includes(m.id) ? '#f59e0b' : 'none'" /></view>
          </view>
        </view>
        <text class="m-content" :class="{ clamp: expanded !== m.id }" @click="expanded = expanded === m.id ? 0 : m.id">{{ m.content }}</text>
        <view class="m-foot">
          <text v-if="m.source" class="m-src">出处：{{ m.source }}</text>
          <text class="d-copy" role="button" :aria-label="'复制素材链接：' + m.topic" @click="copyMatLink(m)">复制链接</text>
        </view>
      </view>
      </view>
      <view v-if="!favOnly && !mEnd && mats.length >= 20" class="more" @click="loadMoreMat">加载更多</view>
    </template>

    <template v-if="tab === 'r'">
      <view v-if="recLoading" class="spin">加载中…</view>
      <view v-else-if="rErr" class="spin">加载失败：{{ rErr }}<view class="retry" @click="loadRecs()">重试 ›</view></view>
      <view v-else-if="!recs.length" class="spin">还没有作答记录，去题库作答并 AI 批改后会自动保存</view>
      <view class="rgrid">
      <view v-for="r in recs" :key="r.id" class="card">
        <view class="q-top">
          <text class="hist-time">{{ fmtTime(r.created_at) }}</text>
          <text class="q-type">{{ r.qtype || '申论' }}</text>
        </view>
        <text class="q-text" @click="openQ(r.qid); tab = 'q'">{{ r.question || '（题目已下线）' }}</text>
        <text class="m-content" :class="{ clamp: expanded !== 'r' + r.id }" @click="expanded = expanded === 'r' + r.id ? 0 : 'r' + r.id">{{ '【我的作答】\n' + r.answer + (r.result ? '\n\n【批改结果】\n' + r.result : '') }}</text>
      </view>
      </view>
    </template>
  </view>
</template>

<script>
import { request, snapPeek, hasAccessCode, fetchAccessInfo, promptAccessCode } from '../../api';
import { buildShenlunUrl, buildShenlunFilterUrl, buildShenlunTabUrl, buildShenlunMatUrl } from '../../shenlun-url.js';
import { toggleQFav as qfavToggle, missingSnapIds, mergeQFavSync } from '../../shenlun-qfav.js';
import { qNavState } from '../../shenlun-qnav.js';
import { parseWordLimit, wordState } from '../../shenlun-words.js';
import { adoptServerDraft } from '../../shenlun-draft.js';

const QTYPES = ['全部', '归纳概括', '综合分析', '提出对策', '贯彻执行', '大作文'];
const MTYPES = ['全部', '金句', '案例', '政策理论', '范文'];

export default {
  data() {
    return {
      QTYPES,
      MTYPES,
      tab: 'q',
      qtype: '全部',
      mtype: '全部',
      qs: [],
      mats: [],
      detail: null,
      showMat: true,
      showRef: false,
      expanded: 0,
      loading: false,
      qErr: '',
      mErr: '',
      rErr: '',
      myAnswer: '',
      grading: false,
      gradeResult: '',
      history: [],
      showHist: false,
      recs: [],
      recLoading: false,
      pinMid: 0,
      hitMid: 0,
      favOnly: false,
      favIds: uni.getStorageSync('slMatFavIds') || [],
      favMats: uni.getStorageSync('slMatFavs') || [],
      favSynced: false,
      qOffset: 0,
      mOffset: 0,
      qEnd: false,
      mEnd: false,
      qTotal: 0,
      qFavIds: uni.getStorageSync('slQFavIds') || [],
      qFavs: uni.getStorageSync('slQFavs') || [],
      qFavOnly: false,
      years: [],
      regions: [],
      year: 0,
      region: '',
      paper: '',
      fltOpen: false,
    };
  },
  watch: {
    detail(v) {
      // #ifdef H5
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', v && v.id ? buildShenlunUrl(v.id) : this.filterUrl());
      }
      // #endif
    },
  },
  computed: {
    shownMats() {
      return this.favOnly ? this.favMats : this.mats;
    },
    shownQs() {
      return this.qFavOnly ? this.qFavs : this.qs;
    },
    fltCount() {
      return (this.year ? 1 : 0) + (this.region ? 1 : 0);
    },
    qNav() {
      return qNavState(this.shownQs.map((q) => q && q.id), this.detail ? this.detail.id : 0);
    },
    qWordLim() {
      return this.detail ? parseWordLimit(this.detail.question) : null;
    },
    qWordSt() {
      return wordState(this.myAnswer.length, this.qWordLim);
    },
  },
  onShow() {
    // #ifdef H5
    if (!this._slKeyHandler && typeof window !== 'undefined') {
      this._slKeyHandler = (e) => this.onSlKeydown(e);
      window.addEventListener('keydown', this._slKeyHandler);
    }
    // #endif
  },
  onHide() {
    // #ifdef H5
    if (this._slKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._slKeyHandler);
      this._slKeyHandler = null;
    }
    // #endif
  },
  onUnload() {
    // #ifdef H5
    if (this._slKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._slKeyHandler);
      this._slKeyHandler = null;
    }
    // #endif
  },
  onLoad(opts) {
    if (opts && typeof opts.paper === 'string' && opts.paper && opts.paper.length <= 100) this.paper = opts.paper;
    this.loadQs();
    this.loadFilters().then(() => {
      if (!opts) return;
      const y = Number(opts.year || '');
      if (this.years.includes(y)) this.setYear(y);
      if (this.regions.includes(opts.region || '')) this.setRegion(opts.region);
    });
    if (opts && opts.tab === 'r') this.switchRec();
    else if (opts && opts.tab === 'm') {
      if (MTYPES.includes(opts.mtype || '')) this.mtype = opts.mtype;
      if (/^\d+$/.test(opts.mid || '')) this.pinMid = Number(opts.mid);
      else if (opts.fav === '1') this.favOnly = true;
      this.switchMat();
    }
    if (opts && QTYPES.includes(opts.qtype || '')) this.setQtype(opts.qtype);
    if (opts && (!opts.tab || opts.tab === 'q') && opts.fav === '1') this.enterQFavView();
    if (opts && /^\d+$/.test(opts.id || '')) this.openQ(Number(opts.id));
    this.syncQFavs();
  },
  methods: {
    async loadQs(append) {
      this.loading = !append;
      this.qErr = '';
      try {
        const t = this.qtype === '全部' ? '' : '&qtype=' + encodeURIComponent(this.qtype);
        const y = this.year ? '&year=' + this.year : '';
        const rg = this.region ? '&region=' + encodeURIComponent(this.region) : '';
        const pp = this.paper ? '&paper=' + encodeURIComponent(this.paper) : '';
        const d = await request('/api/shenlun/questions?limit=20&offset=' + this.qOffset + t + y + rg + pp);
        const items = d.items || [];
        this.qEnd = items.length < 20;
        this.qTotal = d.total || items.length;
        this.qs = append ? this.qs.concat(items) : items;
      } catch (e) {
        this.qErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async loadMats(append) {
      this.loading = !append;
      this.mErr = '';
      try {
        const t = this.mtype === '全部' ? '' : '&type=' + encodeURIComponent(this.mtype);
        const d = await request('/api/shenlun/materials?limit=20&offset=' + this.mOffset + t);
        const items = d.items || [];
        this.mEnd = items.length < 20;
        this.mats = append ? this.mats.concat(items) : items;
        if (!append && this.pinMid) {
          const midv = this.pinMid;
          this.pinMid = 0;
          let hit = this.mats.find((m) => m.id === midv);
          if (!hit) {
            try {
              const r = await request('/api/shenlun/materials?id=' + midv);
              hit = (r.items || [])[0];
            } catch (e2) {
              /* 深链命中拉取失败不阻断列表 */
            }
          }
          if (hit) {
            this.mats = [hit].concat(this.mats.filter((m) => m.id !== midv));
            this.hitMid = midv;
            this.expanded = midv;
          }
        }
      } catch (e) {
        this.mErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.loading = false;
    },
    async loadFilters() {
      try {
        const d = await request('/api/shenlun/filters');
        this.years = d.years || [];
        this.regions = d.regions || [];
      } catch (e) {
        /* 筛选项加载失败不阻断列表 */
      }
    },
    setYear(y) {
      this.qFavOnly = false;
      this.year = y;
      this.qOffset = 0;
      this.qEnd = false;
      this.detail = null;
      this.syncFilterUrl();
      this.loadQs();
    },
    clearPaper() {
      this.applyPaper('');
    },
    applyPaper(p) {
      const next = typeof p === 'string' && p.length <= 100 ? p : '';
      if (next === this.paper) return;
      this.qFavOnly = false;
      this.paper = next;
      this.qOffset = 0;
      this.qEnd = false;
      this.syncFilterUrl();
      this.loadQs();
    },
    filterUrl() {
      if (this.tab !== 'q') return buildShenlunTabUrl(this.tab, this.mtype, this.favOnly);
      return buildShenlunFilterUrl({ paper: this.paper, qtype: this.qtype, year: this.year, region: this.region, fav: this.qFavOnly });
    },
    syncFilterUrl() {
      // #ifdef H5
      if (typeof window !== 'undefined' && window.history && !this.detail) {
        window.history.replaceState(null, '', this.filterUrl());
      }
      // #endif
    },
    tapQ() {
      this.tab = 'q';
      this.syncFilterUrl();
    },
    tapMat() {
      this.switchMat();
      this.syncFilterUrl();
    },
    tapRec() {
      this.switchRec();
      this.syncFilterUrl();
    },
    clearFlt() {
      this.qFavOnly = false;
      this.qtype = '全部';
      this.year = 0;
      this.region = '';
      this.paper = '';
      this.syncFilterUrl();
      this.qOffset = 0;
      this.qEnd = false;
      this.loadQs();
    },
    setRegion(r) {
      this.qFavOnly = false;
      this.region = r;
      this.qOffset = 0;
      this.qEnd = false;
      this.detail = null;
      this.syncFilterUrl();
      this.loadQs();
    },
    switchMat() {
      this.tab = 'm';
      if (!this.mats.length) this.loadMats();
      if (!this.favSynced) {
        this.favSynced = true;
        this.syncFavs();
      }
    },
    async switchRec() {
      this.tab = 'r';
      const uid = uni.getStorageSync('anonUid');
      if (!uid) {
        this.recs = [];
        return;
      }
      this.rErr = '';
      const p = '/api/shenlun/history?limit=50&uid=' + encodeURIComponent(uid);

      // 快照即显：uid API 长尾下先用最近成功快照铺屏，真实响应到达后覆盖
      const snap = snapPeek(p);
      if (snap) this.recs = snap.items || [];
      this.recLoading = !snap;

      try {
        const d = await request(p);
        this.recs = d.items || [];
      } catch (e) {
        this.rErr = e.message || '网络异常';
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
      this.recLoading = false;
    },
    setQtype(t) {
      this.qFavOnly = false;
      this.qtype = t;
      this.qOffset = 0;
      this.qEnd = false;
      this.detail = null;
      this.syncFilterUrl();
      this.loadQs();
    },
    qMeta(text) {
      const s = String(text || '');
      const score = (s.match(/(\d+)\s*分/) || [])[1];
      const words = (s.match(/不超过\s*(\d+)\s*字/) || [])[1];
      const parts = [];
      if (score) parts.push(score + ' 分');
      if (words) parts.push('≤' + words + ' 字');
      return parts.join(' · ');
    },
    toggleQFav(q) {
      const r = qfavToggle({ ids: this.qFavIds, snaps: this.qFavs }, q);
      this.qFavIds = r.ids;
      this.qFavs = r.snaps;
      uni.setStorageSync('slQFavIds', this.qFavIds);
      uni.setStorageSync('slQFavs', this.qFavs);
      const uid = uni.getStorageSync('anonUid');
      if (uid) request('/api/shenlun/qfavs', { method: 'POST', data: { uid, qid: q.id, on: r.added } }).catch(() => {});
    },
    async syncQFavs() {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      try {
        const d = await request('/api/shenlun/qfavs?uid=' + encodeURIComponent(uid));
        const r = mergeQFavSync({ ids: this.qFavIds, snaps: this.qFavs }, d);
        for (const id of r.pushIds) {
          request('/api/shenlun/qfavs', { method: 'POST', data: { uid, qid: id, on: true } }).catch(() => {});
        }
        this.qFavIds = r.ids;
        this.qFavs = r.snaps;
        uni.setStorageSync('slQFavIds', this.qFavIds);
        uni.setStorageSync('slQFavs', this.qFavs);
      } catch (e) { /* 非关键路径 */ }
    },
    toggleQFavOnly() {
      if (this.qFavOnly) this.qFavOnly = false;
      else this.enterQFavView();
      this.syncFilterUrl();
    },
    enterQFavView() {
      this.qFavOnly = true;
      this.detail = null;
      for (const id of missingSnapIds(this.qFavIds, this.qFavs).slice(0, 20)) {
        request('/api/shenlun/questions/' + id)
          .then((d) => {
            const it = d && d.item;
            if (it && !this.qFavs.some((x) => x && x.id === it.id)) {
              this.qFavs = this.qFavs.concat([{ id: it.id, qtype: it.qtype, paper: it.paper, exam_year: it.exam_year, exam_region: it.exam_region, question: it.question }]);
              uni.setStorageSync('slQFavs', this.qFavs);
            }
          })
          .catch(() => {});
      }
    },
    toggleFav(m) {
      const i = this.favIds.indexOf(m.id);
      const on = i < 0;
      if (on) {
        this.favIds.push(m.id);
        this.favMats.unshift(m);
      } else {
        this.favIds.splice(i, 1);
        this.favMats = this.favMats.filter((x) => x.id !== m.id);
      }
      uni.setStorageSync('slMatFavIds', this.favIds);
      uni.setStorageSync('slMatFavs', this.favMats);
      const uid = uni.getStorageSync('anonUid');
      if (uid) request('/api/shenlun/mat_favs', { method: 'POST', data: { uid, mid: m.id, on } }).catch(() => {});
    },
    async syncFavs() {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      try {
        const d = await request('/api/shenlun/mat_favs?uid=' + encodeURIComponent(uid));
        const serverIds = d.ids || [];
        const localOnly = this.favIds.filter((id) => !serverIds.includes(id));
        for (const id of localOnly) {
          request('/api/shenlun/mat_favs', { method: 'POST', data: { uid, mid: id, on: true } }).catch(() => {});
        }
        const merged = (d.items || []).filter((x) => !localOnly.includes(x.id));
        this.favMats = [...this.favMats.filter((x) => localOnly.includes(x.id)), ...merged];
        this.favIds = this.favMats.map((x) => x.id);
        uni.setStorageSync('slMatFavIds', this.favIds);
        uni.setStorageSync('slMatFavs', this.favMats);
      } catch (e) { /* 非关键路径 */ }
    },
    toggleFavOnly() {
      this.favOnly = !this.favOnly;
      this.syncFilterUrl();
    },
    setMtype(t) {
      this.favOnly = false;
      this.mtype = t;
      this.mOffset = 0;
      this.mEnd = false;
      this.syncFilterUrl();
      this.loadMats();
    },
    loadMore() {
      this.qOffset += 20;
      this.loadQs(true);
    },
    loadMoreMat() {
      this.mOffset += 20;
      this.loadMats(true);
    },
    // #ifdef H5
    onSlKeydown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (this.tab !== 'q' || !this.detail) return;
      if (e.key === 'ArrowLeft' && this.qNav.prevId) { e.preventDefault(); this.openQ(this.qNav.prevId); }
      else if (e.key === 'ArrowRight' && this.qNav.nextId) { e.preventDefault(); this.openQ(this.qNav.nextId); }
    },
    // #endif
    async openQ(id) {
      try {
        const d = await request('/api/shenlun/questions/' + id);
        this.detail = d.item;
        this.showMat = true;
        this.showRef = false;
        this.myAnswer = uni.getStorageSync('slDraft:' + id) || '';
        this.syncDraft(id);
        this.gradeResult = '';
        this.history = [];
        this.showHist = false;
        this.loadHistory(id);
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
    copyQLink() {
      if (!this.detail) return;
      const url = (typeof window !== 'undefined' ? window.location.origin : '') + buildShenlunUrl(this.detail.id);
      uni.setClipboardData({ data: url, success: () => uni.showToast({ title: '链接已复制，发给考友直达本题', icon: 'none' }) });
    },
    copyMatLink(m) {
      const url = (typeof window !== 'undefined' ? window.location.origin : '') + buildShenlunMatUrl(m.id, m.type);
      uni.setClipboardData({ data: url, success: () => uni.showToast({ title: '链接已复制，发给考友直达本条素材', icon: 'none' }) });
    },
    saveDraft() {
      if (!this.detail) return;
      const k = 'slDraft:' + this.detail.id;
      if (this.myAnswer) uni.setStorageSync(k, this.myAnswer);
      else uni.removeStorageSync(k);
      const qid = this.detail.id;
      clearTimeout(this._draftTimer);
      this._draftTimer = setTimeout(() => this.pushDraft(qid), 1500);
    },
    pushDraft(qid, content) {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      const c = content !== undefined ? content : (this.detail && this.detail.id === qid ? this.myAnswer : uni.getStorageSync('slDraft:' + qid) || '');
      request('/api/shenlun/draft', { method: 'POST', data: { uid, qid, content: c } }).catch(() => {});
    },
    async syncDraft(id) {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      try {
        const d = await request('/api/shenlun/draft?uid=' + encodeURIComponent(uid) + '&qid=' + id);
        if (!this.detail || this.detail.id !== id) return;
        const adopted = adoptServerDraft(this.myAnswer, d);
        if (adopted !== null) {
          this.myAnswer = adopted;
          uni.setStorageSync('slDraft:' + id, adopted);
        }
      } catch (e) { /* 非关键路径 */ }
    },
    async loadHistory(id) {
      const uid = uni.getStorageSync('anonUid');
      if (!uid) return;
      try {
        const d = await request('/api/shenlun/history?qid=' + id + '&uid=' + encodeURIComponent(uid));
        if (this.detail && this.detail.id === id) this.history = d.items || [];
      } catch (e) {
        /* 历史加载失败不阻断 */
      }
    },
    fmtTime(ts) {
      const d = new Date((ts || 0) * 1000);
      const p = (n) => (n < 10 ? '0' + n : n);
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },
    async grade() {
      if (this.grading || !this.myAnswer.trim()) return;
      // AI 批改需访问码（内测）：提前提示；取消时草稿保留
      if (!hasAccessCode()) {
        const info = await fetchAccessInfo();
        if (info && info.required) {
          const ok = await promptAccessCode();
          if (!ok) {
            uni.showToast({ title: '已取消，作答内容已保留为草稿', icon: 'none' });
            this.saveDraft();
            return;
          }
        }
      }
      this.grading = true;
      this.gradeResult = '';
      try {
        const d = await request('/api/shenlun/grade', {
          method: 'POST',
          data: { qid: this.detail.id, answer: this.myAnswer, uid: uni.getStorageSync('anonUid') || '' },
        });
        this.gradeResult = d.result;
        this.loadHistory(this.detail.id);
        uni.removeStorageSync('slDraft:' + this.detail.id);
        clearTimeout(this._draftTimer);
        this.pushDraft(this.detail.id, '');
      } catch (e) {
        uni.showToast({ title: e.message || '批改失败，请稍后重试', icon: 'none' });
      }
      this.grading = false;
    },
  },
};
</script>

<style>
page { background: var(--fill); }
.page { padding: 20rpx 24rpx 40rpx; background: var(--fill); min-height: 100vh; box-sizing: border-box; }
.seg { display: flex; gap: 12rpx; margin-bottom: 20rpx; }
.seg-i { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; box-sizing: border-box; font-size: 24rpx; color: var(--ink-2); background: var(--card); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 0 28rpx; }
.seg-i.on { background: var(--brand-soft); color: var(--brand-text); border-color: transparent; font-weight: 600; }
.chips { display: flex; gap: 12rpx; flex-wrap: wrap; margin-bottom: 20rpx; }
.fltbar { display: flex; align-items: center; gap: 12rpx; margin-bottom: 20rpx; }
.grow { flex: 1; }
.sheet-foot { display: flex; gap: 18rpx; margin-top: 28rpx; }
.sf-btn { flex: 1; text-align: center; background: var(--brand); color: #fff; font-size: 28rpx; font-weight: 600; border-radius: 999rpx; height: 88rpx; line-height: 88rpx; }
.sf-btn.ghost { flex: 0 0 30%; background: var(--card); color: var(--ink-2); border: 1rpx solid var(--line); box-sizing: border-box; }
.q-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14rpx; }
.q-meta { font-size: 24rpx; color: var(--ink-3); }
.q-go { color: var(--brand-text); font-size: 24rpx; font-weight: 500; display: inline-flex; align-items: center; min-height: 40px; padding: 0 0 0 24rpx; margin: -6px 0; }
.chip { display: inline-flex; align-items: center; gap: 6rpx; min-height: 40px; box-sizing: border-box; font-size: 24rpx; color: var(--ink-2); background: var(--card); border: 1rpx solid var(--line); border-radius: 999rpx; padding: 0 24rpx; }
.chip.on { color: #fff; background: var(--brand); border-color: var(--brand-text); }
.card { background: var(--card); border-radius: 20rpx; padding: 26rpx 28rpx; margin-bottom: 18rpx; }
.hist-item { background: var(--fill); border-radius: 12rpx; padding: 16rpx 18rpx; margin-bottom: 12rpx; }
.hist-time { font-size: 24rpx; color: var(--ink-3); display: block; margin-bottom: 6rpx; }
.hist-ans { font-size: 24rpx; color: var(--ink-1); line-height: 1.7; white-space: pre-wrap; display: block; max-height: 240rpx; overflow: hidden; }
.hist-res { font-size: 24rpx; color: var(--ink-2); background: var(--warn-soft); border-radius: 8rpx; padding: 12rpx 14rpx; margin-top: 10rpx; line-height: 1.7; white-space: pre-wrap; display: block; }
.spin { text-align: center; color: var(--ink-3); font-size: 26rpx; padding: 60rpx 0; }
.retry { margin-top: 12rpx; color: var(--brand-text); font-size: 26rpx; font-weight: 500; min-height: 40px; display: flex; align-items: center; justify-content: center; }
.q-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.q-tags { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
.q-paper { font-size: 24rpx; color: var(--ink-2); background: var(--fill); border-radius: 8rpx; padding: 4rpx 14rpx; }
.q-paper.tappable { cursor: pointer; text-decoration: underline; text-underline-offset: 3px; position: relative; }
.q-paper.tappable::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 40px; transform: translateY(-50%); }
.q-type { font-size: 24rpx; color: var(--brand-text); background: var(--brand-soft); border-radius: 8rpx; padding: 4rpx 14rpx; }
.q-item .q-text { font-size: 26rpx; color: var(--ink-1); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.q-text { font-size: 26rpx; color: var(--ink-1); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.more { text-align: center; color: var(--brand-text); font-size: 26rpx; padding: 20rpx 0 40rpx; }
.back { color: var(--brand-text); font-size: 26rpx; display: flex; align-items: center; min-height: 40px; padding: 0 0 8rpx; }
.d-nav { display: flex; align-items: center; justify-content: space-between; margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx solid var(--line); }
.d-nav-btn { font-size: 26rpx; color: var(--brand-text); padding: 0 18rpx; min-height: 40px; display: inline-flex; align-items: center; cursor: pointer; }
.d-nav-btn.dis { color: var(--ink-3); cursor: default; }
.d-nav-pos { font-size: 24rpx; color: var(--ink-2); }
.d-wc.near { color: var(--warn-strong); }
.d-wc.over { color: var(--bad-strong); }
.d-h { font-size: 26rpx; font-weight: 700; color: var(--ink-1); margin: 22rpx 0 10rpx; }
.d-h.toggle { color: var(--brand-text); display: flex; align-items: center; min-height: 40px; margin: 6rpx 0 0; }
.d-h.ref { color: #b45309; }
.d-q { font-size: 26rpx; color: var(--ink-1); line-height: 1.7; white-space: pre-wrap; }
.d-mat { font-size: 26rpx; color: var(--ink-2); line-height: 1.8; white-space: pre-wrap; }
.d-ref { font-size: 26rpx; color: #166534; background: var(--ok-soft); border-radius: 12rpx; padding: 18rpx; line-height: 1.8; white-space: pre-wrap; display: block; }
.d-notes { font-size: 24rpx; color: var(--ink-2); margin-top: 12rpx; line-height: 1.7; white-space: pre-wrap; display: block; }
.m-topic { font-size: 24rpx; font-weight: 600; color: var(--ink-1); }
.q-top-r { display: flex; align-items: center; gap: 12rpx; }
.d-copy { font-size: 24rpx; color: var(--brand-text); text-decoration: underline; cursor: pointer; display: inline-flex; align-items: center; min-height: 40px; padding: 0 6rpx; margin: -10px 0; }
.m-star { font-size: 34rpx; color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center; min-width: 88rpx; min-height: 88rpx; margin: -24rpx -20rpx -24rpx -8rpx; }
.m-star.on { color: #f59e0b; }
.chip.fav.on { background: var(--warn-soft); color: #b45309; border-color: #fcd34d; }
.m-content { font-size: 26rpx; color: var(--ink-2); line-height: 1.8; white-space: pre-wrap; display: block; margin: 8rpx 0; word-break: break-all; overflow-wrap: anywhere; }
.m-content.clamp { display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
.chip.sm { padding: 0 20rpx; }
.chip.flt { border-style: dashed; }
.chip.clr { color: var(--ink-3); }
.mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 90; display: flex; align-items: flex-end; }
.sheet { width: 100%; background: var(--card); border-radius: 24rpx 24rpx 0 0; padding: 26rpx 28rpx 50rpx; box-sizing: border-box; max-height: 70vh; overflow-y: auto; }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.sheet-t { font-size: 30rpx; font-weight: 700; }
.sheet-x { font-size: 26rpx; color: var(--brand-text); font-weight: 600; display: flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; margin: -6px -10rpx -6px 0; }
.sheet-k { font-size: 24rpx; color: var(--ink-3); margin: 14rpx 0 10rpx; }
.m-src { font-size: 24rpx; color: var(--ink-3); word-break: break-all; overflow-wrap: anywhere; display: block; }
.m-foot { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 4rpx; }
.m-foot .m-src { flex: 1; }
.m-foot .d-copy { flex-shrink: 0; margin-left: auto; }
.m-hit { margin-left: 8rpx; padding: 2rpx 10rpx; font-size: 24rpx; color: var(--brand-text); background: var(--fill); border-radius: 8rpx; font-weight: 400; }
.d-ans-h { display: flex; justify-content: space-between; align-items: baseline; margin: 22rpx 0 10rpx; }
.d-save { font-size: 24rpx; color: var(--ink-3); }
.d-ta { width: 100%; box-sizing: border-box; min-height: 220rpx; background: var(--fill); border: 1rpx solid var(--line); border-radius: 12rpx; padding: 18rpx; font-size: 26rpx; line-height: 1.7; }
.grade-btn { margin-top: 16rpx; text-align: center; background: var(--brand); color: #fff; font-size: 28rpx; font-weight: 600; border-radius: 999rpx; padding: 20rpx 0; min-height: 40px; box-sizing: border-box; }
.grade-btn.dis { opacity: 0.5; }
.d-grade { margin-top: 8rpx; }
.g-note { font-size: 24rpx; color: var(--ink-3); font-weight: 400; }
.g-body { font-size: 26rpx; color: var(--ink-1); background: var(--warn-soft); border-radius: 12rpx; padding: 18rpx; line-height: 1.8; white-space: pre-wrap; display: block; }
.d-cols { display: flex; flex-direction: column; }

/* 桌面（H5）：≥768 页宽收敛+居中弹窗；≥1024 列表两列+详情双栏工作台 */
/* #ifdef H5 */
@media (min-width: 768px) {
  .page { max-width: 1044px; margin: 0 auto; }
  .mask { align-items: center; justify-content: center; }
  .sheet { max-width: 520px; border-radius: 28rpx; }
  .q-item:hover, .m-item:hover, .chip:hover, .seg-i:hover { cursor: pointer; }
  .q-item:hover { box-shadow: 0 8rpx 24rpx rgba(23, 24, 28, 0.08); }
}
@media (min-width: 1024px) {
  .qgrid, .mgrid, .rgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; align-items: start; }
  .q-item { display: flex; flex-direction: column; }
  .q-item .q-text { flex: 1; }
  .d-cols { flex-direction: row; gap: 40rpx; align-items: flex-start; }
  .d-left { flex: 1; min-width: 0; }
  .d-right { flex: 1; min-width: 0; position: sticky; top: 24rpx; }
  .d-right .d-ans-h { margin-top: 0; }
}
/* #endif */
</style>
