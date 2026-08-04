/* B06 内容治理：答案分布监控 / 损坏题统计 / 疑似重复题 / 差评缓存 */
(function () {
  const { api, esc, modTag, toast, fmtDay } = Admin;

  function distBar(dist) {
    const colors = { A: 'var(--mod-shuliang)', B: 'var(--mod-ziliao)', C: 'var(--mod-changshi)', D: 'var(--mod-yanyu)' };
    const total = Object.values(dist || {}).reduce((a, b) => a + b, 0);
    if (!total) return '<span style="color:var(--t4);font-size:12px">—</span>';
    return `<div class="row" style="gap:8px"><div class="stackbar">${['A', 'B', 'C', 'D'].map((k) =>
      dist[k] ? `<i style="width:${dist[k] * 100 / total}%;background:${colors[k]}" title="${k}: ${dist[k]} (${(dist[k] * 100 / total).toFixed(1)}%)"></i>` : '').join('')}</div>
      <span style="font-size:11px;color:var(--t3)">${['A', 'B', 'C', 'D'].map((k) => `${k} ${(100 * (dist[k] || 0) / total).toFixed(0)}%`).join(' / ')}</span></div>`;
  }

  async function render(el) {
    const g = await api('/api/admin/governance');
    const skewed = g.answer_dist.batches.filter((b) => {
      const t = Object.values(b.dist).reduce((a, x) => a + x, 0);
      return t >= 20 && Math.max(0, ...Object.values(b.dist)) / t > 0.4;
    });
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>内容治理</h1><div class="sub">质量巡检 · 扫描缓存 10 分钟 · 生成于 ${new Date(g.generated_at * 1000).toLocaleTimeString('zh-CN')}</div></div>
      <div class="acts"><button class="btn btn-ghost" id="gov-rescan">▶ 立即扫描</button></div>
    </div>
    <div class="kpis" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi"><div class="lb">损坏题</div><div class="v" style="color:${g.broken.length ? 'var(--error)' : 'var(--success)'}">${g.broken.length}${g.broken.length >= 100 ? '+' : ''}</div><div class="d flat">空题干/选项异常/答案越界</div></div>
      <div class="kpi"><div class="lb">疑似重复题组</div><div class="v" style="color:${g.clones.length ? 'var(--warning)' : 'var(--success)'}">${g.clones.length}</div><div class="d flat">题干前 40 字相同</div></div>
      <div class="kpi"><div class="lb">答案分布偏斜批次</div><div class="v" style="color:${skewed.length ? 'var(--warning)' : 'var(--success)'}">${skewed.length}</div><div class="d flat">单选项占比 > 40%</div></div>
      <div class="kpi"><div class="lb">缺解析题</div><div class="v">${g.missing_explanation.toLocaleString()}</div><div class="d flat">无解析且无 AI 精讲</div></div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div class="card-h"><span class="t">全库答案分布（上架题）</span></div>
      ${distBar(g.answer_dist.overall)}
      <div class="card-h" style="margin-top:16px"><span class="t">近 12 个批次答案分布</span></div>
      <table class="tbl"><thead><tr><th>批次</th><th style="width:55%">分布</th><th style="width:70px">状态</th></tr></thead><tbody>
        ${g.answer_dist.batches.map((b) => {
          const t = Object.values(b.dist).reduce((a, x) => a + x, 0);
          const skew = t >= 20 && Math.max(0, ...Object.values(b.dist)) / t > 0.4;
          return `<tr><td>${esc(b.batch)}</td><td>${distBar(b.dist)}</td>
            <td>${skew ? '<span class="tag tag-warn">偏斜</span>' : '<span class="tag tag-ok">正常</span>'}</td></tr>`;
        }).join('') || '<tr><td colspan="3" style="color:var(--t4)">暂无批次</td></tr>'}</tbody></table>
    </div>
    <div class="split-2" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card" style="padding:0">
        <div class="card-h" style="padding:14px 16px 0"><span class="t">损坏题清单</span></div>
        ${g.broken.length ? `<table class="tbl"><thead><tr><th style="width:66px">ID</th><th>题干</th><th>问题</th><th style="width:56px"></th></tr></thead><tbody>
          ${g.broken.slice(0, 30).map((b) => `<tr><td>#${b.id}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.question || '（空）')}</td>
            <td>${b.problems.map((p) => `<span class="tag tag-bad">${esc(p)}</span>`).join(' ')}</td>
            <td><a href="#/questions?id=${b.id}" style="color:var(--brand-600)">编辑</a></td></tr>`).join('')}</tbody></table>`
          : '<div class="empty"><div class="eico">✅</div>未发现损坏题</div>'}
      </div>
      <div class="card" style="padding:0">
        <div class="card-h" style="padding:14px 16px 0"><span class="t">疑似重复题（同前缀）</span></div>
        ${g.clones.length ? `<table class="tbl"><thead><tr><th>题干前缀</th><th style="width:52px">题数</th><th style="width:70px">答案数</th><th>题目 ID</th></tr></thead><tbody>
          ${g.clones.slice(0, 30).map((c) => `<tr>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.prefix)}">${esc(c.prefix)}</td>
            <td>${c.n}</td>
            <td>${c.answers > 1 ? `<span class="tag tag-bad">${c.answers} 种</span>` : '<span class="tag tag-gray">1 种</span>'}</td>
            <td style="font-size:12px">${String(c.ids).split(',').slice(0, 6).map((id) => `<a href="#/questions?id=${id}" style="color:var(--brand-600)">#${id}</a>`).join(' ')}</td></tr>`).join('')}</tbody></table>`
          : '<div class="empty"><div class="eico">✅</div>未发现疑似重复题</div>'}
      </div>
    </div>
    <div class="card" style="padding:0">
      <div class="card-h" style="padding:14px 16px 0"><span class="t">AI 解析差评缓存</span><span class="sub" style="font-size:12px;color:var(--t3)">被用户点踩的缓存解析，删除后下次将重新生成</span></div>
      <div id="gv-cache"><div class="empty">加载中…</div></div>
    </div>`;
    api('/api/admin/flagged_cache').then((r) => {
      const box = document.getElementById('gv-cache');
      if (!box) return;
      box.innerHTML = r.items.length ? `<table class="tbl"><thead><tr>
        <th>题干</th><th style="width:80px">模块</th><th style="width:100px">👍/👎/命中</th><th style="width:70px"></th></tr></thead><tbody>
        ${r.items.map((c) => `<tr>
          <td style="max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.question_text)}">${esc(c.question_text)}</td>
          <td>${modTag(c.module)}</td><td>${c.up} / <b style="color:var(--error)">${c.down}</b> / ${c.hits}</td>
          <td><a data-del="${esc(c.key)}" style="color:var(--error);cursor:pointer">删除</a></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty"><div class="eico">✅</div>暂无差评缓存</div>';
      box.querySelectorAll('[data-del]').forEach((a) => {
        a.onclick = async () => {
          if (!confirm('删除该缓存解析？')) return;
          await api('/api/admin/cache/' + encodeURIComponent(a.dataset.del), { method: 'DELETE' });
          toast('已删除');
          a.closest('tr').remove();
        };
      });
    });
    el.querySelector('#gov-rescan').onclick = () => { toast('重新扫描中…'); render(el); };
  }

  Admin.registerPage('governance', { title: '内容治理', crumb: '内容 / 内容治理', render });
})();
