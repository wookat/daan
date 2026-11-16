// 动效降级（SPEC §5）：系统 reduced-motion 时全局关动画。CSS 侧由 tokens.generated.css 的 @media 统一归零，
// 这里给需要在 JS 里决定「要不要动」的组件用（骨架 shimmer、进度填充动画）。
export function prefersReducedMotion() {
  // #ifdef H5
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  // #endif
  return false;
}
