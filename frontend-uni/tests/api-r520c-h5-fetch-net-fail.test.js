// R520c（R519 补漏）：H5 分支 exportPdf / streamExplain / streamInterview / streamInterviewReviewRegen 走原生 fetch + 流读取，
// 网络层失败抛的是浏览器英文 TypeError（Chrome「Failed to fetch」），不经 uni.request fail 回调 → R519 的中文映射覆盖不到，
// 生产 e0b9c919 点「确认导出」被拦下后 toast 即「导出失败：Failed to fetch」。现在四处 fetch 与三处 reader.read() 统一经
// fetchNet / readNet 落到 netFailMessage('') = NET_FAIL_TEXT；HTTP 非 2xx / SSE error 事件 / 访问码分支不受影响。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { netFailMessage, NET_FAIL_TEXT, NET_TIMEOUT_TEXT, isNetMsg, failBannerText } from '../src/api-policy';

const API = readFileSync(new URL('../src/api.js', import.meta.url), 'utf8');
const ASK = readFileSync(new URL('../src/pages/ask/ask.vue', import.meta.url), 'utf8');

// 生产 36ed9af1 复采命中：问答页失败横幅原判据 error.includes('再试')，网络文案以「重试」结尾 →
// 「失败：网络错误，请检查网络后重试，请重试」双尾。判据收敛到 api-policy.failBannerText（再试|重试 均不追加）。
describe('问答页失败横幅：网络文案不再双「请重试」', () => {
  it('failBannerText：自带再试/重试结尾不追加，其它错误追加「，请重试」', () => {
    expect(failBannerText(NET_FAIL_TEXT)).toBe('失败：网络错误，请检查网络后重试');
    expect(failBannerText(NET_TIMEOUT_TEXT)).toBe('失败：请求超时，请稍后重试');
    expect(failBannerText('模型繁忙，请稍后再试')).toBe('失败：模型繁忙，请稍后再试');
    expect(failBannerText('HTTP 502')).toBe('失败：HTTP 502，请重试');
    expect(failBannerText('生成失败')).toBe('失败：生成失败，请重试');
    expect(failBannerText('')).toBe('失败：，请重试');
    expect(failBannerText(NET_FAIL_TEXT)).not.toMatch(/重试，请重试/);
  });
  it('ask.vue 两处 kg-banner 均用 errorText 计算属性（源锁），不再内联 includes(再试)', () => {
    expect((ASK.match(/<kg-banner v-if="error"[^\n]*:text="errorText"/g) || []).length).toBe(2);
    expect(ASK).not.toMatch(/error\.includes\('再试'\)/);
    expect(ASK).toMatch(/errorText\(\) \{\s*return failBannerText\(this\.error\);/);
    expect(ASK).toMatch(/import \{ failBannerText \} from '\.\.\/\.\.\/api-policy\.js';/);
  });
});

describe('api.js H5 原生 fetch 网络失败 → 中文口径', () => {
  it('不再有裸 fetch(BASE_URL …)；四个 H5 端点全经 fetchNet', () => {
    expect(API).not.toMatch(/await fetch\(BASE_URL/);
    expect((API.match(/await fetchNet\(BASE_URL/g) || []).length).toBe(4);
    for (const p of ['/api/export/pdf', '/api/explain/stream', '/api/interview/answer/stream', "'/review/stream'"]) {
      expect(API).toMatch(new RegExp(`fetchNet\\(BASE_URL \\+ [^\\n]*${p.replace(/[/'.]/g, '\\$&')}`));
    }
  });
  it('三处 SSE 循环的 reader.read() 全经 readNet（流中途断网同样落中文）', () => {
    expect(API).not.toMatch(/const \{ done, value \} = await reader\.read\(\)/);
    expect((API.match(/const \{ done, value \} = await readNet\(reader\)/g) || []).length).toBe(3);
  });
  it('fetchNet / readNet 只吞网络层异常并改抛 netFailMessage(\'\')，不改 HTTP 非 2xx / SSE error 路径', () => {
    expect(API).toMatch(/async function fetchNet\(url, init\) \{\s*try \{\s*return await fetch\(url, init\);\s*\} catch \(e\) \{\s*throw new Error\(netFailMessage\(''\)\);/);
    expect(API).toMatch(/async function readNet\(reader\) \{\s*try \{\s*return await reader\.read\(\);\s*\} catch \(e\) \{\s*throw new Error\(netFailMessage\(''\)\);/);
    expect(API).toContain("if (!resp.ok) {\n    let msg = 'HTTP ' + resp.status;");
    expect(API).toContain("else if (type === 'error') throw new Error(data.message || state.errMsg || '生成失败');");
  });
  it('映射产出 = NET_FAIL_TEXT，仍在 isNetMsg 集合内；浏览器英文原文本身不在集合内（即此前会被判成非网络错误）', () => {
    expect(netFailMessage('')).toBe(NET_FAIL_TEXT);
    expect(isNetMsg(NET_FAIL_TEXT)).toBe(true);
    expect(isNetMsg('Failed to fetch')).toBe(false);
    expect(isNetMsg('Load failed')).toBe(false);
  });
});
