/* A01 数据看板 */
(function () {
  const { api, esc, MODS } = Admin;

  function delta(cur, prev, suffix) {
    if (!prev) return '<div class="d flat">— vs 昨日</div>';
    const pct = ((cur - prev) * 100 / prev).toFixed(1);
    if (Math.abs(pct) < 0.05) return '<div class="d flat">持平 vs 昨日</div>';
    return pct > 0
      ? `<div class="d up">▲ ${pct}%${suffix || ''} vs 昨日</div>`
      : `<div class="d dn">▼ ${Math.abs(pct)}%${suffix || ''} vs 昨日</div>`;
  }

  function spark(trend, key) {
    const max = Math.max(1, ...trend.map((r) => r[key] || 0));
    return trend.map((r, i) =>
      `<i class="${i === trend.length - 1 ? 'hi' : ''}" style="height:${Math.max(4, Math.round((r[key] || 0) * 100 / max))}%" title="${r.d}：${r[key] || 0}"></i>`
    ).join('');
  }

  function crawlerPanel(c) {
    const head = '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;font-weight:600">搜索引擎抓取（源站日志，近 7 天）</div>';
    if (!c) return head + '<div style="font-size:11px;color:var(--t4)">暂无爬虫统计（crawler-stats.json 未生成）</div>';
    const rows = (c.engines || []).map((e) => {
      const never = !e.last_seen;
      const last = never ? '从未' : esc(e.last_seen.slice(5, 16).replace('T', ' ')) + 'Z';
      const cls = never ? 'tag-bad' : e.err5xx_7d ? 'tag-warn' : e.hits_7d ? 'tag-ok' : 'tag-gray';
      const detail = never ? '0 次' : `${e.hits_7d.toLocaleString()} 次（今日 ${e.hits_today}）· 题库页 ${e.tiku_7d}${e.sitemap_7d ? ` · sitemap ${e.sitemap_7d}` : ''}${e.err5xx_7d ? ` · 5xx ${e.err5xx_7d}` : ''}`;
      return `<div class="hbar hbar-wrap"><span class="lb">${esc(e.name)}<span class="sub">最近 ${last}</span></span>
        <span class="tag ${cls}">${detail}</span></div>`;
    }).join('');
    const foot = `<div style="margin-top:6px;font-size:11px;color:${c.stale ? 'var(--error)' : 'var(--t4)'}">统计生成于 ${esc(c.generated_at || '未知')}${c.stale ? '（超过 3h 未更新，检查 crawler_stats cron）' : ''}</div>`;
    return head + humanRow(c.humans) + rows + foot;
  }

  function humanRow(hm) {
    if (!hm) return '<div style="font-size:11px;color:var(--t4);margin-bottom:4px">真人流量：等待 crawler_stats 下一次生成（旧版 JSON 无 humans 段）</div>';
    const cls = hm.api5xx_7d ? 'tag-warn' : hm.api_7d ? 'tag-ok' : 'tag-bad';
    const detail = hm.api_7d
      ? `API ${hm.api_7d.toLocaleString()} 次（今日 ${hm.api_today}）· 页面 ${hm.page_7d} · IP 日去重 ${hm.ips_7d}（今日 ${hm.ips_today}）· 5xx ${hm.api5xx_7d}`
      : '0 次（近 7 天无真人 API 请求）';
    return `<div class="hbar hbar-wrap" style="margin-bottom:4px"><span class="lb">真人<span class="sub">剔除探针网段 / 引擎与通用 bot UA / test- uid</span></span>
      <span class="tag ${cls}">${detail}</span></div>`;
  }

  async function render(el) {
    const d = await api('/api/admin/dashboard');
    const t = d.today, y = d.yesterday, h = d.health;
    const healthTag = h.pct >= 95 ? '<span class="tag tag-ok">良好</span>'
      : h.pct >= 85 ? '<span class="tag tag-warn">注意</span>' : '<span class="tag tag-bad">异常</span>';
    const maxMod = Math.max(1, ...d.by_module.map((r) => r.n));
    const probeT = t.probe_excluded || 0, probeY = y.probe_excluded || 0;
    const probeNote = probeT || probeY
      ? ` · 已剔除探针作答 今日 ${probeT.toLocaleString()} / 昨日 ${probeY.toLocaleString()} 条（自动化测试出口网段，不计入用户指标）`
      : '';
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>数据看板</h1><div class="sub">${new Date().toLocaleDateString('zh-CN')} · 统计缓存 5 分钟刷新${probeNote}</div></div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="lb">今日活跃用户${probeT ? ' <span class="tag tag-gray" title="已剔除探针流量">真人</span>' : ''}</div><div class="v">${t.active.toLocaleString()}</div>${delta(t.active, y.active)}</div>
      <div class="kpi"><div class="lb">今日作答量</div><div class="v">${t.answered.toLocaleString()}</div>${delta(t.answered, y.answered)}</div>
      <div class="kpi"><div class="lb">新增用户</div><div class="v">${t.new_users.toLocaleString()}</div>${delta(t.new_users, y.new_users)}</div>
      <div class="kpi"><div class="lb">题库健康度 ${healthTag}</div><div class="v">${h.pct}%</div>
        <div class="d flat">在库 ${(h.active != null ? h.active : h.total).toLocaleString()} / 差评 ${h.flagged.toLocaleString()} / 待纠错 ${h.open_reports}${h.pending ? ` / <span style="color:var(--warning)">待审 ${h.pending.toLocaleString()}</span>` : ''} / 下架存量 ${h.disabled.toLocaleString()}</div></div>
      <div class="kpi"><div class="lb">今日 AI 调用</div><div class="v">${t.ai_calls.toLocaleString()}</div>${delta(t.ai_calls, y.ai_calls)}</div>
    </div>
    <div class="split-2" style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-h"><span class="t">近 14 天作答量趋势</span><span class="tag tag-brand">作答量</span></div>
        <div class="spark">${d.trend.length ? spark(d.trend, 'answered') : '<span style="color:var(--t4);font-size:12px">暂无作答数据</span>'}</div>
        <div class="row" style="justify-content:space-between;font-size:11px;color:var(--t4);margin-top:6px">
          <span>${esc((d.trend[0] || {}).d || '')}</span><span>${esc((d.trend[d.trend.length - 1] || {}).d || '')}</span></div>
        <div class="card-h" style="margin-top:14px"><span class="t">AI 调用趋势</span><span class="tag tag-gray">缓存新增/天</span></div>
        <div class="spark" style="height:40px">${d.trend.length ? spark(d.trend, 'ai_calls') : '<span style="color:var(--t4);font-size:12px">暂无数据</span>'}</div>
      </div>
      <div class="card">
        <div class="card-h"><span class="t">AI 通道状态</span><a class="more" href="#/settings">通道配置 →</a></div>
        <div id="dash-llm"><span style="color:var(--t3);font-size:12px">检测中…</span></div>
      </div>
    </div>
    <div class="split-2" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
      <div class="card">
        <div class="card-h"><span class="t">待办事项</span></div>
        <div class="hbar"><span class="lb" style="width:auto;flex:1">待审批次</span>
          <a class="tag ${d.todos.pending_batches ? 'tag-bad' : 'tag-gray'}" href="#/batches">${d.todos.pending_batches} 个批次</a></div>
        <div class="hbar"><span class="lb" style="width:auto;flex:1">考点抽审队列</span>
          <a class="tag ${d.todos.tag3_review ? 'tag-warn' : 'tag-gray'}" href="#/review">${d.todos.tag3_review} 题</a></div>
        <div class="hbar"><span class="lb" style="width:auto;flex:1">用户纠错待处理</span>
          <a class="tag ${d.todos.open_reports ? 'tag-bad' : 'tag-gray'}" href="#/reports">${d.todos.open_reports} 条</a></div>
        <div class="hbar"><span class="lb" style="width:auto;flex:1">内容质量巡检</span>
          <a class="tag tag-info" href="#/governance">去查看</a></div>
      </div>
      <div class="card">
        <div class="card-h"><span class="t">题库分布（${h.total.toLocaleString()} 题）</span><a class="more" href="#/questions">题库管理 →</a></div>
        ${d.by_module.map((r) => `<div class="hbar"><span class="lb">${esc(MODS[r.module] || r.module || '其他')}</span>
          <div class="bar"><i style="width:${Math.round(r.n * 100 / maxMod)}%"></i></div><span class="n">${r.n.toLocaleString()}</span></div>`).join('')}
      </div>
      <div class="card">
        <div class="card-h"><span class="t">近 7 天正确率</span><a class="more" href="#/users">学习数据 →</a></div>
        ${d.acc7.length ? d.acc7.map((r) => {
          const low = r.acc != null && r.acc < 60;
          return `<div class="hbar"><span class="lb">${esc(MODS[r.module] || r.module)}</span>
            <div class="bar"><i style="width:${r.acc || 0}%${low ? ';background:var(--error)' : ''}"></i></div>
            <span class="n"${low ? ' style="color:var(--error)"' : ''}>${r.acc == null ? '—' : r.acc + '%'}</span></div>`;
        }).join('') : '<div class="empty" style="padding:20px 0">近 7 天暂无作答</div>'}
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><span class="t">运维状态</span><span class="tag tag-gray">审计日志汇总</span></div>
      <div id="dash-ops"><span style="color:var(--t3);font-size:12px">加载中…</span></div>
    </div>`;
    api('/api/admin/ops_status').then((o) => {
      const box = document.getElementById('dash-ops');
      if (!box) return;
      if (!o.available) {
        box.innerHTML = '<span style="color:var(--t3);font-size:12px">审计日志目录不可用（本地环境无 /reports 挂载）</span>';
        return;
      }
      const tag = (it, label) => it
        ? `<div class="hbar"><span class="lb" style="width:auto;flex:1">${label}<span class="sub" style="margin-left:6px;font-size:11px;color:var(--t4)">${esc(it.ts || '')}</span></span>
           <span class="tag ${it.ok ? 'tag-ok' : 'tag-bad'}">${it.ok ? '●' : '✕'} ${esc((it.detail || it.rev || '').slice(0, 60))}</span></div>`
        : `<div class="hbar"><span class="lb" style="width:auto;flex:1">${label}</span><span class="tag tag-gray">无记录</span></div>`;
      const dep = o.last_deploy
        ? `<div class="hbar"><span class="lb" style="width:auto;flex:1">最近部署<span class="sub" style="margin-left:6px;font-size:11px;color:var(--t4)">${esc(o.last_deploy.ts)}</span></span>
           <span class="tag tag-brand">rev ${esc(o.last_deploy.rev)}</span></div>`
        : '';
      box.innerHTML = dep
        + tag(o.backup, '每日备份上传 R2')
        + tag(o.restore_verify, '备份可恢复验证')
        + tag(o.r2_verify, 'R2 副本周验证')
        + tag(o.mem, '宿主内存水位')
        + `<div class="hbar"><span class="lb" style="width:auto;flex:1">24h 容器变更</span>
           <span class="tag ${o.container_changes_24h ? 'tag-warn' : 'tag-gray'}">${o.container_changes_24h} 次</span></div>`
        + ((o.alerts || []).length
          ? `<div style="margin-top:8px;font-size:11px;color:var(--error)">近 7 天告警：</div>`
            + o.alerts.slice(0, 5).map((a) => `<div style="font-size:11px;color:var(--error);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(a)}">${esc(a)}</div>`).join('')
          : '<div style="margin-top:8px;font-size:11px;color:var(--t4)">近 7 天无告警</div>')
        + crawlerPanel(o.crawlers);
    }).catch(() => {
      const box = document.getElementById('dash-ops');
      if (box) box.innerHTML = '<span style="color:var(--error);font-size:12px">加载失败</span>';
    });
    api('/api/admin/llm_health').then((r) => {
      const box = document.getElementById('dash-llm');
      if (!box) return;
      box.innerHTML = (r.items || []).map((it) =>
        `<div class="hbar"><span class="lb" style="width:auto;flex:1">${esc(it.name)}<span class="sub" style="margin-left:6px;font-size:11px;color:var(--t4)">${esc(it.host)}</span></span>
         <span class="tag ${it.ok ? 'tag-ok' : 'tag-bad'}">${it.ok ? '● 正常' : '✕ 异常'} ${esc(String(it.status))}</span></div>`).join('')
        || '<span style="color:var(--t3);font-size:12px">未配置通道</span>';
    }).catch(() => {
      const box = document.getElementById('dash-llm');
      if (box) box.innerHTML = '<span style="color:var(--error);font-size:12px">检测失败</span>';
    });
  }

  Admin.registerPage('dashboard', { title: '数据看板', crumb: '概览 / 数据看板', render });
})();
