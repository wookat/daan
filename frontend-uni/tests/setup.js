// 测试环境准备：仓库内源码/测试文件存在 CRLF 行尾（Windows 提交历史），
// 审计类测试对源码做字符串/正则匹配，此处把 readFileSync 的文本结果统一归一为 LF，
// 使断言与行尾无关（buffer/二进制结果不处理）。
import { vi } from 'vitest';

async function lfWrap(importOriginal) {
  const m = await importOriginal();
  const orig = m.readFileSync;
  const wrapped = (p, opts) => {
    const res = orig(p, opts);
    const enc = typeof opts === 'string' ? opts : opts && opts.encoding;
    return enc && typeof res === 'string' ? res.replace(/\r\n/g, '\n') : res;
  };
  return {
    ...m,
    readFileSync: wrapped,
    default: { ...(m.default || m), readFileSync: wrapped },
  };
}

vi.mock('node:fs', lfWrap);
vi.mock('fs', lfWrap);
