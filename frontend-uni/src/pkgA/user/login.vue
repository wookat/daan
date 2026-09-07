<template>
  <view class="wrap">
    <view class="hero">
      <image class="hero-logo" src="/static/brand/kaogong.svg" mode="aspectFit" aria-hidden="true" />
      <text class="hero-t">错题邦</text>
      <text class="hero-s">登录后错题、做题记录多端同步，本机记录自动合并</text>
    </view>

    <view class="card">
      <view class="seg">
        <view class="seg-item" :class="{ on: mode === 'login' }" @click="mode = 'login'">登录</view>
        <view class="seg-item" :class="{ on: mode === 'register' }" @click="mode = 'register'">注册</view>
      </view>

      <view class="field">
        <text class="label">手机号</text>
        <input class="input" type="number" maxlength="11" v-model="phone" placeholder="请输入 11 位手机号" />
      </view>
      <view class="field">
        <text class="label">密码</text>
        <input class="input" password v-model="password" placeholder="6-64 位密码" />
      </view>
      <view v-if="mode === 'register'" class="field">
        <text class="label">昵称（选填）</text>
        <input class="input" maxlength="20" v-model="nickname" placeholder="给自己起个名字" />
      </view>
      <view v-if="mode === 'register'" class="sms-note">短信验证码功能即将上线，当前注册无需验证码</view>

      <button class="primary" :disabled="busy" @click="submit">
        {{ busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并合并本机记录' }}
      </button>
      <!-- #ifdef H5 -->
      <button class="sso" :disabled="busy" @click="ssoLogin">Zalize 统一账号一键登录</button>
      <view class="sso-note">已在 account.zalize.com 登录过心动简历/速申等站点？可直接一键登录并合并本机记录</view>
      <!-- #endif -->
      <view v-if="err" class="err">{{ err }}</view>
    </view>
  </view>
</template>

<script>
import { authLogin, authRegister, authSso, mergeAnon, setAuth, trackEvent } from '../../api.js';

const MERGE_FAIL_TIP = '已登录，但本机记录合并失败；退出后重新登录会再次合并';

export default {
  data() {
    return { mode: 'login', phone: '', password: '', nickname: '', busy: false, err: '' };
  },
  methods: {
    leave() {
      // H5 的 navigateBack 只是 history.go(-1) 且永不 fail：深链/刷新直达（页面栈仅 1 页）时会停在登录页
      if (getCurrentPages().length > 1) uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/stats/stats' }) });
      else uni.switchTab({ url: '/pages/stats/stats' });
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
      if (!/^1\d{10}$/.test(this.phone)) {
        this.err = '请输入 11 位手机号';
        return;
      }
      if (this.password.length < 6) {
        this.err = '密码至少 6 位';
        return;
      }
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
.wrap {
  min-height: 100vh;
  background: var(--fill);
  padding: 24rpx;
  box-sizing: border-box;
}
.hero {
  padding: 64rpx 16rpx 44rpx;
  text-align: center;
}
.hero-logo {
  width: 144rpx;
  height: 144rpx;
  border-radius: 44rpx;
  margin: 0 auto 28rpx;
  display: block;
  box-shadow: 0 16rpx 40rpx rgba(46, 91, 255, 0.35);
}
.hero-t {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: var(--ink);
}
.hero-s {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--ink-2);
}
.card {
  background: var(--card);
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(27, 34, 51, 0.05);
}
.seg {
  display: flex;
  background: var(--fill);
  border-radius: 16rpx;
  padding: 6rpx;
  margin-bottom: 32rpx;
}
.seg-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  box-sizing: border-box;
  text-align: center;
  padding: 18rpx 0;
  font-size: 30rpx;
  color: var(--ink-2);
  border-radius: 12rpx;
}
.seg-item.on {
  background: var(--card);
  color: var(--brand-text);
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(46, 91, 255, 0.15);
}
.field {
  margin-bottom: 28rpx;
}
.label {
  display: block;
  font-size: 26rpx;
  color: var(--ink-2);
  margin-bottom: 12rpx;
}
.input {
  height: 88rpx;
  line-height: 88rpx;
  background: var(--fill);
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
}
.sms-note {
  font-size: 24rpx;
  color: var(--ink-4);
  margin: -8rpx 0 24rpx;
}
.primary {
  margin-top: 12rpx;
  height: 92rpx;
  line-height: 92rpx;
  background: var(--brand);
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  border-radius: 18rpx;
}
.primary[disabled] {
  opacity: 0.6;
  color: #fff;
}
.sso {
  margin-top: 20rpx;
  height: 92rpx;
  line-height: 92rpx;
  background: var(--card);
  color: var(--brand-text);
  border: 2rpx solid var(--brand);
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 18rpx;
}
.sso-note {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: var(--ink-3);
  text-align: center;
}
.err {
  margin-top: 20rpx;
  color: #e5484d;
  font-size: 26rpx;
  text-align: center;
}
</style>
