<template>
  <view class="ds">
    <view class="ds__top">
      <text class="ds__h">设计系统总览（foundation）</text>
      <text class="ds__sub">token 与 Kg* 组件全部状态 · 供 QA / 页面组对照 · 不入 tabBar</text>
      <view class="ds__ctl">
        <wd-segmented v-model:value="themeLabel" :options="themeOpts" size="small" @change="onTheme" />
        <kg-tag tone="neutral" style="flex-shrink: 0">{{ tokenCount }} tokens</kg-tag>
      </view>
    </view>

    <!-- 1. 色 -->
    <kg-section-header title="1 · 色（语义层）" />
    <view class="ds__grid">
      <view v-for="c in colors" :key="c" class="sw">
        <view class="sw__c" :style="{ background: `var(${c})` }" />
        <text class="sw__n">{{ c }}</text>
      </view>
    </view>
    <text class="ds__note">模块色（module-meta.js 单一来源）</text>
    <view class="ds__grid">
      <view v-for="m in modules" :key="m.key" class="sw">
        <view class="sw__c" :style="{ background: m.color }">
          <view class="sw__c2" :style="{ background: m.soft }" />
        </view>
        <text class="sw__n">{{ m.label }} · --mod-{{ m.key }}</text>
      </view>
    </view>

    <!-- 2. 字阶 -->
    <kg-section-header title="2 · 字阶 7 档 + 题面" />
    <kg-card>
      <view v-for="f in fonts" :key="f.k" class="ty">
        <text class="ty__s" :style="{ fontSize: `var(--fs-${f.k})`, lineHeight: `var(--lh-${f.k})`, fontWeight: f.w }">{{ f.label }}</text>
        <text class="ty__m num">--fs-{{ f.k }} · {{ f.px }}px · {{ f.w }}</text>
      </view>
      <view class="ty">
        <text class="ty__s q-text" style="font-size: var(--fs-body); line-height: var(--lh-question)">题面 .q-text：line-break:strict + overflow-wrap:anywhere，行高 1.7，标点不孤行「」。</text>
        <text class="ty__m num">.q-text · --lh-question</text>
      </view>
      <view class="ty">
        <text class="ty__s num" style="font-size: var(--fs-h1)">1,234 / 88%</text>
        <text class="ty__m">.num tabular（不算第 8 档）</text>
      </view>
    </kg-card>

    <!-- 3. 间距/圆角/阴影/动效 -->
    <kg-section-header title="3 · 间距 · 圆角 · 阴影 · 动效" />
    <kg-card>
      <view class="row wrap">
        <view v-for="s in spacings" :key="s" class="sp">
          <view class="sp__b" :style="{ width: `var(--sp-${s})`, height: `var(--sp-${s})` }" />
          <text class="sp__n num">{{ s }}</text>
        </view>
      </view>
      <view class="row wrap" style="margin-top: var(--sp-16)">
        <view v-for="r in radii" :key="r" class="rd" :style="{ borderRadius: `var(--r-${r})` }">
          <text class="sp__n">--r-{{ r }}</text>
        </view>
      </view>
      <view class="row wrap" style="margin-top: var(--sp-16)">
        <view v-for="s in ['sh-1', 'sh-2', 'sh-3']" :key="s" class="sh" :style="{ boxShadow: `var(--${s})` }">
          <text class="sp__n">--{{ s }}<text v-if="dark">（深色 none）</text></text>
        </view>
      </view>
      <view class="row" style="margin-top: var(--sp-16); align-items: center">
        <kg-button size="sm" variant="secondary" @click="bump">动效 250ms</kg-button>
        <view class="mv" :class="{ 'mv--on': moved }" />
        <text class="ds__note">--dur-base / --ease-standard · reduced-motion 全局降级</text>
      </view>
    </kg-card>

    <!-- 4. 按钮 -->
    <kg-section-header title="4 · KgButton 4 级 × 3 尺寸 × 态" />
    <kg-card>
      <view v-for="v in ['primary', 'secondary', 'ghost', 'text']" :key="v" class="row wrap" style="margin-bottom: var(--sp-12)">
        <kg-button :variant="v" size="lg">{{ v }} lg</kg-button>
        <kg-button :variant="v" size="md" icon="plus">md</kg-button>
        <kg-button :variant="v" size="sm">sm</kg-button>
        <kg-button :variant="v" size="md" disabled>disabled</kg-button>
        <kg-button :variant="v" size="md" loading>loading</kg-button>
      </view>
      <view class="row wrap">
        <kg-button tone="bad">删除</kg-button>
        <kg-button variant="secondary" tone="bad">bad secondary</kg-button>
        <kg-button block>block</kg-button>
      </view>
      <view class="inv">
        <kg-button tone="inverse">inverse primary</kg-button>
        <kg-button tone="inverse" variant="ghost">inverse ghost</kg-button>
      </view>
    </kg-card>

    <!-- 5. Tag / Chip / Segmented -->
    <kg-section-header title="5 · KgTag · KgChipRow · wd-segmented" />
    <kg-card>
      <view class="row wrap">
        <kg-tag v-for="t in ['brand', 'ok', 'bad', 'warn', 'info', 'neutral']" :key="t" :tone="t">{{ t }}</kg-tag>
        <kg-tag tone="brand" icon="check">带图标</kg-tag>
        <kg-tag v-for="m in modules" :key="m.key" tone="module" :module="m.key">{{ m.short }}</kg-tag>
      </view>
      <view style="margin: var(--sp-16) calc(-1 * var(--card-pad)) 0">
        <kg-chip-row v-model="chip" :options="chipOpts" />
      </view>
      <view style="margin-top: var(--sp-16)">
        <wd-segmented v-model:value="seg" :options="['全部', '错题', '收藏']" />
      </view>
    </kg-card>

    <!-- 6. 卡片 -->
    <kg-section-header title="6 · KgCard flat / raised / soft" more="查看全部" />
    <view class="row wrap" style="align-items: stretch">
      <kg-card v-for="v in ['flat', 'raised', 'soft']" :key="v" :variant="v" style="flex: 1; min-width: 140px">
        <template #header><text class="ds__b">{{ v }}</text></template>
        <text class="ds__note">正文 --ink-2</text>
      </kg-card>
    </view>
    <view class="row wrap" style="margin-top: var(--sp-12); align-items: stretch">
      <kg-card clickable chevron style="flex: 1; min-width: 140px"><text>可点 + chevron</text></kg-card>
      <kg-card clickable selected style="flex: 1; min-width: 140px"><text>选中态</text></kg-card>
      <kg-card :padding="12" style="flex: 1; min-width: 140px"><text>紧凑 12</text></kg-card>
    </view>

    <!-- 7. 进度 / 统计 / hero -->
    <kg-section-header title="7 · KgProgress · KgStatRow · KgStatCard · KgHeroCard" />
    <kg-card>
      <kg-progress :value="42" aria-label="线性 4px" />
      <view style="height: var(--sp-12)" />
      <kg-progress :value="72" :thickness="8" module="ziliao" aria-label="线性 8px 模块色" />
      <view class="row wrap" style="margin-top: var(--sp-16); align-items: center">
        <kg-progress shape="ring" :value="35" :size="48" aria-label="环 48" />
        <kg-progress shape="ring" :value="65" :size="72" module="yanyu" aria-label="环 72">65%</kg-progress>
        <kg-progress shape="ring" :value="90" :size="96" :thickness="8" aria-label="环 96">
          <text class="num" style="font-size: var(--fs-h2); font-weight: 600">90%</text>
        </kg-progress>
      </view>
    </kg-card>
    <view style="height: var(--sp-12)" />
    <kg-card>
      <kg-stat-row :items="[{ label: '已练', value: 1284, unit: '题' }, { label: '正确率', value: 76, unit: '%' }, { label: '连签', value: 12, unit: '天' }, { label: '错题', value: 33 }]" />
    </kg-card>
    <view class="row wrap" style="margin-top: var(--sp-12); align-items: stretch">
      <kg-stat-card label="本周正确率" :value="81" unit="%" :ring="81" style="flex: 1; min-width: 140px" />
      <kg-stat-card label="未解锁（0 数据）" :value="0" style="flex: 1; min-width: 140px" />
    </view>
    <view style="height: var(--sp-12)" />
    <kg-hero-card label="今日目标" :value="12" :total="20" unit="题" :progress="60" :streak="7"
      :primary="{ text: '继续刷题' }" :secondary="{ text: '换模块' }" />
    <view style="height: var(--sp-12)" />
    <kg-hero-card variant="plain" label="模考成绩" :value="68.5" unit="分" :primary="{ text: '查看报告' }" />

    <!-- 8. 模块卡 / 连签 -->
    <kg-section-header title="8 · KgModuleCard row / grid · KgStreakBadges" />
    <kg-module-card module="ziliao" :progress="{ done: 120, acc: 78 }" badge="推荐" />
    <view style="height: var(--sp-8)" />
    <view class="row wrap" style="align-items: stretch">
      <kg-module-card v-for="m in modules" :key="m.key" :module="m.key" layout="grid" style="flex: 1; min-width: 96px" />
    </view>
    <view style="height: var(--sp-12)" />
    <kg-card><kg-streak-badges :days="5" /></kg-card>

    <!-- 9. 题目 / 选项 / 解析 -->
    <kg-section-header title="9 · KgQuestionCard · KgOptionGroup 7 态 · KgAnalysisCard" />
    <kg-question-card :q="q" :index="3" :total="10">
      <kg-option-group v-model="picked" :options="q.options" :answer="q.answer" :revealed="revealed" :excluded="excluded" @exclude="onExclude" />
      <view class="row" style="margin-top: var(--sp-12)">
        <kg-button size="sm" variant="secondary" @click="revealed = !revealed">{{ revealed ? '重答' : '揭晓' }}</kg-button>
        <kg-button size="sm" variant="text" @click="excluded = excluded.length ? [] : ['D']">切换排除 D</kg-button>
      </view>
    </kg-question-card>
    <view style="height: var(--sp-12)" />
    <kg-option-group :options="q.options" model-value="B" readonly />
    <view style="height: var(--sp-12)" />
    <kg-analysis-card :answer="q.answer" :picked="picked || 'B'" :analysis="analysis" :stats="{ attemptCount: 1280, accuracy: 62, mostWrong: 'B', avgSecs: 48 }" source="2024 国考·行测" :tags="['资料分析', '增长率', '基期量']" />

    <!-- 10. 空态 / 骨架 / 横幅 -->
    <kg-section-header title="10 · KgEmptyState · KgSkeleton · KgBanner" />
    <kg-banner text="网络不太稳定，作答已进入离线队列" tone="warn" icon="wifi-off" action-text="重试" closable />
    <view style="height: var(--sp-8)" />
    <kg-banner text="新版模考已上线" tone="info" />
    <view style="height: var(--sp-12)" />
    <kg-card>
      <kg-empty-state icon="inbox" title="还没有错题" desc="做错的题会自动收进来，按记忆曲线安排复习" cta-text="去刷题" secondary-text="看看示例" />
    </kg-card>
    <view style="height: var(--sp-12)" />
    <kg-card>
      <kg-empty-state icon="search" title="没有匹配结果" compact />
    </kg-card>
    <view style="height: var(--sp-12)" />
    <view class="row" style="gap: var(--sp-12); align-items: flex-start">
      <view style="flex: 1"><kg-skeleton preset="hero" /></view>
      <view style="flex: 1"><kg-skeleton preset="lines" /></view>
    </view>
    <view style="height: var(--sp-8)" />
    <kg-skeleton preset="cards" />

    <!-- 11. 图标 -->
    <kg-section-header title="11 · l-icon tone × 16/20/24/32" />
    <kg-card>
      <view class="row wrap" style="align-items: center">
        <l-icon v-for="t in tones" :key="t" name="flame" :size="24" :tone="t" />
      </view>
      <view class="row wrap" style="align-items: center; margin-top: var(--sp-12)">
        <l-icon v-for="s in [16, 20, 24, 32]" :key="s" name="book-open" :size="s" tone="brand" />
        <text class="ds__note">legacy color prop 仍兼容（deprecated，走 base64 image 路径），此页不演示裸值</text>
      </view>
    </kg-card>

    <!-- 12. 邀请码 / 双栏 / sheet -->
    <kg-section-header title="12 · KgInviteInput · KgTwoCol · KgSheet · KgActionBar" />
    <kg-card>
      <kg-invite-input v-model="invite" :error="invite === 'BAD000' ? '邀请码不存在' : ''" @submit="sheet = true" />
    </kg-card>
    <view style="height: var(--sp-12)" />
    <kg-two-col>
      <template #main><kg-card variant="soft"><text>main（≥1024 左栏）</text></kg-card></template>
      <template #aside><kg-card variant="soft"><text>aside 320px sticky</text></kg-card></template>
    </kg-two-col>
    <view style="height: var(--sp-12)" />
    <view class="row wrap">
      <kg-button variant="secondary" @click="sheet = true">打开 KgSheet</kg-button>
      <kg-button variant="secondary" @click="bar = bar === 'answer' ? 'actions' : bar === 'actions' ? 'input' : 'answer'">底栏 layout：{{ bar }}</kg-button>
    </view>
    <kg-sheet v-model="sheet" title="底部面板（≥1024 变 dialog）">
      <text class="ds__note">内容区 · 关闭走 mask / 右上 ×</text>
      <template #footer><kg-button block @click="sheet = false">知道了</kg-button></template>
    </kg-sheet>

    <view style="height: 120px" />
    <kg-action-bar :layout="bar" :index="3" :total="10" primary-text="下一题" secondary-text="解析" />
  </view>
