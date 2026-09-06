// 轻量 Markdown → HTML（供 rich-text nodes 使用），规则与 H5 frontend-uni/src/md.js 一致；
// 颜色改用语义 token 变量以跟随深色模式（webview 渲染下 rich-text 内联样式可解析 var(--*)）。
function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<b style="color:var(--bad-strong)">$1</b>')
    .replace(/`(.+?)`/g, '<span style="background:var(--fill);border-radius:4px;padding:1px 5px">$1</span>');
}

const CODE_STYLE =
  'font-family:ui-monospace,Menlo,Consolas,monospace;background:var(--brand-soft);border-left:5px solid var(--brand);' +
  'border-radius:8px;padding:10px 12px;font-size:14px;line-height:1.8;margin:10px 0;white-space:pre-wrap;word-break:break-all;color:var(--brand-text)';

export function md(src: string | null | undefined): string {
  const s = (src || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = s.split('\n');
  let out = '';
  let inUl = 0;
  let inOl = 0;
  let inTable = 0;
  let inCode = 0;
  let codeBuf: string[] = [];
  const close = () => {
    if (inUl) {
      out += '</ul>';
      inUl = 0;
    }
    if (inOl) {
      out += '</ol>';
      inOl = 0;
    }
    if (inTable) {
      out += '</table>';
      inTable = 0;
    }
  };
  for (const l of lines) {
    if (/^\s*```/.test(l)) {
      if (!inCode) {
        close();
        inCode = 1;
        codeBuf = [];
      } else {
        out += '<div style="' + CODE_STYLE + '">' + codeBuf.join('\n') + '</div>';
        inCode = 0;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(l);
      continue;
    }
    if (/^\s*\|/.test(l)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue;
      if (!inTable) {
        close();
        out += '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:13px;margin:8px 0">';
        inTable = 1;
      }
      out +=
        '<tr>' +
        l
          .replace(/^\s*\||\|\s*$/g, '')
          .split('|')
          .map((c) => '<td>' + inline(c.trim()) + '</td>')
          .join('') +
        '</tr>';
      continue;
    }
    if (inTable) {
      out += '</table>';
      inTable = 0;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) {
      close();
      out += '<hr style="border:none;border-top:1px solid var(--line);margin:12px 0">';
    } else if (/^#{4,6}\s/.test(l)) {
      close();
      out += '<h4 style="font-size:14px;margin:8px 0 4px">' + inline(l.replace(/^#{4,6}\s/, '')) + '</h4>';
    } else if (/^###\s/.test(l)) {
      close();
      const t = l.slice(4).trim();
      const st = /^第\s*([0-9一二三四五六七八九十]+)\s*步\s*[：:]?\s*(.*)$/.exec(t);
      if (st) {
        out +=
          '<div style="display:flex;align-items:center;margin:16px 0 6px"><span style="background:var(--brand);color:var(--on-brand);border-radius:999px;font-size:12px;font-weight:600;padding:2px 12px;margin-right:8px;flex-shrink:0">第' +
          st[1] +
          '步</span><span style="font-size:15px;font-weight:600">' +
          inline(st[2]) +
          '</span></div>';
      } else {
        out += '<h3 style="font-size:15px;margin:10px 0 4px">' + inline(t) + '</h3>';
      }
    } else if (/^##\s/.test(l)) {
      close();
      out += '<h2 style="font-size:16px;margin:14px 0 6px;color:var(--brand-text)">' + inline(l.slice(3)) + '</h2>';
    } else if (/^#\s/.test(l)) {
      close();
      out += '<h2 style="font-size:16px;margin:14px 0 6px;color:var(--brand-text)">' + inline(l.slice(2)) + '</h2>';
    } else if (/^\s*>\s?/.test(l)) {
      close();
      out +=
        '<div style="border-left:3px solid var(--line);padding:2px 12px;margin:6px 0;color:var(--ink-2);font-size:15px;line-height:1.65">' +
        inline(l.replace(/^\s*>\s?/, '')) +
        '</div>';
    } else if (/^\s*[-*]\s/.test(l)) {
      if (!inUl) {
        close();
        out += '<ul style="padding-left:20px">';
        inUl = 1;
      }
      out += '<li style="font-size:15px;line-height:1.65">' + inline(l.replace(/^\s*[-*]\s/, '')) + '</li>';
    } else if (/^\s*\d+[.、]\s/.test(l)) {
      if (!inOl) {
        close();
        out += '<ol style="padding-left:20px">';
        inOl = 1;
      }
      out += '<li style="font-size:15px;line-height:1.65">' + inline(l.replace(/^\s*\d+[.、]\s/, '')) + '</li>';
    } else if (l.trim() === '') {
      close();
    } else {
      close();
      out += '<p style="font-size:15px;line-height:1.65;margin:4px 0">' + inline(l) + '</p>';
    }
  }
  if (inCode && codeBuf.length) {
    out += '<div style="' + CODE_STYLE + '">' + codeBuf.join('\n') + '</div>';
  }
  close();
  return out;
}

// 去掉模型停止符
export function stripStop(s: string | null | undefined): string {
  return (s || '').replace(/<\|[a-z_]+\|>/gi, '').trimEnd();
}

export interface AnsCard {
  ans: string;
  method: string;
  brief: string;
}
// 与 H5 ask.vue splitAnswer 同规则：抽取首部「【答案】｜【方法】｜【一句话】」为答案卡
export function splitAnswer(full: string): { card: AnsCard | null; rest: string } {
  const text = full || '';
  const m = /^\s*【答案】\s*([^｜|\n]+?)\s*[｜|]\s*【方法】\s*([^｜|\n]+?)\s*[｜|]\s*【一句话】\s*([^\n]*)\n?/.exec(text);
  if (m) return { card: { ans: m[1].trim(), method: m[2].trim(), brief: m[3].trim() }, rest: text.slice(m.index + m[0].length) };
  const lines = text.split('\n');
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const am = /【答案】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
    if (!am) continue;
    const mm = /【方法】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
    const bm = /【一句话】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
    const rest = lines.slice(0, i).concat(lines.slice(i + 1)).join('\n');
    return { card: { ans: am[1].trim(), method: mm ? mm[1].trim() : '', brief: bm ? bm[1].trim() : '' }, rest };
  }
  return { card: null, rest: text };
}
