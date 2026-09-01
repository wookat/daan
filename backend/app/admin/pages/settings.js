/* D01 系统设置：AI 通道 / 令牌 / 公告 / 试卷库 */
(function () {
  const { api, esc, toast, fmtTime } = Admin;

  async function loadAnn() {
    const box = document.getElementById('st-ann');
    const r = await api('/api/admin/announcements');
    box.innerHTML = r.items.length ? `<table class="tbl"><thead><tr>
      <th>标题</th><th>内容</th><th style="width:110px">创建时间</th><th style="width:70px">状态</th><th style="width:70px"></th></tr></thead><tbody>
      ${r.items.map((a) => `<tr><td><b>${esc(a.title)}</b></td>
        <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.body || '')}</td>
        <td style="font-size:12px">${fmtTime(a.created_at)}</td>
        <td>${a.active ? '<span class="tag tag-ok">展示中</span>' : '<span class="tag tag-gray">已停用</span>'}</td>
        <td><a data-aid="${a.id}" data-active="${a.active ? 0 : 1}" style="color:var(--brand-600);cursor:pointer">${a.active ? '停用' : '启用'}</a></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty"><div class="eico">📭</div>暂无公告</div>';
    box.querySelectorAll('[data-aid]').forEach((a) => {
      a.onclick = async () => {
        await api('/api/admin/announcements/' + a.dataset.aid, {
          method: 'PATCH', body: JSON.stringify({ active: a.dataset.active === '1' }),
        });
        toast('已更新');
        loadAnn();
      };
    });
  }

  async function render(el) {
    el.innerHTML = `
    <div class="pagehead">
      <div><h1>系统设置</h1><div class="sub">AI 通道、令牌与公告管理</div></div>
    </div>
    <div class="split-2" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-h"><span class="t">AI 通道健康</span><a class="more" id="st-llm-refresh" style="cursor:pointer">重新检测</a></div>
        <div id="st-llm"><span style="color:var(--t3);font-size:12px">检测中…</span></div>
      </div>
      <div class="card">
        <div class="card-h"><span class="t">令牌与配置</span></div>
        <div id="st-info"><span style="color:var(--t3);font-size:12px">加载中…</span></div>
        <div class="expl-box" style="margin-top:10px;font-size:12px">管理令牌与导入令牌通过服务器环境变量（ADMIN_TOKEN / IMPORT_TOKEN）配置，轮换需在服务器更新后重启服务。</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div class="card-h"><span class="t">公告管理</span></div>
      <div class="row" style="gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <input class="ipt" id="ann-title" aria-label="公告标题" style="width:200px" placeholder="公告标题">
        <input class="ipt" id="ann-body" aria-label="公告内容" style="flex:1;min-width:200px" placeholder="公告内容（可留空）">
        <button class="btn btn-primary" id="ann-add">发布公告</button>
      </div>
      <div id="st-ann" style="margin:0 -20px -16px"></div>
    </div>
    <div class="card" style="padding:0">
      <div class="card-h" style="padding:14px 16px 0"><span class="t">真题卷库</span></div>
      <div id="st-papers"><div class="empty">加载中…</div></div>
    </div>`;
    const loadLLM = () => {
      const box = document.getElementById('st-llm');
      box.innerHTML = '<span style="color:var(--t3);font-size:12px">检测中…</span>';
      api('/api/admin/llm_health').then((r) => {
        box.innerHTML = (r.items || []).map((it) =>
          `<div class="hbar"><span class="lb" style="width:auto;flex:1">${esc(it.name)}<span style="margin-left:6px;font-size:11px;color:var(--t4)">${esc(it.host)}</span></span>
           <span class="tag ${it.ok ? 'tag-ok' : 'tag-bad'}">${it.ok ? '● 正常' : '✕ 异常'} ${esc(String(it.status))}</span></div>`).join('')
          || '<span style="color:var(--t3);font-size:12px">未配置通道</span>';
      }).catch(() => { box.innerHTML = '<span style="color:var(--error);font-size:12px">检测失败</span>'; });
    };
    document.getElementById('st-llm-refresh').onclick = loadLLM;
    loadLLM();
    api('/api/admin/settings_info').then((info) => {
      document.getElementById('st-info').innerHTML = `
        <div class="hbar"><span class="lb" style="width:auto;flex:1">导入令牌 IMPORT_TOKEN</span>
          ${info.import_token.set ? `<span class="tag tag-ok">已配置 ${esc(info.import_token.masked)}</span>` : '<span class="tag tag-bad">未配置</span>'}</div>
        <div class="hbar"><span class="lb" style="width:auto;flex:1">默认模型 LLM_MODEL</span>
          <span class="tag tag-info">${esc(info.llm_model || '未设置')}</span></div>
        <div class="hbar"><span class="lb" style="width:auto;flex:1">访问码 ACCESS_CODE</span>
          <span class="tag ${info.access_code_enabled ? 'tag-ok' : 'tag-gray'}">${info.access_code_enabled ? '已启用' : '未启用'}</span></div>`;
    });
    document.getElementById('ann-add').onclick = async () => {
      const title = document.getElementById('ann-title').value.trim();
      if (!title) { toast('请输入标题', true); return; }
      await api('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, body: document.getElementById('ann-body').value.trim() }),
      });
      toast('已发布');
      document.getElementById('ann-title').value = '';
      document.getElementById('ann-body').value = '';
      loadAnn();
    };
    loadAnn();
    api('/api/admin/exam_papers').then((r) => {
      const box = document.getElementById('st-papers');
      box.innerHTML = (r.items || []).length ? `<table class="tbl"><thead><tr>
        <th>试卷</th><th style="width:70px">类型</th><th style="width:60px">年份</th><th style="width:90px">地区</th><th style="width:60px">题数</th></tr></thead><tbody>
        ${r.items.slice(0, 30).map((p) => `<tr><td>${esc(p.title)}</td><td>${esc(p.kind || '—')}</td>
          <td>${p.year || '—'}</td><td>${esc(p.region || '—')}</td><td>${p.n_questions || p.n || '—'}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty"><div class="eico">📭</div>暂无试卷</div>';
    }).catch(() => {
      document.getElementById('st-papers').innerHTML = '<div class="empty">试卷库加载失败</div>';
    });
  }

  Admin.registerPage('settings', { title: '系统设置', crumb: '系统 / 系统设置', render });
})();