</template>

<script>
import { MODULE_KEYS, moduleMeta } from '../../module-meta.js';
import { ICON_TONES } from '../../icon-tone.js';
import { getThemeMode, setThemeMode, isDark, THEME_LABELS } from '../../theme.js';

/**
 * 开发用总览页（任务 3）：只读展示 token 与 Kg* 全部状态，不入 tabBar、不埋点。
 * 路由 #/pkgA/dev/design。截图随 PR。
 */
export default {
  data() {
    return {
      themeLabel: THEME_LABELS[getThemeMode()],
      themeOpts: Object.values(THEME_LABELS),
      dark: false,
      tokenCount: 0,
      colors: [
        '--brand', '--brand-press', '--brand-text', '--brand-soft', '--brand-soft-2',
        '--ok', '--ok-strong', '--ok-soft', '--bad', '--bad-strong', '--bad-soft',
        '--warn', '--warn-strong', '--warn-soft', '--info', '--info-strong', '--info-soft',
        '--ink', '--ink-2', '--ink-3', '--ink-4', '--line', '--fill', '--card', '--bg', '--streak', '--prog-track',
      ],
      modules: MODULE_KEYS.map((k) => moduleMeta(k)),
      fonts: [
        { k: 'display', label: '展示 Display', px: 32, w: 600 },
        { k: 'h1', label: '标题一 H1', px: 24, w: 600 },
        { k: 'h2', label: '标题二 H2', px: 20, w: 600 },
        { k: 'h3', label: '标题三 H3', px: 17, w: 500 },
        { k: 'body', label: '正文 Body', px: 15, w: 400 },
        { k: 'sub', label: '辅助 Sub', px: 13, w: 400 },
        { k: 'caption', label: '说明 Caption', px: 12, w: 400 },
      ],
      spacings: [4, 8, 12, 16, 20, 24, 32, 40, 48],
      radii: ['xs', 'sm', 'md', 'lg', 'full'],
      moved: false,
      chip: 'all',
      chipOpts: [
        { value: 'all', label: '全部', count: 128 },
        { value: 'ziliao', label: '资料分析', icon: 'chart-column' },
        { value: 'shuliang', label: '数量关系' },
        { value: 'yanyu', label: '言语理解' },
        { value: 'panduan', label: '判断推理' },
        { value: 'changshi', label: '常识判断' },
        { value: 'x', label: '禁用', disabled: true },
      ],
      seg: '全部',
      picked: '',
      revealed: false,
      excluded: [],
      q: {
        module: 'ziliao',
        difficulty: 3,
        accuracy: 62,
        attemptCount: 1280,
        isReal: true,
        material: '2023 年某省规模以上工业增加值同比增长 6.8%，其中高技术制造业增长 11.2%，占比提升至 18.4%。',
        stem: '2023 年该省高技术制造业增加值占规模以上工业增加值的比重比上年约提高了多少个百分点？（增长率与占比的关系用 line-break:strict 排版，标点不孤行——「」。）',
        options: [
          { key: 'A', text: '0.7 个百分点' },
          { key: 'B', text: '1.1 个百分点' },
          { key: 'C', text: '1.8 个百分点' },
          { key: 'D', text: '2.4 个百分点' },
        ],
        answer: 'A',
        images: [],
      },
      analysis: '设上年占比为 x，则 x·(1+11.2%) / (1+6.8%) = 18.4%，解得 x ≈ 17.7%，提升约 **0.7 个百分点**。\n\n速算：占比变化 ≈ 上年占比 × (部分增速 − 整体增速) / (1 + 整体增速)。',
      tones: Object.keys(ICON_TONES).filter((t) => t !== 'on-brand' && t !== 'inherit').concat(MODULE_KEYS.map((k) => `module:${k}`)),
      invite: '',
      sheet: false,
      bar: 'answer',
    };
  },
  onShow() {
    this.dark = isDark();
    // #ifdef H5
    this.tokenCount = Array.from(document.styleSheets)
      .flatMap((s) => { try { return Array.from(s.cssRules); } catch (e) { return []; } })
      .filter((r) => r.selectorText === ':root')
      .reduce((n, r) => n + Array.from(r.style).filter((p) => p.startsWith('--') && !p.startsWith('--wot')).length, 0);
    // #endif
  },
  methods: {
    onTheme({ value }) {
      const mode = Object.keys(THEME_LABELS).find((k) => THEME_LABELS[k] === value) || 'system';
      setThemeMode(mode);
      this.dark = isDark();
    },
    bump() { this.moved = !this.moved; },
    onExclude(k) {
      this.excluded = this.excluded.includes(k) ? this.excluded.filter((x) => x !== k) : [...this.excluded, k];
    },
  },
};
</script>

