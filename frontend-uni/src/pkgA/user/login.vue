<template>
  <view class="page">
    <view class="form">
      <view class="hero">
        <view class="hero-logo">
          <image class="hero-logo-g" src="/static/brand/daan.svg" mode="aspectFit" aria-hidden="true" />
        </view>
        <text class="hero-t">答岸</text>
        <text class="hero-s">登录后错题、做题记录多端同步，本机记录自动合并</text>
      </view>

      <kg-card class="card">
        <wd-segmented ref="seg" :value="modeLabel" :options="modeOpts" class="seg" @change="onModeChange" />

        <view class="field">
          <wd-input
            v-model="email"
            label="邮箱"
            type="text"
            maxlength="128"
            placeholder="请输入邮箱"
            clearable
            :error="!!fieldErr.email"
            custom-input-class="num"
            @blur="checkEmail"
            @input="fieldErr.email = ''"
          />
          <text v-if="fieldErr.email" class="ferr" role="alert">{{ fieldErr.email }}</text>
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
          <wd-input
            v-model="password2"
            label="确认密码"
            show-password
            maxlength="64"
            placeholder="再次输入密码"
            :error="!!fieldErr.password2"
            @blur="checkPassword2"
            @input="fieldErr.password2 = ''"
          />
          <text v-if="fieldErr.password2" class="ferr" role="alert">{{ fieldErr.password2 }}</text>
        </view>
        <view v-if="mode === 'register'" class="field">
          <wd-input v-model="nickname" label="昵称" maxlength="20" placeholder="选填，给自己起个名字" clearable />
          <text class="fnote">邮箱验证码功能即将上线，当前注册无需验证码</text>
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
    return {
      mode: 'login',
      email: '',
      password: '',
      password2: '',
      nickname: '',
      busy: false,
      err: '',
      fieldErr: { email: '', password: '', password2: '' },
    };
  },
  computed: {
    modeOpts() {
      return MODE_OPTS.map((o) => o.label);
    },
    modeLabel() {
      return (MODE_OPTS.find((o) => o.value === this.mode) || MODE_OPTS[0]).label;
    },
  },
  onLoad(opts) {
    // 统一账号回流：ssoLogin 未登录时跳 account.zalize.com?redirect=回本页带 sso=1，回来后自动重试一次
    if (opts && opts.sso === '1') this.ssoLogin();
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
    checkEmail() {
      this.fieldErr.email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email) ? '' : '请输入正确的邮箱地址';
      return !this.fieldErr.email;
    },
    checkPassword() {
      this.fieldErr.password = this.password.length < 6 ? '密码至少 6 位' : '';
      return !this.fieldErr.password;
    },
    checkPassword2() {
      this.fieldErr.password2 = this.password2 === this.password ? '' : '两次输入的密码不一致';
      return !this.fieldErr.password2;
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
        if (e.message === '未登录 Zalize 统一账号') {
          // #ifdef H5
          // 中心站 ?redirect= 登录后回跳（中心站校验 *.zalize.com）；回本页带 sso=1 自动重试 SSO
          const back = location.origin + location.pathname + '#/pkgA/user/login?sso=1';
          location.href = 'https://account.zalize.com/?redirect=' + encodeURIComponent(back);
          return;
          // #endif
        }
        this.err = e.message || '登录失败';
      } finally {
        this.busy = false;
      }
    },
    async submit() {
      this.err = '';
      const okMail = this.checkEmail();
      const okPwd = this.checkPassword();
      const okPwd2 = this.mode !== 'register' || this.checkPassword2();
      if (!okMail || !okPwd || !okPwd2) return;
      this.busy = true;
      try {
        const anon = uni.getStorageSync('anonUid') || '';
        const r =
          this.mode === 'login'
            ? await authLogin(this.email, this.password)
            : await authRegister(this.email, this.password, '', this.nickname.trim());
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
.hero { padding: var(--sp-32) var(--sp-8) var(--sp-32); text-align: center; display: flex; flex-direction: column; align-items: center; }
/* logo 砖：字形原始 SVG 无内边距，直接 aspectFit 进 72px 会顶满砖沿；砖内留 12px 呼吸位 */
.hero-logo { width: 72px; height: 72px; border-radius: var(--r-lg); margin-bottom: var(--sp-16); box-shadow: var(--sh-2); background: var(--card); display: flex; align-items: center; justify-content: center; }
.hero-logo-g { width: 48px; height: 48px; }
.hero-t { font-size: var(--fs-h1); line-height: var(--lh-h1); font-weight: 600; color: var(--ink); }
.hero-s { margin-top: var(--sp-8); font-size: var(--fs-sub); color: var(--ink-2); }
.seg { margin-bottom: var(--sp-16); }
.field { margin-bottom: var(--sp-12); }
.ferr { display: block; margin-top: var(--sp-4); padding-left: var(--sp-12); font-size: var(--fs-sub); color: var(--bad-strong); }
.fnote { display: block; margin-top: var(--sp-4); padding-left: var(--sp-12); font-size: var(--fs-sub); color: var(--ink-3); }
.primary { margin-top: var(--sp-8); }
.sso { margin-top: var(--sp-12); }
.note { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); color: var(--ink-3); text-align: center; }
.err { display: block; margin-top: var(--sp-12); font-size: var(--fs-sub); color: var(--bad-strong); text-align: center; }
</style>
