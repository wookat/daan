// R520c（R519 补漏）：H5 分支 exportPdf / streamExplain / streamInterview / streamInterviewReviewRegen 走原生 fetch + 流读取，
// 网络层失败抛的是浏览器英文 TypeError（Chrome「Failed to fetch」），不经 uni.request fail 回调 → R519 的中文映射覆盖不到，
// 生产 e0b9c919 点「确认导出」被拦下后 toast 即「导出失败：Failed to fetch」。现在四处 fetch 与三处 reader.read() 统一经
// fetchNet / readNet 落到 netFailMessage('') = NET_FAIL_TEXT；HTTP 非 2xx / SSE error 事件 / 访问码分支不受影响。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { netFailMessage, NET_FAIL_TEXT, isNetMsg } from '../src/api-policy';

const API = readFileSync(new URL('../src/api.js', import.meta.url), 'utf8');

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
