/* A02 数据分析 — 使用/留存/习惯/漏斗/团队/AI/考试 */
(function () {
  const { api, esc } = Admin;
  const cache = {};

  const TABS = [
    ['usage', '使用情况'],
    ['retention', '留存'],
    ['habits', '使用习惯'],
    ['funnel', '转化漏斗'],
    ['team', '团队'],
    ['ai', 'AI 质量'],
    ['exam', '考试题库'],
  ];

  const num = (n) => (n == null ? '0' : Number(n).toLocaleString());
  const pct = (n) => (n == null ? '—' : `${Number(n).toFixed(1)}%`);
  const tabBtn = (href, label, on) =>
    `<a href="${href}" style="display:inline-block;margin:0 6px 8px 0;padding:5px 12px;border-radius:6px;font-size:12px;text-decoration:none;border:1px solid ${on ? 'var(--brand)' : 'var(--line)'};background:${on ? 'var(--brand)' : 'transparent'};color:${on ? '#fff' : 'var(--t2)'}">${esc(label)}</a>`;
  const bar = (v, max, label) =>
    `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
      <span style="width:110px;font-size:12px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(String(label))}</span>
      <span style="flex:1;height:10px;background:var(--line);border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:${Math.min(100, (v * 100) / (max || 1)).toFixed(1)}%;background:var(--brand);border-radius:5px"></i></span>
      <span style="width:60px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums">${num(v)}</span></div>`;
  const tbl = (heads, rows) =>
    `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>${heads.map((h) => `<th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);color:var(--t3);font-weight:500">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px 8px;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums">${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${heads.length}" style="padding:12px;color:var(--t3)">暂无数据</td></tr>`}</tbody></table>`;
  const kpi = (lb, v, d) => `<div class="kpi"><div class="lb">${lb}</div><div class="v">${v}</div>${d || ''}</div>`;
  const card = (t, inner, tag) => `<div class="card" style="margin-bottom:14px"><div class="card-h"><span class="t">${t}</span>${tag ? `<span class="tag tag-gray">${tag}</span>` : ''}</div>${inner}</div>`;
  const failed = (r) => card('加载失败', `<span style="color:var(--error);font-size:12px">${esc((r && r.reason && r.reason.message) || 'error')}</span>`);
  const grid2 = (a, b) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${a}${b}</div>`;

  function spark(rows, key) {
    const max = Math.max(1, ...rows.map((r) => r[key] || 0));
    return `<div style="display:flex;align-items:flex-end;gap:2px;height:56px">${rows.map((r, i) =>
      `<i style="flex:1;min-width:3px;border-radius:2px 2px 0 0;background:${i === rows.length - 1 ? 'var(--brand)' : '#93c5fd'};height:${Math.max(4, Math.round(((r[key] || 0) * 100) / max))}%" title="${r.d}：${num(r[key] || 0)}"></i>`).join('')}</div>`;
  }

  async function get(path) {
    if (!cache[path]) {
      cache[path] = api(path)
        .then((d) => ({ ok: true, d }))
        .catch((e) => { delete cache[path]; return { ok: false, reason: e }; });
    }
    const r = await cache[path];
    return r.ok ? r.d : failed(r);
  }

  function heatmap(heat) {
    if (!heat || !heat.length) return '暂无数据';
    const max = Math.max(1, ...heat.flat());
    // 后端 %w：0=周日 … 6=周六；前端按周一开头展示
    const order = [1, 2, 3, 4, 5, 6, 0];
    const names = { 0: '日', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' };
    let h = '<table style="border-collapse:collapse;font-size:11px"><tr><td></td>';
    for (let hr = 0; hr < 24; hr += 1) h += `<td style="width:18px;text-align:center;color:var(--t3)">${hr}</td>`;
    h += '</tr>';
    order.forEach((wd) => {
      h += `<tr><td style="padding-right:6px;color:var(--t3)">${names[wd]}</td>`;
      for (let hr = 0; hr < 24; hr += 1) {
        const v = (heat[wd] && heat[wd][hr]) || 0;
        const a = v / max;
        h += `<td title="周${names[wd]} ${hr}时：${num(v)} 次" style="height:16px;background:rgba(37,99,235,${(a * 0.9 + 0.04).toFixed(2)});border:1px solid #fff"></td>`;
      }
      h += '</tr>';
    });
    return h + '</table>';
  }

  const funnelSteps = (steps) => tbl(['环节', '人数', '逐步转化', '整体转化'],
    (steps || []).map((s, i) => [esc(s.event), num(s.uids), i ? pct(s.conv_prev) : '—', pct(s.conv_first)]));

  let funnelPreset = null;

  const RENDER = {
    usage: (d) => `
      <div class="kpis">
        ${kpi('DAU（今日 / 昨日）', `${num(d.kpis.dau)} / ${num(d.kpis.dau_yesterday)}`)}
        ${kpi('WAU', num(d.kpis.wau))}
        ${kpi('MAU', num(d.kpis.mau), `<div class="d flat">粘性 DAU/MAU ${pct(d.kpis.stickiness)}</div>`)}
        ${kpi('新增用户（今日/昨日）', `${num(d.kpis.new_today)} / ${num(d.kpis.new_yesterday)}`)}
        ${kpi('窗口活跃 uid', num(d.kpis.active_uids), `<div class="d flat">注册 ${num(d.kpis.registered_active)} · 匿名 ${num(d.kpis.anon_active)}</div>`)}
        ${kpi('注册转化', `${num(d.kpis.register_events)} 事件`, `<div class="d flat">窗口新注册账号 ${num(d.kpis.new_registrations)}</div>`)}
      </div>
      ${card(`近 ${d.days} 天活跃趋势`, spark(d.trend, 'active') + `<div style="font-size:11px;color:var(--t3);margin-top:6px">柱=活跃 uid（答题∪事件），悬浮看明细</div>`)}
      ${grid2(
        card(`平台分布<span class="tag tag-gray">标记覆盖 ${pct(d.platform_coverage)}</span>`,
          d.platforms.length ? d.platforms.map((p) => bar(p.u, d.platforms[0].u, `${p.platform}（${num(p.n)} 事件）`)).join('') : '暂无数据'),
        card('功能渗透率（窗口活跃用户占比）',
          tbl(['功能', '使用人数', '渗透率'], d.penetration.map((p) => [esc(p.name), num(p.users), pct(p.pct)]))))}
      ${card('高频事件 TOP15', tbl(['事件', '次数', '人数'], d.top_events.map((e) => [esc(e.event), num(e.n), num(e.u)])))}`,

    retention: (d) => {
      const w = (k) => {
        let sn = 0, ss = 0;
        d.cohorts.forEach((c) => { if (c[k] != null) { sn += c.size; ss += c[k] * c.size; } });
        return sn ? (ss / sn).toFixed(1) : null;
      };
      return `
      <div class="kpis">
        ${kpi('次日留存（加权）', pct(w('d1')))}
        ${kpi('7 日留存（加权）', pct(w('d7')))}
        ${kpi('30 日留存（加权）', pct(w('d30')))}
        ${kpi('队列数', num(d.cohorts.length), `<div class="d flat">${esc(d.note || '')}</div>`)}
      </div>
      ${card('新用户留存矩阵（按全局首现日）', tbl(['日期', '新增', 'D1', 'D3', 'D7', 'D14', 'D30'],
        d.cohorts.map((c) => [esc(c.day), num(c.size), pct(c.d1), pct(c.d3), pct(c.d7), pct(c.d14), pct(c.d30)])))}
      ${card('周回访率（本周活跃 ∩ 上周活跃）', tbl(['周', '活跃', '其中回访', '回访率'],
        d.weekly.map((r) => [esc(r.week), num(r.active), num(r.returning), pct(r.ret_pct)])))}`;
    },

    habits: (d) => {
      const s = d.sessions;
      const quitNames = { practice_quit_keep: '退出-保留进度', practice_quit_end: '退出-结束', practice_stay_here: '挽留-留下', practice_resume_cont: '续做-继续', practice_resume_drop: '续做-放弃' };
      return `
      <div class="kpis">
        ${kpi('会话数 / 日均', `${num(s.count)} / ${num(s.per_day)}`)}
        ${kpi('中位会话时长', `${Math.round(s.median_sec / 60)} 分钟`, `<div class="d flat">P90 ${Math.round(s.p90_sec / 60)} 分钟</div>`)}
        ${kpi('平均会话深度', `${s.avg_events} 事件`)}
        ${kpi('会话覆盖率', pct(s.coverage_pct), '<div class="d flat">session_id 埋点上线后逐步升高</div>')}
      </div>
      ${card(`活跃时段热力（近 ${d.days} 天，次数）`, heatmap(d.heatmap))}
      ${grid2(
        card('连续活跃天数分布（人数）', d.streaks.length ? d.streaks.map((b) => bar(b.users, Math.max(...d.streaks.map((x) => x.users)), b.label)).join('') : '暂无数据'),
        card('答题节奏（每题用时分布）', d.answer_secs.length ? d.answer_secs.map((b) => bar(b.n, Math.max(...d.answer_secs.map((x) => x.n)), b.label)).join('') : '暂无数据'))}
      ${card('练习退出/挽留事件', tbl(['行为', '次数'], Object.keys(quitNames).map((k) => [esc(quitNames[k]), num(d.quit_events[k] || 0)])))}`;
    },

    funnel: (d) => {
      const names = Object.keys(d.presets || {});
      if (!names.length) return card('漏斗', '暂无数据');
      if (!funnelPreset || !d.presets[funnelPreset]) funnelPreset = names[0];
      const btns = names.map((n) =>
        `<button data-fp="${esc(n)}" style="margin:0 6px 8px 0;padding:5px 12px;border-radius:6px;font-size:12px;cursor:pointer;border:1px solid ${n === funnelPreset ? 'var(--brand)' : 'var(--line)'};background:${n === funnelPreset ? 'var(--brand)' : 'transparent'};color:${n === funnelPreset ? '#fff' : 'var(--t2)'}">${esc(n)}</button>`).join('');
      return `<div style="margin-bottom:12px">${btns}</div>
        ${card(`${esc(funnelPreset)}（近 ${d.days} 天 · 有序漏斗）`, d.steps.length ? funnelSteps(d.steps) : '该漏斗暂无数据，换个预设或等埋点积累')}`;
    },

    team: (d) => `
      <div class="kpis">
        ${kpi('团队总数', num(d.kpis.teams))}
        ${kpi('活跃团队（7 天内有成员活跃）', num(d.kpis.active_teams_7d))}
        ${kpi('团队成员', num(d.kpis.members), `<div class="d flat">平均规模 ${d.kpis.avg_size} 人</div>`)}
        ${kpi('成员 7 天活跃率', pct(d.kpis.team_active_rate_7d))}
        ${kpi('非成员 7 天活跃率', pct(d.kpis.solo_active_rate_7d), '<div class="d flat">团队 vs 个人的留存增益对照</div>')}
      </div>
      ${grid2(
        card('团队规模分布（团队数）', d.size_bins.length ? d.size_bins.map((b) => bar(b.teams, Math.max(...d.size_bins.map((x) => x.teams)), b.label)).join('') : '暂无数据'),
        card('成员活跃分层（30 天作答）', d.member_tiers.length ? d.member_tiers.map((b) => bar(b.users, Math.max(...d.member_tiers.map((x) => x.users)), b.label)).join('') : '暂无数据'))}
      ${card('组队邀请漏斗', funnelSteps(d.invite_funnel))}
      ${card('团队答题榜 TOP10', tbl(['团队', '成员', '7 天活跃', '30 天作答'], d.top_teams.map((t) => [esc(t.name || `团队${t.team_id}`), num(t.members), num(t.active_7d), num(t.answers)])))}`,

    ai: (d) => `
      <div class="kpis">
        ${kpi('讲解缓存命中率', pct(d.cache.hit_pct), `<div class="d flat">命中 ${num(d.cache.hits)} / 新生成 ${num(d.cache.gens)}</div>`)}
        ${kpi('讲解好评率', pct(d.ratings.up_pct), `<div class="d flat">👍${num(d.ratings.up)} 👎${num(d.ratings.down)} · ${num(d.ratings.rated_entries)} 条有评分</div>`)}
        ${kpi('窗口估算成本', `¥${num(d.est_cost_total)}`, '<div class="d flat">按通道粗估单价，量级参考</div>')}
      </div>
      ${card('LLM 通道用量（按终态通道，近 30 天）', tbl(['通道', '次数', '成功率', '均耗时ms', '含图', '流式', '估算¥'],
        d.channels.map((c) => [esc(c.channel), num(c.n), pct(c.ok_pct), num(c.avg_ms), num(c.imgs), num(c.streams), `¥${num(c.est_cost)}`])))}
      ${card('功能调用分布', tbl(['功能', '次数', '成功率', '含图', '流式'],
        d.features.map((f) => [esc(f.channel.replace('feat:', '')), num(f.n), pct(f.ok_pct), num(f.imgs), num(f.streams)])))}`,

    exam: (d) => `
      <div class="kpis">
        ${kpi('套卷考试', `${num(d.exam.attempts)} 次`, `<div class="d flat">完赛 ${pct(d.exam.finish_pct)} · 均分 ${d.exam.avg_score ?? '—'}</div>`)}
        ${kpi('模考大赛', `${num(d.mock.registered)} 报名`, `<div class="d flat">到场 ${num(d.mock.attempted)} · 出分 ${num(d.mock.scored)}</div>`)}
        ${kpi('PK 对战', `${num(d.pk.total)} 场`, `<div class="d flat">完赛 ${num(d.pk.finished)}</div>`)}
        ${kpi('题目覆盖度', pct(d.coverage.pct), `<div class="d flat">${num(d.coverage.answered_ever)}/${num(d.coverage.total_questions)} · 窗口 ${pct(d.coverage.pct_window)}</div>`)}
      </div>
      ${grid2(
        card('申论 / 面试 / 问答（窗口）', tbl(['功能', '量', '人数'], [
          ['申论作答', num(d.shenlun.answers), num(d.shenlun.answerers)],
          ['面试练习', num(d.interview.sessions), num(d.interview.users)],
          ['AI 问答', num(d.ask.sessions), num(d.ask.users)],
          ['分享题目', num(d.shares.created), `累计打开 ${num(d.shares.opens)}`],
        ])),
        card('近期模考大赛', tbl(['赛事', '报名', '到场', '出分'], (d.mock.events || []).slice(0, 6).map((e) => [esc(e.title || `#${e.id}`), num(e.regs), num(e.atts), num(e.scored)]))))}
      ${card('高频错题 TOP20（窗口作答≥8 次）', tbl(['题干', '模块', '作答', '错误率'],
        d.hardest.map((hq) => [esc(hq.stem || `题目${hq.qid}`), esc(hq.module || ''), num(hq.n), pct(hq.err_pct)])))}`,
  };

  async function render(el) {
    const m = location.hash.match(/tab=(\w+)/);
    const active = TABS.some(([k]) => k === (m && m[1])) ? m[1] : 'usage';
    el.innerHTML = `
      <div class="pagehead"><div><h1>数据分析</h1><div class="sub">产品使用与质量指标 · 聚合缓存 5 分钟 · 探针流量已剔除</div></div></div>
      <div style="margin-bottom:14px">${TABS.map(([k, t]) => tabBtn(`#/analytics?tab=${k}`, t, k === active)).join('')}</div>
      <div id="an-body"><div class="card">加载中…</div></div>`;
    const path = active === 'funnel' && funnelPreset && cache['__presets']
      ? `/api/admin/analytics/funnel?chain=${encodeURIComponent(cache['__presets'][funnelPreset].join(','))}`
      : `/api/admin/analytics/${active}`;
    const d = await get(path);
    const body = document.getElementById('an-body');
    if (!body) return;
    if (typeof d === 'string') { body.innerHTML = d; return; }
    if (active === 'funnel' && d.presets) {
      cache['__presets'] = d.presets;
      // 首次拿到预设后若还没选，重取第一个预设的链
      if (!funnelPreset || !d.presets[funnelPreset]) {
        funnelPreset = Object.keys(d.presets)[0];
        if (funnelPreset && !d.steps.length) {
          const p2 = `/api/admin/analytics/funnel?chain=${encodeURIComponent(d.presets[funnelPreset].join(','))}`;
          const d2 = await get(p2);
          if (typeof d2 === 'string') { body.innerHTML = d2; return; }
          body.innerHTML = funnelBody(d2);
          bindFunnel(el);
          return;
        }
      }
      body.innerHTML = funnelBody(d);
      bindFunnel(el);
      return;
    }
    body.innerHTML = RENDER[active](d);
  }

  function funnelBody(d) {
    const names = Object.keys((cache['__presets']) || d.presets || {});
    const btns = names.map((n) =>
      `<button data-fp="${esc(n)}" style="margin:0 6px 8px 0;padding:5px 12px;border-radius:6px;font-size:12px;cursor:pointer;border:1px solid ${n === funnelPreset ? 'var(--brand)' : 'var(--line)'};background:${n === funnelPreset ? 'var(--brand)' : 'transparent'};color:${n === funnelPreset ? '#fff' : 'var(--t2)'}">${esc(n)}</button>`).join('');
    return `<div style="margin-bottom:12px">${btns}</div>
      ${card(`${esc(funnelPreset)}（近 ${d.days} 天 · 有序漏斗）`, d.steps.length ? funnelSteps(d.steps) : '该漏斗暂无数据，换个预设或等埋点积累')}`;
  }

  function bindFunnel(el) {
    el.querySelectorAll('[data-fp]').forEach((b) => b.addEventListener('click', async () => {
      funnelPreset = b.dataset.fp;
      const chain = (cache['__presets'] || {})[funnelPreset] || [];
      const p = `/api/admin/analytics/funnel?chain=${encodeURIComponent(chain.join(','))}`;
      const body = document.getElementById('an-body');
      if (!body) return;
      body.innerHTML = '<div class="card">加载中…</div>';
      const d = await get(p);
      body.innerHTML = typeof d === 'string' ? d : funnelBody(d);
      bindFunnel(el);
    }));
  }

  Admin.registerPage('analytics', { title: '数据分析', crumb: '概览 / 数据分析', render });
})();
