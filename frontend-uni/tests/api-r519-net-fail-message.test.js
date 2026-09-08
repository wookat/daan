// R519（R517-2 / R518-2）：uni.request fail 回调的 errMsg（request:fail / request:fail timeout / uploadFile:fail）
// 此前原样进 Error.message，全站 toast「提交失败：request:fail」直接给真人看；现在在网络层统一成中文，
// 且产出必须仍被 isTimeoutMsg / isNetMsg / trackRetryable / submitFailPlan 判为超时/网络错误——分类与重试口径不变。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { netFailMessage, NET_FAIL_TEXT, NET_TIMEOUT_TEXT, isTimeoutMsg, isNetMsg, trackRetryable } from '../src/api-policy';
import { submitFailPlan } from '../src/exam-policy';

const API = readFileSync(new URL('../src/api.js', import.meta.url), 'utf8');

describe('netFailMessage', () => {
  it('平台 :fail 原文 → 中文；timeout 单列', () => {
    expect(netFailMessage('request:fail')).toBe(NET_FAIL_TEXT);
    expect(netFailMessage('request:fail abort')).toBe(NET_FAIL_TEXT);
    expect(netFailMessage('request:fail timeout')).toBe(NET_TIMEOUT_TEXT);
    expect(netFailMessage('timeout of 12000ms')).toBe(NET_TIMEOUT_TEXT);
    expect(netFailMessage('uploadFile:fail', '上传失败，请检查网络后重试')).toBe('上传失败，请检查网络后重试');
    expect(netFailMessage(undefined)).toBe(NET_FAIL_TEXT);
    expect(netFailMessage('')).toBe(NET_FAIL_TEXT);
  });
  it('非平台原文（已是可读文案）原样透出', () => {
    expect(netFailMessage('网络错误')).toBe('网络错误');
    expect(netFailMessage('证书校验失败')).toBe('证书校验失败');
  });
  it('产出仍在现有分类集合内：超时 → isTimeoutMsg；两者 → isNetMsg / trackRetryable / submitFailPlan 网络分支', () => {
    expect(isTimeoutMsg(NET_TIMEOUT_TEXT)).toBe(true);
    expect(isTimeoutMsg(NET_FAIL_TEXT)).toBe(false);
    for (const t of [NET_TIMEOUT_TEXT, NET_FAIL_TEXT]) {
      expect(isNetMsg(t)).toBe(true);
      expect(trackRetryable(t)).toBe(true);
      expect(/request:fail/.test(t)).toBe(false);
    }
    // 模考交卷：与 'request:fail timeout' / 'request:fail' 同判定（exam-policy.test 既有用例的镜像）
    expect(submitFailPlan({ message: NET_TIMEOUT_TEXT, timeUp: false, tries: 0 })).toEqual(submitFailPlan({ message: 'request:fail timeout', timeUp: false, tries: 0 }));
    expect(submitFailPlan({ message: NET_FAIL_TEXT, timeUp: true, tries: 3 })).toEqual(submitFailPlan({ message: 'request:fail', timeUp: true, tries: 3 }));
  });
});

describe('api.js 所有 uni fail 回调都经 netFailMessage', () => {
  it('不再有 err.errMsg || 直接进 Error', () => {
    expect(API).not.toMatch(/new Error\(err\.errMsg \|\|/);
    expect(API).toContain("fail: (err) => reject(new Error(netFailMessage(err && err.errMsg))),");
    expect((API.match(/netFailMessage\(err && err\.errMsg/g) || []).length).toBe(5);
  });
  it('GET 超时自动重试仍按 isTimeoutErr 判（映射后的超时文案含「超时」）', () => {
    expect(API).toContain('if (!isTimeoutErr(e)) throw e;');
    expect(API).toContain("const isTimeoutErr = (e) => isTimeoutMsg(e && e.message);");
  });
});
