// KgButton 小程序版（COMPONENTS §1.1）：variant primary/secondary/ghost/text × size lg/md/sm × tone brand/bad/inverse
// 映射到 t-button theme/variant，颜色全部经 index.wxss 里的 --td-button-* 走语义 token；图标 currentColor 跟随文字（含 disabled/hover）。
// 事件：t-button 内部 catch:tap 后以不冒泡的 tap 重发，故 click 不会冒泡到外层 bind:tap——
// 嵌在可点容器（banner/卡片）里的按钮必须自己 bind:click，不能依赖容器的 tap。

type Variant = 'primary' | 'secondary' | 'ghost' | 'text';
type Tone = 'brand' | 'bad' | 'inverse';

const T_SIZE: Record<string, string> = { lg: 'large', md: 'medium', sm: 'small' };

function mapTheme(variant: Variant, tone: Tone): { theme: string; tVariant: string } {
  if (variant === 'text') return { theme: tone === 'bad' ? 'danger' : 'primary', tVariant: 'text' };
  if (variant === 'ghost') return { theme: 'default', tVariant: 'outline' };
  if (variant === 'secondary') return { theme: tone === 'bad' ? 'danger' : 'primary', tVariant: 'light' };
  return { theme: tone === 'bad' ? 'danger' : 'primary', tVariant: 'base' };
}

Component({
  options: { multipleSlots: false },
  properties: {
    variant: { type: String, value: 'primary' },
    size: { type: String, value: 'md' },
    tone: { type: String, value: 'brand' },
    block: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    icon: { type: String, value: '' },
    // 透传原生 button open-type（share/contact 等）
    openType: { type: String, value: '' },
  },
  data: {
    theme: 'primary',
    tVariant: 'base',
    tSize: 'medium',
  },
  observers: {
    'variant, size, tone'(variant: Variant, size: string, tone: Tone) {
      this.setData({ ...mapTheme(variant, tone), tSize: T_SIZE[size] || 'medium' });
    },
  },
  methods: {
    onTap() {
      if (this.data.disabled || this.data.loading) return;
      this.triggerEvent('click');
    },
  },
});
