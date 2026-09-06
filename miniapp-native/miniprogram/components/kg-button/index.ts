// KgButton 小程序版（COMPONENTS §1.1）：variant primary/secondary/ghost/text × size lg/md/sm × tone brand/bad/inverse
// 映射到 t-button theme/variant，颜色全部经 index.wxss 里的 --td-button-* 走语义 token。

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
  },
  data: {
    theme: 'primary',
    tVariant: 'base',
    tSize: 'medium',
    iconTone: 'on-brand',
  },
  observers: {
    'variant, size, tone'(variant: Variant, size: string, tone: Tone) {
      const m = mapTheme(variant, tone);
      const iconTone =
        variant === 'primary' ? (tone === 'inverse' ? 'brand-text' : 'on-brand')
          : variant === 'ghost' ? (tone === 'inverse' ? 'on-brand' : 'ink')
            : tone === 'bad' ? 'bad' : 'brand-text';
      this.setData({ ...m, tSize: T_SIZE[size] || 'medium', iconTone });
    },
  },
  methods: {
    onTap() {
      if (this.data.disabled || this.data.loading) return;
      this.triggerEvent('click');
    },
  },
});
