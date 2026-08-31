import { describe, expect, it } from 'vitest';

import { md } from '../src/md.js';

describe('md（AI 答案渲染，v-html 唯一入口）', () => {
  it('HTML 转义：& 与 < 必须被转义（XSS 面）', () => {
    const out = md('<script>alert(1)</script> A&B');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script');
    expect(out).toContain('A&amp;B');
  });

  it('段落与粗体/行内码', () => {
    const out = md('普通段落 **重点** 与 `code`');
    expect(out).toContain('<p ');
    expect(out).toContain('<b ');
    expect(out).toContain('>重点</b>');
    expect(out).toContain('>code</span>');
  });

  it('标题层级：#/## 渲染 h2，### 渲染 h3，#### 渲染 h4', () => {
    expect(md('# 一级')).toContain('<h2 ');
    expect(md('## 二级')).toContain('<h2 ');
    expect(md('### 三级')).toContain('<h3 ');
    expect(md('#### 四级')).toContain('<h4 ');
  });

  it('「第N步」标题渲染徽标', () => {
    const out = md('### 第一步：审题');
    expect(out).toContain('第一步</span>');
    expect(out).toContain('>审题</span>');
  });

  it('无序/有序列表成组闭合', () => {
    const ul = md('- 甲\n- 乙\n\n尾段');
    expect(ul.match(/<ul /g)).toHaveLength(1);
    expect(ul.match(/<li /g)).toHaveLength(2);
    expect(ul).toContain('</ul>');
    const ol = md('1. 甲\n2、 乙');
    expect(ol.match(/<ol /g)).toHaveLength(1);
    expect(ol.match(/<li /g)).toHaveLength(2);
  });

  it('表格：分隔行忽略、单元格拆分', () => {
    const out = md('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(out.match(/<tr>/g)).toHaveLength(2);
    expect(out.match(/<td>/g)).toHaveLength(4);
  });

  it('代码块：闭合与未闭合都渲染且不解析内部 markdown', () => {
    const closed = md('```\n# 不是标题\n```');
    expect(closed).not.toContain('<h2');
    expect(closed).toContain('# 不是标题');
    const open = md('```\n悬空代码');
    expect(open).toContain('悬空代码');
  });

  it('空输入返回空串', () => {
    expect(md('')).toBe('');
    expect(md(null)).toBe('');
  });
});
