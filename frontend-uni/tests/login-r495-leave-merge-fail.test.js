// R495：登录页登录/注册/SSO 成功后用 navigateBack({ fail }) 回上一页、fail 才回统计页；
// 但 uni-h5 的 navigateBack 只是 history.go(-1) 且永不 reject（R379 练习页同根因），
// 刷新/深链直达（页面栈仅 1 页）时用户会停在登录页、表单原样、无任何反馈。
// 另：匿名记录合并失败原先只 catch 不提示，用户拿不到「合并没成」这条信息。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(new URL('../src/pkgA/user/login.vue', import.meta.url), 'utf8');

function method(name) {
  const m = SRC.match(new RegExp(`\\n {4}(?:async )?${name}\\([^)]*\\) \\{[\\s\\S]*?\\n {4}\\},`));
  expect(m, name).not.toBeNull();
  return m[0];
}

describe('login.vue 成功后离开 + 合并失败提示', () => {
  it('leave() 按页面栈深度分流：>1 才 navigateBack，否则 switchTab 统计页', () => {
    const body = method('leave');
    expect(body).toMatch(/if \(getCurrentPages\(\)\.length > 1\) uni\.navigateBack\(/);
    expect(body).toMatch(/else uni\.switchTab\(\{ url: '\/pages\/stats\/stats' \}\)/);
  });

  it('submit / ssoLogin 成功路径都走 this.leave()，不再直接 navigateBack', () => {
    for (const name of ['submit', 'ssoLogin']) {
      const body = method(name);
      expect(body, name).toMatch(/setTimeout\(\(\) => this\.leave\(\), 1200\)/);
      expect(body, name).not.toMatch(/uni\.navigateBack/);
    }
  });

  it('mergeAnon 失败不阻断登录，但必须 toast 告知并给出再合并途径', () => {
    for (const name of ['submit', 'ssoLogin']) {
      const body = method(name);
      expect(body, name).toMatch(/await mergeAnon\(anon\);[\s\S]*?catch \(e\) \{\n\s*uni\.showToast\(\{ title: MERGE_FAIL_TIP, icon: 'none'/);
    }
    expect(SRC).toMatch(/const MERGE_FAIL_TIP = '已登录，但本机记录合并失败；退出后重新登录会再次合并'/);
  });
});
