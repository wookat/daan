<template>
  <view class="page">
    <view class="form">
      <view class="hero">
        <image class="hero-logo" src="/static/brand/kaogong.svg" mode="aspectFit" aria-hidden="true" />
        <text class="hero-t">错题邦</text>
        <text class="hero-s">登录后错题、做题记录多端同步，本机记录自动合并</text>
      </view>

      <kg-card class="card">
        <wd-segmented ref="seg" :value="modeLabel" :options="modeOpts" class="seg" @change="onModeChange" />

        <view class="field">
          <wd-input
            v-model="phone"
            label="手机号"
            type="number"
            maxlength="11"
            placeholder="请输入 11 位手机号"
            clearable
            :error="!!fieldErr.phone"
            custom-input-class="num"
            @blur="checkPhone"
            @input="fieldErr.phone = ''"
          />
          <text v-if="fieldErr.phone" class="ferr" role="alert">{{ fieldErr.phone }}</text>
        </view>
        <view class="field">
          <wd-input
            v-model="password"
            label="密码"
            show-password
            maxlength="64"
            placeholder="6-64 位密码"
            :error="!!fieldErr.password"
            @blur="checkPassword"
            @input="fieldErr.password = ''"
          />
          <text v-if="fieldErr.password" class="ferr" role="alert">{{ fieldErr.password }}</text>
        </view>
        <view v-if="mode === 'register'" class="field">
          <wd-input v-model="nickname" label="昵称" maxlength="20" placeholder="选填，给自己起个名字" clearable />
          <text class="fnote">短信验证码功能即将上线，当前注册无需验证码</text>
        </view>

        <kg-button variant="primary" size="lg" block :disabled="busy" :loading="busy" class="primary" @click="submit">
          {{ mode === 'login' ? '登录' : '注册并合并本机记录' }}
        </kg-button>
        <!-- #ifdef H5 -->
        <kg-button variant="secondary" size="lg" block :disabled="busy" class="sso" @click="ssoLogin">Zalize 统一账号一键登录</kg-button>
        <text class="note">已在 account.zalize.com 登录过心动简历/速申等站点？可直接一键登录并合并本机记录</text>
        <!-- #endif -->
        <text v-if="err" class="err" role="alert">{{ err }}</text>
      </kg-card>
    </view>
  </view>
</template>

<script>
import { authLogin, authRegister, authSso, mergeAnon, setAuth, trackEvent } from '../../api.js';
import { segResizeMixin } from '../../seg-resize.js';
const MERGE_FAIL_TIP = '已登录，但本机记录合并失败；退出后重新登录会再次合并';

const MODE_OPTS = [
  { label: '登录', value: 'login' },
  { label: '注册', value: 'register' },
];

export default {
  mixins: [segResizeMixin],
  data() {
    return { mode: 'login', phone: '', password: '', nickname: '', busy: false, err: '', fieldErr: { phone: '', password: '' } };
  },
  computed: {
    modeOpts() {
      return MODE_OPTS.map((o) => o.label);
    },
    modeLabel() {
      return (MODE_OPTS.find((o) => o.value === this.mode) || MODE_OPTS[0]).label;
    },
  },
  methods: {
    leave() {
      // H5 的 navigateBack 只是 history.go(-1) 且永不 fail：深链/刷新直达（页面栈仅 1 页）时会停在登录页
      if (getCurrentPages().length > 1) uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/stats/stats' }) });
      else uni.switchTab({ url: '/pages/stats/stats' });
    },
    onModeChange(opt) {
      const o = MODE_OPTS.find((x) => x.label === (opt && opt.value));
      if (o) this.mode = o.value;
    },
    checkPhone() {
      this.fieldErr.phone = /^1\d{10}$/.test(this.phone) ? '' : '请输入 11 位手机号';
      return !this.fieldErr.phone;
    },
    checkPassword() {
      this.fieldErr.password = this.password.length < 6 ? '密码至少 6 位' : '';
      return !this.fieldErr.password;
    },
    async ssoLogin() {
      this.err = '';
      this.busy = true;
      try {
        const anon = uni.getStorageSync('anonUid') || '';
        const r = await authSso();
        setAuth(r.token, r.user);
        if (anon && anon !== r.user.uid) {
          try {
            await mergeAnon(anon);
            uni.showToast({ title: '本机记录已合并到账号', icon: 'success', duration: 2000 });
          } catch (e) {
            uni.showToast({ title: MERGE_FAIL_TIP, icon: 'none', duration: 2500 });
          }
        } else {
          uni.showToast({ title: '登录成功', icon: 'success' });
        }
        setTimeout(() => this.leave(), 1200);
      } catch (e) {
        this.err = e.message === '未登录 Zalize 统一账号' ? '请先在 account.zalize.com 登录后再试' : e.message || '登录失败';
      } finally {
        this.busy = false;
      }
    },
    async submit() {
      this.err = '';
      const okPhone = this.checkPhone();
      const okPwd = this.checkPassword();
      if (!okPhone || !okPwd) return;
      this.busy = true;
      try {
        const anon = uni.getStorageSync('anonUid') || '';
        const r =
          this.mode === 'login'
            ? await authLogin(this.phone, this.password)
            : await authRegister(this.phone, this.password, '', this.nickname.trim());
        setAuth(r.token, r.user);
        if (this.mode === 'register') {
          const src = uni.getStorageSync('regSource');
          if (src) {
            trackEvent('register', src);
            uni.removeStorageSync('regSource');
          }
        }
        if (anon && anon !== r.user.uid) {
          try {
            await mergeAnon(anon);
            uni.showToast({ title: '本机记录已合并到账号', icon: 'success', duration: 2000 });
          } catch (e) {
            uni.showToast({ title: MERGE_FAIL_TIP, icon: 'none', duration: 2500 });
          }
        } else {
          uni.showToast({ title: this.mode === 'login' ? '登录成功' : '注册成功', icon: 'success' });
        }
        setTimeout(() => this.leave(), 1200);
      } catch (e) {
        this.err = e.message || '操作失败';
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style scoped>
/* T5 工具模板：单列居中 max 480，不双栏，页面底 --bg */
.page { min-height: 100vh; background: var(--bg); padding: var(--sp-16) var(--page-x) var(--sp-48); box-sizing: border-box; }
.form { max-width: 480px; margin: 0 auto; }
.hero { padding: var(--sp-32) var(--sp-8) var(--sp-24); text-align: center; display: flex; flex-direction: column; align-items: center; }
.hero-logo { width: 72px; height: 72px; border-radius: var(--r-lg); margin-bottom: var(--sp-16); box-shadow: var(--sh-2); }
.hero-t { font-size: var(--fs-h1); line-height: var(--lh-h1); font-weight: 600; color: var(--ink); }
.hero-s { margin-top: var(--sp-4); font-size: var(--fs-sub); color: var(--ink-2); }
.seg { margin-bottom: var(--sp-16); }
.field { margin-bottom: var(--sp-12); }
.ferr { display: block; margin-top: var(--sp-4); padding-left: var(--sp-12); font-size: var(--fs-sub); color: var(--bad-strong); }
.fnote { display: block; margin-top: var(--sp-4); padding-left: var(--sp-12); font-size: var(--fs-sub); color: var(--ink-3); }
.primary { margin-top: var(--sp-8); }
.sso { margin-top: var(--sp-12); }
.note { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); color: var(--ink-3); text-align: center; }
.err { display: block; margin-top: var(--sp-12); font-size: var(--fs-sub); color: var(--bad-strong); text-align: center; }
</style>
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  box-sizing: border-box;
