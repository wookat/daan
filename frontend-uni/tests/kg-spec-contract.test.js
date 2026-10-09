// kg-* 双端组件契约：跑 tools/check_kg_spec.mjs（同一断言也供 mp 侧直接 node 执行）。
// 任一端改了组件的公共 props/事件而不同步另一端（或不在 shared/kg-spec.json 登记漂移）即失败。
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('kg-spec contract (mp vs h5)', () => {
  it('both ends expose the declared props and events', () => {
    const out = execSync('node tools/check_kg_spec.mjs', { cwd: ROOT, encoding: 'utf8' });
    expect(out).toContain('kg-spec contract OK');
  });
});
