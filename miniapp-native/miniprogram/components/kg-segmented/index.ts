// KgSegmented 小程序版（COMPONENTS §1.5）：TDesign 无对应分段控件，自研滑块式；options: {value,label}[]，thumb 用 transform（非 setData 帧动画）。
interface SegOption { value: string | number; label: string }

Component({
  properties: {
    options: { type: Array, value: [] as SegOption[] },
    value: { type: null, value: '' },
    size: { type: String, value: 'md' },
  },
  data: { activeIndex: 0 },
  observers: {
    'value, options'(value: string | number, options: SegOption[]) {
      const i = options.findIndex((o) => o.value === value);
      this.setData({ activeIndex: i < 0 ? 0 : i });
    },
  },
  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const { value } = e.currentTarget.dataset as { value: string | number };
      if (value === this.data.value) return;
      this.triggerEvent('change', { value });
    },
  },
});
