// 轻量 Markdown → HTML（供 rich-text / v-html 使用）
function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<b style="color:#d14">$1</b>')
    .replace(/`(.+?)`/g, '<span style="background:#f0f2f8;border-radius:4px;padding:1px 5px">$1</span>');
}

export function md(s) {
  s = (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = s.split('\n');
  let out = '', inUl = 0, inOl = 0, inTable = 0;
  const close = () => {
    if (inUl) { out += '</ul>'; inUl = 0; }
    if (inOl) { out += '</ol>'; inOl = 0; }
    if (inTable) { out += '</table>'; inTable = 0; }
  };
  for (const l of lines) {
    if (/^\s*\|/.test(l)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue;
      if (!inTable) { close(); out += '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:13px;margin:8px 0">'; inTable = 1; }
      out += '<tr>' + l.replace(/^\s*\||\|\s*$/g, '').split('|').map((c) => '<td>' + inline(c.trim()) + '</td>').join('') + '</tr>';
      continue;
    }
    if (inTable) { out += '</table>'; inTable = 0; }
    if (/^###\s/.test(l)) { close(); out += '<h3 style="font-size:15px;margin:10px 0 4px">' + inline(l.slice(4)) + '</h3>'; }
    else if (/^##\s/.test(l)) { close(); out += '<h2 style="font-size:16px;margin:14px 0 6px;color:#2f6fed">' + inline(l.slice(3)) + '</h2>'; }
    else if (/^#\s/.test(l)) { close(); out += '<h2 style="font-size:16px;margin:14px 0 6px;color:#2f6fed">' + inline(l.slice(2)) + '</h2>'; }
    else if (/^\s*[-*]\s/.test(l)) { if (!inUl) { close(); out += '<ul style="padding-left:20px">'; inUl = 1; } out += '<li style="font-size:15px;line-height:1.65">' + inline(l.replace(/^\s*[-*]\s/, '')) + '</li>'; }
    else if (/^\s*\d+[.、]\s/.test(l)) { if (!inOl) { close(); out += '<ol style="padding-left:20px">'; inOl = 1; } out += '<li style="font-size:15px;line-height:1.65">' + inline(l.replace(/^\s*\d+[.、]\s/, '')) + '</li>'; }
    else if (l.trim() === '') { close(); }
    else { close(); out += '<p style="font-size:15px;line-height:1.65;margin:4px 0">' + inline(l) + '</p>'; }
  }
  close();
  return out;
}
