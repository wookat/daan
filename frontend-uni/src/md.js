// 轻量 Markdown → HTML（供 rich-text / v-html 使用）
function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<b style="color:#d14">$1</b>')
    .replace(/`(.+?)`/g, '<span style="background:#f0f2f8;border-radius:4px;padding:1px 5px">$1</span>');
}

export function md(s) {
  s = (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = s.split('\n');
  let out = '', inUl = 0, inOl = 0, inTable = 0, inCode = 0, codeBuf = [];
  const close = () => {
    if (inUl) { out += '</ul>'; inUl = 0; }
    if (inOl) { out += '</ol>'; inOl = 0; }
    if (inTable) { out += '</table>'; inTable = 0; }
  };
  for (const l of lines) {
    if (/^\s*```/.test(l)) {
      if (!inCode) { close(); inCode = 1; codeBuf = []; }
      else {
        out += '<div style="font-family:ui-monospace,Menlo,Consolas,monospace;background:#eef4f7;border-left:5px solid #4d83a6;border-radius:8px;padding:10px 12px;font-size:14px;line-height:1.8;margin:10px 0;white-space:pre-wrap;word-break:break-all;color:#17394f">' + codeBuf.join('\n') + '</div>';
        inCode = 0;
      }
      continue;
    }
    if (inCode) { codeBuf.push(l); continue; }
    if (/^\s*\|/.test(l)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue;
      if (!inTable) { close(); out += '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:13px;margin:8px 0">'; inTable = 1; }
      out += '<tr>' + l.replace(/^\s*\||\|\s*$/g, '').split('|').map((c) => '<td>' + inline(c.trim()) + '</td>').join('') + '</tr>';
      continue;
    }
    if (inTable) { out += '</table>'; inTable = 0; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { close(); out += '<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">'; }
    else if (/^#{4,6}\s/.test(l)) { close(); out += '<h4 style="font-size:14px;margin:8px 0 4px">' + inline(l.replace(/^#{4,6}\s/, '')) + '</h4>'; }
    else if (/^###\s/.test(l)) {
      close();
      const t = l.slice(4).trim();
      const st = /^第\s*([0-9一二三四五六七八九十]+)\s*步\s*[：:]?\s*(.*)$/.exec(t);
      if (st) {
        out += '<div style="display:flex;align-items:center;margin:16px 0 6px"><span style="background:#1e4a6b;color:#fff;border-radius:999px;font-size:12px;font-weight:600;padding:2px 12px;margin-right:8px;flex-shrink:0">第' + st[1] + '步</span><span style="font-size:15px;font-weight:700">' + inline(st[2]) + '</span></div>';
      } else {
        out += '<h3 style="font-size:15px;margin:10px 0 4px">' + inline(t) + '</h3>';
      }
    }
    else if (/^##\s/.test(l)) { close(); out += '<h2 style="font-size:16px;margin:14px 0 6px;color:#1e4a6b">' + inline(l.slice(3)) + '</h2>'; }
    else if (/^#\s/.test(l)) { close(); out += '<h2 style="font-size:16px;margin:14px 0 6px;color:#1e4a6b">' + inline(l.slice(2)) + '</h2>'; }
    else if (/^\s*>\s?/.test(l)) { close(); out += '<div style="border-left:3px solid #e5e7eb;padding:2px 12px;margin:6px 0;color:#6b7280;font-size:15px;line-height:1.65">' + inline(l.replace(/^\s*>\s?/, '')) + '</div>'; }
    else if (/^\s*[-*]\s/.test(l)) { if (!inUl) { close(); out += '<ul style="padding-left:20px">'; inUl = 1; } out += '<li style="font-size:15px;line-height:1.65">' + inline(l.replace(/^\s*[-*]\s/, '')) + '</li>'; }
    else if (/^\s*\d+[.、]\s/.test(l)) { if (!inOl) { close(); out += '<ol style="padding-left:20px">'; inOl = 1; } out += '<li style="font-size:15px;line-height:1.65">' + inline(l.replace(/^\s*\d+[.、]\s/, '')) + '</li>'; }
    else if (l.trim() === '') { close(); }
    else { close(); out += '<p style="font-size:15px;line-height:1.65;margin:4px 0">' + inline(l) + '</p>'; }
  }
  if (inCode && codeBuf.length) {
    out += '<div style="font-family:ui-monospace,Menlo,Consolas,monospace;background:#eef4f7;border-left:5px solid #4d83a6;border-radius:8px;padding:10px 12px;font-size:14px;line-height:1.8;margin:10px 0;white-space:pre-wrap;word-break:break-all;color:#17394f">' + codeBuf.join('\n') + '</div>';
  }
  close();
  return out;
}
