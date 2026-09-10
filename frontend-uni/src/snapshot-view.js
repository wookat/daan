// 多端点页面的旧快照展示态：request() 网络失败以 apiSnap 旧快照 resolve（staleAt 打标），
// 页面把每个回包交给 noteSnapshot 登记；任一为旧快照即进入快照态（横幅取最旧时刻、采样 navigator.onLine），
// 一轮刷新的主回包为真实且本轮未见旧快照时清除；H5 监听 online/offline 改文案并联网自动重拉。
import { staleAt } from './api.js';
import { snapshotNotice } from './snapshot-notice.js';

/**
 * @param {{ noun: string, reload: string }} opt noun=横幅名词；reload=联网/重试时调用的页面方法名
 */
export function snapshotViewMixin({ noun, reload }) {
  return {
    data() {
      return { offlineView: false, snapAt: 0, netOnline: null };
    },
    computed: {
      offlineText() {
        return snapshotNotice(this.snapAt, this.netOnline, Date.now(), noun);
      },
    },
    methods: {
      /** 一轮刷新开始：清本轮已见快照时刻（横幅保留到本轮主回包裁决） */
      beginSnapshotRound() {
        this._roundStale = [];
      },
      /** 登记一个回包；旧快照返回其时刻（>0）并进入/更新快照态，真实回包返回 0 */
      noteSnapshot(d) {
        const t = staleAt(d);
        if (!t) return 0;
        if (!this._roundStale) this._roundStale = [];
        this._roundStale.push(t);
        this.showSnapshot(Math.min(...this._roundStale));
        return t;
      },
      /** 主回包为真实：本轮未见旧快照才清横幅（其余端点若随后回退旧快照会再次进入快照态） */
      settleSnapshotRound() {
        if (this._roundStale && this._roundStale.length) return;
        this.offlineView = false;
        this.snapAt = 0;
        this.unbindNet();
      },
      showSnapshot(snapAt) {
        this.snapAt = snapAt;
        this.netOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : null;
        this.offlineView = true;
        // #ifdef H5
        if (!this._onNet && typeof window !== 'undefined') {
          this._onNet = (e) => {
            this.netOnline = e.type === 'online';
            if (this.netOnline && this.offlineView) this[reload]();
          };
          window.addEventListener('online', this._onNet);
          window.addEventListener('offline', this._onNet);
        }
        // #endif
      },
      unbindNet() {
        if (this._onNet && typeof window !== 'undefined') {
          window.removeEventListener('online', this._onNet);
          window.removeEventListener('offline', this._onNet);
        }
        this._onNet = null;
      },
    },
  };
}
