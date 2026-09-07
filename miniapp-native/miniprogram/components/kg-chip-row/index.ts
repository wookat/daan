// KgChipRow 小程序版（COMPONENTS §1.3）：横滚单选筛选行，右侧渐隐；options: {value,label,icon?,count?,disabled?}[]
interface ChipOption { value: string | number; label: string; icon?: string; count?: number; disabled?: boolean }

Component({
  properties: {
    options: { type: Array, value: [] as ChipOption[] },
    value: { type: null, value: '' },
    size: { type: String, value: 'md' },
    scrollToSelected: { type: Boolean, value: true },
  },
  data: { scrollTo: '' },
  observers: {
    'value, options'(value: string | number, options: ChipOption[]) {
      if (!this.data.scrollToSelected) return;
      const i = options.findIndex((o) => o.value === value);
      this.setData({ scrollTo: i >= 0 ? `chip-${i}` : '' });
    },
  },
  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const { value, disabled } = e.currentTarget.dataset as { value: string | number; disabled?: boolean };
      if (disabled || value === this.data.value) return;
      this.triggerEvent('change', { value });
    },
  },
});
