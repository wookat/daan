// 轻量 Markdown → HTML（供 rich-text 使用；对齐 frontend-uni/src/md.js 的语法覆盖）
// 样式走 class（styles/md.wxss，全部 token），不写内联色值；页面 wxss 需 @import '/styles/md.wxss'。

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<b class="md-b">$1</b>')
    .replace(/`(.+?)`/g, '<span class="md-code">$1</span>');
}

export function md(src: string | null | undefined): string {
  const s = (src || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = s.split('\n');
  let out = '';
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let inCode = false;
  let codeBuf: string[] = [];
  const close = () => {
    if (inUl) {
      out += '</ul>';
      inUl = false;
    }
    if (inOl) {
      out += '</ol>';
      inOl = false;
    }
    if (inTable) {
      out += '</table>';
      inTable = false;
    }
  };
  const flushCode = () => {
    out += '<div class="md-pre">' + codeBuf.join('\n') + '</div>';
  };
  for (const l of lines) {
    if (/^\s*```/.test(l)) {
      if (!inCode) {
        close();
        inCode = true;
        codeBuf = [];
      } else {
        flushCode();
        inCode = false;
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
        out += '<table class="md-table">';
        inTable = true;
      }
      out +=
        '<tr>' +
        l
          .replace(/^\s*\||\|\s*$/g, '')
          .split('|')
          .map((c) => '<td class="md-td">' + inline(c.trim()) + '</td>')
          .join('') +
        '</tr>';
      continue;
    }
    if (inTable) {
      out += '</table>';
      inTable = false;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) {
      close();
      out += '<hr class="md-hr">';
    } else if (/^#{4,6}\s/.test(l)) {
      close();
      out += '<h4 class="md-h4">' + inline(l.replace(/^#{4,6}\s/, '')) + '</h4>';
    } else if (/^###\s/.test(l)) {
      close();
      const t = l.slice(4).trim();
      const st = /^第\s*([0-9一二三四五六七八九十]+)\s*步\s*[：:]?\s*(.*)$/.exec(t);
      if (st) {
        out +=
          '<div class="md-step"><span class="md-step-n">第' +
          st[1] +
          '步</span><span class="md-step-t">' +
          inline(st[2]) +
          '</span></div>';
      } else {
        out += '<h3 class="md-h3">' + inline(t) + '</h3>';
      }
    } else if (/^##\s/.test(l)) {
      close();
      out += '<h2 class="md-h2">' + inline(l.slice(3)) + '</h2>';
    } else if (/^#\s/.test(l)) {
      close();
      out += '<h2 class="md-h2">' + inline(l.slice(2)) + '</h2>';
    } else if (/^\s*[-*]\s/.test(l)) {
      if (!inUl) {
        close();
        out += '<ul class="md-ul">';
        inUl = true;
      }
      out += '<li class="md-li">' + inline(l.replace(/^\s*[-*]\s/, '')) + '</li>';
    } else if (/^\s*\d+[.、]\s/.test(l)) {
      if (!inOl) {
        close();
        out += '<ol class="md-ol">';
        inOl = true;
      }
      out += '<li class="md-li">' + inline(l.replace(/^\s*\d+[.、]\s/, '')) + '</li>';
    } else if (l.trim() === '') {
      close();
    } else {
      close();
      out += '<p class="md-p">' + inline(l) + '</p>';
    }
  }
  if (inCode && codeBuf.length) flushCode();
  close();
  return out;
}

// 去掉模型偶发泄漏的停止符（对齐 ask.vue stripStop）
export function stripStop(s: string | null | undefined): string {
  return (s || '').replace(/<\|[a-z_]+\|>/gi, '').trimEnd();
}

export interface AnsCard {
  ans: string;
  method: string;
  brief: string;
}

// 「【答案】A｜【方法】…｜【一句话】…」首行拆成答案卡（对齐 ask.vue splitAnswer）
export function splitAnswer(full: string): { card: AnsCard | null; rest: string } {
  const text = full || '';
  const m = /^\s*【答案】\s*([^｜|\n]+?)\s*[｜|]\s*【方法】\s*([^｜|\n]+?)\s*[｜|]\s*【一句话】\s*([^\n]*)\n?/.exec(text);
  if (m) {
    return {
      card: { ans: m[1].trim(), method: m[2].trim(), brief: m[3].trim() },
      rest: text.slice(m.index + m[0].length),
    };
  }
  const lines = text.split('\n');
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const am = /【答案】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
    if (!am) continue;
    const mm = /【方法】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
    const bm = /【一句话】\s*[:：]?\s*([^｜|【\n]+)/.exec(lines[i]);
    const rest = lines.slice(0, i).concat(lines.slice(i + 1)).join('\n');
    return {
      card: { ans: am[1].trim(), method: mm ? mm[1].trim() : '', brief: bm ? bm[1].trim() : '' },
      rest,
    };
  }
  return { card: null, rest: text };
}
