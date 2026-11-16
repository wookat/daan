// wd-segmented 选中滑块只在挂载/切换时测量一次；H5 窗口宽度变化后需重新测量，否则高亮块保留旧宽度/偏移

export const SEG_RESIZE_DEBOUNCE_MS = 120;

/** 取组件实例上可调用的 updateActiveStyle（ref 名默认 `seg`，支持数组 ref）；无则 null。 */
export function segUpdater(refs, name = 'seg') {
  const r = refs && refs[name];
  const inst = Array.isArray(r) ? r[0] : r;
  return inst && typeof inst.updateActiveStyle === 'function' ? () => inst.updateActiveStyle(false) : null;
}

/** 页面 mixin：H5 订阅 uni.onWindowResize，防抖后让 `ref="seg"` 的 wd-segmented 重测滑块；onUnload 取消订阅。 */
export const segResizeMixin = {
  mounted() {
    // #ifdef H5
    if (typeof uni === 'undefined' || typeof uni.onWindowResize !== 'function') return;
    let timer = null;
    this._segResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const fn = segUpdater(this.$refs);
        if (fn) fn();
      }, SEG_RESIZE_DEBOUNCE_MS);
    };
    uni.onWindowResize(this._segResize);
    // #endif
  },
  beforeUnmount() {
    // #ifdef H5
    if (this._segResize && typeof uni !== 'undefined' && typeof uni.offWindowResize === 'function') {
      uni.offWindowResize(this._segResize);
    }
    this._segResize = null;
    // #endif
  },
};
