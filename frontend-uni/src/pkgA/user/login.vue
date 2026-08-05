<template>
  <view class="wrap">
    <view class="hero">
      <view class="hero-logo">📘</view>
      <text class="hero-t">考公错题助手</text>
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
      <view v-if="err" class="err">{{ err }}</view>
    </view>
  </view>
</template>

<script>
import { authLogin, authRegister, mergeAnon, setAuth } from '../../api.js';

export default {
  data() {
    return { mode: 'login', phone: '', password: '', nickname: '', busy: false, err: '' };
  },
  methods: {
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
            : await authRegister(this.phone, this.password, '');
        setAuth(r.token, r.user);
        if (anon && anon !== r.user.uid) {
          try {
            await mergeAnon(anon);
            uni.showToast({ title: '本机记录已合并到账号', icon: 'success', duration: 2000 });
          } catch (e) {
            /* 合并失败不阻断登录 */
          }
        } else {
          uni.showToast({ title: this.mode === 'login' ? '登录成功' : '注册成功', icon: 'success' });
        }
        setTimeout(() => uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/stats/stats' }) }), 1200);
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
  background: linear-gradient(135deg, #5b8af8, #3b6ff5);
  margin: 0 auto 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 68rpx;
  box-shadow: 0 16rpx 40rpx rgba(59, 111, 245, 0.35);
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
  color: var(--ink-3);
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
  text-align: center;
  padding: 18rpx 0;
  font-size: 30rpx;
  color: var(--ink-3);
  border-radius: 12rpx;
}
.seg-item.on {
  background: var(--card);
  color: var(--brand);
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(59, 111, 245, 0.15);
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
.err {
  margin-top: 20rpx;
  color: #e5484d;
  font-size: 26rpx;
  text-align: center;
}
</style>