<style scoped>
.ds { padding: var(--sp-16) var(--page-x) var(--sp-48); max-width: 960px; margin: 0 auto; }
.ds__top { margin-bottom: var(--sp-16); }
.ds__h { display: block; font-size: var(--fs-h1); line-height: var(--lh-h1); font-weight: 600; color: var(--ink); }
.ds__sub { display: block; margin-top: var(--sp-4); font-size: var(--fs-sub); color: var(--ink-3); }
.ds__ctl { display: flex; align-items: center; gap: var(--sp-12); margin-top: var(--sp-12); }
.ds__note { font-size: var(--fs-caption); color: var(--ink-3); }
.ds__b { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.ds__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: var(--sp-8); margin-bottom: var(--sp-12); }
.sw__c { height: 40px; border-radius: var(--r-sm); border: 1px solid var(--line); position: relative; overflow: hidden; }
.sw__c2 { position: absolute; right: 0; top: 0; bottom: 0; width: 40%; }
.sw__n { display: block; margin-top: var(--sp-4); font-size: var(--fs-caption); color: var(--ink-3); overflow-wrap: anywhere; }
.ty { display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-12); padding: var(--sp-8) 0; border-bottom: 1px solid var(--line); }
.ty:last-child { border-bottom: 0; }
.ty__s { color: var(--ink); flex: 1; min-width: 0; }
.ty__m { flex-shrink: 0; font-size: var(--fs-caption); color: var(--ink-3); }
.row { display: flex; gap: var(--sp-8); align-items: center; }
.wrap { flex-wrap: wrap; }
.sp { display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); }
.sp__b { background: var(--brand-soft-2); border-radius: var(--r-xs); }
.sp__n { font-size: var(--fs-caption); color: var(--ink-3); }
.rd { width: 64px; height: 48px; background: var(--brand-soft); border: 1px solid var(--brand-soft-2); display: flex; align-items: center; justify-content: center; }
.sh { width: 96px; height: 56px; background: var(--card); border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; }
.mv { width: 24px; height: 24px; border-radius: var(--r-xs); background: var(--brand); transition: transform var(--dur-base) var(--ease-standard); }
.mv--on { transform: translateX(80px) rotate(90deg); }
.inv { margin-top: var(--sp-12); padding: var(--sp-12); border-radius: var(--r-md); background: var(--brand-grad); display: flex; gap: var(--sp-8); flex-wrap: wrap; }
</style>
